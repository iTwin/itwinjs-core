/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { DefaultWsgRequestOptionsProvider, WsgClient, WsgRequestOptions } from "../WsgClient";
import { RequestOptions, RequestQueryOptions } from "../Request";
import { WsgInstance } from "../ECJsonTypeMap";
import { IModelHubError } from "./Errors";
import { AuthorizationToken, AccessToken } from "../Token";
import { ImsDelegationSecureTokenClient } from "../ImsClients";
import * as https from "https";
import { FileHandler } from "..";
import { CustomRequestOptions } from "./CustomRequestOptions";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { Config } from "../Config";
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
  public static readonly configURL = "imjs_imodelhub_url";
  public static readonly configRelyingPartyUri = "imjs_imodelhub_relying_party_uri";
  public static readonly configRegion = "imjs_imodelhub_region";
  protected _agent: https.Agent;
  protected _fileHandler: FileHandler | undefined;
  private _customRequestOptions: CustomRequestOptions = new CustomRequestOptions();

  /**
   * Create an instance of IModelBaseHandler.
   * @hidden
   */
  public constructor(keepAliveDuration = 30000, fileHandler?: FileHandler) {
    super("sv1.1");
    this._fileHandler = fileHandler;
    if (!(typeof window === "undefined"))
      this._agent = new https.Agent({ keepAlive: keepAliveDuration > 0, keepAliveMsecs: keepAliveDuration, secureProtocol: "TLSv1_2_method" });
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
    if (Config.App.has(IModelBaseHandler.configURL))
      return Config.App.get(IModelBaseHandler.configURL);

    throw new Error(`Service URL not set. Set it in Config.App using key ${IModelBaseHandler.configURL}`);
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
   * Override default region for this service
   * @returns region id or undefined
   */
  protected getRegion(): number | undefined {
    if (Config.App.has(IModelBaseHandler.configRegion))
      return Config.App.get(IModelBaseHandler.configRegion);

    return undefined;
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
  public getUrl(alctx: ActivityLoggingContext): Promise<string> {
    return super.getUrl(alctx);
  }

  /**
   * Get the (delegation) access token to access the service
   * @param authorizationToken Authorization token.
   * @returns Resolves to the (delegation) access token.
   */
  public async getAccessToken(alctx: ActivityLoggingContext, authorizationToken: AuthorizationToken): Promise<AccessToken> {
    const imsClient = new ImsDelegationSecureTokenClient();
    return imsClient.getToken(alctx, authorizationToken, this.getRelyingPartyUrl());
  }

  /**
   * Send a delete request. Sends a request without body.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @returns Promise resolves after successfully deleting REST resource at the specified path.
   */
  public delete(alctx: ActivityLoggingContext, token: AccessToken, relativeUrlPath: string): Promise<void> {
    return super.delete(alctx, token, relativeUrlPath);
  }

  /**
   * Delete a strongly typed instance. Sends a request body with a WSG instance.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param instance Instance to be deleted.
   * @param requestOptions WSG options for the request.
   * @returns Promise resolves after successfully deleting instance.
   */
  public deleteInstance<T extends WsgInstance>(alctx: ActivityLoggingContext, token: AccessToken, relativeUrlPath: string, instance?: T, requestOptions?: WsgRequestOptions): Promise<void> {
    if (this._customRequestOptions.isSet) {
      if (!requestOptions) {
        requestOptions = {};
      }
      requestOptions.CustomOptions = this._customRequestOptions.insertCustomOptions(requestOptions.CustomOptions);
    }
    return super.deleteInstance<T>(alctx, token, relativeUrlPath, instance, requestOptions);
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
  public postInstance<T extends WsgInstance>(alctx: ActivityLoggingContext, typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, instance: T, requestOptions?: WsgRequestOptions): Promise<T> {
    if (this._customRequestOptions.isSet) {
      if (!requestOptions) {
        requestOptions = {};
      }
      requestOptions.CustomOptions = this._customRequestOptions.insertCustomOptions(requestOptions.CustomOptions);
    }
    return super.postInstance<T>(alctx, typedConstructor, token, relativeUrlPath, instance, requestOptions);
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
  public postInstances<T extends WsgInstance>(alctx: ActivityLoggingContext, typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, instances: T[], requestOptions?: WsgRequestOptions): Promise<T[]> {
    return super.postInstances(alctx, typedConstructor, token, relativeUrlPath, instances, requestOptions);
  }

  /**
   * Get multiple strongly typed instances.
   * @param typedConstructor Used to construct the resulting instances from the response.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param queryOptions Query options.
   * @returns Array of strongly typed instances.
   */
  public getInstances<T extends WsgInstance>(alctx: ActivityLoggingContext, typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, queryOptions?: RequestQueryOptions): Promise<T[]> {
    return super.getInstances(alctx, typedConstructor, token, relativeUrlPath, queryOptions);
  }

  /**
   * Get multiple strongly typed instances. Sends query in the request's body. This can be used for queries that are too long to fit in URL.
   * @param typedConstructor Used to construct the resulting instances from the response.
   * @param token Delegation token of the authorized user.
   * @param relativeUrlPath Relative path to the REST resource.
   * @param queryOptions Query options.
   * @returns Array of strongly typed instances.
   */
  public postQuery<T extends WsgInstance>(alctx: ActivityLoggingContext, typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, queryOptions: RequestQueryOptions): Promise<T[]> {
    return super.postQuery(alctx, typedConstructor, token, relativeUrlPath, queryOptions);
  }

  /**
   * Get an instance of CustomRequestOptions, which can be used to set custom request parameters for all future requests made by this handler.
   */
  public getCustomRequestOptions(): CustomRequestOptions {
    return this._customRequestOptions;
  }
}
