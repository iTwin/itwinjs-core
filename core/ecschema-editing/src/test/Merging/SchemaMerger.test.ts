/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import "chai-as-promised";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Schema merge tests", () => {
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
