/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  CollectTileStatus, DisclosedTileTreeSet,
  GeometryTileTreeReference, IModelApp,
  Tile, TileGeometryCollector, TileUser, Viewport } from "@itwin/core-frontend";
import { ConvexClipPlaneSet, CurvePrimitive, GrowableXYZArray, Loop, Point3d, Polyface, PolyfaceClip, PolyfaceQuery, Range3d, Ray3d, SweepLineStringToFacetsOptions, Transform, Vector3d } from "@itwin/core-geometry";
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

  public drapeLineString(outStrings: CurvePrimitive[], inPoints: GrowableXYZArray, tolerance: number, maxDistance = 1.0E5): "loading" | "complete" {
    const tree = this.treeRef.treeOwner.load();
    if (!tree)
      return "loading";

    const range = Range3d.createNull();
    range.extendArray(inPoints);
    range.extendZOnly(-maxDistance);  // Expand - but not so much that we get opposite side of globe.
    range.extendZOnly(maxDistance);

    const collector = new LineSegmentCollector(this, tolerance, range, tree.iModelTransform, inPoints);
    this.treeRef.collectTileGeometry(collector);
    collector.requestMissingTiles();

    if (collector.isAllGeometryLoaded && collector.polyfaces.length > 0) {

      // console.log (`const points = ${JSON.stringify(inPoints.getPoint3dArray())}`);
      for (const polyface of collector.polyfaces) {
        // console.log (`const polyface = ${JSON.stringify(IModelJson.Writer.toIModelJson(polyface))}`);
        outStrings.push(...PolyfaceQuery.sweepLineStringToFacets(
          inPoints,
          polyface,
          SweepLineStringToFacetsOptions.create(Vector3d.unitZ(), undefined,true, true, false, false)));
      }

      return "complete";
    }

    return "loading";
  }

  public drapeLoop(outMeshes: Polyface[], loop: Loop, tolerance: number, maxDistance = 1.0E5): "loading" | "complete" {
    const tree = this.treeRef.treeOwner.load();
    if (!tree)
      return "loading";

    const range = loop.range();
    range.extendZOnly(-maxDistance);  // Expand - but not so much that we get opposite side of globe.
    range.extendZOnly(maxDistance);

    const strokes = loop.getPackedStrokes();
    if (!strokes)
      return "complete";

    const collector = new LineSegmentCollector(this, tolerance, range, tree.iModelTransform, strokes);
    this.treeRef.collectTileGeometry(collector);
    collector.requestMissingTiles();

    if (collector.isAllGeometryLoaded && collector.polyfaces.length > 0) {
      for (const polyface of collector.polyfaces) {
        const mesh = PolyfaceClip.drapeRegion(polyface, loop);
        if (mesh)
          outMeshes.push(mesh);
      }
      return "complete";
    }
    return "loading";
  }
  public drapePoint(outPoint: Point3d, point: Point3d, chordTolerance: number, maxDistance = 1.0E5): "loading" | "complete" {
    const tree = this.treeRef.treeOwner.load();
    if (!tree)
      return "loading";

    const range = Range3d.createXYZ(point.x, point.y, point.z);
    range.extendZOnly(-maxDistance);  // Expand - but not so much that we get opposite side of globe.
    range.extendZOnly(maxDistance);

    const collector = new TileGeometryCollector({chordTolerance, range, user: this });
    this.treeRef.collectTileGeometry(collector);
    collector.requestMissingTiles();

    if (collector.isAllGeometryLoaded && collector.polyfaces.length > 0) {
      for (const polyface of collector.polyfaces) {
        // Im assuming a single polyface here since we are draping a single point
        const facetLocation = PolyfaceQuery.intersectRay3d(polyface, Ray3d.create(point, Vector3d.create(0,0,1) ));
        if (!facetLocation)
          continue;
        outPoint.setFromPoint3d(facetLocation.point);
      }
      return "complete";
    }
    return "loading";
  }
}
