/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Phenomenon, Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";

describe("Phenomenon merger tests", () => {
  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
  };

  it("should merge missing phenomenon item", async () => {
    const targetSchema = await Schema.fromJson(targetJson, await BisTestHelper.getNewContext());
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

    await expect(mergedSchema.getItem("testPhenomenon")).to.be.eventually.not.undefined
      .then((phenomenon: Phenomenon) => {
        expect(phenomenon).to.have.a.property("schemaItemType", SchemaItemType.Phenomenon);
        expect(phenomenon).to.have.a.property("label").to.equal("Area");
        expect(phenomenon).to.have.a.property("description").to.equal("Area description");
        expect(phenomenon).to.have.a.property("definition").to.equal("Units.LENGTH(2)");
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
    }, await BisTestHelper.getNewContext());

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
