/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BeDuration, Logger, OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnectionProps, IModelRpcProps, RpcPendingResponse, SyncMode } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { BriefcaseManager } from "../BriefcaseManager";
import { CheckpointProps, V1CheckpointManager } from "../CheckpointManager";
import { BriefcaseDb, IModelDb, SnapshotDb } from "../IModelDb";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/**
 * Utility to open the iModel for Read/Write RPC interfaces
 * @internal
 */
export class RpcBriefcaseUtility {

  /**
   * Download and open checkpoint, ensuring the operation completes within a default timeout. If the time to open exceeds the timeout period,
   * a RpcPendingResponse exception is thrown
   * @param requestContext
   * @param tokenProps
   * @param syncMode
   */
  public static async open(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcProps, syncMode: SyncMode, timeout: number = 1000): Promise<IModelDb> {
    requestContext.enter();
    Logger.logTrace(loggerCategory, "RpcBriefcaseUtility.openWithTimeout", () => ({ ...tokenProps, syncMode }));

    BriefcaseManager.logUsage(requestContext, tokenProps);

    // if (syncMode === SyncMode.PullOnly || syncMode === SyncMode.PullAndPush) {
    //   return BriefcaseDb.openBriefcase(requestContext, {

    //   })
    //   return BriefcaseManager.openWithTimeout();
    // }
    const checkpoint: CheckpointProps = {
      iModelId: tokenProps.iModelId!,
      contextId: tokenProps.contextId!,
      changeSetId: tokenProps.changeSetId!,
      requestContext,
    };

    // first try v2 checkpoint
    try {
      const db = await SnapshotDb.openCheckpointV2(checkpoint);
      Logger.logTrace(loggerCategory, "using V2 checkpoint briefcase", () => ({ ...tokenProps }));
      return db;
    } catch (e) {
      // this isn't a v2 checkpoint
    }
    /*
     * open or return an already opened V1 checkpoint, potentially downloading it if it isn't already local.
     * Note: This sets up a race between the specified timeout period and the open. Throws a RpcPendingResponse exception if the
     * timeout happens first.
     */
    const checkpointDb = await BeDuration.race(timeout, V1CheckpointManager.getCheckpointDb({ checkpoint, localFile: V1CheckpointManager.getFileName(checkpoint) }));
    requestContext.enter();

    if (checkpointDb === undefined) {
      Logger.logTrace(loggerCategory, "RpcBriefcaseUtility.openWithTimeout: Issued pending status", () => ({ ...tokenProps }));
      throw new RpcPendingResponse();
    }

    Logger.logTrace(loggerCategory, "RpcBriefcaseUtility.openWithTimeout: Opened briefcase", () => ({ ...tokenProps }));
    return checkpointDb;
  }

  public static async openWithTimeout(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcProps, syncMode: SyncMode, timeout: number = 1000): Promise<IModelConnectionProps> {
    return (await this.open(requestContext, tokenProps, syncMode, timeout)).toJSON();
  }

  /** Close the briefcase if necessary */
  public static async close(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcProps): Promise<boolean> {
    // Close is a no-op for ReadOnly connections
    if (OpenMode.Readonly === tokenProps.openMode)
      return true;

    // For read-write connections, close the briefcase and delete local copies of it
    const briefcaseDb = BriefcaseDb.findByKey(tokenProps.key);
    const fileName = briefcaseDb.pathName;
    briefcaseDb.close();
    await BriefcaseManager.deleteBriefcase(requestContext, fileName);
    return true;
  }
}
