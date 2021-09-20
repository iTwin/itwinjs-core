/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iTwinServiceClients
 */
import { Logger } from "@bentley/bentleyjs-core";
import * as deepAssign from "deep-assign";
import { AuthorizedClientRequestContext } from "./AuthorizedClientRequestContext";
import { ITwinClientLoggerCategory } from "./ITwinClientLoggerCategory";
import { request, RequestOptions } from "./Request";

const loggerCategory: string = ITwinClientLoggerCategory.Clients;

/**
 * Provider for default RequestOptions, used by Client to set defaults.
 * @internal
 */
export class DefaultRequestOptionsProvider {
  protected _defaultOptions: RequestOptions;
  /** Creates an instance of DefaultRequestOptionsProvider and sets up the default options. */
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
    const clonedOptions: RequestOptions = { ...options };
    deepAssign(options, this._defaultOptions);
    deepAssign(options, clonedOptions); // ensure the supplied options override the defaults
  }
}

// @todo Setup a logging framework.
/**
 * Base class for all Client implementations
 * @beta
 */
export abstract class Client {
  private static _defaultRequestOptionsProvider: DefaultRequestOptionsProvider;
  protected _url?: string;

  /**
   * Sets the default base URL to use with this client.
   */
  protected baseUrl?: string;

  /**  Creates an instance of Client. */
  protected constructor() {
  }

  /**
   * Augments request options with defaults returned by the DefaultRequestOptionsProvider.
   * @note The options passed in by clients override any defaults where necessary.
   * @param options Options the caller wants to augment with the defaults.
   * @returns Promise resolves after the defaults are setup.
   */
  protected async setupOptionDefaults(options: RequestOptions): Promise<void> {
    if (!Client._defaultRequestOptionsProvider)
      Client._defaultRequestOptionsProvider = new DefaultRequestOptionsProvider();
    return Client._defaultRequestOptionsProvider.assignOptions(options);
  }

  /**
   * Gets the URL of the service. Attempts to discover and cache the URL from the URL Discovery Service. If not
   * found uses the default URL provided by client implementations. Note that for consistency
   * sake, the URL is stripped of any trailing "/"
   * @returns URL for the service
   */
  public async getUrl(): Promise<string> {
    if (this._url)
      return this._url;

    if (!this.baseUrl) {
      throw new Error("need base url");
    }

    let prefix = process.env.IMJS_URL_PREFIX;
    if (prefix) {
      const baseUrl = new URL(this.baseUrl);
      baseUrl.hostname = prefix + baseUrl.hostname;
      this._url = baseUrl.href;
    } else {
      this._url = this.baseUrl;
    }

    return this._url;
  }

  /** used by clients to send delete requests */
  protected async delete(requestContext: AuthorizedClientRequestContext, relativeUrlPath: string): Promise<void> {
    requestContext.enter();
    const url: string = await this.getUrl() + relativeUrlPath;
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
