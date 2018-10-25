/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/*
 * @module Authentication */

import * as xpath from "xpath";
import { DOMParser } from "xmldom";

import { request, RequestOptions, Response } from "./Request";
import { Config } from "./Config";
import { Client } from "./Client";
import { AuthorizationToken, AccessToken } from "./Token";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

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
    options.useCorsProxy = true;
  }

  /**
   * Gets the authorization token given the credentials.
   * @param userName User name
   * @param password  Password
   * @returns Resolves to the token and user profile.
   */
  public async getToken(alctx: ActivityLoggingContext, user: string, password: string, appId?: string): Promise<AuthorizationToken> {
    const url: string = await this.getUrl(alctx);
    const imjsAppId = appId ? `imodeljs ${appId}` : "imodeljs";

    const options: RequestOptions = {
      method: "POST",
      auth: {
        user,
        password,
      },
      body: {
        AppliesTo: Config.App.get("imjs_default_relying_party_uri"),
        DeviceId: (typeof window === "undefined") ? "backend" : "frontend",
        AppId: imjsAppId,
        Lifetime: 7 * 24 * 60, // 7 days
      },
    };
    await this.setupOptionDefaults(options);

    return request(alctx, url, options)
      .then((res: Response): Promise<AuthorizationToken> => {
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
    options.useCorsProxy = true;
  }

  /**
   * Gets the (delegation) access token given the authorization token.
   * @param authTokenInfo Access token.
   * @param relyingPartyUri Relying party URI required by the service - defaults to a value defined by the configuration.
   * @param appId Application id that's used for logging and tracing the authorization request
   * @returns Resolves to the (delegation) access token.
   */
  public async getToken(alctx: ActivityLoggingContext, authorizationToken: AuthorizationToken, relyingPartyUri?: string, appId?: string): Promise<AccessToken> {
    const url: string = await this.getUrl(alctx) + "/json/IssueEx";
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

    return request(alctx, url, options)
      .then((res: Response): Promise<AccessToken> => {
        if (!res.body.RequestedSecurityToken)
          return Promise.reject(new Error("Authorization token not in expected format " + JSON.stringify(res)));

        const accessToken: AccessToken | undefined = AccessToken.fromSamlAssertion(res.body.RequestedSecurityToken);
        if (!accessToken)
          return Promise.reject(new Error("Could not parse the accessToken token"));

        return Promise.resolve(accessToken!);
      });
  }
}
