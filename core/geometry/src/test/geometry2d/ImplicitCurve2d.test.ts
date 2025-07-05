

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, it } from "vitest";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { Point2d, Vector2d } from "../../geometry3d/Point2dVector2d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { CurveFactory } from "../../curve/CurveFactory";
import { UnboundedHyperbola2d } from "../../curve/internalContexts/geometry2d/UnboundedHyperbola2d";
import { UnboundedEllipse2d } from "../../curve/internalContexts/geometry2d/UnboundedEllipse2d";
import { UnboundedParabola2d } from "../../curve/internalContexts/geometry2d/UnboundedParabola";
import { LineSegment3d } from "../../curve/LineSegment3d";



it("ImplicitCurve", () => {
  const ck = new Checker(false, false);
  const allGeometry: GeometryQuery[] = [];

  const unitHyperbola = UnboundedHyperbola2d.createCenterAndAxisVectors (
        Point2d.create (0,0), Vector2d.create (1,0), Vector2d.create (0,1));
  const unitEllipse = UnboundedEllipse2d.createCenterAndAxisVectors (
    Point2d.create (1,2), Vector2d.create (1,0), Vector2d.create (0,1));
  const unitParabola = UnboundedParabola2d.createCenterAndAxisVectors (
    Point2d.create (1,2), Vector2d.create (1,0), Vector2d.create (0,1));

  const hyperbola = UnboundedHyperbola2d.createCenterAndAxisVectors (
        Point2d.create (1,2), Vector2d.create (2,1), Vector2d.create (1,4));
  const ellipse = UnboundedEllipse2d.createCenterAndAxisVectors (
        Point2d.create (1,3), Vector2d.create (2,1), Vector2d.create (1,4));
  const parabola = UnboundedParabola2d.createCenterAndAxisVectors (
        Point2d.create (-2,1), Vector2d.create (2,1), Vector2d.create (1,4));

    let x0 = 0;
    const y0 = 0;
    for (const curve of [ellipse, unitEllipse, unitHyperbola, unitParabola, ellipse, parabola, hyperbola]){
      // GeometryCoreTestIO.consoleLog ({curve});
      GeometryCoreTestIO.captureCloneGeometry (allGeometry,
        CurveFactory.createCurvePrimitiveFromImplicitCurve(curve), x0, y0);
        if (curve.radiansToPoint2d (0.0) === undefined){
            // this curve does not ahve an angular parameter !
        } else {
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
            GeometryCoreTestIO.captureCloneGeometry (allGeometry, [xy, xy1!], x0, y0);
            GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 0, xy, 0.05, x0, y0);
            // const uv = curve.globalToLocal (xy)!;
            // GeometryCoreTestIO.consoleLog ({onCurve: xy.toJSON(), projection: uv.toJSON()});
          }
        }}

        GeometryCoreTestIO.consoleLog("OFF CURVE TESTS");
        GeometryCoreTestIO.consoleLog(curve);
        for (const xy of [
          Point2d.create (3,5),
          Point2d.create (13,0.1),
          Point2d.create (4,5),
          Point2d.create (8,5),
          Point2d.create (8,-1),
          Point2d.create (2,0.01)]){
          GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 0, xy, 0.05, x0, 0);
          curve.emitPerpendiculars (xy,
            (curvePoint: Point2d, radians: number | undefined)=>{
              GeometryCoreTestIO.captureCloneGeometry (allGeometry,
                LineSegment3d.createXYXY(xy.x, xy.y, curvePoint.x, curvePoint.y), x0,0);
              // GeometryCoreTestIO.consoleLog({onCurve: curvePoint.toJSON()});
              ck.testCoordinate (0, curve.functionValue (curvePoint), "curve point has function = 0");
              const gradF = curve.gradiant (curvePoint);
              GeometryCoreTestIO.captureCloneGeometry (allGeometry,
                  [curvePoint, curvePoint.plusScaled (gradF, 0.2)],
                  x0, 0);
              const vectorW = Vector2d.createStartEnd (xy, curvePoint);
              ck.testParallelOrAntiParllel2d (gradF, vectorW, "grad parallel space vector");
              if (radians !== undefined){
                  const tangent = curve.radiansToTangentVector2d (radians);
                  if (tangent !== undefined){
                    GeometryCoreTestIO.captureCloneGeometry (allGeometry,
                        [curvePoint, curvePoint.plusScaled (tangent, 0.2)],
                        x0, 0);
                      ck.testPerpendicular2d (gradF, tangent,"grad perp tangent");
                    }
                  }

              }
              );
          }
      x0 += 30;
    }
    
    GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "ImplicitCurve2d");
    expect(ck.getNumErrors()).toBe(0);
});

