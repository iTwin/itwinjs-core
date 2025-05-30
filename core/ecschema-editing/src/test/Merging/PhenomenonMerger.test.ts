/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, Phenomenon, Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaEdits } from "../../ecschema-editing";

describe("Phenomenon merger tests", () => {
  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.0.0",
    alias: "source",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
  };

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

  describe("iterative tests", () => {
    it("should add a re-mapped phenomenon class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "Units.LENGTH(2)",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "Phenomenon");
        expect(conflict).to.have.a.property("target", "PropertyCategory");
        return true;
      });
  
      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Phenomenon;      
      schemaEdits.items.rename(sourceItem, "mergedPhenomenon");
  
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedPhenomenon")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.Phenomenon);
      });
    });

    it("should merge changes to re-mapped phenomenon class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Phenomenon",
            label: "Changed Area",
            description: "Changed Area Phenomenon",
            definition: "Units.LENGTH(2)",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedPhenomenon: {
            schemaItemType: "Phenomenon",
            label: "Area",
            description: "Area Phenomenon",
            definition: "Units.LENGTH(2)",
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Phenomenon;      
      schemaEdits.items.rename(sourceItem, "mergedPhenomenon");

      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);
 
      await expect(mergedSchema.getItem("mergedPhenomenon")).to.be.eventually.not.undefined
        .then((phenomenon: Phenomenon) => {
          expect(phenomenon).to.have.a.property("label").to.equal("Changed Area");
          expect(phenomenon).to.have.a.property("description").to.equal("Changed Area Phenomenon");
          expect(phenomenon).to.have.a.property("definition").to.equal("Units.LENGTH(2)");
        });
    });

    it("should add a constant with re-mapped phenomenon", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testConstant: {
            schemaItemType: "Constant",
            phenomenon: "SourceSchema.testItem",
            definition: "ONE",
            numerator: 100,
            denominator: 4,
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "Units.LENGTH(2)",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "Units.LENGTH(2)",
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Phenomenon;      
      schemaEdits.items.rename(sourceItem, "mergedPhenomenon");
  
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testConstant")).to.be.eventually.not.undefined
        .then((constant: Constant) => {
          expect(constant).to.have.a.property("schemaItemType", SchemaItemType.Constant);
          expect(constant).to.have.a.nested.property("phenomenon.name").to.equal("mergedPhenomenon");
        });
    });

    it("should merge constant phenomenon with re-mapped one", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testConstant: {
            schemaItemType: "Constant",
            phenomenon: "SourceSchema.testItem",
            definition: "ONE",
            numerator: 100,
            denominator: 4,
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "Units.LENGTH(2)",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "Units.LENGTH(6)",
          },
          testConstant: {
            schemaItemType: "Constant",
            phenomenon: "TargetSchema.testPhenomenon",
            definition: "ONE",
            numerator: 100,
            denominator: 4,
          },
          mergedPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "Units.LENGTH(2)",
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Phenomenon;      
      schemaEdits.items.rename(sourceItem, "mergedPhenomenon");
  
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testConstant")).to.be.eventually.not.undefined
        .then((constant: Constant) => {
          expect(constant).to.have.a.property("schemaItemType", SchemaItemType.Constant);
          expect(constant).to.have.a.nested.property("phenomenon.name").to.equal("mergedPhenomenon");
        });
    });

    it("should throw an error when a re-mapped phenomenon definition conflict exists", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "Units.LENGTH(4)",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "Units.LENGTH(2)",
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Phenomenon;      
      schemaEdits.items.rename(sourceItem, "mergedPhenomenon");

      const merger = new SchemaMerger(targetSchema.context);
      await expect(merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits)).to.be.rejectedWith("The Phenomenon testItem has an invalid 'definition' attribute.");
    });
  });
});
