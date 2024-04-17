/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { ConflictCode, SchemaConflictsError, SchemaDifferenceConflict } from "../../Differencing/SchemaConflicts";
import { expect } from "chai";
import "chai-as-promised";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Schema merge tests", () => {
  it("should throw an error if the differences has conflicts.", async () => {
    const conflict: SchemaDifferenceConflict = {
      code: ConflictCode.ConflictingPropertyName,
      schemaType: SchemaItemType.EntityClass,
      itemName: "ConflictingPropertyEntity",
      path: "MyProperty",
      source: "boolean",
      target: "string",
      description: "Target class already contains a property with a different type.",
    };

    const merger = new SchemaMerger(new SchemaContext());
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      conflicts: [ conflict ],
    });

    await expect(merge).to.be.rejectedWith(SchemaConflictsError, "Schema's can't be merged if there are unresolved conflicts.")
      .then((error: SchemaConflictsError) => {
        expect(error.sourceSchema.name).equals("SourceSchema", "Unexpected source schema name");
        expect(error.targetSchema.name).equals("TargetSchema", "Unexpected target schema name");
        expect(error.conflicts).includes(conflict);
      });
  });

  it("should merge label and description from schema", async () => {
    const targetContext = new SchemaContext();
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TargetSchema",
      version: "1.0.0",
      alias: "target",
    }, targetContext);

    const newDescription = "This is the new description";
    const newLabel = "This is the new Label";

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes:[{
        changeType: "modify",
        schemaType: SchemaOtherTypes.Schema,
        difference: {
          description: newDescription,
          label: newLabel,
        },
      }],
    });
    expect(mergedSchema.label).equals(newLabel, "unexpected source label");
    expect(mergedSchema.description).equals(newDescription, "unexpected source description");
  });

  it("should merge Schema Items case insensitive", async () => {
    const targetContext = new SchemaContext();
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TargetSchema",
      version: "1.0.0",
      alias: "target",
      items: {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes:[{
        changeType: "add",
        schemaType: SchemaOtherTypes.CustomAttributeInstance,
        appliedTo: "Schema",
        difference: {
          className: "sOuRcEscHeMA.TESTCustomaTTriBute",
        },
      }],
    });

    expect(mergedSchema.toJSON().customAttributes).deep.equals(
      [{
        className: "TargetSchema.TestCustomAttribute",
      }],
    );
  });
});
