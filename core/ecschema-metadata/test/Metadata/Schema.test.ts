/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import Schema, { MutableSchema } from "../../src/Metadata/Schema";
import ECClass from "../../src/Metadata/Class";
import EntityClass from "../../src/Metadata/EntityClass";
import Mixin from "../../src/Metadata/Mixin";
import { StructClass } from "../../src/Metadata/Class";
import { ECObjectsError } from "../../src/Exception";
import { SchemaKey, SchemaMatchType } from "../../src/ECObjects";
import { SchemaContext } from "../../src/Context";

describe("Schema", () => {
  describe("api creation of schema", () => {
    it("with only the essentials", () => {
      const testSchema = new Schema("TestSchemaCreation", 10, 99, 15);
      assert.equal(testSchema.name, "TestSchemaCreation");
      assert.equal(testSchema.readVersion, 10);
      assert.equal(testSchema.writeVersion, 99);
      assert.equal(testSchema.minorVersion, 15);
    });

    it("with invalid version numbers should fail", () => {
      expect(() => { new Schema("NewSchemaWithInvalidReadVersion", 123, 4, 5); }).to.throw(ECObjectsError);
      expect(() => { new Schema("NewSchemaWithInvalidWriteVersion", 12, 345, 6); }).to.throw(ECObjectsError);
      expect(() => { new Schema("NewSchemaWithInvalidMinorVersion", 12, 34, 567); }).to.throw(ECObjectsError);
    });
  });

  describe("create schema items", () => {
    it("should succeed for entity class", async () => {
      const testSchema = new Schema("TestSchema", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");

      expect(await testSchema.getItem("TestEntity")).instanceof(ECClass);
      expect(await testSchema.getItem<EntityClass>("TestEntity")).instanceof(EntityClass);
    });

    it("should succeed for mixin class", async () => {
      const testSchema = new Schema("TestSchema", 1, 2, 3);
      await (testSchema as MutableSchema).createMixinClass("TestMixin");

      expect(await testSchema.getItem("TestMixin")).instanceof(ECClass);
      expect(await testSchema.getItem<Mixin>("TestMixin")).instanceof(Mixin);
    });

    it("should succeed for struct class", async () => {
      const testSchema = new Schema("TestSchema", 1, 2, 3);
      await (testSchema as MutableSchema).createStructClass("TestStruct");

      expect(await testSchema.getItem("TestStruct")).instanceof(ECClass);
      expect(await testSchema.getItem<StructClass>("TestStruct")).instanceof(StructClass);
    });

    it("should succeed with case-insensitive search", async () => {
      const testSchema = new Schema("TestSchema", 1, 0, 0);
      await (testSchema as MutableSchema).createEntityClass("testEntity");

      expect(await testSchema.getItem("TESTENTITY")).not.undefined;
      expect(await testSchema.getItem("TestEntity")).not.undefined;
      expect(await testSchema.getItem("testEntity")).not.undefined;
    });
  });

  describe("fromJson", () => {
    describe("should successfully deserialize valid JSON", () => {
      function assertValidSchema(testSchema: Schema) {
        expect(testSchema.name).to.eql("ValidSchema");
        expect(testSchema.alias).to.eql("vs");
        expect(testSchema.label).to.eql("SomeDisplayLabel");
        expect(testSchema.description).to.eql("A really long description...");
        expect(testSchema.readVersion).to.eql(1);
        expect(testSchema.writeVersion).to.eql(2);
        expect(testSchema.minorVersion).to.eql(3);
      }

      it("with name/version first specified in JSON", async () => {
        const propertyJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema();
        expect(testSchema).to.exist;
        await testSchema.fromJson(propertyJson);
        assertValidSchema(testSchema);
      });

      it("with name/version repeated in JSON", async () => {
        const propertyJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema("ValidSchema", 1, 2, 3);
        expect(testSchema).to.exist;
        await testSchema.fromJson(propertyJson);
        assertValidSchema(testSchema);
      });

      it("with name/version omitted in JSON", async () => {
        const propertyJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema("ValidSchema", 1, 2, 3);
        expect(testSchema).to.exist;
        await testSchema.fromJson(propertyJson);
        assertValidSchema(testSchema);
      });
      const oneCustomAttributeJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
            ShowClasses: true,
          },
        ],
      };
      it("async - Deserialize One Custom Attribute", async () => {
        const testSchema = new Schema("ValidSchema", 1, 2, 3);
        expect(testSchema).to.exist;
        await testSchema.fromJson(oneCustomAttributeJson);
        expect(testSchema.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
        assert(testSchema.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === true);
      });
      it("sync - Deserialize One Custom Attribute", () => {
        const testSchema = new Schema("ValidSchema", 1, 2, 3);
        expect(testSchema).to.exist;
        testSchema.fromJsonSync(oneCustomAttributeJson);
        expect(testSchema.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
        assert(testSchema.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === true);
      });
      const twoCustomAttributeJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
          },
          {
            className: "ExampleCustomAttributes.ExampleSchema",
          },
        ],
      };
      it("async - Deserialize Two Custom Attributes", async () => {
        const testSchema = new Schema("ValidSchema", 1, 2, 3);
        expect(testSchema).to.exist;
        await testSchema.fromJson(twoCustomAttributeJson);
        expect(testSchema.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
        expect(testSchema.customAttributes!["ExampleCustomAttributes.ExampleSchema"]).to.exist;
      });
      it("sync - Deserialize Two Custom Attributes", () => {
        const testSchema = new Schema("ValidSchema", 1, 2, 3);
        expect(testSchema).to.exist;
        testSchema.fromJsonSync(twoCustomAttributeJson);
        expect(testSchema.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
        expect(testSchema.customAttributes!["ExampleCustomAttributes.ExampleSchema"]).to.exist;
      });
      it("sync - Deserialize Two Custom Attributes with additional properties", () => {
        const propertyJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
          customAttributes: [
            {
              className: "CoreCustomAttributes.HiddenSchema",
              ShowClasses: false,
            },
            {
              className: "ExampleCustomAttributes.ExampleSchema",
              ShowClasses: true,
            },
          ],
        };
        const testSchema = new Schema("ValidSchema", 1, 2, 3);
        expect(testSchema).to.exist;
        testSchema.fromJsonSync(propertyJson);
        assertValidSchema(testSchema);
        assert(testSchema.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === false);
        assert(testSchema.customAttributes!["ExampleCustomAttributes.ExampleSchema"].ShowClasses === true);
      });
      const mustBeArrayJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "InvalidSchema",
        version: "1.2.3",
        alias: "vs",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        customAttributes: "CoreCustomAttributes.HiddenSchema",
      };
      it("async - Custom Attributes must be an array", async () => {
        const testSchema = new Schema("InvalidSchema", 1, 2, 3);
        expect(testSchema).to.exist;
        await expect(testSchema.fromJson(mustBeArrayJson)).to.be.rejectedWith(ECObjectsError, `The Schema InvalidSchema has an invalid 'customAttributes' attribute. It should be of type 'array'.`);

      });
      it("sync - Custom Attributes must be an array", () => {
        const testSchema = new Schema("InvalidSchema", 1, 2, 3);
        expect(testSchema).to.exist;
        assert.throws(() => testSchema.fromJsonSync(mustBeArrayJson), ECObjectsError, `The Schema InvalidSchema has an invalid 'customAttributes' attribute. It should be of type 'array'.`);

      });
    });

    async function testInvalidAttribute(schema: Schema, attributeName: string, expectedType: string, value: any) {
      expect(schema).to.exist;
      const json: any = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        [attributeName]: value,
      };
      await expect(schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECSchema ${schema.name} has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for missing $schema", async () => {
      const testSchema = new Schema("BadSchema", 1, 2, 3);
      expect(testSchema).to.exist;
      await expect(testSchema.fromJson({})).to.be.rejectedWith(ECObjectsError);
    });

    it("should throw for invalid $schema", async () => {
      const schemaJson = { $schema: "https://badmetaschema.com" };
      const testSchema = new Schema("BadSchema", 1, 2, 3);
      expect(testSchema).to.exist;
      await expect(testSchema.fromJson(schemaJson)).to.be.rejectedWith(ECObjectsError);
    });

    it("should throw for missing name", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      };
      const testSchema = new Schema();
      expect(testSchema).to.exist;
      expect(() => testSchema.name).to.throw(ECObjectsError, "An ECSchema is missing the required 'name' attribute.");
      await expect(testSchema.fromJson(json)).to.be.rejectedWith(ECObjectsError, "An ECSchema is missing the required 'name' attribute.");
    });

    it("should throw for mismatched name", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ThisDoesNotMatch",
      };
      const testSchema = new Schema("BadSchema", 1, 2, 3);
      expect(testSchema).to.exist;
      await expect(testSchema.fromJson(json)).to.be.rejectedWith(ECObjectsError);
    });

    it("should throw for invalid name", async () => {
      const schema = new Schema();
      const schemaWithName = new Schema("BadSchema", 1, 2, 3);

      const json: any = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: 0,
      };
      await expect(schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `An ECSchema has an invalid 'name' attribute. It should be of type 'string'.`);
      await expect(schemaWithName.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECSchema BadSchema has an invalid 'name' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid version", async () => {
      const schema = new Schema();
      const schemaWithKey = new Schema("BadSchema", 1, 2, 3);

      const json: any = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "BadSchema",
        version: 0,
      };
      await expect(schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECSchema BadSchema has an invalid 'version' attribute. It should be of type 'string'.`);
      await expect(schemaWithKey.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECSchema BadSchema has an invalid 'version' attribute. It should be of type 'string'.`);
    });

    it("should throw for missing version", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "BadSchema",
      };
      const testSchema = new Schema();
      expect(testSchema).to.exist;
      await expect(testSchema.fromJson(json)).to.be.rejectedWith(ECObjectsError, "The ECSchema BadSchema is missing the required 'version' attribute.");
    });

    it("should throw for mismatched version", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "BadSchema",
        version: "1.2.6",
      };
      const testSchema = new Schema("BadSchema", 1, 2, 3);
      expect(testSchema).to.exist;
      await expect(testSchema.fromJson(json)).to.be.rejectedWith(ECObjectsError);
    });

    it("should throw for invalid alias", async () => testInvalidAttribute(new Schema("BadSchema", 1, 2, 3), "alias", "string", 0));
    it("should throw for invalid label", async () => testInvalidAttribute(new Schema("BadSchema", 1, 2, 3), "label", "string", 0));
    it("should throw for invalid description", async () => testInvalidAttribute(new Schema("BadSchema", 1, 2, 3), "description", "string", 0));
  });
  describe("toJSON", () => {
    it("Simple serialization", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        label: "SomeDisplayLabel",
        description: "A really long description...",
      };
      const testSchema = new Schema("ValidSchema", 1, 2, 3);
      expect(testSchema).to.exist;
      await testSchema.fromJson(propertyJson);
      const serialized = testSchema.toJson();
      assert(serialized.$schema, "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema");
      assert(serialized.name, "ValidSchema");
      assert(serialized.version, "01.02.03");
      assert(serialized.alias, "vs");
      assert(serialized.label, "SomeDisplayLabel");
      assert(serialized.description, "A really long description...");
    });
    it("Serialization with one custom attribute- only class name", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
          },
        ],
      };
      const testSchema = new Schema("ValidSchema", 1, 2, 3);
      expect(testSchema).to.exist;
      await testSchema.fromJson(propertyJson);
      const serialized = testSchema.toJson();
      assert(serialized.customAttributes[0].className === "CoreCustomAttributes.HiddenSchema");
    });
    it("Serialization with one custom attribute- additional properties", () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
            ShowClasses: true,
          },
        ],
      };
      const testSchema = new Schema("ValidSchema", 1, 2, 3);
      expect(testSchema).to.exist;
      testSchema.fromJsonSync(propertyJson);
      const serialized = testSchema.toJson();
      assert(serialized.customAttributes[0].className === "CoreCustomAttributes.HiddenSchema");
      assert(serialized.customAttributes[0].ShowClasses === true);
    });
    it("Serialization with multiple custom attributes- only class name", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
          },
          {
            className: "CoreAttributes.HiddenSchema",
          },
          {
            className: "CoreCustom.HiddenSchema",
          },
        ],
      };
      const testSchema = new Schema("ValidSchema", 1, 2, 3);
      expect(testSchema).to.exist;
      await testSchema.fromJson(propertyJson);
      const serialized = testSchema.toJson();
      assert(serialized.customAttributes[0].className === "CoreCustomAttributes.HiddenSchema");
      assert(serialized.customAttributes[1].className === "CoreAttributes.HiddenSchema");
      assert(serialized.customAttributes[2].className === "CoreCustom.HiddenSchema");
    });
    it("Serialization with multiple custom attributes- additional properties", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
            ShowClasses: true,
          },
          {
            className: "CoreAttributes.HiddenSchema",
            FloatValue: 1.2,
          },
          {
            className: "CoreCustom.HiddenSchema",
            IntegerValue: 5,
          },
        ],
      };
      const testSchema = new Schema("ValidSchema", 1, 2, 3);
      expect(testSchema).to.exist;
      await testSchema.fromJson(propertyJson);
      const serialized = testSchema.toJson();
      assert(serialized.customAttributes[0].ShowClasses === true);
      assert(serialized.customAttributes[1].FloatValue === 1.2);
      assert(serialized.customAttributes[2].IntegerValue === 5);
    });
    it("Serialization with one reference", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        references: [
          {
            name: "RefSchema",
            version: "1.0.0",
          },
        ],
      };
      const refSchema = new Schema("RefSchema", 1, 0, 0);
      const context = new SchemaContext();
      await context.addSchema(refSchema);
      let testSchema = new Schema("ValidSchema", 1, 2, 3);
      testSchema = await Schema.fromJson(schemaJson, context);
      expect(testSchema).to.exist;
      const entityClassJson = testSchema.toJson();
      assert.isDefined(entityClassJson);
      assert(entityClassJson.references[0].name === "RefSchema");
      assert(entityClassJson.references[0].version === "01.00.00");
    });
    it("Serialization with multiple references", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        references: [
          {
            name: "RefSchema",
            version: "1.0.0",
          },
          {
            name: "AnotherRefSchema",
            version: "1.0.2",
          },
        ],
      };
      const refSchema = new Schema("RefSchema", 1, 0, 0);
      const anotherRefSchema = new Schema("AnotherRefSchema", 1, 0, 2);
      const context = new SchemaContext();
      context.addSchemaSync(refSchema);
      context.addSchemaSync(anotherRefSchema);
      let testSchema = new Schema("ValidSchema", 1, 2, 3);
      testSchema = Schema.fromJsonSync(schemaJson, context);
      expect(testSchema).to.exist;
      const entityClassJson = testSchema.toJson();
      assert.isDefined(entityClassJson);
      assert(entityClassJson.references[0].name === "RefSchema");
      assert(entityClassJson.references[0].version === "01.00.00");
      assert(entityClassJson.references[1].name === "AnotherRefSchema");
      assert(entityClassJson.references[1].version === "01.00.02");
    });
    it("Serialization with one reference and item", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        references: [
          {
            name: "RefSchema",
            version: "1.0.5",
          },
        ],
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            label: "ExampleEntity",
            description: "An example entity class.",
          },
        },
      };

      const refSchema = new Schema("RefSchema", 1, 0, 5);
      const refBaseClass = await (refSchema as MutableSchema).createEntityClass("BaseClassInRef");
      assert.isDefined(refBaseClass);
      const context = new SchemaContext();
      await context.addSchema(refSchema);
      let testSchema = new Schema("TestSchema", 1, 2, 3);
      testSchema = await Schema.fromJson(schemaJson, context);
      const entityClassJson = testSchema.toJson();
      assert.isDefined(entityClassJson);
      assert.isDefined(entityClassJson.items.testClass);
      assert(entityClassJson.items.testClass.schemaItemType, "EntityClass");
      assert(entityClassJson.items.testClass.label, "ExampleEntity");
      assert(entityClassJson.items.testClass.description, "An example entity class.");
    });
    it("Serialization with one reference and multiple items", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        references: [
          {
            name: "RefSchema",
            version: "1.0.5",
          },
        ],
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            label: "ExampleEntity",
            description: "An example entity class.",
          },
          ExampleMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.testClass",
          },
          ExampleStruct: {
            schemaItemType: "StructClass",
            name: "ExampleStruct",
            modifier: "sealed",
            properties: [
              {
                type: "PrimitiveArrayProperty",
                name: "ExamplePrimitiveArray",
                typeName: "TestSchema.testEnum",
                minOccurs: 7,
                maxOccurs: 20,
              },
            ],
          },
          testEnum: {
            schemaItemType: "Enumeration",
            type: "integer",
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

      const refSchema = new Schema("RefSchema", 1, 0, 5);
      const refBaseClass = await (refSchema as MutableSchema).createEntityClass("BaseClassInRef");
      assert.isDefined(refBaseClass);
      const context = new SchemaContext();
      await context.addSchema(refSchema);
      let testSchema = new Schema("TestSchema", 1, 2, 3);
      testSchema = await Schema.fromJson(schemaJson, context);
      const entityClassJson = testSchema.toJson();
      assert.isDefined(entityClassJson);

      assert.isDefined(entityClassJson.items.testClass);
      assert(entityClassJson.items.testClass.schemaItemType, "EntityClass");
      assert(entityClassJson.items.testClass.label, "ExampleEntity");
      assert(entityClassJson.items.testClass.description, "An example entity class.");

      assert.isDefined(entityClassJson.items.ExampleMixin);
      assert(entityClassJson.items.ExampleMixin.schemaItemType, "Mixin");

      assert.isDefined(entityClassJson.items.ExampleStruct);
      assert(entityClassJson.items.ExampleMixin.schemaItemType, "Mixin");

      assert.isDefined(entityClassJson.items.testEnum);
      assert(entityClassJson.items.testEnum.schemaItemType, "Enumeration");
    });
  });
}); // Schema tests

describe("SchemaKey ", () => {
  describe("matches", () => {
    it("should correctly handle SchemaMatchType.Identical", () => {
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0))).true;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0))).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 2, 0, 0))).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 1))).false;

      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.Identical)).true;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0), SchemaMatchType.Identical)).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 2, 0, 0), SchemaMatchType.Identical)).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 1), SchemaMatchType.Identical)).false;
    });

    it("should correctly handle SchemaMatchType.Exact", () => {
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.Exact)).true;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0), SchemaMatchType.Exact)).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 2, 0, 0), SchemaMatchType.Exact)).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 1), SchemaMatchType.Exact)).false;
    });

    it("should correctly handle SchemaMatchType.Latest", () => {
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.Latest)).true;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0), SchemaMatchType.Latest)).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 2, 0, 0), SchemaMatchType.Latest)).true;
      expect(new SchemaKey("SchemaTest", 1, 0, 1).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.Latest)).true;
    });

    it("should correctly handle SchemaMatchType.LatestWriteCompatible", () => {
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.LatestWriteCompatible)).true;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0), SchemaMatchType.LatestWriteCompatible)).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 2, 0, 0), SchemaMatchType.LatestWriteCompatible)).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 1).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.LatestWriteCompatible)).true;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 1), SchemaMatchType.LatestWriteCompatible)).false;
    });

    it("should correctly handle SchemaMatchType.LatestReadCompatible", () => {
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.LatestReadCompatible)).true;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0), SchemaMatchType.LatestReadCompatible)).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 2, 0, 0), SchemaMatchType.LatestReadCompatible)).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 1, 0), SchemaMatchType.LatestReadCompatible)).false;
      expect(new SchemaKey("SchemaTest", 1, 0, 1).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.LatestReadCompatible)).true;
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 1, 1), SchemaMatchType.LatestReadCompatible)).false;
    });

    it("should correctly handle invalid SchemaMatchType", () => {
      expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), -1)).false;
    });
  });

  describe("parseString", () => {
    it("should throw for invalid string", () => {
      expect(() => SchemaKey.parseString("invalid")).to.throw(ECObjectsError);
    });

    it("should correctly parse a valid schema full name", () => {
      const key = SchemaKey.parseString("SchemaName.1.2.3");
      expect(key.name).to.equal("SchemaName");
      expect(key.readVersion).to.equal(1);
      expect(key.writeVersion).to.equal(2);
      expect(key.minorVersion).to.equal(3);
    });
  });

  describe("compareByName", () => {
    it("should compare against a string", () => {
      const key = new SchemaKey("SchemaName", 1, 2, 3);
      expect(key.compareByName("SchemaName")).to.be.true;
      expect(key.compareByName("WrongSchemaName")).to.be.false;
    });

    it("should compare against another SchemaKey", () => {
      const key = new SchemaKey("SchemaName", 1, 2, 3);
      const matchingKey = new SchemaKey("SchemaName", 1, 2, 3);
      const incompatibleKey = new SchemaKey("WrongSchemaName", 1, 2, 3);
      expect(key.compareByName(matchingKey)).to.be.true;
      expect(key.compareByName(incompatibleKey)).to.be.false;
    });
  });

  // Tests to ensure the schemaKey compareByVersion exists
  // and calls into ECVersion.compare.  See ECVersion.test.ts
  // for more comprehensive cases.
  describe("compareByVersion", () => {
    it("exact match, returns zero", async () => {
      const leftSchema = new Schema("LeftSchema", 1, 2, 3);
      const rightSchema = new Schema("RightSchema", 1, 2, 3);
      const result = leftSchema.schemaKey.compareByVersion(rightSchema.schemaKey);
      assert.equal(result, 0);
    });
  });
});
