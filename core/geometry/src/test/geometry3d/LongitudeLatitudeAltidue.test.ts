/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { LongitudeLatitudeNumber } from "../../geometry3d/LongitudeLatitudeAltitude";
import { Checker } from "../Checker";

describe("LongitudeLatitudeNumber", () => {
  it("create", () => {
    const ck = new Checker();
    const createAsDegrees = LongitudeLatitudeNumber.createDegrees(10, 40, 5);
    const createAsRadians = LongitudeLatitudeNumber.createRadians(createAsDegrees.longitudeRadians, createAsDegrees.latitudeRadians, createAsDegrees.altitude);
    // "create" clones its angles . . .
    const createAsAngles = LongitudeLatitudeNumber.create(createAsDegrees.longitudeRef, createAsDegrees.latitudeRef, createAsDegrees.altitude);
    ck.testTrue(createAsDegrees.isAlmostEqual(createAsRadians), "asDegrees vs asRadians");
    ck.testTrue(createAsDegrees.isAlmostEqual(createAsAngles), "asDegrees vs asAngles");

    const cloneA = createAsDegrees.clone();
    ck.testTrue(cloneA.isAlmostEqual(createAsDegrees), "clone match");
    cloneA.latitudeRef.setDegrees(-createAsRadians.latitudeDegrees);
    cloneA.longitudeRef.setDegrees(-createAsRadians.longitudeDegrees);
    cloneA.altitude = -createAsRadians.altitude;
    const trueZero = LongitudeLatitudeNumber.createZero();
    const toJSON = createAsDegrees.toJSON();
    const fromJSON = LongitudeLatitudeNumber.createZero();
    fromJSON.setFromJSON(toJSON);
    const a = LongitudeLatitudeNumber.createDegrees(43, 25, 9);
    ck.testFalse(a.isAlmostEqual(trueZero));
    a.setFromJSON({});
    ck.testTrue(a.isAlmostEqual(trueZero), "setFromJSON defaults to zeros");

    const b = LongitudeLatitudeNumber.create(a.longitude, a.latitude, a.altitude);

    ck.testTrue(b.isAlmostEqual(a), "create with angle clones from donee");
    ck.testTrue(fromJSON.isAlmostEqual(createAsDegrees), "json round trip");

    ck.testFalse(createAsDegrees.isAlmostEqual(b));
    LongitudeLatitudeNumber.createRadians(a.longitudeRadians, a.latitudeRadians, a.altitude, b);
    ck.testTrue(b.isAlmostEqual(a));
    const c = LongitudeLatitudeNumber.createZero ();
    LongitudeLatitudeNumber.createDegrees(a.longitudeDegrees, a.latitudeDegrees, a.altitude, c);
    ck.testTrue(b.isAlmostEqual(c));

    const d = LongitudeLatitudeNumber.createZero ();
    LongitudeLatitudeNumber.create(a.longitude, a.latitude, a.altitude, d);
    ck.testTrue(b.isAlmostEqual(d));
    expect(ck.getNumErrors()).equals(0);
  });

});
