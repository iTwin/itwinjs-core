/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaItemTypeName } from "../../Differencing/SchemaDifference";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

describe("Constant merger tests", () => {
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

  it("should merge missing constant", async () => {
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
    }, new SchemaContext());

    const testConstant = {
      schemaItemType: "Constant",
      label: "Test Constant",
      description: "testing a constant",
      phenomenon: "TargetSchema.testPhenomenon",
      definition: "PI",
      numerator: 5.5,
      denominator: 5.1,
    };

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: SchemaItemTypeName.Constant,
          itemName: "testConstant",
          difference: {
            schemaItemType: "Constant",
            label: "Test Constant",
            description: "testing a constant",
            phenomenon: "SourceSchema.testPhenomenon",
            definition: "PI",
            numerator: 5.5,
            denominator: 5.1,
          },
        },
      ],
    });

    const mergedConstant = await mergedSchema.getItem<Constant>("testConstant");
    const mergedConstantToJSON = mergedConstant!.toJSON(false, false);

    expect(mergedConstantToJSON).deep.eq(testConstant);
  });

  it("it should merge missing constant with referenced phenomenon", async () => {
    const targetContext = new SchemaContext();
    await Schema.fromJson({
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
    }, targetContext);

    await Schema.fromJson(targetJson, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "Schema",
          path: "$references",
          difference: {
            name: "ReferenceSchema",
            version: "01.02.00",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemTypeName.Constant,
          itemName: "testConstant",
          difference: {
            schemaItemType: "Constant",
            label: "Test Constant",
            description: "testing a constant",
            phenomenon: "ReferenceSchema.testPhenomenon",
            definition: "PI",
            numerator: 5,
            denominator: 5.1,
          },
        },
      ],
    });

    const mergedConstant = await mergedSchema.getItem<Constant>("testConstant");
    expect((mergedConstant?.phenomenon)?.fullName).to.be.equals("ReferenceSchema.testPhenomenon");
  });

  it("it should throw error if definition conflict exist", async () => {
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
    }, new SchemaContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: SchemaItemTypeName.Constant,
          itemName: "testConstant",
          difference: {
            phenomenon: "SourceSchema.testPhenomenon",
            definition: "PI",
          },
        },
      ],
    });
    await expect(merge).to.be.rejectedWith("The Constant testConstant has an invalid 'definition' attribute.");

  });

  it("it should throw error if numerator conflict exist", async () => {
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
    }, new SchemaContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: SchemaItemTypeName.Constant,
          itemName: "testConstant",
          difference: {
            phenomenon: "SourceSchema.testPhenomenon",
            numerator: 5.5,
          },
        },
      ],
    });
    await expect(merge).to.be.rejectedWith(Error, "Failed to merged, constant numerator conflict: 5.5 -> 4.5");
  });

  it("it should throw error if denominator conflict exist", async () => {
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
    }, new SchemaContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: SchemaItemTypeName.Constant,
          itemName: "testConstant",
          difference: {
            phenomenon: "SourceSchema.testPhenomenon",
            denominator: 5.1,
          },
        },
      ],
    });
    await expect(merge).to.be.rejectedWith(Error, "Failed to merged, constant denominator conflict: 5.1 -> 4.2");
  });
});
