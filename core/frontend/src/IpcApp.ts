/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { AsyncMethodsOf, FrontendIpc, IpcAppChannel, IpcAppFunctions, PromiseReturnType } from "@bentley/imodeljs-common";
import { IModelApp } from "./IModelApp";

/**
 * The frontend of apps with a dedicated backend
 * @alpha
 */
export class IpcApp extends IModelApp {
  public static async callIpcAppBackend<T extends AsyncMethodsOf<IpcAppFunctions>>(methodName: T, ...args: Parameters<IpcAppFunctions[T]>) {
    return FrontendIpc.callBackend(IpcAppChannel.Functions, methodName, ...args) as PromiseReturnType<IpcAppFunctions[T]>;
  }

}
