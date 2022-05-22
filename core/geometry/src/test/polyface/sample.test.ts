/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

// import { expect } from "chai";
// import { Checker } from "../Checker";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Loop } from "../../curve/Loop";
import { LinearSweep } from "../../solid/LinearSweep";
import { ParityRegion } from "../../curve/ParityRegion";
import { Arc3d } from "../../curve/Arc3d";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { ConvexClipPlaneSet } from "../../clipping/ConvexClipPlaneSet";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { ClippedPolyfaceBuilders, PolyfaceClip } from "../../polyface/PolyfaceClip";
import { Angle } from "../../geometry3d/Angle";
import { StrokeOptions } from "../../curve/StrokeOptions";
describe("MeshConstruction", () => {
  /**
   * Example of constructing a plate with holes.
   * * Request by Samuel Powell, Bechtel
   */
  it("PlateWithHoles", () => {
    const geometryToSave: GeometryQuery[] = [];
    const a = 10;
    const b = 5;
    const c = 1;
    const r = 0.5;
    const plateBasePoints = [Point3d.create(0, 0), Point3d.create(a, 0), Point3d.create(a, b), Point3d.create(0, b), Point3d.create(0, 0)];
    const plateBaseLoop = Loop.createPolygon(plateBasePoints);
    const plateBaseWithHoles = ParityRegion.create(plateBaseLoop);
    const numCircle = 3;
    for (let i = 0; i < numCircle; i++) {
      const arc = Arc3d.createXY(Point3d.create(-0.5 * (i) * a / (numCircle + 1), b / 2), r,
        AngleSweep.createStartEndDegrees(180, -180));
      plateBaseWithHoles.tryAddChild(Loop.create(arc));
    }
    const plateSolidWithHoles = LinearSweep.create(plateBaseWithHoles, Vector3d.create(0, 0, c), true)!;
    let x0 = 0;
    const xStep = 2.0 * a;
    let y0 = 0;
    const yStep = 1.5 * b;
    GeometryCoreTestIO.captureCloneGeometry(geometryToSave, plateBaseWithHoles, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(geometryToSave, plateSolidWithHoles, x0, y0 += yStep);

    const builder0 = PolyfaceBuilder.create();
    builder0.addLinearSweep(plateSolidWithHoles);
    const mesh0 = builder0.claimPolyface();
    GeometryCoreTestIO.captureCloneGeometry(geometryToSave, mesh0, x0, y0 += yStep);

    x0 += xStep; y0 = 0;
    const plateBlankSolid = LinearSweep.createZSweep(plateBasePoints, 0, c, true)!;
    const builder = PolyfaceBuilder.create();
    builder.addLinearSweep(plateBlankSolid);
    let mesh1 = builder.claimPolyface();
    GeometryCoreTestIO.captureCloneGeometry(geometryToSave, mesh1, x0, y0);

    x0 += xStep;
    y0 = 0;
    // generate the holes as mesh clips with swept arcs converted ton ConvexClipPlaneSets . ..
    for (const baseLoop of plateBaseWithHoles.children) {
      if (baseLoop instanceof Loop && baseLoop.children[0] instanceof Arc3d) {
        const options = StrokeOptions.createForCurves();
        options.angleTol = Angle.createDegrees(90);
        const strokes = baseLoop.getPackedStrokes(options)!;
        const clipperA = ConvexClipPlaneSet.createSweptPolyline(strokes.getPoint3dArray(), Vector3d.create(0, 0, 1))!;
        const clipBuilderA = ClippedPolyfaceBuilders.create(true, true, true);
        PolyfaceClip.clipPolyfaceInsideOutside(mesh1, clipperA, clipBuilderA);
        GeometryCoreTestIO.captureCloneGeometry(geometryToSave, mesh1, x0, y0);
        GeometryCoreTestIO.captureCloneGeometry(geometryToSave, clipBuilderA.claimPolyface(1, true), x0 + xStep, y0);
        y0 += yStep;
        // Feed that clipped mesh forward to the next step.
        mesh1 = clipBuilderA.claimPolyface(1, true)!;
        break;
      }
    }
    // clean up the chicken-scratch clip lines (only visually, no geometry change in the mesh.)
    mesh1.data.compress();
    PolyfaceQuery.markPairedEdgesInvisible(mesh1, Angle.createDegrees(1));
    y0 += yStep;
    GeometryCoreTestIO.captureCloneGeometry(geometryToSave, mesh1, x0, y0);

    GeometryCoreTestIO.saveGeometry(geometryToSave, "MeshConstruction", "PlateWithHoles");
  });
});
