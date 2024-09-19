/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";

describe("Constant merger tests", () => {
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
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const { schema } = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.Constant,
          itemName: "testConstant",
          difference: {
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

    await expect(schema.getItem("testConstant")).to.be.eventually.not.undefined
      .then((constant: Constant) => {
        expect(constant).to.have.a.property("schemaItemType", SchemaItemType.Constant);
        expect(constant).to.have.a.property("label", "Test Constant");
        expect(constant).to.have.a.property("description", "testing a constant");
        expect(constant).to.have.a.nested.property("phenomenon.fullName", "TargetSchema.testPhenomenon");
        expect(constant).to.have.a.property("definition", "PI");
        expect(constant).to.have.a.property("numerator", 5.5);
        expect(constant).to.have.a.property("denominator", 5.1);
      });
  });

  it("it should merge missing constant with referenced phenomenon", async () => {
    const targetContext = await BisTestHelper.getNewContext();
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
    const { schema } = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.SchemaReference,
          difference: {
            name: "ReferenceSchema",
            version: "01.02.00",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.Constant,
          itemName: "testConstant",
          difference: {
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

    await expect(schema.getItem("testConstant")).to.be.eventually.not.undefined
      .then((constant: Constant) => {
        expect(constant).to.have.a.property("schemaItemType", SchemaItemType.Constant);
        expect(constant).to.have.a.property("label", "Test Constant");
        expect(constant).to.have.a.property("description", "testing a constant");
        expect(constant).to.have.a.nested.property("phenomenon.fullName", "ReferenceSchema.testPhenomenon");
        expect(constant).to.have.a.property("definition", "PI");
        expect(constant).to.have.a.property("numerator", 5);
        expect(constant).to.have.a.property("denominator", 5.1);
      });
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
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Constant,
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
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Constant,
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
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Constant,
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
