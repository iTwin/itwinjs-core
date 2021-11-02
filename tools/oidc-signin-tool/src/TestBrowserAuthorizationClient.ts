/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, assert, BeEvent } from "@itwin/core-bentley";
import { ImsAuthorizationClient } from "@bentley/itwin-client";
import { AuthorizationClient } from "@itwin/core-common";
import { AuthorizationParameters, Client, custom, generators, Issuer, OpenIDCallbackChecks } from "openid-client";
import * as os from "os";
import * as puppeteer from "puppeteer";
import { TestBrowserAuthorizationClientConfiguration, TestUserCredentials } from "./TestUsers";

/**
 * Implementation of AuthorizationClient used for the iModel.js integration tests.
 * - this is only to be used in test environments, and **never** in production code.
 * - use static create method to create an authorization client for the specified user credentials.
 * - calling getAccessToken() the first time, or after token expiry, causes the authorization to happen by
 *   spawning a headless browser, and automatically filling in the supplied user credentials.
 * @alpha
 */
export class TestBrowserAuthorizationClient implements AuthorizationClient {
  private _client!: Client;
  private _issuer!: Issuer<Client>;
  private _imsUrl!: string;
  private readonly _config: TestBrowserAuthorizationClientConfiguration;
  private readonly _user: TestUserCredentials;
  private _accessToken: AccessToken = "";
  private _expiresAt?: Date | undefined = undefined;

  /**
   * Constructor
   * @param config OIDC configuration
   * @param user Test user to be logged in
   */
  public constructor(config: TestBrowserAuthorizationClientConfiguration, user: TestUserCredentials) {
    this._config = config;
    this._user = user;
  }

  private async initialize() {
    const imsClient = new ImsAuthorizationClient();
    this._imsUrl = await imsClient.getUrl();

    // Due to issues with a timeout or failed request to the authorization service increasing the standard timeout and adding retries.
    // Docs for this option here, https://github.com/panva/node-openid-client/tree/master/docs#customizing-http-requests
    custom.setHttpOptionsDefaults({
      timeout: 10000,
      retry: 3,
    });

    const imsUrl = new URL("/.well-known/openid-configuration", this._imsUrl);
    this._issuer = await Issuer.discover(imsUrl.toString());
    this._client = new this._issuer.Client({ client_id: this._config.clientId, token_endpoint_auth_method: "none" }); // eslint-disable-line @typescript-eslint/naming-convention
  }

  public readonly onAccessTokenChanged = new BeEvent<(token: AccessToken) => void>();

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
    assert(!!this._expiresAt);
    // show expiry one minute before actual time to refresh
    return ((this._expiresAt.getTime() - Date.now()) <= 1 * 60 * 1000);
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
  public async getAccessToken(): Promise<AccessToken> {
    if (this.isAuthorized)
      return this._accessToken;

    // Add retry logic to help avoid flaky issues on CI machines.
    let numRetries = 0;
    while (numRetries < 3) {
      try {
        await this.signIn();
      } catch (err) {
        // rethrow error if hit max number of retries or if it's not a navigation failure (i.e. a flaky failure)
        if (numRetries === 2 ||
          (err instanceof Error && -1 === err.message.indexOf("Execution context was destroyed, most likely because of a navigation")))
          throw err;
        numRetries++;
        continue;
      }

      break;
    }

    return this._accessToken;
  }

  public async signIn(): Promise<void> {
    if (this._client === undefined)
      await this.initialize();

    // eslint-disable-next-line no-console
    // console.log(`Starting OIDC signin for ${this._user.email} ...`);

    const [authParams, callbackChecks] = this.createAuthParams(this._config.scope);
    const authorizationUrl = this._client.authorizationUrl(authParams);

    // Launch puppeteer with no sandbox only on linux
    let launchOptions: puppeteer.LaunchOptions = { dumpio: true }; // , headless: false, slowMo: 500 };
    if (os.platform() === "linux") {
      launchOptions = {
        args: ["--no-sandbox"], // , "--disable-setuid-sandbox"],
      };
    }

    const proxyUrl = process.env.HTTPS_PROXY;
    let proxyAuthOptions: puppeteer.AuthOptions | undefined;
    if (proxyUrl) {
      const proxyUrlObj = new URL(proxyUrl);
      proxyAuthOptions = { username: proxyUrlObj.username, password: proxyUrlObj.password };
      const proxyArg = `--proxy-server=${proxyUrlObj.protocol}//${proxyUrlObj.host}`;
      if (launchOptions.args)
        launchOptions.args.push(proxyArg);
      else
        launchOptions.args = [proxyArg];
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    if (proxyAuthOptions) {
      await page.authenticate(proxyAuthOptions);
    }

    await page.setRequestInterception(true);
    const onRedirectRequest = this.interceptRedirectUri(page);
    await page.goto(authorizationUrl, { waitUntil: "networkidle2" });

    try {
      await this.handleErrorPage(page);

      await this.handleLoginPage(page);

      await this.handlePingLoginPage(page);

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

    this._accessToken = `Bearer ${tokenSet.access_token}`;
    if (tokenSet.expires_at)
      this._expiresAt = new Date(tokenSet.expires_at * 1000);
    this.onAccessTokenChanged.raiseEvent(this._accessToken);
  }

  public async signOut(): Promise<void> {
    this._accessToken = "";
    this.onAccessTokenChanged.raiseEvent(this._accessToken);
  }

  private createAuthParams(scope: string): [AuthorizationParameters, OpenIDCallbackChecks] {
    const verifier = generators.codeVerifier();
    const state = generators.state();

    const authParams: AuthorizationParameters = {
      redirect_uri: this._config.redirectUri, // eslint-disable-line @typescript-eslint/naming-convention
      response_type: "code", // eslint-disable-line @typescript-eslint/naming-convention
      code_challenge: generators.codeChallenge(verifier), // eslint-disable-line @typescript-eslint/naming-convention
      code_challenge_method: "S256", // eslint-disable-line @typescript-eslint/naming-convention
      scope,
      state,
    };

    const callbackChecks: OpenIDCallbackChecks = {
      state,
      response_type: "code", // eslint-disable-line @typescript-eslint/naming-convention
      code_verifier: verifier, // eslint-disable-line @typescript-eslint/naming-convention
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

  private async handleErrorPage(page: puppeteer.Page): Promise<void> {
    const errMsgText = await page.evaluate(() => {
      const title = document.title;
      if (title.toLocaleLowerCase() === "error")
        return document.body.textContent;
      return undefined;
    });

    if (null === errMsgText)
      throw new Error("Unknown error page detected.");

    if (undefined !== errMsgText)
      throw new Error(errMsgText);
  }

  private async handleLoginPage(page: puppeteer.Page): Promise<void> {
    const loginUrl = new URL("/IMS/Account/Login", this._imsUrl);
    if (page.url().startsWith(loginUrl.toString())) {
      await page.waitForSelector("[name=EmailAddress]");
      await page.type("[name=EmailAddress]", this._user.email);
      await page.waitForSelector("[name=Password]");
      await page.type("[name=Password]", this._user.password);
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
    if (-1 !== page.url().indexOf("microsoftonline")) {
      try {
        await this.checkSelectorExists(page, "#i0116");
      } catch (err) {
        // continue with navigation when it throws.  This means the page hasn't fully loaded yet
        await page.waitForNavigation({ waitUntil: "networkidle2" });
      }
    }

    // Check if there were any errors when performing sign-in
    await this.checkErrorOnPage(page, "#errormessage");
  }

  private async handlePingLoginPage(page: puppeteer.Page): Promise<void> {
    if (undefined === this._issuer.metadata.authorization_endpoint || !page.url().startsWith(this._issuer.metadata.authorization_endpoint))
      return;

    await page.waitForSelector("#identifierInput");
    await page.type("#identifierInput", this._user.email);

    await page.waitForSelector(".allow");

    await Promise.all([
      page.waitForNavigation({
        // Need to wait for 'load' here instead of using 'networkidle2' because during a federated login there is a second redirect. With a fast connection,
        // the redirect happens so quickly it doesn't hit the 500 ms threshold that puppeteer expects for an idle network.
        waitUntil: "load",
      }),
      page.$eval(".allow", (button: any) => button.click()),
    ]);

    // Cut out for federated sign-in
    if (-1 !== page.url().indexOf("microsoftonline"))
      return;

    await page.waitForSelector("#password");
    await page.type("#password", this._user.password);

    await Promise.all([
      page.waitForNavigation({
        // Need to wait for 'load' here instead of using 'networkidle2' because during a federated login there is a second redirect. With a fast connection,
        // the redirect happens so quickly it doesn't hit the 500 ms threshold that puppeteer expects for an idle network.
        waitUntil: "load",
      }),
      page.$eval(".allow", (button: any) => button.click()),
    ]);

    // Check if there were any errors when performing sign-in
    await this.checkErrorOnPageByClassName(page, "ping-error");
  }

  // Bentley-specific federated login.  This will get called if a redirect to a url including "wsfed".
  private async handleFederatedSignin(page: puppeteer.Page): Promise<void> {
    if (-1 === page.url().indexOf("wsfed"))
      return;

    if (await this.checkSelectorExists(page, "#i0116")) {
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
    } else {
      await page.waitForSelector("[name=UserName]");
      await page.type("[name=UserName]", this._user.email);
    }

    await page.waitForSelector("#passwordInput");
    await page.type("#passwordInput", this._user.password);

    await Promise.all([
      page.waitForNavigation({
        timeout: 60000,
        waitUntil: "networkidle2",
      }),
      page.$eval("#submitButton", (button: any) => button.click()),
    ]);

    // Need to check for invalid username/password directly after the submit button is pressed
    let errorExists = false;
    try {
      errorExists = await this.checkSelectorExists(page, "#errorText");
    } catch (err) {
      // continue with navigation even if throws
    }

    if (errorExists)
      await this.checkErrorOnPage(page, "#errorText");

    // May need to accept an additional prompt.
    if (-1 !== page.url().indexOf("microsoftonline") && await this.checkSelectorExists(page, "#idSIButton9")) {
      await Promise.all([
        page.waitForNavigation({
          timeout: 60000,
          waitUntil: "networkidle2",
        }),
        page.$eval("#idSIButton9", (button: any) => button.click()),
      ]);
    }

    await page.waitForNavigation({ waitUntil: "networkidle2" });
  }

  private async handleConsentPage(page: puppeteer.Page): Promise<void> {
    const consentUrl = new URL("/consent", this._issuer.issuer as string);
    if (page.url().startsWith(consentUrl.toString()))
      await page.click("button[value=yes]");

    // New consent page acceptance
    if (await page.title() === "Request for Approval") {
      await page.waitForSelector(".allow");

      await Promise.all([
        page.waitForNavigation({
          timeout: 60000,
          waitUntil: "networkidle2",
        }),
        page.$eval(".allow", (button: any) => button.click()),
      ]);
    } else if (await page.title() === "Permissions") { // Another new consent page...
      await page.waitForSelector("div.iui-input-bar button");

      await Promise.all([
        page.waitForNavigation({
          timeout: 60000,
          waitUntil: "networkidle2",
        }),
        page.$eval("div.iui-input-bar button span", (button: any) => button.click()),
      ]);
    }
  }

  private async checkSelectorExists(page: puppeteer.Page, selector: string): Promise<boolean> {
    return page.evaluate((s) => {
      return null !== document.querySelector(s);
    }, selector);
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

  private async checkErrorOnPageByClassName(page: puppeteer.Page, className: string): Promise<void> {
    const errMsgText = await page.evaluate((s) => {
      const elements = document.getElementsByClassName(s);
      if (0 === elements.length || undefined === elements[0].innerHTML)
        return undefined;
      return elements[0].innerHTML;
    }, className);

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
export async function getTestAccessToken(config: TestBrowserAuthorizationClientConfiguration, user: TestUserCredentials): Promise<AccessToken | undefined> {
  const client = new TestBrowserAuthorizationClient(config, user);
  return client.getAccessToken();
}
