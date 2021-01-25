/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { AsyncMethodsOf, FrontendIpc, IpcAppChannel, IpcAppFunctions, PromiseReturnType } from "@bentley/imodeljs-common";
import { IModelApp, IModelAppOptions } from "./IModelApp";

/**
 * The frontend of apps with a dedicated backend
 * @alpha
 */
export class IpcApp {
  public static async callIpcAppBackend<T extends AsyncMethodsOf<IpcAppFunctions>>(methodName: T, ...args: Parameters<IpcAppFunctions[T]>) {
    return FrontendIpc.callBackend(IpcAppChannel.Functions, methodName, ...args) as PromiseReturnType<IpcAppFunctions[T]>;
  }
  private static _isValid = false;
  public static get isValid(): boolean { return this._isValid; }

  public static async startup(opts?: IModelAppOptions) {
    await IModelApp.startup(opts);
    this._isValid = true;
  }
  public static async shutdown() {
    this._isValid = false;
    await IModelApp.shutdown();
  }
}
