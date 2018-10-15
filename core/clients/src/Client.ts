/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module BaseClients */
import * as deepAssign from "deep-assign";
import { AccessToken } from "./Token";
import { Config } from "./Config";
import { request, RequestOptions, Response, ResponseError } from "./Request";
import { Logger, ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** The deployment environment of the services - this also identifies the URL location of the service */
export enum KnownRegions {
  DEV = 103,
  QA = 102,
  PROD = 0,
  PERF = 294,
}

const loggingCategory = "imodeljs-clients.Clients";

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
      useCorsProxy: true,
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
   * Implemented by clients to specify the default URL for the service.
   * @protected
   * @returns Default URL for the service.
   */
  protected abstract getDefaultUrl(): string;

  /**
   * Implemented by clients to specify the name/key to query the service URLs from
   * the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected abstract getUrlSearchKey(): string; // same as the URL Discovery Service ("Buddi") name

  /**
   * Implemented by clients to specify the region for the service.
   * @protected
   * @returns region id for the service to be used with url discovery.
   */
  protected abstract getRegion(): number | undefined;
  /**
   * Gets the URL of the service. Attempts to discover and cache the URL from the URL Discovery Service. If not
   * found uses the default URL provided by client implementations. Note that for consistency
   * sake, the URL is stripped of any trailing "/"
   * @returns URL for the service
   */
  public async getUrl(alctx: ActivityLoggingContext): Promise<string> {
    if (this._url) {
      return Promise.resolve(this._url);
    }

    const urlDiscoveryClient: UrlDiscoveryClient = new UrlDiscoveryClient();
    const searchKey: string = this.getUrlSearchKey();
    return urlDiscoveryClient.discoverUrl(alctx, searchKey, this.getRegion())
      .then((url: string): Promise<string> => {
        this._url = url;
        return Promise.resolve(this._url); // TODO: On the server this really needs a lifetime!!
      })
      .catch((error: string): Promise<string> => {
        console.log(`WARNING: Could not determine URL for ${searchKey} service. Error = ${error}`); // tslint:disable-line:no-console
        return Promise.resolve(this.getDefaultUrl().replace(/\/$/, "")); // strip trailing "/" for consistency
      });
  }

  /** used by clients to send delete requests */
  protected async delete(alctx: ActivityLoggingContext, token: AccessToken, relativeUrlPath: string): Promise<void> {
    alctx.enter();
    const url: string = await this.getUrl(alctx) + relativeUrlPath;
    Logger.logInfo(loggingCategory, `Sending DELETE request to ${url}`);
    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: token.toTokenString() },
    };
    await this.setupOptionDefaults(options);
    await request(alctx, url, options);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Successful DELETE request to ${url}`);
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
  public static readonly configRegion = "imjs_buddi_region";
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
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return Config.App.getString(UrlDiscoveryClient.configURL, "https://buddi.bentley.com/WebService");
  }

  /**
   * Override default region for this service
   * @returns region id or undefined
   */
  protected getRegion(): number | undefined {
    if (Config.App.has(UrlDiscoveryClient.configRegion))
      return Config.App.get(UrlDiscoveryClient.configRegion);

    return KnownRegions.PROD; // return production
  }
  /**
   * Gets the URL for the discovery service
   * @returns URL of the discovery service.
   */
  public async getUrl(): Promise<string> {
    return Promise.resolve(this.getDefaultUrl().replace(/\/$/, "")); // strip trailing "/" for consistency
  }

  /**
   * Discovers a URL given the search key.
   * @param searchKey Search key registered for the service.
   * @param regionId Override region to use for URL discovery.
   * @returns Registered URL for the service.
   */
  public async discoverUrl(alctx: ActivityLoggingContext, searchKey: string, regionId: number | undefined): Promise<string> {
    alctx.enter();
    const url: string = this.getDefaultUrl().replace(/\/$/, "") + "/GetUrl/";
    const resolvedRegion = typeof regionId !== "undefined" ? regionId : Config.App.getNumber(UrlDiscoveryClient.configResolveUrlUsingRegion, KnownRegions.PROD);
    const options: RequestOptions = {
      method: "GET",
      qs: {
        url: searchKey,
        region: resolvedRegion,
      },
    };
    await this.setupOptionDefaults(options);
    alctx.enter();

    const response: Response = await request(alctx, url, options);
    const discoveredUrl: string = response.body.result.url.replace(/\/$/, ""); // strip trailing "/" for consistency

    return Promise.resolve(discoveredUrl);
  }
}
