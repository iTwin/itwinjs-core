/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaItemType, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaEdits } from "../../ecschema-editing";

describe("Unit system merger tests", () => {
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

  it("should merge missing unit system", async () => {
    const targetSchema = await Schema.fromJson(targetJson, await BisTestHelper.getNewContext());
    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [{
        changeType: "add",
        schemaType: SchemaItemType.UnitSystem,
        itemName: "testUnitSystem",
        difference: {
          label: "Imperial",
          description: "Imperial Unit System",
        },
      }],
    });

    await expect(mergedSchema.getItem("testUnitSystem")).to.be.eventually.not.undefined
      .then((mergedUnitSystem: UnitSystem) => {
        expect(mergedUnitSystem).to.have.a.property("label", "Imperial");
        expect(mergedUnitSystem).to.have.a.property("description", "Imperial Unit System");
      });
  });

  it("should merge unit system with new label and description", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        testUnitSystem: {
          schemaItemType: "UnitSystem",
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [{
        changeType: "modify",
        schemaType: SchemaItemType.UnitSystem,
        itemName: "testUnitSystem",
        difference: {
          label: "New Imperial",
          description: "New Imperial Unit System",
        },
      }],
    });

    await expect(mergedSchema.getItem("testUnitSystem")).to.be.eventually.not.undefined
      .then((mergedUnitSystem: UnitSystem) => {
        expect(mergedUnitSystem).to.have.a.property("label", "New Imperial");
        expect(mergedUnitSystem).to.have.a.property("description", "New Imperial Unit System");
      });
  });

  describe("iterative tests", () => {
    it("should add a re-mapped unit system", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "UnitSystem",
            label: "Metric",
            description: "Metric System",
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
        expect(conflict).to.have.a.property("source", "UnitSystem");
        expect(conflict).to.have.a.property("target", "PropertyCategory");
        return true;
      });
  
      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as UnitSystem;      
      schemaEdits.items.rename(sourceItem, "mergedUnitSystem");
  
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedUnitSystem")).to.be.eventually.fulfilled.then(async (unitSystem) => {
        expect(unitSystem).to.exist;
        expect(unitSystem).has.property("schemaItemType").equals(SchemaItemType.UnitSystem);
      });
    });

    it("should merge changes to a re-mapped unit system", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "UnitSystem",
            label: "Changed Metric",
            description: "Changed Metric System",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedUnitSystem: {
            schemaItemType: "UnitSystem",
            label: "Metric",
            description: "Metric System",
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as UnitSystem;      
      schemaEdits.items.rename(sourceItem, "mergedUnitSystem");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.merge(result, schemaEdits);
 
      await expect(mergedSchema.getItem("mergedUnitSystem")).to.be.eventually.not.undefined
        .then((unitSystem: UnitSystem) => {
          expect(unitSystem).to.have.a.property("label").to.equal("Changed Metric");
          expect(unitSystem).to.have.a.property("description").to.equal("Changed Metric System");
        });
    });
  });
});
