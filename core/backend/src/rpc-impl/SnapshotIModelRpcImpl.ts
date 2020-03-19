/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { Logger } from "@bentley/bentleyjs-core";
import { IModelNotFoundResponse, IModelProps, IModelToken, IModelTokenProps, RpcInterface, RpcManager, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { SnapshotIModelDb } from "../IModelDb";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** The backend implementation of SnapshotIModelRpcInterface.
 * @internal
 */
export class SnapshotIModelRpcImpl extends RpcInterface implements SnapshotIModelRpcInterface {
  public static register() { RpcManager.registerImpl(SnapshotIModelRpcInterface, SnapshotIModelRpcImpl); }

  /** Ask the backend to open a snapshot iModel (not managed by iModelHub) from a file name that is resolved by the backend. */
  public async openSnapshot(filePath: string): Promise<IModelProps> {
    let snapshotDb: SnapshotIModelDb | undefined = SnapshotIModelDb.tryFindByPath(filePath);
    if (undefined === snapshotDb) {
      snapshotDb = SnapshotIModelDb.open(filePath);
    }
    return snapshotDb.toJSON();
  }

  /** Ask the backend to close a snapshot iModel. */
  public async closeSnapshot(tokenProps: IModelTokenProps): Promise<boolean> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const snapshotFilePath = iModelToken.key!;
    const snapshotDb = SnapshotIModelDb.tryFindByPath(snapshotFilePath);
    if (undefined === snapshotDb) {
      Logger.logError(loggerCategory, "SnapshotIModelDb not found in the in-memory cache", () => snapshotFilePath);
      throw new IModelNotFoundResponse();
    }
    snapshotDb.close();
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }
}
