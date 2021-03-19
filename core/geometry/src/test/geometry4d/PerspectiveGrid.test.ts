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
import { GridInViewContext, ViewportGraphicsGridLineIdentifier, ViewportGraphicsGridSpacingOptions } from "../../geometry4d/ViewGraphicsOps";
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
function _captureXYPlaneGrid(allGeometry: GeometryQuery[], transform: Transform, range: Range2d, x0: number, y0: number, z0: number = 0) {
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

  it("GridInViewContext", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    let x0 = 0;
    let y0 = 0;
    let z0 = 0;
    const cornerY = 80;
    const backSize = 80;
    const gridSize = 2.0;
    const zGrid = 0.75;
    const layoutMultiplier = 10.0;
    const cullDistances = [0.01 / 3.0, 0.01, 0.03, 0.09, 0.27];
    for (const gridAngle of [Angle.createDegrees(0), Angle.createDegrees(1), Angle.createDegrees(38)]) {
      x0 = 0;
      for (const frustumFraction of [0.05, 0.1, 0.2, 0.4]) {
          exerciseGridInViewContext (allGeometry, x0, y0, z0, backSize, cornerY, frustumFraction, gridAngle, gridSize, zGrid, cullDistances);
        x0 += layoutMultiplier * backSize;
        }
      y0 += layoutMultiplier * backSize;
      z0 += layoutMultiplier * backSize;
      }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PerspectiveGrid", "GridInViewContext");
    expect(ck.getNumErrors()).equals(0);
  });

});

function exerciseGridInViewContext(
  allGeometry: GeometryQuery[],
  x0: number, y0: number, z0: number,
  backSize: number,
  cornerY: number,
  frustumFraction: number,
  gridAngle: Angle,
  gridSize: number,
  zGrid: number,
  cullDistances: number[]) {
  const unitRange = Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1);
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
  const lineLimiter = 40;

  const gridInViewContext = GridInViewContext.create(gridOrigin, gridX, gridY, map, unitRange, lineLimiter);
  const options0 = ViewportGraphicsGridSpacingOptions.create(0.0001, 0, 0);
  // output in xyz frustum
  gridInViewContext?.processGrid (options0,
    (pointA: Point3d, pointB: Point3d,
      _perspectiveZA: number | undefined, _perspectiveZB: number | undefined,
      _startEndDistances: Segment1d | undefined,
      _gridLineIdentifier: ViewportGraphicsGridLineIdentifier) => {
      GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointA, pointB),
        x0, y0, z0);
    });

  let y0View = y0;
  const npcStep2 = 2.0;
  const npcStep1 = 1.5;
  const npcYStep = 2.0;
  for(const clipMode of [0,1]){
    let x0View = x0 + backSize;
    for (const cullDistance of cullDistances) {
      for (const cullMode of [0, 1, 2]) {
        const options2 = ViewportGraphicsGridSpacingOptions.create(cullDistance, cullMode as (0 | 1 | 2), clipMode as (0 | 1));
        GeometryCoreTestIO.captureRangeEdges(allGeometry, unitRange, x0View, y0View, z0);
        gridInViewContext?.processGrid(options2,
          (pointA: Point3d, pointB: Point3d,
            _perspectiveZA: number | undefined, _perspectiveZB: number | undefined,
            _startEndDistances: Segment1d | undefined,
            _gridLineIdentifier: ViewportGraphicsGridLineIdentifier) => {
            const pointA1 = map.transform0.multiplyPoint3dQuietNormalize(pointA);
            const pointB1 = map.transform0.multiplyPoint3dQuietNormalize(pointB);
            GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointA1, pointB1),
              x0View, y0View, z0);
          });
        x0View += npcStep1;
        }
      x0View += npcStep2;
      }
    y0View += npcYStep;
    }

}
