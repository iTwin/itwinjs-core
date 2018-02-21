/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import Enumeration from "../../source/Metadata/Enumeration";
import { ECObjectsError } from "../../source/Exception";
import { PrimitiveType } from "../../source/ECObjects";

describe("Enumeration", () => {
  describe("deserialization", () => {
    it("minimum values", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testEnum: {
            schemaChildType: "Enumeration",
            backingTypeName: "string",
            description: "Test description",
            label: "Test Enumeration",
            isStrict: true,
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema);
      const testEnum = await ecSchema.getChild<Enumeration>("testEnum");
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
        children: {
          testEnum: {
            schemaChildType: "Enumeration",
            backingTypeName: "integer",
            enumerators: [
              {
                value: 0,
                label: "None",
              },
            ],
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema);
      const testEnum = await ecSchema.getChild<Enumeration>("testEnum");
      assert.isDefined(testEnum);
    });
  });

  describe("fromJson", () => {
    let testEnum: Enumeration;
    let testStringEnum: Enumeration;
    let testEnumSansPrimType: Enumeration;
    const baseJson = { schemaChildType: "Enumeration" };

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.Integer);
      testStringEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.String);
      testEnumSansPrimType = new Enumeration(schema, "TestEnumeration");
    });

    describe("should successfully deserialize valid JSON", () => {
      function assertValidEnumeration(enumeration: Enumeration) {
        expect(enumeration.name).to.eql("TestEnumeration");
        expect(enumeration.label).to.eql("SomeDisplayLabel");
        expect(enumeration.description).to.eql("A really long description...");
        expect(enumeration.isStrict).to.be.false;
        expect(enumeration.enumerators).to.exist;
        expect(enumeration.enumerators.length).to.eql(2);
      }
      function assertValidIntEnumeration(enumeration: Enumeration) {
        assertValidEnumeration(enumeration);
        expect(enumeration.isInt()).to.be.true;
        expect(enumeration.isString()).to.be.false;
        expect(enumeration.getEnumerator(8)).to.exist;
        expect(enumeration.getEnumerator(8)!.label).to.eql("An enumerator label");
      }
      function assertValidStringEnumeration(enumeration: Enumeration) {
        assertValidEnumeration(enumeration);
        expect(enumeration.isInt()).to.be.false;
        expect(enumeration.isString()).to.be.true;
        expect(enumeration.getEnumerator("8")).to.exist;
        expect(enumeration.getEnumerator("8")!.label).to.eql("An enumerator label");
      }

      it("with backingTypeName first specified in JSON", async () => {
        const json = {
          ...baseJson,
          backingTypeName: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { value: 6 },
            { value: 8, label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        assertValidIntEnumeration(testEnumSansPrimType);
      });

      it("with backingTypeName repeated in JSON", async () => {
        const json = {
          ...baseJson,
          backingTypeName: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { value: 6 },
            { value: 8, label: "An enumerator label" },
          ],
        };
        await testEnum.fromJson(json);
        assertValidIntEnumeration(testEnum);
      });

      it("with backingTypeName omitted in JSON", async () => {
        const json = {
          ...baseJson,
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { value: 6 },
            { value: 8, label: "An enumerator label" },
          ],
        };
        await testEnum.fromJson(json);
        assertValidIntEnumeration(testEnum);
      });

      it(`with backingTypeName="string"`, async () => {
        const json = {
          ...baseJson,
          backingTypeName: "string",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { value: "6" },
            { value: "8", label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        assertValidStringEnumeration(testEnumSansPrimType);
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

    it("should throw for enumerator with missing value", async () => {
      expect(testEnum).to.exist;
      const json: any = { ...baseJson, enumerators: [{}] };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator that is missing the required attribute 'value'.`);
    });

    it("should throw for enumerator with invalid value", async () => {
      expect(testEnum).to.exist;
      const json: any = { ...baseJson, enumerators: [
        { value: false },
      ]};
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator with an invalid 'value' attribute. It should be of type 'number'.`);
    });

    it("should throw for enumerator with incompatible value type", async () => {
      expect(testEnum).to.exist;
      let json: any = { ...baseJson, enumerators: [
        { value: "shouldBeNumber" },
      ]};
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator with an invalid 'value' attribute. It should be of type 'number'.`);

      json = { ...baseJson, enumerators: [
        { value: 0 /* should be string */ },
      ]};
      testEnum.primitiveType = PrimitiveType.String;
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator with an invalid 'value' attribute. It should be of type 'string'.`);
    });

    it("should throw for enumerator with invalid label", async () => {
      expect(testEnum).to.exist;
      const json: any = { ...baseJson, enumerators: [
        { value: 0, label: 0 },
      ]};
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator with an invalid 'label' attribute. It should be of type 'string'.`);
    });
  });
});
