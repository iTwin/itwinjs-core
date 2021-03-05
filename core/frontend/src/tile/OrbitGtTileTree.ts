/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module TileTreeSupplier
 */

import { BeTimePoint, compareStrings, compareStringsOrUndefined, Id64String } from "@bentley/bentleyjs-core";
import { Point3d, Range3d, Transform, TransformProps, Vector3d } from "@bentley/geometry-core";
import {
  BatchType, ColorDef, Feature,
  FeatureTable, Frustum, FrustumPlanes, OrbitGtBlobProps, PackedFeatureTable, QParams3d, Quantization,
  ViewFlagOverrides,
} from "@bentley/imodeljs-common";
import {
  ALong, CRSManager, Downloader, DownloaderXhr, OnlineEngine, OPCReader, OrbitGtAList, OrbitGtBlockIndex, OrbitGtBounds, OrbitGtCoordinate,
  OrbitGtDataManager, OrbitGtFrameData, OrbitGtIProjectToViewForSort, OrbitGtIViewRequest, OrbitGtLevel, OrbitGtTileIndex, OrbitGtTileLoadSorter,
  OrbitGtTransform, PageCachedFile, PointDataRaw, UrlFS,
} from "@bentley/orbitgt-core";
import { DisplayStyleState } from "../DisplayStyleState";
import { HitDetail } from "../HitDetail";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { Mesh, PointCloudArgs } from "../render-primitives";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderMemory } from "../render/RenderMemory";
import { RenderSystem } from "../render/RenderSystem";
import { SpatialClassifiers } from "../SpatialClassifiers";
import { SceneContext } from "../ViewContext";
import { ViewingSpace } from "../ViewingSpace";
import { Viewport } from "../Viewport";
import {
  createClassifierTileTreeReference, DisclosedTileTreeSet, RealityModelTileTree, SpatialClassifierTileTreeReference, Tile, TileContent,
  TileDrawArgs, TileLoadPriority, TileParams, TileRequest, TileTree, TileTreeOwner, TileTreeParams, TileTreeReference, TileTreeSupplier,
} from "./internal";
import { TileUsageMarker } from "./TileUsageMarker";

const scratchRange = Range3d.create();
const scratchWorldFrustum = new Frustum();

interface OrbitGtTreeId {
  orbitGtProps: OrbitGtBlobProps;
  modelId: Id64String;
}

class OrbitGtTreeSupplier implements TileTreeSupplier {
  public getOwner(treeId: OrbitGtTreeId, iModel: IModelConnection): TileTreeOwner {
    return iModel.tiles.getTileTreeOwner(treeId, this);
  }

  public async createTileTree(treeId: OrbitGtTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    return OrbitGtTileTree.createOrbitGtTileTree(treeId.orbitGtProps, iModel, treeId.modelId);
  }

  public compareTileTreeIds(lhs: OrbitGtTreeId, rhs: OrbitGtTreeId): number {
    let cmp = compareStrings(lhs.orbitGtProps.accountName, rhs.orbitGtProps.accountName);
    if (0 === cmp)
      cmp = compareStringsOrUndefined(lhs.modelId, rhs.modelId);
    if (0 === cmp) {
      cmp = compareStrings(lhs.orbitGtProps.blobFileName, rhs.orbitGtProps.blobFileName);
      if (0 === cmp) {
        cmp = compareStrings(lhs.orbitGtProps.containerName, rhs.orbitGtProps.containerName);
        if (0 === cmp)
          cmp = compareStrings(lhs.orbitGtProps.sasToken, rhs.orbitGtProps.sasToken);
      }
    }
    return cmp;
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

/** @internal */
export function createOrbitGtTileTreeReference(props: OrbitGtTileTree.ReferenceProps): RealityModelTileTree.Reference { return new OrbitGtTreeReference(props); }

class OrbitGtTileTreeParams implements TileTreeParams {
  public id: string;
  public modelId: string;
  public iModel: IModelConnection;
  public get priority(): TileLoadPriority { return TileLoadPriority.Context; }

  public constructor(blobProps: OrbitGtBlobProps, iModel: IModelConnection, modelId: Id64String, public location: Transform) {
    const { accountName, containerName, blobFileName } = blobProps;
    this.id = `${accountName}:${containerName}:${blobFileName}`;
    this.modelId = modelId;
    this.iModel = iModel;
  }
}

class OrbitGtRootTile extends Tile {
  protected _loadChildren(_resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void { }
  public async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> { return undefined; }
  public get channel() { return IModelApp.tileAdmin.channels.getForHttp("itwinjs-orbitgit"); }
  public async readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled?: () => boolean): Promise<TileContent> { return {}; }
  public freeMemory(): void { }

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

  public dispose(): void {
    this.graphic.dispose();
  }
}

/** @internal */
export class OrbitGtTileTree extends TileTree {
  private _tileParams: TileParams;
  public rootTile: OrbitGtRootTile;
  public viewFlagOverrides = new ViewFlagOverrides();
  private _tileGraphics = new Map<string, OrbitGtTileGraphic>();

  public constructor(treeParams: TileTreeParams, private _dataManager: OrbitGtDataManager, cloudRange: Range3d, private _centerOffset: Vector3d) {
    super(treeParams);

    const worldContentRange = this.iModelTransform.multiplyRange(cloudRange);
    this.iModel.expandDisplayedExtents(worldContentRange);
    this._tileParams = { contentId: "0", range: cloudRange, maximumSize: 256 };
    this.rootTile = new OrbitGtRootTile(this._tileParams, this);
  }

  public dispose(): void {
    if (this.isDisposed)
      return;

    for (const graphic of this._tileGraphics.values())
      graphic.dispose();

    this._tileGraphics.clear();
    super.dispose();
  }

  protected _selectTiles(_args: TileDrawArgs): Tile[] { return []; }
  public get is3d(): boolean { return true; }
  public get isContentUnbounded(): boolean { return false; }
  public get maxDepth(): number | undefined { return undefined; }

  private _doPrune(olderThan: BeTimePoint) {
    for (const [key, graphic] of this._tileGraphics)
      if (graphic.isExpired(olderThan)) {
        graphic.dispose();
        this._tileGraphics.delete(key);
      }
  }

  public prune() {
    const olderThan = BeTimePoint.now().minus(this.expirationTime);
    this._doPrune(olderThan);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
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
    IModelApp.tileAdmin.addExternalTilesForViewport(args.context.viewport, { requested: frameData.tilesToLoad.size(), selected: tileCount, ready: tileCount });

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
        let renderGraphic = system.createPointCloud(new PointCloudArgs(tilePoints, qParams, tile.colors.toNativeBuffer(), features, voxelSize, true), this.iModel);
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

/** @internal */
// eslint-disable-next-line no-redeclare
export namespace OrbitGtTileTree {
  export interface ReferenceProps {
    orbitGtBlob: OrbitGtBlobProps;
    iModel: IModelConnection;
    tilesetToDbTransform?: TransformProps;
    name?: string;
    classifiers?: SpatialClassifiers;
    displayStyle: DisplayStyleState;
    modelId?: Id64String;
  }

  export async function createOrbitGtTileTree(props: OrbitGtBlobProps, iModel: IModelConnection, modelId: Id64String): Promise<TileTree | undefined> {
    const { accountName, containerName, blobFileName, sasToken } = props;
    if (Downloader.INSTANCE == null) Downloader.INSTANCE = new DownloaderXhr();
    if (CRSManager.ENGINE == null) CRSManager.ENGINE = await OnlineEngine.create();
    // wrap a caching layer (16 MB) around the blob file
    const urlFS: UrlFS = new UrlFS();
    let blobFileURL: string = blobFileName;
    if (accountName.length > 0) blobFileURL = UrlFS.getAzureBlobSasUrl(accountName, containerName, blobFileName, sasToken);
    const blobFileSize: ALong = await urlFS.getFileLength(blobFileURL);
    const cacheKilobytes = 128;
    const cachedBlobFile = new PageCachedFile(urlFS, blobFileURL, blobFileSize, cacheKilobytes * 1024 /* pageSize*/, 128/* maxPageCount*/);
    const pointCloudReader = await OPCReader.openFile(cachedBlobFile, blobFileURL, true/* lazyLoading*/);
    let pointCloudCRS = pointCloudReader.getFileCRS();
    if (pointCloudCRS == null)
      pointCloudCRS = "";
    const dataManager = new OrbitGtDataManager(pointCloudReader, pointCloudCRS, PointDataRaw.TYPE);
    const pointCloudBounds = dataManager.getPointCloudBounds();
    const pointCloudRange = rangeFromOrbitGt(pointCloudBounds);
    const pointCloudCenter = pointCloudRange.localXYZToWorld(.5, .5, .5)!;
    const addCloudCenter = Transform.createTranslation(pointCloudCenter);
    let pointCloudCenterToDb = addCloudCenter;
    if (pointCloudCRS.length > 0) {
      await CRSManager.ENGINE.prepareForArea(pointCloudCRS, pointCloudBounds);
      const wgs84CRS = "4978";
      await CRSManager.ENGINE.prepareForArea(wgs84CRS, new OrbitGtBounds());
      const pointCloudToEcef = transformFromOrbitGt(CRSManager.createTransform(pointCloudCRS, pointCloudBounds.min, wgs84CRS));
      const pointCloudCenterToEcef = pointCloudToEcef.multiplyTransformTransform(addCloudCenter);
      const ecefLocation = iModel.ecefLocation;
      if (ecefLocation === undefined) return undefined;
      const ecefToDb = ecefLocation.getTransform().inverse()!;
      pointCloudCenterToDb = ecefToDb.multiplyTransformTransform(pointCloudCenterToEcef);
    }
    const params = new OrbitGtTileTreeParams(props, iModel, modelId, pointCloudCenterToDb);

    // We use a RTC transform to avoid jitter from large cloud coordinates.
    const centerOffset = Vector3d.create(-pointCloudCenter.x, -pointCloudCenter.y, -pointCloudCenter.z);
    pointCloudRange.low.addInPlace(centerOffset);
    pointCloudRange.high.addInPlace(centerOffset);
    return new OrbitGtTileTree(params, dataManager, pointCloudRange, centerOffset);
  }
}

/** Supplies a reality data [[TileTree]] from a URL. May be associated with a persistent [[GeometricModelState]], or attached at run-time via a [[ContextOrbitGtState]].
 * @internal
 */
class OrbitGtTreeReference extends RealityModelTileTree.Reference {
  public readonly treeOwner: TileTreeOwner;
  private readonly _name: string; // tslint:disable-line
  private readonly _classifier?: SpatialClassifierTileTreeReference;
  private _mapDrapeTree?: TileTreeReference;
  public get castsShadows() { return false; }

  public constructor(props: OrbitGtTileTree.ReferenceProps) {
    super(props.modelId, props.iModel);

    const ogtTreeId: OrbitGtTreeId = { orbitGtProps: props.orbitGtBlob, modelId: this.modelId };
    this.treeOwner = orbitGtTreeSupplier.getOwner(ogtTreeId, props.iModel);
    this._name = undefined !== props.name ? props.name : "";

    if (undefined !== props.classifiers)
      this._classifier = createClassifierTileTreeReference(props.classifiers, this, props.iModel, props.displayStyle);
  }

  public get classifiers(): SpatialClassifiers | undefined { return undefined !== this._classifier ? this._classifier.classifiers : undefined; }

  public addToScene(context: SceneContext): void {
    // NB: The classifier must be added first, so we can find it when adding our own tiles.
    if (undefined !== this._classifier)
      this._classifier.addToScene(context);

    super.addToScene(context);
  }

  public discloseTileTrees(trees: DisclosedTileTreeSet): void {
    super.discloseTileTrees(trees);

    if (undefined !== this._classifier)
      this._classifier.discloseTileTrees(trees);

    if (undefined !== this._mapDrapeTree)
      this._mapDrapeTree.discloseTileTrees(trees);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    super.collectStatistics(stats);

    const tree = undefined !== this._classifier ? this._classifier.treeOwner.tileTree : undefined;
    if (undefined !== tree)
      tree.collectStatistics(stats);
  }
  public async getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined> {
    const tree = this.treeOwner.tileTree;
    if (undefined === tree || hit.iModel !== tree.iModel)
      return undefined;

    const strings = [];
    strings.push(this._name ? this._name : IModelApp.i18n.translate("iModelJs:RealityModelTypes.OrbitGTPointCloud"));

    const div = document.createElement("div");
    div.innerHTML = strings.join("<br>");
    return div;
  }
}
