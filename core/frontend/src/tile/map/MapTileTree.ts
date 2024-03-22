/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, compareBooleans, compareBooleansOrUndefined, compareNumbers, compareStrings, compareStringsOrUndefined, CompressedId64Set, Id64String } from "@itwin/core-bentley";
import {
  BackgroundMapSettings, BaseLayerSettings, Cartographic, ColorDef, FeatureAppearance, GeoCoordStatus, GlobeMode, MapLayerSettings, PlanarClipMaskPriority, TerrainHeightOriginMode,
} from "@itwin/core-common";
import {
  Angle, AngleSweep, Constant, Ellipsoid, EllipsoidPatch, Point3d, Range1d, Range3d, Ray3d, Transform, Vector3d, XYZProps,
} from "@itwin/core-geometry";
import { ApproximateTerrainHeights } from "../../ApproximateTerrainHeights";
import { TerrainDisplayOverrides } from "../../DisplayStyleState";
import { HitDetail } from "../../HitDetail";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { PlanarClipMaskState } from "../../PlanarClipMaskState";
import { FeatureSymbology } from "../../render/FeatureSymbology";
import { RenderPlanarClassifier } from "../../render/RenderPlanarClassifier";
import { SceneContext } from "../../ViewContext";
import { MapLayerScaleRangeVisibility, ScreenViewport } from "../../Viewport";
import {
  BingElevationProvider, createDefaultViewFlagOverrides, createMapLayerTreeReference, DisclosedTileTreeSet, EllipsoidTerrainProvider, GeometryTileTreeReference,
  GraphicsCollectorDrawArgs, ImageryMapLayerTreeReference, ImageryMapTileTree, ImageryTileTreeState, MapCartoRectangle, MapFeatureInfoOptions, MapLayerFeatureInfo, MapLayerImageryProvider, MapLayerIndex, MapLayerTileTreeReference, MapTile,
  MapTileLoader, MapTilingScheme, ModelMapLayerTileTreeReference, PlanarTilePatch, QuadId,
  RealityTile, RealityTileDrawArgs, RealityTileTree, RealityTileTreeParams, TerrainMeshProviderOptions, Tile, TileDrawArgs, TileLoadPriority, TileParams, TileTree,
  TileTreeLoadStatus, TileTreeOwner, TileTreeReference, TileTreeSupplier, UpsampledMapTile, WebMercatorTilingScheme,
} from "../internal";

const scratchPoint = Point3d.create();
const scratchCorners = [Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero()];
const scratchCorner = Point3d.createZero();
const scratchZNormal = Vector3d.create(0, 0, 1);

/** Utility interface that ties an imagery tile tree to its corresponding map-layer settings object.
 * @internal
 */
interface MapLayerTreeSetting {
  tree: ImageryMapTileTree;
  settings: MapLayerSettings;
  baseImageryLayer: boolean;
}

/** Map tile tree scale range visibility values.
 * @beta */
export enum MapTileTreeScaleRangeVisibility {
  /** state is currently unknown (i.e. never been displayed)  */
  Unknown = 0,

  /** all currently selected tree tiles are visible (i.e within the scale range)  */
  Visible,

  /** all currently selected tree tiles are hidden (i.e outside the scale range)  */
  Hidden,

  /** currently selected tree tiles are partially visible (i.e some tiles are within the scale range, and some are outside.) */
  Partial
}

/**
* Provides map layer information for a given tile tree.
* @internal
*/
export interface MapLayerInfoFromTileTree {
  /** Indicate if the map layer represents the base layer */
  isBaseLayer: boolean;

  /** Map layer index; undefined if base map */
  index?: MapLayerIndex;

  /** Settings for the map layer (or the base layer)*/
  settings: MapLayerSettings;

  /** Provider for the map layer (or the base layer) */
  provider?: MapLayerImageryProvider;
}

/** A [quad tree](https://en.wikipedia.org/wiki/Quadtree) consisting of [[MapTile]]s representing the map imagery draped onto the surface of the Earth.
 * A `MapTileTree` enables display of a globe or planar map with [map imagery](https://en.wikipedia.org/wiki/Tiled_web_map) obtained from any number of sources, such as
 * [Bing](https://learn.microsoft.com/en-us/bingmaps/), [OpenStreetMap](https://wiki.openstreetmap.org/wiki/API), and [GIS servers](https://wiki.openstreetmap.org/wiki/API).
 * The specific imagery displayed is determined by a [[Viewport]]'s [MapImagerySettings]($common) and [BackgroundMapSettings]($common).
 *
 * The map or globe may be smooth, or feature 3d geometry supplied by a [[TerrainProvider]].
 * The terrain displayed in a [[Viewport]] is determined by its [TerrainSettings]($common).
 * @public
 */

export class MapTileTree extends RealityTileTree {
  /** @internal */
  public ecefToDb: Transform;
  /** @internal */
  public bimElevationBias: number;
  /** @internal */
  public geodeticOffset: number;
  /** @internal */
  public sourceTilingScheme: MapTilingScheme;
  /** @internal */
  private _mercatorFractionToDb: Transform;
  /** @internal */
  public earthEllipsoid: Ellipsoid;
  /** @internal */
  public minEarthEllipsoid: Ellipsoid;
  /** @internal */
  public maxEarthEllipsoid: Ellipsoid;
  /** Determines whether the map displays as a plane or an ellipsoid. */
  public readonly globeMode: GlobeMode;
  /** @internal */
  public globeOrigin: Point3d;
  /** @internal */
  private _mercatorTilingScheme: MapTilingScheme;
  /** @internal */
  public useDepthBuffer: boolean;
  /** @internal */
  public isOverlay: boolean;
  /** @internal */
  public terrainExaggeration: number;
  /** @internal */
  public baseColor?: ColorDef;
  /** @internal */
  public baseTransparent: boolean;
  /** @internal */
  public mapTransparent: boolean;
  /** @internal */
  public produceGeometry?: boolean;
  /** @internal */
  public layerImageryTrees: MapLayerTreeSetting[] = [];
  private _layerSettings = new Map<Id64String, MapLayerSettings>();
  private _imageryTreeState = new Map<Id64String, ImageryTileTreeState>();
  private _modelIdToIndex = new Map<Id64String, number>();
  /** @internal */
  public layerClassifiers = new Map<number, RenderPlanarClassifier>();

  /** @internal */
  constructor(params: RealityTileTreeParams, ecefToDb: Transform, bimElevationBias: number, geodeticOffset: number,
    sourceTilingScheme: MapTilingScheme, id: MapTreeId, applyTerrain: boolean) {
    super(params);
    this.ecefToDb = ecefToDb;
    this.bimElevationBias = bimElevationBias;
    this.geodeticOffset = geodeticOffset;
    this.sourceTilingScheme = sourceTilingScheme;
    this._mercatorTilingScheme = new WebMercatorTilingScheme();
    this._mercatorFractionToDb = this._mercatorTilingScheme.computeMercatorFractionToDb(ecefToDb, bimElevationBias, params.iModel, applyTerrain);
    const quadId = new QuadId(sourceTilingScheme.rootLevel, 0, 0);
    this.globeOrigin = this.ecefToDb.getOrigin().clone();
    this.earthEllipsoid = Ellipsoid.createCenterMatrixRadii(this.globeOrigin, this.ecefToDb.matrix, Constant.earthRadiusWGS84.equator, Constant.earthRadiusWGS84.equator, Constant.earthRadiusWGS84.polar);
    const globalHeightRange = applyTerrain ? ApproximateTerrainHeights.instance.globalHeightRange : Range1d.createXX(0, 0);
    const globalRectangle = MapCartoRectangle.createMaximum();

    this.globeMode = id.globeMode;
    this.isOverlay = id.isOverlay;
    this.useDepthBuffer = id.useDepthBuffer;
    this.terrainExaggeration = id.terrainExaggeration;
    this.baseColor = id.baseColor;
    this.baseTransparent = id.baseTransparent;
    this.mapTransparent = id.mapTransparent;
    if (applyTerrain) {
      this.minEarthEllipsoid = Ellipsoid.createCenterMatrixRadii(this.globeOrigin, this.ecefToDb.matrix, Constant.earthRadiusWGS84.equator + globalHeightRange.low, Constant.earthRadiusWGS84.equator + globalHeightRange.low, Constant.earthRadiusWGS84.polar + globalHeightRange.low);
      this.maxEarthEllipsoid = Ellipsoid.createCenterMatrixRadii(this.globeOrigin, this.ecefToDb.matrix, Constant.earthRadiusWGS84.equator + globalHeightRange.high, Constant.earthRadiusWGS84.equator + globalHeightRange.high, Constant.earthRadiusWGS84.polar + globalHeightRange.high);
      this.produceGeometry = id.produceGeometry;
    } else {
      this.minEarthEllipsoid = this.earthEllipsoid;
      this.maxEarthEllipsoid = this.earthEllipsoid;
    }

    const rootPatch = EllipsoidPatch.createCapture(
      this.maxEarthEllipsoid, AngleSweep.createStartSweepRadians(0, Angle.pi2Radians),
      AngleSweep.createStartSweepRadians(-Angle.piOver2Radians, Angle.piRadians),
    );

    let range;
    if (this.globeMode === GlobeMode.Ellipsoid) {
      range = rootPatch.range();
    } else {
      const corners = this.getFractionalTileCorners(quadId);
      this._mercatorFractionToDb.multiplyPoint3dArrayInPlace(corners);
      range = Range3d.createArray(MapTile.computeRangeCorners(corners, Vector3d.create(0, 0, 1), 0, scratchCorners, globalHeightRange));
    }

    this._rootTile = this.createGlobeChild({ contentId: quadId.contentId, maximumSize: 0, range }, quadId, range.corners(), globalRectangle, rootPatch, undefined);
  }

  /** @internal */
  public override get parentsAndChildrenExclusive() {
    // If we are not depth buffering we force parents and exclusive to false to cause the map tiles to be sorted
    // by depth so that painters algorithm will approximate correct depth display.
    return this.useDepthBuffer ? this.loader.parentsAndChildrenExclusive : false;
  }

  /** Return the imagery tile tree state of matching the provided imagery tree id.
   * @internal
   */
  public getImageryTreeState(imageryTreeId: string) {
    return this._imageryTreeState.get(imageryTreeId);
  }

  /** Return a cloned dictionary of the imagery tile tree states
   * @internal
   */
  public cloneImageryTreeState() {
    const clone = new Map<Id64String, ImageryTileTreeState>();
    for (const [treeId, state] of this._imageryTreeState) {
      clone.set(treeId, state.clone());
    }
    return clone;
  }

  /** @internal */
  public tileFromQuadId(quadId: QuadId): MapTile | undefined {
    return (this._rootTile as MapTile).tileFromQuadId(quadId);
  }

  /** Add a new imagery tile tree / map-layer settings pair and initialize the imagery tile tree state.
   * @internal
   */
  public addImageryLayer(tree: ImageryMapTileTree, settings: MapLayerSettings, index: number, baseImageryLayer: boolean) {
    this.layerImageryTrees.push({ tree, settings, baseImageryLayer });
    this._layerSettings.set(tree.modelId, settings);
    if (!this._imageryTreeState.has(tree.modelId))
      this._imageryTreeState.set(tree.modelId, new ImageryTileTreeState());
    this._modelIdToIndex.set(tree.modelId, index);
  }

  /** @internal */
  public addModelLayer(layerTreeRef: ModelMapLayerTileTreeReference, context: SceneContext) {
    const classifier = context.addPlanarClassifier(`MapLayer ${this.modelId}-${layerTreeRef.layerIndex}`, layerTreeRef);
    if (classifier)
      this.layerClassifiers.set(layerTreeRef.layerIndex, classifier);
  }

  /** @internal */
  protected override collectClassifierGraphics(args: TileDrawArgs, selectedTiles: RealityTile[]) {
    super.collectClassifierGraphics(args, selectedTiles);

    this.layerClassifiers.forEach((layerClassifier: RenderPlanarClassifier) => {
      if (!(args instanceof GraphicsCollectorDrawArgs))
        layerClassifier.collectGraphics(args.context, { modelId: this.modelId, tiles: selectedTiles, location: args.location, isPointCloud: this.isPointCloud });

    });
  }

  /** @internal */
  public clearImageryTreesAndClassifiers() {
    this.layerImageryTrees.length = 0;
    this._layerSettings.clear();
    this._modelIdToIndex.clear();
    this.layerClassifiers.clear();
  }

  /** @internal */
  public override get isTransparent() {
    return this.mapTransparent || this.baseTransparent;
  }

  /** @internal */
  public override get maxDepth() {
    let maxDepth = this.loader.maxDepth;
    this.layerImageryTrees?.forEach((layerImageryTree) => maxDepth = Math.max(maxDepth, layerImageryTree.tree.maxDepth));

    return maxDepth;
  }

  /** @internal */
  public createPlanarChild(params: TileParams, quadId: QuadId, corners: Point3d[], normal: Vector3d, rectangle: MapCartoRectangle, chordHeight: number, heightRange?: Range1d): MapTile | undefined {
    const childAvailable = this.mapLoader.isTileAvailable(quadId);
    if (!childAvailable && this.produceGeometry)
      return undefined;

    const patch = new PlanarTilePatch(corners, normal, chordHeight);
    const cornerNormals = this.getCornerRays(rectangle);
    if (childAvailable)
      return new MapTile(params, this, quadId, patch, rectangle, heightRange, cornerNormals);

    assert(params.parent instanceof MapTile);
    let loadableTile: MapTile | undefined = params.parent;
    while (loadableTile?.isUpsampled)
      loadableTile = loadableTile.parent as MapTile | undefined;

    assert(undefined !== loadableTile);
    return new UpsampledMapTile(params, this, quadId, patch, rectangle, heightRange, cornerNormals, loadableTile);
  }

  /** @internal */
  public createGlobeChild(params: TileParams, quadId: QuadId, _rangeCorners: Point3d[], rectangle: MapCartoRectangle, ellipsoidPatch: EllipsoidPatch, heightRange?: Range1d): MapTile {
    return new MapTile(params, this, quadId, ellipsoidPatch, rectangle, heightRange, this.getCornerRays(rectangle));
  }

  /** @internal */
  public getChildHeightRange(quadId: QuadId, rectangle: MapCartoRectangle, parent: MapTile): Range1d | undefined {
    return this.mapLoader.getChildHeightRange(quadId, rectangle, parent);
  }

  /** @internal */
  public clearLayers() {
    (this._rootTile as MapTile).clearLayers();
  }

  /** Reprojection does not work with very large tiles so just do linear transform.
   * @internal
   */
  public static minReprojectionDepth = 8;
  /** @internal */
  public static maxGlobeDisplayDepth = 8;
  /** @internal */
  public static minDisplayableDepth = 3;
  /** @internal */
  public get mapLoader() { return this.loader as MapTileLoader; }

  /** @internal */
  public override getBaseRealityDepth(sceneContext: SceneContext) {
    // If the view has ever had global scope then preload low level (global) tiles.
    return (sceneContext.viewport.view.maxGlobalScopeFactor > 1) ? MapTileTree.minDisplayableDepth : -1;
  }

  /** @internal */
  public doCreateGlobeChildren(tile: Tile): boolean {
    if (this.globeMode !== GlobeMode.Ellipsoid)
      return false;

    const childDepth = tile.depth + 1;
    if (childDepth < MapTileTree.maxGlobeDisplayDepth)     // If the depth is too low (tile is too large) display as globe.
      return true;

    return false;  // Display as globe if more than 100 KM from project.
  }

  /** @internal */
  public override doReprojectChildren(tile: Tile): boolean {
    if (this._gcsConverter === undefined)
      return false;

    const childDepth = tile.depth + 1;
    if (childDepth < MapTileTree.minReprojectionDepth)     // If the depth is too low (tile is too large) omit reprojection.
      return false;

    return this.cartesianRange.intersectsRange(tile.range);
  }

  /** @internal */
  public getCornerRays(rectangle: MapCartoRectangle): Ray3d[] | undefined {
    const rays = new Array<Ray3d>();
    if (this.globeMode === GlobeMode.Ellipsoid) {
      rays.push(this.earthEllipsoid.radiansToUnitNormalRay(rectangle.low.x, Cartographic.parametricLatitudeFromGeodeticLatitude(rectangle.high.y))!);
      rays.push(this.earthEllipsoid.radiansToUnitNormalRay(rectangle.high.x, Cartographic.parametricLatitudeFromGeodeticLatitude(rectangle.high.y))!);
      rays.push(this.earthEllipsoid.radiansToUnitNormalRay(rectangle.low.x, Cartographic.parametricLatitudeFromGeodeticLatitude(rectangle.low.y))!);
      rays.push(this.earthEllipsoid.radiansToUnitNormalRay(rectangle.high.x, Cartographic.parametricLatitudeFromGeodeticLatitude(rectangle.low.y))!);
    } else {
      const mercatorFractionRange = rectangle.getTileFractionRange(this._mercatorTilingScheme);
      rays.push(Ray3d.createCapture(this._mercatorFractionToDb.multiplyXYZ(mercatorFractionRange.low.x, mercatorFractionRange.high.y), scratchZNormal));
      rays.push(Ray3d.createCapture(this._mercatorFractionToDb.multiplyXYZ(mercatorFractionRange.high.x, mercatorFractionRange.high.y), scratchZNormal));
      rays.push(Ray3d.createCapture(this._mercatorFractionToDb.multiplyXYZ(mercatorFractionRange.low.x, mercatorFractionRange.low.y), scratchZNormal));
      rays.push(Ray3d.createCapture(this._mercatorFractionToDb.multiplyXYZ(mercatorFractionRange.high.x, mercatorFractionRange.low.y), scratchZNormal));
    }
    return rays;
  }

  /** @internal */
  public pointAboveEllipsoid(point: Point3d): boolean {
    return this.earthEllipsoid.worldToLocal(point, scratchPoint)!.magnitude() > 1;
  }

  private getMercatorFractionChildGridPoints(tile: MapTile, columnCount: number, rowCount: number): Point3d[] {
    const gridPoints = [];
    const quadId = tile.quadId;
    const deltaX = 1.0 / columnCount, deltaY = 1.0 / rowCount;
    for (let row = 0; row <= rowCount; row++) {
      for (let column = 0; column <= columnCount; column++) {
        const xFraction = this.sourceTilingScheme.tileXToFraction(quadId.column + column * deltaX, quadId.level);
        const yFraction = this.sourceTilingScheme.tileYToFraction(quadId.row + row * deltaY, quadId.level);

        gridPoints.push(Point3d.create(xFraction, yFraction, 0));
      }
    }
    // If not mercator already need to remap latitude...
    if (!(this.sourceTilingScheme instanceof WebMercatorTilingScheme))
      for (const gridPoint of gridPoints)
        gridPoint.y = this._mercatorTilingScheme.latitudeToYFraction(this.sourceTilingScheme.yFractionToLatitude(gridPoint.y));

    return gridPoints;
  }

  private getChildCornersFromGridPoints(gridPoints: Point3d[], columnCount: number, rowCount: number) {
    const childCorners = new Array<Point3d[]>();
    for (let row = 0; row < rowCount; row++) {
      for (let column = 0; column < columnCount; column++) {
        const index0 = column + row * (columnCount + 1);
        const index1 = index0 + (columnCount + 1);
        childCorners.push([gridPoints[index0], gridPoints[index0 + 1], gridPoints[index1], gridPoints[index1 + 1]]);
      }
    }
    return childCorners;
  }

  /** @internal */
  public getCachedReprojectedPoints(gridPoints: Point3d[]): (Point3d | undefined)[] | undefined {
    const requestProps = [];
    for (const gridPoint of gridPoints)
      requestProps.push({
        x: this._mercatorTilingScheme.xFractionToLongitude(gridPoint.x) * Angle.degreesPerRadian,
        y: this._mercatorTilingScheme.yFractionToLatitude(gridPoint.y) * Angle.degreesPerRadian,
        z: this.bimElevationBias,
      });

    const iModelCoordinates = this._gcsConverter!.getCachedIModelCoordinatesFromGeoCoordinates(requestProps);

    if (iModelCoordinates.missing)
      return undefined;

    return iModelCoordinates.result.map((result) => !result || result.s ? undefined : Point3d.fromJSON(result.p));
  }

  /** Minimize reprojection requests by requesting this corners tile and a grid that will include all points for 4 levels of descendants.
   * This greatly reduces the number of reprojection requests which currently require a roundtrip through the backend.
   * @internal
   */
  public async loadReprojectionCache(tile: MapTile): Promise<void> {
    const quadId = tile.quadId;
    const xRange = Range1d.createXX(this.sourceTilingScheme.tileXToFraction(quadId.column, quadId.level), this.sourceTilingScheme.tileXToFraction(quadId.column + 1, quadId.level));
    const yRange = Range1d.createXX(this.sourceTilingScheme.tileYToFraction(quadId.row, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row + 1, quadId.level));
    const cacheDepth = 4, cacheDimension = 2 ** cacheDepth;
    const delta = 1.0 / cacheDimension;
    const requestProps = [];

    for (let row = 0; row <= cacheDimension; row++) {
      for (let column = 0; column <= cacheDimension; column++) {
        let yFraction = yRange.fractionToPoint(row * delta);
        if (!(this.sourceTilingScheme instanceof WebMercatorTilingScheme))
          yFraction = this._mercatorTilingScheme.latitudeToYFraction(this.sourceTilingScheme.yFractionToLatitude(yFraction));
        requestProps.push({
          x: this._mercatorTilingScheme.xFractionToLongitude(xRange.fractionToPoint(column * delta)) * Angle.degreesPerRadian,
          y: this._mercatorTilingScheme.yFractionToLatitude(yFraction) * Angle.degreesPerRadian,
          z: this.bimElevationBias,
        });
      }
    }

    await this._gcsConverter!.getIModelCoordinatesFromGeoCoordinates(requestProps);
  }

  private static _scratchCarto = Cartographic.createZero();

  /** Get the corners for planar children.
   * This generally will resolve immediately, but may require an asynchronous request for reprojecting the corners.
   * @internal
   */
  public getPlanarChildCorners(tile: MapTile, columnCount: number, rowCount: number, resolve: (childCorners: Point3d[][]) => void) {
    const resolveCorners = (points: Point3d[], reprojected: (Point3d | undefined)[] | undefined = undefined) => {
      for (let i = 0; i < points.length; i++) {
        const gridPoint = points[i];
        this._mercatorFractionToDb.multiplyPoint3d(gridPoint, scratchCorner);
        if (this.globeMode !== GlobeMode.Ellipsoid || this.cartesianRange.containsPoint(scratchCorner)) {
          if (reprojected !== undefined && reprojected[i] !== undefined)
            reprojected[i]!.clone(gridPoint);
          else
            scratchCorner.clone(gridPoint);
        } else {
          this._mercatorTilingScheme.fractionToCartographic(gridPoint.x, gridPoint.y, MapTileTree._scratchCarto);
          this.earthEllipsoid.radiansToPoint(MapTileTree._scratchCarto.longitude, Cartographic.parametricLatitudeFromGeodeticLatitude(MapTileTree._scratchCarto.latitude), gridPoint);
          const cartesianDistance = this.cartesianRange.distanceToPoint(scratchCorner);
          if (cartesianDistance < this.cartesianTransitionDistance)
            scratchCorner.interpolate(cartesianDistance / this.cartesianTransitionDistance, gridPoint, gridPoint);
        }
      }
      resolve(this.getChildCornersFromGridPoints(points, columnCount, rowCount));
    };

    let reprojectedPoints: (Point3d | undefined)[] | undefined;
    const gridPoints = this.getMercatorFractionChildGridPoints(tile, columnCount, rowCount);
    if (this.doReprojectChildren(tile)) {
      reprojectedPoints = this.getCachedReprojectedPoints(gridPoints);
      if (reprojectedPoints) {
        // If the reprojected corners are in the cache, resolve immediately.
        resolveCorners(gridPoints, reprojectedPoints);
      } else {
        // If the reprojected corners are not in cache request them - but also request reprojection of a grid that will include descendent corners to ensure they can
        // be reloaded without expensive reprojection requests.
        this.loadReprojectionCache(tile).then(() => {
          const reprojected = this.getCachedReprojectedPoints(gridPoints);
          assert(reprojected !== undefined);     // We just cached them... they better be there now.
          resolveCorners(gridPoints, reprojected);
        }).catch((_error: Error) => {
          resolveCorners(gridPoints);
        });
      }
    } else {
      resolveCorners(gridPoints);
    }
  }

  /** Scan the list of currently selected reality tiles, and fire the viewport's 'onMapLayerScaleRangeVisibilityChanged ' event
   * if any scale range visibility change is detected for one more map-layer definition.
   * @internal
   */
  public override reportTileVisibility(args: TileDrawArgs, selected: RealityTile[]) {

    const debugControl = args.context.target.debugControl;

    const layersVisibilityBefore = this.cloneImageryTreeState();

    const changes = new Array<MapLayerScaleRangeVisibility>();

    if (!layersVisibilityBefore)
      return;

    for (const [treeId] of layersVisibilityBefore) {
      const treeVisibility = this.getImageryTreeState(treeId);
      if (treeVisibility) {
        treeVisibility.reset();
      }
    }

    for (const selectedTile of selected) {
      if (selectedTile instanceof MapTile) {
        let selectedImageryTiles = selectedTile.imageryTiles;
        if (selectedTile.hiddenImageryTiles) {
          selectedImageryTiles = selectedImageryTiles ? [...selectedImageryTiles, ...selectedTile.hiddenImageryTiles] : selectedTile.hiddenImageryTiles;
        }

        const leafTiles = selectedTile.highResolutionReplacementTiles;
        if (leafTiles) {
          for (const tile of leafTiles) {
            const treeState = this.getImageryTreeState(tile.tree.id);
            treeState?.setScaleRangeVisibility(false);
          }
        }

        if (selectedImageryTiles) {
          for (const selectedImageryTile of selectedImageryTiles) {
            const treeState = this.getImageryTreeState(selectedImageryTile.tree.id);
            if (treeState) {
              if (selectedImageryTile.isOutOfLodRange) {
                treeState.setScaleRangeVisibility(false);
              } else {
                treeState.setScaleRangeVisibility(true);
              }
            }

          }
        }
      }
    }

    for (const [treeId, prevState] of layersVisibilityBefore) {
      const newState = this.getImageryTreeState(treeId);
      if (newState) {

        const prevVisibility = prevState.getScaleRangeVisibility();
        const visibility = newState.getScaleRangeVisibility();
        if (prevVisibility !== visibility) {

          if (debugControl && debugControl.logRealityTiles) {
            // eslint-disable-next-line no-console
            console.log(`ImageryTileTree '${treeId}' changed prev state: '${MapTileTreeScaleRangeVisibility[prevVisibility]}' new state: '${MapTileTreeScaleRangeVisibility[visibility]}'`);
          }

          const mapLayersIndexes = args.context.viewport.getMapLayerIndexesFromIds(this.id, treeId);
          for (const index of mapLayersIndexes) {
            changes.push({ index: index.index, isOverlay: index.isOverlay, visibility });
          }

        }
      }
    }

    if (changes.length !== 0) {
      args.context.viewport.onMapLayerScaleRangeVisibilityChanged.raiseEvent(changes);
    }

  }

  /** @internal */
  public getFractionalTileCorners(quadId: QuadId): Point3d[] {
    const corners: Point3d[] = [];
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row, quadId.level), 0.0));
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column + 1, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row, quadId.level), 0.0));
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row + 1, quadId.level), 0.0));
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column + 1, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row + 1, quadId.level), 0.0));
    return corners;
  }

  /** @internal */
  public getTileRectangle(quadId: QuadId): MapCartoRectangle {
    return this.sourceTilingScheme.tileXYToRectangle(quadId.column, quadId.row, quadId.level);
  }

  /** @internal */
  public getLayerIndex(imageryTreeId: Id64String) {
    const index = this._modelIdToIndex.get(imageryTreeId);
    return index === undefined ? -1 : index;
  }

  /** @internal */
  public getLayerTransparency(imageryTreeId: Id64String): number {
    const layerSettings = this._layerSettings.get(imageryTreeId);
    assert(undefined !== layerSettings);
    return undefined === layerSettings || !layerSettings.transparency ? 0.0 : layerSettings.transparency;
  }
}

interface MapTreeId {
  tileUserId: number;
  applyTerrain: boolean;
  terrainProviderName: string;
  terrainDataSource: string;
  terrainHeightOrigin: number;
  terrainHeightOriginMode: number;
  terrainExaggeration: number;
  mapGroundBias: number;
  wantSkirts: boolean;
  wantNormals: boolean;
  globeMode: GlobeMode;
  useDepthBuffer: boolean;
  isOverlay: boolean;
  baseColor?: ColorDef;
  baseTransparent: boolean;
  mapTransparent: boolean;
  maskModelIds?: string;
  produceGeometry?: boolean;
}

/** @internal */
class MapTileTreeProps implements RealityTileTreeParams {
  public id: string;
  public modelId: string;
  public location = Transform.createIdentity();
  public yAxisUp = true;
  public is3d = true;
  public rootTile = { contentId: "", range: Range3d.createNull(), maximumSize: 0 };
  public loader: MapTileLoader;
  public iModel: IModelConnection;
  public get priority(): TileLoadPriority { return this.loader.priority; }

  public constructor(modelId: Id64String, loader: MapTileLoader, iModel: IModelConnection, public gcsConverterAvailable: boolean) {
    this.id = this.modelId = modelId;
    this.loader = loader;
    this.iModel = iModel;
  }
}

function createViewFlagOverrides(wantLighting: boolean, wantThematic: false | undefined) {
  return createDefaultViewFlagOverrides({ clipVolume: false, lighting: wantLighting, thematic: wantThematic });
}

class MapTreeSupplier implements TileTreeSupplier {
  public readonly isEcefDependent = true;

  public compareTileTreeIds(lhs: MapTreeId, rhs: MapTreeId): number {
    let cmp = compareNumbers(lhs.tileUserId, rhs.tileUserId);
    if (0 === cmp) {
      cmp = compareStringsOrUndefined(lhs.maskModelIds, rhs.maskModelIds);
      if (0 === cmp) {
        cmp = compareBooleans(lhs.isOverlay, rhs.isOverlay);
        if (0 === cmp) {
          cmp = compareBooleans(lhs.wantSkirts, rhs.wantSkirts);
          if (0 === cmp) {
            cmp = compareBooleans(lhs.wantNormals, rhs.wantNormals);
            if (0 === cmp) {
              cmp = compareNumbers(lhs.globeMode, rhs.globeMode);
              if (0 === cmp) {
                cmp = compareNumbers(lhs.baseColor ? lhs.baseColor.tbgr : -1, rhs.baseColor ? rhs.baseColor.tbgr : -1);
                if (0 === cmp) {
                  cmp = compareBooleans(lhs.baseTransparent, rhs.baseTransparent);
                  if (0 === cmp) {
                    cmp = compareBooleans(lhs.mapTransparent, rhs.mapTransparent);
                    if (0 === cmp) {
                      cmp = compareBooleans(lhs.applyTerrain, rhs.applyTerrain);
                      if (0 === cmp) {
                        if (lhs.applyTerrain) {
                          // Terrain-only settings.
                          cmp = compareStrings(lhs.terrainProviderName, rhs.terrainProviderName);
                          if (0 === cmp) {
                            cmp = compareStringsOrUndefined(lhs.terrainDataSource, rhs.terrainDataSource);
                            if (0 === cmp) {
                              cmp = compareNumbers(lhs.terrainHeightOrigin, rhs.terrainHeightOrigin);
                              if (0 === cmp) {
                                cmp = compareNumbers(lhs.terrainHeightOriginMode, rhs.terrainHeightOriginMode);
                                if (0 === cmp) {
                                  cmp = compareNumbers(lhs.terrainExaggeration, rhs.terrainExaggeration);
                                  if (0 === cmp)
                                    cmp = compareBooleansOrUndefined(lhs.produceGeometry, rhs.produceGeometry);
                                }
                              }
                            }
                          }
                        } else {
                          // Non-Terrain (flat) settings.
                          cmp = compareNumbers(lhs.mapGroundBias, rhs.mapGroundBias);
                          if (0 === cmp)
                            cmp = compareBooleans(lhs.useDepthBuffer, rhs.useDepthBuffer);
                        }
                      }
                    }
                  }
                }
              }
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

  public async createTileTree(id: MapTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    let bimElevationBias = 0, terrainProvider, geodeticOffset = 0;
    let applyTerrain = id.applyTerrain;
    const modelId = iModel.transientIds.getNext();
    const gcsConverterAvailable = await getGcsConverterAvailable(iModel);

    const terrainOpts: TerrainMeshProviderOptions = {
      wantSkirts: id.wantSkirts,
      exaggeration: id.terrainExaggeration,
      wantNormals: id.wantNormals,
      dataSource: id.terrainDataSource,
    };

    if (id.applyTerrain) {
      await ApproximateTerrainHeights.instance.initialize();
      const elevationProvider = new BingElevationProvider();

      bimElevationBias = - await this.computeHeightBias(id.terrainHeightOrigin, id.terrainHeightOriginMode, id.terrainExaggeration, iModel, elevationProvider);
      geodeticOffset = await elevationProvider.getGeodeticToSeaLevelOffset(iModel.projectExtents.center, iModel);
      const provider = IModelApp.terrainProviderRegistry.find(id.terrainProviderName);
      if (provider)
        terrainProvider = await provider.createTerrainMeshProvider(terrainOpts);

      if (!terrainProvider) {
        applyTerrain = false;
        geodeticOffset = 0;
      }
    }

    if (!terrainProvider) {
      terrainProvider = new EllipsoidTerrainProvider(terrainOpts);
      bimElevationBias = id.mapGroundBias;
    }

    const loader = new MapTileLoader(iModel, modelId, bimElevationBias, terrainProvider);
    const ecefToDb = iModel.getMapEcefToDb(bimElevationBias);

    if (id.maskModelIds)
      await iModel.models.load(CompressedId64Set.decompressSet(id.maskModelIds));

    const treeProps = new MapTileTreeProps(modelId, loader, iModel, gcsConverterAvailable);
    return new MapTileTree(treeProps, ecefToDb, bimElevationBias, geodeticOffset, terrainProvider.tilingScheme, id, applyTerrain);
  }
}

const mapTreeSupplier = new MapTreeSupplier();

/** @internal */
type CheckTerrainDisplayOverride = () => TerrainDisplayOverrides | undefined;

/** Specialization of tile tree that represents background map.
 * @internal
 */
export class MapTileTreeReference extends TileTreeReference {
  private _tileUserId: number;
  private _settings: BackgroundMapSettings;
  private readonly _iModel: IModelConnection;
  private _baseImageryLayerIncluded = false;
  private _baseColor?: ColorDef;
  private readonly _layerTrees = new Array<MapLayerTileTreeReference | undefined>();
  private _baseTransparent = false;
  private _symbologyOverrides: FeatureSymbology.Overrides | undefined;
  private _planarClipMask?: PlanarClipMaskState;

  public constructor(
    settings: BackgroundMapSettings,
    private _baseLayerSettings: BaseLayerSettings | undefined,
    private _layerSettings: MapLayerSettings[],
    iModel: IModelConnection,
    tileUserId: number,
    public isOverlay: boolean,
    private _isDrape: boolean,
    private _overrideTerrainDisplay?: CheckTerrainDisplayOverride) {
    super();
    this._tileUserId = tileUserId;
    this._settings = settings;
    this._iModel = iModel;
    let tree;
    if (!isOverlay && this._baseLayerSettings !== undefined) {
      if (this._baseLayerSettings instanceof MapLayerSettings) {
        tree = createMapLayerTreeReference(this._baseLayerSettings, 0, iModel);
        this._baseTransparent = this._baseLayerSettings.transparency > 0;
      } else {
        this._baseColor = this._baseLayerSettings;
        this._baseTransparent = this._baseColor?.getTransparency() > 0;
      }
    }

    if (this._baseImageryLayerIncluded = (undefined !== tree))
      this._layerTrees.push(tree);

    for (let i = 0; i < this._layerSettings.length; i++)
      if (undefined !== (tree = createMapLayerTreeReference(this._layerSettings[i], i + 1, iModel)))
        this._layerTrees.push(tree);

    if (this._settings.planarClipMask && this._settings.planarClipMask.isValid)
      this._planarClipMask = PlanarClipMaskState.create(this._settings.planarClipMask);

    if (this._overrideTerrainDisplay && this._overrideTerrainDisplay()?.produceGeometry)
      this.collectTileGeometry = (collector) => this._collectTileGeometry(collector);
  }

  public forEachLayerTileTreeRef(func: (ref: TileTreeReference) => void): void {
    for (const layerTree of this._layerTrees) {
      assert(layerTree instanceof MapLayerTileTreeReference);
      func(layerTree);
    }
  }

  public override get isGlobal() { return true; }
  public get baseColor(): ColorDef | undefined { return this._baseColor; }
  public override get planarclipMaskPriority(): number { return PlanarClipMaskPriority.BackgroundMap; }

  protected override _createGeometryTreeReference(): GeometryTileTreeReference | undefined {
    if (!this._settings.applyTerrain || this._isDrape)
      return undefined;     // Don't bother generating non-terrain (flat) geometry.

    const ref = new MapTileTreeReference(this._settings, undefined, [], this._iModel, this._tileUserId, false, false, () => {
      return { produceGeometry: true };
    });

    assert(undefined !== ref.collectTileGeometry);
    return ref as GeometryTileTreeReference;
  }

  /** Terrain  tiles do not contribute to the range used by "fit view". */
  public override unionFitRange(_range: Range3d): void { }
  public get settings(): BackgroundMapSettings { return this._settings; }
  public set settings(settings: BackgroundMapSettings) {
    this._settings = settings;
    this._planarClipMask = settings.planarClipMask ? PlanarClipMaskState.create(settings.planarClipMask) : undefined;
  }
  public setBaseLayerSettings(baseLayerSettings: BaseLayerSettings) {
    assert(!this.isOverlay);
    let tree;
    this._baseLayerSettings = baseLayerSettings;

    if (baseLayerSettings instanceof MapLayerSettings) {
      tree = createMapLayerTreeReference(baseLayerSettings, 0, this._iModel);
      this._baseColor = undefined;
      this._baseTransparent = baseLayerSettings.transparency > 0;
    } else {
      this._baseColor = baseLayerSettings;
      this._baseTransparent = this._baseColor.getTransparency() > 0;
    }

    if (tree) {
      if (this._baseImageryLayerIncluded)
        this._layerTrees[0] = tree;
      else
        this._layerTrees.splice(0, 0, tree);
    } else {
      if (this._baseImageryLayerIncluded)
        this._layerTrees.shift();
    }
    this._baseImageryLayerIncluded = tree !== undefined;
    this.clearLayers();
  }
  public get layerSettings(): MapLayerSettings[] {
    return this._layerSettings;
  }

  public setLayerSettings(layerSettings: MapLayerSettings[]) {
    this._layerSettings = layerSettings;
    const baseLayerIndex = this._baseImageryLayerIncluded ? 1 : 0;

    this._layerTrees.length = Math.min(layerSettings.length + baseLayerIndex, this._layerTrees.length);    // Truncate if number of layers reduced.
    for (let i = 0; i < layerSettings.length; i++) {
      const treeIndex = i + baseLayerIndex;
      if (treeIndex >= this._layerTrees.length || !this._layerTrees[treeIndex]?.layerSettings.displayMatches(layerSettings[i]))
        this._layerTrees[treeIndex] = createMapLayerTreeReference(layerSettings[i], treeIndex, this._iModel)!;
    }
    this.clearLayers();
  }

  public clearLayers() {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (undefined !== tree)
      tree.clearLayers();
  }

  public override get castsShadows() {
    return false;
  }

  protected override get _isLoadingComplete(): boolean {
    // Wait until drape tree is fully loaded too.
    for (const drapeTree of this._layerTrees)
      if (drapeTree && !drapeTree.isLoadingComplete)
        return false;

    return super._isLoadingComplete;
  }
  public get useDepthBuffer() {
    return !this.isOverlay && (this.settings.applyTerrain || this.settings.useDepthBuffer);
  }

  public get treeOwner(): TileTreeOwner {
    let wantSkirts = (this.settings.applyTerrain || this.useDepthBuffer) && !this.settings.transparency && !this._baseTransparent;
    if (wantSkirts) {
      const maskTrans = this._planarClipMask?.settings.transparency;
      wantSkirts = (undefined === maskTrans || maskTrans <= 0);
    }

    const id: MapTreeId = {
      tileUserId: this._tileUserId,
      applyTerrain: this.settings.applyTerrain && !this._isDrape,
      terrainProviderName: this.settings.terrainSettings.providerName,
      terrainDataSource: this.settings.terrainSettings.dataSource,
      terrainHeightOrigin: this.settings.terrainSettings.heightOrigin,
      terrainHeightOriginMode: this.settings.terrainSettings.heightOriginMode,
      terrainExaggeration: this.settings.terrainSettings.exaggeration,
      mapGroundBias: this.settings.groundBias,
      wantSkirts,
      // Can set to this.settings.terrainSettings.applyLighting if we want to ever apply lighting to terrain again so that normals are retrieved when lighting is on.
      wantNormals: false,
      globeMode: this._isDrape ? GlobeMode.Plane : this.settings.globeMode,
      isOverlay: this.isOverlay,
      useDepthBuffer: this.useDepthBuffer,
      baseColor: this._baseColor,
      baseTransparent: this._baseTransparent,
      mapTransparent: Number(this.settings.transparency) > 0,
      maskModelIds: this._planarClipMask?.settings.compressedModelIds,
      produceGeometry: false,
    };

    if (undefined !== this._overrideTerrainDisplay) {
      const ovr = this._overrideTerrainDisplay();
      if (undefined !== ovr) {
        id.wantSkirts = ovr.wantSkirts ?? id.wantSkirts;
        id.wantNormals = ovr.wantNormals ?? id.wantNormals;
        id.produceGeometry = ovr.produceGeometry === true;
      }
    }

    return this._iModel.tiles.getTileTreeOwner(id, mapTreeSupplier);
  }
  public getLayerImageryTreeRef(index: number): MapLayerTileTreeReference | undefined {
    const baseLayerIndex = this._baseImageryLayerIncluded ? 1 : 0;
    const treeIndex = index + baseLayerIndex;
    return index < 0 || treeIndex >= this._layerTrees.length ? undefined : this._layerTrees[treeIndex];
  }

  /** Return the map-layer scale range visibility for the provided map-layer index.
 * @internal
 */
  public getMapLayerScaleRangeVisibility(index: number): MapTileTreeScaleRangeVisibility {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (undefined !== tree) {
      const tileTreeRef = this.getLayerImageryTreeRef(index);
      const treeId = tileTreeRef?.treeOwner.tileTree?.id;
      if (treeId !== undefined) {
        const treeState = tree.getImageryTreeState(treeId);
        if (treeState !== undefined)
          return treeState.getScaleRangeVisibility();
      }
    }
    return MapTileTreeScaleRangeVisibility.Unknown;
  }

  public initializeLayers(context: SceneContext): boolean {
    let hasLoadedTileTree = false;
    const tree = this.treeOwner.load() as MapTileTree;
    if (undefined === tree) {
      return hasLoadedTileTree;     // Not loaded yet.
    }

    tree.layerImageryTrees.length = 0;
    if (0 === this._layerTrees.length) {
      return !this.isOverlay;
    }

    let treeIndex = this._layerTrees.length - 1;
    // Start displaying at the highest completely opaque layer...
    for (; treeIndex >= 1; treeIndex--) {
      const layerTreeRef = this._layerTrees[treeIndex];
      if (layerTreeRef?.isOpaque)
        break;    // This layer is completely opaque and will obscure all others so ignore lower ones.
    }

    for (; treeIndex < this._layerTrees.length; treeIndex++) {
      const layerTreeRef = this._layerTrees[treeIndex];
      // Load tile tree for each configured layer.
      // Note: Non-visible layer are also added to allow proper tile tree scale range visibility reporting.
      if (layerTreeRef && TileTreeLoadStatus.NotFound !== layerTreeRef.treeOwner.loadStatus
        && !layerTreeRef.layerSettings.allSubLayersInvisible) {
        const layerTree = layerTreeRef.treeOwner.load();
        if (layerTree !== undefined) {
          hasLoadedTileTree = true;
        } else {
          // Let's continue, there might be loaded tile tree in the list
          continue;
        }

        // Add loaded TileTree
        const baseImageryLayer = this._baseImageryLayerIncluded && (treeIndex === 0);
        if (layerTree instanceof ImageryMapTileTree) {
          tree.addImageryLayer(layerTree, layerTreeRef.layerSettings, treeIndex, baseImageryLayer);
        } else if (layerTreeRef instanceof ModelMapLayerTileTreeReference)
          tree.addModelLayer(layerTreeRef, context);
      }
    }

    return hasLoadedTileTree;
  }

  /** Adds this reference's graphics to the scene. By default this invokes [[TileTree.drawScene]] on the referenced TileTree, if it is loaded. */
  public override addToScene(context: SceneContext): void {
    if (!context.viewFlags.backgroundMap)
      return;

    const tree = this.treeOwner.load() as MapTileTree;
    if (undefined === tree || !this.initializeLayers(context))
      return;     // Not loaded yet.

    if (this._planarClipMask && this._planarClipMask.settings.isValid)
      context.addPlanarClassifier(tree.modelId, undefined, this._planarClipMask);

    const nonLocatable = this.settings.locatable ? undefined : true;
    const transparency = this.settings.transparency ? this.settings.transparency : undefined;
    this._symbologyOverrides = new FeatureSymbology.Overrides();
    if (nonLocatable || transparency) {
      this._symbologyOverrides.override({
        modelId: tree.modelId,
        appearance: FeatureAppearance.fromJSON({ transparency, nonLocatable }),
      });
    }

    const args = this.createDrawArgs(context);
    if (undefined !== args)
      tree.draw(args);

    tree.clearImageryTreesAndClassifiers();
  }

  public override createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const args = super.createDrawArgs(context);
    if (undefined === args)
      return undefined;

    const tree = this.treeOwner.load() as MapTileTree;
    return new RealityTileDrawArgs(args, args.worldToViewMap, args.frustumPlanes, undefined, tree?.layerClassifiers);
  }

  protected override getViewFlagOverrides(_tree: TileTree) {
    return createViewFlagOverrides(false, this._settings.applyTerrain ? undefined : false);
  }

  protected override getSymbologyOverrides(_tree: TileTree) {
    return this._symbologyOverrides;
  }

  public override discloseTileTrees(trees: DisclosedTileTreeSet): void {
    super.discloseTileTrees(trees);
    for (const imageryTree of this._layerTrees)
      if (imageryTree)
        trees.disclose(imageryTree);

    if (this._planarClipMask)
      this._planarClipMask.discloseTileTrees(trees);
  }

  public imageryTreeFromTreeModelIds(mapTreeModelId: Id64String, layerTreeModelId: Id64String): ImageryMapLayerTreeReference[] {
    const imageryTrees: ImageryMapLayerTreeReference[] = [];
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (undefined === tree || tree.modelId !== mapTreeModelId)
      return imageryTrees;

    for (const imageryTree of this._layerTrees)
      if (imageryTree && imageryTree.treeOwner.tileTree && imageryTree.treeOwner.tileTree.modelId === layerTreeModelId)
        imageryTrees.push(imageryTree);

    return imageryTrees;
  }

  public layerFromTreeModelIds(mapTreeModelId: Id64String, layerTreeModelId: Id64String): MapLayerInfoFromTileTree[] {
    const imageryTree = this.imageryTreeFromTreeModelIds(mapTreeModelId, layerTreeModelId);
    return imageryTree.map((tree) => {
      const isBaseLayer = (this._baseImageryLayerIncluded && tree.layerIndex === 0);
      return {
        isBaseLayer,
        index: isBaseLayer ? undefined : {isOverlay: this.isOverlay, index: this._baseImageryLayerIncluded ? tree.layerIndex -1 : tree.layerIndex},
        settings: tree.layerSettings, provider: tree.imageryProvider};
    });
  }

  // Utility method that execute the provided function for every *imagery* tiles under a given HitDetail object.
  private async forEachImageryTileHit(hit: HitDetail, func: (imageryTreeRef: ImageryMapLayerTreeReference, quadId: QuadId, cartoGraphic: Cartographic, imageryTree: ImageryMapTileTree) => Promise<void>): Promise<void> {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (undefined === tree || hit.iModel !== tree.iModel || tree.modelId !== hit.modelId || !hit.viewport || !hit.viewport.view.is3d)
      return undefined;

    const backgroundMapGeometry = hit.viewport.displayStyle.getBackgroundMapGeometry();
    if (undefined === backgroundMapGeometry)
      return undefined;

    const worldPoint = hit.hitPoint.clone();
    let cartoGraphic: Cartographic | undefined;
    try {
      cartoGraphic = (await backgroundMapGeometry.dbToWGS84CartographicFromGcs([worldPoint]))[0];
    } catch {
    }
    if (!cartoGraphic) {
      return undefined;
    }

    const imageryTreeRef = this.imageryTreeFromTreeModelIds(hit.modelId, hit.sourceId);
    if (imageryTreeRef.length > 0) {
      if (hit.tileId !== undefined) {
        const terrainQuadId = QuadId.createFromContentId(hit.tileId);
        const terrainTile = tree.tileFromQuadId(terrainQuadId);

        for (const treeRef of imageryTreeRef) {
          const processedTileIds: string[] = [];
          if (terrainTile && terrainTile.imageryTiles) {
            const imageryTree = treeRef.treeOwner.tileTree as ImageryMapTileTree;
            if (imageryTree) {
              for (const imageryTile of terrainTile.imageryTiles) {
                if (!processedTileIds.includes(imageryTile.contentId)
                  && imageryTree === imageryTile.imageryTree
                  && imageryTile.rectangle.containsCartographic(cartoGraphic)) {
                  processedTileIds.push(imageryTile.contentId);
                  try {
                    await func(treeRef, imageryTile.quadId, cartoGraphic, imageryTree);
                  } catch {
                    // continue iterating even though we got a failure.
                  }

                }

              }
            }
          }
        }
      }
    }
  }

  public override canSupplyToolTip(hit: HitDetail): boolean {
    const tree = this.treeOwner.tileTree;
    return undefined !== tree && tree.modelId === hit.modelId;
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined> {
    const tree = this.treeOwner.tileTree as MapTileTree | undefined;
    if (undefined === tree || tree.modelId !== hit.modelId)
      return undefined;

    let carto: Cartographic | undefined;

    const strings: string[] = [];

    const getTooltipFunc = async (imageryTreeRef: ImageryMapLayerTreeReference, quadId: QuadId, cartoGraphic: Cartographic, imageryTree: ImageryMapTileTree) => {
      strings.push(`Imagery Layer: ${imageryTreeRef.layerSettings.name}`);
      carto = cartoGraphic;
      await imageryTree.imageryLoader.getToolTip(strings, quadId, cartoGraphic, imageryTree);
    };
    try {
      await this.forEachImageryTileHit(hit, getTooltipFunc);
    } catch {
      // No results added
    }

    if (carto) {
      strings.push(`Latitude: ${carto.latitudeDegrees.toFixed(4)}`);
      strings.push(`Longitude: ${carto.longitudeDegrees.toFixed(4)}`);
      if (this.settings.applyTerrain && tree.terrainExaggeration !== 0.0) {
        const geodeticHeight = (carto.height - tree.bimElevationBias) / tree.terrainExaggeration;
        strings.push(`Height (Meters) Geodetic: ${geodeticHeight.toFixed(1)} Sea Level: ${(geodeticHeight - tree.geodeticOffset).toFixed(1)}`);
      }
    }

    const div = document.createElement("div");
    div.innerHTML = strings.join("<br>");
    return div;
  }

  public override async getMapFeatureInfo(hit: HitDetail, options?: MapFeatureInfoOptions): Promise<MapLayerFeatureInfo[] | undefined> {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (undefined === tree || hit.iModel !== tree.iModel || tree.modelId !== hit.modelId || !hit.viewport || !hit.viewport.view.is3d)
      return undefined;

    const info: MapLayerFeatureInfo[] = [];
    const imageryTreeRef = this.imageryTreeFromTreeModelIds(hit.modelId, hit.sourceId);
    if (imageryTreeRef !== undefined) {

      const getFeatureInfoFunc = async (_imageryTreeRef: ImageryMapLayerTreeReference, quadId: QuadId, cartoGraphic: Cartographic, imageryTree: ImageryMapTileTree) => {
        try {
          await imageryTree.imageryLoader.getMapFeatureInfo(info, quadId, cartoGraphic, imageryTree, hit, options);
        } catch {
        }
      };
      try {
        await this.forEachImageryTileHit(hit, getFeatureInfoFunc);
      } catch {
        // No results added
      }

    }

    return info;
  }

  /** Add logo cards to logo div. */
  public override addLogoCards(cards: HTMLTableElement, vp: ScreenViewport): void {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (tree) {
      tree.mapLoader.terrainProvider.addLogoCards(cards, vp);
      for (const imageryTreeRef of this._layerTrees) {
        if (imageryTreeRef?.layerSettings.visible) {
          const imageryTree = imageryTreeRef.treeOwner.tileTree;
          if (imageryTree instanceof ImageryMapTileTree)
            imageryTree.addLogoCards(cards, vp);
        }
      }
    }
  }
}

/** Returns whether a GCS converter is available.
 * @internal
 */
export async function getGcsConverterAvailable(iModel: IModelConnection) {
  if (iModel.noGcsDefined)
    return false;

  // Determine if we have a usable GCS.
  const converter = iModel.geoServices.getConverter("WGS84");
  if (undefined === converter)
    return false;
  const requestProps: XYZProps[] = [{ x: 0, y: 0, z: 0 }];
  let haveConverter;
  try {
    const responseProps = await converter.getIModelCoordinatesFromGeoCoordinates(requestProps);
    haveConverter = responseProps.iModelCoords.length === 1 && responseProps.iModelCoords[0].s !== GeoCoordStatus.NoGCSDefined;
  } catch {
    haveConverter = false;
  }
  return haveConverter;
}
