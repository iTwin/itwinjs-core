/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { expect } from "chai";
import {OffsetMeshContext} from "../../polyface/multiclip/OffsetMeshContext";
import { LineString3d } from "../../curve/LineString3d";
import { Arc3d } from "../../curve/Arc3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
describe("OffsetMeshContext", () => {

  it("SimpleOffsets", () => {
    const ck = new Checker();
    const x0 = 0;
    const y0 = 0;
    const allGeometry: GeometryQuery[] = [];
    const options = StrokeOptions.createForFacets();
    options.shouldTriangulate = true;
    const builder = PolyfaceBuilder.create(options);
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(4, 0, 0), Point3d.create(3, 3, 0), Point3d.create(0, 4, 0))!;
    const strokes = LineString3d.create();
    arc.emitStrokes(strokes, options);
    const coneA = Point3d.create(0, 0, 5);
    // upward cone
    builder.addTriangleFan(coneA, strokes, false);
    const polyface = builder.claimPolyface();
    const offsetBuilder = PolyfaceBuilder.create(options);
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, polyface, x0, y0);
    OffsetMeshContext.buildOffsetMesh (polyface, offsetBuilder, 0.1);
    const offset0 = offsetBuilder.claimPolyface ();
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, offset0, x0, y0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "AddTriangleFan");
    expect(ck.getNumErrors()).equals(0);
  });
});
