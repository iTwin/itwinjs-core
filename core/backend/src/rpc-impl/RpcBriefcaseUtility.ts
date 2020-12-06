/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BeDuration, Logger, OpenMode } from "@bentley/bentleyjs-core";
import { BriefcaseQuery } from "@bentley/imodelhub-client";
import { IModelConnectionProps, IModelRpcProps, RpcPendingResponse, SyncMode } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { BriefcaseManager, RequestNewBriefcaseArg } from "../BriefcaseManager";
import { CheckpointProps, V1CheckpointManager } from "../CheckpointManager";
import { BriefcaseDb, IModelDb, SnapshotDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";
import { IModelJsFs } from "../IModelJsFs";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/**
 * Utility to open the iModel for Read/Write RPC interfaces
 * @internal
 */
export class RpcBriefcaseUtility {

  private static async downloadAndOpen(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcProps, syncMode: SyncMode): Promise<BriefcaseDb> {
    const iModelId = tokenProps.iModelId!;
    const myBriefcaseIds: number[] = [];
    if (syncMode === SyncMode.PullOnly) {
      myBriefcaseIds.push(0); // PullOnly means briefcaseId 0
    } else {
      // check with iModelHub and see if we already have acquired any briefcaseIds
      const myHubBriefcases = await IModelHost.iModelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().ownedByMe().selectDownloadUrl());
      for (const hubBc of myHubBriefcases)
        myBriefcaseIds.push(hubBc.briefcaseId!); // save the list of briefcaseIds we already own.
    }

    // see if we can open any of the briefcaseIds we already acquired from iModelHub
    for (const briefcaseId of myBriefcaseIds) {
      const fileName = BriefcaseManager.getFileName({ briefcaseId, iModelId });
      if (IModelJsFs.existsSync(fileName)) {
        try {
          return await BriefcaseDb.open(requestContext, { fileName, readonly: briefcaseId === 0 });
        } catch (error) {
          // somehow we have this briefcaseId and the file exists, but we can't open it. Delete it.
          IModelJsFs.removeSync(fileName);
        }
      }
    }

    // no local briefcase available. Download one and open it.
    const request: RequestNewBriefcaseArg = {
      contextId: tokenProps.contextId!,
      iModelId,
      briefcaseId: myBriefcaseIds.length > 0 ? myBriefcaseIds[0] : undefined, // if briefcaseId is undefined, we'll acquire a new one.
    };

    await BriefcaseManager.downloadBriefcase(requestContext, request);
    return BriefcaseDb.open(requestContext, { fileName: request.fileName!, readonly: syncMode === SyncMode.PullOnly });
  };

  private static _briefcasePromise: Promise<BriefcaseDb> | undefined;
  private static async openBriefcase(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcProps, syncMode: SyncMode): Promise<BriefcaseDb> {
    if (this._briefcasePromise)
      return this._briefcasePromise;

    try {
      this._briefcasePromise = this.downloadAndOpen(requestContext, tokenProps, syncMode); // save the fact that we're working on downloading so if we timeout, we'll reuse this request.
      return await this._briefcasePromise;
    } finally {
      this._briefcasePromise = undefined;  // the download and open is now done
    }
  }

  /**
   * Download and open checkpoint, ensuring the operation completes within a default timeout. If the time to open exceeds the timeout period,
   * a RpcPendingResponse exception is thrown
   * @param requestContext
   * @param tokenProps
   * @param syncMode
   */
  public static async open(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcProps, syncMode: SyncMode, timeout: number = 1000): Promise<IModelDb> {
    requestContext.enter();
    Logger.logTrace(loggerCategory, "RpcBriefcaseUtility.open", () => ({ ...tokenProps, syncMode }));

    if (syncMode === SyncMode.PullOnly || syncMode === SyncMode.PullAndPush) {
      // eslint-disable-next-line deprecation/deprecation
      const briefcaseDb = await BeDuration.race(timeout, this.openBriefcase(requestContext, tokenProps, syncMode));
      requestContext.enter();

      if (briefcaseDb === undefined) {
        Logger.logTrace(loggerCategory, "Open briefcase - pending", () => ({ ...tokenProps }));
        throw new RpcPendingResponse();
      }
      // note: usage is logged in BriefcaseManager.downloadNewBriefcaseAndOpen
      return briefcaseDb;
    }

    const checkpoint: CheckpointProps = {
      iModelId: tokenProps.iModelId!,
      contextId: tokenProps.contextId!,
      changeSetId: tokenProps.changeSetId!,
      requestContext,
    };

    // opening a checkpoint, readonly.
    let db: SnapshotDb | void;
    try {
      // first try V2 checkpoint
      db = await SnapshotDb.openCheckpointV2(checkpoint);
      requestContext.enter();
      Logger.logTrace(loggerCategory, "using V2 checkpoint briefcase", () => ({ ...tokenProps }));
    } catch (e) {
      // this isn't a v2 checkpoint. Set up a race between the specified timeout period and the open. Throw an RpcPendingResponse exception if the timeout happens first.
      db = await BeDuration.race(timeout, V1CheckpointManager.getCheckpointDb({ checkpoint, localFile: V1CheckpointManager.getFileName(checkpoint) }));
      requestContext.enter();

      if (db === undefined) {
        Logger.logTrace(loggerCategory, "Open V1 checkpoint - pending", () => ({ ...tokenProps }));
        throw new RpcPendingResponse();
      }
      Logger.logTrace(loggerCategory, "Opened V1 checkpoint", () => ({ ...tokenProps }));
    }

    BriefcaseManager.logUsage(requestContext, tokenProps);
    return db;
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
