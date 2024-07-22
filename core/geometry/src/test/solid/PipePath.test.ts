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

    // test invalid inputs
    let pipeBad = TorusPipe.createDgnTorusPipe(center, Vector3d.createZero(), vectorY, majorRadius, minorRadius, sweep, capped);
    ck.testDefined(pipeBad, "Zero vectorX nevertheless yields defined TorusPipe");  // default vec is used!
    pipeBad = TorusPipe.createDgnTorusPipe(center, vectorX, Vector3d.createZero(), majorRadius, minorRadius, sweep, capped);
    ck.testDefined(pipeBad, "Zero vectorY nevertheless yields defined TorusPipe");  // default vec is used!
    pipeBad = TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, 0, minorRadius, sweep, capped);
    ck.testUndefined(pipeBad, "Zero majorRadius yields undefined TorusPipe");
    pipeBad = TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, majorRadius, 0, sweep, capped);
    ck.testUndefined(pipeBad, "Zero minorRadius yields undefined TorusPipe");
    pipeBad = TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, minorRadius, majorRadius, sweep, capped);
    ck.testUndefined(pipeBad, "Swapped radii yields undefined TorusPipe");
    pipeBad = TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, majorRadius, minorRadius, Angle.zero(), capped);
    ck.testUndefined(pipeBad, "Zero sweep yields undefined TorusPipe");

    let pipe0 = TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, majorRadius, minorRadius, sweep, capped)!;
    for (const frac of [0.1, 0.5, 0.6]) {
      const uIsoline = pipe0.constantUSection(frac)!;
      const vIsoline = pipe0.constantVSection(frac)!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [uIsoline, vIsoline], x0, y0, z0);
    }

    // test mirror
    const mirrorAcrossX: Transform = Transform.createIdentity();
    mirrorAcrossX.matrix.setAt(1, 1, -1);
    const pipeM = pipe0.cloneTransformed(mirrorAcrossX);
    if (ck.testDefined(pipeM)) {
      ck.testTrue(pipeM.getConstructiveFrame()!.matrix.isRigid(false), "getConstructiveFrame removes mirror");
      const builderM = PolyfaceBuilder.create(options);
      builderM.addTorusPipe(pipeM, 20, 20);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pipeM, builderM.claimPolyface()], x0, y0, z0);
    }

    for (const xAxis of [vectorX, vectorX.negate(), Vector3d.create(0, 0, 1), Vector3d.create(1, 0, 1), Vector3d.create(1, 1, 1)]) {
      y0 = 0;
      for (const yAxis of [vectorY, vectorY.negate(), Vector3d.create(1, 1, 0)]) {
        x0 = 0;
        pipe0 = TorusPipe.createDgnTorusPipe(center, xAxis, yAxis, majorRadius, minorRadius, sweep, capped)!;
        const builder0 = PolyfaceBuilder.create(options);
        builder0.addTorusPipe(pipe0, 20, 20);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pipe0, builder0.claimPolyface()], x0, y0, z0);

        // test scaling and un-scaling
        for (const scale of [Point2d.create(10, 10), Point2d.create(5, 10), Point2d.create(10, 5)]) {
          // Create radii-scaled TorusPipe
          const pipeScaledRadii = TorusPipe.createDgnTorusPipe(center, xAxis, yAxis, majorRadius * scale.x, minorRadius * scale.y, sweep, capped);
          if (!ck.testDefined(pipeScaledRadii))
            continue;
          if (!ck.testCoordinate(1, pipeScaledRadii.cloneVectorX().magnitude(), "TorusPipe.cloneVectorX returns unit vector") ||
              !ck.testCoordinate(1, pipeScaledRadii.cloneVectorY().magnitude(), "TorusPipe.cloneVectorY returns unit vector") ||
              !ck.testCoordinate(1, pipeScaledRadii.cloneVectorZ().magnitude(), "TorusPipe.cloneVectorZ returns unit vector"))
            continue;
          let builder = PolyfaceBuilder.create(options);
          builder.addTorusPipe(pipeScaledRadii, 20, 20);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pipeScaledRadii, builder.claimPolyface()], x0 += 5, y0, z0);

          // Clone original TorusPipe with scale transform from scale factors in local coords, and compare with radii-scaled TorusPipe.
          // The major radius is affected by local x-axis scale; the minor radius is affected by local z-axis scale.
          // Note that non-uniform scale is NOT preserved after round-trip through json. This is because conversion to json forces orthogonal
          // localToWorld (getConstructiveFrame), and so does v.v. See IModelJsonWriter.handleTorusPipe and IModelJsonReader.parseTorusPipe.
          // This discrepancy can be seen in output: the pre-conversion mesh exhibits non-uniform scale, but not the post-conversion pipe.
          const scaleInLocalCoords = Transform.createOriginAndMatrix(Point3d.createZero(), Matrix3d.createScale(scale.x, scale.x, scale.y));
          const scaleInWorldCoords = pipe0.cloneLocalToWorld().multiplyTransformTransform(scaleInLocalCoords.multiplyTransformTransform(pipe0.cloneLocalToWorld().inverse()!));
          const pipeCloneScaled = pipe0.cloneTransformed(scaleInWorldCoords);
          if (!ck.testDefined(pipeCloneScaled))
            continue;
          builder = PolyfaceBuilder.create(options);
          builder.addTorusPipe(pipeCloneScaled, 20, 20);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pipeCloneScaled, builder.claimPolyface()], x0, y0, z0);
          ck.testTrue(pipeScaledRadii.isAlmostEqual(pipeCloneScaled), "TorusPipe with scaled radii is equivalent to TorusPipe cloned with scale transform");

          // Clone radii-scaled TorusPipe with inverse of scale transform, and compare with original.
          const unScaleInWorldCoords = scaleInWorldCoords.inverse()!;
          const pipeCloneUnScaled0 = pipeScaledRadii.cloneTransformed(unScaleInWorldCoords);
          if (!ck.testDefined(pipeCloneUnScaled0))
            continue;
          builder = PolyfaceBuilder.create(options);
          builder.addTorusPipe(pipeCloneUnScaled0, 20, 20);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pipeCloneUnScaled0, builder.claimPolyface()], x0, y0, z0);
          ck.testTrue(pipe0.isAlmostEqual(pipeCloneUnScaled0), "TorusPipe with scaled radii cloned with reciprocal scale transform is equivalent to original");

          // Clone scale-transformed TorusPipe with inverse of scale transform, and compare with original.
          const pipeCloneUnScaled1 = pipeCloneScaled.cloneTransformed(unScaleInWorldCoords);
          if (!ck.testDefined(pipeCloneUnScaled1))
            continue;
          builder = PolyfaceBuilder.create(options);
          builder.addTorusPipe(pipeCloneUnScaled1, 20, 20);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pipeCloneUnScaled1, builder.claimPolyface()], x0, y0, z0);
          ck.testTrue(pipe0.isAlmostEqual(pipeCloneUnScaled1), "TorusPipe cloned with scale transform then cloned with inverse is equivalent to original");
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
