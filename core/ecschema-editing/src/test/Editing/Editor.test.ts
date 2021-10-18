/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ECVersion, EntityClass, PrimitiveType, Schema,
  SchemaContext, SchemaItemKey, SchemaKey,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

/* eslint-disable @typescript-eslint/naming-convention */

// TODO: Add tests for cases where invalid names are passed into props objects. (to test the error message)
describe("Editor tests", () => {

  function normalizeLineEnds(s: string): string {
    return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  describe("SchemaEditor tests", () => {
    let testEditor: SchemaContextEditor;
    let testSchema: Schema;
    let testKey: SchemaKey;
    let context: SchemaContext;
    describe("should create a new schema from a context", () => {
      beforeEach(() => {
        context = new SchemaContext();
        testEditor = new SchemaContextEditor(context);
      });

      it("should create a new schema and return a SchemaEditResults", async () => {
        const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
        expect(result).to.not.eql(undefined);
      });

      it("upon schema creation, return a defined SchemaKey from SchemaEditResults", async () => {
        const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
        expect(result.schemaKey?.name).to.eql("testSchema");
        expect(result.schemaKey?.version).to.eql(new ECVersion(1, 0, 0));
      });
    });

    describe("addCustomAttribute Tests", () => {
      it("CustomAttribute defined in same schema, instance added successfully.", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          items: {
            TestCustomAttribute: {
              schemaItemType: "CustomAttributeClass",
              appliesTo: "Schema",
            },
          },
        };

        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);
        testKey = testSchema.schemaKey;

        const result = await testEditor.addCustomAttribute(testKey, { className: "TestCustomAttribute" });

        expect(result).to.eql({});
        expect(testSchema.customAttributes && testSchema.customAttributes.has("TestCustomAttribute")).to.be.true;
      });

      it("CustomAttribute defined in different schema, instance added successfully.", async () => {
        const schemaAJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "SchemaA",
          version: "1.2.3",
          alias: "vs",
          references: [
            {
              name: "SchemaB",
              version: "1.2.3",
            },
          ],
        };
        const schemaBJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "SchemaB",
          version: "1.2.3",
          alias: "vs",
          items: {
            TestCustomAttribute: {
              schemaItemType: "CustomAttributeClass",
              appliesTo: "Schema",
            },
          },
        };

        context = new SchemaContext();
        await Schema.fromJson(schemaBJson, context);
        const schemaA = await Schema.fromJson(schemaAJson, context);
        testEditor = new SchemaContextEditor(context);
        testKey = schemaA.schemaKey;

        const result = await testEditor.addCustomAttribute(testKey, { className: "SchemaB.TestCustomAttribute" });

        expect(result).to.eql({});
        expect(schemaA.customAttributes && schemaA.customAttributes.has("SchemaB.TestCustomAttribute")).to.be.true;
      });

      it("CustomAttribute class not found, error reported successfully.", async () => {
        const schemaAJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "SchemaA",
          version: "1.2.3",
          alias: "vs",
          customAttributes: [
          ],
          references: [
            {
              name: "SchemaB",
              version: "1.2.3",
            },
          ],
        };
        const schemaBJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "SchemaB",
          version: "1.2.3",
          alias: "vs",
        };

        context = new SchemaContext();
        await Schema.fromJson(schemaBJson, context);
        const schemaA = await Schema.fromJson(schemaAJson, context);
        testEditor = new SchemaContextEditor(context);
        testKey = schemaA.schemaKey;

        const result = await testEditor.addCustomAttribute(testKey, { className: "SchemaB.TestCustomAttribute" });

        expect(result.errorMessage).to.eql("ECObjects-502: The CustomAttribute container 'SchemaA' has a CustomAttribute with the class 'SchemaB.TestCustomAttribute' which cannot be found.\r\n");
        expect(schemaA.customAttributes && schemaA.customAttributes.has("SchemaB.TestCustomAttribute")).to.be.false;
      });
    });

    describe("addSchemaReference Tests", () => {
      it("Schema reference is valid, reference added successfully.", async () => {
        const refSchemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "RefSchema",
          version: "1.0.0",
          alias: "rs",
        };

        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "TestSchema",
          version: "1.0.0",
          alias: "ts",
        };

        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);
        testKey = testSchema.schemaKey;
        const refSchema = await Schema.fromJson(refSchemaJson, context);

        const result = await testEditor.addSchemaReference(testKey, refSchema);

        expect(result).to.eql({});
        expect(testSchema.getReferenceNameByAlias("rs")).to.equal("RefSchema");
        expect(await testEditor.schemaContext.getCachedSchema(refSchema.schemaKey)).to.eql(refSchema);
      });

      it("Multiple validation errors, results formatted properly.", async () => {
        const schemaAJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "SchemaA",
          version: "1.0.0",
          alias: "a",
          references: [
            {
              name: "SchemaB",
              version: "1.0.0",
            },
          ],
        };
        const schemaBJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "SchemaB",
          version: "1.0.0",
          alias: "b",
        };
        const schemaCJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "SchemaC",
          version: "1.0.0",
          alias: "b",
          references: [
            {
              name: "SchemaA",
              version: "1.0.0",
            },
          ],
        };

        context = new SchemaContext();
        await Schema.fromJson(schemaBJson, context);
        const schemaA = await Schema.fromJson(schemaAJson, context);
        const schemaC = await Schema.fromJson(schemaCJson, context);
        testEditor = new SchemaContextEditor(context);
        testKey = schemaA.schemaKey;

        const result = await testEditor.addSchemaReference(schemaA.schemaKey, schemaC);

        expect(result.errorMessage).not.undefined;
        expect(normalizeLineEnds(result.errorMessage!)).to.equal(normalizeLineEnds("ECObjects-2: Schema 'SchemaA' has multiple schema references (SchemaB, SchemaC) with the same alias 'b', which is not allowed.\r\nECObjects-3: Schema 'SchemaA' has reference cycles: SchemaC --> SchemaA, SchemaA --> SchemaC\r\n"));
        expect(schemaA.getReferenceSync("SchemaC")).to.be.undefined;
      });
    });

    describe("Schema Version Tests", () => {
      it("setVersion, version updated successfully", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
        };

        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);

        const result = await testEditor.setVersion(testSchema.schemaKey, 2, 3, 4);

        expect(result).to.eql({});
        expect(testSchema.readVersion).to.equal(2);
        expect(testSchema.writeVersion).to.equal(3);
        expect(testSchema.minorVersion).to.equal(4);
      });

      it("setVersion, read version not specified, version updated successfully", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
        };

        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);

        const result = await testEditor.setVersion(testSchema.schemaKey, undefined, 3, 4);

        expect(result).to.eql({});
        expect(testSchema.readVersion).to.equal(1);
        expect(testSchema.writeVersion).to.equal(3);
        expect(testSchema.minorVersion).to.equal(4);
      });

      it("setVersion, write version not specified, version updated successfully", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
        };

        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);

        const result = await testEditor.setVersion(testSchema.schemaKey, 2, undefined, 4);

        expect(result).to.eql({});
        expect(testSchema.readVersion).to.equal(2);
        expect(testSchema.writeVersion).to.equal(2);
        expect(testSchema.minorVersion).to.equal(4);
      });

      it("setVersion, read version not specified, version updated successfully", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
        };

        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);

        const result = await testEditor.setVersion(testSchema.schemaKey, 2, 3, undefined);

        expect(result).to.eql({});
        expect(testSchema.readVersion).to.equal(2);
        expect(testSchema.writeVersion).to.equal(3);
        expect(testSchema.minorVersion).to.equal(3);
      });

      it("incrementMinorVersion, version incremented successfully", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
        };

        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);

        const result = await testEditor.incrementMinorVersion(testSchema.schemaKey);

        expect(result).to.eql({});
        expect(testSchema.minorVersion).to.equal(4);
      });
    });

    describe("edits an existing schema", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
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
        },
      };
      beforeEach(async () => {
        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);
        testKey = testSchema.schemaKey;
      });

      it("should get the correct Schema", async () => {
        expect(await testEditor.schemaContext.getSchema(testKey)).to.eql(testSchema);
      });

      it("upon manual key creation, still create a valid property to an existing entity", async () => {
        const schemaKey = new SchemaKey("TestSchema");
        const entityKey = new SchemaItemKey("testClass", schemaKey);
        await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.Integer);
        const testEntity = await testEditor.schemaContext.getSchemaItem(entityKey) as EntityClass;
        expect(await testEntity.getProperty("testProperty")).to.not.eql(undefined);
      });

      it("should get the right entity class from existing schema", async () => {
        const createdKey = new SchemaKey("TestSchema");
        const cachedSchema = await testEditor.schemaContext.getCachedSchema(createdKey);
        const testEntity = await cachedSchema!.getItem("testClass");
        expect(testEntity?.label).to.eql("ExampleEntity");
      });

      it("should add a property to existing entity", async () => {
        const entityKey = new SchemaItemKey("testClass", testKey);
        await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.Integer);
        const testEntity = await testSchema.getItem("testClass") as EntityClass;
        expect(await testEntity.getProperty("testProperty")).to.not.eql(undefined);
      });
    });

    // TODO: Add a test to compare previous SchemaContext with the SchemaContext returned when SchemaEditor.finish() is called.
  });
});
