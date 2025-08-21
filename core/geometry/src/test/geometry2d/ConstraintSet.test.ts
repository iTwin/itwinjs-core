/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, it } from "vitest";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { UnboundedCircle2dByCenterAndRadius } from "../../curve/internalContexts/geometry2d/UnboundedCircle2d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { UnboundedLine2dByPointAndNormal } from "../../curve/internalContexts/geometry2d/UnboundedLine2d.";
import { ImplicitCurve2d } from "../../curve/internalContexts/geometry2d/implicitCurve2d";
import { ConstraintSet, ConstructionConstraint } from "../../curve/internalContexts/geometry2d/ConstraintSet";
import { ImplicitGeometryHelpers } from "./ImplicitCircle2d.test";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Point2d, Vector2d } from "../../geometry3d/Point2dVector2d";
import { UnboundedParabola2d } from "../../curve/internalContexts/geometry2d/UnboundedParabola";
import { Geometry } from "../../Geometry";
import { LineSegment3d } from "../../curve/LineSegment3d";

function transferCurve(source: ConstructionConstraint, dest: ImplicitCurve2d[]) {
    if (source.curve)
        dest.push(source.curve);
}

it("ConstraintSetCirclesAndLines", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(1, 0, 1);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(5, 8, 1);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(0.5, 2, 0.2);
    const lineL = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(1, 1, 1, 0.2);
    const lineM = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(10, 2, 0.2, -0.9);
    const lineN = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(5, 10, 4, 2);

    // Note that allConstraintss has 3 contiguous circles, then 3 contguous lines, then a radius.
    // cycling through blocks (includingwraparound) of 3 will touch all the cases in the construction set branching.
    // juggling the order within each block of 3 exercises the sort logic.
    const allConstraints = [ConstructionConstraint.createTangentTo(circleA),
    ConstructionConstraint.createTangentTo(circleB),
    ConstructionConstraint.createTangentTo(circleC),
    ConstructionConstraint.createTangentTo(lineL),
    ConstructionConstraint.createTangentTo(lineM),
    ConstructionConstraint.createTangentTo(lineN),
    ConstructionConstraint.createRadius(25),
    ];

    let x0 = 0;
    const y0 = 0;
    const xStep = 200;
    // const yStep = 40;
    for (let i0 = 0; i0 < allConstraints.length; i0++) {
        //for (const i0 of [4,4,4,5]){
        // y0 = 0;
        const i1 = (i0 + 1) % allConstraints.length;
        const i2 = (i1 + 1) % allConstraints.length;
        const constraintSet = ConstraintSet.create();
        const curvesToDisplay: ImplicitCurve2d[] = [];
        for (const c of [allConstraints[i0], allConstraints[i1], allConstraints[i2]]) {
            constraintSet.addConstraint(c);
            transferCurve(c, curvesToDisplay);
        }

        const result = constraintSet.constructConstrainedCircles();

        ImplicitGeometryHelpers.outputCircleMarkup(ck, allGeometry, x0, y0,
            result, curvesToDisplay, 0);

        x0 += xStep;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "ConstraintSetCirclesAndLines");
    expect(ck.getNumErrors()).toBe(0);
});

it("ConstraintSetLines", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(1, 0, 0.5);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(4, 6, 1);
    const lineL = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(1, 1, 1, 0.2);

    let x0 = 0;
    const xStep = 40;

    for (const constraintPair of [
        [ConstructionConstraint.createTangentTo(circleA), ConstructionConstraint.createTangentTo(circleB)],
        [ConstructionConstraint.createPerpendicularTo(circleA), ConstructionConstraint.createTangentTo(circleB)],
        [ConstructionConstraint.createTangentTo(circleA), ConstructionConstraint.createPerpendicularTo(circleB)],
        [ConstructionConstraint.createPerpendicularTo(circleA), ConstructionConstraint.createPerpendicularTo(circleB)],
        [ConstructionConstraint.createPerpendicularTo(lineL), ConstructionConstraint.createPerpendicularTo(circleB)],
        [ConstructionConstraint.createPerpendicularTo(lineL), ConstructionConstraint.createTangentTo(circleB)],
    ]) {
        const y0 = 0;
        const constraintSet = ConstraintSet.create();
        const curvesToDisplay: ImplicitCurve2d[] = [];
        for (const c of constraintPair) {
            constraintSet.addConstraint(c);
            transferCurve(c, curvesToDisplay);
        }
        const constraintSetReversed = ConstraintSet.create();
        constraintSetReversed.addConstraint(constraintPair[0]);
        constraintSetReversed.addConstraint(constraintPair[1]);

        const result = constraintSet.constructConstrainedLines();
        const resultReversed = constraintSetReversed.constructConstrainedLines();

        ImplicitGeometryHelpers.outputLineMarkup(ck, allGeometry, x0, y0,
            result, curvesToDisplay, 0);

        ck.testExactNumber(
            result !== undefined ? result.length : 0,
            resultReversed !== undefined ? resultReversed.length : 0,
            "Match counts with reversed constraints", constraintPair);
        x0 += xStep;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "ConstraintSetLines");
    expect(ck.getNumErrors()).toBe(0);
});

it("ConstraintSetLines", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(1, 0, 0.5);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(4, 6, 1);
    const lineL = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(1, 1, 1, 0.2);

    let x0 = 0;
    const xStep = 40;

    for (const constraintPair of [
        [ConstructionConstraint.createTangentTo(circleA), ConstructionConstraint.createTangentTo(circleB)],
        [ConstructionConstraint.createPerpendicularTo(circleA), ConstructionConstraint.createTangentTo(circleB)],
        [ConstructionConstraint.createTangentTo(circleA), ConstructionConstraint.createPerpendicularTo(circleB)],
        [ConstructionConstraint.createPerpendicularTo(circleA), ConstructionConstraint.createPerpendicularTo(circleB)],
        [ConstructionConstraint.createPerpendicularTo(lineL), ConstructionConstraint.createPerpendicularTo(circleB)],
        [ConstructionConstraint.createPerpendicularTo(lineL), ConstructionConstraint.createTangentTo(circleB)],
    ]) {
        const y0 = 0;
        const constraintSet = ConstraintSet.create();
        const curvesToDisplay: ImplicitCurve2d[] = [];
        for (const c of constraintPair) {
            constraintSet.addConstraint(c);
            transferCurve(c, curvesToDisplay);
        }
        const constraintSetReversed = ConstraintSet.create();
        constraintSetReversed.addConstraint(constraintPair[0]);
        constraintSetReversed.addConstraint(constraintPair[1]);

        const result = constraintSet.constructConstrainedLines();
        const resultReversed = constraintSetReversed.constructConstrainedLines();

        ImplicitGeometryHelpers.outputLineMarkup(ck, allGeometry, x0, y0,
            result, curvesToDisplay, 0);

        ck.testExactNumber(
            result !== undefined ? result.length : 0,
            resultReversed !== undefined ? resultReversed.length : 0,
            "Match counts with reversed constraints", constraintPair);
        x0 += xStep;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "ConstraintSetLines");
    expect(ck.getNumErrors()).toBe(0);
});

it("radiansToParabola", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const curve = UnboundedParabola2d.createCenterAndAxisVectors(
        Point2d.create(0, 0), Vector2d.create(1, 0), Vector2d.create(0, 1));

    const pointsB = [];
    const arcPoints = [];
    const radiansLimit = Math.PI - 0.4
    const n = 65;
    for (let i = 0; i <= n; i++) {
        const theta = Geometry.interpolate(-radiansLimit, i / n, radiansLimit);
        const c = Math.cos(theta);
        const s = Math.sin(theta);

        // console.log ({c,s,x,y,q});
        pointsB.push(curve.radiansToPoint2d(theta)!);
        arcPoints.push(Point3d.create(c, s));

    }
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, arcPoints, 0, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsB, 0, 0);


    const x0 = 0;
    const y0 = 0;
    for (const xy of [
        Point2d.create(3, 5),
        Point2d.create(13, 0.1),
        curve.radiansToPoint2d(0)!,
        curve.radiansToPoint2d(0.25)!,
        Point2d.create(4, 5),
        Point2d.create(8, 5),
        Point2d.create(8, -1),
        Point2d.create(2, 0.01)]) {
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, xy, 0.05, x0, y0);
        curve.emitPerpendiculars(xy,
            (curvePoint: Point2d, _radians: number | undefined) => {
                GeometryCoreTestIO.captureCloneGeometry(allGeometry,
                    LineSegment3d.createXYXY(xy.x, xy.y, curvePoint.x, curvePoint.y), x0, 0);
                // GeometryCoreTestIO.consoleLog({onCurve: curvePoint.toJSON()});
                ck.testCoordinate(0, curve.functionValue(curvePoint), "point projects to parabola");
                const gradF = curve.gradient(curvePoint);
                GeometryCoreTestIO.captureCloneGeometry(allGeometry,
                    [Point3d.createFrom(curvePoint), Point3d.createFrom(curvePoint.plusScaled(gradF, 0.2))],
                    x0, y0);
                const vectorW = Vector2d.createStartEnd(xy, curvePoint);
                const cross = gradF.crossProduct(vectorW);
                // GeometryCoreTestIO.consoleLog ({cross, curvePoint, xy, vectorW, gradF});
                ck.testCoordinate(0, cross, "point to curve is perpendicular");
            }
        );
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "radiansToParabola");
    expect(ck.getNumErrors()).toBe(0);
});
