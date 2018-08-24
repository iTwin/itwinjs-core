/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { UrlDescriptor, DeploymentEnv } from "../Client";
import { DefaultWsgRequestOptionsProvider, WsgClient, WsgRequestOptions } from "../WsgClient";
import { RequestOptions, RequestQueryOptions } from "../Request";
import { WsgInstance } from "../ECJsonTypeMap";
import { IModelHubError } from "./Errors";
import { AuthorizationToken, AccessToken } from "../Token";
import { ImsDelegationSecureTokenClient } from "../ImsClients";
import * as https from "https";
import { Config, FileHandler } from "..";
import { CustomRequestOptions } from "./CustomRequestOptions";

/**
 * Provides default options for iModelHub requests.
 */
class DefaultIModelHubRequestOptionsProvider extends DefaultWsgRequestOptionsProvider {
  public constructor(agent: https.Agent) {
    super();
    this._defaultOptions.errorCallback = IModelHubError.parse;
    this._defaultOptions.retryCallback = IModelHubError.shouldRetry;
    this._defaultOptions.agent = agent;
  }
}

/**
 * This class acts as the WsgClient for other iModelHub Handlers.
 * @hidden
 */
export class IModelBaseHandler extends WsgClient {
  protected _url?: string;
  private _defaultIModelHubOptionsProvider: DefaultIModelHubRequestOptionsProvider;
  public static readonly searchKey: string = "iModelHubApi";
  protected _agent: https.Agent;
  protected _fileHandler: FileHandler | undefined;
  private _customRequestOptions: CustomRequestOptions = new CustomRequestOptions();

  private static readonly _defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://dev-imodelhubapi.bentley.com",
    QA: "https://qa-imodelhubapi.bentley.com",
    PROD: "https://imodelhubapi.bentley.com",
    PERF: "https://perf-imodelhubapi.bentley.com",
  };

  /**
   * Create an instance of IModelBaseHandler.
   * @hidden
   * @param deploymentEnv Deployment environment.
   */
  public constructor(public deploymentEnv: DeploymentEnv, keepAliveDuration = 30000, fileHandler?: FileHandler) {
    super(deploymentEnv, "sv1.1", "https://connect-wsg20.bentley.com");
    this._fileHandler = fileHandler;
    if (!Config.isBrowser)
      this._agent = new https.Agent({ keepAlive: keepAliveDuration > 0, keepAliveMsecs: keepAliveDuration });
  }

  public formatProjectIdForUrl(projectId: string) { return projectId; }

  public getFileHandler(): FileHandler | undefined { return this._fileHandler; }

  /**
   * Augment request options with defaults returned by the DefaultIModelHubRequestOptionsProvider. Note that the options passed in by clients override any defaults where necessary.
   * @param options Options the caller wants to augment with the defaults.
   * @returns Promise resolves after the defaults are setup.
   */
  protected async setupOptionDefaults(options: RequestOptions): Promise<void> {
    if (!this._defaultIModelHubOptionsProvider)
      this._defaultIModelHubOptionsProvider = new DefaultIModelHubRequestOptionsProvider(this._agent);

    return this._defaultIModelHubOptionsProvider.assignOptions(options);
  }

  /**
   * Get name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return IModelBaseHandler.searchKey;
  }

  /**
   * Get the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return IModelBaseHandler._defaultUrlDescriptor[this.deploymentEnv];
  }

  /**
   * Get the agent used for imodelhub connection pooling.
   * @returns The agent used for imodelhub connection pooling.
   */
  public getAgent(): https.Agent {
    return this._agent;
  }

  /**
   * Get the URL of the service. This method attempts to discover and cache the URL from the URL Discovery Service. If not found uses the default URL provided by client implementations. Note that for consistency sake, the URL is stripped of any trailing "/"
   * @returns URL for the service
   */
  public getUrl(): Promise<string> {
    return super.getUrl();
  }

  /**
   * Get the (delegation) access token to access the service
   * @param authorizationToken Authorization token.
   * @returns Resolves to the (delegation) access token.
   */
  public async getAccessToken(authorizationToken: AuthorizationToken): Promise<AccessToken> {
    const imsClient = new ImsDelegationSecureTokenClient(this.deploymentEnv);
    return imsClient.getToken(authorizationToken, this.relyingPartyUri);
  }

  /**
   * Send a delete request. Sends a request without body.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @returns Promise resolves after successfully deleting REST resource at the specified path.
   */
  public delete(token: AccessToken, relativeUrlPath: string): Promise<void> {
    return super.delete(token, relativeUrlPath);
  }

  /**
   * Delete a strongly typed instance. Sends a request body with a WSG instance.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param instance Instance to be deleted.
   * @param requestOptions WSG options for the request.
   * @returns Promise resolves after successfully deleting instance.
   */
  public deleteInstance<T extends WsgInstance>(token: AccessToken, relativeUrlPath: string, instance?: T, requestOptions?: WsgRequestOptions): Promise<void> {
    if (this._customRequestOptions.isSet) {
      if (!requestOptions) {
        requestOptions = {};
      }
      requestOptions.CustomOptions = this._customRequestOptions.insertCustomOptions(requestOptions.CustomOptions);
    }
    return super.deleteInstance<T>(token, relativeUrlPath, instance, requestOptions);
  }

  /**
   * Post a strongly typed instance. Sends a request body with a WSG instance.
   * @param typedConstructor Used to construct the resulting instances from the response.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param instance Strongly typed instance to be posted.
   * @param requestOptions WSG options for the request.
   * @returns The posted instance that's returned back from the server.
   */
  public postInstance<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, instance: T, requestOptions?: WsgRequestOptions): Promise<T> {
    if (this._customRequestOptions.isSet) {
      if (!requestOptions) {
        requestOptions = {};
      }
      requestOptions.CustomOptions = this._customRequestOptions.insertCustomOptions(requestOptions.CustomOptions);
    }
    return super.postInstance<T>(typedConstructor, token, relativeUrlPath, instance, requestOptions);
  }

  /**
   * Post multiple strongly typed instances. Sends a request body with WSG instances.
   * @param typedConstructor Used to construct the resulting instances from the response.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param instances Strongly typed instances to be posted.
   * @param requestOptions WSG options for the request.
   * @returns The posted instances that's returned back from the server.
   */
  public postInstances<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, instances: T[], requestOptions?: WsgRequestOptions): Promise<T[]> {
    return super.postInstances(typedConstructor, token, relativeUrlPath, instances, requestOptions);
  }

  /**
   * Get multiple strongly typed instances.
   * @param typedConstructor Used to construct the resulting instances from the response.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param queryOptions Query options.
   * @returns Array of strongly typed instances.
   */
  public getInstances<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, queryOptions?: RequestQueryOptions): Promise<T[]> {
    return super.getInstances(typedConstructor, token, relativeUrlPath, queryOptions);
  }

  /**
   * Get multiple strongly typed instances. Sends query in the request's body. This can be used for queries that are too long to fit in URL.
   * @param typedConstructor Used to construct the resulting instances from the response.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param queryOptions Query options.
   * @returns Array of strongly typed instances.
   */
  public postQuery<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, queryOptions: RequestQueryOptions): Promise<T[]> {
    return super.postQuery(typedConstructor, token, relativeUrlPath, queryOptions);
  }

  /**
   * Get an instance of [[CustomRequestOptions]]. It can be used to set custom request parameters for all future requests made by this handler.
   */
  public getCustomRequestOptions(): CustomRequestOptions {
    return this._customRequestOptions;
  }
}
