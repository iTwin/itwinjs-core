/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelBaseHandler } from "../imodelhub/BaseHandler";
import { DefaultWsgRequestOptionsProvider } from "../WsgClient";
import * as https from "https";
import { RequestOptions } from "../Request";
import { assert } from "@bentley/bentleyjs-core";
import { UrlFileHandler } from "../UrlFileHandler";
import { IModelBankError } from "./Errors";
import { FileHandler, Config } from "..";

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

function constructUrlFileHandler(): FileHandler | undefined {
  return Config.isBrowser() ? undefined : new UrlFileHandler();
}

/**
 * This class acts as the WsgClient for other iModelBank Handlers.
 */
export class IModelBankHandler extends IModelBaseHandler {
  private _url: string;
  private _defaultIModelBankOptionsProvider: DefaultIModelBankRequestOptionsProvider;

  /**
   * Creates an instance of IModelBankWsgClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(url: string, keepAliveDuration = 30000) {
    super("PROD", keepAliveDuration, constructUrlFileHandler());
    this._url = url;
  }

  /**
   * Augments request options with defaults returned by the DefaultIModelHubRequestOptionsProvider.
   * Note that the options passed in by clients override any defaults where necessary.
   * @param options Options the caller wants to eaugment with the defaults.
   * @returns Promise resolves after the defaults are setup.
   */
  protected async setupOptionDefaults(options: RequestOptions): Promise<void> {
    if (!this._defaultIModelBankOptionsProvider)
      this._defaultIModelBankOptionsProvider = new DefaultIModelBankRequestOptionsProvider(this._agent);

    return this._defaultIModelBankOptionsProvider.assignOptions(options);
  }

  protected getUrlSearchKey(): string { assert(false, "Bentley cloud-specific method should be factored out of WsgClient base class"); return ""; }

  protected getDefaultUrl(): string { return this._url; }

  public async getUrl(excludeApiVersion?: boolean): Promise<string> {
    if (this.url)
      return Promise.resolve(this.url!);

    this.url = this.getDefaultUrl();
    if (!excludeApiVersion) {
      this.url += "/" + this.apiVersion;
    }
    return Promise.resolve(this.url!);
  }
}
