/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module TileTreeSupplier
 */

import { assert, BeTimePoint, compareStringsOrUndefined, Id64, Id64String } from "@itwin/core-bentley";
import {
  BatchType, Cartographic, ColorDef, Feature, FeatureTable, Frustum, FrustumPlanes, GeoCoordStatus, OrbitGtBlobProps, PackedFeatureTable, QParams3d,
  Quantization, RealityDataFormat, RealityDataProvider, RealityDataSourceKey, ViewFlagOverrides,
} from "@itwin/core-common";
import { Point3d, Range3d, Transform, Vector3d } from "@itwin/core-geometry";
import {
  ALong, CRSManager, Downloader, DownloaderXhr, OnlineEngine, OPCReader, OrbitGtAList, OrbitGtBlockIndex, OrbitGtBounds, OrbitGtCoordinate,
  OrbitGtDataManager, OrbitGtFrameData, OrbitGtIProjectToViewForSort, OrbitGtIViewRequest, OrbitGtLevel, OrbitGtTileIndex, OrbitGtTileLoadSorter,
  OrbitGtTransform, PageCachedFile, PointDataRaw, UrlFS,
} from "@itwin/core-orbitgt";
import { calculateEcefToDbTransformAtLocation } from "../../BackgroundMapGeometry";
import { DisplayStyleState } from "../../DisplayStyleState";
import { HitDetail } from "../../HitDetail";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { RealityDataSource } from "../../RealityDataSource";
import { Mesh } from "../../common/internal/render/MeshPrimitives";
import { RenderGraphic } from "../../render/RenderGraphic";
import { RenderMemory } from "../../render/RenderMemory";
import { RenderSystem } from "../../render/RenderSystem";
import { ViewingSpace } from "../../ViewingSpace";
import { Viewport } from "../../Viewport";
import {
  LayerTileTreeHandler,
  MapLayerTreeSetting,
  RealityModelTileTree, Tile, TileContent, TileDrawArgs, TileLoadPriority, TileParams, TileRequest, TileTree, TileTreeOwner,
  TileTreeParams, TileTreeSupplier, TileUsageMarker,
} from "../../tile/internal";

const scratchRange = Range3d.create();
const scratchWorldFrustum = new Frustum();

interface OrbitGtTreeId {
  rdSourceKey: RealityDataSourceKey;
  modelId: Id64String;
}

function compareSourceKeys(lhs: RealityDataSourceKey, rhs: RealityDataSourceKey): number {
  return compareStringsOrUndefined(lhs.id, rhs.id) || compareStringsOrUndefined(lhs.format, rhs.format) || compareStringsOrUndefined(lhs.iTwinId, rhs.iTwinId);
}

class OrbitGtTreeSupplier implements TileTreeSupplier {
  public getOwner(treeId: OrbitGtTreeId, iModel: IModelConnection): TileTreeOwner {
    return iModel.tiles.getTileTreeOwner(treeId, this);
  }

  public async createTileTree(treeId: OrbitGtTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    return OrbitGtTileTree.createOrbitGtTileTree(treeId.rdSourceKey, iModel, treeId.modelId);
  }

  public compareTileTreeIds(lhs: OrbitGtTreeId, rhs: OrbitGtTreeId): number {
    return compareStringsOrUndefined(lhs.modelId, rhs.modelId) || compareSourceKeys(lhs.rdSourceKey, rhs.rdSourceKey);
  }

  public findCompatibleContextRealityModelId(sourceKey: RealityDataSourceKey, style: DisplayStyleState): Id64String | undefined {
    const owners = style.iModel.tiles.getTreeOwnersForSupplier(this);
    for (const owner of owners) {
      // Find an existing tree with the same reality data source key.
      if (0 === compareSourceKeys(sourceKey, owner.id.rdSourceKey)) {
        const modelId = owner.id.modelId;
        assert(undefined !== modelId);

        // If the model Id is unused by any other context reality model in the view and does not identify a persistent reality model, use it.
        if (Id64.isTransientId64(modelId) && !style.contextRealityModelStates.some((model) => model.modelId === modelId))
          return modelId;
      }
    }

    return undefined;
  }
}

const orbitGtTreeSupplier = new OrbitGtTreeSupplier();

function transformFromOrbitGt(ogtTransform: OrbitGtTransform, result?: Transform): Transform {
  if (undefined === result)
    result = Transform.createIdentity();

  result.matrix.setRowValues(
    ogtTransform.getElement(0, 0), ogtTransform.getElement(0, 1), ogtTransform.getElement(0, 2),
    ogtTransform.getElement(1, 0), ogtTransform.getElement(1, 1), ogtTransform.getElement(1, 2),
    ogtTransform.getElement(2, 0), ogtTransform.getElement(2, 1), ogtTransform.getElement(2, 2));

  result.origin.x = ogtTransform.getElement(0, 3);
  result.origin.y = ogtTransform.getElement(1, 3);
  result.origin.z = ogtTransform.getElement(2, 3);
  return result;
}

function pointFromOrbitGt(ogtCoordinate: OrbitGtCoordinate, result?: Point3d): Point3d {
  if (undefined === result)
    result = Point3d.create();

  result.x = ogtCoordinate.x;
  result.y = ogtCoordinate.y;
  result.z = ogtCoordinate.z;

  return result;
}

function rangeFromOrbitGt(ogtBounds: OrbitGtBounds, result?: Range3d) {
  if (undefined === result)
    result = Range3d.create();

  pointFromOrbitGt(ogtBounds.min, result.low);
  pointFromOrbitGt(ogtBounds.max, result.high);
  return result;
}

export function createOrbitGtTileTreeReference(props: OrbitGtTileTree.ReferenceProps): RealityModelTileTree.Reference {
  return new OrbitGtTreeReference(props);
}

class OrbitGtTileTreeParams implements TileTreeParams {
  public id: string;
  public modelId: string;
  public iModel: IModelConnection;
  public get priority(): TileLoadPriority { return TileLoadPriority.Context; }

  public constructor(rdSourceKey: RealityDataSourceKey, iModel: IModelConnection, modelId: Id64String, public location: Transform) {
    const key = rdSourceKey;
    this.id = `${key.provider}:${key.format}:${key.id}:${key.iTwinId}`;
    this.modelId = modelId;
    this.iModel = iModel;
  }
}

class OrbitGtRootTile extends Tile {
  protected _loadChildren(_resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void { }
  public async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> { return undefined; }
  public get channel() { return IModelApp.tileAdmin.channels.getForHttp("itwinjs-orbitgit"); }
  public async readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled?: () => boolean): Promise<TileContent> { return {}; }
  public override freeMemory(): void { }

  constructor(params: TileParams, tree: TileTree) { super(params, tree); }
}

class OrbitGtViewRequest extends OrbitGtIViewRequest {
  private _tileToIModelTransform: Transform;
  constructor(private _tileDrawArgs: TileDrawArgs, private _centerOffset: Vector3d) {
    super();
    this._tileToIModelTransform = _tileDrawArgs.location.multiplyTransformTransform(Transform.createTranslation(_centerOffset));
  }

  public isVisibleBox(bounds: OrbitGtBounds): boolean {
    const box = Frustum.fromRange(rangeFromOrbitGt(bounds, scratchRange));
    const worldBox = box.transformBy(this._tileToIModelTransform, scratchWorldFrustum);
    return FrustumPlanes.Containment.Outside !== this._tileDrawArgs.frustumPlanes.computeFrustumContainment(worldBox, undefined);
  }
  public getFrameTime(): number {
    return this._tileDrawArgs.now.milliseconds;
  }

  public shouldSplit(level: OrbitGtLevel, tile: OrbitGtTileIndex) {
    // get the world size of the tile voxels
    const tileCenter: OrbitGtCoordinate = level.getTileGrid().getCellCenter(tile.gridIndex);
    tileCenter.x += this._centerOffset.x;
    tileCenter.y += this._centerOffset.y;
    tileCenter.z += this._centerOffset.z;
    const worldCenter: Point3d = this._tileDrawArgs.location.multiplyXYZ(tileCenter.x, tileCenter.y, tileCenter.z);
    const worldCenter2: Point3d = this._tileDrawArgs.location.multiplyXYZ(tileCenter.x, tileCenter.y, tileCenter.z + level.getTileGrid().size.z);
    const voxelSize: number = worldCenter2.distance(worldCenter) / 64;
    // get the world size of a screen pixel at the tile center
    const viewPt: Point3d = this._tileDrawArgs.worldToViewMap.transform0.multiplyPoint3dQuietNormalize(worldCenter);
    const viewPt2: Point3d = new Point3d(viewPt.x + 1.0, viewPt.y, viewPt.z);
    const pixelSizeAtCenter: number = this._tileDrawArgs.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(viewPt).distance(this._tileDrawArgs.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(viewPt2));
    // stop splitting if the voxel size of the children becomes too small to improve quality
    const split: boolean = (0.5 * voxelSize > 2.0 * pixelSizeAtCenter);
    return split;
  }
}

class TileSortProjector implements OrbitGtIProjectToViewForSort {
  private _sortTransform: Transform;
  constructor(iModelTransform: Transform, viewingSpace: ViewingSpace, centerOffset: Vector3d) {
    const rotation = viewingSpace.rotation;
    let origin: Vector3d;
    if (undefined === viewingSpace.eyePoint) {
      origin = Vector3d.createFrom(viewingSpace.viewOrigin);
      const viewDelta = viewingSpace.viewDelta;
      const eyeDelta = Vector3d.createFrom({ x: viewDelta.x / 2, y: viewDelta.y / 2, z: viewDelta.z * 10 });
      rotation.multiplyVector(eyeDelta, eyeDelta);
      origin.addInPlace(eyeDelta);
    } else {
      origin = Vector3d.createFrom(viewingSpace.eyePoint);
    }

    rotation.multiplyVector(origin);
    origin.scaleInPlace(-1);
    const toViewTransform = Transform.createOriginAndMatrix(origin, rotation);
    const tileToIModelTransform = iModelTransform.multiplyTransformTransform(Transform.createTranslation(centerOffset));
    this._sortTransform = toViewTransform.multiplyTransformTransform(tileToIModelTransform);
  }
  public projectToViewForSort(coordinate: OrbitGtCoordinate) {
    const point = pointFromOrbitGt(coordinate);
    this._sortTransform.multiplyPoint3d(point, point);
    coordinate.x = point.x;
    coordinate.y = point.y;
    coordinate.z = point.z;
  }
}

class OrbitGtTileGraphic extends TileUsageMarker {
  public readonly graphic: RenderGraphic;

  public constructor(graphic: RenderGraphic, viewport: Viewport, time: BeTimePoint) {
    super();
    this.graphic = graphic;
    this.mark(viewport, time);
  }

  public [Symbol.dispose](): void {
    this.graphic[Symbol.dispose]();
  }
}

export class OrbitGtTileTree extends TileTree {
  private _tileParams: TileParams;
  public rootTile: OrbitGtRootTile;
  public viewFlagOverrides: ViewFlagOverrides = {};
  private _tileGraphics = new Map<string, OrbitGtTileGraphic>();
  private readonly _layerHandler: LayerTileTreeHandler;
  public layerImageryTrees: MapLayerTreeSetting[] = [];

  public override get layerHandler() { return this._layerHandler; }

  public constructor(treeParams: TileTreeParams, private _dataManager: OrbitGtDataManager, cloudRange: Range3d, private _centerOffset: Vector3d, private _ecefTransform: Transform) {
    super(treeParams);

    this._layerHandler = new LayerTileTreeHandler(this);

    this._tileParams = { contentId: "0", range: cloudRange, maximumSize: 256 };
    this.rootTile = new OrbitGtRootTile(this._tileParams, this);
  }

  public override async getEcefTransform(): Promise<Transform | undefined> {
    return this._ecefTransform;
  }

  public override[Symbol.dispose](): void {
    if (this.isDisposed)
      return;

    for (const graphic of this._tileGraphics.values())
      graphic[Symbol.dispose]();

    this._tileGraphics.clear();
    super[Symbol.dispose]();
  }

  protected _selectTiles(_args: TileDrawArgs): Tile[] { return []; }
  public get is3d(): boolean { return true; }
  public override get isContentUnbounded(): boolean { return false; }
  public get maxDepth(): number | undefined { return undefined; }

  private _doPrune(olderThan: BeTimePoint) {
    for (const [key, graphic] of this._tileGraphics)
      if (graphic.isExpired(olderThan)) {
        graphic[Symbol.dispose]();
        this._tileGraphics.delete(key);
      }
  }

  public prune() {
    const olderThan = BeTimePoint.now().minus(this.expirationTime);
    this._doPrune(olderThan);
  }

  public override collectStatistics(stats: RenderMemory.Statistics): void {
    for (const tileGraphic of this._tileGraphics)
      tileGraphic[1].graphic.collectStatistics(stats);
  }

  public draw(args: TileDrawArgs) {
    const debugControl = args.context.target.debugControl;
    const debugBuilder = (debugControl && debugControl.displayRealityTileRanges) ? args.context.createSceneGraphicBuilder() : undefined;
    const doLogging = (debugControl && debugControl.logRealityTiles);
    const viewRequest = new OrbitGtViewRequest(args, this._centerOffset);
    const levelsInView = new OrbitGtAList<OrbitGtLevel>();
    const blocksInView = new OrbitGtAList<OrbitGtBlockIndex>();
    const tilesInView = new OrbitGtAList<OrbitGtTileIndex>();
    const frameData = new OrbitGtFrameData();

    this._dataManager.getViewTree().renderView3D(viewRequest, levelsInView, blocksInView, tilesInView, frameData.tilesToRender);
    this._dataManager.filterLoadList(levelsInView, blocksInView, tilesInView, frameData.levelsToLoad, frameData.blocksToLoad, frameData.tilesToLoad);
    tilesInView.sort(new OrbitGtTileLoadSorter(this._dataManager.getViewTree(), new TileSortProjector(this.iModelTransform, args.context.viewingSpace, this._centerOffset)));

    let totalPointCount = 0;
    const tileCount = frameData.tilesToRender.size();

    // Inform TileAdmin about tiles we are handling ourselves...
    IModelApp.tileAdmin.addExternalTilesForUser(args.context.viewport, { requested: frameData.tilesToLoad.size() + (frameData.hasMissingData() ? 1 : 0), selected: tileCount, ready: tileCount });

    if (debugBuilder)
      debugBuilder.setSymbology(ColorDef.red, ColorDef.red, 1);

    let minLevel = 100, maxLevel = -100;
    for (let t: number = 0; t < tileCount; t++) {
      const tile: PointDataRaw = frameData.tilesToRender.get(t) as PointDataRaw;
      minLevel = Math.min(minLevel, tile.tileIndex.level);
      maxLevel = Math.max(maxLevel, tile.tileIndex.level);
      totalPointCount += tile.tileIndex.pointCount;
      const key = tile.tileIndex.key;
      const cachedGraphic = this._tileGraphics.get(key);
      if (undefined !== cachedGraphic) {
        cachedGraphic.mark(args.context.viewport, args.now);
        args.graphics.add(cachedGraphic.graphic);
      } else {
        const range = rangeFromOrbitGt(tile.bounds);
        range.low.addInPlace(this._centerOffset);
        range.high.addInPlace(this._centerOffset);
        const qParams = QParams3d.fromRange(range, undefined, (tile.points8 != null) ? Quantization.rangeScale8 : Quantization.rangeScale16);
        const featureTable = new FeatureTable(1, this.modelId, BatchType.Primary);
        const features = new Mesh.Features(featureTable);
        const system = IModelApp.renderSystem;
        const voxelSize = (range.high.x - range.low.x) / 64;

        features.add(new Feature(this.modelId), 1);
        const tilePoints = (tile.points8 != null) ? tile.points8.toNativeBuffer() : tile.points16.toNativeBuffer();
        let renderGraphic = system.createPointCloud({
          positions: tilePoints,
          qparams: qParams,
          colors: tile.colors.toNativeBuffer(),
          features: features.toFeatureIndex(),
          voxelSize,
          colorFormat: "bgr",
        }, this.iModel);

        renderGraphic = system.createBatch(renderGraphic!, PackedFeatureTable.pack(featureTable), range);
        args.graphics.add(renderGraphic);
        this._tileGraphics.set(key, new OrbitGtTileGraphic(renderGraphic, args.context.viewport, args.now));
      }

      if (debugBuilder)
        debugBuilder.addRangeBox(rangeFromOrbitGt(tile.bounds));
    }

    if (debugBuilder)
      args.graphics.add(debugBuilder.finish());

    if (doLogging) {
      // eslint-disable-next-line no-console
      console.log(`Total OrbitGtTiles: ${tileCount} MinLevel: ${minLevel} MaxLevel: ${maxLevel} Total Points: ${totalPointCount}`);
    }

    args.drawGraphics();
    if (frameData.hasMissingData()) {
      this._dataManager.loadData(frameData).then(() => IModelApp.tileAdmin.onTileLoad.raiseEvent(this.rootTile)).catch((_err: any) => undefined);
    }
  }
}

export namespace OrbitGtTileTree {
  export interface ReferenceProps extends RealityModelTileTree.ReferenceBaseProps {
    orbitGtBlob?: OrbitGtBlobProps;
    modelId?: Id64String;
  }
  function isValidSASToken(downloadUrl: string): boolean {

    // Create fake URL for and parameter parsing and SAS token URI parsing
    if (!downloadUrl.startsWith("http"))
      downloadUrl = `http://x.com/x?${downloadUrl}`;

    const sasUrl = new URL(downloadUrl);

    const se = sasUrl.searchParams.get("se");
    if (se) {
      const expiryUTC = new Date(se);
      const now = new Date();
      const currentUTC = new Date(now?.toUTCString());

      return expiryUTC >= currentUTC;
    }

    return false;
  }
  function isValidOrbitGtBlobProps(props: OrbitGtBlobProps): boolean {

    // Check main OrbitGtBlobProps fields are defined
    if (!props.accountName || !props.containerName || !props.blobFileName || !props.sasToken)
      return false;

    // Check SAS token is valid
    return isValidSASToken(props.sasToken);
  }

  export async function createOrbitGtTileTree(rdSourceKey: RealityDataSourceKey, iModel: IModelConnection, modelId: Id64String): Promise<TileTree | undefined> {
    const rdSource = await RealityDataSource.fromKey(rdSourceKey, iModel.iTwinId);
    const isContextShare = rdSourceKey.provider === RealityDataProvider.ContextShare;
    const isTilestUrl = rdSourceKey.provider === RealityDataProvider.TilesetUrl;

    let blobStringUrl: string;
    if (isContextShare) {
      const realityData = rdSource ? rdSource.realityData : undefined;
      if (rdSource === undefined || realityData === undefined)
        return undefined;
      const docRootName = realityData.rootDocument;
      if (!docRootName)
        return undefined;
      const token = await IModelApp.getAccessToken();
      const blobUrl = await realityData.getBlobUrl(token, docRootName);
      blobStringUrl = blobUrl.toString();
    } else if (isTilestUrl) {
      blobStringUrl = rdSourceKey.id;
    } else {
      const orbitGtBlobProps = RealityDataSource.createOrbitGtBlobPropsFromKey(rdSourceKey);
      if (orbitGtBlobProps === undefined)
        return undefined;
      if (!isValidOrbitGtBlobProps(orbitGtBlobProps))
        return undefined;
      const { accountName, containerName, blobFileName, sasToken } = orbitGtBlobProps;
      blobStringUrl = blobFileName;
      if (accountName.length > 0)
        blobStringUrl = UrlFS.getAzureBlobSasUrl(accountName, containerName, blobFileName, sasToken);
    }

    if (Downloader.INSTANCE == null)
      Downloader.INSTANCE = new DownloaderXhr();

    if (CRSManager.ENGINE == null)
      CRSManager.ENGINE = await OnlineEngine.create();

    // wrap a caching layer (16 MB) around the blob file
    const urlFS: UrlFS = new UrlFS();
    const blobFileSize: ALong = await urlFS.getFileLength(blobStringUrl);
    const cacheKilobytes = 128;
    const cachedBlobFile = new PageCachedFile(urlFS, blobStringUrl, blobFileSize, cacheKilobytes * 1024 /* pageSize*/, 128/* maxPageCount*/);
    const pointCloudReader = await OPCReader.openFile(cachedBlobFile, blobStringUrl, true/* lazyLoading*/);
    let pointCloudCRS = pointCloudReader.getFileCRS();
    if (pointCloudCRS == null)
      pointCloudCRS = "";
    const dataManager = new OrbitGtDataManager(pointCloudReader, pointCloudCRS, PointDataRaw.TYPE);
    const pointCloudBounds = dataManager.getPointCloudBounds();
    const pointCloudRange = rangeFromOrbitGt(pointCloudBounds);
    const pointCloudCenter = pointCloudRange.localXYZToWorld(.5, .5, .5)!;
    const addCloudCenter = Transform.createTranslation(pointCloudCenter);
    const ecefTransform = Transform.createIdentity();
    let pointCloudCenterToDb = addCloudCenter;
    if (pointCloudCRS.length > 0) {
      await CRSManager.ENGINE.prepareForArea(pointCloudCRS, pointCloudBounds);
      const wgs84CRS = "4978";
      await CRSManager.ENGINE.prepareForArea(wgs84CRS, new OrbitGtBounds());
      const pointCloudToEcef = transformFromOrbitGt(CRSManager.createTransform(pointCloudCRS, new OrbitGtCoordinate(pointCloudCenter.x, pointCloudCenter.y, pointCloudCenter.z), wgs84CRS));
      const pointCloudCenterToEcef = pointCloudToEcef.multiplyTransformTransform(addCloudCenter);
      ecefTransform.setFrom(pointCloudCenterToEcef);

      let ecefToDb = iModel.getMapEcefToDb(0);
      // In initial publishing version the iModel ecef Transform was used to locate the reality model.
      // This would work well only for tilesets published from that iModel but for iModels the ecef transform is calculated
      // at the center of the project extents and the reality model location may differ greatly, and the curvature of the earth
      // could introduce significant errors.
      // The publishing was modified to calculate the ecef transform at the reality model range center and at the same time the "iModelPublishVersion"
      // member was added to the root object.
      const ecefOrigin = pointCloudCenterToEcef.getOrigin();
      const dbOrigin = ecefToDb.multiplyPoint3d(ecefOrigin);
      const realityOriginToProjectDistance = iModel.projectExtents.distanceToPoint(dbOrigin);
      const maxProjectDistance = 1E5;     // Only use the project GCS projection if within 100KM of the project.   Don't attempt to use GCS if global reality model or in another locale - Results will be unreliable.
      if (realityOriginToProjectDistance < maxProjectDistance) {
        const cartographicOrigin = Cartographic.fromEcef(ecefOrigin);
        const geoConverter = iModel.noGcsDefined ? undefined : iModel.geoServices.getConverter("WGS84");
        if (cartographicOrigin !== undefined && geoConverter !== undefined) {
          const geoOrigin = Point3d.create(cartographicOrigin.longitudeDegrees, cartographicOrigin.latitudeDegrees, cartographicOrigin.height);
          const response = await geoConverter.getIModelCoordinatesFromGeoCoordinates([geoOrigin]);
          if (response.iModelCoords[0].s === GeoCoordStatus.Success) {
            const ecefToDbOrigin = await calculateEcefToDbTransformAtLocation(Point3d.fromJSON(response.iModelCoords[0].p), iModel);
            if (ecefToDbOrigin)
              ecefToDb = ecefToDbOrigin;
          }
        }
      }

      pointCloudCenterToDb = ecefToDb.multiplyTransformTransform(pointCloudCenterToEcef);
    }
    const params = new OrbitGtTileTreeParams(rdSourceKey, iModel, modelId, pointCloudCenterToDb);

    // We use a RTC transform to avoid jitter from large cloud coordinates.
    const centerOffset = Vector3d.create(-pointCloudCenter.x, -pointCloudCenter.y, -pointCloudCenter.z);
    pointCloudRange.low.addInPlace(centerOffset);
    pointCloudRange.high.addInPlace(centerOffset);
    return new OrbitGtTileTree(params, dataManager, pointCloudRange, centerOffset, ecefTransform);
  }
}

/** Supplies a reality data [[TileTree]] from a URL. May be associated with a persistent [[GeometricModelState]], or attached at run-time via a [[ContextOrbitGtState]].
 * Exported strictly for tests.
 */
export class OrbitGtTreeReference extends RealityModelTileTree.Reference {
  public readonly treeOwner: TileTreeOwner;
  protected _rdSourceKey: RealityDataSourceKey;
  private readonly _modelId: Id64String;

  public override get castsShadows() { return false; }
  public override get modelId() { return this._modelId; }

  public constructor(props: OrbitGtTileTree.ReferenceProps) {
    super(props);
    // Create rdSourceKey if not provided
    if (props.rdSourceKey) {
      this._rdSourceKey = props.rdSourceKey;
    } else if (props.orbitGtBlob) {
      this._rdSourceKey = RealityDataSource.createKeyFromOrbitGtBlobProps(props.orbitGtBlob);
    } else {
      // TODO: Maybe we should throw an exception
      this._rdSourceKey = RealityDataSource.createKeyFromBlobUrl("", RealityDataProvider.OrbitGtBlob, RealityDataFormat.OPC);
    }

    // ###TODO find compatible model Id
    let modelId = props.modelId;
    if (undefined === modelId && this._source instanceof DisplayStyleState)
      modelId = orbitGtTreeSupplier.findCompatibleContextRealityModelId(this._rdSourceKey, this._source);

    this._modelId = modelId ?? props.iModel.transientIds.getNext();

    const ogtTreeId: OrbitGtTreeId = { rdSourceKey: this._rdSourceKey, modelId: this.modelId };
    this.treeOwner = orbitGtTreeSupplier.getOwner(ogtTreeId, props.iModel);
  }

  public override canSupplyToolTip(hit: HitDetail): boolean {
    const tree = this.treeOwner.tileTree;
    return undefined !== tree && hit.iModel === tree.iModel;
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined> {
    const tree = this.treeOwner.tileTree;
    if (undefined === tree || hit.iModel !== tree.iModel)
      return undefined;

    const strings = [];
    strings.push(IModelApp.localization.getLocalizedString("iModelJs:RealityModelTypes.OrbitGTPointCloud"));

    if (this._name)
      strings.push(`${IModelApp.localization.getLocalizedString("iModelJs:TooltipInfo.Name")} ${this._name}`);

    const div = document.createElement("div");
    div.innerHTML = strings.join("<br>");
    return div;
  }
}
