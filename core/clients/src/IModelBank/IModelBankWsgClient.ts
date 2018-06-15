/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { WsgClient, DefaultWsgRequestOptionsProvider, WsgRequestOptions, IModelServerHandler } from "../WsgClient";
import * as https from "https";
import { IModelBankError } from "./Errors";
import { RequestOptions, RequestQueryOptions } from "../Request";
import { assert } from "@bentley/bentleyjs-core";
import { AccessToken } from "../Token";
import { WsgInstance, FileHandler } from "..";
import { UrlFileHandler } from "../imodelhub/UrlFileHandler";

/**
 * Provides default options for iModelBank requests.
 */
class DefaultIModelBankRequestOptionsProvider extends DefaultWsgRequestOptionsProvider {
  public constructor(agent: https.Agent) {
    super();
    this.defaultOptions.errorCallback = IModelBankError.parse;
    this.defaultOptions.retryCallback = IModelBankError.shouldRetry;
    this.defaultOptions.agent = agent;
  }
}

/**
 * This class acts as the WsgClient for other iModelBank Handlers.
 */
export class IModelBankWsgClient extends WsgClient implements IModelServerHandler {
  private _url: string;
  private _defaultIModelHubOptionsProvider: DefaultIModelBankRequestOptionsProvider;
  private _agent: https.Agent;
  private _fileHandler = new UrlFileHandler();
  private _accessToken: AccessToken;

  /**
   * Creates an instance of IModelBankWsgClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(url: string, accessToken: AccessToken, keepAliveDuration = 30000) {
    super("PROD", "v2.5", "");    // v2.5 is the version of the REST API syntax.
    this._accessToken = accessToken;
    this._url = url;
    this._agent = new https.Agent({ keepAlive: keepAliveDuration > 0, keepAliveMsecs: keepAliveDuration });
  }

  public getAgend(): https.Agent { return this._agent; }
  public getFileHandler(): FileHandler | undefined { return this._fileHandler; }

  /**
   * Augments request options with defaults returned by the DefaultIModelHubRequestOptionsProvider.
   * Note that the options passed in by clients override any defaults where necessary.
   * @param options Options the caller wants to eaugment with the defaults.
   * @returns Promise resolves after the defaults are setup.
   */
  protected async setupOptionDefaults(options: RequestOptions): Promise<void> {
    if (!this._defaultIModelHubOptionsProvider)
      this._defaultIModelHubOptionsProvider = new DefaultIModelBankRequestOptionsProvider(this._agent);

    return this._defaultIModelHubOptionsProvider.assignOptions(options);
  }

  protected getUrlSearchKey(): string { assert(false, "Bentley cloud-specific method should be factored out"); return ""; }

  protected getDefaultUrl(): string { return this._url; }

  /**
   * Gets the agent used for imodelhub connection pooling.     *** What is this? ***
   */
  public getAgent(): https.Agent {
    return this._agent;
  }

  public async getAccessToken(_authorizationToken: any): Promise<AccessToken> { return this._accessToken; }

  /**
   * Used by clients to send delete requests without body.
   * @param token Delegation token
   * @param relativeUrlPath Relative path to the REST resource.
   * @returns Promise resolves after successfully deleting REST resource at the specified path.
   */
  public delete(token: AccessToken, relativeUrlPath: string): Promise<void> {
    return super.delete(token, relativeUrlPath);
  }

  /**
   * Used by clients to delete strongly typed instances through the standard WSG REST API
   * @param token Delegation token
   * @param relativeUrlPath Relative path to the REST resource.
   * @param instance Instance to be deleted.
   * @returns Promise resolves after successfully deleting instance.
   */
  public deleteInstance<T extends WsgInstance>(token: AccessToken, relativeUrlPath: string, instance?: T): Promise<void> {
    return super.deleteInstance<T>(token, relativeUrlPath, instance);
  }

  /**
   * Used by clients to post strongly typed instances through standard WSG REST API
   * @param typedConstructor Used by clients to post a strongly typed instance through the REST API that's expected to return a standard response.
   * @param token Delegation token
   * @param relativeUrlPath Relative path to the REST resource.
   * @param instance Strongly typed instance to be posted.
   * @param requestOptions WSG options for the request.
   * @returns The posted instance that's returned back from the server.
   */
  public postInstance<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, instance: T, requestOptions?: WsgRequestOptions): Promise<T> {
    return super.postInstance<T>(typedConstructor, token, relativeUrlPath, instance, requestOptions);
  }

  /**
   * Used by clients to post multiple strongly typed instances through standard WSG REST API
   * @param typedConstructor Used by clients to post a strongly typed instances through the REST API that's expected to return a standard response.
   * @param token Delegation token
   * @param relativeUrlPath Relative path to the REST resource.
   * @param instances Strongly typed instances to be posted.
   * @param requestOptions WSG options for the request.
   * @returns The posted instances that's returned back from the server.
   */
  public postInstances<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, instances: T[], requestOptions?: WsgRequestOptions): Promise<T[]> {
    return super.postInstances(typedConstructor, token, relativeUrlPath, instances, requestOptions);
  }

  /**
   * Used by clients to get strongly typed instances from standard WSG REST queries that return EC JSON instances.
   * @param typedConstructor Constructor function for the type
   * @param token Delegation token
   * @param relativeUrlPath Relative path to the REST resource.
   * @param queryOptions Query options.
   * @returns Array of strongly typed instances.
   */
  public getInstances<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, queryOptions?: RequestQueryOptions): Promise<T[]> {
    return super.getInstances(typedConstructor, token, relativeUrlPath, queryOptions);
  }

  /**
   * Used by clients to get strongly typed instances from standard WSG REST queries that return EC JSON instances.
   * @param typedConstructor Constructor function for the type
   * @param token Delegation token
   * @param relativeUrlPath Relative path to the REST resource.
   * @param queryOptions Query options.
   * @returns Array of strongly typed instances.
   */
  public postQuery<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, queryOptions: RequestQueryOptions): Promise<T[]> {
    return super.postQuery(typedConstructor, token, relativeUrlPath, queryOptions);
  }
}
