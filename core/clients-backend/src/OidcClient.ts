import { Client, AccessToken, UserProfile, IncludePrefix, Config } from "@bentley/imodeljs-clients";
import { Issuer, Client as OpenIdClient, ClientConfiguration, GrantParams, TokenSet, UserInfo } from "openid-client";
import { ActivityLoggingContext, BentleyStatus, BentleyError } from "@bentley/bentleyjs-core";
import { AuthorizationToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";

export class OidcClient extends Client {
  public static readonly searchKey: string = "IMSOpenID";
  public static readonly configURL = "imjs_oidc_url";
  public static readonly configRegion = "imjs_oidc_region";
  // private static readonly _defaultUrlDescriptor: UrlDescriptor = {
  //   DEV: "https://qa-imsoidc.bentley.com",
  //   QA: "https://qa-imsoidc.bentley.com",
  //   PROD: "https://qa-imsoidc.bentley.com",
  //   PERF: "https://qa-imsoidc.bentley.com",
  // };

  /**
   * Creates an instance of ImsFederatedAuthenticationClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(private _clientConfiguration: ClientConfiguration) {
    super();
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return OidcClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    if (Config.App.has(OidcClient.configURL))
      return Config.App.get(OidcClient.configURL);

    throw new Error(`Service URL not set. Set it in Config.App using key ${OidcClient.configURL}`);
  }

  /**
   * Override default region for this service
   * @returns region id or undefined
   */
  protected getRegion(): number | undefined {
    if (Config.App.has(OidcClient.configRegion))
      return Config.App.get(OidcClient.configRegion);

    return undefined;
  }
  private _issuer: Issuer;
  private async getIssuer(actx: ActivityLoggingContext): Promise<Issuer> {
    actx.enter();

    if (this._issuer)
      return this._issuer;

    const url = await this.getUrl(actx);
    this._issuer = await Issuer.discover(url);
    return this._issuer;
  }

  /**
   * Discover the endpoints of the service
   */
  public async discoverEndpoints(actx: ActivityLoggingContext): Promise<Issuer> {
    actx.enter();
    return this.getIssuer(actx);
  }

  private _client: OpenIdClient;
  private async getClient(actx: ActivityLoggingContext): Promise<OpenIdClient> {
    actx.enter();

    if (this._client)
      return this._client;

    const issuer = await this.getIssuer(actx);
    this._client = new issuer.Client(this._clientConfiguration);
    return this._client;
  }

  private createUserProfile(userInfo: UserInfo): UserProfile {
    return new UserProfile(userInfo.given_name, userInfo.family_name, userInfo.email!, userInfo.sub, userInfo.org_name!, userInfo.org!, userInfo.ultimate_site!, userInfo.usage_country_iso!);
  }

  private createJwt(tokenSet: TokenSet, userInfo: UserInfo): AccessToken {
    const startsAt: Date = new Date(tokenSet.expires_at - tokenSet.expires_in);
    const expiresAt: Date = new Date(tokenSet.expires_at);
    const userProfile = this.createUserProfile(userInfo);
    return AccessToken.fromJsonWebTokenString(tokenSet.access_token, userProfile, startsAt, expiresAt);
  }

  private async exchangeJwt(actx: ActivityLoggingContext, grantParams: GrantParams): Promise<AccessToken> {
    actx.enter();

    const scope = grantParams.scope;
    if (!scope.includes("openid") || !scope.includes("email") || !scope.includes("profile") || !scope.includes("organization"))
      throw new BentleyError(BentleyStatus.ERROR, "Scopes when fetching a JWT token must include 'openid email profile organization'");

    const client = await this.getClient(actx);
    const tokenSet: TokenSet = await client.grant(grantParams);
    const userInfo: UserInfo = await client.userinfo(tokenSet.access_token);
    return this.createJwt(tokenSet, userInfo);
  }

  public async getJwtForImsUser(actx: ActivityLoggingContext, email: string, password: string, scope: string): Promise<AccessToken> {
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(actx, email, password);
    const samlToken: AccessToken = await (new ImsDelegationSecureTokenClient()).getToken(actx, authToken);

    const jwt: AccessToken = await this.getJwtFromSaml(actx, samlToken, scope);
    return jwt;
  }

  public async getJwtFromSaml(actx: ActivityLoggingContext, accessToken: AccessToken, scope: string): Promise<AccessToken> {
    actx.enter();

    const grantType = "urn:ietf:params:oauth:grant-type:saml-token";
    const params: GrantParams = {
      grant_type: grantType,
      scope,
      assertion: accessToken.toTokenString(IncludePrefix.No),
    };
    return this.exchangeJwt(actx, params);
  }

  public async refreshJwt(actx: ActivityLoggingContext, jwt: AccessToken): Promise<AccessToken> {
    actx.enter();

    // Refresh 1 minute before expiry
    const expiresAt = jwt.getExpiresAt();
    if (!expiresAt)
      throw new BentleyError(BentleyStatus.ERROR, "Invalid JWT passed to refresh");
    if ((expiresAt.getTime() - Date.now()) > 1 * 60 * 1000)
      return jwt;

    const client = await this.getClient(actx);
    const tokenSet: TokenSet = await client.refresh(jwt.toTokenString(IncludePrefix.No)!);
    const userInfo: UserInfo = await client.userinfo(tokenSet.access_token);
    return this.createJwt(tokenSet, userInfo);
  }

  public async getDelegationJwt(actx: ActivityLoggingContext, jwt: AccessToken, scope: string): Promise<AccessToken> {
    actx.enter();

    const grantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
    const params: GrantParams = {
      grant_type: grantType,
      scope,
      assertion: jwt.toTokenString(IncludePrefix.No),
    };
    return this.exchangeJwt(actx, params);
  }

  public async getSamlFromJwt(actx: ActivityLoggingContext, jwt: AccessToken, scope: string): Promise<AccessToken> {
    actx.enter();

    const grantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
    const params: GrantParams = {
      grant_type: grantType,
      scope,
      assertion: jwt.toTokenString(IncludePrefix.No),
    };

    const client = await this.getClient(actx);
    const tokenSet: TokenSet = await client.grant(params);

    const samlToken = AccessToken.fromSamlTokenString(tokenSet.access_token, IncludePrefix.No);
    if (!samlToken)
      throw new BentleyError(BentleyStatus.ERROR, `Could not convert jwt to accessToken`);
    return samlToken;
  }

}
