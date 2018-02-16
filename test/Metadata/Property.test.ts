/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { ECObjectsError } from "../../source/Exception";
import { Property, PrimitiveProperty } from "../../source/Metadata/Property";
import { PropertyType } from "../../source/PropertyTypes";
import { PrimitiveArrayProperty } from "../../source/index";

async function testInvalidAttribute(prop: Property, attributeName: string, expectedType: string, value: any) {
  const json: any = { name: prop.name };
  json[attributeName] = value;

  expect(prop).to.exist;
  await expect(prop.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Property BadProp has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
}

describe("Property", () => {
  class MockProperty extends Property {
    constructor(name: string) { super(name, PropertyType.String); }
  }

  describe("fromJson", () => {

    it("should throw for missing name", async () => {
      const propertyJson = {};
      const testProp = new MockProperty("BadProp");
      expect(testProp).to.exist;
      await expect(testProp.fromJson(propertyJson)).to.be.rejectedWith(ECObjectsError);
    });

    it("should throw for invalid label", async () => testInvalidAttribute(new MockProperty("BadProp"), "label", "string", 0));
    it("should throw for invalid description", async () => testInvalidAttribute(new MockProperty("BadProp"), "description", "string", 0));
    it("should throw for invalid priority", async () => testInvalidAttribute(new MockProperty("BadProp"), "priority", "number", "0"));
    it("should throw for invalid readOnly", async () => testInvalidAttribute(new MockProperty("BadProp"), "readOnly", "boolean", 0));
    it("should throw for invalid category", async () => testInvalidAttribute(new MockProperty("BadProp"), "category", "string", 0));
    it("should throw for invalid kindOfQuantity", async () => testInvalidAttribute(new MockProperty("BadProp"), "kindOfQuantity", "string", 0));
  });
});

describe("PrimitiveProperty", () => {
  describe("fromJson", () => {
      it("should throw for invalid minLength", async () => testInvalidAttribute(new PrimitiveProperty("BadProp"), "minLength", "number", "0"));
      it("should throw for invalid maxLength", async () => testInvalidAttribute(new PrimitiveProperty("BadProp"), "maxLength", "number", "0"));
      it("should throw for invalid minValue", async () => testInvalidAttribute(new PrimitiveProperty("BadProp"), "minValue", "number", "0"));
      it("should throw for invalid maxValue", async () => testInvalidAttribute(new PrimitiveProperty("BadProp"), "maxValue", "number", "0"));
      it("should throw for invalid extendedTypeName", async () => testInvalidAttribute(new PrimitiveProperty("BadProp"), "extendedTypeName", "string", 0));
  });
});

describe("PrimitiveArrayProperty", () => {
  describe("fromJson", () => {
      it("should throw for invalid minOccurs", async () => testInvalidAttribute(new PrimitiveArrayProperty("BadProp"), "minOccurs", "number", "0"));
      it("should throw for invalid maxOccurs", async () => testInvalidAttribute(new PrimitiveArrayProperty("BadProp"), "maxOccurs", "number", "0"));
  });
});
