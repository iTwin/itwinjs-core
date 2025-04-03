/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Checker } from "../Checker.js";
import { Sample } from "../../serialization/GeometrySamples.js";
import { AkimaCurve3d } from "../../bspline/AkimaCurve3d.js";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO.js";
import { GeometryQuery } from "../../curve/GeometryQuery.js";
import { testGeometryQueryRoundTrip } from "../serialization/FlatBuffer.test.js";

describe("AkimaCurve3d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const circlePoints = Sample.createUnitCircle(8);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, circlePoints, 0, 0, 0);

    const curve = AkimaCurve3d.create({ fitPoints: circlePoints });
    ck.testDefined(curve);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve, 0, 0, 0);
    testGeometryQueryRoundTrip(ck, curve);
    GeometryCoreTestIO.saveGeometry(allGeometry, "AkimaCurve3d", "HelloWorld");
    expect(ck.getNumErrors()).toBe(0);
  });
});
