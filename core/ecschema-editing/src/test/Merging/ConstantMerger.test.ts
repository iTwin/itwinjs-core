/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

describe("Constant merger tests", () => {
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
  const referenceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "ReferenceSchema",
    version: "1.2.0",
    alias: "reference",
  };

  beforeEach(() => {
    targetContext = new SchemaContext();
    sourceContext = new SchemaContext();
  });

  describe("Constant missing tests", () => {
    it("should merge missing constant", async () => {
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
          testConstant: {
            schemaItemType: "Constant",
            label: "Test Constant",
            description: "testing a constant",
            phenomenon: "SourceSchema.testPhenomenon",
            definition: "PI",
            numerator: 5.5,
            denominator: 5.1,
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
            definition: "Units.LENGTH(2)",
          },
        },
      }, targetContext);

      const testConstant = {
        schemaItemType: "Constant",
        label: "Test Constant",
        description: "testing a constant",
        phenomenon: "TargetSchema.testPhenomenon",
        definition: "PI",
        numerator: 5.5,
        denominator: 5.1,
      };

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedConstant = await mergedSchema.getItem<Constant>("testConstant");
      const mergedConstantToJSON = mergedConstant!.toJSON(false, false);

      expect(mergedConstantToJSON).deep.eq(testConstant);

    });

    it("it should merge missing constant with referenced phenomenon", async () => {
      const _referenceSchema = await Schema.fromJson({
        ...referenceJson,
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

      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          testConstant: {
            schemaItemType: "Constant",
            label: "Test Constant",
            description: "testing a constant",
            definition: "PI",
            phenomenon: "ReferenceSchema.testPhenomenon",
            numerator: 5,
            denominator: 5.1,
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedConstant = await mergedSchema.getItem<Constant>("testConstant");
      expect((mergedConstant?.phenomenon)?.fullName).to.be.equals("ReferenceSchema.testPhenomenon");
    });
  });

  describe("Constant delta tests", () => {
    it("it should throw error if definition conflict exist", async () => {
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
          testConstant: {
            schemaItemType: "Constant",
            label: "Test Constant",
            description: "testing a constant",
            definition: "PI",
            phenomenon: "SourceSchema.testPhenomenon",
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
            definition: "Units.LENGTH(2)",
          },
          testConstant: {
            schemaItemType: "Constant",
            label: "Test Constant",
            description: "testing a constant",
            definition: "PII",
            phenomenon: "TargetSchema.testPhenomenon",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("The Constant testConstant has an invalid 'definition' attribute.");

    });

    it("it should throw error if numerator conflict exist", async () => {
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
          testConstant: {
            schemaItemType: "Constant",
            label: "Test Constant",
            description: "testing a constant",
            definition: "PI",
            phenomenon: "SourceSchema.testPhenomenon",
            numerator: 5.5,
            denominator: 5.1,
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
            definition: "Units.LENGTH(2)",
          },
          testConstant: {
            schemaItemType: "Constant",
            label: "Test Constant",
            description: "testing a constant",
            definition: "PI",
            phenomenon: "TargetSchema.testPhenomenon",
            numerator: 4.5,
            denominator: 5.1,
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, "Failed to merged, constant numerator conflict: 5.5 -> 4.5");
    });

    it("it should throw error if denominator conflict exist", async () => {
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
          testConstant: {
            schemaItemType: "Constant",
            label: "Test Constant",
            description: "testing a constant",
            definition: "PI",
            phenomenon: "SourceSchema.testPhenomenon",
            numerator: 5,
            denominator: 5.1,
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
            definition: "Units.LENGTH(2)",
          },
          testConstant: {
            schemaItemType: "Constant",
            label: "Test Constant",
            description: "testing a constant",
            definition: "PI",
            phenomenon: "TargetSchema.testPhenomenon",
            numerator: 5,
            denominator: 4.2,
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, "Failed to merged, constant denominator conflict: 5.1 -> 4.2");
    });
  });
});
