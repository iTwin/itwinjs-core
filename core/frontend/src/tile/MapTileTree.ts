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
import { Point3d, Range1d, Range3d, Transform, XYZProps, Angle, ClipVector, ClipShape, BilinearPatch } from "@bentley/geometry-core";
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
                this._children = [];
                const level = this.quadId.level + 1;
                const column = this.quadId.column * 2;
                const row = this.quadId.row * 2;
                const mapTree = this._mapTree;
                const rowMax = (this.quadId.level === 0) ? mapTree.mapTilingScheme.numberOfLevelZeroTilesY : 2;
                const columnMax = (this.quadId.level === 0) ? mapTree.mapTilingScheme.numberOfLevelZeroTilesX : 2;
                const childrenAreLeaves = (this.depth + 1) === mapTree.loader.maxDepth;
                const bilinearPatch = new BilinearPatch(this.corners[0], this.corners[1], this.corners[2], this.corners[3]);
                const fractionalCorners = mapTree.getFractionalTileCorners(this.quadId);
                const reprojectionRequired = mapTree.reprojectionRequired(this.depth + 1);

                for (let i = 0; i < columnMax; i++) {
                    for (let j = 0; j < rowMax; j++) {
                        const quadId = new QuadId(level, column + i, row + j);
                        const childFractionalCorners = mapTree.getFractionalTileCorners(quadId);
                        const corners = [];
                        for (let k = 0; k < 4; k++) {
                            const u = (childFractionalCorners[k].x - fractionalCorners[0].x) / (fractionalCorners[1].x - fractionalCorners[0].x);
                            const v = (childFractionalCorners[k].y - fractionalCorners[0].y) / (fractionalCorners[2].y - fractionalCorners[0].y);
                            corners.push(bilinearPatch.uvFractionToPoint(u, v));
                        }
                        const range = Range3d.createArray(MapTile.computeRangeCorners(corners, this.heightRange));
                        const child = new MapTile({ root: mapTree, contentId: quadId.contentId, maximumSize: 512, range, parent: this, isLeaf: childrenAreLeaves }, quadId, corners, mapTree.heightRange);
                        this._children.push(child);
                    }
                }
                if (reprojectionRequired) {
                    const promises = new Array<Promise<void>>();
                    for (const child of this._children)
                        promises.push(mapTree.reprojectTileCorners(child as MapTile));

                    Promise.all(promises).then((_) => { this._childrenLoadStatus = TileTree.LoadStatus.Loaded; }).catch((_err) => { assert(false);  this._childrenLoadStatus = TileTree.LoadStatus.NotFound; });
                } else {
                    this._childrenLoadStatus = TileTree.LoadStatus.Loaded;
                }
            } else {
                this._childrenLoadStatus = TileTree.LoadStatus.Loaded;
            }
        }
        return this._childrenLoadStatus;
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
    public reprojectionRequired(depth: number): boolean { return this._gcsConverter !== undefined || depth >= MapTileTree.minReprojectionDepth; }

    public async reprojectTileCorners(tile: MapTile): Promise<void> {
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
