

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, it } from "vitest";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { UnboundedCircle2dByCenterAndRadius } from "../../curve/internalContexts/geometry2d/UnboundedCircle2d";
import { ConstrainedConstruction } from "../../curve/internalContexts/geometry2d/ConstrainedConstruction";
import { Arc3d } from "../../curve/Arc3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Point2d, Vector2d } from "../../geometry3d/Point2dVector2d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../core-geometry";
import {  } from "../../curve/internalContexts/geometry2d/UnboundedLine2d.";
import {  } from "../../curve/internalContexts/geometry2d/implicitCurve2d";
import { CurveFactory } from "../../curve/CurveFactory";
import { UnboundedHyperbola2d } from "../../curve/internalContexts/geometry2d/UnboundedHyperbola2d";

function implicitCircle2dToArc3d (circle: UnboundedCircle2dByCenterAndRadius, z: number = 0.0 ):Arc3d | LineString3d|undefined{
  if (circle.radius !== 0.0)
  return Arc3d.createCenterNormalRadius (Point3d.create (circle.center.x, circle.center.y, z),
    Vector3d.create (0,0,1), circle.radius);
  const size = 0.1;
  const x0 = circle.center.x - size;
  const x1 = circle.center.x + size;
  const y0 = circle.center.y - size;
  const y1 = circle.center.y + size;
  return LineString3d.create ([[x0,y0,z],[x1,y1,z],[x1,y0,z],[x0,y1,z]]);
}

it("AMedialCurveCCA", () => {
  const ck = new Checker(false, false);
  const allGeometry: GeometryQuery[] = [];

  const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0,1);
  const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,4,-2);
  const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius (0, 1, 0.8);
  const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius(2,3,4);

  const allCircles = [circleA, circleB, circleC, circleD];

  let x0 = 0;
  let y0 = 0;
  const xStepA = 20;
  const xStepB = 40;
  // const yStep = 40;
  for (let i = 0; i < allCircles.length; i++){
    y0 = 0;
    const circle0 = allCircles[i];
    const circle1 = circle0.cloneNegateRadius ();
    for (let j = i+1; j < allCircles.length; j++){
      for (const circle of [circle0, circle1]){
        const curve = ConstrainedConstruction.medialCurveBetweenCircles (circle, allCircles[j]);
        GeometryCoreTestIO.captureCloneGeometry (allGeometry,
            implicitCircle2dToArc3d (allCircles[i]), x0, y0);
        GeometryCoreTestIO.captureCloneGeometry (allGeometry,
              implicitCircle2dToArc3d (allCircles[j]), x0, y0);
        if (curve)
          GeometryCoreTestIO.captureCloneGeometry (allGeometry,
              CurveFactory.createCurvePrimitiveFromImplicitCurve(curve), x0, y0);
          x0 += xStepA;
        }
      }
    x0 += xStepB;
  }

  GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "medialCurveCCA");
  expect(ck.getNumErrors()).toBe(0);
});

it("UnboundedHyperbola2dA", () => {
  const ck = new Checker(false, false);
  const allGeometry: GeometryQuery[] = [];

  const curveA = UnboundedHyperbola2d.createCenterAndAxisVectors (
        Point2d.create (0,0), Vector2d.create (1,0), Vector2d.create (0,1));
  const curveA1 = UnboundedHyperbola2d.createCenterAndAxisVectors (
    Point2d.create (0,1), Vector2d.create (1,0), Vector2d.create (0,1));
  const curveB = UnboundedHyperbola2d.createCenterAndAxisVectors (
    Point2d.create (1,2), Vector2d.create (2,1), Vector2d.create (-1,3));
  const curveCX = UnboundedHyperbola2d.createCenterAndAxisVectors (
    Point2d.create (0,0), Vector2d.create (2,0), Vector2d.create (0,1));
  const curveCY = UnboundedHyperbola2d.createCenterAndAxisVectors (
    Point2d.create (1,2), Vector2d.create (0,2), Vector2d.create (2,0));
  const curveD = UnboundedHyperbola2d.createCenterAndAxisVectors (
    Point2d.create (0,0), Vector2d.create (1,0), Vector2d.create (1,1));
  const curveE = UnboundedHyperbola2d.createCenterAndAxisVectors (
    Point2d.create (0,0), Vector2d.create (1,0), Vector2d.create (0,-1));
  const curveF = UnboundedHyperbola2d.createCenterAndAxisVectors (
    Point2d.create (0,0), Vector2d.create (1,-1), Vector2d.create (1,1));
  let x0 = 0;
  const y0 = 0;
    for (const curve of [curveA, curveCX, curveCY, curveA1, curveB, curveD, curveE, curveF]){
      GeometryCoreTestIO.captureCloneGeometry (allGeometry,
        CurveFactory.createCurvePrimitiveFromImplicitCurve(curve), x0, y0);

        GeometryCoreTestIO.consoleLog (" new curve", {a: curve.pointA, u: curve.vectorU, v: curve.vectorV});
        /*
              for (const radians of [0.0, 0.1, 0.2, 0.3]){
        const perpFunction = curve.radiansToPerpFunction (radians);
        // GeometryCoreTestIO.consoleLog ({radians, perpFunction});
        ck.testCoordinate (0.0, perpFunction, {radians, perpFunction})
      }
        */

        for (const radians of [0.0, 0.1, 0.5]){
          const xy = curve.radiansToPoint2d (radians);
          if (xy !== undefined){
            const xy1 = curve.closestPoint (xy);
            if (ck.testDefined (xy1, "cloesstPoint"))
              ck.testPoint2d (xy, xy1, {radians, x0: xy.x, y0: xy.y, x1: xy1.x, y1:xy1.y});
            // const uv = curve.globalToLocal (xy)!;
            const f = curve.functionValue (xy);
            // GeometryCoreTestIO.consoleLog ({radians, f});
            ck.testCoordinate (0, f, {radians, f, x: xy.x, y: xy.y});
            // const uv = curve.globalToLocal (xy)!;
            // GeometryCoreTestIO.consoleLog ({onCurve: xy.toJSON(), projection: uv.toJSON()});
          }
        }
// GeometryCoreTestIO.consoleLog("OFF CURVE TESTS");
      for (const xy of [
        Point2d.create (3,5),
        Point2d.create (13,0.1),
        Point2d.create (4,5),
        Point2d.create (8,5),
        Point2d.create (8,-1),
        Point2d.create (2,0.01)]){
        GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 0, xy, 0.05, x0, 0);
        curve.emitPerpendiculars (xy,
          (curvePoint: Point2d, _radians: number | undefined)=>{
            GeometryCoreTestIO.captureCloneGeometry (allGeometry,
              LineSegment3d.createXYXY(xy.x, xy.y, curvePoint.x, curvePoint.y), x0,0);
            // GeometryCoreTestIO.consoleLog({onCurve: curvePoint.toJSON()});
            ck.testCoordinate (0, curve.functionValue (curvePoint), "point projects to hyperbola");
            const gradF = curve.gradiant (curvePoint);
            GeometryCoreTestIO.captureCloneGeometry (allGeometry,
                [Point3d.createFrom (curvePoint), Point3d.createFrom (curvePoint.plusScaled (gradF, 0.2))],
                x0, 0);
            const vectorW = Vector2d.createStartEnd (xy, curvePoint);
            const cross = gradF.crossProduct (vectorW);
            GeometryCoreTestIO.consoleLog ({cross, curvePoint, xy, vectorW, gradF});
            ck.testCoordinate (0, cross, "point to hyperbola is perpendicular");
            }
            );
        }
      x0 += 30;
      }

    GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "UnboundedHyperbola2dA");
    expect(ck.getNumErrors()).toBe(0);
});
