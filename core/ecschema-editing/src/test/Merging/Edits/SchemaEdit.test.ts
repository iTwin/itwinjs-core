/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { EntityClass, PrimitiveProperty, PrimitiveType, Schema, SchemaContext, StructClass } from "@itwin/ecschema-metadata";
import { ConflictCode, getSchemaDifferences, SchemaEdits, SchemaMerger } from "../../../ecschema-editing";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Schema Edit tests", () => {
  it("shall re-apply stored conflict resolutions", async () => {
    const targetSchema = await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "ConflictSchema",
      version: "1.0.0",
      alias: "conflict",
      items: {
        SameNameOtherItemType: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "MyProperty",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      },
    }, new SchemaContext());

    const sourceSchemas: Schema[] = [
      // 1st case: Conflicting name
      await Schema.fromJson({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ConflictSchema",
        version: "1.0.1",
        alias: "conflict",
        items: {
          SameNameOtherItemType: {
            schemaItemType: "StructClass",
          },
          ClassToBeSkipped: {
            schemaItemType: "EntityClass",
          },
        },
      }, new SchemaContext()),

      // 2nd case: Conflicting name - reapply saved conflicts
      await Schema.fromJson({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ConflictSchema",
        version: "1.0.2",
        alias: "conflict",
        items: {
          SameNameOtherItemType: {
            schemaItemType: "EntityClass",
            description: "This is an Entity Class",
          },
          SameNameOtherItemType_1: {
            schemaItemType: "StructClass",
            description: "This is a Struct Class",
          },
        },
      }, new SchemaContext()),

      // 3rd case: Conflicting property
      await Schema.fromJson({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ConflictSchema",
        version: "1.0.3",
        alias: "conflict",
        items: {
          SameNameOtherItemType: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "MyProperty",
                type: "PrimitiveProperty",
                typeName: "boolean",
              },
              {
                name: "PropertyToSkip",
                type: "PrimitiveProperty",
                typeName: "boolean",
              },
            ],
          },
        },
      }, new SchemaContext()),
    ];

    // For all runs the class ClassToBeSkipped shall be skipped.
    const initialSchemaChanges = new SchemaEdits();
    initialSchemaChanges.items.skip("ConflictSchema", "ClassToBeSkipped");
    initialSchemaChanges.properties.skip("ConflictSchema", "SameNameOtherItemType", "PropertyToSkip");

    let storedSchemaEdits = initialSchemaChanges.toJSON();

    // Iterate over the different source schemas to simulate several merging runs
    for (const sourceSchema of sourceSchemas) {
      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      const schemaEdits = new SchemaEdits(storedSchemaEdits);

      if (differences.conflicts) {
        for (const conflict of differences.conflicts) {
          if (conflict.code === ConflictCode.ConflictingItemName && conflict.itemName === "SameNameOtherItemType") {
            schemaEdits.items.rename(sourceSchema.name, conflict.itemName, `${conflict.itemName}_1`);
          }
          if (conflict.code === ConflictCode.ConflictingPropertyName && conflict.path === "MyProperty") {
            schemaEdits.properties.rename(sourceSchema.name, conflict.itemName!, conflict.path, `${conflict.path}_1`);
          }
        }
      }

      const merger = new SchemaMerger(targetSchema.context);
      await expect(merger.merge(differences, schemaEdits)).resolves.toBeDefined();

      storedSchemaEdits = schemaEdits.toJSON();
    }

    await expect(targetSchema.getItem("ClassToBeSkipped")).resolves.toBeUndefined();
    await expect(targetSchema.getItem("SameNameOtherItemType")).resolves.toBeInstanceOf(EntityClass);

    const ecClass = await targetSchema.getItem("SameNameOtherItemType") as EntityClass;
    await expect(ecClass.getProperty("PropertyToSkip")).resolves.toBeUndefined();

    const myProperty = await ecClass.getProperty("MyProperty");
    expect(myProperty, "Could not find MyProperty").toBeDefined();
    expect(myProperty).toBeInstanceOf(PrimitiveProperty);
    expect(myProperty).toHaveProperty("primitiveType", PrimitiveType.String);

    const myProperty1 = await ecClass.getProperty("MyProperty_1");
    expect(myProperty1, "Could not find MyProperty_1").toBeDefined();
    expect(myProperty1).toBeInstanceOf(PrimitiveProperty);
    expect(myProperty1).toHaveProperty("primitiveType", PrimitiveType.Boolean);
    await expect(targetSchema.getItem("SameNameOtherItemType_1")).resolves.toBeInstanceOf(StructClass);
  });
});
