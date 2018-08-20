/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../src/Metadata/Schema";
import Enumeration, { MutableEnumeration } from "../../src/Metadata/Enumeration";
import { ECObjectsError } from "../../src/Exception";
import { PrimitiveType } from "../../src/ECObjects";
import * as sinon from "sinon";

describe("Enumeration", () => {
  describe("accept", () => {
    let testEnum: Enumeration;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.Integer);
    });

    it("should call visitEnumeration on a SchemaItemVisitor object", async () => {
      expect(testEnum).to.exist;
      const mockVisitor = { visitEnumeration: sinon.spy() };
      await testEnum.accept(mockVisitor);
      expect(mockVisitor.visitEnumeration.calledOnce).to.be.true;
      expect(mockVisitor.visitEnumeration.calledWithExactly(testEnum)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitEnumeration defined", async () => {
      expect(testEnum).to.exist;
      await testEnum.accept({});
    });
  });

  describe("addEnumerator tests", () => {
    let testEnum: Enumeration;
    let testStringEnum: Enumeration;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.Integer);
      testStringEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.String);
    });
    it("Basic String Enumeration Test", async () => {
      (testStringEnum as MutableEnumeration).addEnumerator(testStringEnum.createEnumerator("Enum1", "Val1"));
      (testStringEnum as MutableEnumeration).addEnumerator(testStringEnum.createEnumerator("Enum2", "Val2"));
      (testStringEnum as MutableEnumeration).addEnumerator(testStringEnum.createEnumerator("Enum3", "Val3"));
      (testStringEnum as MutableEnumeration).addEnumerator(testStringEnum.createEnumerator("Enum4", "Val4"));
      assert(testStringEnum.enumerators.length === 4);
    });
    it("Basic Integer Enumeration Test", async () => {
      (testEnum as MutableEnumeration).addEnumerator(testEnum.createEnumerator("Enum1", 1));
      (testEnum as MutableEnumeration).addEnumerator(testEnum.createEnumerator("Enum2", 2));
      (testEnum as MutableEnumeration).addEnumerator(testEnum.createEnumerator("Enum3", 3));
      (testEnum as MutableEnumeration).addEnumerator(testEnum.createEnumerator("Enum4", 4));
      assert(testEnum.enumerators.length === 4);
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
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testEnum: {
            schemaItemType: "Enumeration",
            backingTypeName: "string",
            description: "Test description",
            label: "Test Enumeration",
            isStrict: true,
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema);
      const testEnum = await ecSchema.getItem<Enumeration>("testEnum");
      assert.isDefined(testEnum);

      if (!testEnum)
        return;

      expect(testEnum.description).equal("Test description");
      expect(testEnum.label).equal("Test Enumeration");
      expect(testEnum.isStrict).equal(true);
    });

    it("with enumerators", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testEnum: {
            schemaItemType: "Enumeration",
            backingTypeName: "integer",
            enumerators: [
              {
                name: "ZeroValue",
                value: 0,
                label: "None",
              },
            ],
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema);
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
      const schema = new Schema("TestSchema", 1, 0, 0);
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
      it("with backingTypeName first specified in JSON", async () => {
        const json = {
          ...baseJson,
          backingTypeName: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6 },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        assertValidEnumeration(testEnumSansPrimType);
      });

      it("with backingTypeName repeated in JSON", async () => {
        const json = {
          ...baseJson,
          backingTypeName: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6 },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnum.fromJson(json);
        assertValidEnumeration(testEnum);
      });

      it("with backingTypeName omitted in JSON", async () => {
        const json = {
          ...baseJson,
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6 },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnum.fromJson(json);
        assertValidEnumeration(testEnum);
      });

      it(`with backingTypeName="string"`, async () => {
        const json = {
          ...baseJson,
          backingTypeName: "string",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: "6" },
            { name: "EightValue", value: "8", label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        assertValidEnumeration(testEnumSansPrimType);
      });

      it(`no name with backingTypeName="string"`, async () => {
        const json = {
          ...baseJson,
          backingTypeName: "string",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { value: "A" },
            { value: "B" },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        assertValidEnumeration(testEnumSansPrimType);

        expect(testEnumSansPrimType.enumerators[0].name).eql("A");
        expect(testEnumSansPrimType.enumerators[1].name).eql("B");
      });

      it(`no name with backingTypeName="int"`, async () => {
        const json = {
          ...baseJson,
          backingTypeName: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { value: 6 },
            { value: 8 },
          ],
        };
        await testEnum.fromJson(json);
        assertValidEnumeration(testEnum);

        expect(testEnum.enumerators[0].name).eql("TestEnumeration6");
        expect(testEnum.enumerators[1].name).eql("TestEnumeration8");
      });
    });

    it("should throw for missing backingTypeName", async () => {
      expect(testEnumSansPrimType).to.exist;
      const json: any = { ...baseJson };
      await expect(testEnumSansPrimType.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration is missing the required 'backingTypeName' attribute.`);
    });

    it("should throw for invalid backingTypeName", async () => {
      expect(testEnum).to.exist;
      expect(testEnumSansPrimType).to.exist;
      let json: any = { ...baseJson, backingTypeName: 0 };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'backingTypeName' attribute. It should be of type 'string'.`);
      await expect(testEnumSansPrimType.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'backingTypeName' attribute. It should be of type 'string'.`);

      json = { ...baseJson, backingTypeName: "ThisIsNotRight" };
      await expect(testEnumSansPrimType.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'backingTypeName' attribute. It should be either "int" or "string".`);
    });

    it("should throw for invalid isStrict", async () => {
      expect(testEnum).to.exist;
      const json: any = { ...baseJson, isStrict: 0 };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'isStrict' attribute. It should be of type 'boolean'.`);
    });

    it("should throw for mismatched backingTypeName", async () => {
      expect(testEnum).to.exist;
      let json: any = { ...baseJson, backingTypeName: "string" };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an incompatible backingTypeName. It must be "int", not "string".`);

      expect(testStringEnum).to.exist;
      json = { ...baseJson, backingTypeName: "int" };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an incompatible backingTypeName. It must be "string", not "int".`);
    });

    it("should throw for enumerators not an array", async () => {
      expect(testEnum).to.exist;
      const json: any = { ...baseJson, enumerators: 0 };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);
    });

    it("should throw for enumerators not an array of objects", async () => {
      expect(testEnum).to.exist;
      const json: any = { ...baseJson, enumerators: [0] };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);
    });
    it("Duplicate name", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "int",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "SixValue", value: 6 },
          { name: "SixValue", value: 8, label: "An enumerator label" },
        ],
      };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has a duplicate Enumerator with name 'SixValue'.`);
    });
    it("Duplicate value", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "int",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "SixValue", value: 6 },
          { name: "EightValue", value: 6 },
        ],
      };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has a duplicate Enumerator with value '6'.`);
    });
    it("Basic test with number values", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "int",
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
      await testEnum.fromJson(json);
      assertValidEnumerator(testEnum, 1, "Label for the first value", "description for the first value");
      assertValidEnumerator(testEnum, 2, "Label for the second value", "description for the second value");
      assertValidEnumerator(testEnum, 3, "Label for the third value", "description for the third value");
      assertValidEnumerator(testEnum, 4, "Label for the fourth value", "description for the fourth value");
      assertValidEnumerator(testEnum, 5, "Label for the fifth value", "description for the fifth value");
    });
    it("Basic test with string values", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
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
      await testStringEnum.fromJson(json);
      assertValidEnumerator(testStringEnum, "one", "Label for the first value", "description for the first value");
      assertValidEnumerator(testStringEnum, "two", "Label for the second value", "description for the second value");
      assertValidEnumerator(testStringEnum, "three", "Label for the third value", "description for the third value");
      assertValidEnumerator(testStringEnum, "four", "Label for the fourth value", "description for the fourth value");
      assertValidEnumerator(testStringEnum, "five", "Label for the fifth value", "description for the fifth value");
    });
    it("ECName comparison is case insensitive", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "ONEVALUE", value: "one", label: "Label for the first value", description: "description for the first value" },
          { name: "onevalue", value: "two", label: "Label for the second value", description: "description for the second value" },
        ],
      };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has a duplicate Enumerator with name 'onevalue'.`);
    });
    it("Description is not a string", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "ONEVALUE", value: "one", label: "Label for the first value", description: 1 },
        ],
      };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator with an invalid 'description' attribute. It should be of type 'string'.`);
    });
    it("Get enumerator by name", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
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
      await testStringEnum.fromJson(json);
      expect(testStringEnum.getEnumeratorByName("OneValue")).to.exist;
      expect(testStringEnum.getEnumeratorByName("onevalue")!.description).to.eql("description for the first value");
      expect(testStringEnum.getEnumeratorByName("fourVALUE")!.label).to.eql("Label for the fourth value");
    });
    it("Name is required", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { value: "one", label: "Label for the first value", description: "Description for the first value" },
        ],
      };
      Schema.ec32 = true;
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator that is missing the required attribute 'name'.`);
      Schema.ec32 = false;
    });
    it("Value is required", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "one", label: "Label for the first value", description: "Description for the first value" },
        ],
      };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator that is missing the required attribute 'value'.`);
    });
    it("Invalid ECName", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "5FiveValue", value: "five", label: "Label for the fifth value", description: "description for the fifth value" },
        ],
      };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, ``);
    });
  });
  describe("toJson", () => {
    let testEnumSansPrimType: Enumeration;
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
      schemaItemType: "Enumeration",
      name: "TestEnumeration",
      schema: "TestSchema",
      schemaVersion: "1.0.0",
    };

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testEnumSansPrimType = new Enumeration(schema, "TestEnumeration");
    });
    describe("Basic serialization tests", () => {
      it("Simple int backingType test", async () => {
        const json = {
          ...baseJson,
          backingTypeName: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6, description: "An enumerator description" },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        const serialization = testEnumSansPrimType.toJson(true, true);
        assert.isDefined(serialization);
        expect(serialization.backingTypeName).eql("int");
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
          backingTypeName: "string",
          isStrict: true,
          enumerators: [
            { name: "SixValue", value: "six", label: "Six label", description: "SixValue enumerator description" },
            { name: "EightValue", value: "eight", label: "Eight label", description: "EightValue enumerator description" },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        const serialization = testEnumSansPrimType.toJson(true, true);
        assert.isDefined(serialization);
        expect(serialization.backingTypeName).eql("string");
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
      it(`No name with backingTypeName="string"`, async () => {
        const json = {
          ...baseJson,
          backingTypeName: "string",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "AValue", value: "A" },
            { name: "BValue", value: "B" },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        const serialization = testEnumSansPrimType.toJson(true, true);
        assert.isDefined(serialization);
        expect(serialization.enumerators[0].value).eql("A");
        expect(serialization.enumerators[0].name).eql("AValue");
        expect(serialization.enumerators[1].name).eql("BValue");
        expect(serialization.enumerators[1].value).eql("B");
      });
      it(`No name with backingTypeName="int"`, async () => {
        const json = {
          ...baseJson,
          backingTypeName: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "TwoValue", value: 2 },
            { name: "FourValue", value: 4 },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        const serialization = testEnumSansPrimType.toJson(true, true);
        assert.isDefined(serialization);
        expect(serialization.enumerators[0].value).eql(2);
        expect(serialization.enumerators[1].value).eql(4);
      });
    });
  });
});
