/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { BentleyError, BentleyStatus, GuidString, Logger } from "@itwin/core-bentley";
import {
  IModelConnectionProps, IModelError, IModelReadRpcInterface, IModelRpcOpenProps, IModelVersion, RpcManager, RpcNotFoundResponse, RpcOperation,
  RpcRequest, RpcRequestEvent,
} from "@itwin/core-common";
import { FrontendLoggerCategory } from "./common/FrontendLoggerCategory";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { IModelRoutingContext } from "./IModelRoutingContext";
import { IpcApp } from "./IpcApp";

const loggerCategory = FrontendLoggerCategory.IModelConnection;

/**
 * An IModelConnection to a Checkpoint of an iModel.
 * @see [CheckpointConnection]($docs/learning/frontend/IModelConnection)
 * @public
 */
export class CheckpointConnection extends IModelConnection {
  private readonly _fromIpc: boolean;

  /** The Guid that identifies the iTwin that owns this iModel. */
  public override get iTwinId(): GuidString { return super.iTwinId!; }
  /** The Guid that identifies this iModel. */
  public override get iModelId(): GuidString { return super.iModelId!; }

  /** Returns `true` if [[close]] has already been called. */
  public get isClosed(): boolean { return this._isClosed ? true : false; }
  protected _isClosed?: boolean;

  protected constructor(props: IModelConnectionProps, fromIpc: boolean) {
    super(props);
    this._fromIpc = fromIpc;
  }

  /** Type guard for instanceof [[CheckpointConnection]] */
  public override isCheckpointConnection(): this is CheckpointConnection { return true; }

  /**
   * Open a readonly IModelConnection to a Checkpoint of an iModel.
   */
  public static async openRemote(iTwinId: GuidString, iModelId: GuidString, version = IModelVersion.latest()): Promise<CheckpointConnection> {
    if (undefined === IModelApp.hubAccess)
      throw new Error("Missing an implementation of IModelApp.hubAccess");

    const accessToken = await IModelApp.getAccessToken();
    const changeset = await IModelApp.hubAccess.getChangesetFromVersion({ accessToken, iModelId, version });

    let connection: CheckpointConnection;
    const iModelProps = { iTwinId, iModelId, changeset };
    if (IpcApp.isValid) {
      connection = new this(await IpcApp.appFunctionIpc.openCheckpoint(iModelProps), true);
    } else {
      const routingContext = IModelRoutingContext.current || IModelRoutingContext.default;
      connection = new this(await this.callOpen(iModelProps, routingContext), false);
      RpcManager.setIModel(connection);
      connection.routingContext = routingContext;
      RpcRequest.notFoundHandlers.addListener(connection._reopenConnectionHandler);
    }

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

    const removeListener = RpcRequest.events.addListener((type: RpcRequestEvent, request: RpcRequest) => { // eslint-disable-line deprecation/deprecation
      if (type !== RpcRequestEvent.PendingUpdateReceived) // eslint-disable-line deprecation/deprecation
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

  private _reopenConnectionHandler = async (request: RpcRequest<RpcNotFoundResponse>, response: any, resubmit: () => void, reject: (reason: any) => void) => { // eslint-disable-line deprecation/deprecation
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
    if (this._fromIpc)
      await IpcApp.appFunctionIpc.closeIModel(this._fileKey);
    else
      RpcRequest.notFoundHandlers.removeListener(this._reopenConnectionHandler);

    this._isClosed = true;
  }
}
