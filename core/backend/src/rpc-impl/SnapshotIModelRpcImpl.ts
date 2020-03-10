/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { IModelProps, IModelToken, IModelTokenProps, RpcInterface, RpcManager, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import { SnapshotIModelDb } from "../IModelDb";

/** The backend implementation of SnapshotIModelRpcInterface.
 * @internal
 */
export class SnapshotIModelRpcImpl extends RpcInterface implements SnapshotIModelRpcInterface {
  public static register() { RpcManager.registerImpl(SnapshotIModelRpcInterface, SnapshotIModelRpcImpl); }

  /** Ask the backend to open a standalone iModel (not managed by iModelHub) from a file name that is resolved by the backend. */
  public async openSnapshot(fileName: string): Promise<IModelProps> { return SnapshotIModelDb.open(fileName).toJSON(); }

  public async closeSnapshot(tokenProps: IModelTokenProps): Promise<boolean> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    SnapshotIModelDb.find(iModelToken).close();
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }
}
