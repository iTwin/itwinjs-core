/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import type { GuidString} from "@itwin/core-bentley";
import { BentleyError, BentleyStatus, Logger } from "@itwin/core-bentley";
import type {
  IModelConnectionProps, IModelRpcOpenProps, RpcNotFoundResponse} from "@itwin/core-common";
import { IModelError, IModelReadRpcInterface, IModelVersion, RpcManager, RpcOperation,
  RpcRequest, RpcRequestEvent,
} from "@itwin/core-common";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { IModelRoutingContext } from "./IModelRoutingContext";

const loggerCategory = FrontendLoggerCategory.IModelConnection;

/**
 * An IModelConnection to a checkpoint of an iModel, hosted on a remote backend over RPC.
 * Due to the nature of RPC requests, the backend servicing this connection may change over time, and there may even be more than one backend
 * at servicing requests at the same time. For this reason, this type of connection may only be used with Checkpoint iModels that are
 * guaranteed to be the same on every backend. Obviously Checkpoint iModels only allow readonly access.
 * @public
 */
export class CheckpointConnection extends IModelConnection {
  /** The Guid that identifies the iTwin that owns this iModel. */
  public override get iTwinId(): GuidString { return super.iTwinId!; }
  /** The Guid that identifies this iModel. */
  public override get iModelId(): GuidString { return super.iModelId!; }

  /** Returns `true` if [[close]] has already been called. */
  public get isClosed(): boolean { return this._isClosed ? true : false; }
  protected _isClosed?: boolean;

  /** Type guard for instanceof [[CheckpointConnection]] */
  public override isCheckpointConnection(): this is CheckpointConnection { return true; }

  /**
   * Open a readonly IModelConnection to an iModel over RPC.
   */
  public static async openRemote(iTwinId: string, iModelId: string, version: IModelVersion = IModelVersion.latest()): Promise<CheckpointConnection> {
    const routingContext = IModelRoutingContext.current || IModelRoutingContext.default;
    const accessToken = await IModelApp.getAccessToken();

    if (undefined === IModelApp.hubAccess)
      throw new Error("Missing an implementation of FrontendHubAccess on IModelApp, it is required to open a remote iModel Connection. Please provide an implementation to the IModelApp.startup using IModelAppOptions.hubAccess.");

    const changeset = await IModelApp.hubAccess.getChangesetFromVersion({ accessToken, iModelId, version });

    const iModelRpcProps: IModelRpcOpenProps = { iTwinId, iModelId, changeset };
    const openResponse = await this.callOpen(iModelRpcProps, routingContext);

    const connection = new this(openResponse);
    RpcManager.setIModel(connection);
    connection.routingContext = routingContext;
    RpcRequest.notFoundHandlers.addListener(connection._reopenConnectionHandler);

    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  private static async callOpen(iModelToken: IModelRpcOpenProps, routingContext: IModelRoutingContext): Promise<IModelConnectionProps> {
    // Try opening the iModel repeatedly accommodating any pending responses from the backend.
    // Waits for an increasing amount of time (but within a range) before checking on the pending request again.
    const connectionRetryIntervalRange = { min: 100, max: 5000 }; // in milliseconds
    let connectionRetryInterval = Math.min(connectionRetryIntervalRange.min, IModelConnection.connectionTimeout);

    const openForReadOperation = RpcOperation.lookup(IModelReadRpcInterface, "getConnectionProps");
    if (!openForReadOperation)
      throw new IModelError(BentleyStatus.ERROR, "IModelReadRpcInterface.getConnectionProps() is not available");
    openForReadOperation.policy.retryInterval = () => connectionRetryInterval;

    Logger.logTrace(loggerCategory, `IModelConnection.open`, iModelToken);
    const startTime = Date.now();

    const removeListener = RpcRequest.events.addListener((type: RpcRequestEvent, request: RpcRequest) => {
      if (type !== RpcRequestEvent.PendingUpdateReceived)
        return;
      if (!(openForReadOperation && request.operation === openForReadOperation))
        return;

      Logger.logTrace(loggerCategory, "Received pending open notification in IModelConnection.open", iModelToken);

      const connectionTimeElapsed = Date.now() - startTime;
      if (connectionTimeElapsed > IModelConnection.connectionTimeout) {
        Logger.logError(loggerCategory, `Timed out opening connection in IModelConnection.open (took longer than ${IModelConnection.connectionTimeout} milliseconds)`, iModelToken);
        throw new IModelError(BentleyStatus.ERROR, "Opening a connection was timed out"); // NEEDS_WORK: More specific error status
      }

      connectionRetryInterval = Math.min(connectionRetryIntervalRange.max, connectionRetryInterval * 2, IModelConnection.connectionTimeout - connectionTimeElapsed);
      if (request.retryInterval !== connectionRetryInterval) {
        request.retryInterval = connectionRetryInterval;
        Logger.logTrace(loggerCategory, `Adjusted open connection retry interval to ${request.retryInterval} milliseconds in IModelConnection.open`, iModelToken);
      }
    });

    const openPromise = IModelReadRpcInterface.getClientForRouting(routingContext.token).getConnectionProps(iModelToken);
    let openResponse: IModelConnectionProps;
    try {
      openResponse = await openPromise;
    } finally {
      Logger.logTrace(loggerCategory, "Completed open request in IModelConnection.open", iModelToken);
      removeListener();
    }

    return openResponse;
  }

  private _reopenConnectionHandler = async (request: RpcRequest<RpcNotFoundResponse>, response: any, resubmit: () => void, reject: (reason: any) => void) => {
    if (!response.hasOwnProperty("isIModelNotFoundResponse"))
      return;

    const iModelRpcProps = request.parameters[0];
    if (this._fileKey !== iModelRpcProps.key)
      return; // The handler is called for a different connection than this

    Logger.logTrace(loggerCategory, "Attempting to reopen connection", () => iModelRpcProps);

    try {
      const openResponse = await CheckpointConnection.callOpen(iModelRpcProps, this.routingContext);
      // The new/reopened connection may have a new rpcKey and/or changesetId, but the other IModelRpcTokenProps should be the same
      this._fileKey = openResponse.key;
      this.changeset = openResponse.changeset!;

    } catch (error) {
      reject(BentleyError.getErrorMessage(error));
    } finally {
    }

    Logger.logTrace(loggerCategory, "Resubmitting original request after reopening connection", iModelRpcProps);
    request.parameters[0] = this.getRpcProps(); // Modify the token of the original request before resubmitting it.
    resubmit();
  };

  /** Close this CheckpointConnection */
  public async close(): Promise<void> {
    if (this.isClosed)
      return;

    this.beforeClose();
    RpcRequest.notFoundHandlers.removeListener(this._reopenConnectionHandler);
    this._isClosed = true;
  }
}
