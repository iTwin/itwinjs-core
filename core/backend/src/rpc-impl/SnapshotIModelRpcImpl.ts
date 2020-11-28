/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { Logger } from "@bentley/bentleyjs-core";
import {
  IModelConnectionProps, IModelNotFoundResponse, IModelRpcProps, RpcInterface, RpcManager, SnapshotIModelRpcInterface,
} from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { SnapshotDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** The backend implementation of SnapshotIModelRpcInterface.
 * @internal
 */
export class SnapshotIModelRpcImpl extends RpcInterface implements SnapshotIModelRpcInterface {
  public static register() { RpcManager.registerImpl(SnapshotIModelRpcInterface, SnapshotIModelRpcImpl); }

  /** Ask the backend to open a snapshot iModel from a file name that is resolved by the backend. */
  public async openFile(filePath: string): Promise<IModelConnectionProps> {
    let resolvedFileName: string | undefined = filePath;
    if (IModelHost.snapshotFileNameResolver) {
      resolvedFileName = IModelHost.snapshotFileNameResolver.tryResolveFileName(filePath);
      if (undefined === resolvedFileName) {
        throw new IModelNotFoundResponse();
      }
    }
    const snapshotDb = SnapshotDb.tryFindByKey(resolvedFileName) ?? SnapshotDb.openFile(resolvedFileName);
    return snapshotDb.getConnectionProps();
  }

  /** Ask the backend to open a snapshot iModel from a key that is resolved by the backend. */
  public async openRemote(fileKey: string): Promise<IModelConnectionProps> {
    const resolvedFileName = IModelHost.snapshotFileNameResolver?.resolveKey(fileKey);

    if (undefined === resolvedFileName)
      throw new IModelNotFoundResponse();

    const snapshotDb = SnapshotDb.tryFindByKey(resolvedFileName) ?? SnapshotDb.openFile(resolvedFileName);
    return snapshotDb.getConnectionProps();
  }

  /** Ask the backend to close a snapshot iModel. */
  public async close(tokenProps: IModelRpcProps): Promise<boolean> {
    const snapshotFilePath = tokenProps.key;
    const snapshotDb = SnapshotDb.tryFindByKey(snapshotFilePath);
    if (undefined === snapshotDb) {
      Logger.logError(loggerCategory, "SnapshotDb was not open", () => snapshotFilePath);
      throw new IModelNotFoundResponse();
    }
    snapshotDb.close();
    return true;
  }
}
