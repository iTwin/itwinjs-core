/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { EntityClass, PrimitiveProperty, PrimitiveType, Schema, SchemaContext, StructClass } from "@itwin/ecschema-metadata";
import { ConflictCode, getSchemaDifferences, SchemaEdits, SchemaMerger } from "../../../ecschema-editing";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Difference Conflict Resolving", () => {
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
    initialSchemaChanges.items.skip("ClassToBeSkipped");
    initialSchemaChanges.properties.skip("SameNameOtherItemType", "PropertyToSkip");

    let storedSchemaEdits = initialSchemaChanges.toJSON();

    // Iterate over the different source schemas to simulate several merging runs
    for (const sourceSchema of sourceSchemas) {
      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      const schemaEdits = new SchemaEdits(storedSchemaEdits);

      if (differences.conflicts) {
        for (const conflict of differences.conflicts) {
          if (conflict.code === ConflictCode.ConflictingItemName && conflict.itemName === "SameNameOtherItemType") {
            schemaEdits.items.rename(conflict.itemName, `${conflict.itemName}_1`);
          }
          if (conflict.code === ConflictCode.ConflictingPropertyName && conflict.path === "MyProperty") {
            schemaEdits.properties.rename(conflict.itemName!, conflict.path, `${conflict.path}_1`);
          }
        }
      }

      const merger = new SchemaMerger(targetSchema.context);
      await expect(merger.merge(differences, schemaEdits)).to.be.eventually.fulfilled;

      storedSchemaEdits = schemaEdits.toJSON();
    }

    await expect(targetSchema.getItem("ClassToBeSkipped")).to.be.eventually.undefined;
    await expect(targetSchema.getItem("SameNameOtherItemType")).to.be.eventually.fulfilled.then(async (ecClass: EntityClass) => {
      expect(ecClass).instanceOf(EntityClass);
      await expect(ecClass.getProperty("PropertyToSkip")).to.be.eventually.undefined;
      await expect(ecClass.getProperty("MyProperty")).to.be.eventually.fulfilled.then((property) => {
        expect(property, "Could not find MyProperty").to.be.not.undefined;
        expect(property).instanceOf(PrimitiveProperty);
        expect(property).has.property("primitiveType").equals(PrimitiveType.String);
      });
      await expect(ecClass.getProperty("MyProperty_1")).to.be.eventually.fulfilled.then((property) => {
        expect(property, "Could not find MyProperty_1").to.be.not.undefined;
        expect(property).instanceOf(PrimitiveProperty);
        expect(property).has.property("primitiveType").equals(PrimitiveType.Boolean);
      });
    });
    await expect(targetSchema.getItem("SameNameOtherItemType_1")).to.be.eventually.instanceOf(StructClass);
  });
});
