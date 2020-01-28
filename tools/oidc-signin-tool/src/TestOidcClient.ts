/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Client, Issuer, UserinfoResponse as OIDCUserInfo, TokenSet, AuthorizationParameters, OpenIDCallbackChecks, generators } from "openid-client";
import { IAuthorizationClient, AccessToken, UserInfo, UrlDiscoveryClient, Config } from "@bentley/imodeljs-clients";
import { assert, ClientRequestContext } from "@bentley/bentleyjs-core";
import * as url from "url";
import * as puppeteer from "puppeteer";
import * as os from "os";

/**
 * Interface for test user credentials
 * @alpha
 */
export interface TestUserCredentials {
  email: string;
  password: string;
}

/**
 * Configuration used by [[TestOidcClient]]
 * @alpha
 */
export interface TestOidcConfiguration {
  clientId: string;
  redirectUri: string;
  scope: string;
}

/**
 * Implementation of IAuthorizationClient used for the iModel.js integration tests.
 * - this is only to be used in test environments, and **never** in production code.
 * - use static create method to create an authorization client for the specified user credentials.
 * - calling getAccessToken() the first time, or after token expiry, causes the authorization to happen by
 *   spawning a headless browser, and automatically filling in the supplied user credentials.
 * @alpha
 */
export class TestOidcClient implements IAuthorizationClient {
  private _client!: Client;
  private _issuer!: Issuer<Client>;
  private _imsUrl!: string;
  private readonly _config: TestOidcConfiguration;
  private readonly _user: TestUserCredentials;
  private _accessToken?: AccessToken;
  private _deploymentRegion?: number;

  /**
   * Constructor
   * @param config OIDC configuration
   * @param user Test user to be logged in
   */
  public constructor(config: TestOidcConfiguration, user: TestUserCredentials) {
    this._config = config;
    this._user = user;
  }

  /**
   * Set the deployment region
   * - For Bentley internal applications, the deployment region is automatically inferred from the "imjs_buddi_resolve_url_using_region" configuration if possible
   * - Defaults to PROD if un-specified
   * @internal
   */
  public set deploymentRegion(deploymentRegion: number) {
    this._deploymentRegion = deploymentRegion;
  }

  private async initialize() {
    this._deploymentRegion = this._deploymentRegion || Config.App.getNumber("imjs_buddi_resolve_url_using_region") || 0; // Defaults to PROD (for 3rd party users)

    const urlDiscoveryClient: UrlDiscoveryClient = new UrlDiscoveryClient();
    this._imsUrl = await urlDiscoveryClient.discoverUrl(new ClientRequestContext(""), "IMSProfile.RP", this._deploymentRegion);

    const oidcUrl = await urlDiscoveryClient.discoverUrl(new ClientRequestContext(""), "IMSOpenID", this._deploymentRegion);
    this._issuer = await Issuer.discover(url.resolve(oidcUrl, "/.well-known/openid-configuration"));

    this._client = new this._issuer.Client({ client_id: this._config.clientId, token_endpoint_auth_method: "none" });
  }

  /** Returns true if there's a current authorized user or client (in the case of agent applications).
   * Returns true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    return !!this._accessToken && !this.hasExpired;
  }

  /** Returns true if the user has signed in, but the token has expired and requires a refresh */
  public get hasExpired(): boolean {
    if (!this._accessToken)
      return false;
    const expiresAt = this._accessToken.getExpiresAt();
    assert(!!expiresAt);
    return ((expiresAt!.getTime() - Date.now()) <= 0);
  }

  /** Returns true if the user has signed in, but the token has expired and requires a refresh */
  public get hasSignedIn(): boolean {
    return !!this._accessToken;
  }

  /** Returns a promise that resolves to the AccessToken of the currently authorized user
   * or authorized client (in the case of agent applications).
   * The token is refreshed if necessary and possible.
   * @throws [[BentleyError]] If the client was not used to authorize, or there was an authorization error.
   */
  public async getAccessToken(_requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (this.isAuthorized)
      return this._accessToken!;

    this._accessToken = await this.signIn();
    return this._accessToken;
  }

  private async signIn(): Promise<AccessToken> {
    if (this._client === undefined)
      await this.initialize();

    // tslint:disable-next-line:no-console
    console.log(`Starting OIDC signin for ${this._user.email} ...`);

    const [authParams, callbackChecks] = this.createAuthParams(this._config.scope);
    const authorizationUrl = this._client.authorizationUrl(authParams);

    // Launch puppeteer with no sandbox only on linux
    let launchOptions: puppeteer.LaunchOptions = { dumpio: true }; // , headless: false, slowMo: 500 };
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

    try {
      await this.handleLoginPage(page);

      // Handle federated sign-in
      await this.handleFederatedSignin(page);
    } catch (err) {
      await page.close();
      await browser.close();
      throw new Error(`Failed OIDC signin for ${this._user.email}.\n${err}`);
    }

    await this.handleConsentPage(page);

    const tokenSet = await this._client.callback(this._config.redirectUri, this._client.callbackParams(await onRedirectRequest), callbackChecks);
    await page.close();
    await browser.close();

    // tslint:disable-next-line:no-console
    console.log(`Finished OIDC signin for ${this._user.email} ...`);

    return this.tokenSetToAccessToken(tokenSet);
  }

  private static oidcInfoToUserInfo(info: OIDCUserInfo): UserInfo {
    const { sub, email, given_name, family_name, org, org_name, preferred_username, ultimate_site, usage_country_iso } = info;
    const emailObj = (email) ? { id: email } : undefined;
    const profile = (given_name && family_name) ? { firstName: given_name, lastName: family_name, preferredUserName: preferred_username } : undefined;
    const organization = (org && org_name) ? { id: org as string, name: org_name as string } : undefined;
    const featureTracking = (ultimate_site && usage_country_iso) ? { ultimateSite: ultimate_site as string, usageCountryIso: usage_country_iso as string } : undefined;

    return new UserInfo(sub, emailObj, profile, organization, featureTracking);
  }

  private async tokenSetToAccessToken(tokenSet: TokenSet): Promise<AccessToken> {
    const userInfo = await this._client.userinfo(tokenSet);
    const startsAt: Date = new Date((tokenSet.expires_at! - tokenSet.expires_in!) * 1000);
    const expiresAt: Date = new Date(tokenSet.expires_at! * 1000);
    return AccessToken.fromJsonWebTokenString(
      tokenSet.access_token!,
      startsAt,
      expiresAt,
      TestOidcClient.oidcInfoToUserInfo(userInfo));
  }

  private createAuthParams(scope: string): [AuthorizationParameters, OpenIDCallbackChecks] {
    const verifier = generators.codeVerifier();
    const state = generators.state();

    const authParams: AuthorizationParameters = {
      redirect_uri: this._config.redirectUri,
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
        if (reqUrl.startsWith(this._config.redirectUri)) {
          await interceptedRequest.respond({ status: 200, contentType: "text/html", body: "OK" });
          resolve(reqUrl);
          return;
        }

        await interceptedRequest.continue();
      });
    });
  }

  private async handleLoginPage(page: puppeteer.Page): Promise<void> {
    const loginUrl = url.resolve(this._imsUrl, "/IMS/Account/Login");
    if (page.url().startsWith(loginUrl)) {
      await page.type("#EmailAddress", this._user.email);
      await page.type("#Password", this._user.password);
      await Promise.all([
        page.waitForNavigation({
          // Need to wait for 'load' here instead of using 'networkidle2' because during a federated login there is a second redirect. With a fast connection,
          // the redirect happens so quickly it doesn't hit the 500 ms threshold that puppeteer expects for an idle network.
          waitUntil: "load",
        }),
        page.$eval("#submitLogon", (button: any) => button.click()),
      ]);
    }

    // There are two page loads if it's a federated user because of a second redirect.
    // Note: On a fast internet connection this is not needed but on slower ones it will be.  See comment above for previous 'waitForNavigation' for details.
    if (-1 !== page.url().indexOf("wsfed"))
      await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Check if there were any errors when performing sign-in
    await this.checkErrorOnPage(page, "#errormessage");
  }

  // Bentley-specific federated login.  This will get called if a redirect to a url including "wsfed".
  private async handleFederatedSignin(page: puppeteer.Page): Promise<void> {
    if (- 1 === page.url().indexOf("wsfed"))
      return;

    await page.type("#i0116", this._user.email);
    await Promise.all([
      page.waitForNavigation({
        timeout: 60000,
        waitUntil: "networkidle2",
      }),
      page.$eval("#idSIButton9", (button: any) => button.click()),
    ]);

    // For federated login, there are 2 pages in a row.  The one to load to the redirect page (i.e. "Taking you to your organization's sign-in page...")
    // and then actually loading to the page with the forms for sign-in.

    await page.waitForNavigation({ waitUntil: "networkidle2" }); // Waits for the actual sign-in page to load.

    // Checks for the error in username entered
    await this.checkErrorOnPage(page, "#usernameError");

    // After the load from the previous page the email address should already be filled in.
    // await page.type("#userNameInput", userName);
    await page.type("#passwordInput", this._user.password);

    await Promise.all([
      page.waitForNavigation({
        timeout: 60000,
        waitUntil: "networkidle2",
      }),
      page.$eval("#submitButton", (button: any) => button.click()),
    ]);

    await this.checkErrorOnPage(page, "#errorText");

    await Promise.all([
      page.waitForNavigation({
        timeout: 60000,
        waitUntil: "networkidle2",
      }),
      page.$eval("#idSIButton9", (button: any) => button.click()),
    ]);
  }

  private async handleConsentPage(page: puppeteer.Page): Promise<void> {
    const consentUrl = url.resolve(this._issuer.issuer as string, "/consent");
    if (page.url().startsWith(consentUrl))
      await page.click("button[value=yes]");
  }

  private async checkErrorOnPage(page: puppeteer.Page, selector: string): Promise<void> {
    const errMsgText = await page.evaluate((s) => {
      const errMsgElement = document.querySelector(s);
      if (null === errMsgElement)
        return undefined;
      return errMsgElement.textContent;
    }, selector);

    if (undefined !== errMsgText && null !== errMsgText)
      throw new Error(errMsgText);
  }
}

/**
 * Gets an OIDC token for testing.
 * - this is only to be used in test environments, and **never** in production code.
 * - causes authorization to happen by spawning a headless browser, and automatically filling in the supplied user credentials
 * @param config Oidc configuration
 * @param user User
 * @param deploymentRegion Deployment region. If unspecified, it's inferred from configuration, or simply defaults to "0" for PROD use
 * @alpha
 */
export async function getTestOidcToken(config: TestOidcConfiguration, user: TestUserCredentials, deploymentRegion?: number): Promise<AccessToken> {
  const client = new TestOidcClient(config, user);
  client.deploymentRegion = deploymentRegion || Config.App.getNumber("imjs_buddi_resolve_url_using_region") || 0;
  return client.getAccessToken();
}
