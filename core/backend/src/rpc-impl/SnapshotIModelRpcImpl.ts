/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import {
  IModelConnectionProps, IModelNotFoundResponse, IModelRpcProps, RpcInterface, RpcManager, SnapshotIModelRpcInterface, SnapshotOpenOptions,
} from "@itwin/core-common";
import { SnapshotDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";

/* eslint-disable @typescript-eslint/no-deprecated */

/** The backend implementation of SnapshotIModelRpcInterface.
 * @internal
 * @deprecated in 5.0 - will not be removed until after 2026-06-13. Check [[IpcAppFunctions]] for replacements.
 */
export class SnapshotIModelRpcImpl extends RpcInterface implements SnapshotIModelRpcInterface {
  public static register() { RpcManager.registerImpl(SnapshotIModelRpcInterface, SnapshotIModelRpcImpl); }

  /** Ask the backend to open a snapshot iModel from a file name that is resolved by the backend. */
  public async openFile(filePath: string, opts?: SnapshotOpenOptions): Promise<IModelConnectionProps> {
    let resolvedFileName: string | undefined = filePath;
    if (IModelHost.snapshotFileNameResolver) {
      resolvedFileName = IModelHost.snapshotFileNameResolver.tryResolveFileName(filePath);
      if (undefined === resolvedFileName)
        throw new IModelNotFoundResponse(); // eslint-disable-line @typescript-eslint/only-throw-error
    }
    return SnapshotDb.openFile(resolvedFileName, opts).getConnectionProps();
  }

  /** Ask the backend to open a snapshot iModel from a key that is resolved by the backend. */
  public async openRemote(fileKey: string, opts?: SnapshotOpenOptions): Promise<IModelConnectionProps> {
    const resolvedFileName = IModelHost.snapshotFileNameResolver?.resolveKey(fileKey);
    if (undefined === resolvedFileName)
      throw new IModelNotFoundResponse(); // eslint-disable-line @typescript-eslint/only-throw-error

    return SnapshotDb.openFile(resolvedFileName, { key: fileKey, ...opts }).getConnectionProps();
  }

  /** Ask the backend to close a snapshot iModel. */
  public async close(tokenProps: IModelRpcProps): Promise<boolean> {
    SnapshotDb.findByKey(tokenProps.key).close();
    return true;
  }
}
