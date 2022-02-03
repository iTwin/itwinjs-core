/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { PrimitiveType } from "../../ECObjects";
import { ECObjectsError } from "../../Exception";
import type { MutableEnumeration } from "../../Metadata/Enumeration";
import { Enumeration } from "../../Metadata/Enumeration";
import { Schema } from "../../Metadata/Schema";
import { createEmptyXmlDocument, getElementChildrenByTagName } from "../TestUtils/SerializationHelper";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

describe("Enumeration", () => {
  it("should get fullName", async () => {
    const schemaJson = createSchemaJsonWithItems({
      testEnum: {
        schemaItemType: "Enumeration",
        type: "string",
        description: "Test description",
        label: "Test Enumeration",
        isStrict: true,
        enumerators: [
          {
            name: "testEnumerator",
            value: "test",
          },
        ],
      },
    });

    const schema = await Schema.fromJson(schemaJson, new SchemaContext());
    assert.isDefined(schema);
    const testEnum = await schema.getItem<Enumeration>("testEnum");
    assert.isDefined(testEnum);
    expect(testEnum!.fullName).eq("TestSchema.testEnum");
  });

  describe("addEnumerator tests", () => {
    let testEnum: Enumeration;
    let testStringEnum: Enumeration;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.Integer);
      testStringEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.String);
    });
    it("Basic String Enumeration Test", async () => {
      (testStringEnum as MutableEnumeration).addEnumerator(testStringEnum.createEnumerator("Enum1", "Val1"));
      (testStringEnum as MutableEnumeration).addEnumerator(testStringEnum.createEnumerator("Enum2", "Val2"));
      (testStringEnum as MutableEnumeration).addEnumerator(testStringEnum.createEnumerator("Enum3", "Val3"));
      (testStringEnum as MutableEnumeration).addEnumerator(testStringEnum.createEnumerator("Enum4", "Val4"));
      assert.strictEqual(testStringEnum.enumerators.length, 4);
    });
    it("Basic Integer Enumeration Test", async () => {
      (testEnum as MutableEnumeration).addEnumerator(testEnum.createEnumerator("Enum1", 1));
      (testEnum as MutableEnumeration).addEnumerator(testEnum.createEnumerator("Enum2", 2));
      (testEnum as MutableEnumeration).addEnumerator(testEnum.createEnumerator("Enum3", 3));
      (testEnum as MutableEnumeration).addEnumerator(testEnum.createEnumerator("Enum4", 4));
      assert.strictEqual(testEnum.enumerators.length, 4);
    });
    it("Add duplicate enumerator", async () => {
      const newEnum = testStringEnum.createEnumerator("Enum1", "Val1");
      (testStringEnum as MutableEnumeration).addEnumerator(newEnum);
      assert.throws(() => testStringEnum.createEnumerator("Enum1", "Val1"), ECObjectsError, `The Enumeration TestEnumeration has a duplicate Enumerator with name 'Enum1'.`);
    });
    it("Add int enumerator to string enumeration", async () => {
      assert.throws(() => testStringEnum.createEnumerator("Enum1", 1), ECObjectsError, `The Enumeration TestEnumeration has a backing type 'string' and an enumerator with value of type 'integer'.`);
    });
    it("Add string enumerator to int enumeration", async () => {
      assert.throws(() => testEnum.createEnumerator("Enum1", "Value1"), ECObjectsError, `The Enumeration TestEnumeration has a backing type 'integer' and an enumerator with value of type 'string'.`);
    });
  });

  describe("deserialization", () => {
    it("minimum values", async () => {
      const testSchema = createSchemaJsonWithItems({
        testEnum: {
          schemaItemType: "Enumeration",
          type: "string",
          description: "Test description",
          label: "Test Enumeration",
          isStrict: true,
          enumerators: [
            {
              name: "testEnumerator",
              value: "test",
            },
          ],
        },
      });

      const ecSchema = await Schema.fromJson(testSchema, new SchemaContext());
      const testEnum = await ecSchema.getItem<Enumeration>("testEnum");
      assert.isDefined(testEnum);

      if (!testEnum)
        return;

      expect(testEnum.description).equal("Test description");
      expect(testEnum.label).equal("Test Enumeration");
      expect(testEnum.isStrict).equal(true);
    });

    it("with enumerators", async () => {
      const testSchema = createSchemaJsonWithItems({
        testEnum: {
          schemaItemType: "Enumeration",
          type: "int",
          enumerators: [
            {
              name: "ZeroValue",
              value: 0,
              label: "None",
            },
          ],
        },
      });

      const ecSchema = await Schema.fromJson(testSchema, new SchemaContext());
      const testEnum = await ecSchema.getItem<Enumeration>("testEnum");
      assert.isDefined(testEnum);
    });
  });

  describe("fromJson", () => {
    let testEnum: Enumeration;
    let testStringEnum: Enumeration;
    let testEnumSansPrimType: Enumeration;
    const baseJson = { schemaItemType: "Enumeration" };

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.Integer);
      testStringEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.String);
      testEnumSansPrimType = new Enumeration(schema, "TestEnumeration");
    });

    function assertValidEnumeration(enumeration: Enumeration) {
      expect(enumeration.name).to.eql("TestEnumeration");
      expect(enumeration.label).to.eql("SomeDisplayLabel");
      expect(enumeration.description).to.eql("A really long description...");
      expect(enumeration.isStrict).to.be.false;
      expect(enumeration.enumerators).to.exist;
      expect(enumeration.enumerators.length).to.eql(2);
    }
    function assertValidEnumerator(enumeration: Enumeration, enumVal: number | string, label?: string, description?: string) {
      if (typeof (enumVal) === "number") {
        expect(enumeration.isInt).to.be.true;
        expect(enumeration.isString).to.be.false;
        if (typeof (label) !== undefined)
          expect(enumeration.getEnumerator(enumVal)!.label).to.eql(label);
        if (typeof (description) !== undefined)
          expect(enumeration.getEnumerator(enumVal)!.description).to.eql(description);
      } else {
        expect(enumeration.isInt).to.be.false;
        expect(enumeration.isString).to.be.true;
        if (typeof (label) !== undefined)
          expect(enumeration.getEnumerator(enumVal)!.label).to.eql(label);
        if (typeof (description) !== undefined)
          expect(enumeration.getEnumerator(enumVal)!.description).to.eql(description);
      }
    }

    describe("should successfully deserialize valid JSON", () => {
      it("with type first specified in JSON", async () => {
        const json = {
          ...baseJson,
          type: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6 },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJSON(json);
        assertValidEnumeration(testEnumSansPrimType);
      });

      it("with type repeated in JSON", async () => {
        const json = {
          ...baseJson,
          type: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6 },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnum.fromJSON(json);
        assertValidEnumeration(testEnum);
      });
      it(`with type="string"`, async () => {
        const json = {
          ...baseJson,
          type: "string",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: "6" },
            { name: "EightValue", value: "8", label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJSON(json);
        assertValidEnumeration(testEnumSansPrimType);
      });
    });

    it("Duplicate name", async () => {
      const json = {
        ...baseJson,
        type: "int",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "SixValue", value: 6 },
          { name: "SixValue", value: 8, label: "An enumerator label" },
        ],
      };
      await expect(testEnum.fromJSON(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has a duplicate Enumerator with name 'SixValue'.`);
    });

    it("Duplicate value", async () => {
      const json = {
        ...baseJson,
        type: "int",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "SixValue", value: 6 },
          { name: "EightValue", value: 6 },
        ],
      };
      await expect(testEnum.fromJSON(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has a duplicate Enumerator with value '6'.`);
    });

    it("Basic test with number values", async () => {
      const json = {
        ...baseJson,
        type: "int",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "OneValue", value: 1, label: "Label for the first value", description: "description for the first value" },
          { name: "TwoValue", value: 2, label: "Label for the second value", description: "description for the second value" },
          { name: "ThreeValue", value: 3, label: "Label for the third value", description: "description for the third value" },
          { name: "FourValue", value: 4, label: "Label for the fourth value", description: "description for the fourth value" },
          { name: "FiveValue", value: 5, label: "Label for the fifth value", description: "description for the fifth value" },
        ],
      };
      await testEnum.fromJSON(json);
      assertValidEnumerator(testEnum, 1, "Label for the first value", "description for the first value");
      assertValidEnumerator(testEnum, 2, "Label for the second value", "description for the second value");
      assertValidEnumerator(testEnum, 3, "Label for the third value", "description for the third value");
      assertValidEnumerator(testEnum, 4, "Label for the fourth value", "description for the fourth value");
      assertValidEnumerator(testEnum, 5, "Label for the fifth value", "description for the fifth value");
    });

    it("Basic test with string values", async () => {
      const json = {
        ...baseJson,
        type: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "OneValue", value: "one", label: "Label for the first value", description: "description for the first value" },
          { name: "TwoValue", value: "two", label: "Label for the second value", description: "description for the second value" },
          { name: "ThreeValue", value: "three", label: "Label for the third value", description: "description for the third value" },
          { name: "FourValue", value: "four", label: "Label for the fourth value", description: "description for the fourth value" },
          { name: "FiveValue", value: "five", label: "Label for the fifth value", description: "description for the fifth value" },
        ],
      };
      await testStringEnum.fromJSON(json);
      assertValidEnumerator(testStringEnum, "one", "Label for the first value", "description for the first value");
      assertValidEnumerator(testStringEnum, "two", "Label for the second value", "description for the second value");
      assertValidEnumerator(testStringEnum, "three", "Label for the third value", "description for the third value");
      assertValidEnumerator(testStringEnum, "four", "Label for the fourth value", "description for the fourth value");
      assertValidEnumerator(testStringEnum, "five", "Label for the fifth value", "description for the fifth value");
    });

    it("ECName comparison is case insensitive", async () => {
      const json = {
        ...baseJson,
        type: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "ONEVALUE", value: "one", label: "Label for the first value", description: "description for the first value" },
          { name: "onevalue", value: "two", label: "Label for the second value", description: "description for the second value" },
        ],
      };
      await expect(testStringEnum.fromJSON(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has a duplicate Enumerator with name 'onevalue'.`);
    });

    it("Get enumerator by name", async () => {
      const json = {
        ...baseJson,
        type: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "OneValue", value: "one", label: "Label for the first value", description: "description for the first value" },
          { name: "TwoValue", value: "two", label: "Label for the second value", description: "description for the second value" },
          { name: "ThreeValue", value: "three", label: "Label for the third value", description: "description for the third value" },
          { name: "FourValue", value: "four", label: "Label for the fourth value", description: "description for the fourth value" },
          { name: "FiveValue", value: "five", label: "Label for the fifth value", description: "description for the fifth value" },
        ],
      };
      await testStringEnum.fromJSON(json);
      expect(testStringEnum.getEnumeratorByName("OneValue")).to.exist;
      expect(testStringEnum.getEnumeratorByName("onevalue")!.description).to.eql("description for the first value");
      expect(testStringEnum.getEnumeratorByName("fourVALUE")!.label).to.eql("Label for the fourth value");
    });

    it("Invalid ECName", async () => {
      const json = {
        ...baseJson,
        type: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "5FiveValue", value: "five", label: "Label for the fifth value", description: "description for the fifth value" },
        ],
      };
      await expect(testStringEnum.fromJSON(json)).to.be.rejectedWith(ECObjectsError, ``);
    });
  });

  describe("toJSON", () => {
    let testEnumSansPrimType: Enumeration;
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
      schemaItemType: "Enumeration",
      name: "TestEnumeration",
      schema: "TestSchema",
      schemaVersion: "1.0.0",
    };

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testEnumSansPrimType = new Enumeration(schema, "TestEnumeration");
    });
    describe("Basic serialization tests", () => {
      it("Simple int backingType test", async () => {
        const json = {
          ...baseJson,
          type: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6, description: "An enumerator description" },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJSON(json);
        const serialization = testEnumSansPrimType.toJSON(true, true);
        assert.isDefined(serialization);
        expect(serialization.type).eql("int");
        expect(serialization.isStrict).to.equal(false);
        expect(serialization.label).eql("SomeDisplayLabel");
        expect(serialization.description).eql("A really long description...");
        expect(serialization.enumerators[0].name).eql("SixValue");
        expect(serialization.enumerators[0].value).to.equal(6);
        expect(serialization.enumerators[0].description).eql("An enumerator description");
        expect(serialization.enumerators[1].name).eql("EightValue");
        expect(serialization.enumerators[1].value).to.equal(8);
        expect(serialization.enumerators[1].label).eql("An enumerator label");
      });
      it("Simple string backingType test", async () => {
        const json = {
          ...baseJson,
          type: "string",
          isStrict: true,
          enumerators: [
            { name: "SixValue", value: "six", label: "Six label", description: "SixValue enumerator description" },
            { name: "EightValue", value: "eight", label: "Eight label", description: "EightValue enumerator description" },
          ],
        };
        await testEnumSansPrimType.fromJSON(json);
        const serialization = testEnumSansPrimType.toJSON(true, true);
        assert.isDefined(serialization);
        expect(serialization.type).eql("string");
        expect(serialization.isStrict).to.equal(true);
        expect(serialization.enumerators[0].name).eql("SixValue");
        expect(serialization.enumerators[0].value).eql("six");
        expect(serialization.enumerators[0].label).eql("Six label");
        expect(serialization.enumerators[0].description).eql("SixValue enumerator description");

        expect(serialization.enumerators[1].name).eql("EightValue");
        expect(serialization.enumerators[1].value).eql("eight");
        expect(serialization.enumerators[1].label).eql("Eight label");
        expect(serialization.enumerators[1].description).eql("EightValue enumerator description");
      });
      it(`No name with type="string"`, async () => {
        const json = {
          ...baseJson,
          type: "string",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "AValue", value: "A" },
            { name: "BValue", value: "B" },
          ],
        };
        await testEnumSansPrimType.fromJSON(json);
        const serialization = testEnumSansPrimType.toJSON(true, true);
        assert.isDefined(serialization);
        expect(serialization.enumerators[0].value).eql("A");
        expect(serialization.enumerators[0].name).eql("AValue");
        expect(serialization.enumerators[1].name).eql("BValue");
        expect(serialization.enumerators[1].value).eql("B");
      });
      it(`No name with type="int"`, async () => {
        const json = {
          ...baseJson,
          type: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "TwoValue", value: 2 },
            { name: "FourValue", value: 4 },
          ],
        };
        await testEnumSansPrimType.fromJSON(json);
        const serialization = testEnumSansPrimType.toJSON(true, true);
        assert.isDefined(serialization);
        expect(serialization.enumerators[0].value).eql(2);
        expect(serialization.enumerators[1].value).eql(4);
      });
    });
    describe("JSON stringify serialization tests", () => {
      it("Simple int backingType test", async () => {
        const json = {
          ...baseJson,
          type: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6, description: "An enumerator description" },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJSON(json);
        const enumJson = JSON.stringify(testEnumSansPrimType);
        const serialization = JSON.parse(enumJson);
        assert.isDefined(serialization);
        expect(serialization.type).eql("int");
        expect(serialization.isStrict).to.equal(false);
        expect(serialization.label).eql("SomeDisplayLabel");
        expect(serialization.description).eql("A really long description...");
        expect(serialization.enumerators[0].name).eql("SixValue");
        expect(serialization.enumerators[0].value).to.equal(6);
        expect(serialization.enumerators[0].description).eql("An enumerator description");
        expect(serialization.enumerators[1].name).eql("EightValue");
        expect(serialization.enumerators[1].value).to.equal(8);
        expect(serialization.enumerators[1].label).eql("An enumerator label");
      });
      it("Simple string backingType test", async () => {
        const json = {
          ...baseJson,
          type: "string",
          isStrict: true,
          enumerators: [
            { name: "SixValue", value: "six", label: "Six label", description: "SixValue enumerator description" },
            { name: "EightValue", value: "eight", label: "Eight label", description: "EightValue enumerator description" },
          ],
        };
        await testEnumSansPrimType.fromJSON(json);
        const enumJson = JSON.stringify(testEnumSansPrimType);
        const serialization = JSON.parse(enumJson);
        assert.isDefined(serialization);
        expect(serialization.type).eql("string");
        expect(serialization.isStrict).to.equal(true);
        expect(serialization.enumerators[0].name).eql("SixValue");
        expect(serialization.enumerators[0].value).eql("six");
        expect(serialization.enumerators[0].label).eql("Six label");
        expect(serialization.enumerators[0].description).eql("SixValue enumerator description");

        expect(serialization.enumerators[1].name).eql("EightValue");
        expect(serialization.enumerators[1].value).eql("eight");
        expect(serialization.enumerators[1].label).eql("Eight label");
        expect(serialization.enumerators[1].description).eql("EightValue enumerator description");
      });
    });
  });

  describe("toXml", () => {
    const newDom = createEmptyXmlDocument();
    let testEnumeration: Enumeration;
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
      schemaItemType: "Enumeration",
      name: "TestEnumeration",
      schema: "TestSchema",
      schemaVersion: "1.0.0",
    };

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testEnumeration = new Enumeration(schema, "TestEnumeration");
    });

    it("should serialize properly for 'int' type", async () => {
      const schemaJson = {
        ...baseJson,
        type: "int",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "SixValue", value: 6, description: "An enumerator description" },
          { name: "EightValue", value: 8, label: "An enumerator label" },
        ],
      };

      await testEnumeration.fromJSON(schemaJson);
      const serialized = await testEnumeration.toXml(newDom);
      expect(serialized.nodeName).to.eql("ECEnumeration");
      expect(serialized.getAttribute("backingTypeName")).to.eql("int");
      expect(serialized.getAttribute("isStrict")).to.eql("false");

      const enumerators = getElementChildrenByTagName(serialized, "ECEnumerator");
      assert.strictEqual(enumerators.length, 2);

      const sixValue = enumerators[0];
      expect(sixValue.getAttribute("name")).to.eql("SixValue");
      expect(sixValue.getAttribute("value")).to.eql("6");
      expect(sixValue.getAttribute("description")).to.eql("An enumerator description");

      const eightValue = enumerators[1];
      expect(eightValue.getAttribute("name")).to.eql("EightValue");
      expect(eightValue.getAttribute("value")).to.eql("8");
      expect(eightValue.getAttribute("displayLabel")).to.eql("An enumerator label");
    });

    it("should serialize properly for 'string type", async () => {
      const schemaJson = {
        ...baseJson,
        type: "string",
        isStrict: true,
        enumerators: [
          { name: "SixValue", value: "six", label: "Six label", description: "SixValue enumerator description" },
          { name: "EightValue", value: "eight", label: "Eight label", description: "EightValue enumerator description" },
        ],
      };

      await testEnumeration.fromJSON(schemaJson);
      const serialized = await testEnumeration.toXml(newDom);
      expect(serialized.nodeName).to.eql("ECEnumeration");
      expect(serialized.getAttribute("backingTypeName")).to.eql("string");
      expect(serialized.getAttribute("isStrict")).to.eql("true");

      const enumerators = getElementChildrenByTagName(serialized, "ECEnumerator");
      assert.strictEqual(enumerators.length, 2);

      const sixValue = enumerators[0];
      expect(sixValue.getAttribute("name")).to.eql("SixValue");
      expect(sixValue.getAttribute("value")).to.eql("six");
      expect(sixValue.getAttribute("description")).to.eql("SixValue enumerator description");
      expect(sixValue.getAttribute("displayLabel")).to.eql("Six label");

      const eightValue = enumerators[1];
      expect(eightValue.getAttribute("name")).to.eql("EightValue");
      expect(eightValue.getAttribute("value")).to.eql("eight");
      expect(eightValue.getAttribute("description")).to.eql("EightValue enumerator description");
      expect(eightValue.getAttribute("displayLabel")).to.eql("Eight label");
    });
  });
});
