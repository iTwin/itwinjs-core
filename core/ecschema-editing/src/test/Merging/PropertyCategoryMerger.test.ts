/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyCategory, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

describe("PropertyCategory merge tests", () => {
  const targetJson =  {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  it("should merge missing PropertyCategory", async () => {
    const targetSchema = await Schema.fromJson(targetJson, new SchemaContext());
    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.PropertyCategory,
          itemName: "TestPropertyCategory",
          difference: {
            label: "ValueTrack Metadata",
            priority: 100000,
          },
        },
      ],
    });

    const mergedCategory = await mergedSchema.getItem<PropertyCategory>("TestPropertyCategory");
    expect(mergedCategory!.toJSON()).deep.equals({
      schemaItemType: "PropertyCategory",
      label: "ValueTrack Metadata",
      priority: 100000,
    });
  });

  it("should override PropertyCategory", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestPropertyCategory: {
          schemaItemType:"PropertyCategory",
          label:"ValueTrack Metadata",
          priority:100000,
        },
      },
    }, new SchemaContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.PropertyCategory,
          itemName: "TestPropertyCategory",
          difference: {
            priority: 99,
          },
        },
      ],
    });

    const mergedCategory = await mergedSchema.getItem<PropertyCategory>("TestPropertyCategory");
    expect(mergedCategory!.toJSON()).deep.eq({
      schemaItemType:"PropertyCategory",
      label:"ValueTrack Metadata",
      priority:99,
    });
  });
});
