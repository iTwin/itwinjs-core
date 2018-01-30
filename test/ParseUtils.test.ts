/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { parsePrimitiveType, PrimitiveType, tryParsePrimitiveType } from "../source/ECObjects";
import { ECObjectsError } from "Exception";

describe("Test parse utils", () => {
  it("primitive types", () => {
    expect(parsePrimitiveType("binary")).equal(PrimitiveType.Binary);
    expect(parsePrimitiveType("bool")).equal(PrimitiveType.Boolean);
    expect(parsePrimitiveType("boolean")).equal(PrimitiveType.Boolean);
    expect(parsePrimitiveType("dateTime")).equal(PrimitiveType.DateTime);
    expect(parsePrimitiveType("double")).equal(PrimitiveType.Double);
    expect(parsePrimitiveType("Bentley.Geometry.Common.IGeometry")).equal(PrimitiveType.IGeometry);
    expect(parsePrimitiveType("int")).equal(PrimitiveType.Integer);
    expect(parsePrimitiveType("long")).equal(PrimitiveType.Long);
    expect(parsePrimitiveType("point2d")).equal(PrimitiveType.Point2d);
    expect(parsePrimitiveType("point3d")).equal(PrimitiveType.Point3d);
    expect(parsePrimitiveType("string")).equal(PrimitiveType.String);
    expect(() => parsePrimitiveType("invalid type")).to.throw(ECObjectsError, "The string 'invalid type' is not one of the 10 supported primitive types.");

    expect(tryParsePrimitiveType("BInaRy")).equal(PrimitiveType.Binary);
    expect(tryParsePrimitiveType("BoOL")).equal(PrimitiveType.Boolean);
    expect(tryParsePrimitiveType("boolean")).equal(PrimitiveType.Boolean);
    expect(tryParsePrimitiveType("DaTEtime")).equal(PrimitiveType.DateTime);
    expect(tryParsePrimitiveType("DouBlE")).equal(PrimitiveType.Double);
    expect(tryParsePrimitiveType("beNTlEY.gEoMeTrY.CoMmoN.igeOMeTRY")).equal(PrimitiveType.IGeometry);
    expect(tryParsePrimitiveType("INt")).equal(PrimitiveType.Integer);
    expect(tryParsePrimitiveType("loNG")).equal(PrimitiveType.Long);
    expect(tryParsePrimitiveType("PoInt2d")).equal(PrimitiveType.Point2d);
    expect(tryParsePrimitiveType("POinT3d")).equal(PrimitiveType.Point3d);
    expect(tryParsePrimitiveType("STrINg")).equal(PrimitiveType.String);
    expect(tryParsePrimitiveType("inVAlId")).equal(undefined);
  });
});
