/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelBank */
import { IModelBaseHandler } from "../imodelhub/BaseHandler";
import { assert, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { FileHandler } from "..";

/*
 * This class acts as the WsgClient for other iModelBank Handlers.
 */
export class IModelBankHandler extends IModelBaseHandler {
  private _baseUrl: string;

  /*
   * Creates an instance of IModelBankWsgClient.
   * @param deploymentEnv Deployment environment.
   * @param handler The upload/download handler to use -- backends only.
   * @param keepAliveDuration TBD
   */
  public constructor(url: string, handler: FileHandler | undefined, keepAliveDuration = 30000) {
    super("PROD", keepAliveDuration, handler);
    this._baseUrl = url;
  }

  protected getUrlSearchKey(): string { assert(false, "Bentley cloud-specific method should be factored out of WsgClient base class"); return ""; }

  protected getDefaultUrl(): string { return this._baseUrl; }

  public async getUrl(_actx: ActivityLoggingContext, excludeApiVersion?: boolean): Promise<string> {
    if (this._url)
      return Promise.resolve(this._url!);

    this._url = this.getDefaultUrl();
    if (!excludeApiVersion) {
      this._url += "/" + this.apiVersion;
    }
    return Promise.resolve(this._url!);
  }
}
