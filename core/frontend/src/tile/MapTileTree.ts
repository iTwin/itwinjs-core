/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { FrustumPlanes } from "@bentley/imodeljs-common";
import { TileTree } from "./TileTree";
import { Tile } from "./Tile";
import { assert } from "@bentley/bentleyjs-core";
import { QuadId, computeMercatorFractionToDb } from "./WebMapTileTree";
import { Point3d, Range1d, Range3d, Transform, XYZProps, Angle, BilinearPatch } from "@bentley/geometry-core";
import { MapTilingScheme } from "./MapTilingScheme";
import { GeoConverter } from "../GeoServices";

/** @internal */
enum SelectStatus { Culled, Selected, Queued, NotFound, Preloaded, Ignored }

/** @internal */
class TraversalDetails {
  public queuedCount: number = 0;
  public maxDepth: number = -1;
  public selectedCount: number = 0;
  public initialize() {
    this.queuedCount = 0;
    this.selectedCount = 0;
    this.maxDepth = -1;
  }
}

/** @internal */
class TraversalQuads {
  public quadDetails: TraversalDetails[];
  constructor() {
    this.quadDetails = new Array<TraversalDetails>(4);
    for (let i = 0; i < 4; i++)
      this.quadDetails[i] = new TraversalDetails();
  }
  public initialize() {
    for (const quad of this.quadDetails)
      quad.initialize();
  }
  public combine(parentDetails: TraversalDetails) {
    parentDetails.maxDepth = -1;
    parentDetails.queuedCount = 0;
    for (const quadDetail of this.quadDetails) {
      parentDetails.maxDepth = Math.max(parentDetails.maxDepth, quadDetail.maxDepth);
      parentDetails.queuedCount += quadDetail.queuedCount;
      parentDetails.selectedCount += quadDetail.selectedCount;
    }
  }
}

/** @internal */
class SelectionContext {
  public preloadCount = 0;
  public missing = new Array<Tile>();
  constructor(public selected: Tile[]) { }

  public selectOrQueue(tile: Tile, traversalDetails: TraversalDetails, selectIfReady: boolean): SelectStatus {
    if (selectIfReady && tile.isReady) {
      traversalDetails.selectedCount++;
      this.selected.push(tile);
      return SelectStatus.Selected;
    } else if (!tile.isNotFound) {
      traversalDetails.queuedCount++;
      this.missing.push(tile);
      return SelectStatus.Queued;
    } else
      return SelectStatus.NotFound;
  }
  public preload(tile: Tile): SelectStatus {
    if (!tile.isReady)
      this.missing.push(tile);
    this.preloadCount++;
    return SelectStatus.Preloaded;
  }
}

/**
 * A specialization of Tile for terrain and map imagery.  Holds the corners (possibly reprojected) as well as the height range.
 * The true height range is unknown until the content is loaded so until a tile is loaded it will inherit its height range
 * from its ancesttors.  The root tile will have range from entire project (currently pulled from Bing Elevation API).
 * @internal
 */
export class MapTile extends Tile {
  public reprojectionRequired = true;
  constructor(params: Tile.Params, public quadId: QuadId, public corners: Point3d[], private _heightRange: Range1d | undefined) {
    super(params);

  }
  private get _mapTree() { return this.root as MapTileTree; }
  private get _mapTileParent() { return this.parent as MapTile; }
  private static _scratchCorners = [Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero()];
  private get _traversalQuads() {
    const traversalQuads = this._mapTree.traversalQuadsByDepth;
    while (traversalQuads.length <= this.depth)
      traversalQuads.push(new TraversalQuads());

    return traversalQuads[this.depth];
  }

  public get heightRange(): Range1d {
    if (undefined !== this._heightRange)
      return this._heightRange;

    for (let parent = this._mapTileParent; undefined !== parent; parent = parent._mapTileParent)
      if (undefined !== parent._heightRange)
        return parent._heightRange;

    assert(false);
    return Range1d.createNull();
  }
  private get _rangeCorners(): Point3d[] { return MapTile.computeRangeCorners(this.corners, this.heightRange); }

  public static computeRangeCorners(corners: Point3d[], heightRange: Range1d) {
    let index = 0;
    assert(corners.length === 4);
    for (const corner of corners) {
      MapTile._scratchCorners[index++].set(corner.x, corner.y, heightRange.low);
      MapTile._scratchCorners[index++].set(corner.x, corner.y, heightRange.high);
    }

    return MapTile._scratchCorners;
  }

  public adjustHeights(minHeight: number, maxHeight: number) {
    if (undefined === this._heightRange)
      this._heightRange = Range1d.createXX(minHeight, maxHeight);
    else {
      this._heightRange.low = Math.max(this.heightRange.low, minHeight);
      this._heightRange.high = Math.min(this.heightRange.high, maxHeight);
    }
  }
  private isMapTileCulled(frustumPlanes: FrustumPlanes) {
    return FrustumPlanes.Containment.Outside === frustumPlanes.computeContainment(this._rangeCorners);
  }

  private get _anyChildNotFound() {
    if (this._children !== undefined)
      for (const child of this._children)
        if (child.isNotFound)
          return true;

    return false;
  }
  private selectMapChildren(context: SelectionContext, args: Tile.DrawArgs, traversalDetails: TraversalDetails) {
    const children = this.getOrCreateChildren();
    const traversalQuads = this._traversalQuads;
    traversalQuads.initialize();
    for (let i = 0; i < children!.length; i++)
      (children[i] as MapTile).selectMapTile(context, args, traversalQuads.quadDetails[i]);

    traversalQuads.combine(traversalDetails);
  }

  public getOrCreateChildren(): Tile[] {
    if (undefined === this._children) {
      this._children = [];
      const level = this.quadId.level + 1;
      const column = this.quadId.column * 2;
      const row = this.quadId.row * 2;
      const mapTree = this._mapTree;
      const rowMax = (this.quadId.level === 0) ? mapTree.mapTilingScheme.numberOfLevelZeroTilesY : 2;
      const columnMax = (this.quadId.level === 0) ? mapTree.mapTilingScheme.numberOfLevelZeroTilesX : 2;
      for (let i = 0; i < columnMax; i++) {
        for (let j = 0; j < rowMax; j++) {
          const quadId = new QuadId(level, column + i, row + j);
          const corners: Point3d[] = mapTree.getTileCorners(quadId);
          const range = Range3d.createArray(MapTile.computeRangeCorners(corners, this.heightRange));
          this._children.push(new MapTile({ root: mapTree, contentId: quadId.contentId, maximumSize: 256, range, parent: this }, quadId, corners, mapTree.heightRange));
        }
      }
    }
    return this._children;
  }

  public selectMapTile(context: SelectionContext, args: Tile.DrawArgs, traversalDetails: TraversalDetails): SelectStatus {
    if (this.isMapTileCulled(args.frustumPlanes))
      return SelectStatus.Culled;

    const sizeTestRatio = 2.0;        // Allow map tiles to get oversized by factor of 2 -- this makes bigger map tiles, improves performance and makes text more readable as it is less likely to be decimated.
    const meetsSse = args.getPixelSize(this) < this.maximumSize * sizeTestRatio;
    if (this.isDisplayable && (meetsSse || this._anyChildNotFound || this.depth >= this._mapTree.maxDepth) || this._mapTree.needsReprojection(this)) {
      traversalDetails.maxDepth = Math.max(traversalDetails.maxDepth, this.depth);
      return context.selectOrQueue(this, traversalDetails, true);
    } else {
      this.selectMapChildren(context, args, traversalDetails);
      if (this.isDisplayable) {
        if (0 !== traversalDetails.queuedCount && this.isReady) {
          traversalDetails.queuedCount = 0;
          return context.selectOrQueue(this, traversalDetails, false);
        }
        if (traversalDetails.maxDepth - this.depth <= this._mapTree.preloadDescendantDepth)
          return context.preload(this);
      }
      return SelectStatus.Ignored;
    }
    traversalDetails.maxDepth = Math.max(traversalDetails.maxDepth, this.depth);
  }
  public getLoaded(loaded: Tile[], args: Tile.DrawArgs) {
    if (!this.isMapTileCulled(args.frustumPlanes)) {
      if (this.isReady && this.isDisplayable)
        loaded.push(this);
      if (this._children)
        for (const child of this._children)
          (child as MapTile).getLoaded(loaded, args);
    }
  }
  public async reprojectCorners(): Promise<void> {
    if (this.reprojectionRequired) {
      await this._mapTree.reprojectTileCorners(this);
    }
  }
}
/**
 * A specialization of TileTree for map quadTrees.  This overrides the default tile selection to simplified traversal that preloads ancestors to avoid
 * unnnecessary loading during panning or zooming.
 * @internal
 */

export class MapTileTree extends TileTree {
  private _mercatorFractionToDb: Transform;
  private _gcsConverter: GeoConverter | undefined;
  public traversalQuadsByDepth: TraversalQuads[] = new Array<TraversalQuads>();
  public static minReprojectionDepth = 8;     // Reprojection does not work with very large tiles so just do linear transform.

  constructor(params: TileTree.Params, public groundBias: number, gcsConverterAvailable: boolean, public mapTilingScheme: MapTilingScheme, public heightRange: Range1d, public maxDepth: number = 20, public preloadDescendantDepth = 3) {
    super(params);
    this._mercatorFractionToDb = computeMercatorFractionToDb(params.iModel, groundBias, mapTilingScheme);
    const quadId = new QuadId(0, 0, 0);
    const corners = this.getTileCorners(quadId);
    const range = Range3d.createArray(MapTile.computeRangeCorners(corners, heightRange));
    this._rootTile = new MapTile({ root: this, contentId: quadId.contentId, maximumSize: 0, range }, quadId, corners, heightRange);
    const linearRangeSquared: number = params.iModel.projectExtents.diagonal().magnitudeSquared();
    this._gcsConverter = (gcsConverterAvailable && linearRangeSquared > 1000.0 * 1000.0) ? params.iModel.geoServices.getConverter("WGS84") : undefined;
  }
  public needsReprojection(tile: MapTile) {
    return tile.reprojectionRequired && undefined !== this._gcsConverter && tile.depth >= MapTileTree.minReprojectionDepth;
  }

  public async reprojectTileCorners(tile: MapTile): Promise<void> {
    tile.reprojectionRequired = false;
    if (!this._gcsConverter || tile.depth < MapTileTree.minReprojectionDepth)
      return;
    const fractionalCorners = this.getFractionalTileCorners(tile.quadId);
    const requestProps = new Array<XYZProps>();

    for (const fractionalCorner of fractionalCorners)
      requestProps.push({
        x: this.mapTilingScheme.xFractionToLongitude(fractionalCorner.x) * Angle.degreesPerRadian,
        y: this.mapTilingScheme.yFractionToLatitude(fractionalCorner.y) * Angle.degreesPerRadian,
        z: this.groundBias,
      });

    let iModelCoordinates = this._gcsConverter.getCachedIModelCoordinatesFromGeoCoordinates(requestProps);
    if (undefined !== iModelCoordinates.missing) {
      await this._gcsConverter.getIModelCoordinatesFromGeoCoordinates(iModelCoordinates.missing);
      iModelCoordinates = this._gcsConverter.getCachedIModelCoordinatesFromGeoCoordinates(requestProps);
      assert(undefined === iModelCoordinates.missing);
    }
    for (let i = 0; i < 4; i++)
      tile.corners[i] = Point3d.fromJSON(iModelCoordinates.result[i]!.p);

    const children = tile.getOrCreateChildren();
    for (const child of children) {
      let bilinearPatch;
      const mapChild = child as MapTile;
      if (mapChild.reprojectionRequired) {
        if (undefined === bilinearPatch)
          bilinearPatch = new BilinearPatch(tile.corners[0], tile.corners[1], tile.corners[2], tile.corners[3]);
        const childFractionalCorners = this.getFractionalTileCorners(mapChild.quadId);
        for (let i = 0; i < 4; i++) {
          const u = (childFractionalCorners[i].x - fractionalCorners[0].x) / (fractionalCorners[1].x - fractionalCorners[0].x);
          const v = (childFractionalCorners[i].y - fractionalCorners[0].y) / (fractionalCorners[2].y - fractionalCorners[0].y);
          mapChild.corners[i] = bilinearPatch.uvFractionToPoint(u, v);
        }
      }
    }
  }

  public selectTiles(args: Tile.DrawArgs): Tile[] {
    const rootTile = this._rootTile as MapTile;
    const selected = new Array<Tile>();
    const context = new SelectionContext(selected);

    rootTile.selectMapTile(context, args, new TraversalDetails());

    context.missing.sort((a, b) => b.depth - a.depth);      // Load lower resolution (preloaded)  tiles first so we can quickly get something displayed.
    selected.sort((a, b) => b.depth - a.depth);             // But if already loaded select the higher resolution ones.

    for (const tile of context.missing)
      args.insertMissing(tile);

    const doSelectLogging = false, doMissingLogging = false;

    if (doSelectLogging)
      this.logTiles("Selected", selected);

    if (doMissingLogging && context.missing.length)
      this.logTiles("Missing", context.missing);

    return selected;
  }
  private getFractionalTileCorners(quadId: QuadId): Point3d[] {
    const corners: Point3d[] = [];             //    ----x----->

    corners.push(Point3d.create(this.mapTilingScheme.tileXToFraction(quadId.column, quadId.level), this.mapTilingScheme.tileYToFraction(quadId.row, quadId.level), 0.0));
    corners.push(Point3d.create(this.mapTilingScheme.tileXToFraction(quadId.column + 1, quadId.level), this.mapTilingScheme.tileYToFraction(quadId.row, quadId.level), 0.0));
    corners.push(Point3d.create(this.mapTilingScheme.tileXToFraction(quadId.column, quadId.level), this.mapTilingScheme.tileYToFraction(quadId.row + 1, quadId.level), 0.0));
    corners.push(Point3d.create(this.mapTilingScheme.tileXToFraction(quadId.column + 1, quadId.level), this.mapTilingScheme.tileYToFraction(quadId.row + 1, quadId.level), 0.0));
    return corners;
  }

  public getTileCorners(quadId: QuadId): Point3d[] {
    const corners = this.getFractionalTileCorners(quadId);
    this._mercatorFractionToDb.multiplyPoint3dArrayInPlace(corners);
    return corners;
  }

  private logTiles(label: string, tiles: Tile[]) {
    let currDepth = -1, currCount = 0;
    let depthString = "";
    let min = 10000, max = -10000;
    for (const tile of tiles) {
      const depth = tile.depth;
      min = Math.min(min, tile.depth);
      max = Math.max(max, tile.depth);
      if (currDepth !== depth) {
        if (currCount !== 0)
          depthString += currDepth.toString() + "-" + currCount.toString() + " ";

        currCount = 1;
        currDepth = depth;
      } else
        currCount++;
    }
    depthString += currDepth.toString() + "-" + currCount.toString() + " ";
    console.log(label + ": " + tiles.length + " Min: " + min + " Max: " + max + " Depths: " + depthString);    // tslint:disable-line
  }
}
