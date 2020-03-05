/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  assert,
  dispose,
  compareNumbers,
  compareStrings,
  BeTimePoint,
} from "@bentley/bentleyjs-core";
import {
  Angle,
  AxisOrder,
  BilinearPatch,
  EllipsoidPatch,
  LongitudeLatitudeNumber,
  Matrix3d,
  Point3d,
  Range1d,
  Range2d,
  Range3d,
  Ray3d,
  Transform,
  Vector2d,
  Vector3d,
} from "@bentley/geometry-core";
import {
  BackgroundMapProviderName,
  BackgroundMapType,
  BackgroundMapSettings,
  GlobeMode,
  TerrainHeightOriginMode,
  TerrainProviderName,
  TerrainSettings,
} from "@bentley/imodeljs-common";
import {
  BackgroundMapTileTreeReference,
  BingElevationProvider,
  createDefaultViewFlagOverrides,
  GeographicTilingScheme,
  MapTile,
  MapCartoRectangle,
  MapTileTree,
  MapTilingScheme,
  QuadId,
  RealityTile,
  RealityTileDrawArgs,
  RealityTileTree,
  TerrainTileLoaderBase,
  TileContent,
  TileDrawArgs,
  TileParams,
  TileTree,
  TileTreeOwner,
  RealityTileTreeParams,
  TileTreeReference,
  TileTreeSet,
  TileTreeSupplier,
  TraversalSelectionContext,
  WebMapTileLoader,
  WebMapTileTreeProps,
  getCesiumWorldTerrainLoader,
  getGcsConverterAvailable,
  calculateEcefToDb,
} from "./internal";
import { IModelConnection } from "../IModelConnection";
import { SceneContext } from "../ViewContext";
import { RenderGraphic } from "../render/RenderGraphic";
import { TerrainTexture, RenderTerrainMeshGeometry } from "../render/RenderSystem";
import { HitDetail } from "../HitDetail";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { ScreenViewport } from "../Viewport";
import { IModelApp } from "../IModelApp";
import { TerrainMeshPrimitive } from "../render/primitives/mesh/TerrainMeshPrimitive";
import { ApproximateTerrainHeights } from "../ApproximateTerrainHeights";
import { TileLoadStatus } from "./Tile";
import { RenderMemory } from "../render/RenderMemory";

interface BackgroundTerrainTreeId {
  providerName: TerrainProviderName;
  heightOrigin: number;
  heightOriginMode: number;
  wantSkirts: boolean;
  globeMode: GlobeMode;
  exaggeration: number;
  imageryProviderName: BackgroundMapProviderName;
  imageryMapType: BackgroundMapType;
}

function createViewFlagOverrides(wantLighting: boolean) {
  return createDefaultViewFlagOverrides({ clipVolume: false, lighting: wantLighting });
}

const defaultViewFlagOverrides = createViewFlagOverrides(false);
const lightsOnViewFlagOverrides = createViewFlagOverrides(true);

class PlanarTilePatch {
  constructor(public corners: Point3d[], public normal: Vector3d, private _chordHeight: number) {
  }

  public getRangeCorners(heightRange: Range1d, result: Point3d[]): Point3d[] {
    let index = 0;
    for (const corner of this.corners)
      corner.plusScaled(this.normal, heightRange.low - this._chordHeight, result[index++]);

    for (const corner of this.corners)
      corner.plusScaled(this.normal, heightRange.high + this._chordHeight, result[index++]);

    return result;
  }
  public getClipShape(): Point3d[] {
    return [this.corners[0], this.corners[1], this.corners[3], this.corners[2]];
  }

  public setReprojectedCorners(reprojectedCorners: Point3d[], reprojectionRange: Range3d): void {
    assert(this.corners.length === 4 && reprojectedCorners.length === 4);
    for (let i = 0; i < 4; i++)
      if (reprojectionRange.containsPoint(this.corners[i]))
        this.corners[i] = reprojectedCorners[i];
  }
}

type TilePatch = PlanarTilePatch | EllipsoidPatch;

/** @internal */
export abstract class MapTileProjection {
  abstract get localRange(): Range3d;
  abstract get transformFromLocal(): Transform;
  public abstract getPoint(u: number, v: number, height: number, result?: Point3d): Point3d;
}

class EllipsoidProjection extends MapTileProjection {
  public transformFromLocal = Transform.createIdentity();
  public localRange: Range3d;
  constructor(private _patch: EllipsoidPatch, heightRange: Range1d) {
    super();
    this.localRange = _patch.range();
    this.localRange.expandInPlace(heightRange.high - heightRange.low);
  }
  private static _scratchAngles = LongitudeLatitudeNumber.createZero();
  private static _scratchRay = Ray3d.createZero();
  public getPoint(u: number, v: number, height: number, result?: Point3d): Point3d {
    const angles = this._patch.uvFractionToAngles(u, v, height, EllipsoidProjection._scratchAngles);
    const ray = this._patch.anglesToUnitNormalRay(angles, EllipsoidProjection._scratchRay);
    return Point3d.createFrom(ray!.origin, result);
  }
}

class PlanarProjection extends MapTileProjection {
  private _bilinearPatch: BilinearPatch;
  public transformFromLocal: Transform;
  public localRange: Range3d;
  constructor(patch: PlanarTilePatch, heightRange: Range1d) {
    super();
    this.transformFromLocal = Transform.createOriginAndMatrix(patch.corners[0], Matrix3d.createRigidHeadsUp(patch.normal, AxisOrder.ZYX));
    const planeCorners = this.transformFromLocal.multiplyInversePoint3dArray([patch.corners[0], patch.corners[1], patch.corners[2], patch.corners[3]])!;
    this.localRange = Range3d.createArray(planeCorners);
    this.localRange.low.z = heightRange.low;
    this.localRange.high.z = heightRange.high;
    this._bilinearPatch = new BilinearPatch(planeCorners[0], planeCorners[1], planeCorners[2], planeCorners[3]);
  }
  public getPoint(u: number, v: number, z: number, result?: Point3d): Point3d {
    result = this._bilinearPatch.uvFractionToPoint(u, v, result);
    result.z = z;
    return result;
  }
}

/** @internal */
export interface TerrainTileContent extends TileContent {
  terrain?: {
    geometry?: RenderTerrainMeshGeometry;
    /** Used on leaves to support up-sampling. */
    mesh?: TerrainMeshPrimitive;
  };
}

/** @internal */
export class TerrainMapTile extends MapTile {
  private static _maxParentHeightDepth = 4;
  public drapeTiles?: MapTile[];
  public everLoaded = false;                    // If the tile is only required for availability metadata, load it once and then allow it to be unloaded.
  protected _heightRange: Range1d | undefined;
  protected _geometry?: RenderTerrainMeshGeometry;
  protected _mesh?: TerrainMeshPrimitive;     // Primitive retained on leaves only for upsampling.
  public get isReady(): boolean { return super.isReady && this.drapesAreReady; }
  public get terrainTree() { return this.tree as BackgroundTerrainTileTree; }
  public get geometry() { return this._geometry; }
  public get mesh() { return this._mesh; }
  public get loadableTerrainTile() { return this.loadableTile as TerrainMapTile; }
  public get hasGraphics(): boolean { return undefined !== this.geometry; }
  public getRangeCorners(result: Point3d[]): Point3d[] { return this._patch instanceof PlanarTilePatch ? this._patch.getRangeCorners(this.heightRange!, result) : this.range.corners(result); }
  constructor(params: TileParams, tree: BackgroundTerrainTileTree, quadId: QuadId, private _patch: TilePatch, rectangle: MapCartoRectangle, heightRange: Range1d | undefined, cornerNormals: Ray3d[] | undefined) {
    super(params, tree, quadId, rectangle, cornerNormals);
    this._heightRange = heightRange ? heightRange.clone() : undefined;
  }
  public markUsed(args: TileDrawArgs) {
    super.markUsed(args);
    if (this.drapeTiles)
      for (const drapeTile of this.drapeTiles)
        drapeTile.markUsed(args);
  }

  public produceGraphics(): RenderGraphic | undefined {
    if (undefined !== this._graphic)
      return this._graphic;

    const geometry = this.geometry;
    assert(undefined !== geometry);
    if (undefined === geometry)
      return undefined;

    const loader = this.mapLoader;
    const textures = this.getDrapeTextures();
    return this._graphic = IModelApp.renderSystem.createTerrainMeshGraphic(geometry, loader.featureTable, textures);
  }

  public getClipShape(): Point3d[] {
    return (this._patch instanceof PlanarTilePatch) ? this._patch.getClipShape() : super.getClipShape();
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    super.collectStatistics(stats);

    if (undefined !== this._geometry)
      this._geometry.collectStatistics(stats);

    if (undefined !== this._mesh)
      this._mesh.collectStatistics(stats);
  }

  /** Height range is along with the tile corners to detect if tile intersects view frustum.
   * Range will be single value fo ron-terrain tiles -- if terrain tile is not loaded it will
   * inherit height from ancestors.
   * @internal
   */
  public get heightRange(): Range1d | undefined {
    if (undefined !== this._heightRange)
      return this._heightRange;

    for (let parent = this.parent; undefined !== parent; parent = parent.parent) {
      const mapParent = parent as TerrainMapTile;
      if (undefined !== mapParent._heightRange)
        return mapParent._heightRange;
    }

    assert(false);
    return Range1d.createNull();
  }
  public get mapTilingScheme() { return this.mapTree.sourceTilingScheme; }

  public adjustHeights(minHeight: number, maxHeight: number) {
    if (undefined === this._heightRange)
      this._heightRange = Range1d.createXX(minHeight, maxHeight);
    else {
      this._heightRange.low = Math.max(this.heightRange!.low, minHeight);
      this._heightRange.high = Math.min(this.heightRange!.high, maxHeight);
    }
  }
  public getProjection(heightRange: Range1d): MapTileProjection {
    return this._patch instanceof PlanarTilePatch ? new PlanarProjection(this._patch, heightRange) : new EllipsoidProjection(this._patch, heightRange);
  }

  public setReprojectedCorners(reprojectedCorners: Point3d[]) {
    if (this._patch instanceof PlanarTilePatch)
      this._patch.setReprojectedCorners(reprojectedCorners, this.mapTree.cartesianRange);
  }

  public get drapesAreReady(): boolean {
    if (undefined === this.drapeTiles)
      return undefined === this.terrainTree.drapeTree;

    for (const drapeTile of this.drapeTiles)
      if (!drapeTile.isReady)
        return false;
    return true;
  }

  /** Select secondary (imagery) tiles
   * @internal
   */
  public selectSecondaryTiles(args: TileDrawArgs, context: TraversalSelectionContext) {
    if (undefined === this.terrainTree.drapeTree || this.drapesAreReady)
      return;

    this.drapeTiles = this.terrainTree.drapeTree.selectCartoDrapeTiles(this, args);

    for (const drapeTile of this.drapeTiles) {
      if (drapeTile.isReady)
        args.markReady(drapeTile);
      else
        context.missing.push(drapeTile);
    }
  }

  private static _scratchRectangle1 = new MapCartoRectangle();
  private static _scratchRectangle2 = new MapCartoRectangle();

  /** The height range for terrain tiles is not known until the tiles are unloaded.  We use "ApproximateTerrainHeight" for first 6 levels but below
   * that the tiles inherit height range from parents.  THis is problematic as tiles with large height range will be unnecessarily selected as
   * they apparently intersect view frustum.   To avoid this force loading of terrain tiles if they exxeed "_maxParehtHightDepth".
   * @internal
   */

  public forceSelectRealityTile(): boolean {

    let parentHeightDepth = 0;
    for (let parent: TerrainMapTile = this; parent !== undefined && parent._heightRange === undefined; parent = parent.parent as TerrainMapTile)
      parentHeightDepth++;

    return parentHeightDepth > TerrainMapTile._maxParentHeightDepth;
  }

  private static _scratchThisDiagonal = Vector2d.create();
  private static _scratchDrapeDiagonal = Vector2d.create();
  public getDrapeTextures(): TerrainTexture[] | undefined {
    if (undefined === this.drapeTiles)
      return undefined;

    const drapeTextures: TerrainTexture[] = [];
    const thisRectangle = this.loadableTerrainTile.rectangle;
    const thisDiagonal = thisRectangle.diagonal(TerrainMapTile._scratchThisDiagonal);
    const bordersNorthPole = this.quadId.bordersNorthPole(this.mapTree.sourceTilingScheme);
    const bordersSouthPole = this.quadId.bordersSouthPole(this.mapTree.sourceTilingScheme);
    for (const drapeTile of this.drapeTiles) {
      if (drapeTile.texture) {
        drapeTextures.push(this.computeDrapeTexture(thisRectangle, thisDiagonal, drapeTile, drapeTile.rectangle));
        if ((bordersNorthPole && drapeTile.quadId.bordersNorthPole(drapeTile.mapTree.sourceTilingScheme) && drapeTile.rectangle.high.y < thisRectangle.high.y) ||
          (bordersSouthPole && drapeTile.quadId.bordersSouthPole(drapeTile.mapTree.sourceTilingScheme) && drapeTile.rectangle.low.y > thisRectangle.low.y)) {
          // Add seperate texture stretching last sliver of tile imagery to cover pole.
          const sliverRectangle = drapeTile.rectangle.clone(TerrainMapTile._scratchRectangle1);
          const clipRectangle = thisRectangle.clone(TerrainMapTile._scratchRectangle2);
          const sliverHeight = sliverRectangle.high.y - sliverRectangle.low.y;
          if (bordersSouthPole) {
            clipRectangle.high.y = sliverRectangle.low.y;
            sliverRectangle.low.y = thisRectangle.low.y;
            sliverRectangle.high.y += 1 / sliverHeight;
          } else {
            clipRectangle.low.y = sliverRectangle.high.y;
            sliverRectangle.high.y = thisRectangle.high.y;
            sliverRectangle.low.y -= 1 / sliverHeight;
          }
          drapeTextures.push(this.computeDrapeTexture(thisRectangle, thisDiagonal, drapeTile, sliverRectangle, clipRectangle));
        }
      } else {
        for (let parent = drapeTile.parent; undefined !== parent; parent = parent.parent) {
          const mapTile = parent as MapTile;
          if (mapTile.texture) {
            drapeTextures.push(this.computeDrapeTexture(thisRectangle, thisDiagonal, mapTile, mapTile.rectangle, drapeTile.rectangle));
            break;
          }
        }
      }
    }
    return drapeTextures.length > 0 ? drapeTextures : undefined;
  }

  private static _scratchIntersectRange = Range2d.createNull();
  private computeDrapeTexture(thisRectangle: Range2d, thisDiagonal: Vector2d, drapeTile: MapTile, drapeRectangle: Range2d, clipRectangle?: Range2d): TerrainTexture {
    assert(drapeTile.texture !== undefined);
    const drapeDiagonal = drapeRectangle.diagonal(TerrainMapTile._scratchDrapeDiagonal);
    const translate = Vector2d.create((thisRectangle.low.x - drapeRectangle.low.x) / drapeDiagonal.x, (thisRectangle.low.y - drapeRectangle.low.y) / drapeDiagonal.y);
    const scale = Vector2d.create(thisDiagonal.x / drapeDiagonal.x, thisDiagonal.y / drapeDiagonal.y);
    let clipRect;
    if (undefined !== clipRectangle) {
      const intersect = clipRectangle.intersect(drapeRectangle, TerrainMapTile._scratchIntersectRange);
      assert(!intersect.isNull);
      clipRect = Range2d.createXYXY((intersect.low.x - drapeRectangle.low.x) / drapeDiagonal.x, (intersect.low.y - drapeRectangle.low.y) / drapeDiagonal.y, (intersect.high.x - drapeRectangle.low.x) / drapeDiagonal.x, (intersect.high.y - drapeRectangle.low.y) / drapeDiagonal.y);
    }

    return new TerrainTexture(drapeTile.texture!, scale, translate, clipRect);
  }

  public setContent(content: TerrainTileContent): void {
    this._geometry = dispose(this._geometry); // This should never happen but paranoia.
    this._geometry = content.terrain?.geometry;
    this._mesh = content.terrain?.mesh;
    this.everLoaded = true;

    if (undefined !== content.contentRange)
      this._contentRange = content.contentRange;

    this.setIsReady();
  }

  public disposeContents() {
    super.disposeContents();
    this._geometry = dispose(this._geometry);
    this._mesh = undefined;
  }
}

/** @internal */
class TerrainMapUpsampledChild extends TerrainMapTile {
  public get isLoadable() { return false; }
  public get isUpsampled() { return true; }
  public get isEmpty() { return false; }
  public get loadableTile(): RealityTile {
    let parent = this.parent as TerrainMapTile;
    for (; parent && parent.isUpsampled; parent = parent.parent as TerrainMapTile)
      ;
    return parent;
  }

  public get geometry() {
    if (undefined === this._geometry) {
      const parent = this.loadableTerrainTile;
      const parentMesh = parent.mesh;
      if (undefined === parentMesh) {
        assert(false, "Missing leaf mesh for upSampled child");
        return undefined;
      }

      const thisId = this.quadId, parentId = parent.quadId;
      const levelDelta = thisId.level - parentId.level;
      const thisColumn = thisId.column - (parentId.column << levelDelta);
      const thisRow = thisId.row - (parentId.row << levelDelta);
      const scale = 1.0 / (1 << levelDelta);
      const parentParameterRange = Range2d.createXYXY(scale * thisColumn, scale * thisRow, scale * (thisColumn + 1), scale * (thisRow + 1));
      const upsample = parentMesh.upsample(parentParameterRange);
      this.adjustHeights(upsample.heightRange.low, upsample.heightRange.high);
      const projection = parent.getProjection(this.heightRange!);
      this._geometry = IModelApp.renderSystem.createTerrainMeshGeometry(upsample.mesh, projection.transformFromLocal);
    }
    return this._geometry;
  }
  public get isLoading(): boolean { return this.loadableTile.isLoading; }
  public get isQueued(): boolean { return this.loadableTile.isQueued; }
  public get isNotFound(): boolean { return this.loadableTile.isNotFound; }
  public get isReady(): boolean { return (this._geometry !== undefined || this.loadableTile.loadStatus === TileLoadStatus.Ready) && this.drapesAreReady; }
}

/** @internal */
class BackgroundTerrainTileTree extends MapTileTree {
  constructor(params: RealityTileTreeParams, ecefToDb: Transform, bimElevationBias: number, public geodeticOffset: number, gcsConverterAvailable: boolean, tilingScheme: MapTilingScheme, globeMode: GlobeMode, public exaggeration: number, maxDepth: number) {
    super(params, ecefToDb, bimElevationBias, gcsConverterAvailable, tilingScheme, maxDepth, globeMode, true, true);
  }
  public settings?: TerrainSettings;
  public drapeTree?: MapTileTree;

  public get maxDepth() { return this.drapeTree ? Math.max(this.drapeTree.maxDepth, this._maxDepth) : this._maxDepth; }
  public createPlanarChild(params: TileParams, quadId: QuadId, corners: Point3d[], normal: Vector3d, rectangle: MapCartoRectangle, chordHeight: number, heightRange?: Range1d): MapTile {
    const patch = new PlanarTilePatch(corners, normal, chordHeight);
    const cornerNormals = this.getCornerRays(rectangle);
    const ctor = this.mapLoader.isTileAvailable(quadId) ? TerrainMapTile : TerrainMapUpsampledChild;
    return new ctor(params, this, quadId, patch, rectangle, heightRange, cornerNormals);
  }

  public createGlobeChild(params: TileParams, quadId: QuadId, _rangeCorners: Point3d[], rectangle: MapCartoRectangle, ellipsoidPatch: EllipsoidPatch, heightRange?: Range1d): MapTile {
    return new TerrainMapTile(params, this, quadId, ellipsoidPatch, rectangle, heightRange, this.getCornerRays(rectangle));
  }
  public getChildHeightRange(quadId: QuadId, rectangle: MapCartoRectangle, parent: MapTile): Range1d | undefined {
    return (quadId.level <= ApproximateTerrainHeights.maxLevel) ? ApproximateTerrainHeights.instance.getMinimumMaximumHeights(rectangle) : (parent as TerrainMapTile).heightRange;
  }
  public purgeRealityTiles(purgeOlderThan: BeTimePoint) {
    super.purgeRealityTiles(purgeOlderThan);
    if (this.drapeTree)
      this.drapeTree.purgeRealityTiles(purgeOlderThan);
  }
}

class BackgroundTerrainTreeSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: BackgroundTerrainTreeId, rhs: BackgroundTerrainTreeId): number {
    if (lhs.wantSkirts !== rhs.wantSkirts)
      return lhs.wantSkirts ? 1 : -1;

    let cmp = compareStrings(lhs.providerName, rhs.providerName);
    if (0 === cmp) {
      cmp = compareNumbers(lhs.heightOrigin, rhs.heightOrigin);
      if (0 === cmp) {
        cmp = compareNumbers(lhs.heightOriginMode, rhs.heightOriginMode);
        if (0 === cmp) {
          cmp = compareNumbers(lhs.globeMode, rhs.globeMode);
          if (0 === cmp) {
            cmp = compareNumbers(lhs.exaggeration, rhs.exaggeration);
            if (0 === cmp) {
              cmp = compareStrings(lhs.imageryProviderName, rhs.imageryProviderName);
              if (0 === cmp)
                cmp = compareNumbers(lhs.imageryMapType, rhs.imageryMapType);
            }
          }
        }
      }
    }
    return cmp;
  }

  private async computeHeightBias(heightOrigin: number, heightOriginMode: TerrainHeightOriginMode, exaggeration: number, iModel: IModelConnection, elevationProvider: BingElevationProvider): Promise<number> {
    const projectCenter = iModel.projectExtents.center;
    switch (heightOriginMode) {
      case TerrainHeightOriginMode.Ground:
        return heightOrigin + exaggeration * (await elevationProvider.getHeightValue(projectCenter, iModel, true));

      case TerrainHeightOriginMode.Geodetic:
        return heightOrigin;

      case TerrainHeightOriginMode.Geoid:
        return heightOrigin + await elevationProvider.getGeodeticToSeaLevelOffset(projectCenter, iModel);
    }
  }

  public async createTileTree(id: BackgroundTerrainTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    await ApproximateTerrainHeights.instance.initialize();
    assert(id.providerName === "CesiumWorldTerrain");
    const elevationProvider = new BingElevationProvider();
    const gcsConverterAvailable = await getGcsConverterAvailable(iModel);

    const bimElevationBias = - await this.computeHeightBias(id.heightOrigin, id.heightOriginMode, id.exaggeration, iModel, elevationProvider);
    const modelId = iModel.transientIds.next;
    const geodeticOffset = await elevationProvider.getGeodeticToSeaLevelOffset(iModel.projectExtents.center, iModel);
    const loader = await getCesiumWorldTerrainLoader(iModel, modelId, bimElevationBias, id.wantSkirts, id.exaggeration);
    const ecefToDb = await calculateEcefToDb(iModel, bimElevationBias);

    if (undefined === loader) {
      assert(false, "Invalid Terrain Provider");
      return undefined;
    }

    const treeProps = new WebMapTileTreeProps(modelId, loader, iModel);
    return new BackgroundTerrainTileTree(treeProps, ecefToDb, bimElevationBias, geodeticOffset, gcsConverterAvailable, new GeographicTilingScheme(), id.globeMode, id.exaggeration, loader.maxDepth);
  }
}

const backgroundTerrainTreeSupplier = new BackgroundTerrainTreeSupplier();

/** Specialization of tile tree that represents background terrain.   Background terrain differs from conventional terrain as is assumed to be at least nominally available worldwide and is
 * an alternative to a planar background map
 * @internal
 */
export class BackgroundTerrainTileTreeReference extends TileTreeReference {
  public settings: BackgroundMapSettings;
  private readonly _iModel: IModelConnection;
  private readonly _mapDrapeTree: BackgroundMapTileTreeReference;

  public constructor(settings: BackgroundMapSettings, iModel: IModelConnection) {
    super();
    this.settings = settings;
    this._iModel = iModel;
    this._mapDrapeTree = new BackgroundMapTileTreeReference(settings, iModel, true);    // The drape map can not also include terrain. -- drape and background map share trees if terrain not on.
  }

  /** Terrain  tiles do not contribute to the range used by "fit view". */
  public unionFitRange(_range: Range3d): void { }

  public get castsShadows() {
    return false;
  }

  public get treeOwner(): TileTreeOwner {
    const id = {
      providerName: this.settings.terrainSettings.providerName,
      heightOrigin: this.settings.terrainSettings.heightOrigin,
      heightOriginMode: this.settings.terrainSettings.heightOriginMode,
      wantSkirts: false === this.settings.transparency,
      globeMode: this.settings.globeMode,
      exaggeration: this.settings.terrainSettings.exaggeration,
      imageryProviderName: this.settings.providerName,
      imageryMapType: this.settings.mapType,
    };

    return this._iModel.tiles.getTileTreeOwner(id, backgroundTerrainTreeSupplier);
  }

  /** Adds this reference's graphics to the scene. By default this invokes [[TileTree.drawScene]] on the referenced TileTree, if it is loaded. */
  public addToScene(context: SceneContext): void {
    if (!context.viewFlags.backgroundMap)
      return;

    const tree = this.treeOwner.load() as BackgroundTerrainTileTree;
    if (undefined === tree)
      return;     // Not loaded yet.

    const drapeTree = this._mapDrapeTree.treeOwner.load();
    if (undefined === drapeTree)
      return; // Not loaded yet.

    assert(drapeTree instanceof MapTileTree);

    tree.settings = context.viewport.displayStyle.backgroundMapSettings.terrainSettings;
    tree.drapeTree = drapeTree as MapTileTree;
    const args = this.createDrawArgs(context);
    if (undefined !== args)
      tree.draw(args);

    tree.settings = undefined;
    tree.drapeTree = undefined;
  }

  public createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const args = super.createDrawArgs(context);
    if (undefined === args)
      return undefined;

    return new RealityTileDrawArgs(args, args.worldToViewMap, args.frustumPlanes);
  }

  protected getViewFlagOverrides(tree: TileTree) {
    const settings = (tree as BackgroundTerrainTileTree).settings;
    return settings?.applyLighting ? lightsOnViewFlagOverrides : defaultViewFlagOverrides;
  }

  protected getSymbologyOverrides(_tree: TileTree) {
    return this._symbologyOverrides;
  }

  public discloseTileTrees(trees: TileTreeSet): void {
    super.discloseTileTrees(trees);
    trees.disclose(this._mapDrapeTree);
  }

  public getToolTip(hit: HitDetail): HTMLElement | string | undefined {
    const tree = this.treeOwner.tileTree as BackgroundTerrainTileTree;
    if (undefined === tree || hit.iModel !== tree.iModel || tree.modelId !== hit.sourceId || !hit.viewport || !hit.viewport.view.is3d)
      return undefined;

    const backgroundMapGeometry = hit.viewport.displayStyle.getBackgroundMapGeometry();
    if (undefined === backgroundMapGeometry)
      return undefined;

    const worldPoint = hit.hitPoint.clone();
    const cartoGraphic = backgroundMapGeometry.dbToCartographic(worldPoint!);
    const strings = [];
    strings.push("Latitude: " + Angle.radiansToDegrees(cartoGraphic.latitude).toFixed(4));
    strings.push("Longitude: " + Angle.radiansToDegrees(cartoGraphic.longitude).toFixed(4));
    const geodeticHeight = (cartoGraphic.height - tree.bimElevationBias) / tree.exaggeration;
    strings.push("Height (Meters) Geodetic: " + geodeticHeight.toFixed(1) + " Sea Level: " + (geodeticHeight - tree.geodeticOffset).toFixed(1));
    const div = document.createElement("div");
    div.innerHTML = strings.join("<br>");
    return div;
  }

  /** Add logo cards to logo div. */
  public addLogoCards(logoDiv: HTMLTableElement, vp: ScreenViewport): void {
    const drapeTree = this._mapDrapeTree.treeOwner.tileTree as RealityTileTree;
    const terrainTree = this.treeOwner.tileTree as RealityTileTree;
    if (undefined === drapeTree || undefined === terrainTree)
      return;

    const mapLoader = drapeTree.loader as WebMapTileLoader;
    const terrainLoader = terrainTree.loader as TerrainTileLoaderBase;
    mapLoader.geometryAttributionProvider = terrainLoader.geometryAttributionProvider;
    this._mapDrapeTree.addLogoCards(logoDiv, vp);
  }

  private get _symbologyOverrides(): FeatureSymbology.Overrides | undefined {
    return undefined;
  }
}
