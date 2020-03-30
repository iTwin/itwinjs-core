/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { Logger } from "@bentley/bentleyjs-core";
import { IModelNotFoundResponse, IModelConnectionProps, IModelRpcProps, RpcInterface, RpcManager, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { SnapshotDb } from "../IModelDb";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** The backend implementation of SnapshotIModelRpcInterface.
 * @internal
 */
export class SnapshotIModelRpcImpl extends RpcInterface implements SnapshotIModelRpcInterface {
  public static register() { RpcManager.registerImpl(SnapshotIModelRpcInterface, SnapshotIModelRpcImpl); }

  /** Ask the backend to open a snapshot iModel (not managed by iModelHub) from a file name that is resolved by the backend. */
  public async openSnapshot(filePath: string): Promise<IModelConnectionProps> {
    let snapshotDb: SnapshotDb | undefined = SnapshotDb.tryFindByKey(filePath);
    if (undefined === snapshotDb) {
      snapshotDb = SnapshotDb.openFile(filePath);
    }
    return snapshotDb.getConnectionProps();
  }

  /** Ask the backend to close a snapshot iModel. */
  public async closeSnapshot(tokenProps: IModelRpcProps): Promise<boolean> {
    const snapshotFilePath = tokenProps.key;
    const snapshotDb = SnapshotDb.tryFindByKey(snapshotFilePath);
    if (undefined === snapshotDb) {
      Logger.logError(loggerCategory, "SnapshotDb not found in the in-memory cache", () => snapshotFilePath);
      throw new IModelNotFoundResponse();
    }
    snapshotDb.close();
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }
}
