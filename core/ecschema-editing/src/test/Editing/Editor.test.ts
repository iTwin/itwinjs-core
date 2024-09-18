/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import {
  ECVersion, EntityClass, PrimitiveType, Schema,
  SchemaContext, SchemaItemKey, SchemaKey,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { AnyDiagnostic } from "../../Validation/Diagnostic";
import { Diagnostics } from "../../Validation/ECRules";
import { ECEditingStatus } from "../../Editing/Exception";

/* eslint-disable @typescript-eslint/naming-convention */

function getRuleViolationMessage(ruleViolations: AnyDiagnostic[]) {
  let violations = "";
  for (const diagnostic of ruleViolations) {
    violations += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
  }
  return violations;
}

// TODO: Add tests for cases where invalid names are passed into props objects. (to test the error message)
describe("Editor tests", () => {

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
        expect(result).toBeDefined();
      });

      it("upon schema creation, return a defined SchemaKey from SchemaEditResults", async () => {
        const schemaKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
        expect(schemaKey?.name).toEqual("testSchema");
        expect(schemaKey?.version).toEqual(new ECVersion(1, 0, 0));
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

        await testEditor.addCustomAttribute(testKey, { className: "TestCustomAttribute" });
        expect(testSchema.customAttributes && testSchema.customAttributes.has("TestCustomAttribute")).toBe(true);
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

        await testEditor.addCustomAttribute(testKey, { className: "SchemaB.TestCustomAttribute" });
        expect(schemaA.customAttributes && schemaA.customAttributes.has("SchemaB.TestCustomAttribute")).toBe(true);
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

        const expectedRuleViolations = [
          new Diagnostics.CustomAttributeClassNotFound(schemaA, ["SchemaA", "SchemaB.TestCustomAttribute"]),
        ];
        await expect(testEditor.addCustomAttribute(testKey, { className: "SchemaB.TestCustomAttribute" })).rejects.toMatchObject({
          errorNumber: ECEditingStatus.AddCustomAttributeToClass,
          innerError: {
            errorNumber: ECEditingStatus.RuleViolation,
            message: `Rule violations occurred from CustomAttribute SchemaB.TestCustomAttribute, container ${testKey.name}: ${getRuleViolationMessage(expectedRuleViolations)}`,
            ruleViolations: expectedRuleViolations,
          },
        });
        expect(schemaA.customAttributes && schemaA.customAttributes.has("SchemaB.TestCustomAttribute")).toBe(false);

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

        await testEditor.addSchemaReference(testKey, refSchema);

        expect(testSchema.getReferenceNameByAlias("rs")).toEqual("RefSchema");
        expect(await testEditor.schemaContext.getCachedSchema(refSchema.schemaKey)).toEqual(refSchema);
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

        try {
          await testEditor.addSchemaReference(schemaA.schemaKey, schemaC);
        } catch (e: any) {
          expect(e).toHaveProperty("errorNumber", ECEditingStatus.AddSchemaReference);
          expect(e).toHaveProperty("innerError.errorNumber", ECEditingStatus.RuleViolation);
          expect(e).toHaveProperty("innerError.message", `Rule violations occurred from Schema ${schemaA.fullName}: ${getRuleViolationMessage(e.innerError.ruleViolations)}`);
          const violations = e.innerError.ruleViolations as AnyDiagnostic[];
          expect(violations[0]).toEqual(new Diagnostics.SchemaRefAliasMustBeUnique(schemaA, [schemaA.name, "b", "SchemaB", "SchemaC"]));
          expect(violations[1]).toEqual(new Diagnostics.ReferenceCyclesNotAllowed(schemaA, [schemaA.name, `SchemaC --> SchemaA, SchemaA --> SchemaC`]));
          expect(schemaA.getReferenceSync("SchemaC")).toBeUndefined();
        }
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

        expect(result).toEqual(testSchema.schemaKey);
        expect(testSchema.readVersion).toEqual(2);
        expect(testSchema.writeVersion).toEqual(3);
        expect(testSchema.minorVersion).toEqual(4);
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

        expect(result).toEqual(testSchema.schemaKey);
        expect(testSchema.readVersion).toEqual(1);
        expect(testSchema.writeVersion).toEqual(3);
        expect(testSchema.minorVersion).toEqual(4);
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

        expect(result).toEqual(testSchema.schemaKey);
        expect(testSchema.readVersion).toEqual(2);
        expect(testSchema.writeVersion).toEqual(2);
        expect(testSchema.minorVersion).toEqual(4);
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

        expect(result).toEqual(testSchema.schemaKey);
        expect(testSchema.readVersion).toEqual(2);
        expect(testSchema.writeVersion).toEqual(3);
        expect(testSchema.minorVersion).toEqual(3);
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

        expect(result).toEqual(testSchema.schemaKey);
        expect(testSchema.minorVersion).toEqual(4);
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
        expect(await testEditor.schemaContext.getSchema(testKey)).toEqual(testSchema);
      });

      it("upon manual key creation, still create a valid property to an existing entity", async () => {
        const schemaKey = new SchemaKey("TestSchema");
        const entityKey = new SchemaItemKey("testClass", schemaKey);
        await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.Integer);
        const testEntity = await testEditor.schemaContext.getSchemaItem(entityKey) as EntityClass;
        expect(await testEntity.getProperty("testProperty")).toBeDefined();
      });

      it("should get the right entity class from existing schema", async () => {
        const createdKey = new SchemaKey("TestSchema");
        const cachedSchema = await testEditor.schemaContext.getCachedSchema(createdKey);
        const testEntity = await cachedSchema!.getItem("testClass");
        expect(testEntity?.label).toEqual("ExampleEntity");
      });

      it("should add a property to existing entity", async () => {
        const entityKey = new SchemaItemKey("testClass", testKey);
        await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.Integer);
        const testEntity = await testSchema.getItem("testClass") as EntityClass;
        expect(await testEntity.getProperty("testProperty")).toBeDefined();
      });
    });

    it("setDisplayLabel, label updated successfully", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
      };

      context = new SchemaContext();
      testSchema = await Schema.fromJson(schemaJson, context);
      testEditor = new SchemaContextEditor(context);

      await testEditor.setDisplayLabel(testSchema.schemaKey, "NewLabel");

      expect(testSchema.label).toEqual("NewLabel");
    });

    it("setDescription, description updated successfully", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
      };

      context = new SchemaContext();
      testSchema = await Schema.fromJson(schemaJson, context);
      testEditor = new SchemaContextEditor(context);

      await testEditor.setDescription(testSchema.schemaKey, "This is the new description!");

      expect(testSchema.description).toEqual("This is the new description!");
    });

    it("setAlias, alias updated successfully", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
      };

      context = new SchemaContext();
      testSchema = await Schema.fromJson(schemaJson, context);
      testEditor = new SchemaContextEditor(context);

      await testEditor.setAlias(testSchema.schemaKey, "newAlias");

      expect(testSchema.alias).toEqual("newAlias");
    });

    it("try changing schema alias to invalid name, throws error", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
      };

      context = new SchemaContext();
      testSchema = await Schema.fromJson(schemaJson, context);
      testEditor = new SchemaContextEditor(context);

      await expect(testEditor.setAlias(testSchema.schemaKey, "123")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetSchemaAlias,
        innerError: {
          message: `Could not set the alias for schema ${testSchema.name} because the specified alias is not a valid ECName.`,
          errorNumber: ECEditingStatus.InvalidSchemaAlias,
        },
      });

      expect(testSchema.alias).toEqual("vs");
    });

    it("try changing schema alias to one that already exists in the context, throws error", async () => {
      const schema1Json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema1",
        version: "1.2.3",
        alias: "ts1",
      };

      const schema2Json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema2",
        version: "1.2.3",
        alias: "TS2",
      };

      context = new SchemaContext();
      const testSchema1 = await Schema.fromJson(schema1Json, context);
      const testSchema2 = await Schema.fromJson(schema2Json, context);
      testEditor = new SchemaContextEditor(context);

      // tests case-insensitive search (ts2 === TS2)
      await expect(testEditor.setAlias(testSchema1.schemaKey, "ts2")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetSchemaAlias,
        innerError: {
          message: `Schema ${testSchema2.name} already uses the alias 'ts2'.`,
          errorNumber: ECEditingStatus.SchemaAliasAlreadyExists,
        },
      });

      expect(testSchema1.alias).toEqual("ts1");
    });

    // TODO: Add a test to compare previous SchemaContext with the SchemaContext returned when SchemaEditor.finish() is called.
  });
});
