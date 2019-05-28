/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { DefaultWsgRequestOptionsProvider, WsgClient, WsgRequestOptions } from "../WsgClient";
import { RequestOptions, RequestQueryOptions } from "../Request";
import { WsgInstance } from "../ECJsonTypeMap";
import { IModelHubError } from "./Errors";
import { AuthorizationToken, AccessToken } from "../Token";
import { ImsDelegationSecureTokenClient } from "../ImsClients";
import { FileHandler } from "../imodeljs-clients";
import { CustomRequestOptions } from "./CustomRequestOptions";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";
import { Config } from "../Config";
/**
 * Provides default options for iModelHub requests.
 */
class DefaultIModelHubRequestOptionsProvider extends DefaultWsgRequestOptionsProvider {
  public constructor(agent: any) {
    super();
    this._defaultOptions.errorCallback = IModelHubError.parse;
    this._defaultOptions.retryCallback = IModelHubError.shouldRetry;
    this._defaultOptions.agent = agent;
  }
}

/**
 * This class acts as the WsgClient for other iModelHub Handlers.
 * @internal
 */
export class IModelBaseHandler extends WsgClient {
  protected _url?: string;
  private _defaultIModelHubOptionsProvider: DefaultIModelHubRequestOptionsProvider;
  public static readonly searchKey: string = "iModelHubApi";
  public static readonly configRelyingPartyUri = "imjs_imodelhub_relying_party_uri";
  protected _agent: any;
  protected _fileHandler: FileHandler | undefined;
  private _customRequestOptions: CustomRequestOptions = new CustomRequestOptions();

  /**
   * Create an instance of IModelBaseHandler.
   * @internal
   */
  public constructor(keepAliveDuration = 30000, fileHandler?: FileHandler) {
    super("sv1.1");
    this._fileHandler = fileHandler;
    const isMobile = typeof (self) !== "undefined" && (self as any).imodeljsMobile;
    if (!(typeof window === "undefined") && !isMobile) {
      // tslint:disable-next-line:no-var-requires
      this._agent = require("https").Agent({ keepAlive: keepAliveDuration > 0, keepAliveMsecs: keepAliveDuration, secureProtocol: "TLSv1_2_method" });
    }
  }

  public formatContextIdForUrl(contextId: string) { return contextId; }

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
   * Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  protected getRelyingPartyUrl(): string {
    if (Config.App.has(IModelBaseHandler.configRelyingPartyUri))
      return Config.App.get(IModelBaseHandler.configRelyingPartyUri) + "/";

    if (Config.App.getBoolean(WsgClient.configUseHostRelyingPartyUriAsFallback, true)) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return Config.App.get(WsgClient.configHostRelyingPartyUri) + "/";
    }

    throw new Error(`RelyingPartyUrl not set. Set it in Config.App using key ${IModelBaseHandler.configRelyingPartyUri}`);
  }

  /**
   * Get the agent used for imodelhub connection pooling.
   * @returns The agent used for imodelhub connection pooling.
   */
  public getAgent(): any {
    return this._agent;
  }

  /**
   * Get the URL of the service. This method attempts to discover and cache the URL from the URL Discovery Service. If not found uses the default URL provided by client implementations. Note that for consistency sake, the URL is stripped of any trailing "/"
   * @returns URL for the service
   */
  public async getUrl(requestContext: ClientRequestContext): Promise<string> {
    return super.getUrl(requestContext);
  }

  /**
   * Get the (delegation) access token to access the service
   * @param requestContext The client request context
   * @param authorizationToken Authorization token.
   * @returns Resolves to the (delegation) access token.
   */
  public async getAccessToken(requestContext: ClientRequestContext, authorizationToken: AuthorizationToken): Promise<AccessToken> {
    const imsClient = new ImsDelegationSecureTokenClient();
    return imsClient.getToken(requestContext, authorizationToken, this.getRelyingPartyUrl());
  }

  /**
   * Send a delete request. Sends a request without body.
   * @param requestContext The client request context
   * @param relativeUrlPath Relative path to the REST resource.
   * @returns Promise resolves after successfully deleting REST resource at the specified path.
   */
  public async delete(requestContext: AuthorizedClientRequestContext, relativeUrlPath: string): Promise<void> {
    return super.delete(requestContext, relativeUrlPath);
  }

  /**
   * Delete a strongly typed instance. Sends a request body with a WSG instance.
   * @param requestContext The client request context
   * @param relativeUrlPath Relative path to the REST resource.
   * @param instance Instance to be deleted.
   * @param requestOptions WSG options for the request.
   * @returns Promise resolves after successfully deleting instance.
   */
  public async deleteInstance<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, relativeUrlPath: string, instance?: T, requestOptions?: WsgRequestOptions): Promise<void> {
    if (this._customRequestOptions.isSet) {
      if (!requestOptions) {
        requestOptions = {};
      }
      requestOptions.CustomOptions = this._customRequestOptions.insertCustomOptions(requestOptions.CustomOptions);
    }
    return super.deleteInstance<T>(requestContext, relativeUrlPath, instance, requestOptions);
  }

  /**
   * Post a strongly typed instance. Sends a request body with a WSG instance.
   * @param requestContext The client request context
   * @param typedConstructor Used to construct the resulting instances from the response.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param instance Strongly typed instance to be posted.
   * @param requestOptions WSG options for the request.
   * @returns The posted instance that's returned back from the server.
   */
  public async postInstance<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, instance: T, requestOptions?: WsgRequestOptions): Promise<T> {
    if (this._customRequestOptions.isSet) {
      if (!requestOptions) {
        requestOptions = {};
      }
      requestOptions.CustomOptions = this._customRequestOptions.insertCustomOptions(requestOptions.CustomOptions);
    }
    return super.postInstance<T>(requestContext, typedConstructor, relativeUrlPath, instance, requestOptions);
  }

  /**
   * Post multiple strongly typed instances. Sends a request body with WSG instances.
   * @param requestContext The client request context
   * @param typedConstructor Used to construct the resulting instances from the response.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param instances Strongly typed instances to be posted.
   * @param requestOptions WSG options for the request.
   * @returns The posted instances that's returned back from the server.
   */
  public async postInstances<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, instances: T[], requestOptions?: WsgRequestOptions): Promise<T[]> {
    return super.postInstances(requestContext, typedConstructor, relativeUrlPath, instances, requestOptions);
  }

  /**
   * Get multiple strongly typed instances.
   * @param requestContext The client request context
   * @param typedConstructor Used to construct the resulting instances from the response.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param queryOptions Query options.
   * @returns Array of strongly typed instances.
   */
  public async getInstances<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, queryOptions?: RequestQueryOptions): Promise<T[]> {
    return super.getInstances(requestContext, typedConstructor, relativeUrlPath, queryOptions);
  }

  /**
   * Get multiple strongly typed instances. Sends query in the request's body. This can be used for queries that are too long to fit in URL.
   * @param requestContext The client request context
   * @param typedConstructor Used to construct the resulting instances from the response.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param queryOptions Query options.
   * @returns Array of strongly typed instances.
   */
  public async postQuery<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, queryOptions: RequestQueryOptions): Promise<T[]> {
    return super.postQuery(requestContext, typedConstructor, relativeUrlPath, queryOptions);
  }

  /**
   * Get an instance of CustomRequestOptions, which can be used to set custom request parameters for all future requests made by this handler.
   */
  public getCustomRequestOptions(): CustomRequestOptions {
    return this._customRequestOptions;
  }
}
