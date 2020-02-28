/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import {
  assert, BeEvent, BentleyStatus, BeTimePoint, DbResult, Dictionary, dispose, Id64, Id64Arg, Id64Array, Id64Set,
  Id64String, Logger, OneAtATimeAction, OpenMode, TransientIdSequence, DbOpcode, GuidString,
} from "@bentley/bentleyjs-core";
import { Angle, Point3d, Range3dProps, XYAndZ, XYZProps, Range3d } from "@bentley/geometry-core";
import {
  AxisAlignedBox3d, Cartographic, CodeSpec, ElementProps, EntityQueryParams, FontMap, GeoCoordStatus,
  ImageSourceFormat, IModel, IModelError, IModelProps, IModelReadRpcInterface,
  IModelStatus, IModelToken, IModelVersion, IModelWriteRpcInterface, ModelProps, ModelQueryParams, QueryLimit,
  QueryPriority, QueryQuota, QueryResponse, QueryResponseStatus, RpcNotFoundResponse, RpcOperation, RpcRequest,
  RpcRequestEvent, SnapRequestProps, SnapResponseProps, SnapshotIModelRpcInterface, ThumbnailProps, TileTreeProps,
  ViewDefinitionProps, ViewQueryParams, WipRpcInterface, MassPropertiesRequestProps, MassPropertiesResponseProps,
  EcefLocationProps, FontMapProps, EcefLocation, SubCategoryAppearance, CodeProps, BisCodeSpec, NativeAppRpcInterface,
} from "@bentley/imodeljs-common";
import { EntityState } from "./EntityState";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { GeoServices } from "./GeoServices";
import { IModelApp } from "./IModelApp";
import { ModelState } from "./ModelState";
import { HiliteSet, SelectionSet } from "./SelectionSet";
import { SubCategoriesCache } from "./SubCategoriesCache";
import { TileTree, TileTreeLoadStatus, TileTreeOwner, TileTreeSupplier } from "./tile/internal";
import { ViewState } from "./ViewState";
import { EventSource, EventSourceManager } from "./EventSource";
import { LockLevel } from "@bentley/imodeljs-clients";

const loggerCategory: string = FrontendLoggerCategory.IModelConnection;

/** The properties for creating a [Blank IModelConnection]($docs/learning/frontend/BlankConnection)
 * @beta
 */
export interface BlankConnectionProps {
  /** A name for this blank connection. */
  name: string;
  /** The spatial location for the blank connection. */
  location: Cartographic | EcefLocationProps;
  /** The volume of interest, in meters, centered around `location` */
  extents: Range3dProps;
  /** An offset to be applied to all spatial coordinates. */
  globalOrigin?: XYZProps;
}

/** A connection to an iModel database hosted on the backend.
 * @public
 */
export class IModelConnection extends IModel {
  /** The [[OpenMode]] used for this IModelConnection. */
  public readonly openMode: OpenMode;
  /** The [[ModelState]]s in this IModelConnection. */
  public readonly models: IModelConnection.Models;
  /** The [[ElementState]]s in this IModelConnection. */
  public readonly elements: IModelConnection.Elements;
  /** The [[CodeSpec]]s in this IModelConnection. */
  public readonly codeSpecs: IModelConnection.CodeSpecs;
  /** The [[ViewState]]s in this IModelConnection. */
  public readonly views: IModelConnection.Views;
  /** The event source that listen for backend generated events
   * @internal
   */
  public readonly eventSource: EventSource | undefined;
  /** The set of currently hilited elements for this IModelConnection.
   * @alpha
   */
  public readonly hilited: HiliteSet;
  /** The set of currently selected elements for this IModelConnection. */
  public readonly selectionSet: SelectionSet;
  /** The set of Tiles for this IModelConnection.
   * @internal
   */
  public readonly tiles: IModelConnection.Tiles;
  /** A cache of information about SubCategories chiefly used for rendering.
   * @internal
   */
  public readonly subcategories: SubCategoriesCache;
  /** Generator for unique Ids of transient graphics for this IModelConnection. */
  public readonly transientIds = new TransientIdSequence();
  /** The Geographic location services available for this iModelConnection
   * @internal
   */
  public readonly geoServices: GeoServices;
  /** @internal Whether it has already been determined that this iModelConnection does not have a map projection. */
  protected _noGcsDefined?: boolean;
  /** @internal The displayed extents. Union of the the project extents and all displayed models. */
  public readonly displayedExtents: AxisAlignedBox3d;
  /** The maximum time (in milliseconds) to wait before timing out the request to open a connection to a new iModel */
  public static connectionTimeout: number = 10 * 60 * 1000;

  private _editing: IModelConnection.EditingFunctions | undefined;

  private _isNativeAppBriefcase: boolean; // Set to true if it's a connection over a briefcase in a native application

  /**
   * General editing functions
   * @alpha
   */
  public get editing(): IModelConnection.EditingFunctions {
    if (this._editing === undefined)
      this._editing = new IModelConnection.EditingFunctions(this);
    return this._editing;
  }

  /** True if this is a [Blank Connection]($docs/learning/frontend/BlankConnection).
   * @beta
   */
  public readonly isBlank: boolean;

  /** Check the [[openMode]] of this IModelConnection to see if it was opened read-only. */
  public get isReadonly(): boolean { return this.openMode === OpenMode.Readonly; }

  /** Check if the IModelConnection is open (i.e. it has a *connection* to a backend server).
   * Returns false for blank connections and after [[IModelConnection.close]] has been called.
   * @note no RPC operations are valid on this IModelConnection if this method returns false.
   * @beta
   */
  public get isOpen(): boolean { return undefined !== this._token; }

  /** Check if the IModelConnection is closed (i.e. it has no *connection* to a backend server).
   * Returns true for blank connections and after [[IModelConnection.close]] has been called.
   * @note no RPC operations are valid on this IModelConnection if this method returns true.
   * @beta
   */
  public get isClosed(): boolean { return undefined === this._token; }

  /** Event called immediately before *any* IModelConnection is closed.
   * @note This static event is called when *any* IModelConnection is closed, and the specific IModelConnection is passed as its argument. To
   * monitor closing a specific IModelConnection, use the `onClose` instance event.
   * @note Be careful not to perform any asynchronous operations on the IModelConnection because it will close before they are processed.
   */
  public static readonly onClose = new BeEvent<(_imodel: IModelConnection) => void>();

  /** Event called immediately after *any* IModelConnection is opened. */
  public static readonly onOpen = new BeEvent<(_imodel: IModelConnection) => void>();

  /** Event called immediately before *this* IModelConnection is closed.
   * @note This event is called only for this IModelConnection. To monitor *all* IModelConnections,use the static event.
   * @note Be careful not to perform any asynchronous operations on the IModelConnection because it will close before they are processed.
   * @beta
   */
  public readonly onClose = new BeEvent<(_imodel: IModelConnection) => void>();

  /** The font map for this IModelConnection. Only valid after calling #loadFontMap and waiting for the returned promise to be fulfilled. */
  public fontMap?: FontMap;

  /** Load the FontMap for this IModelConnection.
   * @returns Returns a Promise<FontMap> that is fulfilled when the FontMap member of this IModelConnection is valid.
   */
  public async loadFontMap(): Promise<FontMap> {
    if (undefined === this.fontMap) {
      this.fontMap = new FontMap();
      if (this.isOpen) {
        const fontProps = JSON.parse(await IModelReadRpcInterface.getClient().readFontJson(this.iModelToken.toJSON())) as FontMapProps;
        this.fontMap.addFonts(fontProps.fonts);
      }
    }
    return this.fontMap;
  }

  /** Find the first registered base class of the given EntityState className. This class will "handle" the State for the supplied className.
   * @param className The full name of the class of interest.
   * @param defaultClass If no base class of the className is registered, return this value.
   * @note this method is async since it may have to query the server to get the class hierarchy.
   */
  public async findClassFor<T extends typeof EntityState>(className: string, defaultClass: T | undefined): Promise<T | undefined> {
    let ctor = IModelApp.lookupEntityClass(className) as T | undefined;
    if (undefined !== ctor)
      return ctor;

    // it's not registered, we need to query its class hierarchy.
    ctor = defaultClass; // in case we cant find a registered class that handles this class

    // wait until we get the full list of base classes from backend
    if (this.isOpen) {
      const baseClasses = await IModelReadRpcInterface.getClient().getClassHierarchy(this.iModelToken.toJSON(), className);
      // walk through the list until we find a registered base class
      baseClasses.some((baseClass: string) => {
        const test = IModelApp.lookupEntityClass(baseClass) as T | undefined;
        if (test === undefined)
          return false; // nope, not registered

        ctor = test; // found it, save it
        IModelApp.registerEntityState(className, ctor); // and register the fact that our starting class is handled by this subclass.
        return true; // stop
      });
    }
    return ctor; // either the baseClass handler or defaultClass if we didn't find a registered baseClass
  }

  private constructor(iModel: IModelProps, openMode: OpenMode, isNativeAppBriefcase: boolean) {
    super(iModel.iModelToken ? IModelToken.fromJSON(iModel.iModelToken) : undefined);
    super.initialize(iModel.name!, iModel);
    this.isBlank = undefined === iModel.iModelToken; // to differentiate between previously-open-but-now-closed vs. blank
    this.openMode = openMode;
    this._isNativeAppBriefcase = isNativeAppBriefcase;
    this.models = new IModelConnection.Models(this);
    this.elements = new IModelConnection.Elements(this);
    this.codeSpecs = new IModelConnection.CodeSpecs(this);
    this.views = new IModelConnection.Views(this);
    this.selectionSet = new SelectionSet(this);
    this.hilited = new HiliteSet(this);
    this.tiles = new IModelConnection.Tiles(this);
    this.subcategories = new SubCategoriesCache(this);
    this.geoServices = new GeoServices(this);
    this.displayedExtents = Range3d.fromJSON(this.projectExtents);
    if (iModel.iModelToken && iModel.iModelToken.key) {
      this.eventSource = EventSourceManager.get(iModel.iModelToken.key, this.iModelToken);
    }
  }

  /**
   * Creates iModel Connection over a local briefcase for a native application
   * @internal
   */
  public static createForNativeAppBriefcase(iModel: IModelProps, openMode: OpenMode): IModelConnection {
    return new this(iModel, openMode, true);
  }

  /** Create a new [Blank IModelConnection]($docs/learning/frontend/BlankConnection).
   * @param props The properties of the new blank IModelConnection.
   * @beta
   */
  public static createBlank(props: BlankConnectionProps): IModelConnection {
    return new this({
      rootSubject: { name: props.name },
      projectExtents: props.extents,
      globalOrigin: props.globalOrigin,
      ecefLocation: props.location instanceof Cartographic ? EcefLocation.createFromCartographicOrigin(props.location) : props.location,
    }, OpenMode.Readonly, false);
  }

  /** Open an IModelConnection to an iModel. It's recommended that every open call be matched with a corresponding call to close. */
  public static async open(contextId: string, iModelId: string, openMode: OpenMode = OpenMode.Readonly, version: IModelVersion = IModelVersion.latest()): Promise<IModelConnection> {
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call IModelApp.startup() before calling open");

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    const changeSetId: string = await version.evaluateChangeSet(requestContext, iModelId, IModelApp.iModelClient);
    requestContext.enter();

    const iModelToken = new IModelToken(undefined, contextId, iModelId, changeSetId, openMode);

    const openResponse: IModelProps = await IModelConnection.callOpen(requestContext, iModelToken, openMode);
    requestContext.enter();

    const connection = new IModelConnection(openResponse, openMode, false);
    RpcRequest.notFoundHandlers.addListener(connection._reopenConnectionHandler);

    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  private static async callOpen(requestContext: AuthorizedFrontendRequestContext, iModelToken: IModelToken, openMode: OpenMode): Promise<IModelProps> {
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

    let openPromise: Promise<IModelProps>;
    requestContext.useContextForRpc = true;
    if (openMode === OpenMode.ReadWrite)
      openPromise = IModelWriteRpcInterface.getClient().openForWrite(iModelToken.toJSON());
    else
      openPromise = IModelReadRpcInterface.getClient().openForRead(iModelToken.toJSON());

    let openResponse: IModelProps;
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

    const iModelToken: IModelToken = IModelToken.fromJSON(request.parameters[0]);
    if (this.iModelToken.key !== iModelToken.key)
      return; // The handler is called for a different connection than this

    const requestContext: AuthorizedFrontendRequestContext = await AuthorizedFrontendRequestContext.create(request.id); // Reuse activityId
    requestContext.enter();

    Logger.logTrace(loggerCategory, "Attempting to reopen connection", () => iModelToken);

    try {
      const openResponse: IModelProps = await IModelConnection.callOpen(requestContext, iModelToken, this.openMode);
      this._token = IModelToken.fromJSON(openResponse.iModelToken!);
    } catch (error) {
      reject(error.message);
    } finally {
      requestContext.enter();
    }

    Logger.logTrace(loggerCategory, "Resubmitting original request after reopening connection", () => iModelToken);
    request.parameters[0] = this.iModelToken; // Modify the token of the original request before resubmitting it.
    resubmit();
  }

  // called prior to connection closing. Raises close events and calls tiles.dispose.
  // NOTE: this is called for blank connections too!
  private beforeClose() {
    this.onClose.raiseEvent(this); // event for this connection
    IModelConnection.onClose.raiseEvent(this); // event for all connections
    this.tiles.dispose();
  }

  /** Close this IModelConnection
   * In the case of ReadWrite connections ensure all changes are pushed to the iModelHub before making this call -
   * any un-pushed changes are lost after the close.
   */
  public async close(): Promise<void> {
    this.beforeClose();
    if (!this.isOpen)
      return;

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    RpcRequest.notFoundHandlers.removeListener(this._reopenConnectionHandler);
    requestContext.useContextForRpc = true;

    let closePromise;
    if (this._isNativeAppBriefcase)
      closePromise = NativeAppRpcInterface.getClient().closeBriefcase(this.iModelToken.toJSON());
    else
      closePromise = IModelReadRpcInterface.getClient().close(this.iModelToken.toJSON()); // Ensure the method isn't awaited right away.

    if (this.eventSource) {
      EventSourceManager.delete(this.iModelToken.key!);
    }
    try {
      await closePromise;
    } finally {
      this._token = undefined; // prevent closed connection from being reused
      this.subcategories.onIModelConnectionClose();
    }
  }

  /** Open an IModelConnection to a read-only iModel *snapshot* (not managed by iModelHub) from a file name that is resolved by the backend.
   * This method is intended for desktop or mobile applications and should not be used for web applications.
   * @beta
   */
  public static async openSnapshot(fileName: string): Promise<IModelConnection> {
    const openResponse: IModelProps = await SnapshotIModelRpcInterface.getClient().openSnapshot(fileName);
    Logger.logTrace(loggerCategory, "IModelConnection.openSnapshot", () => ({ fileName }));
    const connection = new IModelConnection(openResponse, OpenMode.Readonly, false);
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /** Close this IModelConnection to a read-only iModel *snapshot*.
   * @beta
   */
  public async closeSnapshot(): Promise<void> {
    this.beforeClose();
    if (!this.isOpen)
      return;

    try {
      await SnapshotIModelRpcInterface.getClient().closeSnapshot(this.iModelToken.toJSON());
    } finally {
      this._token = undefined; // prevent closed connection from being reused
      this.subcategories.onIModelConnectionClose();
    }
  }

  /** Compute number of rows that would be returned by the ECSQL.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @returns Return row count.
   * @throws [IModelError]($common) If the statement is invalid
   */
  public async queryRowCount(ecsql: string, bindings?: any[] | object): Promise<number> {
    for await (const row of this.query(`select count(*) nRows from (${ecsql})`, bindings)) {
      return row.nRows;
    }
    Logger.logError(loggerCategory, "IModelConnection.queryRowCount", () => ({ ...this.iModelToken, ecsql, bindings }));
    throw new IModelError(DbResult.BE_SQLITE_ERROR, "Failed to get row count");
  }

  /** Execute a query against this ECDb but restricted by quota and limit settings. This is intended to be used internally
   * The result of the query is returned as an array of JavaScript objects where every array element represents an
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @param limitRows Specify upper limit for rows that can be returned by the query.
   * @param quota Specify non binding quota. These values are constrained by global setting
   * but never the less can be specified to narrow down the quota constraint for the query but staying under global settings.
   * @param priority Specify non binding priority for the query. It can help user to adjust
   * priority of query in queue so that small and quicker queries can be prioritized over others.
   * @returns Returns structure containing rows and status.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @internal
   */
  public async queryRows(ecsql: string, bindings?: any[] | object, limit?: QueryLimit, quota?: QueryQuota, priority?: QueryPriority): Promise<QueryResponse> {

    return IModelReadRpcInterface.getClient().queryRows(this.iModelToken.toJSON(), ecsql, bindings, limit, quota, priority);
  }

  /** Execute a query and stream its results
   * The result of the query is async iterator over the rows. The iterator will get next page automatically once rows in current page has been read.
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @param limitRows Specify upper limit for rows that can be returned by the query.
   * @param quota Specify non binding quota. These values are constrained by global setting
   * but never the less can be specified to narrow down the quota constraint for the query but staying under global settings.
   * @param priority Specify non binding priority for the query. It can help user to adjust
   * priority of query in queue so that small and quicker queries can be prioritized over others.
   * @returns Returns the query result as an *AsyncIterableIterator<any>*  which lazy load result as needed
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If there was any error while submitting, preparing or stepping into query
   * @beta
   */
  public async * query(ecsql: string, bindings?: any[] | object, limitRows?: number, quota?: QueryQuota, priority?: QueryPriority): AsyncIterableIterator<any> {
    let result: QueryResponse;
    let offset: number = 0;
    let rowsToGet = limitRows ? limitRows : -1;
    do {
      result = await this.queryRows(ecsql, bindings, { maxRowAllowed: rowsToGet, startRowOffset: offset }, quota, priority);
      while (result.status === QueryResponseStatus.Timeout) {
        result = await this.queryRows(ecsql, bindings, { maxRowAllowed: rowsToGet, startRowOffset: offset }, quota, priority);
      }

      if (result.status === QueryResponseStatus.Error) {
        if (result.rows[0] === undefined) {
          throw new IModelError(DbResult.BE_SQLITE_ERROR, "Invalid ECSql");
        } else {
          throw new IModelError(DbResult.BE_SQLITE_ERROR, result.rows[0]);
        }
      }

      if (rowsToGet > 0) {
        rowsToGet -= result.rows.length;
      }
      offset += result.rows.length;

      for (const row of result.rows)
        yield row;

    } while (result.status !== QueryResponseStatus.Done);
  }

  /** Query for a set of element ids that satisfy the supplied query params
   * @param params The query parameters. The `limit` and `offset` members should be used to page results.
   * @throws [IModelError]($common) If the generated statement is invalid or would return too many rows.
   */
  public async queryEntityIds(params: EntityQueryParams): Promise<Id64Set> {
    return new Set(this.isOpen ? await IModelReadRpcInterface.getClient().queryEntityIds(this.iModelToken.toJSON(), params) : undefined);
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

  /** WIP - Determines whether the *Change Cache file* is attached to this iModel or not.
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @returns Returns true if the *Change Cache file* is attached to the iModel. false otherwise
   * @internal
   */
  public async changeCacheAttached(): Promise<boolean> { return WipRpcInterface.getClient().isChangeCacheAttached(this.iModelToken.toJSON()); }

  /** WIP - Attaches the *Change Cache file* to this iModel if it hasn't been attached yet.
   * A new *Change Cache file* will be created for the iModel if it hasn't existed before.
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @throws [IModelError]($common) if a Change Cache file has already been attached before.
   * @internal
   */
  public async attachChangeCache(): Promise<void> { return WipRpcInterface.getClient().attachChangeCache(this.iModelToken.toJSON()); }

  /** WIP - Detaches the *Change Cache file* to this iModel if it had been attached before.
   * > You do not have to check whether a Change Cache file had been attached before. The
   * > method does not do anything, if no Change Cache is attached.
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @internal
   */
  public async detachChangeCache(): Promise<void> { return WipRpcInterface.getClient().detachChangeCache(this.iModelToken.toJSON()); }

  private _snapRpc = new OneAtATimeAction<SnapResponseProps>((props: SnapRequestProps) => IModelReadRpcInterface.getClient().requestSnap(this.iModelToken.toJSON(), IModelApp.sessionId, props));
  /** Request a snap from the backend.
   * @note callers must gracefully handle Promise rejected with AbandonedError
   */
  public async requestSnap(props: SnapRequestProps): Promise<SnapResponseProps> {
    return this.isOpen ? this._snapRpc.request(props) : { status: 2 };
  }

  private _toolTipRpc = new OneAtATimeAction<string[]>((id: string) => IModelReadRpcInterface.getClient().getToolTipMessage(this.iModelToken.toJSON(), id));
  /** Request a tooltip from the backend.
   * @note callers must gracefully handle Promise rejected with AbandonedError
   */
  public async getToolTipMessage(id: Id64String): Promise<string[]> {
    return this.isOpen ? this._toolTipRpc.request(id) : [];
  }

  /** Request element mass properties from the backend.
   * @beta
   */
  public async getMassProperties(requestProps: MassPropertiesRequestProps): Promise<MassPropertiesResponseProps> { return IModelReadRpcInterface.getClient().getMassProperties(this.iModelToken.toJSON(), requestProps); }

  /** Convert a point in this iModel's Spatial coordinates to a [[Cartographic]] using the Geographic location services for this IModelConnection.
   * @param spatial A point in the iModel's spatial coordinates
   * @param result If defined, use this for output
   * @returns A Cartographic location
   * @throws IModelError if [[isGeoLocated]] is false or point could not be converted.
   */
  public async spatialToCartographicFromGcs(spatial: XYAndZ, result?: Cartographic): Promise<Cartographic> {
    if (undefined === this._noGcsDefined && !this.isGeoLocated)
      this._noGcsDefined = true;

    if (this._noGcsDefined)
      throw new IModelError(IModelStatus.NoGeoLocation, "iModel is not GeoLocated");

    const geoConverter = this.geoServices.getConverter()!;
    const coordResponse = await geoConverter.getGeoCoordinatesFromIModelCoordinates([spatial]);

    if (this._noGcsDefined = (1 !== coordResponse.geoCoords.length || GeoCoordStatus.NoGCSDefined === coordResponse.geoCoords[0].s))
      throw new IModelError(IModelStatus.NoGeoLocation, "iModel is not GeoLocated");

    if (GeoCoordStatus.Success !== coordResponse.geoCoords[0].s)
      throw new IModelError(IModelStatus.BadRequest, "Error converting spatial to cartographic");

    const longLatHeight = Point3d.fromJSON(coordResponse.geoCoords[0].p); // x is longitude in degrees, y is latitude in degrees, z is height in meters...
    return Cartographic.fromDegrees(longLatHeight.x, longLatHeight.y, longLatHeight.z, result);
  }

  /** Convert a point in this iModel's Spatial coordinates to a [[Cartographic]] using the Geographic location services for this IModelConnection or [[IModel.ecefLocation]].
   * @param spatial A point in the iModel's spatial coordinates
   * @param result If defined, use this for output
   * @returns A Cartographic location
   * @throws IModelError if [[isGeoLocated]] is false or point could not be converted.
   * @see [[spatialToCartographicFromGcs]]
   * @see [[spatialToCartographicFromEcef]]
   */
  public async spatialToCartographic(spatial: XYAndZ, result?: Cartographic): Promise<Cartographic> {
    if (undefined === this._noGcsDefined) {
      try {
        return await this.spatialToCartographicFromGcs(spatial, result);
      } catch (error) {
        if (!this._noGcsDefined)
          throw error;
      }
    }
    return (this._noGcsDefined ? this.spatialToCartographicFromEcef(spatial, result) : this.spatialToCartographicFromGcs(spatial, result));
  }

  /** Convert a [[Cartographic]] to a point in this iModel's Spatial coordinates using the Geographic location services for this IModelConnection.
   * @param cartographic A cartographic location
   * @param result If defined, use this for output
   * @returns A point in this iModel's spatial coordinates
   * @throws IModelError if [[isGeoLocated]] is false or cartographic location could not be converted.
   */
  public async cartographicToSpatialFromGcs(cartographic: Cartographic, result?: Point3d): Promise<Point3d> {
    if (undefined === this._noGcsDefined && !this.isGeoLocated)
      this._noGcsDefined = true;

    if (this._noGcsDefined)
      throw new IModelError(IModelStatus.NoGeoLocation, "iModel is not GeoLocated");

    const geoConverter = this.geoServices.getConverter()!;
    const geoCoord = Point3d.create(Angle.radiansToDegrees(cartographic.longitude), Angle.radiansToDegrees(cartographic.latitude), cartographic.height); // x is longitude in degrees, y is latitude in degrees, z is height in meters...
    const coordResponse = await geoConverter.getIModelCoordinatesFromGeoCoordinates([geoCoord]);

    if (this._noGcsDefined = (1 !== coordResponse.iModelCoords.length || GeoCoordStatus.NoGCSDefined === coordResponse.iModelCoords[0].s))
      throw new IModelError(IModelStatus.NoGeoLocation, "iModel is not GeoLocated");

    if (GeoCoordStatus.Success !== coordResponse.iModelCoords[0].s)
      throw new IModelError(IModelStatus.BadRequest, "Error converting cartographic to spatial");

    result = result ? result : Point3d.createZero();
    result.setFromJSON(coordResponse.iModelCoords[0].p);
    return result;
  }

  /** Convert a [[Cartographic]] to a point in this iModel's Spatial coordinates using the Geographic location services for this IModelConnection or [[IModel.ecefLocation]].
   * @param cartographic A cartographic location
   * @param result If defined, use this for output
   * @returns A point in this iModel's spatial coordinates
   * @throws IModelError if [[isGeoLocated]] is false or cartographic location could not be converted.
   * @see [[cartographicToSpatialFromGcs]]
   * @see [[cartographicToSpatialFromEcef]]
   */
  public async cartographicToSpatial(cartographic: Cartographic, result?: Point3d): Promise<Point3d> {
    if (undefined === this._noGcsDefined) {
      try {
        return await this.cartographicToSpatialFromGcs(cartographic, result);
      } catch (error) {
        if (!this._noGcsDefined)
          throw error;
      }
    }
    return (this._noGcsDefined ? this.cartographicToSpatialFromEcef(cartographic, result) : this.cartographicToSpatialFromGcs(cartographic, result));
  }
}

/** @public */
export namespace IModelConnection {

  /** The id/name/class of a ViewDefinition. Returned by [[IModelConnection.Views.getViewList]] */
  export interface ViewSpec {
    /** The element id of the ViewDefinition. This string may be passed to [[IModelConnection.Views.load]]. */
    id: string;
    /** The name of the view. This string may be used to create a list with the possible view names. */
    name: string;
    /** The fullClassName of the ViewDefinition. Useful for sorting the list of views. */
    class: string;
  }

  /** The collection of loaded ModelState objects for an [[IModelConnection]]. */
  export class Models {
    /** The set of loaded models for this IModelConnection, indexed by Id. */
    public loaded = new Map<string, ModelState>();

    /** @internal */
    constructor(private _iModel: IModelConnection) { }

    /** The Id of the [RepositoryModel]($backend). */
    public get repositoryModelId(): string { return "0x1"; }

    /** @internal */
    public async getDictionaryModel(): Promise<Id64String> {
      const res = await this._iModel.models.queryProps({ from: "bis.DictionaryModel", wantPrivate: true });
      if (res.length !== 1 || res[0].id === undefined)
        throw new IModelError(IModelStatus.BadModel, "bis.DictionaryModel");
      return res[0].id;
    }

    /** Get a batch of [[ModelProps]] given a list of Model ids. */
    public async getProps(modelIds: Id64Arg): Promise<ModelProps[]> {
      const iModel = this._iModel;
      return iModel.isOpen ? IModelReadRpcInterface.getClient().getModelProps(iModel.iModelToken.toJSON(), [...Id64.toIdSet(modelIds)]) : [];
    }

    /** Find a ModelState in the set of loaded Models by ModelId. */
    public getLoaded(id: string): ModelState | undefined { return this.loaded.get(id); }

    /** Given a set of modelIds, return the subset of corresponding models that are not currently loaded.
     * @param modelIds The set of model Ids
     * @returns The subset of the supplied Ids corresponding to models that are not currently loaded, or undefined if all of the specified models are loaded.
     * @alpha
     */
    public filterLoaded(modelIds: Id64Arg): Id64Set | undefined {
      let unloaded: Set<string> | undefined;
      Id64.forEach(modelIds, (id) => {
        if (undefined === this.getLoaded(id)) {
          if (undefined === unloaded)
            unloaded = new Set<string>();

          unloaded.add(id);
        }
      });

      return unloaded;
    }

    /** load a set of Models by Ids. After the returned Promise resolves, you may get the ModelState objects by calling getLoadedModel. */
    public async load(modelIds: Id64Arg): Promise<void> {
      const notLoaded = this.filterLoaded(modelIds);
      if (undefined === notLoaded)
        return; // all requested models are already loaded

      try {
        const propArray = await this.getProps(notLoaded);
        for (const props of propArray) {
          const ctor = await this._iModel.findClassFor(props.classFullName, ModelState);
          if (undefined === this.getLoaded(props.id!)) { // do not overwrite if someone else loads it while we await
            const modelState = new ctor!(props, this._iModel); // create a new instance of the appropriate ModelState subclass
            this.loaded.set(modelState.id, modelState as ModelState); // save it in loaded set
          }
        }
      } catch (err) { } // ignore error, we had nothing to do.
    }

    /** Query for a set of model ranges by ModelIds. */
    public async queryModelRanges(modelIds: Id64Arg): Promise<Range3dProps[]> {
      const iModel = this._iModel;
      return iModel.isOpen ? IModelReadRpcInterface.getClient().queryModelRanges(iModel.iModelToken.toJSON(), [...Id64.toIdSet(modelIds)]) : [];
    }

    /** Query for a set of ModelProps of the specified ModelQueryParams.
     * @param queryParams The query parameters. The `limit` and `offset` members should be used to page results.
     * @throws [IModelError]($common) If the generated statement is invalid or would return too many props.
     */
    public async queryProps(queryParams: ModelQueryParams): Promise<ModelProps[]> {
      const iModel = this._iModel;
      if (!iModel.isOpen)
        return [];
      const params: ModelQueryParams = Object.assign({}, queryParams); // make a copy
      params.from = queryParams.from || ModelState.classFullName; // use "BisCore:Model" as default class name
      params.where = queryParams.where || "";
      if (!queryParams.wantPrivate) {
        if (params.where.length > 0) params.where += " AND ";
        params.where += "IsPrivate=FALSE ";
      }
      if (!queryParams.wantTemplate) {
        if (params.where.length > 0) params.where += " AND ";
        params.where += "IsTemplate=FALSE ";
      }
      return IModelReadRpcInterface.getClient().queryModelProps(iModel.iModelToken.toJSON(), params);
    }

    /** Asynchronously stream ModelProps using the specified ModelQueryParams.
     * @alpha This method will replace IModelConnection.Models.queryProps as soon as auto-paging support is added
     */
    public async * query(queryParams: ModelQueryParams): AsyncIterableIterator<ModelProps> {
      // NOTE: this implementation has the desired API signature, but its implementation must be improved to actually page results
      const modelPropsArray: ModelProps[] = await this.queryProps(queryParams);
      for (const modelProps of modelPropsArray) {
        yield modelProps;
      }
    }
  }

  /** The collection of Elements for an [[IModelConnection]]. */
  export class Elements {
    /** @internal */
    public constructor(private _iModel: IModelConnection) { }

    /** The Id of the [root subject element]($docs/bis/intro/glossary.md#subject-root) for this iModel. */
    public get rootSubjectId(): Id64String { return "0x1"; }

    /** Get a set of element ids that satisfy a query */
    public async queryIds(params: EntityQueryParams): Promise<Id64Set> { return this._iModel.queryEntityIds(params); }

    /** Get an array of [[ElementProps]] given one or more element ids. */
    public async getProps(arg: Id64Arg): Promise<ElementProps[]> {
      const iModel = this._iModel;
      return iModel.isOpen ? IModelReadRpcInterface.getClient().getElementProps(this._iModel.iModelToken.toJSON(), [...Id64.toIdSet(arg)]) : [];
    }

    /** Get an array  of [[ElementProps]] that satisfy a query
     * @param params The query parameters. The `limit` and `offset` members should be used to page results.
     * @throws [IModelError]($common) If the generated statement is invalid or would return too many props.
     */
    public async queryProps(params: EntityQueryParams): Promise<ElementProps[]> {
      const iModel = this._iModel;
      return iModel.isOpen ? IModelReadRpcInterface.getClient().queryElementProps(iModel.iModelToken.toJSON(), params) : [];
    }
  }

  /** The collection of [[CodeSpec]] entities for an [[IModelConnection]]. */
  export class CodeSpecs {
    private _loaded?: CodeSpec[];

    /** @internal */
    constructor(private _iModel: IModelConnection) { }

    /** Loads all CodeSpec from the remote IModelDb. */
    private async _loadAllCodeSpecs(): Promise<void> {
      if (this._loaded)
        return;

      this._loaded = [];
      const codeSpecArray: any[] = await IModelReadRpcInterface.getClient().getAllCodeSpecs(this._iModel.iModelToken.toJSON());
      for (const codeSpec of codeSpecArray) {
        this._loaded.push(CodeSpec.createFromJson(this._iModel, Id64.fromString(codeSpec.id), codeSpec.name, codeSpec.jsonProperties));
      }
    }

    /** Look up a CodeSpec by Id.
     * @param codeSpecId The Id of the CodeSpec to load
     * @returns The CodeSpec with the specified Id
     * @throws [[IModelError]] if the Id is invalid or if no CodeSpec with that Id could be found.
     */
    public async getById(codeSpecId: Id64String): Promise<CodeSpec> {
      if (!Id64.isValid(codeSpecId))
        return Promise.reject(new IModelError(IModelStatus.InvalidId, "Invalid codeSpecId", Logger.logWarning, loggerCategory, () => ({ codeSpecId })));

      await this._loadAllCodeSpecs(); // ensure all codeSpecs have been downloaded
      const found: CodeSpec | undefined = this._loaded!.find((codeSpec: CodeSpec) => codeSpec.id === codeSpecId);
      if (!found)
        return Promise.reject(new IModelError(IModelStatus.NotFound, "CodeSpec not found", Logger.logWarning, loggerCategory));

      return found;
    }

    /** Look up a CodeSpec by name.
     * @param name The name of the CodeSpec to load
     * @returns The CodeSpec with the specified name
     * @throws [[IModelError]] if no CodeSpec with the specified name could be found.
     */
    public async getByName(name: string): Promise<CodeSpec> {
      await this._loadAllCodeSpecs(); // ensure all codeSpecs have been downloaded
      const found: CodeSpec | undefined = this._loaded!.find((codeSpec: CodeSpec) => codeSpec.name === name);
      if (!found)
        return Promise.reject(new IModelError(IModelStatus.NotFound, "CodeSpec not found", Logger.logWarning, loggerCategory));

      return found;
    }
  }

  /** The collection of views for an [[IModelConnection]]. */
  export class Views {
    /** @internal */
    constructor(private _iModel: IModelConnection) { }

    /** Query for an array of ViewDefinitionProps
     * @param queryParams Query parameters specifying the views to return. The `limit` and `offset` members should be used to page results.
     * @throws [IModelError]($common) If the generated statement is invalid or would return too many props.
     */
    public async queryProps(queryParams: ViewQueryParams): Promise<ViewDefinitionProps[]> {
      const iModel = this._iModel;
      if (iModel.isClosed)
        return [];

      const params: ViewQueryParams = Object.assign({}, queryParams); // make a copy
      params.from = queryParams.from || ViewState.classFullName; // use "BisCore:ViewDefinition" as default class name
      params.where = queryParams.where || "";
      if (queryParams.wantPrivate === undefined || !queryParams.wantPrivate) {
        if (params.where.length > 0) params.where += " AND ";
        params.where += "IsPrivate=FALSE ";
      }
      const viewProps = await IModelReadRpcInterface.getClient().queryElementProps(iModel.iModelToken.toJSON(), params);
      assert((viewProps.length === 0) || ("categorySelectorId" in viewProps[0]), "invalid view definition");  // spot check that the first returned element is-a ViewDefinitionProps
      return viewProps as ViewDefinitionProps[];
    }

    /** Get an array of the ViewSpecs for all views in this IModel that satisfy a ViewQueryParams.
     *
     * This is typically used to create a list for UI.
     *
     * For example:
     * ```ts
     * [[include:IModelConnection.Views.getSpatialViewList]]
     * ```
     * @param queryParams The parameters for the views to find. The `limit` and `offset` members should be used to page results.
     * @throws [IModelError]($common) If the generated statement is invalid or would return too many props.
     */
    public async getViewList(queryParams: ViewQueryParams): Promise<ViewSpec[]> {
      const views: ViewSpec[] = [];
      const viewProps: ViewDefinitionProps[] = await this.queryProps(queryParams);
      viewProps.forEach((viewProp) => { views.push({ id: viewProp.id as string, name: viewProp.code!.value!, class: viewProp.classFullName }); });
      return views;
    }

    /** Query the Id of the default view associated with this iModel. Applications can choose to use this as the default view to which to open a viewport upon startup, or the initial selection
     * within a view selection dialog, or similar purposes.
     * @returns the ID of the default view, or an invalid ID if no default view is defined.
     */
    public async queryDefaultViewId(): Promise<Id64String> {
      const iModel = this._iModel;
      return iModel.isOpen ? IModelReadRpcInterface.getClient().getDefaultViewId(iModel.iModelToken.toJSON()) : Id64.invalid;
    }

    /** Load a [[ViewState]] object from the specified [[ViewDefinition]] id. */
    public async load(viewDefinitionId: Id64String): Promise<ViewState> {
      const viewProps = await IModelReadRpcInterface.getClient().getViewStateData(this._iModel.iModelToken.toJSON(), viewDefinitionId);
      const className = viewProps.viewDefinitionProps.classFullName;
      const ctor = await this._iModel.findClassFor<typeof EntityState>(className, undefined) as typeof ViewState | undefined;
      if (undefined === ctor)
        return Promise.reject(new IModelError(IModelStatus.WrongClass, "Invalid ViewState class", Logger.logError, loggerCategory, () => viewProps));

      const viewState = ctor.createFromProps(viewProps, this._iModel)!;
      await viewState.load(); // loads models for ModelSelector
      return viewState;
    }

    /** Get a thumbnail for a view.
     * @param viewId The id of the view of the thumbnail.
     * @returns A Promise of the ThumbnailProps.
     * @throws Error if invalid thumbnail.
     */
    public async getThumbnail(viewId: Id64String): Promise<ThumbnailProps> {
      const val = await IModelReadRpcInterface.getClient().getViewThumbnail(this._iModel.iModelToken.toJSON(), viewId.toString());
      const intValues = new Uint32Array(val.buffer, 0, 4);

      if (intValues[1] !== ImageSourceFormat.Jpeg && intValues[1] !== ImageSourceFormat.Png)
        return Promise.reject(new Error("Invalid thumbnail"));

      return { format: intValues[1] === ImageSourceFormat.Jpeg ? "jpeg" : "png", width: intValues[2], height: intValues[3], image: new Uint8Array(val.buffer, 16, intValues[0]) };
    }

    /** Save a thumbnail for a view.
     * @param viewId The id of the view for the thumbnail.
     * @param thumbnail The thumbnail data to save.
     * @returns A void Promise
     * @throws `Error` exception if the thumbnail wasn't successfully saved.
     */
    public async saveThumbnail(viewId: Id64String, thumbnail: ThumbnailProps): Promise<void> {
      const val = new Uint8Array(thumbnail.image.length + 24);  // include the viewId and metadata in the binary transfer by allocating a new buffer 24 bytes larger than the image size
      new Uint32Array(val.buffer, 0, 4).set([thumbnail.image.length, thumbnail.format === "jpeg" ? ImageSourceFormat.Jpeg : ImageSourceFormat.Png, thumbnail.width, thumbnail.height]); // metadata at offset 0
      const low32 = Id64.getLowerUint32(viewId);
      const high32 = Id64.getUpperUint32(viewId);
      new Uint32Array(val.buffer, 16, 2).set([low32, high32]); // viewId is 8 bytes starting at offset 16
      val.set(thumbnail.image, 24); // image data at offset 24
      return IModelWriteRpcInterface.getClient().saveThumbnail(this._iModel.iModelToken.toJSON(), val);
    }

  }

  /** Provides access to tiles associated with an IModelConnection
   * @internal
   */
  export class Tiles {
    private _iModel: IModelConnection;
    private readonly _treesBySupplier = new Map<TileTreeSupplier, Dictionary<any, TreeOwner>>();
    private _disposed = false;

    public get isDisposed() { return this._disposed; }

    constructor(iModel: IModelConnection) { this._iModel = iModel; }

    public dispose(): void {
      this.reset();
      this._disposed = true;
    }

    /** Intended strictly for tests. */
    public reset(): void {
      for (const supplier of this._treesBySupplier)
        supplier[1].forEach((_key, value) => value.dispose());

      this._treesBySupplier.clear();
    }

    public async getTileTreeProps(id: string): Promise<TileTreeProps> {
      return IModelApp.tileAdmin.requestTileTreeProps(this._iModel, id);
    }

    public async getTileContent(treeId: string, contentId: string, isCanceled: () => boolean, guid: string | undefined, qualifier: string | undefined): Promise<Uint8Array> {
      return IModelApp.tileAdmin.requestTileContent(this._iModel, treeId, contentId, isCanceled, guid, qualifier);
    }

    public async purgeTileTrees(modelIds: Id64Array | undefined): Promise<void> {
      return IModelApp.tileAdmin.purgeTileTrees(this._iModel, modelIds);
    }

    public getTileTreeOwner(id: any, supplier: TileTreeSupplier): TileTreeOwner {
      let trees = this._treesBySupplier.get(supplier);
      if (undefined === trees) {
        trees = new Dictionary<any, TreeOwner>((lhs, rhs) => supplier.compareTileTreeIds(lhs, rhs));
        this._treesBySupplier.set(supplier, trees);
      }

      let tree = trees.get(id);
      if (undefined === tree) {
        tree = new TreeOwner(id, supplier, this._iModel);
        trees.set(id, tree);
      }

      return tree;
    }

    public dropSupplier(supplier: TileTreeSupplier): void {
      const trees = this._treesBySupplier.get(supplier);
      if (undefined === trees)
        return;

      trees.forEach((_key, value) => value.dispose());
      this._treesBySupplier.delete(supplier);
    }

    public forEachTreeOwner(func: (owner: TileTreeOwner) => void): void {
      for (const dict of this._treesBySupplier.values())
        dict.forEach((_key, value) => func(value));
    }

    /** Unload any tile trees which have not been drawn since at least the specified time, excluding any of the specified TileTrees. */
    public purge(olderThan: BeTimePoint, exclude?: Set<TileTree>): void {
      // NB: It would be nice to be able to detect completely useless leftover Owners or Suppliers, but we can't know if any TileTreeReferences exist pointing to a given Owner.
      for (const entry of this._treesBySupplier) {
        const dict = entry[1];
        dict.forEach((_treeId, owner) => {
          const tree = owner.tileTree;
          if (undefined !== tree && tree.lastSelectedTime.milliseconds < olderThan.milliseconds)
            if (undefined === exclude || !exclude.has(tree))
              owner.dispose();
        });
      }
    }
  }

  /**
   * General editing functions. See IModelApp.elementEditor for editing 3D elements.
   * @alpha
   */
  export class EditingFunctions {
    private _connection: IModelConnection;
    private _concurrencyControl?: EditingFunctions.ConcurrencyControl;
    private _models?: EditingFunctions.ModelEditor;
    private _categories?: EditingFunctions.CategoryEditor;
    private _codes?: EditingFunctions.Codes;

    /** @private */
    public constructor(c: IModelConnection) {
      if (c.isReadonly)
        throw new IModelError(IModelStatus.ReadOnly, "EditingFunctions not available", Logger.logError, loggerCategory);
      this._connection = c;
    }

    /**
     * Concurrency control functions
     * @alpha
     */
    public get concurrencyControl(): IModelConnection.EditingFunctions.ConcurrencyControl {
      if (this._concurrencyControl === undefined)
        this._concurrencyControl = new EditingFunctions.ConcurrencyControl(this._connection);
      return this._concurrencyControl;
    }

    /**
     * Model-editing functions
     * @alpha
     */
    public get models(): IModelConnection.EditingFunctions.ModelEditor {
      if (this._models === undefined)
        this._models = new EditingFunctions.ModelEditor(this._connection);
      return this._models;
    }

    /**
     * Category-editing functions
     * @alpha
     */
    public get categories(): IModelConnection.EditingFunctions.CategoryEditor {
      if (this._categories === undefined)
        this._categories = new EditingFunctions.CategoryEditor(this._connection);
      return this._categories;
    }

    /**
     * Code-creation functions
     * @alpha
     */
    public get codes(): IModelConnection.EditingFunctions.Codes {
      if (this._codes === undefined)
        this._codes = new EditingFunctions.Codes(this._connection);
      return this._codes;
    }

    /**
     * Delete elements
     * @param ids The elements to delete
     * @alpha
     */
    public async deleteElements(ids: Id64Array) {
      await IModelWriteRpcInterface.getClient().requestResources(this._connection.iModelToken, ids, [], DbOpcode.Delete);
      return IModelWriteRpcInterface.getClient().deleteElements(this._connection.iModelToken, ids);
    }

    /** Update the project extents of this iModel.
     * @param newExtents The new project extents as an AxisAlignedBox3d
     * @throws [[IModelError]] if the IModelConnection is read-only or there is a problem updating the extents.
     * @alpha
     */
    public async updateProjectExtents(newExtents: AxisAlignedBox3d): Promise<void> {
      if (OpenMode.ReadWrite !== this._connection.openMode)
        return Promise.reject(new IModelError(IModelStatus.ReadOnly, "IModelConnection was opened read-only", Logger.logError));
      return IModelWriteRpcInterface.getClient().updateProjectExtents(this._connection.iModelToken.toJSON(), newExtents.toJSON());
    }

    /** Commit pending changes to this iModel
     * @param description Optional description of the changes
     * @throws [[IModelError]] if the IModelConnection is read-only or there is a problem saving changes.
     * @alpha
     */
    public async saveChanges(description?: string): Promise<void> {
      if (OpenMode.ReadWrite !== this._connection.openMode)
        return Promise.reject(new IModelError(IModelStatus.ReadOnly, "IModelConnection was opened read-only", Logger.logError));

      const affectedModels = await IModelWriteRpcInterface.getClient().getModelsAffectedByWrites(this._connection.iModelToken.toJSON()); // TODO: Remove this when we get tile healing

      await IModelWriteRpcInterface.getClient().saveChanges(this._connection.iModelToken.toJSON(), description);

      IModelApp.viewManager.refreshForModifiedModels(affectedModels); // TODO: Remove this when we get tile healing
    }

    /**
     * Query if there are local changes that have not yet been pushed to the iModel server.
     * @alpha
     */
    // tslint:disable-next-line:prefer-get
    public async hasPendingTxns(): Promise<boolean> {
      return IModelWriteRpcInterface.getClient().hasPendingTxns(this._connection.iModelToken.toJSON());
    }

    /**
     * Query if there are in-memory changes that have not yet been saved to the briefcase.
     * @alpha
     */
    // tslint:disable-next-line:prefer-get
    public async hasUnsavedChanges(): Promise<boolean> {
      return IModelWriteRpcInterface.getClient().hasUnsavedChanges(this._connection.iModelToken.toJSON());
    }

    /**
     * Query the parent Changeset of the briefcase
     * @alpha
     */
    public async getParentChangeset(): Promise<string> {
      return IModelWriteRpcInterface.getClient().getParentChangeset(this._connection.iModelToken.toJSON());
    }
  }

  /**
   * @alpha
   */
  export namespace EditingFunctions {

    /**
     * Helper class for defining Codes.
     * @alpha
     */
    export class Codes {
      private _connection: IModelConnection;

      /** @private */
      public constructor(c: IModelConnection) {
        this._connection = c;
      }

      /**
       * Helper function to create a CodeProps object
       * @param specName Code spec
       * @param scope Scope element ID
       * @param value Code value
       * @alpha
       */
      public async makeCode(specName: string, scope: Id64String, value: string): Promise<CodeProps> {
        const modelCodeSpec = await this._connection.codeSpecs.getByName(specName);
        return { scope, spec: modelCodeSpec.id, value };
      }

      /**
       * Helper function to create a CodeProps object for a model
       * @param scope Scope element ID
       * @param value Code value
       * @alpha
       */
      public async makeModelCode(scope: Id64String, value: string): Promise<CodeProps> {
        return this.makeCode(BisCodeSpec.informationPartitionElement, scope, value);
      }
    }

    /**
     * Helper class for creating SpatialCategories.
     * @alpha
     */
    export class CategoryEditor {
      private _connection: IModelConnection;
      private _rpc: IModelWriteRpcInterface;

      /** @private */
      public constructor(c: IModelConnection) {
        this._connection = c;
        this._rpc = IModelWriteRpcInterface.getClient();
      }

      private get iModelToken(): IModelToken { return this._connection.iModelToken; }

      /**
       * Create and insert a new SpatialCategory. This first obtains the necessary locks and reserves the Code. This method is not suitable for creating many Categories.
       * @alpha
       */
      public async createAndInsertSpatialCategory(scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String> {
        return this._rpc.createAndInsertSpatialCategory(this.iModelToken, scopeModelId, categoryName, appearance);
      }
    }

    /**
     * Helper class for creating and editing models.
     * @alpha
     */
    export class ModelEditor {
      private _connection: IModelConnection;
      private _rpc: IModelWriteRpcInterface;

      /** @private */
      public constructor(c: IModelConnection) {
        this._connection = c;
        this._rpc = IModelWriteRpcInterface.getClient();
      }

      private get iModelToken(): IModelToken { return this._connection.iModelToken; }

      /**
       * Create and insert a new PhysicalParition element and a SpatialModel. This first obtains the necessary locks and reserves the Code. This method is not suitable for creating many models.
       * @alpha
       */
      public async createAndInsertPhysicalModel(newModelCode: CodeProps, privateModel?: boolean): Promise<Id64String> {
        return this._rpc.createAndInsertPhysicalModel(this.iModelToken, newModelCode, !!privateModel);
      }

    }

    /**
     * Concurrency control functions.
     * @alpha
     */
    export class ConcurrencyControl {
      private _connection: IModelConnection;
      private _rpc: IModelWriteRpcInterface;

      /** @private */
      public constructor(c: IModelConnection) {
        this._connection = c;
        this._rpc = IModelWriteRpcInterface.getClient();
      }

      private get iModelToken(): IModelToken { return this._connection.iModelToken; }

      /**
       * Send all pending requests for locks and codes to the server.
       */
      public async request(): Promise<void> {
        return this._rpc.doConcurrencyControlRequest(this.iModelToken);
      }

      /**
       * Lock a model.
       * @param modelId The model
       * @param level The lock level
       * @alpha
       */
      public async lockModel(modelId: Id64String, level: LockLevel = LockLevel.Shared): Promise<void> {
        return this._rpc.lockModel(this.iModelToken, modelId, level);
      }

      /**
       * Pull and merge new server changes and then (optionally) push local changes.
       * @param comment description of new changeset
       * @param doPush Pass false if you only want to pull and merge. Pass true to pull, merge, and push. The default is true (do the push).
       * @alpha
       */
      public async pullMergePush(comment: string, doPush: boolean = true): Promise<GuidString> {
        return this._rpc.pullMergePush(this.iModelToken, comment, doPush);
      }
    }
  }
}

class TreeOwner implements TileTreeOwner {
  private _tileTree?: TileTree;
  private _loadStatus: TileTreeLoadStatus = TileTreeLoadStatus.NotLoaded;
  private readonly _supplier: TileTreeSupplier;
  private readonly _iModel: IModelConnection;

  public readonly id: any;

  public get tileTree(): TileTree | undefined { return this._tileTree; }
  public get loadStatus(): TileTreeLoadStatus { return this._loadStatus; }

  public constructor(id: any, supplier: TileTreeSupplier, iModel: IModelConnection) {
    this.id = id;
    this._supplier = supplier;
    this._iModel = iModel;
  }

  public load(): TileTree | undefined {
    this._load(); // tslint:disable-line no-floating-promises
    return this.tileTree;
  }

  public async loadTree(): Promise<TileTree | undefined> {
    await this._load();
    return this.tileTree;
  }

  public dispose(): void {
    this._tileTree = dispose(this._tileTree);
    this._loadStatus = TileTreeLoadStatus.NotLoaded;
  }

  private async _load(): Promise<void> {
    if (TileTreeLoadStatus.NotLoaded !== this.loadStatus)
      return;

    this._loadStatus = TileTreeLoadStatus.Loading;
    let tree: TileTree | undefined;
    let newStatus: TileTreeLoadStatus;
    try {
      tree = await this._supplier.createTileTree(this.id, this._iModel);
      newStatus = undefined !== tree && !tree.rootTile.contentRange.isNull ? TileTreeLoadStatus.Loaded : TileTreeLoadStatus.NotFound;
    } catch (err) {
      newStatus = (err.errorNumber && err.errorNumber === IModelStatus.ServerTimeout) ? TileTreeLoadStatus.NotLoaded : TileTreeLoadStatus.NotFound;
    }

    if (TileTreeLoadStatus.Loading === this._loadStatus) {
      this._tileTree = tree;
      this._loadStatus = newStatus;
      IModelApp.viewManager.onNewTilesReady();
    }
  }
}
