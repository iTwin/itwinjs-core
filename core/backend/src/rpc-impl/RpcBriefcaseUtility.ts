/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { Logger, PerfLogger, BeDuration, OpenMode } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BriefcaseProps, IModelVersion, IModelRpcProps, SyncMode, IModelConnectionProps, RpcPendingResponse } from "@bentley/imodeljs-common";
import { BriefcaseManager } from "../BriefcaseManager";
import { BriefcaseDb } from "../IModelDb";
import { BackendLoggerCategory } from "../BackendLoggerCategory";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/**
 * Utility to open the iModel for Read/Write RPC interfaces
 * @internal
 */
export class RpcBriefcaseUtility {

  // Download and open the iModel
  private static async open(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcProps, syncMode: SyncMode): Promise<BriefcaseDb> {
    requestContext.enter();
    const { contextId, iModelId, changeSetId } = tokenProps;

    const perfLogger = new PerfLogger("Opening iModel", () => ({ contextId, iModelId, syncMode }));

    let briefcaseDb: BriefcaseDb;
    try {
      const briefcaseProps: BriefcaseProps = await BriefcaseManager.download(requestContext, contextId!, iModelId!, { syncMode }, IModelVersion.asOfChangeSet(changeSetId!));
      requestContext.enter();

      briefcaseDb = await BriefcaseDb.open(requestContext, briefcaseProps.key);
      requestContext.enter();
    } catch (error) {
      requestContext.enter();
      Logger.logError(loggerCategory, "Failed opening iModel", () => ({ ...tokenProps, syncMode }));
      throw error;
    }

    perfLogger.dispose();
    return briefcaseDb;
  }

  /**
   * Download and open a briefcase, ensuring the operation completes within a default timeout. If the time to open exceeds the timeout period,
   * a RpcPendingResponse exception is thrown
   * @param requestContext
   * @param tokenProps
   * @param syncMode
   */
  public static async openWithTimeout(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcProps, syncMode: SyncMode): Promise<IModelConnectionProps> {
    requestContext.enter();

    /* Sets up a race between the specified timeout period and the open. Throws a RpcPendingResponse exception if the
     * timeout happens first. If timeout is undefined, simply waits for the open to complete. */

    const timeout = 1000; // 1 second
    let db: BriefcaseDb | undefined;
    const finishOpen = async (locRequestContext: AuthorizedClientRequestContext): Promise<void> => {
      locRequestContext.enter();
      db = await RpcBriefcaseUtility.open(locRequestContext, tokenProps, syncMode);
    };

    await BeDuration.race(timeout, finishOpen(requestContext));
    requestContext.enter();

    if (db === undefined) {
      Logger.logTrace(loggerCategory, "Issuing pending status in BriefcaseOpenUtility.openWithTimeout", () => ({ ...tokenProps, syncMode }));
      throw new RpcPendingResponse();
    }

    return db.getConnectionProps();
  }

  /** Close the briefcase if necessary */
  public static async close(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcProps): Promise<boolean> {
    // Close is a no-op for ReadOnly connections
    if (OpenMode.Readonly === tokenProps.openMode)
      return Promise.resolve(true);

    // For read-write connections, close the briefcase and delete local copies of it
    const briefcaseDb = BriefcaseDb.findByKey(tokenProps.key);
    briefcaseDb.close();
    await BriefcaseManager.delete(requestContext, tokenProps.key);
    return true;
  }
}
