/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Arc3d } from "../../curve/Arc3d";
import { Checker } from "../Checker";
import { CurveFactory } from "../../curve/CurveFactory";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Transform } from "../../geometry3d/Transform";
import { TorusPipe } from "../../solid/TorusPipe";
import { Point2d } from "../../geometry3d/Point2dVector2d";

describe("PipePath", () => {
  it("TorusPipeAlongArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const minorRadius = 0.5;
    let y0 = 0;
    for (const startDegrees of [0, 45, -135]) {
      let x0 = 0;

      for (const sweepDegrees of [45, 190, -105]) {
        const arc = Arc3d.create(Point3d.create(1, 0, 0), Vector3d.create(0, 2, 0), Vector3d.create(-2, 0, 0), AngleSweep.createStartSweepDegrees(startDegrees, sweepDegrees));
        const pipe = TorusPipe.createAlongArc(arc, minorRadius, false);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, pipe, x0, y0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc, x0, y0);
        x0 += 10.0;
      }
      y0 += 10.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PipePath", "TorusPipeAlongArc");
    expect(ck.getNumErrors()).equals(0);
  });

  it("TorusPipeTransformed", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    let z0 = 0;
    const options = StrokeOptions.createForFacets();

    const center = Point3d.create(0, 0, 0);
    const majorRadius = 0.2;
    const minorRadius = 0.1;
    const vectorX = Vector3d.create(1, 0, 0);
    const vectorY = Vector3d.create(0, 1, 0);
    const sweep = Angle.createDegrees(90);
    const capped = true;

    // verify invalid inputs fail
    let pipeBad = TorusPipe.createDgnTorusPipe(center, Vector3d.createZero(), vectorY, majorRadius, minorRadius, sweep, capped);
    ck.testUndefined(pipeBad, "Zero vectorX yields undefined TorusPipe");
    pipeBad = TorusPipe.createDgnTorusPipe(center, vectorX, Vector3d.createZero(), majorRadius, minorRadius, sweep, capped);
    ck.testUndefined(pipeBad, "Zero vectorY yields undefined TorusPipe");
    pipeBad = TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, 0, minorRadius, sweep, capped);
    ck.testUndefined(pipeBad, "Zero majorRadius yields undefined TorusPipe");
    pipeBad = TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, majorRadius, 0, sweep, capped);
    ck.testUndefined(pipeBad, "Zero minorRadius yields undefined TorusPipe");
    pipeBad = TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, minorRadius, majorRadius, sweep, capped);
    ck.testUndefined(pipeBad, "Swapped radii yields undefined TorusPipe");
    pipeBad = TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, majorRadius, minorRadius, Angle.zero(), capped);
    ck.testUndefined(pipeBad, "Zero sweep yields undefined TorusPipe");

    let pipe0 = TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, majorRadius, minorRadius, sweep, capped)!;

    // test mirror
    const mirrorY: Transform = Transform.createIdentity();
    mirrorY.matrix.setAt(1, 1, -1);
    const pipeM = pipe0.cloneTransformed(mirrorY);
    if (ck.testDefined(pipeM) && pipeM !== undefined) {
      ck.testTrue(pipeM.getConstructiveFrame()!.matrix.isRigid(false), "TorusPipe.clone mirrored has rigid, non-mirror transform");
      const builderM = PolyfaceBuilder.create(options);
      builderM.addUVGridBody(pipeM, 20, 20);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pipeM, builderM.claimPolyface()], x0);
    }

    for (const xAxis of [vectorX, vectorX.negate(), Vector3d.create(0, 0, 1), Vector3d.create(1, 0, 1), Vector3d.create(1, 1, 1)]) {
      y0 = 0;
      for (const yAxis of [vectorY, vectorY.negate(), Vector3d.create(1, 1, 0)]) {
        x0 = 0;
        pipe0 = TorusPipe.createDgnTorusPipe(center, xAxis, yAxis, majorRadius, minorRadius, sweep, capped)!;
        const builder0 = PolyfaceBuilder.create(options);
        builder0.addUVGridBody(pipe0, 20, 20);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pipe0, builder0.claimPolyface()], x0, y0, z0);

        // now create scaled pipe, then try to remove scale with a transform
        for (const scale of [Point2d.create(10, 10), Point3d.create(5, 10), Point3d.create(10, 5)]) {
          const pipe1 = TorusPipe.createDgnTorusPipe(center, xAxis, yAxis, majorRadius * scale.x, minorRadius * scale.y, sweep, capped);
          if (!ck.testDefined(pipe1) || pipe1 === undefined)
            continue;
          if (!ck.testTrue(pipe1.cloneVectorX().isPerpendicularTo(pipe1.cloneVectorY()), "TorusPipe axes are perpendicular"))
            continue;
          const builder1 = PolyfaceBuilder.create(options);
          builder1.addUVGridBody(pipe1, 20, 20);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pipe1, builder1.claimPolyface()], x0 += 5, y0, z0);

          const inverseScaleTransform = Transform.createOriginAndMatrix(Point3d.createZero(), Matrix3d.createScale(scale.x, scale.x, scale.y)).inverse()!;
          const pipe2 = pipe1.cloneTransformed(inverseScaleTransform);
          if (!ck.testDefined(pipe2) || pipe2 === undefined)
            continue;
          const builder2 = PolyfaceBuilder.create(options);
          builder2.addUVGridBody(pipe2, 20, 20);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pipe2, builder2.claimPolyface()], x0, y0, z0);

          if (ck.testDefined(pipe1.getConstructiveFrame()))
            ck.testTrue(pipe1.getConstructiveFrame()!.matrix.isRigid(false), "TorusPipe 1 transform is rigid");
          if (ck.testDefined(pipe2.getConstructiveFrame()))
            ck.testTrue(pipe2.getConstructiveFrame()!.matrix.isRigid(false), "TorusPipe 2 transform is rigid");

          ck.testTrue(pipe2.isAlmostEqual(pipe0), "Scaled then unscaled TorusPipe is equal to original");
        }
        y0 += 10;
      }
      z0 += 10;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PipePath", "TorusPipeTransformed");
    expect(ck.getNumErrors()).equals(0);
  });

  it("KeyPointPath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const pipeRadius = 0.25;
    const x0 = 0;
    let y0 = 0;
    const dy = 20.0;
    const keyPoints = [[0, 0, 0], [5, 0, 0], [5, 5, 0], [10, 5, 4], [10, 0, 4], [14, -2, 0]];
    const bendRadii = [0, 1, 2, 0.5, 1];
    const ls = LineString3d.create(keyPoints);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, ls, x0, y0);
    y0 += dy;
    const path = CurveFactory.createFilletsInLineString(ls, bendRadii)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0);
    y0 += dy;
    const pipe = CurveFactory.createPipeSegments(path, pipeRadius);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pipe, x0, y0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "PipePath", "KeyPointPath");
    expect(ck.getNumErrors()).equals(0);
  });
});
