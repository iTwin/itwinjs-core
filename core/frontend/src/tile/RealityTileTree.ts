/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, BeTimePoint } from "@itwin/core-bentley";
import { Matrix3d, Point3d, Range3d, Transform, Vector3d, XYZProps } from "@itwin/core-geometry";
import { Cartographic, ColorDef, Frustum, FrustumPlanes, GeoCoordStatus, ViewFlagOverrides } from "@itwin/core-common";
import { BackgroundMapGeometry } from "../BackgroundMapGeometry";
import { GeoConverter } from "../GeoServices";
import { IModelApp } from "../IModelApp";
import { GraphicBranch } from "../render/GraphicBranch";
import { GraphicBuilder } from "../render/GraphicBuilder";
import { SceneContext } from "../ViewContext";
import { GraphicsCollectorDrawArgs, MapTile, RealityTile, RealityTileDrawArgs, RealityTileLoader, RealityTileParams, Tile, TileDrawArgs, TileGraphicType, TileParams, TileTree, TileTreeParams } from "./internal";

/** @internal */
export class TraversalDetails {
  public queuedChildren = new Array<Tile>();
  public childrenLoading = false;
  public childrenSelected = false;

  public initialize() {
    this.queuedChildren.length = 0;
    this.childrenLoading = false;
    this.childrenSelected = false;
  }
}
/** @internal */
export class TraversalChildrenDetails {
  private _childDetails: TraversalDetails[] = [];

  public initialize() {
    for (const child of this._childDetails)
      child.initialize();
  }
  public getChildDetail(index: number) {
    while (this._childDetails.length <= index)
      this._childDetails.push(new TraversalDetails());

    return this._childDetails[index];
  }

  public combine(parentDetails: TraversalDetails) {
    parentDetails.queuedChildren.length = 0;
    parentDetails.childrenLoading = false;
    parentDetails.childrenSelected = false;
    for (const child of this._childDetails) {
      parentDetails.childrenLoading = parentDetails.childrenLoading || child.childrenLoading;
      parentDetails.childrenSelected = parentDetails.childrenSelected || child.childrenSelected;
      for (const queuedChild of child.queuedChildren)
        parentDetails.queuedChildren.push(queuedChild);
    }
  }
}

/** @internal */
export class TraversalSelectionContext {
  public preloaded = new Set<RealityTile>();
  public missing = new Array<RealityTile>();
  public get selectionCountExceeded() { return this._maxSelectionCount === undefined ? false : (this.missing.length + this.selected.length) > this._maxSelectionCount; }   // Avoid selecting excessive number of tiles.
  constructor(public selected: Tile[], public displayedDescendants: Tile[][], public preloadDebugBuilder?: GraphicBuilder, private _maxSelectionCount?: number) { }

  public selectOrQueue(tile: RealityTile, args: TileDrawArgs, traversalDetails: TraversalDetails) {
    tile.selectSecondaryTiles(args, this);
    tile.markUsed(args);
    if (tile.isReady) {
      args.markReady(tile);
      this.selected.push(tile);
      tile.markDisplayed();
      this.displayedDescendants.push((traversalDetails.childrenSelected) ? traversalDetails.queuedChildren.slice() : []);
      traversalDetails.queuedChildren.length = 0;
      traversalDetails.childrenLoading = false;
      traversalDetails.childrenSelected = true;
    } else if (!tile.isNotFound) {
      traversalDetails.queuedChildren.push(tile);
      if (!tile.isLoaded)
        this.missing.push(tile);
    }
  }

  public preload(tile: RealityTile, args: TileDrawArgs): void {
    if (!this.preloaded.has(tile)) {
      if (this.preloadDebugBuilder)
        tile.addBoundingGraphic(this.preloadDebugBuilder, ColorDef.red);

      tile.markUsed(args);
      tile.selectSecondaryTiles(args, this);
      this.preloaded.add(tile);
      if (!tile.isNotFound && !tile.isLoaded)
        this.missing.push(tile);
    }
  }

  public select(tiles: RealityTile[], args: TileDrawArgs): void {
    for (const tile of tiles) {
      tile.markUsed(args);
      this.selected.push(tile);
      this.displayedDescendants.push([]);
    }
  }
}

const scratchFrustum = new Frustum();
const scratchFrustumPlanes = new FrustumPlanes();
const scratchCarto = Cartographic.createZero();
const scratchPoint = Point3d.createZero(), scratchOrigin = Point3d.createZero();
const scratchRange = Range3d.createNull();
const scratchX = Vector3d.createZero(), scratchY = Vector3d.createZero(), scratchZ = Vector3d.createZero();
const scratchMatrix = Matrix3d.createZero(), scratchTransform = Transform.createZero();

interface ChildReprojection {
  child: RealityTile;
  ecefCenter: Point3d;
  dbPoints: Point3d[];    // Center, xEnd, yEnd, zEnd
}

/** @internal */
export interface RealityTileTreeParams extends TileTreeParams {
  readonly loader: RealityTileLoader;
  readonly yAxisUp?: boolean;
  readonly rootTile: RealityTileParams;
  readonly rootToEcef?: Transform;
  readonly gcsConverterAvailable: boolean;
}

/** @internal */
export class RealityTileTree extends TileTree {
  public traversalChildrenByDepth: TraversalChildrenDetails[] = [];
  public readonly loader: RealityTileLoader;
  public readonly yAxisUp: boolean;
  public cartesianRange: Range3d;
  public cartesianTransitionDistance: number;
  protected _gcsConverter: GeoConverter | undefined;
  protected _rootTile: RealityTile;
  protected _rootToEcef?: Transform;
  protected _ecefToDb?: Transform;

  public constructor(params: RealityTileTreeParams) {
    super(params);
    this.loader = params.loader;
    this.yAxisUp = true === params.yAxisUp;
    this._rootTile = this.createTile(params.rootTile);
    this.cartesianRange = BackgroundMapGeometry.getCartesianRange(this.iModel);
    this.cartesianTransitionDistance = this.cartesianRange.diagonal().magnitudeXY() * .25;      // Transition distance from elliptical to cartesian.
    this._gcsConverter = params.gcsConverterAvailable ? params.iModel.geoServices.getConverter("WGS84") : undefined;
    if (params.rootToEcef) {
      this._rootToEcef = params.rootToEcef;
      const dbToRoot = this.iModelTransform.inverse();
      if (dbToRoot) {
        const dbToEcef = this._rootToEcef.multiplyTransformTransform(dbToRoot);
        this._ecefToDb = dbToEcef.inverse();
      }
    }
  }
  public get rootTile(): RealityTile { return this._rootTile; }
  public get is3d() { return true; }
  public get maxDepth() { return this.loader.maxDepth; }
  public get minDepth() { return this.loader.minDepth; }
  public override get isContentUnbounded() { return this.loader.isContentUnbounded; }
  public get isTransparent() { return false; }

  protected _selectTiles(args: TileDrawArgs): Tile[] { return this.selectRealityTiles(args, []); }
  public get viewFlagOverrides(): ViewFlagOverrides { return this.loader.viewFlagOverrides; }
  public override get parentsAndChildrenExclusive() { return this.loader.parentsAndChildrenExclusive; }

  public createTile(props: TileParams): RealityTile { return new RealityTile(props, this); }

  public prune(): void {
    const olderThan = BeTimePoint.now().minus(this.expirationTime);
    this.rootTile.purgeContents(olderThan);
  }

  public draw(args: TileDrawArgs): void {
    const displayedTileDescendants = new Array<RealityTile[]>();
    const debugControl = args.context.target.debugControl;
    const selectBuilder = (debugControl && debugControl.displayRealityTileRanges) ? args.context.createSceneGraphicBuilder() : undefined;
    const preloadDebugBuilder = (debugControl && debugControl.displayRealityTilePreload) ? args.context.createSceneGraphicBuilder() : undefined;
    const graphicTypeBranches = new Map<TileGraphicType, GraphicBranch>();

    const selectedTiles = this.selectRealityTiles(args, displayedTileDescendants, preloadDebugBuilder);
    let sortIndices;

    if (!this.parentsAndChildrenExclusive) {
      sortIndices = selectedTiles.map((_x, i) => i);
      sortIndices.sort((a, b) => selectedTiles[a].depth - selectedTiles[b].depth);
    }

    const classifier = args.context.planarClassifiers.get(this.modelId);
    if (classifier && !(args instanceof GraphicsCollectorDrawArgs))
      classifier.collectGraphics(args.context, { modelId: this.modelId, tiles: selectedTiles, location: args.location, isPointCloud: this.isPointCloud });

    assert(selectedTiles.length === displayedTileDescendants.length);
    for (let i = 0; i < selectedTiles.length; i++) {
      const index = sortIndices ? sortIndices[i] : i;
      const selectedTile = selectedTiles[index];
      const graphics = args.getTileGraphics(selectedTile);
      const tileGraphicType = selectedTile.graphicType;
      let targetBranch;
      if (undefined !== tileGraphicType && tileGraphicType !== args.context.graphicType) {
        if (!(targetBranch = graphicTypeBranches.get(tileGraphicType))) {
          graphicTypeBranches.set(tileGraphicType, targetBranch = new GraphicBranch(false));
          targetBranch.setViewFlagOverrides(args.graphics.viewFlagOverrides);
          targetBranch.symbologyOverrides = args.graphics.symbologyOverrides;
        }
      }

      if (!targetBranch)
        targetBranch = args.graphics;

      if (undefined !== graphics) {
        const displayedDescendants = displayedTileDescendants[index];
        if (0 === displayedDescendants.length || !this.loader.parentsAndChildrenExclusive || selectedTile.allChildrenIncluded(displayedDescendants)) {
          targetBranch.add(graphics);
          if (selectBuilder) selectedTile.addBoundingGraphic(selectBuilder, ColorDef.green);
        } else {
          if (selectBuilder)
            selectedTile.addBoundingGraphic(selectBuilder, ColorDef.red);

          for (const displayedDescendant of displayedDescendants) {
            const clipVector = displayedDescendant.getContentClip();
            if (selectBuilder)
              displayedDescendant.addBoundingGraphic(selectBuilder, ColorDef.blue);

            if (undefined === clipVector) {
              targetBranch.add(graphics);
            } else {
              clipVector.transformInPlace(args.location);
              if (!this.isTransparent)
                for (const primitive of clipVector.clips)
                  for (const clipPlanes of primitive.fetchClipPlanesRef()!.convexSets)
                    for (const plane of clipPlanes.planes)
                      plane.offsetDistance(-displayedDescendant.radius * .05);     // Overlap with existing (high resolution) tile slightly to avoid cracks.

              const branch = new GraphicBranch(false);
              branch.add(graphics);
              const clipVolume = args.context.target.renderSystem.createClipVolume(clipVector);
              targetBranch.add(args.context.createGraphicBranch(branch, Transform.createIdentity(), { clipVolume }));
            }
          }
        }
        if (preloadDebugBuilder)
          targetBranch.add(preloadDebugBuilder.finish());

        if (selectBuilder)
          targetBranch.add(selectBuilder.finish());

        const rangeGraphic = selectedTile.getRangeGraphic(args.context);
        if (undefined !== rangeGraphic)
          targetBranch.add(rangeGraphic);
      }
    }

    args.drawGraphics();
    for (const graphicTypeBranch of graphicTypeBranches) {
      args.drawGraphicsWithType(graphicTypeBranch[0], graphicTypeBranch[1]);
    }
  }

  public getTraversalChildren(depth: number) {
    while (this.traversalChildrenByDepth.length <= depth)
      this.traversalChildrenByDepth.push(new TraversalChildrenDetails());

    return this.traversalChildrenByDepth[depth];
  }

  public doReprojectChildren(tile: Tile): boolean {
    if (!(tile instanceof RealityTile) || !tile.region || this._gcsConverter === undefined || this._rootToEcef === undefined || undefined === this._ecefToDb)
      return false;

    const tileRange = this.iModelTransform.isIdentity ? tile.range : this.iModelTransform.multiplyRange(tile.range, scratchRange);

    return this.cartesianRange.intersectsRange(tileRange);
  }

  public reprojectAndResolveChildren(parent: Tile, children: Tile[], resolve: (children: Tile[] | undefined) => void): void {
    if (!this.doReprojectChildren(parent)) {
      resolve(children);
      return;
    }

    const ecefToDb = this._ecefToDb!;       // Tested for undefined in doReprojectChildren
    const rootToDb = this.iModelTransform;
    const dbToEcef = ecefToDb.inverse()!;
    const reprojectChildren = new Array<ChildReprojection>();
    for (const child of children) {
      const realityChild = child as RealityTile;
      const childRange = realityChild.rangeCorners ? Range3d.createTransformedArray(rootToDb, realityChild.rangeCorners) : rootToDb.multiplyRange(realityChild.contentRange, scratchRange);
      const dbCenter = childRange.center;
      const ecefCenter = dbToEcef.multiplyPoint3d(dbCenter);
      const dbPoints = [dbCenter, dbCenter.plusXYZ(1), dbCenter.plusXYZ(0, 1), dbCenter.plusXYZ(0, 0, 1)];
      reprojectChildren.push({ child: realityChild, ecefCenter, dbPoints });
    }
    if (reprojectChildren.length === 0)
      resolve(children);
    else {
      const requestProps = new Array<XYZProps>();

      for (const reprojection of reprojectChildren) {
        for (const dbPoint of reprojection.dbPoints) {
          const ecefPoint = dbToEcef.multiplyPoint3d(dbPoint);
          const carto = Cartographic.fromEcef(ecefPoint, scratchCarto);
          if (carto)
            requestProps.push({ x: carto.longitudeDegrees, y: carto.latitudeDegrees, z: carto.height });

        }
      }

      if (requestProps.length !== 4 * reprojectChildren.length)
        resolve(children);
      else {
        this._gcsConverter!.getIModelCoordinatesFromGeoCoordinates(requestProps).then((response) => {

          const reprojectedCoords = response.iModelCoords;
          const dbToRoot = rootToDb.inverse()!;
          const getReprojectedPoint = (original: Point3d, reprojectedXYZ: XYZProps) => {
            scratchPoint.setFromJSON(reprojectedXYZ);
            const cartesianDistance = this.cartesianRange.distanceToPoint(scratchPoint);
            if (cartesianDistance < this.cartesianTransitionDistance)
              return scratchPoint.interpolate(cartesianDistance / this.cartesianTransitionDistance, original, scratchPoint);
            else
              return original;
          };

          let responseIndex = 0;
          for (const reprojection of reprojectChildren) {
            if (reprojectedCoords.every((coord) => coord.s === GeoCoordStatus.Success)) {
              const reprojectedOrigin = getReprojectedPoint(reprojection.dbPoints[0], reprojectedCoords[responseIndex++].p).clone(scratchOrigin);
              const xVector = Vector3d.createStartEnd(reprojectedOrigin, getReprojectedPoint(reprojection.dbPoints[1], reprojectedCoords[responseIndex++].p), scratchX);
              const yVector = Vector3d.createStartEnd(reprojectedOrigin, getReprojectedPoint(reprojection.dbPoints[2], reprojectedCoords[responseIndex++].p), scratchY);
              const zVector = Vector3d.createStartEnd(reprojectedOrigin, getReprojectedPoint(reprojection.dbPoints[3], reprojectedCoords[responseIndex++].p), scratchZ);
              const matrix = Matrix3d.createColumns(xVector, yVector, zVector, scratchMatrix);
              if (matrix !== undefined) {
                const dbReprojection = Transform.createMatrixPickupPutdown(matrix, reprojection.dbPoints[0], reprojectedOrigin, scratchTransform);
                if (dbReprojection) {
                  const rootReprojection = dbToRoot.multiplyTransformTransform(dbReprojection).multiplyTransformTransform(rootToDb);
                  reprojection.child.reproject(rootReprojection);
                }
              }
            }
          }

          resolve(children);
        }).catch(() => {
          resolve(children);    // Error occured in reprojection - just resolve with unprojected corners.
        });
      }
    }
  }

  public getBaseRealityDepth(_sceneContext: SceneContext) { return -1; }

  public selectRealityTiles(args: TileDrawArgs, displayedDescendants: RealityTile[][], preloadDebugBuilder?: GraphicBuilder): RealityTile[] {
    this._lastSelected = BeTimePoint.now();
    const selected: RealityTile[] = [];
    const context = new TraversalSelectionContext(selected, displayedDescendants, preloadDebugBuilder, args.maxRealityTreeSelectionCount);
    const rootTile = this.rootTile;
    const debugControl = args.context.target.debugControl;
    const freezeTiles = debugControl && debugControl.freezeRealityTiles;

    rootTile.selectRealityTiles(context, args, new TraversalDetails());

    const baseDepth = this.getBaseRealityDepth(args.context);

    if (!args.context.target.renderSystem.isMobile && 0 === context.missing.length) { // We skip preloading on mobile devices.
      if (baseDepth > 0)        // Maps may force loading of low level globe tiles.
        rootTile.preloadRealityTilesAtDepth(baseDepth, context, args);

      if (!freezeTiles)
        this.preloadTilesForScene(args, context, undefined);
    }

    if (!freezeTiles)
      for (const tile of context.missing) {
        const loadableTile = tile.loadableTile;

        loadableTile.markUsed(args);
        args.insertMissing(loadableTile);
      }

    if (debugControl && debugControl.logRealityTiles) {
      this.logTiles("Selected: ", selected.values());
      const preloaded = [];
      for (const tile of context.preloaded)
        preloaded.push(tile);

      this.logTiles("Preloaded: ", preloaded.values());
      this.logTiles("Missing: ", context.missing.values());

      const imageryTiles: RealityTile[] = [];
      for (const selectedTile of selected) {
        if (selectedTile instanceof MapTile) {
          const selectedImageryTiles = (selectedTile).imageryTiles;
          if (selectedImageryTiles)
            selectedImageryTiles.forEach((tile) => imageryTiles.push(tile));
        }
      }
      if (imageryTiles.length)
        this.logTiles("Imagery:", imageryTiles.values());
    }

    IModelApp.tileAdmin.addTilesForViewport(args.context.viewport, selected, args.readyTiles);
    return selected;
  }

  public preloadTilesForScene(args: TileDrawArgs, context: TraversalSelectionContext, frustumTransform?: Transform) {
    const preloadFrustum = args.viewingSpace.getPreloadFrustum(frustumTransform, scratchFrustum);
    const preloadFrustumPlanes = new FrustumPlanes(preloadFrustum);
    const worldToNpc = preloadFrustum.toMap4d();
    const preloadWorldToViewMap = args.viewingSpace.calcNpcToView().multiplyMapMap(worldToNpc!);
    const preloadArgs = new RealityTileDrawArgs(args, preloadWorldToViewMap, preloadFrustumPlanes);

    scratchFrustumPlanes.init(preloadFrustum);
    if (context.preloadDebugBuilder) {
      context.preloadDebugBuilder.setSymbology(ColorDef.blue, ColorDef.blue, 2, 0);
      context.preloadDebugBuilder.addFrustum(preloadFrustum);
    }

    this.rootTile.preloadTilesInFrustum(preloadArgs, context, 2);
  }

  protected logTiles(label: string, tiles: IterableIterator<Tile>) {
    let depthString = "";
    let min = 10000, max = -10000;
    let count = 0;
    const depthMap = new Map<number, number>();
    for (const tile of tiles) {
      count++;
      const depth = tile.depth;
      min = Math.min(min, tile.depth);
      max = Math.max(max, tile.depth);
      const found = depthMap.get(depth);
      depthMap.set(depth, found === undefined ? 1 : found + 1);
    }

    depthMap.forEach((key, value) => depthString += `${key}-${value}, `);
    // eslint-disable-next-line no-console
    console.log(`${label}: ${count} Min: ${min} Max: ${max} Depths: ${depthString}`);
  }
}
