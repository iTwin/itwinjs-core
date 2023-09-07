/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import {
  assert, BeEvent, CompressedId64Set, GeoServiceStatus, GuidString, Id64, Id64Arg, Id64Set, Id64String, Logger, OneAtATimeAction, OpenMode,
  PickAsyncMethods, TransientIdSequence,
} from "@itwin/core-bentley";
import {
  AxisAlignedBox3d, Cartographic, CodeProps, CodeSpec, DbQueryRequest, DbResult, EcefLocation, EcefLocationProps, ECSqlReader, ElementLoadOptions,
  ElementMeshRequestProps,
  ElementProps, EntityQueryParams, FontMap, GeoCoordStatus, GeographicCRSProps, GeometryContainmentRequestProps, GeometryContainmentResponseProps, GeometrySummaryRequestProps, ImageSourceFormat, IModel, IModelConnectionProps, IModelError,
  IModelReadRpcInterface, IModelStatus, mapToGeoServiceStatus, MassPropertiesPerCandidateRequestProps, MassPropertiesPerCandidateResponseProps,
  MassPropertiesRequestProps, MassPropertiesResponseProps, ModelExtentsProps, ModelProps, ModelQueryParams, NoContentError, Placement, Placement2d,
  Placement3d, QueryBinder, QueryOptions, QueryOptionsBuilder, QueryRowFormat, RpcManager, SnapRequestProps, SnapResponseProps,
  SnapshotIModelRpcInterface, SubCategoryAppearance, SubCategoryResultRow, TextureData, TextureLoadProps, ThumbnailProps, ViewDefinitionProps,
  ViewIdString, ViewQueryParams, ViewStateLoadProps, ViewStateProps, ViewStoreRpc,
} from "@itwin/core-common";
import { Point3d, Range3d, Range3dProps, Transform, XYAndZ, XYZProps } from "@itwin/core-geometry";
import { BriefcaseConnection } from "./BriefcaseConnection";
import { CheckpointConnection } from "./CheckpointConnection";
import { FrontendLoggerCategory } from "./common/FrontendLoggerCategory";
import { EntityState } from "./EntityState";
import { GeoServices } from "./GeoServices";
import { IModelApp } from "./IModelApp";
import { IModelRoutingContext } from "./IModelRoutingContext";
import { ModelState } from "./ModelState";
import { HiliteSet, SelectionSet } from "./SelectionSet";
import { SubCategoriesCache } from "./SubCategoriesCache";
import { BingElevationProvider } from "./tile/internal";
import { Tiles } from "./Tiles";
import { ViewState } from "./ViewState";

const loggerCategory: string = FrontendLoggerCategory.IModelConnection;

/** The properties for creating a [Blank IModelConnection]($docs/learning/frontend/BlankConnection)
 * @public
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
  /** The optional Guid that identifies the iTwin associated with the [[BlankConnection]]. */
  iTwinId?: GuidString;
}

/** A connection to a [IModelDb]($backend) hosted on the backend.
 * @public
 * @extensions
 */
export abstract class IModelConnection extends IModel {
  /** The [[ModelState]]s in this IModelConnection. */
  public readonly models: IModelConnection.Models;
  /** The [[ElementState]]s in this IModelConnection. */
  public readonly elements: IModelConnection.Elements;
  /** The [[CodeSpec]]s in this IModelConnection. */
  public readonly codeSpecs: IModelConnection.CodeSpecs;
  /** The [[ViewState]]s in this IModelConnection. */
  public readonly views: IModelConnection.Views;
  /** The set of currently hilited elements for this IModelConnection. */
  public readonly hilited: HiliteSet;
  /** The set of currently selected elements for this IModelConnection. */
  public readonly selectionSet: SelectionSet;
  /** The set of Tiles for this IModelConnection. */
  public readonly tiles: Tiles;
  /** The set of [Category]($backend)'s in this IModelConnection. */
  public readonly categories: IModelConnection.Categories;
  /** A cache of information about SubCategories chiefly used for rendering.
   * @internal
   */
  public get subcategories(): SubCategoriesCache { return this.categories.cache; }
  /** Generator for unique Ids of transient graphics for this IModelConnection. */
  public readonly transientIds = new TransientIdSequence();
  /** The Geographic location services available for this iModelConnection. */
  public readonly geoServices: GeoServices;
  /** @internal Whether GCS has been disabled for this iModelConnection. */
  protected _gcsDisabled = false;
  /** @internal Return true if a GCS is not defined for this iModelConnection; also returns true if GCS is defined but disabled. */
  public get noGcsDefined(): boolean { return this._gcsDisabled || undefined === this.geographicCoordinateSystem; }
  /** @internal */
  public disableGCS(disable: boolean): void { this._gcsDisabled = disable; }
  /** The displayed extents of this iModel, initialized to [IModel.projectExtents]($common). The displayed extents can be made larger via
   * [[expandDisplayedExtents]], but never smaller, to accommodate data sources like reality models that may exceed the project extents.
   * @note Do not modify these extents directly - use [[expandDisplayedExtents]] only.
   * @deprecated in 3.6. These extents are still computed, but no longer used to determine the viewed extents of a [[SpatialViewState]]. It is not useful to
   * perpetually expand the iModel's extents.
   */
  public readonly displayedExtents: AxisAlignedBox3d;
  private readonly _extentsExpansion = Range3d.createNull();
  /** The maximum time (in milliseconds) to wait before timing out the request to open a connection to a new iModel */
  public static connectionTimeout: number = 10 * 60 * 1000;

  /** The RPC routing for this connection. */
  public routingContext: IModelRoutingContext = IModelRoutingContext.default;

  /** Type guard for instanceof [[BriefcaseConnection]] */
  public isBriefcaseConnection(): this is BriefcaseConnection { return false; }

  /** Type guard for instanceof [[CheckpointConnection]]
   * @beta
  */
  public isCheckpointConnection(): this is CheckpointConnection { return false; }

  /** Type guard for instanceof [[SnapshotConnection]] */
  public isSnapshotConnection(): this is SnapshotConnection { return false; }

  /** Type guard for instanceof [[BlankConnection]] */
  public isBlankConnection(): this is BlankConnection { return false; }

  /** Returns `true` if this is a briefcase copy of an iModel that is synchronized with iModelHub. */
  public get isBriefcase(): boolean { return this.isBriefcaseConnection(); }

  /** Returns `true` if this is a *snapshot* iModel.
   * @see [[SnapshotConnection.openSnapshot]]
   */
  public get isSnapshot(): boolean { return this.isSnapshotConnection(); }

  /** True if this is a [Blank Connection]($docs/learning/frontend/BlankConnection). */
  public get isBlank(): boolean { return this.isBlankConnection(); }

  /** Check the [[openMode]] of this IModelConnection to see if it was opened read-only. */
  public get isReadonly(): boolean { return this.openMode === OpenMode.Readonly; }

  /** Check if the IModelConnection is open (i.e. it has a *connection* to a backend server).
   * Returns false for [[BlankConnection]] instances and after [[IModelConnection.close]] has been called.
   * @note no RPC operations are valid on this IModelConnection if this method returns false.
   */
  public get isOpen(): boolean { return !this.isClosed; }

  /** Check if the IModelConnection is closed (i.e. it has no *connection* to a backend server).
   * Returns true for [[BlankConnection]] instances and after [[IModelConnection.close]] has been called.
   * @note no RPC operations are valid on this IModelConnection if this method returns true.
   */
  public abstract get isClosed(): boolean;

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
        const fontProps = await IModelReadRpcInterface.getClientForRouting(this.routingContext.token).readFontJson(this.getRpcProps());
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
      const baseClasses = await IModelReadRpcInterface.getClientForRouting(this.routingContext.token).getClassHierarchy(this.getRpcProps(), className);

      // Make sure some other async code didn't register this class while we were await-ing above
      ctor = IModelApp.lookupEntityClass(className) as T | undefined;
      if (undefined !== ctor)
        return ctor;

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

  /** @internal */
  protected constructor(iModelProps: IModelConnectionProps) {
    super(iModelProps);
    super.initialize(iModelProps.name!, iModelProps);
    this.models = new IModelConnection.Models(this);
    this.elements = new IModelConnection.Elements(this);
    this.codeSpecs = new IModelConnection.CodeSpecs(this);
    this.views = new IModelConnection.Views(this);
    this.categories = new IModelConnection.Categories(this);

    this.selectionSet = new SelectionSet(this);
    this.hilited = new HiliteSet(this);

    this.tiles = new Tiles(this);
    this.geoServices = GeoServices.createForIModel(this);
    /* eslint-disable-next-line deprecation/deprecation */
    this.displayedExtents = Range3d.fromJSON(this.projectExtents);

    this.onProjectExtentsChanged.addListener(() => {
      // Compute new displayed extents as the union of the ranges we previously expanded by with the new project extents.
      /* eslint-disable-next-line deprecation/deprecation */
      this.expandDisplayedExtents(this._extentsExpansion);
    });

    this.hilited.onModelSubCategoryModeChanged.addListener(() => {
      IModelApp.viewManager.onSelectionSetChanged(this);
    });
  }

  /** Called prior to connection closing. Raises close events and calls tiles.dispose.
   * @internal
   */
  protected beforeClose(): void {
    this.onClose.raiseEvent(this); // event for this connection
    IModelConnection.onClose.raiseEvent(this); // event for all connections
    this.tiles.dispose();
    this.subcategories.onIModelConnectionClose();
  }

  /** Close this IModelConnection. */
  public abstract close(): Promise<void>;

  /** Allow to execute query and read results along with meta data. The result are streamed.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/frontend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/frontend/ECSQLCodeExamples)
   * - [ECSQL Row Format]($docs/learning/ECSQLRowFormat)
   *
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param config Allow to specify certain flags which control how query is executed.
   * @returns Returns an [ECSqlReader]($common) which helps iterate over the result set and also give access to metadata.
   * @public
   * */
  public createQueryReader(ecsql: string, params?: QueryBinder, config?: QueryOptions): ECSqlReader {
    const executor = {
      execute: async (request: DbQueryRequest) => {
        return IModelReadRpcInterface.getClientForRouting(this.routingContext.token).queryRows(this.getRpcProps(), request);
      },
    };
    return new ECSqlReader(executor, ecsql, params, config);
  }

  /**
   * queries the BisCore.SubCategory table for the entries that are children of the passed categoryIds
   * @param compressedCategoryIds compressed category Ids
   * @returns array of SubCategoryResultRow
   * @internal
   */
  public async querySubCategories(compressedCategoryIds: CompressedId64Set): Promise<SubCategoryResultRow[]> {
    return IModelReadRpcInterface.getClientForRouting(this.routingContext.token).querySubCategories(this.getRpcProps(), compressedCategoryIds);
  }

  /** Execute a query and stream its results
   * The result of the query is async iterator over the rows. The iterator will get next page automatically once rows in current page has been read.
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/frontend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/frontend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param options Allow to specify certain flags which control how query is executed.
   * @returns Returns the query result as an *AsyncIterableIterator<any>*  which lazy load result as needed. The row format is determined by *rowFormat* parameter.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If there was any error while submitting, preparing or stepping into query
   * @deprecated in 3.7. Use [[createQueryReader]] instead; it accepts the same parameters.
   */
  public async * query(ecsql: string, params?: QueryBinder, options?: QueryOptions): AsyncIterableIterator<any> {
    const builder = new QueryOptionsBuilder(options);
    const reader = this.createQueryReader(ecsql, params, builder.getOptions());
    while (await reader.step())
      yield reader.formatCurrentRow();
  }

  /** Compute number of rows that would be returned by the ECSQL.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/frontend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/frontend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * See "[iTwin.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @returns Return row count.
   * @throws [IModelError]($common) If the statement is invalid
   * @deprecated in 3.7. Count the number of results using `count(*)` where the original query is a subquery instead. E.g., `SELECT count(*) FROM (<query-whose-rows-to-count>)`.
   */

  public async queryRowCount(ecsql: string, params?: QueryBinder): Promise<number> {
    for await (const row of this.createQueryReader(`select count(*) from (${ecsql})`, params)) {
      return row[0] as number;
    }
    throw new IModelError(DbResult.BE_SQLITE_ERROR, "Failed to get row count");
  }
  /** Cancel any previous query with same token and run execute the current specified query.
   * The result of the query is async iterator over the rows. The iterator will get next page automatically once rows in current page has been read.
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/frontend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/frontend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param token None empty restart token. The previous query with same token would be cancelled. This would cause
   * exception which user code must handle.
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param options Allow to specify certain flags which control how query is executed.
   * @returns Returns the query result as an *AsyncIterableIterator<any>*  which lazy load result as needed. The row format is determined by *rowFormat* parameter.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If there was any error while submitting, preparing or stepping into query
   * @deprecated in 3.7. Use [[createQueryReader]] instead. Pass in the restart token as part of the `config` argument; e.g., `{ restartToken: myToken }` or `new QueryOptionsBuilder().setRestartToken(myToken).getOptions()`.
   */
  public async * restartQuery(token: string, ecsql: string, params?: QueryBinder, options?: QueryOptions): AsyncIterableIterator<any> {
    for await (const row of this.createQueryReader(ecsql, params, new QueryOptionsBuilder(options).setRestartToken(token).getOptions())) {
      yield row;
    }
  }
  /** Query for a set of element ids that satisfy the supplied query params
   * @param params The query parameters. The `limit` and `offset` members should be used to page results.
   * @throws [IModelError]($common) If the generated statement is invalid or would return too many rows.
   */
  public async queryEntityIds(params: EntityQueryParams): Promise<Id64Set> {
    return new Set(this.isOpen ? await IModelReadRpcInterface.getClientForRouting(this.routingContext.token).queryEntityIds(this.getRpcProps(), params) : undefined);
  }

  private _snapRpc = new OneAtATimeAction<SnapResponseProps>(async (props: SnapRequestProps) => IModelReadRpcInterface.getClientForRouting(this.routingContext.token).requestSnap(this.getRpcProps(), IModelApp.sessionId, props));
  /** Request a snap from the backend.
   * @note callers must gracefully handle Promise rejected with AbandonedError
   * @internal
   */
  public async requestSnap(props: SnapRequestProps): Promise<SnapResponseProps> {
    return this.isOpen ? this._snapRpc.request(props) : { status: 2 };
  }

  private _toolTipRpc = new OneAtATimeAction<string[]>(async (id: string) => IModelReadRpcInterface.getClientForRouting(this.routingContext.token).getToolTipMessage(this.getRpcProps(), id));
  /** Request a tooltip from the backend.
   * @note If another call to this method occurs before preceding call(s) return, all preceding calls will be abandoned - only the most recent will resolve. Therefore callers must gracefully handle Promise rejected with AbandonedError.
   */
  public async getToolTipMessage(id: Id64String): Promise<string[]> {
    return this.isOpen ? this._toolTipRpc.request(id) : [];
  }

  /** Request element clip containment status from the backend. */
  public async getGeometryContainment(requestProps: GeometryContainmentRequestProps): Promise<GeometryContainmentResponseProps> { return IModelReadRpcInterface.getClientForRouting(this.routingContext.token).getGeometryContainment(this.getRpcProps(), requestProps); }

  /** Obtain a summary of the geometry belonging to one or more [GeometricElement]($backend)s suitable for debugging and diagnostics.
   * @param requestProps Specifies the elements to query and options for how to format the output.
   * @returns A string containing the summary, typically consisting of multiple lines.
   * @note Trying to parse the output to programmatically inspect an element's geometry is not recommended.
   * @see [GeometryStreamIterator]($common) to more directly inspect a geometry stream.
   */
  public async getGeometrySummary(requestProps: GeometrySummaryRequestProps): Promise<string> {
    return IModelReadRpcInterface.getClientForRouting(this.routingContext.token).getGeometrySummary(this.getRpcProps(), requestProps);
  }

  /** Request a named texture image from the backend.
   * @param textureLoadProps The texture load properties which must contain a name property (a valid 64-bit integer identifier). It optionally can contain the maximum texture size supported by the client.
   * @see [[Id64]]
   * @public
   */
  public async queryTextureData(textureLoadProps: TextureLoadProps): Promise<TextureData | undefined> {
    if (this.isOpen) {
      const rpcClient = IModelReadRpcInterface.getClientForRouting(this.routingContext.token);
      const img = rpcClient.queryTextureData(this.getRpcProps(), textureLoadProps);
      return img;
    }
    return undefined;
  }

  /** Request element mass properties from the backend.
   * @note For better performance use [[getMassPropertiesPerCandidate]] when called from a loop with identical operations and a single candidate per iteration.
   */
  public async getMassProperties(requestProps: MassPropertiesRequestProps): Promise<MassPropertiesResponseProps> {
    return IModelReadRpcInterface.getClientForRouting(this.routingContext.token).getMassProperties(this.getRpcProps(), requestProps);
  }

  /** Request mass properties for multiple elements from the backend. */
  public async getMassPropertiesPerCandidate(requestProps: MassPropertiesPerCandidateRequestProps): Promise<MassPropertiesPerCandidateResponseProps[]> {
    return IModelReadRpcInterface.getClientForRouting(this.routingContext.token).getMassPropertiesPerCandidate(this.getRpcProps(), requestProps);
  }

  /** Produce encoded [Polyface]($core-geometry)s from the geometry stream of a [GeometricElement]($backend).
   * A polyface is produced for each geometric entry in the element's geometry stream, excluding geometry like open curves that can't be converted into polyfaces.
   * The polyfaces can be decoded using [readElementMeshes]($common).
   * Symbology, UV parameters, and normal vectors are not included in the result.
   * @param requestProps A description of how to produce the polyfaces and from which element to obtain them.
   * @returns an encoded list of polyfaces that can be decoded by [readElementMeshes]($common).
   * @throws Error if [ElementMeshRequestProps.source]($common) does not refer to a [GeometricElement]($backend).
   * @note This function is intended to support limited analysis of an element's geometry as a mesh. It is not intended for producing graphics.
   * @see [[TileAdmin.requestElementGraphics]] to obtain meshes appropriate for display.
   * @beta
   */
  public async generateElementMeshes(requestProps: ElementMeshRequestProps): Promise<Uint8Array> {
    return IModelReadRpcInterface.getClientForRouting(this.routingContext.token).generateElementMeshes(this.getRpcProps(), requestProps);
  }

  /** Convert a point in this iModel's Spatial coordinates to a [[Cartographic]] using the Geographic location services for this IModelConnection.
   * @param spatial A point in the iModel's spatial coordinates
   * @param result If defined, use this for output
   * @returns A Cartographic location (Horizontal datum depends on iModel's GCS)
   * @throws IModelError if [[isGeoLocated]] is false or point could not be converted.
   * @see [[cartographicFromSpatial]] if you have more than one point to convert, or you don't know whether the iModel has a GCS.
   */
  public async spatialToCartographicFromGcs(spatial: XYAndZ, result?: Cartographic): Promise<Cartographic> {
    if (!this.isGeoLocated && this.noGcsDefined)
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");

    const geoConverter = this.geoServices.getConverter()!;
    const coordResponse = await geoConverter.getGeoCoordinatesFromIModelCoordinates([spatial]);

    if (1 !== coordResponse.geoCoords.length || GeoCoordStatus.NoGCSDefined === coordResponse.geoCoords[0].s)
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");

    if (GeoCoordStatus.Success !== coordResponse.geoCoords[0].s) {
      const geoServiceStatus = mapToGeoServiceStatus(coordResponse.geoCoords[0].s);
      throw new IModelError(geoServiceStatus, "Error converting spatial to cartographic");
    }

    const longLatHeight = Point3d.fromJSON(coordResponse.geoCoords[0].p); // x is longitude in degrees, y is latitude in degrees, z is height in meters...
    return Cartographic.fromDegrees({ longitude: longLatHeight.x, latitude: longLatHeight.y, height: longLatHeight.z }, result);
  }

  /** Convert a point in this iModel's Spatial coordinates to a [[Cartographic]] using the Geographic location services for this IModelConnection or [[IModel.ecefLocation]].
   * @param spatial A point in the iModel's spatial coordinates
   * @param result If defined, use this for output
   * @returns A Cartographic location (Horizontal datum depends on iModel's GCS)
   * @throws IModelError if [[isGeoLocated]] is false or point could not be converted.
   * @see [[cartographicFromSpatial]] to convert multiple points at once.
   * @see [[spatialToCartographicFromEcef]] to synchronously convert points using the iModel's ECEF transform.
   */
  public async spatialToCartographic(spatial: XYAndZ, result?: Cartographic): Promise<Cartographic> {
    return (this.noGcsDefined ? this.spatialToCartographicFromEcef(spatial, result) : this.spatialToCartographicFromGcs(spatial, result));
  }

  /** Convert points in this iModel's spatial coordinate system to [Cartographic]($common) coordinates using either a [[GeoConverter]] or the iModel's [EcefLocation]($common).
   * @param spatial Coordinates to be converted from the iModel's spatial coordinate system
   * @returns The `spatial` coordinates converted to cartographic coordinates, of the same length and order as the `spatial`.
   * @throws IModelError if [[isGeoLocated]] is false or any point could not be converted.
   * @see [[spatialFromCartographic]] to perform the inverse conversion.
   * @see [[spatialToCartographicFromEcef]] to synchronously convert points using the iModel's ECEF transform.
   */
  public async cartographicFromSpatial(spatial: XYAndZ[]): Promise<Cartographic[]> {
    return this.cartographicFromSpatialWithGcs(spatial);
  }

  /** Convert points in this iModel's spatial coordinate system to [Cartographic]($common) coordinates using either a [[GeoConverter]] or the iModel's [EcefLocation]($common).
   * @param spatial Coordinates to be converted from the iModel's spatial coordinate system
   * @returns The `spatial` coordinates converted to cartographic coordinates (WGS84 horizontal datum), of the same length and order as the `spatial`.
   * @throws IModelError if [[isGeoLocated]] is false or any point could not be converted.
   * @see [[cartographicFromSpatial]] to perform conversion using iModel's GCS horizontal datum
   * @beta
   */
  public async wgs84CartographicFromSpatial(spatial: XYAndZ[]): Promise<Cartographic[]> {
    return this.cartographicFromSpatialWithGcs(spatial, "WGS84");
  }

  /** @internal */
  public async cartographicFromSpatialWithGcs(spatial: XYAndZ[], datumOrGCRS?: string | GeographicCRSProps): Promise<Cartographic[]> {
    if (this.noGcsDefined)
      return spatial.map((p) => this.spatialToCartographicFromEcef(p));

    if (!this.isGeoLocated)
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");

    if (!this.isOpen)
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not open");

    if (spatial.length === 0)
      return [];

    const geoConverter = this.geoServices.getConverter(datumOrGCRS);
    assert(undefined !== geoConverter);

    const coordResponse = await geoConverter.getGeoCoordinatesFromIModelCoordinates(spatial);
    if (coordResponse.geoCoords.length !== spatial.length)
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");

    return coordResponse.geoCoords.map((coord) => {
      switch (coord.s) {
        case GeoCoordStatus.NoGCSDefined:
          throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");
        case GeoCoordStatus.Success:
          const llh = Point3d.fromJSON(coord.p);
          return Cartographic.fromDegrees({ longitude: llh.x, latitude: llh.y, height: llh.z });
        default:
          throw new IModelError(mapToGeoServiceStatus(coord.s), "Error converting spatial to cartographic");
      }
    });
  }

  /** Convert a [Cartographic]($common) to a point in this iModel's spatial coordinate system using a [[GeoConverter]].
   * @param cartographic A cartographic location
   * @param result If defined, use this for output
   * @returns A point in this iModel's spatial coordinates
   * @throws IModelError if [[isGeoLocated]] is false or cartographic location could not be converted.
   * @see [[spatialFromCartographic]] to convert multiple points at once, or you don't know whether the iModel has a GCS.
   */
  public async cartographicToSpatialFromGcs(cartographic: Cartographic, result?: Point3d): Promise<Point3d> {
    if (!this.isGeoLocated && this.noGcsDefined)
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");

    const geoConverter = this.geoServices.getConverter()!;
    const geoCoord = Point3d.create(cartographic.longitudeDegrees, cartographic.latitudeDegrees, cartographic.height); // x is longitude in degrees, y is latitude in degrees, z is height in meters...
    const coordResponse = await geoConverter.getIModelCoordinatesFromGeoCoordinates([geoCoord]);

    if (1 !== coordResponse.iModelCoords.length || GeoCoordStatus.NoGCSDefined === coordResponse.iModelCoords[0].s)
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");

    if (GeoCoordStatus.Success !== coordResponse.iModelCoords[0].s) {
      const geoServiceStatus = mapToGeoServiceStatus(coordResponse.iModelCoords[0].s);
      throw new IModelError(geoServiceStatus, "Error converting cartographic to spatial");
    }

    result = result ? result : Point3d.createZero();
    result.setFromJSON(coordResponse.iModelCoords[0].p);
    return result;
  }

  /** Convert a [Cartographic]($common) to a point in this iModel's Spatial coordinates using a [[GeoConverter]] or[[IModel.ecefLocation]($common).
   * @param cartographic A cartographic location
   * @param result If defined, use this for output
   * @returns A point in this iModel's spatial coordinates
   * @throws IModelError if [[isGeoLocated]] is false or cartographic location could not be converted.
   * @see [[spatialFromCartographic]] to convert multiple points at once.
   * @see [[cartographicToSpatialFromEcef]] to synchronously convert points using the iModel's ECEF transform.
   */
  public async cartographicToSpatial(cartographic: Cartographic, result?: Point3d): Promise<Point3d> {
    return (this.noGcsDefined ? this.cartographicToSpatialFromEcef(cartographic, result) : this.cartographicToSpatialFromGcs(cartographic, result));
  }

  /** Convert [Cartographic]($common) coordinates into points in this iModel's spatial coordinate system using a [[GeoConverter]] or the iModel's [EcefLocation]($common).
   * @param cartographic Coordinates to be converted to the iModel's spatial coordinate system.
   * @returns The `cartographic` coordinates converted to spatial coordinates, of the same length and order as `cartographic`.
   * @throws IModelError if [[isGeoLocated]] is false or any point could not be converted.
   * @see [[cartographicFromSpatial]] to perform the inverse conversion.
   */
  public async spatialFromCartographic(cartographic: Cartographic[]): Promise<Point3d[]> {
    if (this.noGcsDefined)
      return cartographic.map((p) => this.cartographicToSpatialFromEcef(p));

    const geoCoords = cartographic.map((p) => Point3d.create(p.longitudeDegrees, p.latitudeDegrees, p.height));
    return this.toSpatialFromGcs(geoCoords);
  }

  /** Convert geographic coordinates into points in this iModel's spatial coordinate system using a [[GeoConverter]] or the iModel's [EcefLocation]($common).
   * @param geoCoords Coordinates to be converted are in the coordinate system described by the `datumOrGCRS` parameter.  Defaults iModel's spatial coordinate system otherwise.
   * @param datumOrGCRS Datum name or Geographic CRS object definition to use for the conversion.
   * @returns The `geographics` coordinates converted to spatial coordinates, of the same length and order as `geographics`.
   * @throws IModelError if [[isGeoLocated]] is false or any point could not be converted.
   * @beta
   */
  public async toSpatialFromGcs(geoCoords: XYAndZ[], datumOrGCRS?: string | GeographicCRSProps): Promise<Point3d[]> {

    if (!this.isGeoLocated)
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");

    if (!this.isOpen)
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not open");

    if (geoCoords.length === 0)
      return [];

    const geoConverter = this.geoServices.getConverter(datumOrGCRS);
    assert(undefined !== geoConverter);

    const coordResponse = await geoConverter.getIModelCoordinatesFromGeoCoordinates(geoCoords);
    if (coordResponse.iModelCoords.length !== geoCoords.length)
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");

    return coordResponse.iModelCoords.map((coord) => {
      switch (coord.s) {
        case GeoCoordStatus.NoGCSDefined:
          throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");
        case GeoCoordStatus.Success:
          return Point3d.fromJSON(coord.p);
        default:
          throw new IModelError(mapToGeoServiceStatus(coord.s), "Error converting cartographic to spatial");
      }
    });
  }

  /** Expand this iModel's [[displayedExtents]] to include the specified range.
   * This is done automatically when reality models are added to a spatial view. In some cases a [[TiledGraphicsProvider]] may wish to expand
   * the extents explicitly to include its geometry.
   * @deprecated in 3.6. See [[displayedExtents]].
   */
  public expandDisplayedExtents(range: Range3d): void {
    this._extentsExpansion.extendRange(range);
    /* eslint-disable-next-line deprecation/deprecation */
    this.displayedExtents.setFrom(this.projectExtents);
    /* eslint-disable-next-line deprecation/deprecation */
    this.displayedExtents.extendRange(this._extentsExpansion);
  }

  /** @internal */
  public getMapEcefToDb(bimElevationBias: number): Transform {
    if (!this.ecefLocation)
      return Transform.createIdentity();

    const mapEcefToDb = this.ecefLocation.getTransform().inverse();
    if (!mapEcefToDb) {
      assert(false);
      return Transform.createIdentity();
    }
    mapEcefToDb.origin.z += bimElevationBias;

    return mapEcefToDb;
  }
  private _geodeticToSeaLevel?: number | Promise<number>;
  private _projectCenterAltitude?: number | Promise<number>;

  /** Event called immediately after map elevation request is completed. This occurs only in the case where background map terrain is displayed
   * with either geoid or ground offset. These require a query to BingElevation and therefore synching the view may be required
   * when the request is completed.
   * @internal
   */
  public readonly onMapElevationLoaded = new BeEvent<(_imodel: IModelConnection) => void>();

  /** The offset between sea level and the geodetic ellipsoid. This will return undefined only if the request for the offset to Bing Elevation
   * is required, and in this case the [[onMapElevationLoaded]] event is raised when the request is completed.
   * @internal
   */
  public get geodeticToSeaLevel(): number | undefined {
    if (undefined === this._geodeticToSeaLevel) {
      const elevationProvider = new BingElevationProvider();
      this._geodeticToSeaLevel = elevationProvider.getGeodeticToSeaLevelOffset(this.projectExtents.center, this);
      this._geodeticToSeaLevel.then((geodeticToSeaLevel) => {
        this._geodeticToSeaLevel = geodeticToSeaLevel;
        this.onMapElevationLoaded.raiseEvent(this);
      }).catch((_error) => this._geodeticToSeaLevel = 0.0);
    }
    return ("number" === typeof this._geodeticToSeaLevel) ? this._geodeticToSeaLevel : undefined;
  }

  /** The altitude (geodetic) at the project center. This will return undefined only if the request for the offset to Bing Elevation
   * is required, and in this case the [[onMapElevationLoaded]] event is raised when the request is completed.
   * @internal
   */
  public get projectCenterAltitude(): number | undefined {
    if (undefined === this._projectCenterAltitude) {
      const elevationProvider = new BingElevationProvider();
      this._projectCenterAltitude = elevationProvider.getHeightValue(this.projectExtents.center, this);
      this._projectCenterAltitude.then((projectCenterAltitude) => {
        this._projectCenterAltitude = projectCenterAltitude;
        this.onMapElevationLoaded.raiseEvent(this);
      }).catch((_error) => this._projectCenterAltitude = 0.0);
    }
    return ("number" === typeof this._projectCenterAltitude) ? this._projectCenterAltitude : undefined;
  }
}

/** A connection that exists without an iModel. Useful for connecting to Reality Data services.
 * @note This class exists because our display system requires an IModelConnection type even if only reality data is drawn.
 * @public
 */
export class BlankConnection extends IModelConnection {
  public override isBlankConnection(): this is BlankConnection { return true; }

  /** The Guid that identifies the iTwin for this BlankConnection.
   * @note This can also be set via the [[create]] method using [[BlankConnectionProps.iTwinId]].
   */
  public override get iTwinId(): GuidString | undefined { return this._iTwinId; }
  public override set iTwinId(iTwinId: GuidString | undefined) { this._iTwinId = iTwinId; }
  /** A BlankConnection does not have an associated iModel, so its `iModelId` is alway `undefined`. */
  public override get iModelId(): undefined { return undefined; } // GuidString | undefined for the superclass, but always undefined for BlankConnection

  /** A BlankConnection is always considered closed because it does not have a specific backend nor associated iModel.
   * @returns `true` is always returned since RPC operations and iModel queries are not valid.
   * @note Even though true is always returned, it is still valid to call [[close]] to dispose frontend resources.
   */
  public get isClosed(): boolean { return true; }

  /** Create a new [Blank IModelConnection]($docs/learning/frontend/BlankConnection).
   * @param props The properties to use for the new BlankConnection.
   */
  public static create(props: BlankConnectionProps): BlankConnection {
    return new this({
      rootSubject: { name: props.name },
      projectExtents: props.extents,
      globalOrigin: props.globalOrigin,
      ecefLocation: props.location instanceof Cartographic ? EcefLocation.createFromCartographicOrigin(props.location) : props.location,
      key: "",
      iTwinId: props.iTwinId,
    });
  }

  /** There are no connections to the backend to close in the case of a BlankConnection.
   * However, there are frontend resources (like the tile cache) that can be disposed.
   * @note A BlankConnection should not be used after calling `close`.
   */
  public async close(): Promise<void> {
    this.beforeClose();
  }

  /** @internal */
  public closeSync(): void {
    this.beforeClose();
  }
}

/** A connection to a [SnapshotDb]($backend) hosted on a backend.
 * @public
 */
export class SnapshotConnection extends IModelConnection {
  /** Type guard for instanceof [[SnapshotConnection]] */
  public override isSnapshotConnection(): this is SnapshotConnection { return true; }

  /** The Guid that identifies this iModel. */
  public override get iModelId(): GuidString { return super.iModelId!; } // GuidString | undefined for the superclass, but required for SnapshotConnection

  /** Returns `true` if [[close]] has already been called. */
  public get isClosed(): boolean { return this._isClosed ? true : false; }
  private _isClosed?: boolean;

  /** Returns `true` if this is a connection to a remote snapshot iModel resolved by the backend.
   * @see [[openRemote]]
   */
  public get isRemote(): boolean { return this._isRemote ? true : false; }
  private _isRemote?: boolean;

  /** Open an IModelConnection to a read-only snapshot iModel from a file name.
   * @note This method is intended for desktop or mobile applications and should not be used for web applications.
   */
  public static async openFile(filePath: string): Promise<SnapshotConnection> {
    const routingContext = IModelRoutingContext.current || IModelRoutingContext.default;
    RpcManager.setIModel({ iModelId: "undefined", key: filePath });

    const openResponse = await SnapshotIModelRpcInterface.getClientForRouting(routingContext.token).openFile(filePath);
    Logger.logTrace(loggerCategory, "SnapshotConnection.openFile", () => ({ filePath }));
    const connection = new SnapshotConnection(openResponse);
    connection.routingContext = routingContext;
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /** Open an IModelConnection to a remote read-only snapshot iModel from a key that will be resolved by the backend.
   * @note This method is intended for web applications.
   */
  public static async openRemote(fileKey: string): Promise<SnapshotConnection> {
    const routingContext = IModelRoutingContext.current || IModelRoutingContext.default;
    RpcManager.setIModel({ iModelId: "undefined", key: fileKey });

    const openResponse = await SnapshotIModelRpcInterface.getClientForRouting(routingContext.token).openRemote(fileKey);
    Logger.logTrace(loggerCategory, "SnapshotConnection.openRemote", () => ({ fileKey }));
    const connection = new SnapshotConnection(openResponse);
    connection.routingContext = routingContext;
    connection._isRemote = true;
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /** Close this SnapshotConnection.
   * @note For local snapshot files, `close` closes the connection and the underlying [SnapshotDb]($backend) database file.
   * For remote snapshots, `close` only closes the connection and frees any frontend resources allocated to the connection.
   * @see [[openFile]], [[openRemote]]
   */
  public async close(): Promise<void> {
    if (this.isClosed)
      return;

    this.beforeClose();
    try {
      if (!this.isRemote) {
        await SnapshotIModelRpcInterface.getClientForRouting(this.routingContext.token).close(this.getRpcProps());
      }
    } finally {
      this._isClosed = true;
    }
  }
}

/** @public */
export namespace IModelConnection { // eslint-disable-line no-redeclare

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
  export class Models implements Iterable<ModelState> {
    private _loaded = new Map<string, ModelState>();

    /** @internal */
    public get loaded(): Map<string, ModelState> { return this._loaded; }

    /** An iterator over all currently-loaded models. */
    public [Symbol.iterator](): Iterator<ModelState> {
      return this._loaded.values()[Symbol.iterator]();
    }

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
      return iModel.isOpen ? IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token).getModelProps(iModel.getRpcProps(), [...Id64.toIdSet(modelIds)]) : [];
    }

    /** Find a ModelState in the set of loaded Models by ModelId. */
    public getLoaded(id: string): ModelState | undefined {
      return this._loaded.get(id);
    }

    /** Given a set of modelIds, return the subset of corresponding models that are not currently loaded.
     * @param modelIds The set of model Ids
     * @returns The subset of the supplied Ids corresponding to models that are not currently loaded, or undefined if all of the specified models are loaded.
     */
    public filterLoaded(modelIds: Id64Arg): Id64Set | undefined {
      let unloaded: Set<string> | undefined;
      for (const id of Id64.iterable(modelIds)) {
        if (undefined === this.getLoaded(id)) {
          if (undefined === unloaded)
            unloaded = new Set<string>();

          unloaded.add(id);
        }
      }

      return unloaded;
    }

    /** load a set of Models by Ids. After the returned Promise resolves, you may get the ModelState objects by calling getLoadedModel. */
    public async load(modelIds: Id64Arg): Promise<void> {
      const notLoaded = this.filterLoaded(modelIds);
      if (undefined === notLoaded)
        return; // all requested models are already loaded

      try {
        const propArray = await this.getProps(notLoaded);
        await this.updateLoadedWithModelProps(propArray);
      } catch (err) {
        // ignore error, we had nothing to do.
      }
    }

    /** Given an array of modelProps, find the class for each model and construct it. save it in the iModelConnection's loaded set. */
    public async updateLoadedWithModelProps(modelProps: ModelProps[]): Promise<void> {
      try {
        for (const props of modelProps) {
          const ctor = await this._iModel.findClassFor(props.classFullName, ModelState);
          if (undefined === this.getLoaded(props.id!)) { // do not overwrite if someone else loads it while we await
            const modelState = new ctor!(props, this._iModel); // create a new instance of the appropriate ModelState subclass
            this._loaded.set(modelState.id, modelState); // save it in loaded set
          }
        }
      } catch (err) {
        // ignore error, we had nothing to do.
      }
    }

    /** Remove a model from the set of loaded models. Used internally by BriefcaseConnection in response to txn events.
     * @internal
     */
    public unload(modelId: Id64String): void {
      this._loaded.delete(modelId);
    }

    /** Query for a set of model ranges by ModelIds.
     * @param modelIds the Id or Ids of the [GeometricModel]($backend)s for which to query the ranges.
     * @returns An array containing the range of each model of each unique model Id, omitting the range for any Id which did no identify a GeometricModel.
     * @note The contents of the returned array do not follow a deterministic order.
     * @throws [IModelError]($common) if exactly one model Id is specified and that Id does not identify a GeometricModel.
     * @see [[queryExtents]] for a similar function that does not throw and produces a deterministically-ordered result.
     */
    public async queryModelRanges(modelIds: Id64Arg): Promise<Range3dProps[]> {
      const iModel = this._iModel;
      return iModel.isOpen ? IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token).queryModelRanges(iModel.getRpcProps(), [...Id64.toIdSet(modelIds)]) : [];
    }

    /** For each [GeometricModel]($backend) specified by Id, attempts to obtain the union of the volumes of all geometric elements within that model.
     * @param modelIds The Id or Ids of the geometric models for which to obtain the extents.
     * @returns An array of results, one per supplied Id, in the order in which the Ids were supplied. If the extents could not be obtained, the
     * corresponding results entry's `extents` will be a "null" range (@see [Range3d.isNull]($geometry) and its `status` will indicate
     * why the extents could not be obtained (e.g., because the Id did not identify a [GeometricModel]($backend)).
     */
    public async queryExtents(modelIds: Id64String | Id64String[]): Promise<ModelExtentsProps[]> {
      const iModel = this._iModel;
      if (!iModel.isOpen)
        return [];

      if (typeof modelIds === "string")
        modelIds = [modelIds];

      return IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token).queryModelExtents(iModel.getRpcProps(), modelIds);
    }

    /** Query for a set of ModelProps of the specified ModelQueryParams.
     * @param queryParams The query parameters. The `limit` and `offset` members should be used to page results.
     * @throws [IModelError]($common) If the generated statement is invalid or would return too many props.
     */
    public async queryProps(queryParams: ModelQueryParams): Promise<ModelProps[]> {
      const iModel = this._iModel;
      if (!iModel.isOpen)
        return [];
      const params: ModelQueryParams = { ...queryParams }; // make a copy
      params.from = queryParams.from || ModelState.classFullName; // use "BisCore:Model" as default class name
      params.where = queryParams.where || "";
      if (!queryParams.wantPrivate) {
        if (params.where.length > 0)
          params.where += " AND ";

        params.where += "IsPrivate=FALSE ";
      }
      if (!queryParams.wantTemplate) {
        if (params.where.length > 0)
          params.where += " AND ";

        params.where += "IsTemplate=FALSE ";
      }
      return IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token).queryModelProps(iModel.getRpcProps(), params);
    }

    /** Asynchronously stream ModelProps using the specified ModelQueryParams. */
    public async * query(queryParams: ModelQueryParams): AsyncIterableIterator<ModelProps> {
      // NOTE: this implementation has the desired API signature, but its implementation must be improved to actually page results
      const modelPropsArray: ModelProps[] = await this.queryProps(queryParams);
      for (const modelProps of modelPropsArray) {
        yield modelProps;
      }
    }
  }

  /** Options controlling the results produced by [[IModelConnection.Elements.getPlacements]].
   * @public
   */
  export interface GetPlacementsOptions {
    /** The types of elements for which to query [Placement]($common)s:
     *  - "2d": Include only [GeometricElement2d]($backend)s.
     *  - "3d": Include only [GeometricElement3d]($backend)s.
     *  - `undefined`: Include both 2d and 3d [GeometricElement]($backend)s.
     */
    type?: "3d" | "2d";
  }

  /** The collection of Elements for an [[IModelConnection]]. */
  export class Elements {
    /** @internal */
    public constructor(private _iModel: IModelConnection) { }

    /** The Id of the [root subject element]($docs/bis/guide/references/glossary.md#subject-root) for this iModel. */
    public get rootSubjectId(): Id64String { return "0x1"; }

    /** Get a set of element ids that satisfy a query */
    public async queryIds(params: EntityQueryParams): Promise<Id64Set> { return this._iModel.queryEntityIds(params); }

    /** Get an array of [[ElementProps]] given one or more element ids.
     * @note This method returns **all** of the properties of the element (excluding GeometryStream), which may be a very large amount of data - consider using
     * [[IModelConnection.query]] to select only those properties of interest to limit the amount of data returned.
     */
    public async getProps(arg: Id64Arg): Promise<ElementProps[]> {
      const iModel = this._iModel;
      return iModel.isOpen ? IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token).getElementProps(this._iModel.getRpcProps(), [...Id64.toIdSet(arg)]) : [];
    }

    /** Obtain the properties of a single element, optionally specifying specific properties to include or exclude.
     * For example, [[getProps]] and [[queryProps]] omit the [GeometryStreamProps]($common) property of [GeometricElementProps]($common) and [GeometryPartProps]($common)
     * because it can be quite large and is generally not useful to frontend code. The following code requests that the geometry stream be included:
     * ```ts
     *  const props = await iModel.elements.loadProps(elementId, { wantGeometry: true });
     * ```
     * @param identifier Identifies the element by its Id, federation Guid, or [Code]($common).
     * @param options Optionally includes or excludes specific properties.
     * @returns The properties of the requested element; or `undefined` if no element exists with the specified identifier or the iModel is not open.
     * @throws [IModelError]($common) if the element exists but could not be loaded.
     */
    public async loadProps(identifier: Id64String | GuidString | CodeProps, options?: ElementLoadOptions): Promise<ElementProps | undefined> {
      const imodel = this._iModel;
      return imodel.isOpen ? IModelReadRpcInterface.getClientForRouting(imodel.routingContext.token).loadElementProps(imodel.getRpcProps(), identifier, options) : undefined;
    }

    /** Get an array  of [[ElementProps]] that satisfy a query
     * @param params The query parameters. The `limit` and `offset` members should be used to page results.
     * @throws [IModelError]($common) If the generated statement is invalid or would return too many props.
     */
    public async queryProps(params: EntityQueryParams): Promise<ElementProps[]> {
      const iModel = this._iModel;
      return iModel.isOpen ? IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token).queryElementProps(iModel.getRpcProps(), params) : [];
    }

    /** Obtain the [Placement]($common)s of a set of [GeometricElement]($backend)s.
     * @param elementIds The Ids of the elements whose placements are to be queried.
     * @param options Options customizing how the placements are queried.
     * @returns an array of placements, each having an additional `elementId` property identifying the element from which the placement was obtained.
     * @note Any Id that does not identify a geometric element with a valid bounding box and origin is omitted from the returned array.
     */
    public async getPlacements(elementIds: Iterable<Id64String>, options?: Readonly<GetPlacementsOptions>): Promise<Array<Placement & { elementId: Id64String }>> {
      let ids: Id64String[];
      if (typeof elementIds === "string")
        ids = [elementIds];
      else if (!Array.isArray(elementIds))
        ids = Array.from(elementIds);
      else
        ids = elementIds;

      if (ids.length === 0)
        return [];

      const select3d = `
        SELECT
          ECInstanceId,
          Origin.x as x, Origin.y as y, Origin.z as z,
          BBoxLow.x as lx, BBoxLow.y as ly, BBoxLow.z as lz,
          BBoxHigh.x as hx, BBoxHigh.y as hy, BBoxHigh.z as hz,
          Yaw, Pitch, Roll,
          NULL as Rotation
        FROM bis.GeometricElement3d
        WHERE Origin IS NOT NULL AND BBoxLow IS NOT NULL AND BBoxHigh IS NOT NULL`;

      // Note: For the UNION ALL statement, the column aliases in select2d are ignored - so they
      // must match those in select3d.
      const select2d = `
        SELECT
          ECInstanceId,
          Origin.x as x, Origin.y as y, NULL as z,
          BBoxLow.x as lx, BBoxLow.y as ly, NULL as lz,
          BBoxHigh.x as hx, BBoxHigh.y as hy, NULL as hz,
          NULL as yaw, NULL as pitch, NULL as roll,
          Rotation
        FROM bis.GeometricElement2d
        WHERE Origin IS NOT NULL AND BBoxLow IS NOT NULL AND BBoxHigh IS NOT NULL`;

      const idCriterion = `ECInstanceId IN (${ids.join(",")})`;

      let ecsql;
      switch (options?.type) {
        case "3d":
          ecsql = `${select3d} AND ${idCriterion}`;
          break;
        case "2d":
          ecsql = `${select2d} AND ${idCriterion}`;
          break;
        default:
          ecsql = `
            SELECT * FROM (
              ${select3d}
              UNION ALL
              ${select2d}
            ) WHERE ${idCriterion}`;
          break;
      }

      const placements = new Array<Placement & { elementId: Id64String }>();
      for await (const queryRow of this._iModel.createQueryReader(ecsql, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
        const row = queryRow.toRow();
        const origin = [row.x, row.y, row.z];
        const bbox = {
          low: { x: row.lx, y: row.ly, z: row.lz },
          high: { x: row.hx, y: row.hy, z: row.hz },
        };

        let placement;
        if (undefined === row.lz)
          placement = Placement2d.fromJSON({ bbox, origin, angle: row.rotation });
        else
          placement = Placement3d.fromJSON({ bbox, origin, angles: { yaw: row.yaw, pitch: row.pitch, roll: row.roll } });

        const placementWithId = (placement as Placement & { elementId: Id64String });
        placementWithId.elementId = row.id;
        placements.push(placementWithId);
      }

      return placements;
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
      const codeSpecArray: any[] = await IModelReadRpcInterface.getClientForRouting(this._iModel.routingContext.token).getAllCodeSpecs(this._iModel.getRpcProps());
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
        throw new IModelError(IModelStatus.InvalidId, "Invalid codeSpecId", () => ({ codeSpecId }));

      await this._loadAllCodeSpecs(); // ensure all codeSpecs have been downloaded
      const found: CodeSpec | undefined = this._loaded!.find((codeSpec: CodeSpec) => codeSpec.id === codeSpecId);
      if (!found)
        throw new IModelError(IModelStatus.NotFound, "CodeSpec not found");

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
        throw new IModelError(IModelStatus.NotFound, "CodeSpec not found");

      return found;
    }
  }

  /** The collection of views for an [[IModelConnection]]. */
  export class Views {
    /** @internal */
    constructor(private _iModel: IModelConnection) { }
    private _writeViewStoreProxy?: PickAsyncMethods<ViewStoreRpc.Writer>;
    private _readViewStoreProxy?: PickAsyncMethods<ViewStoreRpc.Reader>;

    public get viewStoreWriter() {
      return this._writeViewStoreProxy ??= new Proxy(this, {
        get(views, methodName: string) {
          const iModel = views._iModel;
          return async (...args: any[]) => IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token).callViewStore(iModel.getRpcProps(), ViewStoreRpc.version, true, methodName, ...args);
        },
      }) as unknown as PickAsyncMethods<ViewStoreRpc.Writer>;
    }
    public get viewsStoreReader() {
      return this._readViewStoreProxy ??= new Proxy(this, {
        get(views, methodName: string) {
          const iModel = views._iModel;
          return async (...args: any[]) => IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token).callViewStore(iModel.getRpcProps(), ViewStoreRpc.version, false, methodName, ...args);
        },
      }) as unknown as PickAsyncMethods<ViewStoreRpc.Reader>;
    }

    /** Query for an array of ViewDefinitionProps
     * @param queryParams Query parameters specifying the views to return. The `limit` and `offset` members should be used to page results.
     * @throws [IModelError]($common) If the generated statement is invalid or would return too many props.
     */
    public async queryProps(queryParams: ViewQueryParams): Promise<ViewDefinitionProps[]> {
      const iModel = this._iModel;
      if (iModel.isClosed)
        return [];

      const params: ViewQueryParams = { ...queryParams }; // make a copy
      params.from = queryParams.from || ViewState.classFullName; // use "BisCore:ViewDefinition" as default class name
      params.where = queryParams.where || "";
      if (queryParams.wantPrivate === undefined || !queryParams.wantPrivate) {
        if (params.where.length > 0)
          params.where += " AND ";

        params.where += "IsPrivate=FALSE ";
      }
      const viewProps = await IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token).queryElementProps(iModel.getRpcProps(), params);
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
      viewProps.forEach((viewProp) => {
        views.push({ id: viewProp.id as string, name: viewProp.code.value!, class: viewProp.classFullName });
      });

      return views;
    }

    /** Query the Id of the default [ViewDefinition]($backend), if any, stored in this iModel's property table.
     * The default view is typically chosen by the application (such as a connector) that created the iModel.
     * There is no guarantee that this view will be suitable for the purposes of any other applications.
     * Most applications should ignore the default view and instead create a [[ViewState]] that fits their own requirements using APIs like [[ViewCreator3d]].
     * @returns the Id of the default view as defined in the iModel's property table, or an invalid ID if no default view is defined.
     * @deprecated in 4.2. Create a ViewState to your own specifications.
     */
    public async queryDefaultViewId(): Promise<Id64String> {
      const iModel = this._iModel;
      return iModel.isOpen ? IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token).getDefaultViewId(iModel.getRpcProps()) : Id64.invalid;
    }

    /** Load a [[ViewState]] object from the specified [[ViewDefinition]] id. */
    public async load(viewDefinitionId: ViewIdString): Promise<ViewState> {
      const options: ViewStateLoadProps = {
        displayStyle: {
          omitScheduleScriptElementIds: !IModelApp.tileAdmin.enableFrontendScheduleScripts,
          compressExcludedElementIds: true,
        },
      };
      const viewProps = await IModelReadRpcInterface.getClientForRouting(this._iModel.routingContext.token).getViewStateData(this._iModel.getRpcProps(), viewDefinitionId, options);
      const viewState = await this.convertViewStatePropsToViewState(viewProps);
      return viewState;
    }

    /** Return the [[ViewState]] object associated with the [[ViewStateProps]] passed in. */
    public async convertViewStatePropsToViewState(viewProps: ViewStateProps): Promise<ViewState> {
      const className = viewProps.viewDefinitionProps.classFullName;
      const ctor = await this._iModel.findClassFor<typeof EntityState>(className, undefined) as typeof ViewState | undefined;

      if (undefined === ctor)
        throw new IModelError(IModelStatus.WrongClass, "Invalid ViewState class", () => viewProps);

      const viewState = ctor.createFromProps(viewProps, this._iModel)!;
      await viewState.load(); // loads models for ModelSelector

      return viewState;
    }

    /** Get a thumbnail for a view.
     * @param viewId The id of the view of the thumbnail.
     * @returns A Promise of the ThumbnailProps.
     * @throws "No content" error if invalid thumbnail.
     * @deprecated in 3.x use ViewStore apis
     */
    public async getThumbnail(_viewId: Id64String): Promise<ThumbnailProps> {
      // eslint-disable-next-line deprecation/deprecation
      const val = await IModelReadRpcInterface.getClientForRouting(this._iModel.routingContext.token).getViewThumbnail(this._iModel.getRpcProps(), _viewId.toString());
      const intValues = new Uint32Array(val.buffer, 0, 4);

      if (intValues[1] !== ImageSourceFormat.Jpeg && intValues[1] !== ImageSourceFormat.Png)
        throw new NoContentError();

      return { format: intValues[1] === ImageSourceFormat.Jpeg ? "jpeg" : "png", width: intValues[2], height: intValues[3], image: new Uint8Array(val.buffer, 16, intValues[0]) };
    }
  }

  /** @public */
  export namespace Categories {
    /** A subset of the information describing a [SubCategory]($backend), supplied by [[IModelConnection.Categories.getCategoryInfo]]
     * or [[IModelConnection.Categories.getSubCategoryInfo]].
     */
    export interface SubCategoryInfo {
      /** The [SubCategory]($backend)'s element Id. */
      readonly id: Id64String;
      /** The Id of the [Category]($backend) to which this [SubCategory]($backend) belongs. */
      readonly categoryId: Id64String;
      /** Visual parameters applied to geometry belonging to this [SubCategory]($backend). */
      readonly appearance: Readonly<SubCategoryAppearance>;
    }

    /** A subset of the information describing a [Category]($backend), supplied by [[IModelConnection.Categories.getCategoryInfo]]. */
    export interface CategoryInfo {
      /** The category's element Id. */
      readonly id: Id64String;
      /** For each [SubCategory]($backend) belonging to this [Category]($backend), a mapping from the SubCategory's element Id to its properties. */
      readonly subCategories: Map<Id64String, SubCategoryInfo>;
    }
  }

  /** Provides access to information about the [Category]($backend)'s stored in an [[IModelConnection]].
   * This information is cached internally so that repeated requests need not query the backend.
   * @see [[IModelConnection.categories]] for the categories associated with a specific iModel.
   */
  export class Categories {
    /** @internal */
    public readonly cache: SubCategoriesCache;

    /** @internal */
    public constructor(iModel: IModelConnection) {
      this.cache = new SubCategoriesCache(iModel);
    }

    /** Obtain information about one or more [Category]($backend)'s. */
    public async getCategoryInfo(categoryIds: Iterable<Id64String>): Promise<Map<Id64String, Categories.CategoryInfo>> {
      return this.cache.getCategoryInfo(categoryIds);
    }

    /** Obtain information about one or more [SubCategory]($backend)'s belonging to the specified [Category]($backend). */
    public async getSubCategoryInfo(args: {
      category: Id64String;
      subCategories: Iterable<Id64String>;
    }): Promise<Map<Id64String, Categories.SubCategoryInfo>> {
      return this.cache.getSubCategoryInfo(args.category, args.subCategories);
    }
  }
}
