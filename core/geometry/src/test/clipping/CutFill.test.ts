/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { ClippedPolyfaceBuilders, PolyfaceClip } from "../../polyface/PolyfaceClip";
import { Range3d } from "../../geometry3d/Range";
import { IndexedPolyface, Polyface } from "../../polyface/Polyface";
import { ConvexClipPlaneSet } from "../../clipping/ConvexClipPlaneSet";
import { Sample } from "../../serialization/GeometrySamples";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";

function clipMeshToRange(range: Range3d, mesh: Polyface): { inside: Polyface | undefined, outside: Polyface | undefined } {
  const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
  const clipBuilders = ClippedPolyfaceBuilders.create(true, true, true);
  PolyfaceClip.clipPolyfaceInsideOutside(mesh, clipper, clipBuilders);
  return { inside: clipBuilders.claimPolyface(0, true), outside: clipBuilders.claimPolyface(1, true) };
}

/**
 * Create "drape edges" that fill in vertical sides from mesh facets to a z level.
 * * This is appropriate for a mesh that has either
 *   * all facets pointing up, and z below the entire mesh.
 *   * all facets pointing down, and z above the entire mesh.
 * * There are no checks for these conditions.
 * * The initial step of this process is to call markPairedEdgesInvisible on the original mesh.
 *    * this marks the boundary visible and interior edges invisible.
 */
function createDrapeFromMeshToZ(mesh: IndexedPolyface, z: number): IndexedPolyface | string {
  const builder = PolyfaceBuilder.create();
  PolyfaceQuery.markPairedEdgesInvisible(mesh);
  const visitor = mesh.createVisitor(1);
  const newFacetPoints = new GrowableXYZArray(4);
  const pointA = Point3d.create();
  const pointB = Point3d.create();
  for (visitor.reset(); visitor.moveToNextFacet();) {
    const numEdgesThisFacet = visitor.point.length - 1;
    builder.addPolygonGrowableXYZArray(visitor.point);
    for (let i = 0; i < numEdgesThisFacet; i++) {
      if (visitor.edgeVisible[i]) {
        visitor.point.getPoint3dAtUncheckedPointIndex(i, pointA);
        visitor.point.getPoint3dAtUncheckedPointIndex(i + 1, pointB);
        newFacetPoints.clear();
        newFacetPoints.push(pointB);
        newFacetPoints.push(pointA);
        newFacetPoints.pushXYZ(pointA.x, pointA.y, z);
        newFacetPoints.pushXYZ(pointB.x, pointB.y, z);
        builder.addPolygonGrowableXYZArray(newFacetPoints);
      }
    }
  }
  return builder.claimPolyface();
}
/**
 * Create a volume bounded by an upward facing surface and a range which clips the mesh in x and y.
 * * The range normally will have low z BELOW the mesh and high z ABOVE the mesh.
 *    * If those z ranges are within the mesh range, flat spots will be cut into the mesh.
 * * The result mesh may contain
 *   * `upwardFacingSurfaceMesh` is clipped to the range
 *   * vertical side facets from the mesh to the bottom of the range.
 *   * Additional sides for the range sides.
 * *
 * @param upwardFacingMesh surface mesh
 * @param range clip range
 */
function createVolumeBelowSurfaceMeshInRange(mesh: IndexedPolyface, clipRange: Range3d): Polyface | string {
  const meshRange = mesh.range();
  // create side faces that extend beyond the bottom of the range.
  const meshWithSides = createDrapeFromMeshToZ(mesh, Math.min(clipRange.low.z, meshRange.low.z) - 1);
  if (meshWithSides instanceof IndexedPolyface) {
    // Clip with (a) parts of the mesh within the range (b) sides draped below the mesh edges (c) additional sides at clip range (d) bottom of clipRange
    const clipper = ConvexClipPlaneSet.createRange3dPlanes(clipRange);
    const clipBuilders = ClippedPolyfaceBuilders.create(true, false, true);
    PolyfaceClip.clipPolyfaceInsideOutside(meshWithSides, clipper, clipBuilders);
    const clippedMesh = clipBuilders.claimPolyface(0, true);
    if (clippedMesh instanceof Polyface)
      return clippedMesh;
    return "PolyfaceClip.clipPolyfaceInsideOutside did not return inside clip";
  }
  return "failed creation of vertical facets on sides.";
}

function createSampleUndulatingSurface(numX: number, numY: number): IndexedPolyface {
  const mesh = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 1), Vector3d.create(1, 0.1, 0.3), Vector3d.create(-0.2, 1, 0.5), numX, numY, false, false, false, true);
  PolyfaceQuery.markAllEdgeVisibility(mesh, true);
  // introduce some wobble in the z direction to make the surface more interesting ...
  const workPoint = Point3d.create();
  const a = 0.50;
  const dThetaRadians = 0.423;
  for (let i = 0; i < mesh.data.point.length; i++) {
    mesh.data.point.getPoint3dAtUncheckedPointIndex(i, workPoint);
    workPoint.z += a * Math.cos(i * dThetaRadians);
    mesh.data.point.setAtCheckedPointIndex(i, workPoint);
  }
  return mesh;
}
/* eslint-disable no-console */
describe("CutFill", () => {
  it("RangeBoxClipA", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const mesh = createSampleUndulatingSurface(5, 6);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0);

    const meshWithSides = createDrapeFromMeshToZ(mesh, -1.0);
    if (meshWithSides instanceof IndexedPolyface) {
      y0 += 10.0;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshWithSides, x0, y0);
      const range = Range3d.createXYZXYZ(0.5, 0.5, 0, 5.5, 4.0, 6);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, x0, y0);
      const clips = clipMeshToRange(range, meshWithSides);
      y0 += 10;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, clips.inside, x0, y0);
      y0 += 10;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, clips.outside, x0, y0);
      GeometryCoreTestIO.saveGeometry(allGeometry, "CutFill", "RangeBoxClipA");
      expect(ck.getNumErrors()).equals(0);
    }

  });
  it("RangeBoxClipB", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    const mesh = createSampleUndulatingSurface(5, 6);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0);
    y0 += 12.0;
    const allRanges = [];
    allRanges.push(Range3d.createXYZXYZ(-2, -2, -1, 10, 10, 5),
      Range3d.createXYZXYZ(1, 2, -3, 5, 10, 10),
      Range3d.createXYZXYZ(0.5, 0.5, -1, 5.2, 5.8, 10),
      Range3d.createXYZXYZ(-1, -1, 1, 10, 8, 3.0));
    for (const clipRange of allRanges) {
      x0 += 20.0;
      GeometryCoreTestIO.captureRangeEdges(allGeometry, clipRange, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0);
      const bigClip = createVolumeBelowSurfaceMeshInRange(mesh, clipRange);
      if (bigClip instanceof Polyface)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, bigClip, x0, y0 + 12.0);
      else
        ck.announceError(bigClip, clipRange);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CutFill", "RangeBoxClipB");
    expect(ck.getNumErrors()).equals(0);
  });

});
