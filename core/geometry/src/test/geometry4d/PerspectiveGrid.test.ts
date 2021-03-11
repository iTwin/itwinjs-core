/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Angle } from "../../geometry3d/Angle";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range2d, Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Map4d } from "../../geometry4d/Map4d";
import { Matrix4d } from "../../geometry4d/Matrix4d";
import { IndexedPolyface } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { Sample } from "../../serialization/GeometrySamples";
import { Loop } from "../../curve/Loop";
import { ClipPlane } from "../../clipping/ClipPlane";
import { ViewGraphicsOps, ViewportGraphicsGridLineIdentifier, ViewportGraphicsGridSpacingOptions } from "../../geometry4d/ViewGraphicsOps";
import { BoxTopology } from "../../polyface/BoxTopology";
import { LineString3d } from "../../curve/LineString3d";
import { Segment1d } from "../../geometry3d/Segment1d";

function _createTransformedUnitBoxMesh(transform: Transform | Matrix4d, z0: number = 0, z1: number = 1): IndexedPolyface {
  const builder = PolyfaceBuilder.create();
  builder.addTransformedRangeMesh(Transform.createIdentity(), Range3d.createXYZXYZ(0, 0, z0, 1, 1, z1),
  //  [true, false, true, false, false, true]
  );
  const mesh = builder.claimPolyface(false);
  if (transform instanceof Transform)
    mesh.data.point.multiplyTransformInPlace(transform);
  else if (transform instanceof Matrix4d) {
    mesh.data.point.multiplyMatrix4dAndQuietRenormalizeMatrix4d (transform);
  }
  mesh.twoSided = true;
  return mesh;
}
function captureXYPlaneGrid(allGeometry: GeometryQuery[], transform: Transform, range: Range2d, x0: number, y0: number, z0: number = 0) {
  for (let ix = range.low.x; ix <= range.high.x ; ix++){
    GeometryCoreTestIO.captureGeometry (allGeometry, LineSegment3d.createCapture(transform.multiplyXYZ(ix, range.low.y, 0),
      transform.multiplyXYZ(ix, range.high.y, 0)), x0, y0, z0);
  }
  for (let iy = range.low.y; iy <= range.high.y; iy++){
    GeometryCoreTestIO.captureGeometry (allGeometry, LineSegment3d.createCapture(transform.multiplyXYZ(range.low.x, iy, 0),
      transform.multiplyXYZ(range.high.x, iy, 0)), x0, y0, z0);
  }
}

function captureFrustumEdges(allGeometry: GeometryQuery[], npcToWorld: Matrix4d, x0: number, y0: number, z0: number = 0) {
  const corners = BoxTopology.pointsClone();
  npcToWorld.multiplyPoint3dArrayQuietNormalize(corners);
  const faceIndices = BoxTopology.cornerIndexCCW;
  for (const oneFaceIndices of faceIndices) {
    const linestring = LineString3d.create();
    for (const k of oneFaceIndices) {
      linestring.addPoint(corners[k]);
    }
    linestring.addClosurePoint();
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, linestring, x0, y0, z0);
  }
}

describe("PerspectiveGrid", () => {
  it("HelloFrustum", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    const unitRange = Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1);
    let x0 = 0;
    let y0 = 0;
    const z0 = 0;
    const cornerY = 80;
    const backSize = 80;
    const frustumFraction = 0.7;
    const gridSize = 3.0;
    for (const gridAngle of [Angle.createDegrees(0),
      Angle.createDegrees(10), Angle.createDegrees(20), Angle.createDegrees(45), Angle.createDegrees(-45)]) {
      x0 = 0;
      for (const zGrid of [0.75, 0.0, 0.001, 0.01, 0.04, 0.10, 0.40, 0.50, 0.75]) {
        const backLowerLeft = Point3d.create(-0.5 * backSize, cornerY, -0.5 * backSize);
        const eye = Point3d.create(0, -cornerY * frustumFraction / (1 - frustumFraction), 0);
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, eye, 0.5, x0, y0, z0);
        const lowerEdgeVector = Vector3d.createStartEnd(backLowerLeft, eye).scale(1.0 - frustumFraction);
        const map = Map4d.createVectorFrustum(
            backLowerLeft,
            Vector3d.create(backSize, 0, 0),
          Vector3d.create(0, 0, backSize),
          lowerEdgeVector, frustumFraction)!;
        // GeometryCoreTestIO.captureCloneGeometry(allGeometry, createTransformedUnitBoxMesh(map.transform1, 0.0, 0.25), x0, y0, z0);
        // GeometryCoreTestIO.captureCloneGeometry(allGeometry, createTransformedUnitBoxMesh(map.transform1, 0.26, 1.0), x0, y0, z0);
        captureFrustumEdges(allGeometry, map.transform1, x0, y0, z0);
        const gridOrigin = Point3d.create(0, 0, frustumFraction * 0.8 * backLowerLeft.z);   // put the grid center on the front plane below xy plane
        const gridX0 = Vector3d.create(gridSize, 0, 0);
        const gridY0 = Vector3d.create(0, gridSize, zGrid);
        const cosTheta = gridAngle.cos();
        const sinTheta = gridAngle.sin();
        const gridX = Vector3d.createAdd2Scaled(gridX0, cosTheta, gridY0, sinTheta);
        const gridY = Vector3d.createAdd2Scaled(gridX0, -sinTheta, gridY0, cosTheta);
        const gridZ = gridX.unitCrossProduct(gridY)!;
        const gridTransform = Transform.createOriginAndMatrixColumns(gridOrigin, gridX, gridY, gridZ);
        const gridGeometry: LineSegment3d[] = [];
        captureXYPlaneGrid(gridGeometry, gridTransform, Range2d.createXYXY(-10, 0, 10, 20), 0,0,0);
        captureXYPlaneGrid(gridGeometry, gridTransform, Range2d.createXYXY(-1, -1, 1, 1), 0,0,0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, gridGeometry, x0, y0, z0);
        // GeometryCoreTestIO.captureCloneGeometry(allGeometry, gridExtensionGeometry, x0, y0, z0);
        const x0World = x0;
        x0 += 2 * backSize;
        const dxUnit = 2.0;
        const toNPC = map.transform0;
        // promote the grid to 4d . . .
        const npcOrigin = toNPC.multiplyXYZW(gridOrigin.x, gridOrigin.y, gridOrigin.z, 1.0);
        const npcGridX = toNPC.multiplyXYZW(gridX.x, gridX.y, gridX.z, 0.0);
        const npcGridY = toNPC.multiplyXYZW(gridY.x, gridY.y, gridY.z, 0.0);

        const npcGridXDirection = npcGridX.crossWeightedMinus(npcOrigin).normalize ()!;
        const npcGridYDirection = npcGridY.crossWeightedMinus(npcOrigin).normalize()!;
        const npcNormal = npcGridXDirection.unitCrossProduct(npcGridYDirection);
        const npcOriginXYZ = npcOrigin.realPoint();

        const displayableDistance = 0.01;
        if (npcNormal && npcOriginXYZ) {
          const npcPlane = ClipPlane.createNormalAndPoint(npcNormal, npcOriginXYZ)!;
          const npcLoop = npcPlane.intersectRange(unitRange, true)!;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, npcLoop, x0, y0, z0);
          const xyzLoop = npcLoop.clone();
          xyzLoop.multiplyMatrix4dAndQuietRenormalizeMatrix4d(map.transform1);
          const stLoop = xyzLoop.clone(); // loop coordinates in grid
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, xyzLoop, x0World, y0, z0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, stLoop, x0World, y0 + backSize, z0);
        }
        // The vanishing line for the grid is all grid s,t points where weight is 0 . . .
        const e = 0.04;
        const npc0Rectangle = Loop.createPolygon(Sample.createRectangleXY(e, e, 1 - e, 1 - e, 0));
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, npc0Rectangle, x0, y0, z0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, npc0Rectangle, x0 + dxUnit, y0, z0);
        // GeometryCoreTestIO.captureCloneGeometry(allGeometry, npcGridGeometry, x0, y0, z0);
        GeometryCoreTestIO.captureRangeEdges(allGeometry, unitRange, x0, y0, z0);
        GeometryCoreTestIO.captureRangeEdges(allGeometry, unitRange, x0 + dxUnit, y0, z0);
        const x0FromFunction = x0 + backSize;
        // GeometryCoreTestIO.captureCloneGeometry(allGeometry, createTransformedUnitBoxMesh(map.transform1, 0.0, 1.0), x0FromFunction, y0, z0);
        captureFrustumEdges(allGeometry, map.transform1, x0FromFunction, y0, z0);
        const options = ViewportGraphicsGridSpacingOptions.create(displayableDistance, 2, 1);

        ViewGraphicsOps.announceGridLinesInView(gridOrigin, gridX, gridY, map, unitRange, options,
          (pointA: Point3d, pointB: Point3d,
            _perspectiveZA: number | undefined, _perspectiveZB: number | undefined,
            _startEndDistances: Segment1d | undefined,
            _gridLineIdentifier: ViewportGraphicsGridLineIdentifier) => {
            const pointA1 = map.transform0.multiplyPoint3dQuietNormalize(pointA);
            const pointB1 = map.transform0.multiplyPoint3dQuietNormalize(pointB);
            GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointA, pointB),
              x0FromFunction, y0, z0);
            GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointA1, pointB1),
              x0, y0, z0);
          });
        x0 += 5 * backSize;
        }
      y0 += 5 * backSize;
      }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PerspectiveGrid", "HelloFrustum");
    expect(ck.getNumErrors()).equals(0);
  });
});
