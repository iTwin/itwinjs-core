/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { GuidString, Logger, OpenMode } from "@bentley/bentleyjs-core";
import {
  AxisAlignedBox3d, BentleyStatus, IModelConnectionProps, IModelError, IModelReadRpcInterface, IModelRpcOpenProps, IModelRpcProps, IModelVersion,
  IModelWriteRpcInterface, OpenBriefcaseProps, RpcManager, RpcNotFoundResponse, RpcOperation, RpcRequest, RpcRequestEvent,
  WipRpcInterface,
} from "@bentley/imodeljs-common";
import { EditingFunctions } from "./EditingFunctions";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { AuthorizedFrontendRequestContext, FrontendRequestContext } from "./FrontendRequestContext";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { IModelRoutingContext } from "./IModelRoutingContext";
import { IpcApp, NotificationHandler } from "./IpcApp";

const loggerCategory: string = FrontendLoggerCategory.IModelConnection;

/** Base class for connections to a [BriefcaseDb]($backend) hosted on the backend. A briefcase is a copy of an iModel that is synchronized with iModelHub.
 * @public
 */
export abstract class BriefcaseConnection extends IModelConnection {
  /** The Guid that identifies the *context* that owns this iModel. */
  public get contextId(): GuidString { return super.contextId!; } // GuidString | undefined for the superclass, but required for BriefcaseConnection
  /** The Guid that identifies this iModel. */
  public get iModelId(): GuidString { return super.iModelId!; } // GuidString | undefined for the superclass, but required for BriefcaseConnection

  /** Returns `true` if [[close]] has already been called. */
  public get isClosed(): boolean { return this._isClosed ? true : false; }
  protected _isClosed?: boolean;

  protected constructor(iModelProps: IModelConnectionProps) {
    super(iModelProps);
  }

  public isBriefcaseConnection(): this is BriefcaseConnection { return true; }

  private _editing: EditingFunctions | undefined;

  /** General editing functions
   * @alpha
   */
  public get editing(): EditingFunctions {
    if (this._editing === undefined)
      this._editing = new EditingFunctions(this);
    return this._editing;
  }

  /** WIP - Determines whether the *Change Cache file* is attached to this iModel or not.
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @returns Returns true if the *Change Cache file* is attached to the iModel. false otherwise
   * @internal
   */
  public async changeCacheAttached(): Promise<boolean> { return WipRpcInterface.getClient().isChangeCacheAttached(this.getRpcProps()); }

  /** WIP - Attaches the *Change Cache file* to this iModel if it hasn't been attached yet.
   * A new *Change Cache file* will be created for the iModel if it hasn't existed before.
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @throws [IModelError]($common) if a Change Cache file has already been attached before.
   * @internal
   */
  public async attachChangeCache(): Promise<void> { return WipRpcInterface.getClient().attachChangeCache(this.getRpcProps()); }

  /** Pull and merge new server changes
   * @alpha
   */
  public async pullAndMergeChanges(): Promise<void> {
    const rpc = IModelWriteRpcInterface.getClientForRouting(this.routingContext.token);
    const newProps: IModelConnectionProps = await rpc.pullAndMergeChanges(this.getRpcProps());
    this._changeSetId = newProps.changeSetId;
    this.initialize(newProps.name!, newProps);
  }

  /** Push local changes to the server
   * @param description description of new changeset
   * @alpha
   */
  public async pushChanges(description: string): Promise<void> {
    const rpc = IModelWriteRpcInterface.getClientForRouting(this.routingContext.token);
    const newProps: IModelConnectionProps = await rpc.pushChanges(this.getRpcProps(), description);
    this._changeSetId = newProps.changeSetId;
    this.initialize(newProps.name!, newProps);
  }
  /** Update the project extents of this iModel.
   * @param newExtents The new project extents as an AxisAlignedBox3d
   * @throws [[IModelError]] if the IModelConnection is read-only or there is a problem updating the extents.
   */
  public async updateProjectExtents(newExtents: AxisAlignedBox3d): Promise<void> {
    return this.editing.updateProjectExtents(newExtents);
  }

  /** Commit pending changes to this iModel
   * @param description Optional description of the changes
   * @throws [[IModelError]] if the IModelConnection is read-only or there is a problem saving changes.
   */
  public async saveChanges(description?: string): Promise<void> {
    return this.editing.saveChanges(description);
  }
}

/** @alpha */
export abstract class BriefcaseNotificationHandler extends NotificationHandler {
  constructor(private _key: string) { super(); }
  public abstract get briefcaseChannelName(): string;
  public get channelName() { return `${this.briefcaseChannelName}:${this._key}`; }
}

/** A connection to a [BriefcaseDb]($backend) hosted on a remote backend, and is typically used in web applications.
 * A briefcase is a copy of an iModel that is synchronized with iModelHub.
 * @public
 */
export class RemoteBriefcaseConnection extends BriefcaseConnection {

  /** Type guard for instanceof [[RemoteBriefcaseConnection]] */
  public isRemoteBriefcaseConnection(): this is RemoteBriefcaseConnection { return true; }

  /** Open an IModelConnection to an iModel. It's recommended that every open call be matched with a corresponding call to close. */
  public static async open(contextId: string, iModelId: string, openMode: OpenMode = OpenMode.Readonly, version: IModelVersion = IModelVersion.latest()): Promise<RemoteBriefcaseConnection> {
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call IModelApp.startup() before calling open");

    const routingContext = IModelRoutingContext.current || IModelRoutingContext.default;

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    const changeSetId: string = await version.evaluateChangeSet(requestContext, iModelId, IModelApp.iModelClient);
    requestContext.enter();

    const iModelRpcProps: IModelRpcOpenProps = { contextId, iModelId, changeSetId, openMode };
    const openResponse = await RemoteBriefcaseConnection.callOpen(requestContext, iModelRpcProps, openMode, routingContext);
    requestContext.enter();

    const connection = new RemoteBriefcaseConnection(openResponse);
    RpcManager.setIModel(connection);
    connection.routingContext = routingContext;
    RpcRequest.notFoundHandlers.addListener(connection._reopenConnectionHandler);

    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  private static async callOpen(requestContext: AuthorizedFrontendRequestContext, iModelToken: IModelRpcOpenProps, openMode: OpenMode, routingContext: IModelRoutingContext): Promise<IModelConnectionProps> {
    requestContext.enter();

    // Try opening the iModel repeatedly accommodating any pending responses from the backend.
    // Waits for an increasing amount of time (but within a range) before checking on the pending request again.
    const connectionRetryIntervalRange = { min: 100, max: 5000 }; // in milliseconds
    let connectionRetryInterval = Math.min(connectionRetryIntervalRange.min, IModelConnection.connectionTimeout);

    let openForReadOperation: RpcOperation | undefined;
    let openForWriteOperation: RpcOperation | undefined;
    if (openMode === OpenMode.Readonly) {
      openForReadOperation = RpcOperation.lookup(IModelReadRpcInterface, "openForRead");
      if (!openForReadOperation)
        throw new IModelError(BentleyStatus.ERROR, "IModelReadRpcInterface.openForRead() is not available");
      openForReadOperation.policy.retryInterval = () => connectionRetryInterval;
    } else {
      openForWriteOperation = RpcOperation.lookup(IModelWriteRpcInterface, "openForWrite");
      if (!openForWriteOperation)
        throw new IModelError(BentleyStatus.ERROR, "IModelWriteRpcInterface.openForWrite() is not available");
      openForWriteOperation.policy.retryInterval = () => connectionRetryInterval;
    }

    Logger.logTrace(loggerCategory, `Received open request in IModelConnection.open`, () => iModelToken);
    Logger.logTrace(loggerCategory, `Setting retry interval in IModelConnection.open`, () => ({ ...iModelToken, connectionRetryInterval }));

    const startTime = Date.now();

    const removeListener = RpcRequest.events.addListener((type: RpcRequestEvent, request: RpcRequest) => {
      if (type !== RpcRequestEvent.PendingUpdateReceived)
        return;
      if (!(openForReadOperation && request.operation === openForReadOperation) && !(openForWriteOperation && request.operation === openForWriteOperation))
        return;

      requestContext.enter();
      Logger.logTrace(loggerCategory, "Received pending open notification in IModelConnection.open", () => iModelToken);

      const connectionTimeElapsed = Date.now() - startTime;
      if (connectionTimeElapsed > IModelConnection.connectionTimeout) {
        Logger.logError(loggerCategory, `Timed out opening connection in IModelConnection.open (took longer than ${IModelConnection.connectionTimeout} milliseconds)`, () => iModelToken);
        throw new IModelError(BentleyStatus.ERROR, "Opening a connection was timed out"); // NEEDS_WORK: More specific error status
      }

      connectionRetryInterval = Math.min(connectionRetryIntervalRange.max, connectionRetryInterval * 2, IModelConnection.connectionTimeout - connectionTimeElapsed);
      if (request.retryInterval !== connectionRetryInterval) {
        request.retryInterval = connectionRetryInterval;
        Logger.logTrace(loggerCategory, `Adjusted open connection retry interval to ${request.retryInterval} milliseconds in IModelConnection.open`, () => iModelToken);
      }
    });

    let openPromise: Promise<IModelConnectionProps>;
    requestContext.useContextForRpc = true;
    if (openMode === OpenMode.ReadWrite) {
      /* eslint-disable-next-line deprecation/deprecation */
      openPromise = IModelWriteRpcInterface.getClientForRouting(routingContext.token).openForWrite(iModelToken);
    } else
      openPromise = IModelReadRpcInterface.getClientForRouting(routingContext.token).openForRead(iModelToken);

    let openResponse: IModelConnectionProps;
    try {
      openResponse = await openPromise;
    } finally {
      requestContext.enter();
      Logger.logTrace(loggerCategory, "Completed open request in IModelConnection.open", () => iModelToken);
      removeListener();
    }

    return openResponse;
  }

  private _reopenConnectionHandler = async (request: RpcRequest<RpcNotFoundResponse>, response: any, resubmit: () => void, reject: (reason: any) => void) => {
    if (!response.hasOwnProperty("isIModelNotFoundResponse"))
      return;

    const iModelRpcProps = request.parameters[0] as IModelRpcProps;
    if (this._fileKey !== iModelRpcProps.key)
      return; // The handler is called for a different connection than this

    const requestContext: AuthorizedFrontendRequestContext = await AuthorizedFrontendRequestContext.create(request.id); // Reuse activityId
    requestContext.enter();

    Logger.logTrace(loggerCategory, "Attempting to reopen connection", () => iModelRpcProps);

    try {
      const openResponse = await RemoteBriefcaseConnection.callOpen(requestContext, iModelRpcProps, this.openMode, this.routingContext);
      // The new/reopened connection may have a new rpcKey and/or changeSetId, but the other IModelRpcTokenProps should be the same
      this._fileKey = openResponse.key;
      this._changeSetId = openResponse.changeSetId;

    } catch (error) {
      reject(error.message);
    } finally {
      requestContext.enter();
    }

    Logger.logTrace(loggerCategory, "Resubmitting original request after reopening connection", () => iModelRpcProps);
    request.parameters[0] = this.getRpcProps(); // Modify the token of the original request before resubmitting it.
    resubmit();
  };

  /** Close this RemoteBriefcaseConnection
   * In the case of ReadWrite connections ensure all changes are pushed to iModelHub before making this call -
   * any un-pushed changes are lost after the close.
   */
  public async close(): Promise<void> {
    if (this.isClosed)
      return;

    this.beforeClose();
    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    RpcRequest.notFoundHandlers.removeListener(this._reopenConnectionHandler);
    requestContext.useContextForRpc = true;

    const closePromise: Promise<boolean> = IModelReadRpcInterface.getClientForRouting(this.routingContext.token).close(this.getRpcProps()); // Ensure the method isn't awaited right away.
    try {
      await closePromise;
    } finally {
      requestContext.enter();
      this._isClosed = true;
      this.subcategories.onIModelConnectionClose();
    }
  }
}

/** A connection to a [BriefcaseDb]($backend) for a native application
 * @alpha
 */
export class LocalBriefcaseConnection extends BriefcaseConnection {
  /** Type guard for instanceof [[RemoteBriefcaseConnection]]
   * @internal
   */
  public isLocalBriefcaseConnection(): this is LocalBriefcaseConnection { return true; }

  /** Open an IModelConnection to a locally downloaded briefcase of an iModel. Only applicable for Native applications
   * @internal
   */
  public static async open(briefcaseProps: OpenBriefcaseProps): Promise<LocalBriefcaseConnection> {
    const iModelProps = await IpcApp.callIpcHost("openBriefcase", briefcaseProps);
    const connection = new this({ ...briefcaseProps, ...iModelProps });
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /** Close this LocalBriefcaseConnection
   * In the case of ReadWrite connections ensure all changes are pushed to iModelHub before making this call -
   * any un-pushed changes are lost after the close.
   */
  public async close(): Promise<void> {
    if (this.isClosed)
      return;
    this.beforeClose();

    const requestContext = new FrontendRequestContext();
    requestContext.enter();
    requestContext.useContextForRpc = true;

    try {
      await IpcApp.callIpcHost("closeBriefcase", this._fileKey);
    } finally {
      requestContext.enter();
      this._isClosed = true;
      this.subcategories.onIModelConnectionClose();
    }
  }
}

