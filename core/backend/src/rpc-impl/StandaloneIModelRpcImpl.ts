/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { Logger, OpenMode } from "@bentley/bentleyjs-core";
import {
  IModelConnectionProps, IModelNotFoundResponse, IModelRpcProps, RpcInterface, RpcManager, StandaloneIModelRpcInterface,
} from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { StandaloneDb } from "../IModelDb";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** The backend implementation of StandaloneIModelRpcInterface.
 * @internal
 */
export class StandaloneIModelRpcImpl extends RpcInterface implements StandaloneIModelRpcInterface {
  public static register() { RpcManager.registerImpl(StandaloneIModelRpcInterface, StandaloneIModelRpcImpl); }

  /** Ask the backend to open a standalone iModel from a file name that is resolved by the backend. */
  public async openFile(filePath: string, openMode: OpenMode): Promise<IModelConnectionProps> {
    const standaloneDb = StandaloneDb.tryFindByKey(filePath) ?? StandaloneDb.openFile(filePath, openMode);
    return standaloneDb.getConnectionProps();
  }

  /** Ask the backend to close a standalone iModel. */
  public async close(tokenProps: IModelRpcProps): Promise<boolean> {
    const filePath = tokenProps.key;
    const standaloneDb = StandaloneDb.tryFindByKey(filePath);
    if (undefined === standaloneDb) {
      Logger.logError(loggerCategory, "StandaloneDb was not open", () => filePath);
      throw new IModelNotFoundResponse();
    }
    standaloneDb.close();
    return true;
  }
}
