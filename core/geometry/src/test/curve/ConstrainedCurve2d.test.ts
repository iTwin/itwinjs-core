/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Arc3d } from "../../curve/Arc3d";
import { ConstrainedCurve2d } from "../../curve/ConstrainedCurve2d";
import { CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
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

/**
 * Check curve input order is preserved in output array and also check each returned pair has
 * `detailA.curve === input curve` and `detailB.curve === output curve` (not a copy of the curves,
 * the pointers should be the same.)
 */
function checkCurves(
  results: { curve: Arc3d | LineSegment3d, details: CurveLocationDetailPair[] }[],
  constraints: (Arc3d | LineSegment3d)[]
): boolean {
  for (const result of results) {
    for (let i = 0; i < result.details.length; i++) {
      if (result.details[i].detailA.curve !== constraints[i])
        return false;
      if (result.details[i].detailB.curve !== result.curve)
        return false;
    }
  }
  return true;
}


/** Assert that each entry in `data` matches the expected [x, y] coordinate pair (checked against detailA.point). */
function checkDataPoints(ck: Checker, data: CurveLocationDetailPair[], expected: [number, number][], label: string): void {
  ck.testExactNumber(expected.length, data.length, `${label}: data count`);
  for (let k = 0; k < expected.length && k < data.length; k++) {
    ck.testCoordinate(expected[k][0], data[k].detailA.point.x, `${label} data[${k}].x`);
    ck.testCoordinate(expected[k][1], data[k].detailA.point.y, `${label} data[${k}].y`);
  }
}

describe("ConstrainedCurve2d", () => {
  it("CirclesTangentLLL", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const axisX = mkLine(-10, 0, 10, 0);
    const axisY = mkLine(0, -10, 0, 10);
    const lineY1 = mkLine(-10, 1, 10, 1);
    const lineDiag = mkLine(-8, 10, 10, -8);
    const lineQ = mkLine(10, -10.25, -10, 14.75);
    const lineR = mkLine(10, 9, -10, -16);

    const expectedData: [number, number][][][] = [
      [
        [[0.5, 0], [0, 0.5], [0.5, 1]],
        [[-0.5, 0], [0, 0.5], [-0.5, 1]]
      ],
      [
        [[0.5857864376, 0], [0, 0.5857864376], [1, 1]],
        [[3.4142135624, 0], [0, 3.4142135624], [1, 1]],
        [[-1.4142135624, 0], [0, 1.4142135624], [-0.4142135624, 2.4142135624]],
        [[1.4142135624, 0], [0, -1.4142135624], [2.4142135624, -0.4142135624]]
      ],
      [
        [[0.2928932188, 1], [0, 1.2928932188], [0.5, 1.5]],
        [[1.7071067812, 1], [0, 2.7071067812], [0.5, 1.5]],
        [[-0.7071067812, 1], [0, 1.7071067812], [-0.2071067812, 2.2071067812]],
        [[0.7071067812, 1], [0, 0.2928932188], [1.2071067812, 0.7928932188]]
      ],
      [
        [[1.0682221845, 0.9317778155], [0.9397289605, 1.0753387994], [3.6602710395, 1.0753387994]],
        [[0.904722175, 1.095277825], [1.0841734049, 0.8947832439], [1.0841734049, -2.1447832439]],
        [[2.5397222694, -0.5397222694], [2.3602710395, -0.7003387994], [2.3602710395, -0.5496612006]],
        [[2.37622226, -0.37622226], [2.2158265951, -0.5197832439], [2.3841734049, -0.5197832439]]
      ],
    ];
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
        ck.testTrue(checkCurves(results, [lA, lB, lC]));
        expectedData[i].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `LLL[${i}] circle[${k}]`));
      }
      i++;
      x0 += 30;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentLLL");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LinesTangentCC", () => {
    const ck = new Checker();
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
    const expectedData: [number, number][][][] = [
      [
        [[0.4, -1.9595917942], [5.2, -0.9797958971]],
        [[0.4, 1.9595917942], [5.2, 0.9797958971]],
        [[1.2, -1.6], [4.4, 0.8]],
        [[1.2, 1.6], [4.4, -0.8]]
      ],
      [
        [[0, -2], [4, -2]],
        [[-0.9411764706, 1.7647058824], [2.5882352941, 3.6470588235]]
      ],
      [
        [[5.7129116361, 3.4629116361], [1.1419410907, 6.6419410907]],
        [[1.5370883639, -0.7129116361], [-1.6419410907, 3.8580589093]],
        [[3.1171567416, 3.8671567416], [0.5885621722, 3.0885621722]],
        [[1.1328432584, 1.8828432584], [1.9114378278, 4.4114378278]]
      ],
      [
        [[0, -2], [4, -2]],
        [[-0.9411764706, 1.7647058824], [2.5882352941, 3.6470588235]]
      ],
      [],
      [
        [[0, -1.4142135624], [3, -1.4142135624]],
        [[0, 1.4142135624], [3, 1.4142135624]],
        [[1.3333333333, -0.4714045208], [1.6666666667, 0.4714045208]],
        [[1.3333333333, 0.4714045208], [1.6666666667, -0.4714045208]]
      ],
      [
        [[5.9459459459, 0.3243243243], [4, 6]],
        [[4, 0], [4, 6]],
        [[5.9459459459, 0.3243243243], [4, 6]],
        [[4, 0], [4, 6]]
      ],
      [
        [[0, -1.4142135624], [4, -1.4142135624]],
        [[0, 1.4142135624], [4, 1.4142135624]],
        [[1, -1], [3, 1]],
        [[1, 1], [3, -1]]
      ],
      [
        [[5.9459459459, 0.3243243243], [4, 6]],
        [[4, 0], [4, 6]],
        [[5.9459459459, 0.3243243243], [4, 6]],
        [[4, 0], [4, 6]]
      ],
      [
        [[0, -1.4142135624], [8, -1.4142135624]],
        [[0, 1.4142135624], [8, 1.4142135624]],
        [[0.5, -1.3228756555], [7.5, 1.3228756555]],
        [[0.5, 1.3228756555], [7.5, -1.3228756555]]
      ],
      [
        [[5.9459459459, 0.3243243243], [4, 6]],
        [[4, 0], [4, 6]],
        [[5.9459459459, 0.3243243243], [4, 6]],
        [[4, 0], [4, 6]]
      ],
    ];
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
          const line = result.curve;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, line, x0);
          checkLineTangentToCircle(ck, line, circles[0], "tangent to circle0");
          checkLineTangentToCircle(ck, line, circles[1], "tangent to circle1");
        }
        ck.testTrue(checkCurves(results, [circles[0], circles[1]]));
        expectedData[i].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `TCC[${i}] line[${k}]`));
      }
      x0 += 20;
      i++;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "LinesTangentCC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LinesPerpLTangentC", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const lineM = mkLine(10, -13, -10, 27);
    const lineN = mkLine(10, 18.5, -10, -31.5);
    const lineP = mkLine(10, -6.2, -10, 5.8);
    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(0, 5, 2);

    const expectedData: [number, number][][][] = [
      [
        [[1.905572809, 3.188854382], [-0.894427191, 1.788854382]],
        [[3.694427191, -0.388854382], [0.894427191, -1.788854382]]
      ],
      [
        [[1.4985979576, -2.7535051059], [-0.7427813527, -1.8569533818]],
        [[2.9841606631, 0.9604016576], [0.7427813527, 1.8569533818]]
      ],
      [
        [[-1.8032211455, 0.8819326873], [-1.7149858514, 1.0289915109]],
        [[1.6267505573, -1.1760503344], [1.7149858514, -1.0289915109]]
      ],
      [
        [[-0.094427191, 7.188854382], [-0.894427191, 6.788854382]],
        [[1.694427191, 3.611145618], [0.894427191, 3.211145618]]
      ],
      [
        [[3.2227358887, 1.5568397217], [-0.7427813527, 3.1430466182]],
        [[4.7082985941, 5.2707464852], [0.7427813527, 6.8569533818]]
      ],
      [
        [[-4.0091034985, 2.2054620991], [-1.7149858514, 6.0289915109]],
        [[-0.5791317956, 0.1474790774], [1.7149858514, 3.9710084891]]
      ],
    ];
    let caseIdx = 0;
    let x0 = 0;
    for (const circle of [circleA, circleB]) {
      for (const line of [lineM, lineN, lineP]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, line, x0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0);
        const results = ConstrainedCurve2d.linesPerpLineTangentCircle(line, circle);
        ck.testDefined(results, `linesPerpLTangentC returns results for line-circle pair`);
        ck.testExactNumber(2, results!.length, `expect 2 result lines for each line-circle pair`);
        for (const result of results!) {
          const l = result.curve;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, l, x0);
          checkPerpendicular(ck, l, line, "result perp to input line");
          checkLineTangentToCircle(ck, l, circle, "result tangent to circle");
        }
        if (results !== undefined) {
          ck.testTrue(checkCurves(results, [line, circle]));
          expectedData[caseIdx].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `PLTC[${caseIdx}] line[${k}]`));
        }
        caseIdx++;
        x0 += 40;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "LinesPerpLTangentC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LinesPerpLPerpC", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const lineM = mkLine(10, -13, -10, 27);
    const lineN = mkLine(10, 18.5, -10, -31.5);
    const lineP = mkLine(10, -6.2, -10, 5.8);
    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(0, 5, 2);

    // data[0]=foot of perpendicular from circle center to line (same for both result lines), data[1]=circle crossing points, per test case
    const plpcExpected: [number, number][][][] = [
      [[[2.8, 1.4], [1.788854382, 0.894427191]], [[2.8, 1.4], [-1.788854382, -0.894427191]]],
      [[[2.2413793103, -0.8965517241], [-1.8569533818, 0.7427813527]], [[2.2413793103, -0.8965517241], [1.8569533818, -0.7427813527]]],
      [[[-0.0882352941, -0.1470588235], [1.0289915109, 1.7149858514]], [[-0.0882352941, -0.1470588235], [-1.0289915109, -1.7149858514]]],
      [[[0.8, 5.4], [1.788854382, 5.894427191]], [[0.8, 5.4], [-1.788854382, 4.105572809]]],
      [[[3.9655172414, 3.4137931034], [-1.8569533818, 5.7427813527]], [[3.9655172414, 3.4137931034], [1.8569533818, 4.2572186473]]],
      [[[-2.2941176471, 1.1764705882], [1.0289915109, 6.7149858514]], [[-2.2941176471, 1.1764705882], [-1.0289915109, 3.2850141486]]],
    ];
    let caseIdx2 = 0;
    let x0 = 0;
    for (const circle of [circleA, circleB]) {
      for (const line of [lineM, lineN, lineP]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, line, x0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0);
        const results = ConstrainedCurve2d.linesPerpLinePerpCircle(line, circle);
        ck.testDefined(results, `linesPerpLPerpC returns results for line-circle pair`);
        ck.testExactNumber(2, results!.length, `expect 2 result lines for each line-circle pair`);
        for (const result of results!) {
          const l = result.curve;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, l, x0);
          checkPerpendicular(ck, l, line, "result perp to input line");
          checkLineThroughCenter(ck, l, circle, "result passes through circle center");
        }
        if (results !== undefined) {
          ck.testTrue(checkCurves(results, [line, circle]));
          plpcExpected[caseIdx2].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `PLPC[${caseIdx2}] line[${k}]`));
        }
        caseIdx2++;
        x0 += 40;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "LinesPerpLPerpC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentCCL", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(3, 5, 2);
    const circleC = mkCircle(3, 5, 6);
    const lineP = mkLine(-30, -14.5, 30, 15.5);
    const axisX = mkLine(-30, 0, 30, 0);

    // tangent points on each of the 3 input constraints (circleA, circleB, line), per result circle, per test case
    const cclExpected: [number, number][][][] = [
      [[[0.6287463538, 1.8985989631], [4.9981797956, 4.9146917096], [3.1622798625, 2.0811399312]], [[-0.4748749995, 1.9428056349], [3.6106123119, 3.0954915058], [12.1530098801, 6.5765049401]], [[-1.5337040233, 1.2836479147], [1.1456264173, 5.749198649], [-6.875133624, -2.937566812]], [[1.1603529543, 1.6289815903], [2.1087117517, 3.2095795861], [2.1101627091, 1.5550813546]]],
      [[[0.5675072453, -1.9177944432], [4.5498641431, -0.7963713768], [-25.0174350633, -12.0087175316]], [[-0.8119556146, 1.8277658712], [-1.0162934262, 0.5424909294], [-0.1500864733, 0.4249567633]], [[-1.9585100368, 0.405263415], [-1.1426849311, 0.6597048992], [-1.2615302438, -0.1307651219]], [[1.9761252611, 0.3081054245], [3.6350928804, -0.9662934082], [2.7963479957, 1.8981739979]], [[-1.2356236825, -1.5726519371], [-0.1877894134, -0.0831091524], [-1.0800609633, -0.0400304817]], [[0.508355238, 1.9343151119], [-1.8307956051, 8.5585690694], [3.4862026209, 2.2431013105]], [[-1.9530204332, 0.4309422091], [-2.1953182567, 1.9985556458], [-3.1123312901, -1.056165645]], [[1.9812316417, 0.273351755], [0.8723145302, -0.6100761618], [0.795981859, 0.8979909295]]],
      [[[-0.4808755268, 1.9413291137], [3.6043389585, 3.0934915622], [-16.3923048454, 0]], [[1.5085833353, 1.3130789467], [1.4725841184, 6.2911238224], [4.3923048454, 0]], [[-1.2733868083, 1.5422341056], [1.03996435, 5.3978193695], [-5.5634848459, 0]], [[1.8067201417, 0.8577658944], [3.0933689833, 3.0021806305], [3.1634848459, 0]]],
    ];
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
      if (results !== undefined) {
        ck.testTrue(checkCurves(results, [cA, cB, l]));
        cclExpected[i].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `CCL[${i}] circle[${k}]`));
      }
      x0 += 200;
      i++;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentCCL");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentLLC", () => {
    const ck = new Checker();
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

    const expectedData: [number, number][][][] = [
      [
        [[11.8989794856, 0], [0, 11.8989794856], [3, 4]],
        [[2.1010205144, 0], [0, 2.1010205144], [3, 4]]
      ],
      [
        [[7.2099063821, 0], [3.7024699491, 6.5537049236], [3, 4]],
        [[3.0715636858, 0], [1.4069304434, 3.1103956651], [3, 4]]
      ],
      [
        [[0, 2.4487767729], [0.2006990742, 1.5986018516], [3, 4]],
        [[0, 30.9676310921], [12.9547184538, -23.9094369076], [3, 4]]
      ],
      [
        [[11.1555106994, 6.6833165123], [-25.7007604374, 0], [3, 4]],
        [[-1.2828523443, 2.0189303709], [-12.4165828835, 0], [3, 4]]
      ],
      [
        [[-2.7264206174, 7.4528412349], [5.056990741, 4.3963715279], [3, 4]],
        [[-1.2281011804, 4.4562023608], [1.9199657928, 3.2199871723], [3, 4]]
      ],
      [
        [[4.8284271247, 0], [0, 4.8284271247], [1.4142135624, 1.4142135624]],
        [[-0.8284271247, 0], [0, -0.8284271247], [-1.4142135624, -1.4142135624]],
        [[0.8284271247, 0], [0, 0.8284271247], [1.4142135624, 1.4142135624]],
        [[-4.8284271247, 0], [0, -4.8284271247], [-1.4142135624, -1.4142135624]],
        [[-4.8284271247, 0], [0, 4.8284271247], [-1.4142135624, 1.4142135624]],
        [[0.8284271247, 0], [0, -0.8284271247], [1.4142135624, -1.4142135624]],
        [[-0.8284271247, 0], [0, 0.8284271247], [-1.4142135624, 1.4142135624]],
        [[4.8284271247, 0], [0, -4.8284271247], [1.4142135624, -1.4142135624]]
      ],
      [
        [[3.6341232212, 0], [1.718982328, 3.578473492], [1.6896168147, 1.0701378506]],
        [[-1.4933881872, 0], [-1.1252492563, -0.6878738845], [-1.9176093262, -0.5681324423]],
        [[0.8579815002, 0], [0.1790559707, 1.268583956], [1.4492526037, 1.3782840384]],
        [[-2.9987165342, 0], [-1.9602551858, -1.9403827787], [-1.846457571, -0.7685014239]],
        [[-7.3401872813, 0], [3.0351365278, 5.5527047916], [-1.0145676049, 1.7235581148]],
        [[-0.133881086, 0], [-0.9622029328, -0.4433043992], [-0.2665676726, -1.9821558152]],
        [[-1.0533871689, 0], [-0.4521527282, 0.3217709077], [-1.6492596091, 1.1313455448]],
        [[8.5274555362, 0], [-5.7666480567, -7.649972085], [0.889231872, -1.7914426248]]
      ],
      [],
      [
        [[-2.888745835, 1.4167203119], [-2.6318454498, 0], [-1.9269254315, 0.5356849646]],
        [[2.7189569752, 3.5196088657], [3.3571837769, 0], [1.7587602578, 0.9522407025]],
        [[-7.7736407483, -0.4151152806], [-5.4844178292, 0], [-1.2874658884, -1.5305004365]],
        [[-38.6982595134, -12.0118473175], [27.5430894897, 0], [0.2889305316, -1.9790197442]]
      ],
      [
        [[2.5633418494, -3.1266836989], [5.5971095074, 4.5989160653], [1.9930988641, -0.1660027651]],
        [[-0.0731140769, 2.1462281538], [0.0771730965, 2.5289399112], [0.1531218209, 1.9941298122]],
        [[-0.1314074068, 2.2628148137], [-0.3761772345, 2.3589335371], [-0.2796940025, 1.9803462488]],
        [[4.6070759481, -7.2141518963], [-10.2971194137, -1.3614197801], [-0.8729223068, -1.7994462054]]
      ],
      [
        [[15.0710678119, 0], [0, 15.0710678119], [4.4142135624, 4.4142135624]],
        [[0.9289321881, 0], [0, 0.9289321881], [1.5857864376, 1.5857864376]],
        [[5.4142135624, 0], [0, 5.4142135624], [1.5857864376, 1.5857864376]],
        [[2.5857864376, 0], [0, 2.5857864376], [4.4142135624, 4.4142135624]]
      ],
      [
        [[10.3432462784, 0], [5.4405342044, 9.1608013066], [4.8608571742, 3.7329465038]],
        [[1.0085913064, 0], [0.2625992597, 1.3938988896], [1.6249887948, 1.5476418536]],
        [[-10.0535974092, 0], [4.5402656582, 7.8103984873], [1.6638856137, 4.4882198583]],
        [[-2.631573509, 0], [0.4232675443, 1.6349013165], [1.014066394, 3.2367862172]]
      ],
      [
        [[0, 2.6082814802], [0.2720317478, 1.4559365044], [4.4678771444, 4.358431702]],
        [[0, 11.8638544748], [4.4112498252, -6.8224996504], [1.0502715189, 2.5544005723]],
        [[0, 2.1356698395], [0.0606733967, 1.8786532065], [1.1160624062, 2.3285991192]],
        [[0, 46.2250099355], [19.7780257043, -37.5560514085], [4.9471849997, 3.4565857828]]
      ],
      [
        [[-0.1878037659, 2.4295735878], [0.2527619446, 0], [1.3118497533, 1.9275501202]],
        [[6.6547231304, 4.9955211739], [7.5605838732, 0], [4.9915680758, 2.8165426498]],
        [[24.0572880278, 11.5214830104], [-39.4798646642, 0], [2.5356221765, 4.9453414191]],
        [[-3.8575407256, 1.0534222279], [-9.6668144868, 0], [1.6339241663, 4.4607658322]]
      ],
      [
        [[4.4570675265, -6.914135053], [9.5619947962, 6.0857480486], [4.7306261561, 1.9975364805]],
        [[0.0741025317, 1.8517949366], [0.3853998756, 2.6445249533], [1.1240235873, 2.3066656659]],
        [[-4.1494340163, 10.2988680326], [8.0363477615, 5.5136304106], [3.2717624033, 4.981450276]],
        [[-0.5478106486, 3.0956212973], [0.4956444383, 2.6858666644], [1.0276544788, 3.3314410128]]
      ],
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
          ck.testTrue(checkCurves(results, [lines[0], lines[1], circle]));
          if (expectedData[i].length > 0)
            expectedData[i].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `LLC[${i}] circle[${k}]`));
        }
        x0 += 300;
        i++;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentLLC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentCCC", () => {
    const ck = new Checker();
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

    const expectedData: [number, number][][][] = [
      [
        [[-0.6302046501, -0.7764290689], [5.6483232792, -1.8920034159], [-2.9471946548, 5.5603959911]],
        [[0.8532134997, 0.5215618122], [3.1360230988, 0.7249759388], [1.3631946548, 2.3276040089]],
        [[-0.824545697, 0.5657953636], [6.2884801489, 1.5296466605], [1.2120268425, 2.2557349011]],
        [[0.2492032313, 0.9684512117], [3.8432356223, 1.6315318491], [-2.9746381185, 4.6107339416]],
        [[0.1516716722, -0.9884309302], [3.3128495877, 1.0740221069], [1.0350905178, 7.8157747815]],
        [[0.993235071, 0.1161210307], [6.7939753381, -0.8841111277], [1.9977322393, 2.7619057437]],
        [[-0.9952522255, -0.0973293769], [3.0005947955, 0.0487732342], [0.5985722784, 2.0603212374]]
      ],
      [
        [[1.2094435442, 5.9778207411], [-5.6935143477, 3.0639591881], [5.6807571764, -3.3466777497]],
        [[0.6886648998, 4.0496998077], [-2.0006139285, 2.0495513569], [1.2479854532, 0.4352505062]],
        [[1.8906697395, 5.4546508717], [-5.6075833355, 0.8101782405], [0.9593631039, 0.199045488]],
        [[1.2054142904, 4.0213248908], [-2.1519761154, 1.2352727795], [4.4978288501, -4.5993285164]],
        [[0.4087515427, 5.8064894679], [-2.018395677, 1.7293631451], [2.0239105008, -4.8367674014]],
        [[0.2675800406, 4.3191468564], [-5.9918032011, 2.1808867274], [0.5602810374, -0.254213248]],
        [[1.2189253734, 5.9757416056], [-2.0710766617, 2.5284456025], [1.759693815, 0.7316003674]],
        [[0.693921679, 4.0479936652], [-4.7447932778, 3.8561473469], [5.8466181828, -1.0530232732]]
      ],
      [
        [[1, 5], [8, 5], [4, -2]]
      ],
      [
        [[1, 5], [-0.9279540389, -0.3726946494], [6.6897627625, -1.0699073822]],
        [[1, 5], [0.5256126707, 0.8507239978], [3.4856774059, 1.3064559239]],
        [[1, 5], [-0.180592968, -0.9835579189], [3.1663019772, 0.7984682594]],
        [[1, 5], [0.8841649827, 0.4671747889], [5.016484012, -1.9999320682]]
      ],
    ];
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
      if (results !== undefined) {
        ck.testTrue(checkCurves(results, [c0, c1, c2]));
        expectedData[i].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `CCC[${i}] circle[${k}]`));
      }
      y0 = 0;
      x0 += 50;
      i++;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentCCC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentLLR", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const axisX = mkLine(-50, 0, 50, 0);
    const axisY = mkLine(0, -50, 0, 50);
    const axisX10 = mkLine(-50, 10, 50, 10);
    const line1 = mkLine(-50, -10, 50, 10);
    const line2 = mkLine(-50, 30, 50, -30);
    const allLines = [axisX, axisY, axisX10, line1, line2];

    const expectedData: [number, number][][][] = [
      [
        [[1, 0], [0, -1]],
        [[-1, 0], [0, -1]],
        [[1, 0], [0, 1]],
        [[-1, 0], [0, 1]]
      ],
      [
        [[5, 0], [0, -5]],
        [[-5, 0], [0, -5]],
        [[5, 0], [0, 5]],
        [[-5, 0], [0, 5]]
      ],
      [],
      [],
      [
        [[0.0990195136, 0], [-0.0970966215, -0.0194193243]],
        [[-10.0990195136, 0], [-9.9029033785, -1.9805806757]],
        [[10.0990195136, 0], [9.9029033785, 1.9805806757]],
        [[-0.0990195136, 0], [0.0970966215, 0.0194193243]]
      ],
      [
        [[0.495097568, 0], [-0.4854831077, -0.0970966215]],
        [[-50.495097568, 0], [-49.5145168923, -9.9029033785]],
        [[50.495097568, 0], [49.5145168923, 9.9029033785]],
        [[-0.495097568, 0], [0.4854831077, 0.0970966215]]
      ],
      [
        [[-0.2769839649, 0], [0.2375117905, -0.1425070743]],
        [[3.6103172983, 0], [3.0958215429, -1.8574929257]],
        [[-3.6103172983, 0], [-3.0958215429, 1.8574929257]],
        [[0.2769839649, 0], [-0.2375117905, 0.1425070743]]
      ],
      [
        [[-1.3849198247, 0], [1.1875589524, -0.7125353714]],
        [[18.0515864914, 0], [15.4791077143, -9.2874646286]],
        [[-18.0515864914, 0], [-15.4791077143, 9.2874646286]],
        [[1.3849198247, 0], [-1.1875589524, 0.7125353714]]
      ],
      [
        [[0, 9], [1, 10]],
        [[0, 11], [1, 10]],
        [[0, 9], [-1, 10]],
        [[0, 11], [-1, 10]]
      ],
      [
        [[0, 5], [5, 10]],
        [[0, 15], [5, 10]],
        [[0, 5], [-5, 10]],
        [[0, 15], [-5, 10]]
      ],
      [
        [[0, -0.8198039027], [0.8038838649, 0.160776773]],
        [[0, 1.2198039027], [1.1961161351, 0.239223227]],
        [[0, -1.2198039027], [-1.1961161351, -0.239223227]],
        [[0, 0.8198039027], [-0.8038838649, -0.160776773]]
      ],
      [
        [[0, -4.0990195136], [4.0194193243, 0.8038838649]],
        [[0, 6.0990195136], [5.9805806757, 1.1961161351]],
        [[0, -6.0990195136], [-5.9805806757, -1.1961161351]],
        [[0, 4.0990195136], [-4.0194193243, -0.8038838649]]
      ],
      [
        [[0, -1.766190379], [1.5144957554, -0.9086974533]],
        [[0, 0.566190379], [0.4855042446, -0.2913025467]],
        [[0, -0.566190379], [-0.4855042446, 0.2913025467]],
        [[0, 1.766190379], [-1.5144957554, 0.9086974533]]
      ],
      [
        [[0, -8.8309518948], [7.5724787771, -4.5434872663]],
        [[0, 2.8309518948], [2.4275212229, -1.4565127337]],
        [[0, -2.8309518948], [-2.4275212229, 1.4565127337]],
        [[0, 8.8309518948], [-7.5724787771, 4.5434872663]]
      ],
      [
        [[50.0990195136, 10], [49.9029033785, 9.9805806757]],
        [[39.9009804864, 10], [40.0970966215, 8.0194193243]],
        [[60.0990195136, 10], [59.9029033785, 11.9805806757]],
        [[49.9009804864, 10], [50.0970966215, 10.0194193243]]
      ],
      [
        [[50.495097568, 10], [49.5145168923, 9.9029033785]],
        [[-0.495097568, 10], [0.4854831077, 0.0970966215]],
        [[100.495097568, 10], [99.5145168923, 19.9029033785]],
        [[49.504902432, 10], [50.4854831077, 10.0970966215]]
      ],
      [
        [[-16.9436506316, 10], [-16.4291548762, 9.8574929257]],
        [[-13.0563493684, 10], [-13.5708451238, 8.1425070743]],
        [[-20.2769839649, 10], [-19.7624882095, 11.8574929257]],
        [[-16.3896827017, 10], [-16.9041784571, 10.1425070743]]
      ],
      [
        [[-18.0515864914, 10], [-15.4791077143, 9.2874646286]],
        [[1.3849198247, 10], [-1.1875589524, 0.7125353714]],
        [[-34.7182531581, 10], [-32.1457743809, 19.2874646286]],
        [[-15.2817468419, 10], [-17.8542256191, 10.7125353714]]
      ],
      [
        [[-0.3790992305, -0.0758198461], [0.3315126601, -0.1989075961]],
        [[2.536376717, 0.5072753434], [2.2179970967, -1.330798258]],
        [[-2.536376717, -0.5072753434], [-2.2179970967, 1.330798258]],
        [[0.3790992305, 0.0758198461], [-0.3315126601, 0.1989075961]]
      ],
      [
        [[-1.8954961523, -0.3790992305], [1.6575633006, -0.9945379803]],
        [[12.6818835849, 2.536376717], [11.0899854834, -6.65399129]],
        [[-12.6818835849, -2.536376717], [-11.0899854834, 6.65399129]],
        [[1.8954961523, 0.3790992305], [-1.6575633006, 0.9945379803]]
      ],
    ];
    let caseIdx = 0;
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
            ck.testTrue(checkCurves(results, [allLines[i], allLines[j]]));
            if (expectedData[caseIdx].length > 0)
              expectedData[caseIdx].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `LLR[${caseIdx}] circle[${k}]`));
          }
          caseIdx++;
          y0 += 200;
        }
        x0 += 250;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "CirclesTangentLLR");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CirclesTangentCLR", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 1);
    const circleB = mkCircle(2, 3, 1);
    const circleC = mkCircle(2, -1, 4);
    const axisX = mkLine(-10, 0, 10, 0);
    const axisY = mkLine(0, -10, 0, 10);
    const line1 = mkLine(3, -8, -1, 8);
    const allLines = [axisX, axisY, line1];
    const allCircles = [circleA, circleB, circleC];

    const expectedData: [number, number][][][] = [
      [
        [[0.8660254038, -0.5], [1.7320508076, 0]],
        [[-0.8660254038, -0.5], [-1.7320508076, 0]],
        [[0.8660254038, 0.5], [1.7320508076, 0]],
        [[-0.8660254038, 0.5], [-1.7320508076, 0]]
      ],
      [
        [[0.7453559925, -0.6666666667], [2.2360679775, 0]],
        [[-0.7453559925, -0.6666666667], [-2.2360679775, 0]],
        [[0.7453559925, 0.6666666667], [2.2360679775, 0]],
        [[-0.7453559925, 0.6666666667], [-2.2360679775, 0]]
      ],
      [
        [[0.5, 0.8660254038], [0, 1.7320508076]],
        [[0.5, -0.8660254038], [0, -1.7320508076]],
        [[-0.5, 0.8660254038], [0, 1.7320508076]],
        [[-0.5, -0.8660254038], [0, -1.7320508076]]
      ],
      [
        [[0.6666666667, 0.7453559925], [0, 2.2360679775]],
        [[0.6666666667, -0.7453559925], [0, -2.2360679775]],
        [[-0.6666666667, 0.7453559925], [0, 2.2360679775]],
        [[-0.6666666667, -0.7453559925], [0, -2.2360679775]]
      ],
      [
        [[0.9139076751, 0.4059221126], [0.85767285, 0.5693086001]],
        [[0.9974112957, 0.0719076301], [1.0246800912, -0.0987203648]],
        [[-0.2569916116, 0.9664136338], [0.4561592769, 2.1753628926]],
        [[0.2280255821, -0.9736551412], [1.4261936643, -1.7047746573]]
      ],
      [
        [[0.926354244, 0.3766534409], [0.8387777318, 0.6448890726]],
        [[0.9946200699, 0.1035901376], [1.0435752093, -0.1743008373]],
        [[-0.5608331497, 0.8279288485], [0.2577855511, 2.9688577956]],
        [[-0.1052392034, -0.9944469368], [1.6245673901, -2.4982695603]]
      ],
      [
        [[2, 2], [2, 0]]
      ],
      [
        [[2.9428090416, 2.6666666667], [4.8284271247, 0]],
        [[1.0571909584, 2.6666666667], [-0.8284271247, 0]],
        [[2, 4], [2, 0]]
      ],
      [
        [[1.5, 3.8660254038], [0, 4.7320508076]],
        [[1.5, 2.1339745962], [0, 1.2679491924]]
      ],
      [
        [[2, 4], [0, 6]],
        [[2, 2], [0, 0]],
        [[2, 2], [0, 4]],
        [[2, 4], [0, 2]]
      ],
      [
        [[1.4342448763, 3.8245733078], [-0.1016527476, 4.4066109906]],
        [[1.8888388004, 2.0061976113], [0.8075351006, 0.7698595977]]
      ],
      [
        [[1.8564405151, 3.9896416899], [-0.3709634549, 5.4838538195]],
        [[2.3390436027, 2.0592293396], [1.0768458078, -0.3073832313]],
        [[1.9379656916, 2.0019259824], [0.1217493081, 3.5130027675]],
        [[1.4755819549, 3.8514609292], [0.5841330448, 1.6634678207]]
      ],
      [
        [[6, -1], [7, 0]],
        [[-2, -1], [-3, 0]],
        [[5.666060556, 0.6], [6.582575695, 0]],
        [[-1.666060556, 0.6], [-2.582575695, 0]],
        [[6, -1], [5, 0]],
        [[-2, -1], [-1, 0]],
        [[4.98142397, 1.6666666667], [4.2360679775, 0]],
        [[-0.98142397, 1.6666666667], [-0.2360679775, 0]]
      ],
      [
        [[5.9440531887, -1.6666666667], [7.9160797831, 0]],
        [[-1.9440531887, -1.6666666667], [-3.9160797831, 0]],
        [[5.4641016151, 1], [7.1961524227, 0]],
        [[-1.4641016151, 1], [-3.1961524227, 0]],
        [[5.4641016151, -3], [3.7320508076, 0]],
        [[-1.4641016151, -3], [0.2679491924, 0]]
      ],
      [
        [[1.2, 2.9191835885], [0, 3.8989794856]],
        [[1.2, -4.9191835885], [0, -5.8989794856]],
        [[-0.4, 2.2], [0, 3]],
        [[-0.4, -4.2], [0, -5]],
        [[0.6666666667, 2.7712361663], [0, 1.8284271247]],
        [[0.6666666667, -4.7712361663], [0, -3.8284271247]],
        [[-2, -1], [0, -1]]
      ],
      [
        [[2, 3], [0, 5]],
        [[2, -5], [0, -7]],
        [[-0.6666666667, 1.98142397], [0, 3.472135955]],
        [[-0.6666666667, -3.98142397], [0, -5.472135955]],
        [[2, 3], [0, 1]],
        [[2, -5], [0, -3]]
      ],
      [
        [[1.2427063403, 2.9276591391], [0.0832404253, 3.6670382989]],
        [[3.1801098952, -4.8219550802], [2.5049948688, -6.0199794753]],
        [[-0.2512121596, 2.3063641379], [0.1561273006, 3.3754907974]],
        [[1.5695723947, -4.9767740791], [2.4321079935, -5.7284319739]],
        [[1.3862116751, 2.9526274669], [0.5695162562, 1.7219349752]],
        [[3.3184820507, -4.7764540355], [2.0187190379, -4.0748761516]],
        [[-1.0278320564, 1.6138540583], [0.6992684578, 1.2029261687]],
        [[0.5584324482, -4.7312039603], [1.8889668363, -3.5558673452]]
      ],
      [
        [[1.8748580525, 2.9980419574], [-0.1279979215, 4.511991686]],
        [[3.7710121439, -4.5865744083], [2.7162332156, -6.8649328625]],
        [[-0.6282127602, 2.0153768732], [-0.00203414, 4.0081365598]],
        [[1.0999896225, -4.8974326576], [2.5902694341, -6.3610777363]],
        [[3.720314148, 2.6111659104], [0.9198720737, 0.3205117051]],
        [[5.2172964414, -3.376763263], [1.6683632204, -2.6734528816]]
      ],
    ];
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
          if (results !== undefined) {
            ck.testExactNumber(expectedCircleCounts[i], results.length, `expect ${expectedCircleCounts[i]} result circles`);
            for (const result of results) {
              const circle = result.curve;
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle, x0, y0);
              expect(circle.isCircular).toBe(true);
              checkRadius(ck, circle, radius, "correct radius");
              checkTangentCC(ck, circle, circ, "tangent to input circle");
              checkTangentCL(ck, circle, l, "tangent to input line");
            }
            ck.testTrue(checkCurves(results, [circ, l]));
            expectedData[i].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `CLR[${i}] circle[${k}]`));
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
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 1);
    const circleB = mkCircle(2, 3, 1);
    const circleC = mkCircle(2, -1, 0.2);
    const circleD = mkCircle(2, -1, 4);
    const allCircles = [circleA, circleB, circleC, circleD];

    const expectedData: [number, number][][][] = [
      [
        [[0.1397116539, 0.9901922307], [1.1397116539, 2.4901922307]],
        [[0.8602883461, 0.5098077693], [1.8602883461, 2.0098077693]]
      ],
      [
        [[-0.661126268, 0.7502746549], [1.0531594463, 3.3217032263]],
        [[0.9468405537, -0.3217032263], [2.661126268, 2.2497253451]],
        [[-0.1593940015, 0.9872150486], [2.6231516022, 2.2178989319]],
        [[0.9725808147, 0.2325651711], [1.0383868594, 3.2744087604]],
        [[0.9616131406, -0.2744087604], [1.0274191853, 2.7674348289]],
        [[-0.6231516022, 0.7821010681], [2.1593940015, 2.0127849514]],
        [[0.5760848487, -0.8173898991], [2.9760848487, 2.7826101009]],
        [[-0.9760848487, 0.2173898991], [1.4239151513, 3.8173898991]]
      ],
      [
        [[0.9949895395, 0.099979079], [1.9983298465, -0.8000069737]],
        [[0.5170104605, -0.855979079], [1.8390034868, -1.118659693]],
        [[0.994984276, -0.1000314481], [2.002507862, -1.199984276]],
        [[0.677015724, -0.7359685519], [2.161492138, -0.882015724]]
      ],
      [
        [[0.8326294928, 0.5538304142], [2.1234969822, -0.8426834549]],
        [[0.0565133643, -0.9984018428], [1.9482449532, -1.1931875129]],
        [[0.9214231647, 0.3885606151], [1.8465530292, -1.1282732519]],
        [[0.2420054067, -0.9702749008], [2.0105504191, -0.8002784722]],
        [[-0.076533505, -0.9970670101], [1.9478279847, -0.8069246758]],
        [[0.751733505, 0.6594670101], [1.8142365314, -1.0741075823]],
        [[-0.2956484108, -0.9552968215], [2.0179916533, -1.1991891072]],
        [[0.5868484108, 0.8096968215], [2.1701462777, -0.8948798584]]
      ],
      [
        [[0.4472135955, 0.894427191], [0.5259029213, 2.7184725093]],
        [[-0.4472135955, -0.894427191], [-1.8592362547, -2.0518058427]]
      ],
      [],
      [],
      [
        [[2.8803709793, 2.5257142857], [2.1987934469, -0.9780645161]],
        [[1.1196290207, 2.5257142857], [1.8012065531, -0.9780645161]],
        [[2.8284926071, 2.44], [1.8000190259, -1.0027586207]],
        [[1.1715073929, 2.44], [2.1999809741, -1.0027586207]],
        [[1.0020501015, 3.064], [2.1609596611, -0.8812903226]],
        [[2.9979498985, 3.064], [1.8390403389, -0.8812903226]],
        [[1.0170737566, 3.184], [1.830529958, -1.1062068966]],
        [[2.9829262434, 3.184], [2.169470042, -1.1062068966]]
      ],
      [
        [[2.9499177596, 3.3125], [3.5198684154, 2.7]],
        [[1.0500822404, 3.3125], [0.4801315846, 2.7]],
        [[2.7261843774, 2.3125], [3.9364916731, 2.5]],
        [[1.2738156226, 2.3125], [0.0635083269, 2.5]]
      ],
      [
        [[2.7806247498, 3.625], [4.1857492994, 2.35]],
        [[1.2193752502, 3.625], [-0.1857492994, 2.35]],
        [[1.6200328962, 3.925], [-1.7996710384, 0.25]],
        [[2.3799671038, 3.925], [5.7996710384, 0.25]]
      ],
      [],
      [],
    ];
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
            ck.testTrue(checkCurves(results, [allCircles[i], allCircles[j]]));
            if (expectedData[k].length > 0)
              expectedData[k].forEach((pts, m) => checkDataPoints(ck, results[m].details, pts, `CCR[${k}] circle[${m}]`));
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
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(4, 0, 1);
    const circleC = mkCircle(0, 3, 1.5);
    const circleD = mkCircle(3, 4, 2);

    const expectedData: [number, number][][][] = [
      [
        [[2, 0], [5, 0]],
        [[2, 0], [3, 0]],
        [[-2, 0], [5, 0]],
        [[-2, 0], [3, 0]]
      ],
      [
        [[0, 2], [0, 4.5]],
        [[0, 2], [0, 1.5]],
        [[0, -2], [0, 4.5]],
        [[0, -2], [0, 1.5]]
      ],
      [
        [[1.4230249471, 3.474341649], [4.8973665961, 4.632455532]],
        [[1.4230249471, 3.474341649], [1.1026334039, 3.367544468]],
        [[-1.4230249471, 2.525658351], [4.8973665961, 4.632455532]],
        [[-1.4230249471, 2.525658351], [1.1026334039, 3.367544468]]
      ],
    ];
    let x0 = 0;
    let caseIdx3 = 0;
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
          const line = result.curve;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, line, x0);
          checkLineThroughCenter(ck, line, cA, "line passes through circleA center");
          checkLineThroughCenter(ck, line, cB, "line passes through circleB center");
        }
        ck.testTrue(checkCurves(results, [cA, cB]));
        expectedData[caseIdx3].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `PCPC[${caseIdx3}] line[${k}]`));
        caseIdx3++;
      }
      x0 += 20;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "LinesPerpCPerpC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LinesPerpCTangentC", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const circleA = mkCircle(0, 0, 2);
    const circleB = mkCircle(5, 0, 1);
    const circleC = mkCircle(3, 3, 2);
    const circleD = mkCircle(0, 4, 1.5);

    const expectedData: [number, number][][][] = [
      [
        [[1.9595917942, 0.4], [4.8, 0.9797958971]],
        [[-1.9595917942, 0.4], [4.8, -0.9797958971]],
        [[-1.9595917942, -0.4], [4.8, 0.9797958971]],
        [[1.9595917942, -0.4], [4.8, -0.9797958971]]
      ],
      [
        [[0.5805524623, 1.9138857956], [1.0861142044, 3.5805524623]],
        [[-1.9138857956, -0.5805524623], [3.5805524623, 1.0861142044]],
        [[-0.5805524623, -1.9138857956], [1.0861142044, 3.5805524623]],
        [[1.9138857956, 0.5805524623], [3.5805524623, 1.0861142044]]
      ],
      [
        [[1.0296706912, 2.6567764363], [0.2574176728, 2.5222530184]],
        [[4.3703293088, 1.5432235637], [1.0925823272, 5.0277469816]],
        [[4.9703293088, 3.3432235637], [0.2574176728, 2.5222530184]],
        [[1.6296706912, 4.4567764363], [1.0925823272, 5.0277469816]]
      ],
    ];
    let x0 = 0;
    let caseIdx4 = 0;
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
          const line = result.curve;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, line, x0);
          checkLineThroughCenter(ck, line, cA, "line passes through circleA center");
          checkLineTangentToCircle(ck, line, cB, "line tangent to circleB");
        }
        ck.testTrue(checkCurves(results, [cA, cB]));
        expectedData[caseIdx4].forEach((pts, k) => checkDataPoints(ck, results[k].details, pts, `PCTC[${caseIdx4}] line[${k}]`));
        caseIdx4++;
      }
      x0 += 20;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConstrainedCurve2d", "LinesPerpCTangentC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("RejectsNonCircularArcInputs", () => {
    const ck = new Checker();
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
