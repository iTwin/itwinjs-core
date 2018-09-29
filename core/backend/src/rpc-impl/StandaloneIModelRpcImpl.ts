/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { OpenMode } from "@bentley/bentleyjs-core";
import { RpcInterface, RpcManager, IModel, IModelToken, StandaloneIModelRpcInterface } from "@bentley/imodeljs-common";
import { IModelDb } from "../IModelDb";

/**
 * The backend implementation of StandaloneIModelRpcInterface.
 * @hidden
 */
export class StandaloneIModelRpcImpl extends RpcInterface implements StandaloneIModelRpcInterface {
  public static register() { RpcManager.registerImpl(StandaloneIModelRpcInterface, StandaloneIModelRpcImpl); }

  /** Ask the backend to open a standalone iModel (not managed by iModelHub) from a file name that is resolved by the backend. */
  public async openStandalone(fileName: string, openMode: OpenMode): Promise<IModel> { return IModelDb.openStandalone(fileName, openMode); }

  public async closeStandalone(iModelToken: IModelToken): Promise<boolean> {
    IModelDb.find(iModelToken).closeStandalone();
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }
}
