/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelConnection */

import { assert, BeEvent, BentleyStatus, Id64, Id64Arg, Id64Set, Id64String, Logger, OpenMode, TransientIdSequence, DbResult } from "@bentley/bentleyjs-core";
import { Angle, Point3d, Range3dProps, XYAndZ } from "@bentley/geometry-core";
import {
  AxisAlignedBox3d, Cartographic, CodeSpec, ElementProps, EntityQueryParams, FontMap, GeoCoordStatus, ImageSourceFormat, IModel, IModelError,
  IModelNotFoundResponse, IModelReadRpcInterface, IModelStatus, IModelToken, IModelVersion, IModelWriteRpcInterface,
  ModelProps, ModelQueryParams, RpcNotFoundResponse, RpcOperation, RpcRequest, RpcRequestEvent, SnapRequestProps, SnapResponseProps,
  SnapshotIModelRpcInterface, ThumbnailProps, TileTreeProps, ViewDefinitionProps, ViewQueryParams, WipRpcInterface, IModelProps, QueryResponse, QueryPriority, QueryQuota, QueryLimit, QueryResponseStatus,
} from "@bentley/imodeljs-common";
import { EntityState } from "./EntityState";
import { GeoServices } from "./GeoServices";
import { IModelApp } from "./IModelApp";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { ModelState } from "./ModelState";
import { HiliteSet, SelectionSet } from "./SelectionSet";
import { ViewState } from "./ViewState";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { SubCategoriesCache } from "./SubCategoriesCache";
import { TileTreeState } from "./tile/TileTree";

const loggerCategory: string = FrontendLoggerCategory.IModelConnection;

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
  /** The maximum time (in milliseconds) to wait before timing out the request to open a connection to a new iModel */
  public static connectionTimeout: number = 10 * 60 * 1000;

  /** Check the [[openMode]] of this IModelConnection to see if it was opened read-only. */
  public get isReadonly(): boolean { return this.openMode === OpenMode.Readonly; }

  /** Check if the IModelConnection is still open. Returns false after [[IModelConnection.close]] has been called.
   * @alpha
   */
  public get isOpen(): boolean { return undefined !== (this._token as any); }

  /** Check if the IModelConnection has been closed. Returns true after [[IModelConnection.close]] has been called.
   * @alpha
   */
  public get isClosed(): boolean { return !this.isOpen; }

  /** Event called immediately before an IModelConnection is closed.
   * @note Be careful not to perform any asynchronous operations on the IModelConnection because it will close before they are processed.
   */
  public static readonly onClose = new BeEvent<(_imodel: IModelConnection) => void>();

  /** The font map for this IModelConnection. Only valid after calling #loadFontMap and waiting for the returned promise to be fulfilled. */
  public fontMap?: FontMap;

  /** Load the FontMap for this IModelConnection.
   * @returns Returns a Promise<FontMap> that is fulfilled when the FontMap member of this IModelConnection is valid.
   */
  public async loadFontMap(): Promise<FontMap> {
    return this.fontMap || (this.fontMap = new FontMap(JSON.parse(await IModelReadRpcInterface.getClient().readFontJson(this.iModelToken.toJSON()))));
  }
  /** The set of Context Reality Model tile trees for this IModelConnection.
   * @internal
   */
  private _contextRealityModelTileTrees = new Map<string, TileTreeState>();
  /** Get the context reality model tile tree for a URL.
   * @internal
   */
  public getContextRealityModelTileTree(url: string): TileTreeState {
    const found = this._contextRealityModelTileTrees.get(url);
    if (found !== undefined)
      return found;
    const tileTree = new TileTreeState(this, true, this.transientIds.next);
    this._contextRealityModelTileTrees.set(url, tileTree);
    return tileTree;
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
    return ctor; // either the baseClass handler or defaultClass if we didn't find a registered baseClass
  }

  private constructor(iModel: IModelProps, openMode: OpenMode) {
    super(IModelToken.fromJSON(iModel.iModelToken!));
    super.initialize(iModel.name!, iModel);
    this.openMode = openMode;
    this.models = new IModelConnection.Models(this);
    this.elements = new IModelConnection.Elements(this);
    this.codeSpecs = new IModelConnection.CodeSpecs(this);
    this.views = new IModelConnection.Views(this);
    this.selectionSet = new SelectionSet(this);
    this.hilited = new HiliteSet(this);
    this.tiles = new IModelConnection.Tiles(this);
    this.subcategories = new SubCategoriesCache(this);
    this.geoServices = new GeoServices(this);
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

    const connection = new IModelConnection(openResponse, openMode);
    RpcRequest.notFoundHandlers.addListener(connection._reopenConnectionHandler);

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

  private _reopenConnectionHandler = async (request: RpcRequest<RpcNotFoundResponse>, response: IModelNotFoundResponse, resubmit: () => void, reject: (reason: any) => void) => {
    if (!(response instanceof IModelNotFoundResponse))
      return;

    const iModelToken: IModelToken = request.parameters[0];
    if (this._token.key !== iModelToken.key)
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
    request.parameters[0] = this._token; // Modify the token of the original request before resubmitting it.
    resubmit();
  }

  /** Close this IModelConnection
   * In the case of ReadWrite connections ensure all changes are pushed to the iModelHub before making this call -
   * any un-pushed changes are lost after the close.
   */
  public async close(): Promise<void> {
    if (!this.iModelToken)
      return;

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    RpcRequest.notFoundHandlers.removeListener(this._reopenConnectionHandler);
    IModelConnection.onClose.raiseEvent(this);
    this.models.onIModelConnectionClose();  // free WebGL resources if rendering

    requestContext.useContextForRpc = true;
    const closePromise = IModelReadRpcInterface.getClient().close(this.iModelToken.toJSON()); // Ensure the method isn't await-ed right away.
    try {
      await closePromise;
    } finally {
      (this._token as any) = undefined; // prevent closed connection from being reused
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
    return new IModelConnection(openResponse, OpenMode.Readonly);
  }

  /** Close this IModelConnection to a read-only iModel *snapshot*.
   * @beta
   */
  public async closeSnapshot(): Promise<void> {
    if (!this.iModelToken)
      return;

    IModelConnection.onClose.raiseEvent(this);
    this.models.onIModelConnectionClose();  // free WebGL resources if rendering
    try {
      await SnapshotIModelRpcInterface.getClient().closeSnapshot(this.iModelToken.toJSON());
    } finally {
      (this._token as any) = undefined; // prevent closed connection from being reused
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
    Logger.logTrace(loggerCategory, "IModelConnection.queryRowCount", () => ({ ...this.iModelToken, ecsql, bindings }));
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
    Logger.logTrace(loggerCategory, "IModelConnection.queryRows", () => ({ ...this.iModelToken, ecsql, bindings, limit, quota, priority }));
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
   * @alpha
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

      if (result.status === QueryResponseStatus.Error)
        throw new IModelError(QueryResponseStatus.Error, "Failed to execute ECSQL");

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
  public async queryEntityIds(params: EntityQueryParams): Promise<Id64Set> { return new Set(await IModelReadRpcInterface.getClient().queryEntityIds(this.iModelToken.toJSON(), params)); }

  /** Update the project extents of this iModel.
   * @param newExtents The new project extents as an AxisAlignedBox3d
   * @throws [[IModelError]] if the IModelConnection is read-only or there is a problem updating the extents.
   */
  public async updateProjectExtents(newExtents: AxisAlignedBox3d): Promise<void> {
    Logger.logTrace(loggerCategory, "IModelConnection.updateProjectExtents", () => ({ ...this.iModelToken, newExtents }));
    if (OpenMode.ReadWrite !== this.openMode)
      return Promise.reject(new IModelError(IModelStatus.ReadOnly, "IModelConnection was opened read-only", Logger.logError));
    return IModelWriteRpcInterface.getClient().updateProjectExtents(this.iModelToken.toJSON(), newExtents.toJSON());
  }

  /** Commit pending changes to this iModel
   * @param description Optional description of the changes
   * @throws [[IModelError]] if the IModelConnection is read-only or there is a problem saving changes.
   */
  public async saveChanges(description?: string): Promise<void> {
    Logger.logTrace(loggerCategory, "IModelConnection.saveChanges", () => ({ ...this.iModelToken, description }));
    if (OpenMode.ReadWrite !== this.openMode)
      return Promise.reject(new IModelError(IModelStatus.ReadOnly, "IModelConnection was opened read-only", Logger.logError));
    return IModelWriteRpcInterface.getClient().saveChanges(this.iModelToken.toJSON(), description);
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

  /** Request a snap from the backend. */
  public async requestSnap(props: SnapRequestProps): Promise<SnapResponseProps> { return IModelReadRpcInterface.getClient().requestSnap(this.iModelToken.toJSON(), IModelApp.sessionId, props); }

  /** Request a tooltip from the backend.  */
  public async getToolTipMessage(id: string): Promise<string[]> { return IModelReadRpcInterface.getClient().getToolTipMessage(this.iModelToken.toJSON(), id); }

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
      throw new IModelError(IModelStatus.NoGeoLocation, "iModel does not have a Geographic Coordinate system. It may be Geolocated with an EcefTransform");

    const geoConverter = this.geoServices.getConverter();
    const coordResponse = await geoConverter.getGeoCoordinatesFromIModelCoordinates([spatial]);

    if (this._noGcsDefined = (1 !== coordResponse.geoCoords.length || GeoCoordStatus.NoGCSDefined === coordResponse.geoCoords[0].s))
      throw new IModelError(IModelStatus.NoGeoLocation, "iModel does not have a Geographic Coordinate system. It may be Geolocated with an EcefTransform");

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
      throw new IModelError(IModelStatus.NoGeoLocation, "iModel does not have a Geographic Coordinate system. It may be Geolocated with an EcefTransform");

    const geoConverter = this.geoServices.getConverter();
    const geoCoord = Point3d.create(Angle.radiansToDegrees(cartographic.longitude), Angle.radiansToDegrees(cartographic.latitude), cartographic.height); // x is longitude in degrees, y is latitude in degrees, z is height in meters...
    const coordResponse = await geoConverter.getIModelCoordinatesFromGeoCoordinates([geoCoord]);

    if (this._noGcsDefined = (1 !== coordResponse.iModelCoords.length || GeoCoordStatus.NoGCSDefined === coordResponse.iModelCoords[0].s))
      throw new IModelError(IModelStatus.NoGeoLocation, "iModel does not have a Geographic Coordinate system. It may be Geolocated with an EcefTransform");

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

    /** Get a batch of [[ModelProps]] given a list of Model ids. */
    public async getProps(modelIds: Id64Arg): Promise<ModelProps[]> {
      return IModelReadRpcInterface.getClient().getModelProps(this._iModel.iModelToken.toJSON(), [...Id64.toIdSet(modelIds)]);
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
      } catch (err) { }  // ignore error, we had nothing to do.
    }

    /** Query for a set of model ranges by ModelIds. */
    public async queryModelRanges(modelIds: Id64Arg): Promise<Range3dProps[]> {
      return IModelReadRpcInterface.getClient().queryModelRanges(this._iModel.iModelToken.toJSON(), [...Id64.toIdSet(modelIds)]);
    }

    /** Query for a set of ModelProps of the specified ModelQueryParams.
     * @param queryParams The query parameters. The `limit` and `offset` members should be used to page results.
     * @throws [IModelError]($common) If the generated statement is invalid or would return too many props.
     */
    public async queryProps(queryParams: ModelQueryParams): Promise<ModelProps[]> {
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
      return IModelReadRpcInterface.getClient().queryModelProps(this._iModel.iModelToken.toJSON(), params);
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

    /** Code to run when the IModelConnection has closed. */
    public onIModelConnectionClose() {
      this.loaded.forEach((value: ModelState) => {
        value.onIModelConnectionClose();
      });
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
      return IModelReadRpcInterface.getClient().getElementProps(this._iModel.iModelToken.toJSON(), [...Id64.toIdSet(arg)]);
    }

    /** Get an array  of [[ElementProps]] that satisfy a query
     * @param params The query parameters. The `limit` and `offset` members should be used to page results.
     * @throws [IModelError]($common) If the generated statement is invalid or would return too many props.
     */
    public async queryProps(params: EntityQueryParams): Promise<ElementProps[]> {
      return IModelReadRpcInterface.getClient().queryElementProps(this._iModel.iModelToken.toJSON(), params);
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
        this._loaded.push(new CodeSpec(this._iModel, Id64.fromString(codeSpec.id), codeSpec.name, codeSpec.jsonProperties));
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
      const params: ViewQueryParams = Object.assign({}, queryParams); // make a copy
      params.from = queryParams.from || ViewState.classFullName; // use "BisCore:ViewDefinition" as default class name
      params.where = queryParams.where || "";
      if (queryParams.wantPrivate === undefined || !queryParams.wantPrivate) {
        if (params.where.length > 0) params.where += " AND ";
        params.where += "IsPrivate=FALSE ";
      }
      const viewProps = await IModelReadRpcInterface.getClient().queryElementProps(this._iModel.iModelToken.toJSON(), params);
      assert((viewProps.length === 0) || ("categorySelectorId" in viewProps[0]), "invalid view definition");  // spot check that the first returned element is-a ViewDefinitionProps
      return viewProps as ViewDefinitionProps[];
    }

    /** Get an array of the ViewSpecs for all views in this IModel that satisfy a ViewQueryParams.
     *
     * This is typically used to create a list for UI.
     *
     * For example:
     * ```ts
     * [[include:IModelConnection.Views.getViewList]]
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

    /** Query the ID of the default view associated with this iModel. Applications can choose to use this as the default view to which to open a viewport upon startup, or the initial selection
     * within a view selection dialog, or similar purposes.
     * @returns the ID of the default view, or an invalid ID if no default view is defined.
     */
    public async queryDefaultViewId(): Promise<Id64String> {
      return IModelReadRpcInterface.getClient().getDefaultViewId(this._iModel.iModelToken.toJSON());
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
     * @throws `Error` exception if no thumbnail exists.
     */
    public async getThumbnail(viewId: Id64String): Promise<ThumbnailProps> {
      const val = await IModelReadRpcInterface.getClient().getViewThumbnail(this._iModel.iModelToken.toJSON(), viewId.toString());
      const intVals = new Uint16Array(val.buffer);
      return { format: intVals[1] === ImageSourceFormat.Jpeg ? "jpeg" : "png", width: intVals[2], height: intVals[3], image: new Uint8Array(val.buffer, 8, intVals[0]) };
    }

    /** Save a thumbnail for a view.
     * @param viewId The id of the view for the thumbnail.
     * @param thumbnail The thumbnail data to save.
     * @returns A void Promise
     * @throws `Error` exception if the thumbnail wasn't successfully saved.
     */
    public async saveThumbnail(viewId: Id64String, thumbnail: ThumbnailProps): Promise<void> {
      const id = Id64.fromString(viewId.toString());
      const val = new Uint8Array(thumbnail.image.length + 16);  // include the viewId and metadata in the binary transfer by allocating a new buffer 16 bytes larger than the image size
      new Uint16Array(val.buffer).set([thumbnail.image.length, thumbnail.format === "jpeg" ? ImageSourceFormat.Jpeg : ImageSourceFormat.Png, thumbnail.width, thumbnail.height]); // metadata at offset 0
      const low32 = Id64.getLowerUint32(id);
      const high32 = Id64.getUpperUint32(id);
      new Uint32Array(val.buffer, 8).set([low32, high32]); // viewId is 8 bytes starting at offset 8
      new Uint8Array(val.buffer, 16).set(thumbnail.image); // image data at offset 16
      return IModelWriteRpcInterface.getClient().saveThumbnail(this._iModel.iModelToken.toJSON(), val);
    }
  }

  /** Provides access to tiles associated with an IModelConnection
   * @internal
   */
  export class Tiles {
    private _iModel: IModelConnection;
    constructor(iModel: IModelConnection) { this._iModel = iModel; }
    public async getTileTreeProps(id: string): Promise<TileTreeProps> { return IModelApp.tileAdmin.requestTileTreeProps(this._iModel, id); }
    public async getTileContent(treeId: string, contentId: string): Promise<Uint8Array> { return IModelApp.tileAdmin.requestTileContent(this._iModel, treeId, contentId); }
  }
}
