/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// import { Point3d, Vector3d } from "../PointVector";
// import { Range1d } from "../Range";
// import { Matrix3d, Transform } from "../geometry3d/Transform";

import { TransitionConditionalProperties, TransitionSpiral3d } from "../curve/TransitionSpiral";
import { Angle } from "../geometry3d/Angle";
import { Checker } from "./Checker";
import { expect } from "chai";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { Transform } from "../geometry3d/Transform";
import { Segment1d } from "../geometry3d/Segment1d";

describe("TransitionSprialProperties", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const b0 = Angle.createDegrees(10);
    const b1 = Angle.createDegrees(25);
    const r0 = 0.0;
    const r1 = 1000.0;
    const dataA = new TransitionConditionalProperties(r0, r1, b0.clone(), b1.clone(), undefined);
    ck.testTrue(dataA.tryResolveAnySingleUnknown(), "resolve length");
    ck.testTrue(dataA.curveLength !== undefined);
    const lengthA = dataA.curveLength as number;
    const dataB = new TransitionConditionalProperties(undefined, r1, b0.clone(), b1.clone(), lengthA);
    const dataC = new TransitionConditionalProperties(r0, undefined, b0.clone(), b1.clone(), lengthA);
    const dataD = new TransitionConditionalProperties(r0, r1, undefined, b1.clone(), lengthA);
    const dataE = new TransitionConditionalProperties(r0, r1, b0.clone(), undefined, lengthA);

    ck.testFalse(dataA.isAlmostEqual(dataB), "A B");
    ck.testFalse(dataA.isAlmostEqual(dataC), "A C");
    ck.testFalse(dataA.isAlmostEqual(dataD), "A D");
    ck.testFalse(dataA.isAlmostEqual(dataE), "A E");
    ck.testFalse(dataD.isAlmostEqual(dataE), "D E");

    ck.testTrue(dataB.tryResolveAnySingleUnknown(), "resolve r0");
    ck.testTrue(dataC.tryResolveAnySingleUnknown(), "resolve r1");
    ck.testTrue(dataD.tryResolveAnySingleUnknown(), "resolve bearing0");
    ck.testTrue(dataE.tryResolveAnySingleUnknown(), "resolve bearing1");

    ck.testTrue(dataA.isAlmostEqual(dataB), "dataB");
    ck.testTrue(dataA.isAlmostEqual(dataC), "dataC");
    ck.testTrue(dataA.isAlmostEqual(dataD), "dataD");
    ck.testTrue(dataA.isAlmostEqual(dataE), "dataE");
  });
  it("CreateAndPoke", () => {
    const ck = new Checker();
    const spiralA = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(0, 1), Transform.createIdentity());
    const spiralB = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(1000, 0), AngleSweep.createStartEndDegrees(10, 3), Segment1d.create(0, 1), Transform.createIdentity());
    ck.testFalse(spiralB.isAlmostEqual(spiralA));
    spiralB.setFrom(spiralA);
    ck.testTrue(spiralA.isAlmostEqual(spiralB));
    expect(ck.getNumErrors()).equals(0);
  });
});
