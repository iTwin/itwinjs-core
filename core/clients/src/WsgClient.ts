/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module BaseClients */
import * as deepAssign from "deep-assign";

import { AccessToken, AuthorizationToken } from "./Token";
import { request, RequestOptions, RequestQueryOptions, Response, ResponseError } from "./Request";
import { ECJsonTypeMap, WsgInstance } from "./ECJsonTypeMap";
import { Logger, HttpStatus, WSStatus, GetMetaDataFunction } from "@bentley/bentleyjs-core";
import { DefaultRequestOptionsProvider, AuthenticationError, Client, DeploymentEnv } from "./Client";
import { ImsDelegationSecureTokenClient } from "./ImsClients";

const loggingCategory = "imodeljs-clients.Clients";

/**
 * Error that was returned by a WSG based service.
 */
export class WsgError extends ResponseError {
  public constructor(errorNumber: number | HttpStatus, message?: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
  }

  /**
   * Attempt to parse the error from the response.
   * Attempts to parse error data in a format that is returned by WSG services.
   * This method only accesses data that was parsed by parent class to avoid dependencies on
   * http libraries.
   * @param response Response from the server.
   * @returns Parsed error.
   */
  public static parse(response: any, log = true): ResponseError {
    const responseError = ResponseError.parse(response, false);
    const wsgError = new WsgError(WSStatus.Unknown);
    deepAssign(wsgError, responseError);

    if (wsgError._data) {
      if (typeof wsgError._data === "object") {
        if (wsgError._data.errorMessage || wsgError._data.errorId) {
          wsgError.message = wsgError._data.errorMessage || wsgError.message;
          wsgError.name = wsgError._data.errorId || wsgError.name;
          wsgError.description = wsgError._data.errorDescription || wsgError.description;
          wsgError.errorNumber = WsgError.getWSStatusId(wsgError.name ? wsgError.name : "");
          if (log)
            wsgError.log();
          return wsgError;
        }
      } else {
        if (wsgError.status === 302 && wsgError._data.indexOf("ims.bentley.com") >= 0) {
          const authenticationError = new AuthenticationError(WSStatus.LoginRequired);
          deepAssign(authenticationError, responseError);
          authenticationError.name = "Authentication Error";
          authenticationError.message = "Authentication Error - Check if the accessToken is valid";
          return authenticationError;
        }
      }
    }
    if (log)
      responseError.log();
    return responseError;
  }

  /**
   * Decides whether request should be retried or not
   * @param error Error
   * @param response Response
   */
  public static shouldRetry(error: any, response: any): boolean {
    if (response === undefined || response === null) {
      return super.shouldRetry(error, response);
    }

    if (super.parseHttpStatus(response.statusType) === HttpStatus.Success) {
      return false;
    }

    const parsedError = WsgError.parse({ response }, false);
    if (!(parsedError instanceof WsgError)) {
      return super.shouldRetry(error, response);
    }

    const errorCodesToRetry: number[] = [WSStatus.LoginFailed,
    WSStatus.SslRequired,
    WSStatus.NotEnoughRights,
    WSStatus.RepositoryNotFound,
    WSStatus.SchemaNotFound,
    WSStatus.ClassNotFound,
    WSStatus.PropertyNotFound,
    WSStatus.InstanceNotFound,
    WSStatus.FileNotFound,
    WSStatus.NotSupported,
    WSStatus.NoServerLicense,
    WSStatus.NoClientLicense,
    WSStatus.TooManyBadLoginAttempts,
    HttpStatus.ServerError,
    HttpStatus.ClientError,
    WSStatus.Unknown];
    const errorStatus = WsgError.getErrorStatus(parsedError.name !== undefined ?
      WsgError.getWSStatusId(parsedError.name) : WSStatus.Unknown, response.statusType);
    return errorCodesToRetry.includes(errorStatus);
  }

  /**
   * Gets error status from current WSError and HTTP Status type
   * @param error Error returned by request
   * @param response Response returned by request
   */
  public static getErrorStatus(errorId: number, httpStatusType: number): number {
    if (WSStatus.Unknown !== errorId) {
      return errorId;
    }
    if (super.parseHttpStatus(httpStatusType) === HttpStatus.ServerError) {
      return HttpStatus.ServerError;
    }
    if (super.parseHttpStatus(httpStatusType) === HttpStatus.ClientError) {
      return HttpStatus.ClientError;
    }
    return WSStatus.Unknown;
  }

  /**
   * Get WSError from error string
   * @param error error to be returned in WSError enum
   */
  public static getWSStatusId(error: string): number {
    switch (error) {
      case "LoginFailed":
        return WSStatus.LoginFailed;
      case "SslRequired":
        return WSStatus.SslRequired;
      case "NotEnoughRights":
        return WSStatus.NotEnoughRights;
      case "DatasourceNotFound":
        return WSStatus.RepositoryNotFound;
      case "RepositoryNotFound":
        return WSStatus.RepositoryNotFound;
      case "SchemaNotFound":
        return WSStatus.SchemaNotFound;
      case "ClassNotFound":
        return WSStatus.ClassNotFound;
      case "PropertyNotFound":
        return WSStatus.PropertyNotFound;
      case "LinkTypeNotFound":
        return WSStatus.ClassNotFound;
      case "ObjectNotFound":
        return WSStatus.InstanceNotFound;
      case "InstanceNotFound":
        return WSStatus.InstanceNotFound;
      case "FileNotFound":
        return WSStatus.FileNotFound;
      case "NotSupported":
        return WSStatus.NotSupported;
      case "NoServerLicense":
        return WSStatus.NoServerLicense;
      case "NoClientLicense":
        return WSStatus.NoClientLicense;
      case "TooManyBadLoginAttempts":
        return WSStatus.TooManyBadLoginAttempts;
      default:
        return WSStatus.Unknown;
    }
  }

  /**
   * Logs this error
   */
  public log(): void {
    Logger.logError(loggingCategory, this.logMessage(), this.getMetaData());
  }
}

/**
 * Provider for wsg RequestOptions, used by WsgClient to set defaults.
 */
export class DefaultWsgRequestOptionsProvider extends DefaultRequestOptionsProvider {
  /**
   * Creates an instance of DefaultWsgRequestOptionsProvider and sets up the default options.
   */
  constructor() {
    super();
    this._defaultOptions.errorCallback = WsgError.parse;
    this._defaultOptions.retryCallback = WsgError.shouldRetry;
  }
}

/**
 * Options for WSG requests sent to the service
 */
export interface WsgRequestOptions {
  ResponseContent?: "FullInstance" | "Empty" | "InstanceId";
  RefreshInstances?: boolean;
  CustomOptions?: any;
}

/**
 * Base class for Client implementations of services that are based on WSG
 */
export abstract class WsgClient extends Client {
  private static _defaultWsgRequestOptionsProvider: DefaultWsgRequestOptionsProvider;
  protected _url?: string;

  /**
   * Creates an instance of Client.
   * @param deploymentEnv Deployment environment
   * @param apiVersion ApiVersion if the service supports it
   * @param relyingPartyUri Relying party URI if required by the service.
   */
  protected constructor(public deploymentEnv: DeploymentEnv, public apiVersion: string, public relyingPartyUri: string) {
    super(deploymentEnv);
    this.apiVersion = apiVersion;
    this.relyingPartyUri = relyingPartyUri;
  }

  /**
   * Augments request options with defaults returned by the DefaultWsgRequestOptionsProvider.
   * @note that the options passed in by clients override any defaults where necessary.
   * @param options Options the caller wants to augment with the defaults.
   * @returns Promise resolves after the defaults are setup.
   */
  protected async setupOptionDefaults(options: RequestOptions): Promise<void> {
    if (!WsgClient._defaultWsgRequestOptionsProvider)
      WsgClient._defaultWsgRequestOptionsProvider = new DefaultWsgRequestOptionsProvider();
    return WsgClient._defaultWsgRequestOptionsProvider.assignOptions(options);
  }

  /**
   * Gets the URL of the service.
   * Attempts to discover and cache the URL from the URL Discovery Service. If not
   * found uses the default URL provided by client implementations. Note that for consistency
   * sake, the URL is stripped of any trailing "/"
   * @param excludeApiVersion Pass true to optionally exclude the API version from the URL.
   * @returns URL for the service
   */
  public async getUrl(excludeApiVersion?: boolean): Promise<string> {
    if (this._url) {
      return Promise.resolve(this._url);
    }

    return super.getUrl()
      .then((url: string): Promise<string> => {
        this._url = url;
        if (!excludeApiVersion) {
          this._url += "/" + this.apiVersion;
        }
        return Promise.resolve(this._url); // TODO: On the server this really needs a lifetime!!
      });
  }

  /**
   * Gets the (delegation) access token to access the service
   * @param authTokenInfo Access token.
   * @returns Resolves to the (delegation) access token.
   */
  public async getAccessToken(authorizationToken: AuthorizationToken): Promise<AccessToken> {
    const imsClient = new ImsDelegationSecureTokenClient(this.deploymentEnv);
    return imsClient.getToken(authorizationToken, this.relyingPartyUri);
  }

  /** used by clients to delete strongly typed instances through the standard WSG REST API */
  protected async deleteInstance<T extends WsgInstance>(token: AccessToken, relativeUrlPath: string, instance?: T, requestOptions?: WsgRequestOptions): Promise<void> {
    const url: string = await this.getUrl() + relativeUrlPath;
    const untypedInstance: any = instance ? ECJsonTypeMap.toJson<T>("wsg", instance) : undefined;
    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: token.toTokenString() },
      body: {
        instance: untypedInstance,
      },
    };
    if (requestOptions) {
      options.body.requestOptions = requestOptions;
    }
    await this.setupOptionDefaults(options);
    return request(url, options).then(() => Promise.resolve());
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
  protected async postInstance<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, instance: T, requestOptions?: WsgRequestOptions): Promise<T> {
    const url: string = await this.getUrl() + relativeUrlPath;
    Logger.logInfo(loggingCategory, `Sending POST request to ${url}`);
    const untypedInstance: any = ECJsonTypeMap.toJson<T>("wsg", instance);

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: token.toTokenString() },
      body: {
        instance: untypedInstance,
      },
    };
    if (requestOptions) {
      options.body.requestOptions = requestOptions;
    }
    await this.setupOptionDefaults(options);

    const res: Response = await request(url, options);
    if (!res.body || !res.body.changedInstance || !res.body.changedInstance.instanceAfterChange) {
      return Promise.reject(new Error(`POST to URL ${url} executed successfully, but did not return the expected result.`));
    }
    const ecJsonInstance = res.body.changedInstance.instanceAfterChange;
    const typedInstance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg", ecJsonInstance);

    // console.log(JSON.stringify(res.body.instances));
    if (!typedInstance) {
      return Promise.reject(new Error(`POST to URL ${url} executed successfully, but could not convert response to a strongly typed instance.`));
    }

    Logger.logTrace(loggingCategory, `Successful POST request to ${url}`);
    return Promise.resolve(typedInstance);
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
  protected async postInstances<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, instances: T[], requestOptions?: WsgRequestOptions): Promise<T[]> {
    const url: string = await this.getUrl() + relativeUrlPath;
    Logger.logInfo(loggingCategory, `Sending POST request to ${url}`);
    const untypedInstances: any[] = instances.map((value: T) => ECJsonTypeMap.toJson<T>("wsg", value));

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: token.toTokenString() },
      body: {
        instances: untypedInstances,
      },
    };
    if (requestOptions) {
      options.body.requestOptions = requestOptions;
    }
    await this.setupOptionDefaults(options);

    const res: Response = await request(url, options);
    if (!res.body || !res.body.changedInstances) {
      return Promise.reject(new Error(`POST to URL ${url} executed successfully, but did not return the expected result.`));
    }
    const changedInstances: T[] = (res.body.changedInstances as any[]).map<T>((value: any) => {
      const untypedInstance = value.instanceAfterChange;
      if (!untypedInstance) {
        throw new Error(`POST to URL ${url} executed successfully, but could not convert response to a strongly typed instance.`);
      }
      const typedInstance = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg", untypedInstance);
      if (!typedInstance) {
        throw new Error(`POST to URL ${url} executed successfully, but could not convert response to a strongly typed instance.`);
      }
      return typedInstance;
    });

    Logger.logTrace(loggingCategory, `Successful POST request to ${url}`);
    return Promise.resolve(changedInstances);
  }

  // @todo Use lower level utilities instead of the node based Request API.
  // @todo Deserialize stream directly to the type, instead of creating an intermediate JSON object.
  /**
   * Used by clients to get strongly typed instances from standard WSG REST queries that return EC JSON instances.
   * @param typedConstructor Constructor function for the type
   * @param token Delegation token
   * @param relativeUrlPath Relative path to the REST resource.
   * @param queryOptions Query options.
   * @returns Array of strongly typed instances.
   */
  protected async getInstances<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, queryOptions?: RequestQueryOptions): Promise<T[]> {
    const url: string = await this.getUrl() + relativeUrlPath;
    Logger.logInfo(loggingCategory, `Sending GET request to ${url}`);

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: token.toTokenString() },
      qs: queryOptions,
      accept: "application/json",
    };

    await this.setupOptionDefaults(options);

    const res: Response = await request(url, options);
    if (!res.body || !res.body.hasOwnProperty("instances")) {
      return Promise.reject(new Error(`Query to URL ${url} executed successfully, but did NOT return any instances.`));
    }
    // console.log(JSON.stringify(res.body.instances));
    const typedInstances: T[] = new Array<T>();
    for (const ecJsonInstance of res.body.instances) {
      const typedInstance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg", ecJsonInstance);
      if (typedInstance) {
        typedInstances.push(typedInstance);
      }
    }

    Logger.logTrace(loggingCategory, `Successful GET request to ${url}`);
    return Promise.resolve(typedInstances);
  }

  private getQueryRequestBody(queryOptions: RequestQueryOptions) {
    const addPart = (query: string, key: string, value: string) => {
      if (query !== "")
        query += "&";
      query += `${key}=${value}`;
      return query;
    };
    let result = "";
    if (queryOptions.$filter) {
      result = addPart(result, "$filter", queryOptions.$filter);
    }
    if (queryOptions.$orderby) {
      result = addPart(result, "$orderby", queryOptions.$orderby);
    }
    if (queryOptions.$select) {
      result = addPart(result, "$select", queryOptions.$select);
    }
    if (queryOptions.$skip) {
      result = addPart(result, "$skip", queryOptions.$skip.toString(10));
    }
    if (queryOptions.$top) {
      result = addPart(result, "$top", queryOptions.$top.toString(10));
    }
    return result;
  }

  /**
   * Used by clients to get strongly typed instances from standard WSG REST queries that return EC JSON instances.
   * @param typedConstructor Constructor function for the type
   * @param token Delegation token
   * @param relativeUrlPath Relative path to the REST resource.
   * @param queryOptions Query options.
   * @returns Array of strongly typed instances.
   */
  protected async postQuery<T extends WsgInstance>(typedConstructor: new () => T, token: AccessToken, relativeUrlPath: string, queryOptions: RequestQueryOptions): Promise<T[]> {
    const url: string = `${await this.getUrl()}${relativeUrlPath}$query`;
    Logger.logInfo(loggingCategory, `Sending GET request to ${url}`);

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: token.toTokenString() },
      body: this.getQueryRequestBody(queryOptions),
    };

    await this.setupOptionDefaults(options);

    const res: Response = await request(url, options);
    if (!res.body || !res.body.hasOwnProperty("instances")) {
      return Promise.reject(new Error(`Query to URL ${url} executed successfully, but did NOT return any instances.`));
    }
    // console.log(JSON.stringify(res.body.instances));
    const typedInstances: T[] = new Array<T>();
    for (const ecJsonInstance of res.body.instances) {
      const typedInstance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg", ecJsonInstance);
      if (typedInstance) {
        typedInstances.push(typedInstance);
      }
    }

    Logger.logTrace(loggingCategory, `Successful GET request to ${url}`);
    return Promise.resolve(typedInstances);
  }
}
