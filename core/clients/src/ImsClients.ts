/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import * as xpath from "xpath";
import { DOMParser } from "xmldom";

import { request, RequestOptions, Response } from "./Request";
import { Config } from "./Config";
import { Client, DeploymentEnv, UrlDescriptor } from "./Client";
import { AuthorizationToken, AccessToken } from "./Token";

/** Client API for the IMS Federated Authentication Service. */
export class ImsFederatedAuthenticationClient extends Client {
  public static readonly searchKey: string = "IMS.FederatedAuth.Url";
  private static readonly defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://qa-ims.bentley.com",
    QA: "https://qa-ims.bentley.com",
    PROD: "https://ims.bentley.com",
    PERF: "https://qa-ims.bentley.com",
  };

  /**
   * Creates an instance of ImsFederatedAuthenticationClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(public deploymentEnv: DeploymentEnv) {
    super(deploymentEnv);
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ImsFederatedAuthenticationClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return ImsFederatedAuthenticationClient.defaultUrlDescriptor[this.deploymentEnv];
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

  private static readonly defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx",
    QA: "https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx",
    PROD: "https://ims.bentley.com/rest/ActiveSTSService/json/IssueEx",
    PERF: "https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx",
  };

  /**
   * Creates an instance of ImsActiveSecureTokenClient.
   * @param deploymentEnv Deployment environment
   */
  public constructor(public deploymentEnv: DeploymentEnv) {
    super(deploymentEnv);
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ImsActiveSecureTokenClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return ImsActiveSecureTokenClient.defaultUrlDescriptor[this.deploymentEnv];
  }

  /**
   * Gets the authorization token given the credentials.
   * @param userName User name
   * @param password  Password
   * @returns Resolves to the token and user profile.
   */
  public async getToken(user: string, password: string): Promise<AuthorizationToken> {
    const url: string = await this.getUrl();

    const options: RequestOptions = {
      method: "POST",
      auth: {
        user,
        password,
      },
      body: {
        AppliesTo: Config.host.relyingPartyUri,
        DeviceId: Config.host.deviceId,
        AppId: Config.host.name + "/" + Config.host.version,
        Lifetime: 7 * 24 * 60, // 7 days
      },
    };
    await this.setupOptionDefaults(options);

    return request(url, options)
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

  private static readonly defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://qa-ims.bentley.com/rest/DelegationSTSService",
    QA: "https://qa-ims.bentley.com/rest/DelegationSTSService",
    PROD: "https://ims.bentley.com/rest/DelegationSTSService",
    PERF: "https://qa-ims.bentley.com/rest/DelegationSTSService",
  };

  /**
   * Creates an instance of ImsDelegationSecureTokenClient.
   * @param {DeploymentEnv} deploymentEnv Deployment environment.
   */
  public constructor(public deploymentEnv: DeploymentEnv) {
    super(deploymentEnv);
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
  protected getDefaultUrl(): string {
    return ImsDelegationSecureTokenClient.defaultUrlDescriptor[this.deploymentEnv];
  }

  /**
   * Gets the (delegation) access token given the authorization token.
   * @param authTokenInfo Access token.
   * @param relyingPartyUri Relying party URI required by the service - defaults to a value defined by the configuration.
   * @returns Resolves to the (delegation) access token.
   */
  public async getToken(authorizationToken: AuthorizationToken, relyingPartyUri: string = Config.host.relyingPartyUri): Promise<AccessToken> {
    const url: string = await this.getUrl() + "/json/IssueEx";

    const options: RequestOptions = {
      method: "POST",
      headers: {
        authorization: authorizationToken.toTokenString(),
      },
      body: {
        ActAs: authorizationToken.getSamlAssertion(),
        AppliesTo: relyingPartyUri,
        AppliesToBootstrapToken: relyingPartyUri,
        DeviceId: Config.host.deviceId,
        AppId: Config.host.name + "/" + Config.host.version,
        Lifetime: 60, // 60 minutes
      },
    };
    await this.setupOptionDefaults(options);

    return request(url, options)
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
