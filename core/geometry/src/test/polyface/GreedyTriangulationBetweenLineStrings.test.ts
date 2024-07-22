/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Angle } from "../../geometry3d/Angle";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

// ---------------------------------------------------------------------------------------------------

describe("GreedyTriangulationBetweenLineStrings", () => {
  it("zigzag", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const z0 = 0;
    const z1 = 1;
    const dataA = [[0, 0, z0], [1, 0, z0], [2, 0, z0], [2, 1, z0], [3, 1, z0], [3, 2, z0]];
    const dataB0 = [[0, 0, z1], [1, 0, z1], [1.5, 0, z1], [2, 0, z1], [2, 1, z1], [3, 1, z1], [3, 2, z1]];
    const dataB1 = [[0, 1, z1], [1, 0, z1], [1.5, 0, z1], [2, 0, z1], [2, 1, z1], [3, 1, z1], [3, 2, z1]];
    let x0 = 0.0;
    const dx = 8;
    const dy = 8;
    const dz = 0.01;  // output stringers a little above and below
    for (const dataB of [dataB0, dataB1]) {
      for (let nA = 2; nA <= dataA.length; nA++) {
        const pointA = GrowableXYZArray.create(dataA.slice(0, nA));
        let y0 = 0;
        for (let nB = 1; nB <= dataB.length; nB++) {
          const pointB = GrowableXYZArray.create(dataB.slice(0, nB));
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(pointA), x0, y0, -dz);
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(pointB), x0, y0, dz);
          const builder = PolyfaceBuilder.create();
          builder.addGreedyTriangulationBetweenLineStrings(pointA, pointB);
          y0 += dy;
          GeometryCoreTestIO.captureGeometry(allGeometry, builder.claimPolyface(), x0, y0);
          const builder1 = PolyfaceBuilder.create();
          builder1.addGreedyTriangulationBetweenLineStrings(pointB, pointA);
          y0 += dy;
          GeometryCoreTestIO.captureGeometry(allGeometry, builder1.claimPolyface(), x0, y0);
          y0 += 2 * dy;
        }
        x0 += dx;
      }
      x0 += 2 * dx;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "GreedyTriangulationBetweenLineStrings", "zigzag");
    expect(ck.getNumErrors()).equals(0);
  });

  it("zigzagDuplicates", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const z0 = 0;
    const z1 = 1;
    const dataA = [[0, 0, z0], [1, 0, z0], [2, 0, z0], [2, 1, z0], [3, 1, z0], [3, 2, z0]];
    const dataB = [[0, 0, z1], [1, 0, z1], [1.5, 0.05, z1], [2, 0, z1], [2, 1, z1], [3, 1, z1], [3, 2, z1]];
    let y0 = 0;
    const dz = 0.01;  // output stringers a little above and below
    const numDup = 2;
    const step = 4.0;
    for (let nA = 0; nA < dataA.length; nA++) {
      let x0 = 0;
      const pointA = makeArrayWithDuplicates(dataA, nA, numDup);
      for (let nB = 0; nB < dataB.length; nB++) {
        const pointB = makeArrayWithDuplicates(dataB, nB, numDup);
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(pointA), x0, y0, -dz);
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(pointB), x0, y0, dz);
        const builder = PolyfaceBuilder.create();
        builder.addGreedyTriangulationBetweenLineStrings(pointA, pointB);
        GeometryCoreTestIO.captureGeometry(allGeometry, builder.claimPolyface(), x0, y0);
        x0 += step;
      }
      y0 += step;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "GreedyTriangulationBetweenLineStrings", "zigzagDuplicates");
    expect(ck.getNumErrors()).equals(0);
  });

  it("quadQuad", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    let x0 = 0.0;
    const zA = 0;
    const zB = 1;
    const z0 = 0.0;
    for (const yShift of [0.1, 0, 0.05, 0.1, 0.5]) {
      const dataA = [[0, 0, zA], [1, 0, zA], [1, 1 + yShift, zA], [0, 1 + yShift, zA], [0, 0, zA]];
      const dataB = [[0, 0, zB], [1, 2 * yShift, zB], [1, 1 + yShift, zB], [0, 1 - yShift, zB], [0, 0, zB]];
      const lineStringA = LineString3d.create(dataA);
      const lineStringB = LineString3d.create(dataB);
      const dx = 8;
      const dy = 8;
      const dz = 0.01;  // output stringers a little above and below
      const options = StrokeOptions.createForCurves();
      for (const edgeLengthA of [1, 0.55, 0.35, 0.28, 0.22]) {
        const lineStringA1 = LineString3d.create();
        options.maxEdgeLength = edgeLengthA;
        lineStringA.emitStrokes(lineStringA1, options);
        let y0 = 0;
        for (const edgeLengthB of [0.28, 1, 0.55, 0.35, 0.28, 0.22]) {
          const lineStringB1 = LineString3d.create();
          options.maxEdgeLength = edgeLengthB;
          lineStringB.emitStrokes(lineStringB1, options);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, lineStringA1, x0, y0, z0 - dz);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, lineStringB1, x0, y0, z0 + dz);
          const builder = PolyfaceBuilder.create();
          builder.addGreedyTriangulationBetweenLineStrings(lineStringA1.points, lineStringB1.points);
          GeometryCoreTestIO.captureGeometry(allGeometry, builder.claimPolyface(), x0, y0, z0);
          y0 += dy;
        }
        x0 += dx;
      }
      x0 += 5.0 * dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "GreedyTriangulationBetweenLineStrings", "quadQuad");
    expect(ck.getNumErrors()).equals(0);
  });

  it("quadStar", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    let x0 = 0.0;
    const zA = 0;
    const zB = 1;
    const z0 = 0.0;
    const rX = 0.5;
    for (const numStarPoints of [3, 4]) {
      const dataA = Sample.createRegularPolygon(0, 0, zA, Angle.createDegrees(0), rX, 4, true);
      const dataB = Sample.createStar(0.0, 0.0, zB, 0.5, 0.45, numStarPoints, true);
      const lineStringA = LineString3d.create(dataA);
      const lineStringB = LineString3d.create(dataB);
      const dx = 8;
      const dy = 8;
      const dz = 0.01;  // output stringers a little above and below
      const options = StrokeOptions.createForCurves();
      for (const edgeLengthA of [1, 0.55, 0.35, 0.28, 0.22]) {
        const lineStringA1 = LineString3d.create();
        options.maxEdgeLength = edgeLengthA;
        lineStringA.emitStrokes(lineStringA1, options);
        let y0 = 0;
        for (const edgeLengthB of [0.35, 0.28, 0.22, 0.11, 0.05]) {
          const lineStringB1 = LineString3d.create();
          options.maxEdgeLength = edgeLengthB;
          lineStringB.emitStrokes(lineStringB1, options);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, lineStringA1, x0, y0, z0 - dz);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, lineStringB1, x0, y0, z0 + dz);
          const builder = PolyfaceBuilder.create();
          builder.addGreedyTriangulationBetweenLineStrings(lineStringA1.points, lineStringB1.points);
          GeometryCoreTestIO.captureGeometry(allGeometry, builder.claimPolyface(), x0, y0, z0);
          y0 += dy;
        }
        x0 += dx;
      }
      x0 += 5.0 * dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "GreedyTriangulationBetweenLineStrings", "quadStar");
    expect(ck.getNumErrors()).equals(0);
  });

});

/**
 * Return a Point3d[] with numDuplicates copies of each of the first n points of the data.
 * @param data
 * @param n
 * @param numDuplicate
 */
function makeArrayWithDuplicates(data: number[][], n: number, numDuplicate: number): Point3d[] {
  const result: Point3d[] = [];
  const m = Math.min(n, data.length);
  for (let k = 0; k < m; k++) {
    const xyz = data[k];
    for (let i = 0; i < numDuplicate; i++)
      result.push(Point3d.create(xyz[0], xyz[1], xyz[2]));
  }
  return result;
}
