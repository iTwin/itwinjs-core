/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelBank */

import { IModelBaseHandler } from "../imodelhub/BaseHandler";
import { DefaultWsgRequestOptionsProvider } from "../WsgClient";
import * as https from "https";
import { RequestOptions } from "../Request";
import { assert } from "@bentley/bentleyjs-core";
import { IModelBankError } from "./Errors";
import { FileHandler } from "..";

/**
 * Provides default options for iModelBank requests.
 */
class DefaultIModelBankRequestOptionsProvider extends DefaultWsgRequestOptionsProvider {
  public constructor(agent: https.Agent) {
    super();
    this._defaultOptions.errorCallback = IModelBankError.parse;
    this._defaultOptions.retryCallback = IModelBankError.shouldRetry;
    this._defaultOptions.agent = agent;
  }
}

/**
 * This class acts as the WsgClient for other iModelBank Handlers.
 */
export class IModelBankHandler extends IModelBaseHandler {
  private _defaultIModelBankOptionsProvider: DefaultIModelBankRequestOptionsProvider;

  /**
   * Creates an instance of IModelBankWsgClient.
   * @param deploymentEnv Deployment environment.
   * @param handler The upload/download handler to use -- backends only.
   * @param keepAliveDuration TBD
   */
  public constructor(url: string, handler: FileHandler | undefined, keepAliveDuration = 30000) {
    super("PROD", keepAliveDuration, handler);
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

  public formatProjectIdForUrl(_projectId: string) { return ""; }

  protected getUrlSearchKey(): string { assert(false, "Bentley cloud-specific method should be factored out of WsgClient base class"); return ""; }

  protected getDefaultUrl(): string { return this._url!; }

  public async getUrl(excludeApiVersion?: boolean): Promise<string> {
    if (this._url)
      return Promise.resolve(this._url!);

    this._url = this.getDefaultUrl();
    if (!excludeApiVersion) {
      this._url += "/" + this.apiVersion;
    }
    return Promise.resolve(this._url!);
  }
}
