/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Arc3d } from "../../curve/Arc3d";
import { ConstrainedCurve2d } from "../../curve/ConstrainedCurve2d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { ImplicitCurve2dConverter } from "../../curve/internalContexts/geometry2d/ImplicitCurve2dConverter";
import { UnboundedLine2dByPointAndNormal } from "../../curve/internalContexts/geometry2d/UnboundedLine2d";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/** Create a circular Arc3d in the XY plane centered at (cx, cy) with the given radius. */
function mkCircle(cx: number, cy: number, radius: number): Arc3d {
  return Arc3d.createXY(Point3d.create(cx, cy), radius);
}

/** Create an elliptical (non-circular) Arc3d in the XY plane. */
function mkEllipse(cx: number, cy: number, radiusA: number, radiusB: number): Arc3d {
  return Arc3d.createXYEllipse(Point3d.create(cx, cy), radiusA, radiusB);
}

/** Create a LineSegment3d representing the infinite line through two XY points. */
function mkLine(x0: number, y0: number, x1: number, y1: number): LineSegment3d {
  return LineSegment3d.createXYXY(x0, y0, x1, y1);
}

/** Convert LineSegment3d back to its implicit line. */
function toIL(seg: LineSegment3d): UnboundedLine2dByPointAndNormal | undefined {
  const l = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(seg);
  return l instanceof UnboundedLine2dByPointAndNormal ? l : undefined;
}

/** XY distance from a circle's center to the infinite line defined by a LineSegment3d. */
function centerToLineDist(arc: Arc3d, seg: LineSegment3d): number | undefined {
  const il = toIL(seg);
  if (!il)
    return undefined;
  const center = Point2d.createFrom(arc.center);
  return il.closestPoint(center)?.distance(center);
}

/** Assert that `result` circle is tangent to `input` circle (ext. or int. tangency). */
function checkTangentCC(ck: Checker, result: Arc3d, input: Arc3d, label: string): void {
  let rRadius = result.circularRadius();
  let iRadius = input.circularRadius();
  if (rRadius === undefined)
    rRadius = 0;
  if (iRadius === undefined)
    iRadius = 0;
  const d = result.center.distance(input.center);
  const ext = Math.abs(d - (Math.abs(rRadius) + Math.abs(iRadius)));
  const int = Math.abs(d - Math.abs(Math.abs(rRadius) - Math.abs(iRadius)));
  ck.testTrue(ext < 1e-8 || int < 1e-8, `${label}: circle-circle tangency`);
}

/** Assert that `result` circle is tangent to `input` line. */
function checkTangentCL(ck: Checker, result: Arc3d, input: LineSegment3d, label: string): void {
  const radius = result.circularRadius();
  const d = centerToLineDist(result, input);
  if (radius === undefined || d === undefined) {
    ck.announceError(`${label}: could not compute dist`);
    return;
  }
  ck.testCoordinate(Math.abs(radius), d, `${label}: circle-line tangency`);
}

/** Assert that `result` circle has the expected radius. */
function checkRadius(ck: Checker, result: Arc3d, expectedRadius: number, label: string): void {
  const radius = result.circularRadius();
  if (radius === undefined) {
    ck.announceError(`${label}: not a circle`);
    return;
  }
  ck.testCoordinate(expectedRadius, Math.abs(radius), `${label}: radius`);
}

/** Capture circle geometry, or a point marker if the arc is degenerate. */
function captureCircleOrPoint(
  allGeometry: GeometryQuery[],
  circle: Arc3d,
  x0 = 0,
  y0 = 0,
): void {
  if (circle.circularRadius() !== undefined)
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0, y0);
  else
    GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 3, circle.center, 0.1, x0, y0);
}

/** Assert that the result line passes through the center of `circ` (distance ≈ 0). */
function checkLineThroughCenter(ck: Checker, result: LineSegment3d, circ: Arc3d, label: string): void {
  const d = centerToLineDist(circ, result);
  if (d !== undefined)
    ck.testCoordinate(0, d, `${label}: line passes through circle center`);
}

/** Assert that the result line is tangent to `circ` (center distance ≈ radius). */
function checkLineTangentToCircle(ck: Checker, result: LineSegment3d, circ: Arc3d, label: string): void {
  const radius = circ.circularRadius();
  const d = centerToLineDist(circ, result);
  if (radius !== undefined && d !== undefined)
    ck.testCoordinate(Math.abs(radius), d, `${label}: line tangent to circle`);
}

/** Assert that two LineSegment3ds are perpendicular to each other. */
function checkPerpendicular(ck: Checker, a: LineSegment3d, b: LineSegment3d, label: string): void {
  const ia = toIL(a);
  const ib = toIL(b);
  if (!ia || !ib)
    return;
  const nA = ia.unitNormal();
  const nB = ib.unitNormal();
  if (nA && nB)
    ck.testCoordinate(0, Math.abs(nA.dotProduct(nB)), `${label}: perpendicular lines`);
}

describe("ConstrainedCurve2d", () => {
  it("CirclesTangentLLL", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const axisX = mkLine(-10, 0, 10, 0);
    const axisY = mkLine(0, -10, 0, 10);
    const lineY1 = mkLine(-10, 1, 10, 1);
    const lineDiag = mkLine(-8, 10, 10, -8);
    const lineQ = mkLine(10, -10.25, -10, 14.75);
    const lineR = mkLine(10, 9, -10, -16);

    const expectedCircleCounts = [2, 4, 4, 4];
    let x0 = 0;
    let i = 0;
    for (const [lA, lB, lC] of [
      [axisX, axisY, lineY1],
      [axisX, axisY, lineDiag],
      [lineY1, axisY, lineDiag],
      [lineDiag, lineQ, lineR],
    ]) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, lA, x0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, lB, x0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, lC, x0);
      const results = ConstrainedCurve2d.circlesTangentLineLineLine(lA, lB, lC);
      if (ck.testDefined(results, "circlesTangentLLL returns results")) {
        ck.testExactNumber(expectedCircleCounts[i], results.length, `expect ${expectedCircleCounts[i]} results`);
        for (const result of results) {
          const circle = result.curve;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0);
          expect(circle.isCircular).toBe(true);
          checkTangentCL(ck, circle, lA, "tangent to lineA");
          checkTangentCL(ck, circle, lB, "tangent to lineB");
          checkTangentCL(ck, circle, lC, "tangent to lineC");
        }
      }
      i++;
      x0 += 30;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentLLL");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LinesTangentCC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(5, 0, 1);
    const circleC = mkCircle(4, 1, 3);
    const circleD = mkCircle(0, 5, 2);
    const allCirclePairs = [
      [circleA, circleB],
      [circleA, circleC],
      [circleC, circleD],
      [circleA, circleC],
      [circleB, circleC],
    ];
    const e = Math.sqrt(2);
    for (const x1 of [3, 4, 8]) {
      const circleE0 = mkCircle(0, 0, e);
      const circleE1 = mkCircle(x1, 0, e);
      const pointAsCircle = mkCircle(4, 6, 0);
      allCirclePairs.push([circleE0, circleE1]);
      allCirclePairs.push([circleB, pointAsCircle]);
    }

    const expectedLineCounts = [4, 2, 4, 2, 0, 4, 4, 4, 4, 4, 4];
    let x0 = 0;
    let i = 0;
    for (const circles of allCirclePairs) {
      for (const c of circles)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, c, x0);
      const results = ConstrainedCurve2d.linesTangentCircleCircle(circles[0], circles[1]);
      if (expectedLineCounts[i] !== 0)
        ck.testDefined(results, `linesTangentCC case ${i} returns lines`);
      else
        ck.testUndefined(results, `linesTangentCC case ${i} returns no lines`);
      if (results !== undefined) {
        ck.testExactNumber(expectedLineCounts[i], results.length, `expect ${expectedLineCounts[i]} result`);
        for (const result of results) {
          const ray = result.curve;
          const line = LineSegment3d.create(ray.origin, ray.origin.plusScaled(ray.direction, 1));
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, line, x0);
          checkLineTangentToCircle(ck, line, circles[0], "tangent to circle0");
          checkLineTangentToCircle(ck, line, circles[1], "tangent to circle1");
        }
      }
      x0 += 20;
      i++;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "LinesTangentCC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LinesPerpLTangentC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const lineM = mkLine(10, -13, -10, 27);
    const lineN = mkLine(10, 18.5, -10, -31.5);
    const lineP = mkLine(10, -6.2, -10, 5.8);
    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(0, 5, 2);

    let x0 = 0;
    for (const circle of [circleA, circleB]) {
      for (const line of [lineM, lineN, lineP]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, line, x0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0);
        const results = ConstrainedCurve2d.linesPerpLineTangentCircle(line, circle);
        ck.testDefined(results, `linesPerpLTangentC returns results for line-circle pair`);
        ck.testExactNumber(2, results!.length, `expect 2 result lines for each line-circle pair`);
        for (const result of results!) {
          const ray = result.curve;
          const l = LineSegment3d.create(ray.origin, ray.origin.plusScaled(ray.direction, 1));
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, l, x0);
          checkPerpendicular(ck, l, line, "result perp to input line");
          checkLineTangentToCircle(ck, l, circle, "result tangent to circle");
        }
        x0 += 40;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "LinesPerpLTangentC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LinesPerpLPerpC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const lineM = mkLine(10, -13, -10, 27);
    const lineN = mkLine(10, 18.5, -10, -31.5);
    const lineP = mkLine(10, -6.2, -10, 5.8);
    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(0, 5, 2);

    let x0 = 0;
    for (const circle of [circleA, circleB]) {
      for (const line of [lineM, lineN, lineP]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, line, x0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0);
        const results = ConstrainedCurve2d.linesPerpLinePerpCircle(line, circle);
        ck.testDefined(results, `linesPerpLPerpC returns results for line-circle pair`);
        ck.testExactNumber(2, results!.length, `expect 2 result lines for each line-circle pair`);
        for (const result of results!) {
          const ray = result.curve;
          const l = LineSegment3d.create(ray.origin, ray.origin.plusScaled(ray.direction, 1));
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, l, x0);
          checkPerpendicular(ck, l, line, "result perp to input line");
          checkLineThroughCenter(ck, l, circle, "result passes through circle center");
        }
        x0 += 40;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "LinesPerpLPerpC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentCCL", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(3, 5, 2);
    const circleC = mkCircle(3, 5, 6);
    const lineP = mkLine(-30, -14.5, 30, 15.5);
    const axisX = mkLine(-30, 0, 30, 0);

    const expectedCircleCounts = [4, 8, 4];
    let x0 = 0;
    let i = 0;
    for (const [cA, cB, l] of [
      [circleA, circleB, lineP],
      [circleA, circleC, lineP],
      [circleA, circleB, axisX],
    ] as [Arc3d, Arc3d, LineSegment3d][]) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cA, x0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cB, x0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, l, x0);
      const results = ConstrainedCurve2d.circlesTangentCircleCircleLine(cA, cB, l);
      ck.testDefined(results, `circlesTangentCCL returns results for circle-circle-line triplet`);
      ck.testExactNumber(expectedCircleCounts[i], results!.length, `expect ${expectedCircleCounts[i]} results`);
      for (const result of results!) {
        const circle = result.curve;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0);
        expect(circle.isCircular).toBe(true);
        checkTangentCC(ck, circle, cA, "tangent to circleA");
        checkTangentCC(ck, circle, cB, "tangent to circleB");
        checkTangentCL(ck, circle, l, "tangent to line");
      }
      x0 += 200;
      i++;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentCCL");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentLLC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const point = mkCircle(3, 4, 0);
    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(3, 3, 2);
    const axisX = mkLine(-20, 0, 20, 0);
    const axisX4 = mkLine(-10, -14, 10, 16);
    const axisY = mkLine(0, -10, 0, 10);
    const line1 = mkLine(-20, 42, 20, -38);
    const line2 = mkLine(-20, -5, 20, 10);

    const allCircles = [point, circleA, circleB];
    const allLinePairs = [
      [axisX, axisY],
      [axisX, axisX4],
      [axisY, line1],
      [line2, axisX],
      [line1, line2],
    ];

    const expectedCircleCounts = [2, 2, 2, 2, 2, 8, 8, 0, 4, 4, 4, 4, 4, 4, 4];
    let x0 = 0;
    let y0 = 0;
    let i = 0;
    for (const circle of allCircles) {
      y0 = 0;
      for (const lines of allLinePairs) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, lines[0], x0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, lines[1], x0);
        captureCircleOrPoint(allGeometry, circle, x0, y0);
        const results = ConstrainedCurve2d.circlesTangentLineLineCircle(lines[0], lines[1], circle);
        if (results !== undefined) {
          ck.testExactNumber(expectedCircleCounts[i], results.length, `expect ${expectedCircleCounts[i]} results`);
          for (const result of results) {
            const c = result.curve;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, c, x0);
            expect(c.isCircular).toBe(true);
            checkTangentCL(ck, c, lines[0], "tangent to lineA");
            checkTangentCL(ck, c, lines[1], "tangent to lineB");
            checkTangentCC(ck, c, circle, "tangent to circle");
          }
        }
        x0 += 300;
        i++;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentLLC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentCCC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const cA = mkCircle(0, 0, 1);
    const cB = mkCircle(5, 0, 2);
    const cC = mkCircle(0, 5, 3);
    const cD = mkCircle(1, 5, 1);
    const cE = mkCircle(-4, 2, 2);
    const cF = mkCircle(3, -2, 3);
    // 3 points (zero-radius circles)
    const cP0 = mkCircle(1, 5, 0);
    const cP1 = mkCircle(8, 5, 0);
    const cP2 = mkCircle(4, -2, 0);

    const expectedCircleCounts = [7, 8, 1, 4];
    let x0 = 0;
    let y0 = 0;
    let i = 0;
    for (const [c0, c1, c2] of [
      [cA, cB, cC],
      [cD, cE, cF],
      [cP0, cP1, cP2],
      [cP0, cA, cB],

    ]) {
      const results = ConstrainedCurve2d.circlesTangentCircleCircleCircle(c0, c1, c2);
      ck.testDefined(results, `circlesTangentCCC returns results for circle-circle-circle triplet`);
      ck.testExactNumber(expectedCircleCounts[i], results!.length, `expect ${expectedCircleCounts[i]} results`);
      for (const result of results!) {
        const circle = result.curve;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0, y0);
        expect(circle.isCircular).toBe(true);
        captureCircleOrPoint(allGeometry, c0, x0, y0);
        captureCircleOrPoint(allGeometry, c1, x0, y0);
        captureCircleOrPoint(allGeometry, c2, x0, y0);
        checkTangentCC(ck, circle, c0, "tangent to circle0");
        checkTangentCC(ck, circle, c1, "tangent to circle1");
        checkTangentCC(ck, circle, c2, "tangent to circle2");
        y0 += 30;
      }
      y0 = 0;
      x0 += 50;
      i++;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentCCC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentLLR", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const axisX = mkLine(-50, 0, 50, 0);
    const axisY = mkLine(0, -50, 0, 50);
    const axisX10 = mkLine(-50, 10, 50, 10);
    const line1 = mkLine(-50, -10, 50, 10);
    const line2 = mkLine(-50, 30, 50, -30);
    const allLines = [axisX, axisY, axisX10, line1, line2];

    let x0 = 0;
    let y0 = 0;
    for (let i = 0; i < allLines.length; i++) {
      for (let j = i + 1; j < allLines.length; j++) {
        y0 = 0;
        for (const radius of [1, 5]) {
          const results = ConstrainedCurve2d.circlesTangentLineLineRadius(allLines[i], allLines[j], radius);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, allLines[i], x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, allLines[j], x0, y0);
          if (results !== undefined) {
            ck.testExactNumber(4, results.length, "expect 4 circles for non-parallel lines");
            for (const result of results) {
              const circle = result.curve;
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0, y0);
              expect(circle.isCircular).toBe(true);
              checkRadius(ck, circle, radius, "correct radius");
              checkTangentCL(ck, circle, allLines[i], "tangent to lineA");
              checkTangentCL(ck, circle, allLines[j], "tangent to lineB");
            }
          }
          y0 += 200;
        }
        x0 += 250;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentLLR");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentCLR", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 1);
    const circleB = mkCircle(2, 3, 1);
    const circleC = mkCircle(2, -1, 4);
    const axisX = mkLine(-10, 0, 10, 0);
    const axisY = mkLine(0, -10, 0, 10);
    const line1 = mkLine(3, -8, -1, 8);
    const allLines = [axisX, axisY, line1];
    const allCircles = [circleA, circleB, circleC];

    const expectedCircleCounts = [4, 4, 4, 4, 4, 4, 1, 3, 2, 4, 2, 4, 8, 6, 7, 6, 8, 6];
    let x0 = 0;
    let i = 0;
    for (const circ of allCircles) {
      let y0 = 0;
      for (const l of allLines) {
        for (const radius of [1, 2]) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, circ, x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, l, x0, y0);
          const results = ConstrainedCurve2d.circlesTangentCircleLineRadius(circ, l, radius);
          ck.testDefined(results, `circlesTangentCLR returns results for circle-line-radius triplet`);
          ck.testExactNumber(expectedCircleCounts[i], results!.length, `expect ${expectedCircleCounts[i]} result circles`);
          for (const result of results!) {
            const circle = result.curve;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0, y0);
            expect(circle.isCircular).toBe(true);
            checkRadius(ck, circle, radius, "correct radius");
            checkTangentCC(ck, circle, circ, "tangent to input circle");
            checkTangentCL(ck, circle, l, "tangent to input line");
          }
          y0 += 50;
          i++;
        }
      }
      x0 += 100;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentCLR");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentCCR", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 1);
    const circleB = mkCircle(2, 3, 1);
    const circleC = mkCircle(2, -1, 0.2);
    const circleD = mkCircle(2, -1, 4);
    const allCircles = [circleA, circleB, circleC, circleD];

    const expectedCircleCounts = [2, 8, 4, 8, 2, 0, 0, 8, 4, 4, 0, 0];
    let x0 = 0;
    let k = 0;
    for (let i = 0; i < allCircles.length; i++) {
      let y0 = 0;
      for (let j = i + 1; j < allCircles.length; j++) {
        for (const radius of [1, 6]) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, allCircles[i], x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, allCircles[j], x0, y0);
          const results = ConstrainedCurve2d.circlesTangentCircleCircleRadius(allCircles[i], allCircles[j], radius);
          if (results !== undefined) {
            ck.testExactNumber(expectedCircleCounts[k], results.length, `expect ${expectedCircleCounts[k]} result circles`);
            for (const result of results) {
              const circle = result.curve;
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0, y0);
              expect(circle.isCircular).toBe(true);
              checkRadius(ck, circle, radius, "correct radius");
              checkTangentCC(ck, circle, allCircles[i], "tangent to circleA");
              checkTangentCC(ck, circle, allCircles[j], "tangent to circleB");
            }
          }
          y0 += 50;
          k++;
        }
      }
      x0 += 50;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentCCR");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LinesPerpCPerpC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(4, 0, 1);
    const circleC = mkCircle(0, 3, 1.5);
    const circleD = mkCircle(3, 4, 2);

    let x0 = 0;
    for (const [cA, cB] of [
      [circleA, circleB],
      [circleA, circleC],
      [circleC, circleD],
    ]) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cA, x0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cB, x0);
      const results = ConstrainedCurve2d.linesPerpCirclePerpCircle(cA, cB);
      if (ck.testDefined(results, "linesPerpCPerpC returns results")) {
        ck.testExactNumber(4, results.length, "expect 4 result lines");
        for (const result of results) {
          const ray = result.curve;
          const line = LineSegment3d.create(ray.origin, ray.origin.plusScaled(ray.direction, 1));
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, line, x0);
          checkLineThroughCenter(ck, line, cA, "line passes through circleA center");
          checkLineThroughCenter(ck, line, cB, "line passes through circleB center");
        }
      }
      x0 += 20;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "LinesPerpCPerpC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LinesPerpCTangentC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(5, 0, 1);
    const circleC = mkCircle(3, 3, 2);
    const circleD = mkCircle(0, 4, 1.5);

    let x0 = 0;
    for (const [cA, cB] of [
      [circleA, circleB],
      [circleA, circleC],
      [circleC, circleD],
    ]) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cA, x0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cB, x0);
      const results = ConstrainedCurve2d.linesPerpCircleTangentCircle(cA, cB);
      if (ck.testDefined(results, "linesPerpCTangentC returns results")) {
        ck.testExactNumber(4, results.length, "expect 4 result lines");
        for (const result of results) {
          const ray = result.curve;
          const line = LineSegment3d.create(ray.origin, ray.origin.plusScaled(ray.direction, 1));
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, line, x0);
          checkLineThroughCenter(ck, line, cA, "line passes through circleA center");
          checkLineTangentToCircle(ck, line, cB, "line tangent to circleB");
        }
      }
      x0 += 20;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "LinesPerpCTangentC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("RejectsNonCircularArcInputs", () => {
    const ck = new Checker(true, true);
    const circle = mkCircle(0, 0, 2);
    const point = mkCircle(3, 4, 0);
    const ellipse = mkEllipse(1, 2, 3, 1);
    const line = mkLine(-10, 0, 10, 0);

    ck.testFalse(ellipse.isCircular, "ellipse is not circular");
    ck.testDefined(ConstrainedCurve2d.linesTangentCircleCircle(circle, point), "linesTangentCC accepts point as zero-radius circle");
    ck.testUndefined(ConstrainedCurve2d.linesTangentCircleCircle(ellipse, point), "linesTangentCC rejects ellipse");
    ck.testUndefined(ConstrainedCurve2d.linesPerpLineTangentCircle(line, ellipse), "linesPerpLineTangentCircle rejects ellipse");
    ck.testUndefined(ConstrainedCurve2d.circlesTangentLineLineCircle(line, mkLine(0, -10, 0, 10), ellipse), "circlesTangentLineLineCircle rejects ellipse");
    ck.testUndefined(ConstrainedCurve2d.circlesTangentCircleCircleRadius(circle, ellipse, 1), "circlesTangentCircleCircleRadius rejects ellipse");

    expect(ck.getNumErrors()).toBe(0);
  });
});
