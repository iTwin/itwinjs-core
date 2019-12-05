/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Client, Issuer, UserinfoResponse as OIDCUserInfo, TokenSet, AuthorizationParameters, OpenIDCallbackChecks, generators } from "openid-client";
import { AccessToken, UserInfo, UrlDiscoveryClient } from "@bentley/imodeljs-clients";
import { ClientRequestContext } from "@bentley/bentleyjs-core";

import * as url from "url";
import * as puppeteer from "puppeteer";
import * as os from "os";

function oidcInfoToUserInfo(info: OIDCUserInfo): UserInfo {
  const { sub, email, name, family_name, org, org_name, ultimate_site, usage_country_iso } = info;
  const emailObj = (email) ? { id: email } : undefined;
  const profile = (name && family_name) ? { firstName: name, lastName: family_name } : undefined;
  const organization = (org && org_name) ? { id: org as string, name: org_name as string } : undefined;
  const featureTracking = (ultimate_site && usage_country_iso) ? { ultimateSite: ultimate_site as string, usageCountryIso: usage_country_iso as string } : undefined;

  return new UserInfo(sub, emailObj, profile, organization, featureTracking);
}

async function tokenSetToAccessToken(client: Client, tokenSet: TokenSet): Promise<AccessToken> {
  const userInfo = await client.userinfo(tokenSet);
  const startsAt: Date = new Date(tokenSet.expires_at! - tokenSet.expires_in!);
  const expiresAt: Date = new Date(tokenSet.expires_at!);
  return AccessToken.fromJsonWebTokenString(
    tokenSet.access_token!,
    startsAt,
    expiresAt,
    oidcInfoToUserInfo(userInfo));
}

/** @alpha */
export interface OidcConfiguration {
  clientId: string;
  redirectUri: string;
}

/** @alpha */
export async function getToken(username: string, password: string, scope: string, oidcConfig: OidcConfiguration, region?: number): Promise<AccessToken> {
  // tslint:disable-next-line:no-console
  console.log(`Starting OIDC signin for ${username} ...`);
  const client = await OidcPublicClient.create(oidcConfig, undefined === region ? 0 : region);
  return client.getToken(username, password, scope);
}

class OidcPublicClient {
  private _client: Client;
  private _issuer: Issuer<Client>;
  private readonly _imsUrl: string;
  private readonly _redirectUri: string;

  private constructor(issuer: Issuer<Client>, clientId: string, imsUrl: string, redirectUri: string) {
    this._client = new issuer.Client({ client_id: clientId, token_endpoint_auth_method: "none" });
    this._issuer = issuer;
    this._imsUrl = imsUrl;
    this._redirectUri = redirectUri;
  }

  public static async create(config: OidcConfiguration, env: number): Promise<OidcPublicClient> {
    const urlDiscoveryClient: UrlDiscoveryClient = new UrlDiscoveryClient();
    const imsUrl = await urlDiscoveryClient.discoverUrl(new ClientRequestContext(""), "IMSProfile.RP", env);

    const oidcUrl = await urlDiscoveryClient.discoverUrl(new ClientRequestContext(""), "IMSOpenID", env);
    const issuer = await Issuer.discover(url.resolve(oidcUrl, "/.well-known/openid-configuration"));

    return new OidcPublicClient(issuer, config.clientId, imsUrl, config.redirectUri);
  }

  public async getToken(username: string, password: string, scope: string): Promise<AccessToken> {
    const client = this._client;
    const [authParams, callbackChecks] = this.createAuthParams(scope);
    const authorizationUrl = client.authorizationUrl(authParams);

    // Launch puppeteer with no sandbox only on linux
    let launchOptions: puppeteer.LaunchOptions = { dumpio: true };
    if (os.platform() === "linux") {
      launchOptions = {
        args: ["--no-sandbox"], // , "--disable-setuid-sandbox"],
      };
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    const onRedirectRequest = this.interceptRedirectUri(page);
    await page.goto(authorizationUrl, { waitUntil: "networkidle2" });
    const errMsg = await this.handleLoginPage(page, username, password);

    // Check to see if there was an error while logging in.  If so, throw the error
    if (undefined !== errMsg) {
      await page.close();
      await browser.close();
      throw new Error(`Failed OIDC signin for ${username}.\n${errMsg}`);
    }

    await this.handleConsentPage(page);

    const tokenSet = await client.callback(this._redirectUri, client.callbackParams(await onRedirectRequest), callbackChecks);
    await browser.close();

    // tslint:disable-next-line:no-console
    console.log(`Finished OIDC signin for ${username} ...`);

    return tokenSetToAccessToken(client, tokenSet);
  }

  private createAuthParams(scope: string): [AuthorizationParameters, OpenIDCallbackChecks] {
    const verifier = generators.codeVerifier();
    const state = generators.state();

    const authParams: AuthorizationParameters = {
      redirect_uri: this._redirectUri,
      response_type: "code",
      code_challenge: generators.codeChallenge(verifier),
      code_challenge_method: "S256",
      scope,
      state,
    };

    const callbackChecks: OpenIDCallbackChecks = {
      state,
      response_type: "code",
      code_verifier: verifier,
    };

    return [authParams, callbackChecks];
  }

  private async interceptRedirectUri(page: puppeteer.Page): Promise<string> {
    return new Promise<string>((resolve) => {
      page.on("request", async (interceptedRequest) => {
        const reqUrl = interceptedRequest.url();
        if (reqUrl.startsWith(this._redirectUri)) {
          await interceptedRequest.respond({ status: 200, contentType: "text/html", body: "OK" });
          resolve(reqUrl);
          return;
        }

        await interceptedRequest.continue();
      });
    });
  }

  private async handleLoginPage(page: puppeteer.Page, userName: string, password: string): Promise<string | undefined> {
    const loginUrl = url.resolve(this._imsUrl, "/IMS/Account/Login");
    if (page.url().startsWith(loginUrl)) {
      await page.type("#EmailAddress", userName);
      await page.type("#Password", password);
      await Promise.all([
        page.waitForNavigation({
          timeout: 60000,
          waitUntil: "networkidle2",
        }),
        page.$eval("#submitLogon", (button: any) => button.click()),
      ]);
    }

    // Check if there were any errors when performing sign-in
    const errMsgText = await page.evaluate(() => {
      const errMsgElement = document.querySelector("#errormessage");
      if (null === errMsgElement)
        return undefined;
      return errMsgElement.textContent;
    });

    if (undefined === errMsgText || null === errMsgText)
      return undefined;

    return errMsgText;
  }

  private async handleConsentPage(page: puppeteer.Page): Promise<void> {
    const consentUrl = url.resolve(this._issuer.issuer as string, "/consent");
    if (page.url().startsWith(consentUrl))
      await page.click("button[value=yes]");
  }
}
