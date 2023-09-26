/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyCategory, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

describe("PropertyCategory merge tests", () => {

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.2.3",
    alias: "source",
  };
  const targetJson =  {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  it("should merge missing PropertyCategory", async () => {
    const sourceSchema = await Schema.fromJson({
      ...sourceJson,
      items: {
        TestPropertyCategory: {
          schemaItemType:"PropertyCategory",
          label:"ValueTrack Metadata",
          priority:100000,
        },
      },
    }, new SchemaContext());

    const targetSchema = await Schema.fromJson({
      ...targetJson,
    }, new SchemaContext());

    const merger = new SchemaMerger();
    const mergedSchema = await merger.merge(targetSchema, sourceSchema);

    const sourceCategory = await sourceSchema.getItem<PropertyCategory>("TestPropertyCategory");
    const mergedCategory = await mergedSchema.getItem<PropertyCategory>("TestPropertyCategory");
    expect(sourceCategory!.toJSON()).deep.eq(mergedCategory!.toJSON());
  });

  it("should override PropertyCategory", async () => {
    const sourceSchema = await Schema.fromJson({
      ...sourceJson,
      items: {
        TestPropertyCategory: {
          schemaItemType:"PropertyCategory",
          label:"ValueTrack Metadata",
          priority:99,
        },
      },
    }, new SchemaContext());

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

    const merger = new SchemaMerger();
    const mergedSchema = await merger.merge(targetSchema, sourceSchema);
    const mergedCategory = await mergedSchema.getItem<PropertyCategory>("TestPropertyCategory");
    expect(mergedCategory!.toJSON()).deep.eq({
      schemaItemType:"PropertyCategory",
      label:"ValueTrack Metadata",
      priority:99,
    });
  });
});
