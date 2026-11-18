/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { EntityMetaData, EntityProps, isPersisted, PrimitiveTypeCode } from "../EntityProps";

describe("isPersisted", () => {
  const props: EntityProps = { classFullName: "BisCore:Element" };

  it("returns false when the id is missing", () => {
    expect(isPersisted(props)).to.be.false;
  });

  it("returns false when the id is 0", () => {
    expect(isPersisted({ ...props, id: "0" })).to.be.false;
  });

  it("returns false when the id is malformed", () => {
    expect(isPersisted({ ...props, id: "not-an-id" })).to.be.false;
  });

  it("returns true when the id is valid", () => {
    expect(isPersisted({ ...props, id: "0x1" })).to.be.true;
  });
});

describe("EntityMetaData", () => {
  it("keeps properties named like Object.prototype members as own properties", () => {
    // Parsing JSON text makes `__proto__` an own key, the same way the backend receives class metadata.
    const json = JSON.parse(`{
      "classId": "0x1", "ecclass": "TestSchema:Thing", "baseClasses": [],
      "properties": { "__proto__": { "primitiveType": ${PrimitiveTypeCode.String} }, "constructor": { "primitiveType": ${PrimitiveTypeCode.Integer} } }
    }`);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const metaData = new EntityMetaData(json);

    expect(Object.getPrototypeOf(metaData.properties)).toBe(Object.prototype);
    expect(Object.keys(metaData.properties)).toEqual(["__proto__", "constructor"]);
    expect(Object.getOwnPropertyDescriptor(metaData.properties, "__proto__")?.value.primitiveType).toBe(PrimitiveTypeCode.String);
    expect(Object.getOwnPropertyDescriptor(metaData.properties, "constructor")?.value.primitiveType).toBe(PrimitiveTypeCode.Integer);
  });
});
