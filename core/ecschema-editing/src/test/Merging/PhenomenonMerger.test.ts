/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Phenomenon, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { SchemaItemTypeName } from "../../Differencing/SchemaDifference";
import { expect } from "chai";

describe("Phenomenon merger tests", () => {
  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  it("should merge missing phenomenon item", async () => {
    const targetSchema = await Schema.fromJson(targetJson, new SchemaContext());
    const merger = new SchemaMerger(targetSchema.context);

    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: SchemaItemTypeName.Phenomenon,
          itemName: "testPhenomenon",
          json: {
            schemaItemType: "Phenomenon",
            label: "Area",
            description: "Area description",
            definition: "Units.LENGTH(2)",
          },
        },
      ],
    });

    const mergedPhenomenon = await mergedSchema.getItem<Phenomenon>("testPhenomenon");
    expect(mergedPhenomenon!.toJSON()).deep.equals({
      schemaItemType: "Phenomenon",
      label: "Area",
      description: "Area description",
      definition: "Units.LENGTH(2)",
    });
  });

  it("should throw error for definition conflict", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        testPhenomenon: {
          schemaItemType: "Phenomenon",
          name: "AREA",
          label: "Area",
          description: "Area description",
          definition: "Units.LENGTH(4)",
        },
      },
    }, new SchemaContext());

    const merger = new SchemaMerger(targetSchema.context);
    await expect(merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: SchemaItemTypeName.Phenomenon,
          itemName: "testPhenomenon",
          json: {
            definition: "Units.LENGTH(2)",
          },
        },
      ],
    })).to.be.rejectedWith("The Phenomenon testPhenomenon has an invalid 'definition' attribute.");
  });
});
