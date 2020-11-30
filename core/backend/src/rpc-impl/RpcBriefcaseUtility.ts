/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BeDuration, Logger, OpenMode } from "@bentley/bentleyjs-core";
import { BriefcaseProps, IModelConnectionProps, IModelRpcProps, IModelVersion, RpcPendingResponse, SyncMode } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { BriefcaseManager } from "../BriefcaseManager";
import { BriefcaseDb } from "../IModelDb";

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
    Logger.logTrace(loggerCategory, "RpcBriefcaseUtility.openWithTimeout: Received open request", () => ({ ...tokenProps, syncMode }));

    /*
     * Download the briefcase
     * Note: This sets up a race between the specified timeout period and the open. Throws a RpcPendingResponse exception if the
     * timeout happens first.
     */
    const timeout = 1000; // 1 second
    const { contextId, iModelId, changeSetId } = tokenProps;
    const briefcaseProps: BriefcaseProps | void = await BeDuration.race(timeout, BriefcaseManager.download(requestContext, contextId!, iModelId!, { syncMode }, IModelVersion.asOfChangeSet(changeSetId!)));
    requestContext.enter();

    if (briefcaseProps === undefined) {
      Logger.logTrace(loggerCategory, "RpcBriefcaseUtility.openWithTimeout: Issued pending status", () => ({ ...tokenProps, syncMode }));
      throw new RpcPendingResponse();
    }

    /*
     * Open the briefcase
     * Note: This call must be made even if the briefcase is already open - this is to ensure the usage is logged
     */
    const briefcaseDb: BriefcaseDb = await BriefcaseDb.open(requestContext, briefcaseProps.key);
    Logger.logTrace(loggerCategory, "RpcBriefcaseUtility.openWithTimeout: Opened briefcase", () => ({ ...tokenProps, syncMode }));
    return briefcaseDb.getConnectionProps();
  }

  private async logUsage(requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: string, changeSetId: string): Promise<void> {
    // NEEDS_WORK: Move usage logging to the native layer, and make it happen even if not authorized
    if (!(requestContext instanceof AuthorizedClientRequestContext)) {
      Logger.logTrace(loggerCategory, "BriefcaseDb.logUsage: Cannot log usage without appropriate authorization", () => this.getConnectionProps());
      return;
    }

    requestContext.enter();
    const telemetryEvent = new TelemetryEvent(
      "imodeljs-backend - Open iModel",
      "7a6424d1-2114-4e89-b13b-43670a38ccd4", // Feature: "iModel Use"
      contextId,
      iModelId,
      changeSetId,
    );
    IModelHost.telemetry.postTelemetry(requestContext, telemetryEvent); // eslint-disable-line @typescript-eslint/no-floating-promises

    UsageLoggingUtilities.postUserUsage(requestContext, contextId, IModelJsNative.AuthType.OIDC, os.hostname(), IModelJsNative.UsageType.Trial)
      .catch((err) => {
        requestContext.enter();
        Logger.logError(loggerCategory, `Could not log user usage`, () => ({ errorStatus: err.status, errorMessage: err.message, ...this.getConnectionProps() }));
      });
  }

  /** Close the briefcase if necessary */
  public static async close(requestContext: AuthorizedClientRequestContext, tokenProps: IModelRpcProps): Promise<boolean> {
    // Close is a no-op for ReadOnly connections
    if (OpenMode.Readonly === tokenProps.openMode)
      return true;

    // For read-write connections, close the briefcase and delete local copies of it
    const briefcaseDb = BriefcaseDb.findByKey(tokenProps.key);
    briefcaseDb.close();
    await BriefcaseManager.delete(requestContext, tokenProps.key);
    return true;
  }
}
