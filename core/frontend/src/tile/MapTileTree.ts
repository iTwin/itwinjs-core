/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { ColorDef, FrustumPlanes } from "@bentley/imodeljs-common";
import { TileTree } from "./TileTree";
import { Tile } from "./Tile";
import { assert } from "@bentley/bentleyjs-core";
import { QuadId, computeMercatorFractionToDb } from "./WebMapTileTree";
import { Point3d, Range1d, Range3d, Transform, Angle, ClipVector, ClipShape } from "@bentley/geometry-core";
import { MapTilingScheme } from "./MapTilingScheme";
import { GeoConverter } from "../GeoServices";
import { GraphicBuilder } from "../render/GraphicBuilder";

/**
 * A specialization of Tile for terrain and map imagery.  Holds the corners (possibly reprojected) as well as the height range.
 * The true height range is unknown until the content is loaded so until a tile is loaded it will inherit its height range
 * from its ancesttors.  The root tile will have range from entire project (currently pulled from Bing Elevation API).
 * @internal
 */
export class MapTile extends Tile {
  private get _mapTree() { return this.root as MapTileTree; }
  constructor(params: Tile.Params, public quadId: QuadId, public corners: Point3d[], private _heightRange: Range1d | undefined) {
    super(params);
  }

  private static _scratchCorners = [Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero()];

  public get heightRange(): Range1d {
    if (undefined !== this._heightRange)
      return this._heightRange;

    for (let parent = this.parent; undefined !== parent; parent = parent.parent) {
      const mapParent = parent as MapTile;

      if (undefined !== mapParent._heightRange)
        return mapParent._heightRange;
    }

    assert(false);
    return Range1d.createNull();
  }
  protected get _rangeCorners(): Point3d[] { return MapTile.computeRangeCorners(this.corners, this.heightRange); }

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

  protected loadChildren(): TileTree.LoadStatus {
    if (TileTree.LoadStatus.NotLoaded === this._childrenLoadStatus) {
      if (undefined === this._children) {
        this._childrenLoadStatus = TileTree.LoadStatus.Loading;
        const mapTree = this._mapTree;
        const rowCount = (this.quadId.level === 0) ? mapTree.mapTilingScheme.numberOfLevelZeroTilesY : 2;
        const columnCount = (this.quadId.level === 0) ? mapTree.mapTilingScheme.numberOfLevelZeroTilesX : 2;
        this.createChildren(mapTree.getChildCorners(this, columnCount, rowCount), columnCount, rowCount);

        if (mapTree.reprojectionRequired(this.depth + 1)) {
          mapTree.reprojectTileCorners(this, columnCount, rowCount).then(() => {
            this._childrenLoadStatus = TileTree.LoadStatus.Loaded;
          }).catch((_err) => {
            assert(false);
            this._childrenLoadStatus = TileTree.LoadStatus.NotFound;
          });
        }
      }
      this._childrenLoadStatus = TileTree.LoadStatus.Loaded;
    }
    return this._childrenLoadStatus;
  }
  private createChildren(childCorners: Point3d[][], columnCount: number, rowCount: number) {
    const mapTree = this._mapTree;
    const level = this.quadId.level + 1;
    const column = this.quadId.column * 2;
    const row = this.quadId.row * 2;
    const childrenAreLeaves = (this.depth + 1) === mapTree.loader.maxDepth;
    this._children = [];
    for (let j = 0; j < rowCount; j++) {
      for (let i = 0; i < columnCount; i++) {
        const quadId = new QuadId(level, column + i, row + j);
        const corners = childCorners[j * columnCount + i];
        const range = Range3d.createArray(MapTile.computeRangeCorners(corners, this.heightRange));
        const child = new MapTile({ root: this._mapTree, contentId: quadId.contentId, maximumSize: 512, range, parent: this, isLeaf: childrenAreLeaves }, quadId, corners, mapTree.heightRange);
        this._children.push(child);
      }
    }
    this._childrenLoadStatus = TileTree.LoadStatus.Loaded;
  }

  public getBoundaryShape(z?: number) {
    const shapePoints = [this.corners[0].clone(), this.corners[1].clone(), this.corners[3].clone(), this.corners[2].clone(), this.corners[0].clone()];
    if (z)
      for (const shapePoint of shapePoints)
        shapePoint.z = z;

    return shapePoints;
  }
  public addBoundingRectangle(builder: GraphicBuilder, color: ColorDef) {
    builder.setSymbology(color, color, 1);
    builder.addLineString(this.getBoundaryShape(this.heightRange.low));
    builder.addLineString(this.getBoundaryShape(this.heightRange.high));
  }
  public isRegionCulled(args: Tile.DrawArgs): boolean {
    return this.isContentCulled(args);
  }
  public isContentCulled(args: Tile.DrawArgs): boolean {
    return FrustumPlanes.Containment.Outside === args.frustumPlanes.computeContainment(this._rangeCorners);
  }
  public getContentClip(): ClipVector | undefined {
    return ClipVector.createCapture([ClipShape.createShape(this.getBoundaryShape())!]);
  }
  public computeVisibility(args: Tile.DrawArgs): Tile.Visibility {
    if (this.isEmpty || this.isRegionCulled(args))
      return Tile.Visibility.OutsideFrustum;

    if (!this.isDisplayable)
      return Tile.Visibility.TooCoarse;

    let pixelSize = args.getPixelSize(this);
    const maxSize = this.maximumSize;

    // In a parallel view, use the dot product with the map plane to limit the pixel size - this will avoid loading huge amounts of tiles that are not visible on edge.
    if (!args.context.viewport.isCameraOn)
      pixelSize *= Math.sqrt(Math.abs(args.context.viewport.rotation.coffs[8]));

    return (pixelSize > maxSize) ? Tile.Visibility.TooCoarse : Tile.Visibility.Visible;
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

  public static minReprojectionDepth = 8;     // Reprojection does not work with very large tiles so just do linear transform.

  constructor(params: TileTree.Params, public groundBias: number, gcsConverterAvailable: boolean, public mapTilingScheme: MapTilingScheme, _isPlanar = false, public heightRange: Range1d) {
    super(params);
    this._mercatorFractionToDb = computeMercatorFractionToDb(params.iModel, groundBias, mapTilingScheme);
    const quadId = new QuadId(0, 0, 0);
    const corners = this.getTileCorners(quadId);
    const range = Range3d.createArray(MapTile.computeRangeCorners(corners, heightRange));
    this._rootTile = new MapTile({ root: this, contentId: quadId.contentId, maximumSize: 0, range }, quadId, corners, heightRange);
    const linearRangeSquared: number = params.iModel.projectExtents.diagonal().magnitudeSquared();
    this._gcsConverter = (gcsConverterAvailable && linearRangeSquared > 1000.0 * 1000.0) ? params.iModel.geoServices.getConverter("WGS84") : undefined;
  }
  public reprojectionRequired(depth: number): boolean { return this._gcsConverter !== undefined && depth >= MapTileTree.minReprojectionDepth; }
  private getChildGridPoints(tile: MapTile, columnCount: number, rowCount: number): Point3d[] {
    const gridPoints = [];
    const quadId = tile.quadId;
    const deltaX = 1.0 / columnCount, deltaY = 1.0 / rowCount;
    for (let row = 0; row <= rowCount; row++)
      for (let column = 0; column <= columnCount; column++)
        gridPoints.push(Point3d.create(this.mapTilingScheme.tileXToFraction(quadId.column + column * deltaX, quadId.level), this.mapTilingScheme.tileYToFraction(quadId.row + row * deltaY, quadId.level), 0.0));

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
  public async reprojectTileCorners(tile: MapTile, columnCount: number, rowCount: number): Promise<void> {
    const gridPoints = this.getChildGridPoints(tile, columnCount, rowCount);
    const requestProps = [];
    for (const gridPoint of gridPoints)
      requestProps.push({
        x: this.mapTilingScheme.xFractionToLongitude(gridPoint.x) * Angle.degreesPerRadian,
        y: this.mapTilingScheme.yFractionToLatitude(gridPoint.y) * Angle.degreesPerRadian,
        z: this.groundBias,
      });

    let iModelCoordinates = this._gcsConverter!.getCachedIModelCoordinatesFromGeoCoordinates(requestProps);
    if (undefined !== iModelCoordinates.missing) {
      await this._gcsConverter!.getIModelCoordinatesFromGeoCoordinates(iModelCoordinates.missing);
      iModelCoordinates = this._gcsConverter!.getCachedIModelCoordinatesFromGeoCoordinates(requestProps);
      assert(undefined === iModelCoordinates.missing);
    }
    for (let i = 0; i < gridPoints.length; i++)
      gridPoints[i] = Point3d.fromJSON(iModelCoordinates.result[i]!.p);

    if (undefined === tile.children)
      return;

    assert(rowCount * columnCount === tile.children.length);
    for (let row = 0; row < rowCount; row++) {
      for (let column = 0; column < columnCount; column++) {
        const child = tile.children![row * columnCount + column] as MapTile;
        const index0 = column + row * (columnCount + 1);
        const index1 = index0 + (columnCount + 1);
        child.corners[0].setFromPoint3d(gridPoints[index0]);
        child.corners[1].setFromPoint3d(gridPoints[index0 + 1]);
        child.corners[2].setFromPoint3d(gridPoints[index1]);
        child.corners[3].setFromPoint3d(gridPoints[index1 + 1]);
      }
    }
  }

  public getChildCorners(tile: MapTile, columnCount: number, rowCount: number): Point3d[][] {
    const gridPoints = this.getChildGridPoints(tile, columnCount, rowCount);
    this._mercatorFractionToDb.multiplyPoint3dArrayInPlace(gridPoints);
    return this.getChildCornersFromGridPoints(gridPoints, columnCount, rowCount);
  }

  public getFractionalTileCorners(quadId: QuadId): Point3d[] {
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
}
