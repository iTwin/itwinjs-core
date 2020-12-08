/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnectionProps, IModelRpcProps, RpcInterface, RpcManager, StandaloneIModelRpcInterface } from "@bentley/imodeljs-common";
import { StandaloneDb } from "../IModelDb";

/** The backend implementation of StandaloneIModelRpcInterface.
 * @internal
 */
export class StandaloneIModelRpcImpl extends RpcInterface implements StandaloneIModelRpcInterface {
  public static register() { RpcManager.registerImpl(StandaloneIModelRpcInterface, StandaloneIModelRpcImpl); }

  /** Ask the backend to open a standalone iModel from a file name that is resolved by the backend. */
  public async openFile(filePath: string, openMode: OpenMode): Promise<IModelConnectionProps> {
    return StandaloneDb.openFile(filePath, openMode).getConnectionProps();
  }

  /** Ask the backend to close a standalone iModel. */
  public async close(tokenProps: IModelRpcProps): Promise<boolean> {
    StandaloneDb.findByKey(tokenProps.key).close();
    return true;
  }
}
