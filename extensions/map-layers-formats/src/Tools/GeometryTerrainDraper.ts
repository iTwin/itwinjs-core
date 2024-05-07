/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  CollectTileStatus, DisclosedTileTreeSet,
  GeometryTileTreeReference, IModelApp,
  Tile, TileGeometryCollector, TileUser, Viewport } from "@itwin/core-frontend";
import { Angle, ConvexClipPlaneSet, CurvePrimitive, GrowableXYZArray, IndexedPolyface, IndexedPolyfaceSubsetVisitor, Loop, Point3d, Polyface, PolyfaceClip, PolyfaceQuery, PolygonOps, Range3d, Ray3d, SweepLineStringToFacetsOptions, Transform, Vector3d } from "@itwin/core-geometry";
import { Logger } from "@itwin/core-bentley";

const loggerCategory = "MapLayersFormats.GeometryTerrainDraper";

/** A TileGeometryCollector that restricts collection to tiles that overlap a line string.
/* @internal
*/
class LineSegmentCollector extends TileGeometryCollector {
  private _points: GrowableXYZArray;

  constructor(user: TileUser, chordTolerance: number, range: Range3d, transform: Transform, points: GrowableXYZArray) {
    super({ user, chordTolerance, range, transform });
    this._points = points;
  }

  public override addMissingTile(tile: Tile): void {
    Logger.logTrace(loggerCategory, `CollectorAdd missing tile: ${tile.contentId}`);
    super.addMissingTile(tile);
  }

  public override collectTile(tile: Tile): CollectTileStatus {
    let status = super.collectTile(tile);

    if ("reject" !== status && !this.rangeOverlapsLineString(tile.range)) {
      status = "reject";
    }

    Logger.logTrace(loggerCategory, `collectTile - tile: ${tile.contentId} status: ${status } isReady: ${tile.isReady} status:${tile.loadStatus}`);
    return status;
  }

  private rangeOverlapsLineString(range: Range3d) {
    let inside = false;
    const clipper = ConvexClipPlaneSet.createRange3dPlanes(range, true, true, true, true, false, false);
    if (this._options.transform)
      clipper.transformInPlace(this._options.transform);

    for (let i = 0; i < this._points.length - 1 && !inside; i++)
      inside = clipper.announceClippedSegmentIntervals(0, 1, this._points.getPoint3dAtUncheckedPointIndex(i), this._points.getPoint3dAtUncheckedPointIndex(i + 1));

    return inside;
  }
}

/** @internal */
export class GeometryTerrainDraper implements TileUser {
  // The side angle measures how close the sweep vector is from being parallel to a side face.
  // The larger the angle, the more nearly vertical facets are ignored.
  // This is an "empirical" value that was determined by looking at "problematic" polyfaces
  public readonly sideAngle = Angle.createDegrees(0.06);

  public readonly maxDistanceZ = 1.0E5; // Expand the Z Range, but not so much that we get opposite side of globe.
  public readonly tileUserId: number;

  public constructor(public readonly viewport: Viewport, public readonly treeRef: GeometryTileTreeReference) {
    this.tileUserId = TileUser.generateId();
    IModelApp.tileAdmin.registerUser(this);
  }

  public dispose(): void {
    IModelApp.tileAdmin.forgetUser(this);
  }

  public get iModel() { return this.viewport.iModel; }

  public onRequestStateChanged() {
    this.viewport.invalidateDecorations();
  }

  public discloseTileTrees(trees: DisclosedTileTreeSet) {
    trees.disclose(this.treeRef);
  }

  // Filter out non-top facets:
  // For unknown reasons, there are "perpendicular" facets appearing in the terrain meshes.
  public getMeshTopFacets(mesh: IndexedPolyface) {
    // constant inputs
    const sweepVector = Vector3d.unitZ();
    // i.e., region is horizontal
    // create subset visitor from the top facets
    const topFacets: number[] = [];
    const facetNormal = Vector3d.createZero();

    for (const visitor = mesh.createVisitor(0); visitor.moveToNextFacet(); ) {
      if (PolygonOps.unitNormal(visitor.point, facetNormal)) {
        const theta = facetNormal.angleFromPerpendicular(sweepVector);
        if (!theta.isMagnitudeLessThanOrEqual(this.sideAngle)) { // skip side facet
          if (facetNormal.dotProduct(sweepVector) > 0)  // this is a top facet
            topFacets.push(visitor.currentReadIndex());
        }
      }
    }

    return IndexedPolyfaceSubsetVisitor.createSubsetVisitor(mesh, topFacets, 0);
  }

  public drapeLineString(outStrings: CurvePrimitive[], inPoints: GrowableXYZArray, tolerance: number, range: Range3d): "loading" | "complete" {
    const tree = this.treeRef.treeOwner.load();
    if (!tree)
      return "loading";

    const expandedRange = Range3d.createFrom(range);
    expandedRange.extendZOnly(-this.maxDistanceZ);
    expandedRange.extendZOnly(this.maxDistanceZ);

    const collector = new LineSegmentCollector(this, tolerance, expandedRange, tree.iModelTransform, inPoints);
    this.treeRef.collectTileGeometry(collector);
    collector.requestMissingTiles();

    if (collector.isAllGeometryLoaded && collector.polyfaces.length > 0) {

      for (const polyface of collector.polyfaces) {
        // Use this to serialize (problematic) polyface
        // console.log (`const polyface = ${JSON.stringify(IModelJson.Writer.toIModelJson(polyface))}`);
        outStrings.push(...PolyfaceQuery.sweepLineStringToFacets(
          inPoints,
          polyface,
          SweepLineStringToFacetsOptions.create(Vector3d.unitZ(), this.sideAngle, true, true, false, false)));
      }

      return "complete";
    }

    return "loading";
  }

  public drapeLoop(outMeshes: Polyface[], loop: Loop, tolerance: number, range: Range3d): "loading" | "complete" {
    const tree = this.treeRef.treeOwner.load();
    if (!tree)
      return "loading";

    const expandedRange = Range3d.createFrom(range);
    expandedRange.extendZOnly(-this.maxDistanceZ);
    expandedRange.extendZOnly(this.maxDistanceZ);

    const strokes = loop.getPackedStrokes();
    if (!strokes)
      return "complete";

    const collector = new LineSegmentCollector(this, tolerance, expandedRange, tree.iModelTransform, strokes);
    this.treeRef.collectTileGeometry(collector);
    collector.requestMissingTiles();

    if (collector.isAllGeometryLoaded && collector.polyfaces.length > 0) {
      for (const polyface of collector.polyfaces) {
        const topFacets = this.getMeshTopFacets(polyface);
        const mesh = PolyfaceClip.drapeRegion(topFacets, loop);
        if (mesh)
          outMeshes.push(mesh);
      }
      return "complete";
    }
    return "loading";
  }
  public drapePoint(outPoint: Point3d, point: Point3d, chordTolerance: number, range: Range3d): "loading" | "complete" {
    const tree = this.treeRef.treeOwner.load();
    if (!tree)
      return "loading";

    const expandedRange = Range3d.createFrom(range);
    expandedRange.extendZOnly(-this.maxDistanceZ);
    expandedRange.extendZOnly(this.maxDistanceZ);

    const collector = new TileGeometryCollector({chordTolerance, range: expandedRange, user: this });
    this.treeRef.collectTileGeometry(collector);
    collector.requestMissingTiles();

    if (collector.isAllGeometryLoaded && collector.polyfaces.length > 0) {
      for (const polyface of collector.polyfaces) {
        // Im assuming a single polyface here since we are draping a single point
        const facetLocation = PolyfaceQuery.intersectRay3d(polyface, Ray3d.create(point, Vector3d.unitZ() ));
        if (!facetLocation)
          continue;
        outPoint.setFromPoint3d(facetLocation.point);
      }
      return "complete";
    }
    return "loading";
  }
}
