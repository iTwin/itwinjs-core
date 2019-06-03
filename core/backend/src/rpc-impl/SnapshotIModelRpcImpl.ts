/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface, RpcManager, IModelProps, SnapshotIModelRpcInterface, IModelToken, IModelTokenProps } from "@bentley/imodeljs-common";
import { IModelDb } from "../IModelDb";

/** The backend implementation of SnapshotIModelRpcInterface.
 * @internal
 */
export class SnapshotIModelRpcImpl extends RpcInterface implements SnapshotIModelRpcInterface {
  public static register() { RpcManager.registerImpl(SnapshotIModelRpcInterface, SnapshotIModelRpcImpl); }

  /** Ask the backend to open a standalone iModel (not managed by iModelHub) from a file name that is resolved by the backend. */
  public async openSnapshot(fileName: string): Promise<IModelProps> { return IModelDb.openSnapshot(fileName).toJSON(); }

  public async closeSnapshot(tokenProps: IModelTokenProps): Promise<boolean> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    IModelDb.find(iModelToken).closeSnapshot();
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }
}
