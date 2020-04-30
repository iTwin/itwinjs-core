/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { Logger, BeDuration, OpenMode } from "@bentley/bentleyjs-core";
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
    const { contextId, iModelId, changeSetId } = tokenProps;
    const briefcaseProps: BriefcaseProps | void = await BeDuration.race(timeout, BriefcaseManager.download(requestContext, contextId!, iModelId!, { syncMode }, IModelVersion.asOfChangeSet(changeSetId!)));
    requestContext.enter();

    if (briefcaseProps === undefined) {
      Logger.logTrace(loggerCategory, "Issuing pending status in BriefcaseOpenUtility.openWithTimeout", () => ({ ...tokenProps, syncMode }));
      throw new RpcPendingResponse();
    }

    // Find existing or open a new briefcase
    let briefcaseDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(briefcaseProps.key);
    if (briefcaseDb === undefined)
      briefcaseDb = await BriefcaseDb.open(requestContext, briefcaseProps.key);
    return briefcaseDb.getConnectionProps();
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
