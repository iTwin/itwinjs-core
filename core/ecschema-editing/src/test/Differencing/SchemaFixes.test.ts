/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ConflictCode, getUnresolvedConflicts, hasUnresolvedConflicts } from "../../Differencing/SchemaConflicts";
import { AnySchemaChange, SchemaChange } from "../../Differencing/SchemaChanges";
import { SchemaDifference } from "../../Differencing/SchemaDifference";
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
/* eslint-disable @typescript-eslint/naming-convention */

describe.only("Difference Conflict Resolving", () => {

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
            schemaItemType: "StructClass",
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
            ],
          },
        },
      }, new SchemaContext()),
    ];

    // For all runs the class ClassToBeSkipped shall be skipped.
    let storedSchemaChanges: AnySchemaChange[] = [{
      type: "skip",
      itemName: "ClassToBeSkipped",
    }];

    // Iterate over the different source schemas to simulate several merging runs
    for(const sourceSchema of sourceSchemas) {
      const differences = await SchemaDifference.fromSchemas(targetSchema, sourceSchema);
      expect(hasUnresolvedConflicts(differences), `differences between ${differences.targetSchemaName} and ${differences.sourceSchemaName} are supposed to have unresolved conflicts`).is.true;

      // Apply previous stored fixes that shall be applied to the differences.
      SchemaChange.apply(differences, storedSchemaChanges);

      // Resolve remaining conflicts. In this test only naming collisions, which shall get renamed.
      const unresolvedConflicts = getUnresolvedConflicts(differences);
      for(const conflict of unresolvedConflicts) {
        switch(conflict.code) {
          case ConflictCode.ConflictingItemName:
            SchemaChange.renameSchemaItem(differences, conflict.itemName!, `${conflict.itemName}_1`);
            break;
          case ConflictCode.ConflictingPropertyName:
            SchemaChange.renameProperty(differences, conflict.itemName!, conflict.path!, `${conflict.path}_1`);
            break;
          default: expect.fail(`Unexpected conflict code: ${conflict.code}`);
        }
      }

      expect(hasUnresolvedConflicts(differences), "differences is not supposed to have unresolved conflicts").is.false;
      storedSchemaChanges = differences.changes!;
    }

    expect(storedSchemaChanges).has.a.lengthOf(3);
    expect(storedSchemaChanges).deep.includes({
      type: "skip",
      itemName: "ClassToBeSkipped",
    });
  });
});
