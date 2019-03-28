/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module BaseClients */
import { ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import * as deepAssign from "deep-assign";
import { AuthorizedClientRequestContext } from "./AuthorizedClientRequestContext";
import { Config } from "./Config";
import { LoggerCategory } from "./LoggerCategory";
import { request, RequestOptions, Response, ResponseError } from "./Request";

const loggerCategory: string = LoggerCategory.Clients;

/** Provider for default RequestOptions, used by Client to set defaults.
 */
export class DefaultRequestOptionsProvider {
  protected _defaultOptions: RequestOptions;
  /**
   * Creates an instance of DefaultRequestOptionsProvider and sets up the default options.
   */
  constructor() {
    this._defaultOptions = {
      method: "GET",
      useCorsProxy: false,
    };
  }

  /**
   * Augments options with the provider's default values.
   * @note The options passed in override any defaults where necessary.
   * @param options Options that should be augmented.
   */
  public async assignOptions(options: RequestOptions): Promise<void> {
    const clonedOptions: RequestOptions = Object.assign({}, options);
    deepAssign(options, this._defaultOptions);
    deepAssign(options, clonedOptions); // ensure the supplied options override the defaults
    return Promise.resolve();
  }
}

// @todo Setup a logging framework.
/**
 * Base class for all Client implementations
 */
export abstract class Client {
  private static _defaultRequestOptionsProvider: DefaultRequestOptionsProvider;
  protected _url?: string;

  /**
   * Creates an instance of Client.
   */
  protected constructor() {
  }

  /**
   * Augments request options with defaults returned by the DefaultRequestOptionsProvider.
   * @note The options passed in by clients override any defaults where necessary.
   * @param options Options the caller wants to eaugment with the defaults.
   * @returns Promise resolves after the defaults are setup.
   */
  protected async setupOptionDefaults(options: RequestOptions): Promise<void> {
    if (!Client._defaultRequestOptionsProvider)
      Client._defaultRequestOptionsProvider = new DefaultRequestOptionsProvider();
    return Client._defaultRequestOptionsProvider.assignOptions(options);
  }

  /**
   * Implemented by clients to specify the name/key to query the service URLs from
   * the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected abstract getUrlSearchKey(): string; // same as the URL Discovery Service ("Buddi") name

  /**
   * Gets the URL of the service. Attempts to discover and cache the URL from the URL Discovery Service. If not
   * found uses the default URL provided by client implementations. Note that for consistency
   * sake, the URL is stripped of any trailing "/"
   * @returns URL for the service
   */
  public async getUrl(requestContext: ClientRequestContext): Promise<string> {
    if (this._url) {
      return Promise.resolve(this._url);
    }

    const urlDiscoveryClient: UrlDiscoveryClient = new UrlDiscoveryClient();
    const searchKey: string = this.getUrlSearchKey();
    return urlDiscoveryClient.discoverUrl(requestContext, searchKey, undefined)
      .then(async (url: string): Promise<string> => {
        this._url = url;
        return Promise.resolve(this._url); // TODO: On the server this really needs a lifetime!!
      })
      .catch(async (): Promise<string> => {
        return Promise.reject(`Failed to discover URL for service identified by "${searchKey}"`);
      });
  }

  /** used by clients to send delete requests */
  protected async delete(requestContext: AuthorizedClientRequestContext, relativeUrlPath: string): Promise<void> {
    requestContext.enter();
    const url: string = await this.getUrl(requestContext) + relativeUrlPath;
    Logger.logInfo(loggerCategory, "Sending DELETE request", () => ({ url }));
    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: requestContext.accessToken.toTokenString() },
    };
    await this.setupOptionDefaults(options);
    await request(requestContext, url, options);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Successful DELETE request", () => ({ url }));
  }
}

/**
 * Error for issues with authentication.
 */
export class AuthenticationError extends ResponseError {
}

/**
 * Client API to discover URLs from the URL Discovery service
 * (a.k.a. Buddi service)
 */
export class UrlDiscoveryClient extends Client {
  public static readonly configURL = "imjs_buddi_url";
  public static readonly configResolveUrlUsingRegion = "imjs_buddi_resolve_url_using_region";
  /**
   * Creates an instance of UrlDiscoveryClient.
   */
  public constructor() {
    super();
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return "";
  }

  /**
   * Gets the URL for the discovery service
   * @returns URL of the discovery service.
   */
  public async getUrl(): Promise<string> {
    return Promise.resolve(Config.App.getString(UrlDiscoveryClient.configURL, "https://buddi.bentley.com/WebService"));
  }

  /**
   * Discovers a URL given the search key.
   * @param searchKey Search key registered for the service.
   * @param regionId Override region to use for URL discovery.
   * @returns Registered URL for the service.
   */
  public async discoverUrl(requestContext: ClientRequestContext, searchKey: string, regionId: number | undefined): Promise<string> {
    requestContext.enter();

    const url: string = await this.getUrl() + "/GetUrl/";
    const resolvedRegion = typeof regionId !== "undefined" ? regionId : Config.App.getNumber(UrlDiscoveryClient.configResolveUrlUsingRegion, 0);
    const options: RequestOptions = {
      method: "GET",
      qs: {
        url: searchKey,
        region: resolvedRegion,
      },
    };

    await this.setupOptionDefaults(options);
    requestContext.enter();

    const response: Response = await request(requestContext, url, options);
    requestContext.enter();

    const discoveredUrl: string = response.body.result.url.replace(/\/$/, ""); // strip trailing "/" for consistency
    return Promise.resolve(discoveredUrl);
  }
}
