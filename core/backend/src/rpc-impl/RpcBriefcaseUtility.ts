/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BeDuration, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import {
  BriefcaseProps, IModelConnectionProps, IModelRpcOpenProps, IModelRpcProps, IModelVersion, RpcPendingResponse, SyncMode,
} from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { BriefcaseManager, RequestNewBriefcaseArg } from "../BriefcaseManager";
import { CheckpointManager, CheckpointProps, V1CheckpointManager } from "../CheckpointManager";
import { BriefcaseDb, IModelDb, SnapshotDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";
import { IModelJsFs } from "../IModelJsFs";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** @internal */
export interface DownloadAndOpenArgs {
  user?: AuthorizedClientRequestContext;
  tokenProps: IModelRpcOpenProps;
  syncMode: SyncMode;
  fileNameResolvers?: ((arg: BriefcaseProps) => string)[];
  timeout?: number;
  forceDownload?: boolean;
}
/**
 * Utility to open the iModel for Read/Write RPC interfaces
 * @internal
 */
export class RpcBriefcaseUtility {

  private static async downloadAndOpen(args: DownloadAndOpenArgs): Promise<BriefcaseDb> {
    const { user, tokenProps } = args;
    const iModelId = tokenProps.iModelId!;
    let myBriefcaseIds: number[];
    if (args.syncMode === SyncMode.PullOnly) {
      myBriefcaseIds = [0]; // PullOnly means briefcaseId 0
    } else {
      // check with iModelHub and see if we already have acquired any briefcaseIds
      myBriefcaseIds = await IModelHost.hubAccess.getMyBriefcaseIds({ user, iModelId });
    }

    const resolvers = args.fileNameResolvers ?? [(arg) => BriefcaseManager.getFileName(arg)];

    // see if we can open any of the briefcaseIds we already acquired from iModelHub
    if (resolvers) {
      for (const resolver of resolvers) {
        for (const briefcaseId of myBriefcaseIds) {
          const fileName = resolver({ briefcaseId, iModelId });
          if (IModelJsFs.existsSync(fileName)) {
            const briefcaseDb = BriefcaseDb.findByFilename(fileName);
            if (briefcaseDb !== undefined)
              return briefcaseDb as BriefcaseDb;
            try {
              if (args.forceDownload)
                throw new Error(); // causes delete below
              const db = await BriefcaseDb.open({ user, fileName });
              if (db.changeset.id !== tokenProps.changeset?.id) {
                const toIndex = tokenProps.changeset?.index ??
                  (await IModelHost.hubAccess.getChangesetFromVersion({ user, iModelId, version: IModelVersion.asOfChangeSet(tokenProps.changeset!.id) })).index;
                await BriefcaseManager.pullAndApplyChangesets(db, { user, toIndex });
              }
              return db;
            } catch (error: any) {
              if (!(error.errorNumber === IModelStatus.AlreadyOpen))
                // somehow we have this briefcaseId and the file exists, but we can't open it. Delete it.
                await BriefcaseManager.deleteBriefcaseFiles(fileName, args.user);
            }
          }
        }
      }
    }

    // no local briefcase available. Download one and open it.
    const request: RequestNewBriefcaseArg = {
      user,
      iTwinId: tokenProps.iTwinId!,
      iModelId,
      briefcaseId: args.syncMode === SyncMode.PullOnly ? 0 : undefined, // if briefcaseId is undefined, we'll acquire a new one.
    };

    const props = await BriefcaseManager.downloadBriefcase(request);
    return BriefcaseDb.open({ user, fileName: props.fileName });
  }

  private static _briefcasePromise: Promise<BriefcaseDb> | undefined;
  private static async openBriefcase(args: DownloadAndOpenArgs): Promise<BriefcaseDb> {
    if (this._briefcasePromise)
      return this._briefcasePromise;

    try {
      this._briefcasePromise = this.downloadAndOpen(args); // save the fact that we're working on downloading so if we timeout, we'll reuse this request.
      return await this._briefcasePromise;
    } finally {
      this._briefcasePromise = undefined;  // the download and open is now done
    }
  }

  public static async findOrOpen(user: AuthorizedClientRequestContext, iModel: IModelRpcProps, syncMode: SyncMode): Promise<IModelDb> {
    const iModelDb = IModelDb.tryFindByKey(iModel.key);
    if (undefined === iModelDb)
      return this.open({ user, tokenProps: iModel, syncMode, timeout: 1000 });

    await iModelDb.reattachDaemon(user);
    return iModelDb;
  }

  /**
   * Download and open a checkpoint or briefcase, ensuring the operation completes within a default timeout. If the time to open exceeds the timeout period,
   * a RpcPendingResponse exception is thrown
   */
  public static async open(args: DownloadAndOpenArgs): Promise<IModelDb> {
    const { user, tokenProps, syncMode } = args;
    Logger.logTrace(loggerCategory, "RpcBriefcaseUtility.open", () => ({ ...tokenProps }));

    const timeout = args.timeout ?? 1000;
    if (syncMode === SyncMode.PullOnly || syncMode === SyncMode.PullAndPush) {
      const briefcaseDb = await BeDuration.race(timeout, this.openBriefcase(args));

      if (briefcaseDb === undefined) {
        Logger.logTrace(loggerCategory, "Open briefcase - pending", () => ({ ...tokenProps }));
        throw new RpcPendingResponse();
      }
      // note: usage is logged in BriefcaseManager.downloadNewBriefcaseAndOpen
      return briefcaseDb;
    }

    const checkpoint: CheckpointProps = {
      iModelId: tokenProps.iModelId!,
      iTwinId: tokenProps.iTwinId!,
      changeset: tokenProps.changeset!,
      user,
    };

    // opening a checkpoint, readonly.
    let db: SnapshotDb | void;
    // first check if it's already open
    db = SnapshotDb.tryFindByKey(CheckpointManager.getKey(checkpoint));
    if (db) {
      Logger.logTrace(loggerCategory, "Checkpoint was already open", () => ({ ...tokenProps }));
      BriefcaseManager.logUsage(user, db);
      return db;
    }

    try {
      // now try V2 checkpoint
      db = await SnapshotDb.openCheckpointV2(checkpoint);
      Logger.logTrace(loggerCategory, "using V2 checkpoint briefcase", () => ({ ...tokenProps }));
    } catch (e) {
      Logger.logTrace(loggerCategory, "unable to open V2 checkpoint - falling back to V1 checkpoint", () => ({ ...tokenProps }));

      // this isn't a v2 checkpoint. Set up a race between the specified timeout period and the open. Throw an RpcPendingResponse exception if the timeout happens first.
      const request = {
        checkpoint,
        localFile: V1CheckpointManager.getFileName(checkpoint),
        aliasFiles: [],
      };
      db = await BeDuration.race(timeout, V1CheckpointManager.getCheckpointDb(request));

      if (db === undefined) {
        Logger.logTrace(loggerCategory, "Open V1 checkpoint - pending", () => ({ ...tokenProps }));
        throw new RpcPendingResponse();
      }
      Logger.logTrace(loggerCategory, "Opened V1 checkpoint", () => ({ ...tokenProps }));
    }

    BriefcaseManager.logUsage(user, db);
    return db;
  }

  public static async openWithTimeout(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcOpenProps, syncMode: SyncMode, timeout: number = 1000): Promise<IModelConnectionProps> {
    return (await this.open({ user: requestContext, tokenProps, syncMode, timeout })).toJSON();
  }

}
