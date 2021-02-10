/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelApp
 */

import { BentleyCloudRpcManager, BentleyCloudRpcParams, RpcRoutingToken } from "@bentley/imodeljs-common";
import { IModelApp, IModelAppOptions } from "./IModelApp";

/**
 * Options for [[WebViewerApp.startup]]
 * @beta
 */
export interface WebViewerAppOptions {
  rpcParams: BentleyCloudRpcParams;
  routing?: RpcRoutingToken;
}

/**
 * The frontend of apps with a shared backend for visualization of iModels. WebViewerApps may only open
 * iModels readonly, and may not use Ipc.
 * @beta
 */
export class WebViewerApp {

  private static _isValid = false;
  private static get isValid() { return this._isValid; }

  public static async startup(opts: { webViewerApp: WebViewerAppOptions, iModelApp?: IModelAppOptions }) {
    if (!this.isValid) {
      this._isValid = true;
      const params = opts.webViewerApp;
      BentleyCloudRpcManager.initializeClient(params.rpcParams, opts.iModelApp?.rpcInterfaces ?? [], params.routing);
    }
    await IModelApp.startup(opts.iModelApp);
  }

  public static async shutdown() {
    // don't set isValid = false, we can only call BentleyCloudRpcManager.initializeClient once
    await IModelApp.shutdown();
  }
}

