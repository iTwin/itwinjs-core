/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import EntityClass from "../../source/Metadata/EntityClass";
import { ECObjectsError } from "../../source/Exception";
import { Property, PrimitiveProperty } from "../../source/Metadata/Property";
import { PropertyType } from "../../source/PropertyTypes";
import { PrimitiveArrayProperty, EnumerationProperty, DelayedPromiseWithProps, StructProperty } from "../../source/index";
import Enumeration from "../../source/Metadata/Enumeration";
import { StructClass } from "../../source/Metadata/Class";

async function testInvalidAttribute(prop: Property, attributeName: string, expectedType: string, value: any) {
  expect(prop).to.exist;
  const json: any = {
    name: prop.name,
    [attributeName]: value,
  };
  await expect(prop.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Property ${prop.name} has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
}

describe("Property", () => {
  class MockProperty extends Property {
    constructor(name: string) {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      super(testClass, name, PropertyType.String);
    }
  }

  describe("fromJson", () => {
    it("should throw for invalid name", async () => {
      const propertyJson = { name: "ThisDoesNotMatch"};
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
    let testProperty: PrimitiveProperty;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      testProperty = new PrimitiveProperty(testClass, "TestProperty");
    });

    it("should throw for invalid minLength", async () => testInvalidAttribute(testProperty, "minLength", "number", "0"));
    it("should throw for invalid maxLength", async () => testInvalidAttribute(testProperty, "maxLength", "number", "0"));
    it("should throw for invalid minValue", async () => testInvalidAttribute(testProperty, "minValue", "number", "0"));
    it("should throw for invalid maxValue", async () => testInvalidAttribute(testProperty, "maxValue", "number", "0"));
    it("should throw for invalid extendedTypeName", async () => testInvalidAttribute(testProperty, "extendedTypeName", "string", 0));
  });
});

describe("EnumerationProperty", () => {
  describe("fromJson", () => {
    let testProperty: EnumerationProperty;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      const testEnum = new Enumeration(schema, "TestEnum");
      testProperty = new EnumerationProperty(testClass, "TestProperty", new DelayedPromiseWithProps(testEnum.key, async () => testEnum));
    });

    it("should throw for invalid typeName", async () => testInvalidAttribute(testProperty, "typeName", "string", 0));
    it("should throw for mismatched typeName", async () => {
      const propertyJson = { typeName: "ThisDoesNotMatch"};
      expect(testProperty).to.exist;
      await expect(testProperty.fromJson(propertyJson)).to.be.rejectedWith(ECObjectsError);
    });
  });
});

describe("StructProperty", () => {
  describe("fromJson", () => {
    let testProperty: StructProperty;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      const testStruct = new StructClass(schema, "TestStruct");
      testProperty = new StructProperty(testClass, "TestProperty", new DelayedPromiseWithProps(testStruct.key, async () => testStruct));
    });

    it("should throw for invalid typeName", async () => testInvalidAttribute(testProperty, "typeName", "string", 0));
    it("should throw for mismatched typeName", async () => {
      const propertyJson = { typeName: "ThisDoesNotMatch"};
      expect(testProperty).to.exist;
      await expect(testProperty.fromJson(propertyJson)).to.be.rejectedWith(ECObjectsError);
    });
  });
});

describe("PrimitiveArrayProperty", () => {
  describe("fromJson", () => {
    let testProperty: PrimitiveArrayProperty;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      testProperty = new PrimitiveArrayProperty(testClass, "TestProperty");
    });

    it("should throw for invalid minOccurs", async () => testInvalidAttribute(testProperty, "minOccurs", "number", "0"));
    it("should throw for invalid maxOccurs", async () => testInvalidAttribute(testProperty, "maxOccurs", "number", "0"));
  });
});
