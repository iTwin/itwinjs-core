/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Phenomenon, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

describe("Phenomenon merger tests", () => {
  let targetContext: SchemaContext;
  let sourceContext: SchemaContext;

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.2.3",
    alias: "source",
  };
  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  beforeEach(() => {
    targetContext = new SchemaContext();
    sourceContext = new SchemaContext();
  });

  describe("Phenomenon missing test", () => {
    it("should merge missing phenomenon item", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            name: "AREA",
            label: "Area",
            description: "Area description",
            definition: "Units.LENGTH(2)",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);

      const sourcePhenomenon = await sourceSchema.getItem<Phenomenon>("testPhenomenon");
      const mergedPhenomenon = await mergedSchema.getItem<Phenomenon>("testPhenomenon");

      expect(sourcePhenomenon!.toJSON()).deep.eq(mergedPhenomenon!.toJSON());

    });
  });

  describe("Phenomenon attribute conflict tests", () => {
    it("should throw error for definition conflict", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            name: "AREA",
            label: "Area",
            description: "Area description",
            definition: "Units.LENGTH(2)",
          },
        },
      }, sourceContext);

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
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("The Phenomenon testPhenomenon has an invalid 'definition' attribute.");
    });
  });
});
