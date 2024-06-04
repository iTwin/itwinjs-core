/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Phenomenon, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
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
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.Phenomenon,
          itemName: "testPhenomenon",
          difference: {
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
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Phenomenon,
          itemName: "testPhenomenon",
          difference: {
            definition: "Units.LENGTH(2)",
          },
        },
      ],
    })).to.be.rejectedWith("The Phenomenon testPhenomenon has an invalid 'definition' attribute.");
  });
});
