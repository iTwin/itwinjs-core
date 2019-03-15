/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import * as xpath from "xpath";
import { DOMParser } from "xmldom";
import { ClientRequestContext, assert, BentleyError, AuthStatus, Logger } from "@bentley/bentleyjs-core";
import { request, RequestOptions, Response } from "./Request";
import { Config } from "./Config";
import { Client } from "./Client";
import { AuthorizationToken, AccessToken } from "./Token";
import { IAuthorizationClient } from "./AuthorizationClient";

const loggingCategory = "imodeljs-clients.ImsClients";

/** Interface for user credentials for programmatic login to IMS
 * Note: This can only be used in test environments. In a real application, the password cannot be explicitly used in any API.
 */
export interface ImsUserCredentials {
  email: string;
  password: string;
}

/** Client API for the IMS Federated Authentication Service. */
export class ImsFederatedAuthenticationClient extends Client {
  public static readonly searchKey: string = "IMS.FederatedAuth.Url";
  /**
   * Creates an instance of ImsFederatedAuthenticationClient.
   */
  public constructor() {
    super();
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ImsFederatedAuthenticationClient.searchKey;
  }

  /**
   * Parses the response from the token request to obtain the token and the user profile.
   * @param authTokenResponse Response for the token request.
   */
  public static parseTokenResponse(authTokenResponse: string): AuthorizationToken | undefined {
    const select: xpath.XPathSelect = xpath.useNamespaces({
      trust: "http://docs.oasis-open.org/ws-sx/ws-trust/200512",
    });
    const dom: Document = (new DOMParser()).parseFromString(authTokenResponse);
    const samlAssertion: string = select("//saml:Assertion", dom).toString();
    if (!samlAssertion)
      return undefined;

    return AuthorizationToken.fromSamlAssertion(samlAssertion);
  }
}

/** Client API for the IMS Active Secure Token Service. */
export class ImsActiveSecureTokenClient extends Client {
  public static readonly searchKey: string = "Mobile.ImsStsAuth";
  /**
   * Creates an instance of ImsActiveSecureTokenClient.
   */
  public constructor() {
    super();
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ImsActiveSecureTokenClient.searchKey;
  }

  protected async setupOptionDefaults(options: RequestOptions): Promise<void> {
    await super.setupOptionDefaults(options);
    options.useCorsProxy = false;
  }

  /**
   * Gets the authorization token given the credentials.
   * Note that this can only be used in test environments - in an application passwords are never passed around, and the
   * application would/should not be aware of it.
   * @param userCredentials User credentials
   * @returns Resolves to the token and user profile.
   */
  public async getToken(requestContext: ClientRequestContext, userCredentials: ImsUserCredentials, appId?: string): Promise<AuthorizationToken> {
    const url: string = await this.getUrl(requestContext);
    const imjsAppId = appId ? `imodeljs ${appId}` : "imodeljs";

    const options: RequestOptions = {
      method: "POST",
      auth: {
        user: userCredentials.email,
        password: userCredentials.password,
      },
      body: {
        AppliesTo: Config.App.get("imjs_default_relying_party_uri"),
        DeviceId: (typeof window === "undefined") ? "backend" : "frontend",
        AppId: imjsAppId,
        Lifetime: 7 * 24 * 60, // 7 days
      },
    };
    await this.setupOptionDefaults(options);

    return request(requestContext, url, options)
      .then(async (res: Response): Promise<AuthorizationToken> => {
        if (!res.body.RequestedSecurityToken)
          return Promise.reject(new Error("Authorization token not in expected format " + JSON.stringify(res)));

        const token: AuthorizationToken | undefined = AuthorizationToken.fromSamlAssertion(res.body.RequestedSecurityToken);
        if (!token)
          return Promise.reject(new Error("Could not parse the authorization token"));

        return Promise.resolve(token!);
      });
  }
}

/** Client API for the IMS Delegation Secure Token Service. */
export class ImsDelegationSecureTokenClient extends Client {
  public static readonly searchKey: string = "ActiveSTSDelegationServiceUrl";
  /**
   * Creates an instance of ImsDelegationSecureTokenClient.
   */
  public constructor() {
    super();
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ImsDelegationSecureTokenClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */

  protected async setupOptionDefaults(options: RequestOptions): Promise<void> {
    await super.setupOptionDefaults(options);
    options.useCorsProxy = false;
  }

  /**
   * Gets the (delegation) access token given the authorization token.
   * @param requestContext The client request context
   * @param authTokenInfo Access token.
   * @param relyingPartyUri Relying party URI required by the service - defaults to a value defined by the configuration.
   * @param appId Application id that's used for logging and tracing the authorization request
   * @returns Resolves to the (delegation) access token.
   */
  public async getToken(requestContext: ClientRequestContext, authorizationToken: AuthorizationToken, relyingPartyUri?: string, appId?: string): Promise<AccessToken> {
    const url: string = await this.getUrl(requestContext) + "/json/IssueEx";
    if (!relyingPartyUri) {
      relyingPartyUri = Config.App.get("imjs_default_relying_party_uri");
    }

    const imjsAppId = appId ? `imodeljs ${appId}` : "imodeljs";

    const options: RequestOptions = {
      method: "POST",
      headers: {
        "authorization": authorizationToken.toTokenString(),
        "User-Agent": imjsAppId,
      },
      body: {
        ActAs: authorizationToken.getSamlAssertion(),
        AppliesTo: relyingPartyUri,
        AppliesToBootstrapToken: relyingPartyUri,
        DeviceId: (typeof window === "undefined") ? "backend" : "frontend",
        AppId: imjsAppId,
        Lifetime: 60, // 60 minutes
      },
    };
    await this.setupOptionDefaults(options);

    return request(requestContext, url, options)
      .then(async (res: Response): Promise<AccessToken> => {
        if (!res.body.RequestedSecurityToken)
          return Promise.reject(new Error("Authorization token not in expected format " + JSON.stringify(res)));

        const accessToken: AccessToken | undefined = AccessToken.fromSamlAssertion(res.body.RequestedSecurityToken);
        if (!accessToken)
          return Promise.reject(new Error("Could not parse the accessToken token"));

        return Promise.resolve(accessToken!);
      });
  }
}

/** Implementation of IAuthorizationClient using IMS - this is only used in test environments */
export class ImsTestAuthorizationClient implements IAuthorizationClient {
  private _accessToken?: AccessToken;
  private _userCredentials?: ImsUserCredentials;
  private _relyingPartyUri?: string;

  public async signIn(requestContext: ClientRequestContext, userCredentials: ImsUserCredentials, relyingPartyUri?: string): Promise<AccessToken> {
    this._userCredentials = userCredentials;
    this._relyingPartyUri = relyingPartyUri;
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(requestContext, userCredentials);
    this._accessToken = await (new ImsDelegationSecureTokenClient()).getToken(requestContext, authToken, relyingPartyUri);
    return this._accessToken;
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
  public async getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (this.isAuthorized)
      return this._accessToken!;
    if (!this._userCredentials)
      throw new BentleyError(AuthStatus.Error, "No use has signed in - call ImsTokenManager.signIn() before fetching access token", Logger.logError, loggingCategory);
    return this.signIn(requestContext || new ClientRequestContext(), this._userCredentials, this._relyingPartyUri);
  }
}
