/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, SchemaItemType, Unit } from "@itwin/ecschema-metadata";
import { getSchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { AnySchemaDifferenceConflict, ConflictCode } from "../../Differencing/SchemaConflicts";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { SchemaEdits } from "../../Merging/Edits/SchemaEdits";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";

describe("Unit merge tests", () => {
  let targetContext: SchemaContext;

  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "01.00.00",
    alias: "target",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
  };

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "01.00.00",
    alias: "source",
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
    version: "01.02.00",
    alias: "reference",
    items: {
      testUnitSystem: {
        schemaItemType: "UnitSystem",
      },
      testPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "TestPhenomenon",
      },
    },
  };

  beforeEach(async () => {
    targetContext = await BisTestHelper.getNewContext();
    await Schema.fromJson(referenceJson, targetContext);
  });

  it("should merge missing unit with referenced unitSystem and phenomenon", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
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
          schemaType: SchemaItemType.Unit,
          itemName: "testUnit",
          difference: {
            label: "Test",
            description: "Unit description",
            denominator: 5,
            numerator: 101325,
            offset: 1.033,
            unitSystem: "ReferenceSchema.testUnitSystem",
            phenomenon: "ReferenceSchema.testPhenomenon",
            definition: "TestUnit",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testUnit")).to.be.eventually.not.undefined
    .then((unit: Unit) => {
      expect(unit).to.have.a.property("schemaItemType", SchemaItemType.Unit);
      expect(unit).to.have.a.property("label").to.equal("Test");
      expect(unit).to.have.a.property("description").to.equal("Unit description");
      expect(unit).to.have.a.property("denominator").to.equal(5);
      expect(unit).to.have.a.property("numerator").to.equal(101325);
      expect(unit).to.have.a.property("offset").to.equal(1.033);
      expect(unit).to.have.a.nested.property("unitSystem.fullName").to.equal("ReferenceSchema.testUnitSystem");
      expect(unit).to.have.a.nested.property("phenomenon.fullName").to.equal("ReferenceSchema.testPhenomenon");
      expect(unit).to.have.a.property("definition").to.equal("TestUnit");
    });
  });

  it("should merge missing unit with added unitSystem and phenomenon", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.UnitSystem,
          itemName: "testUnitSystem",
          difference: {
            label: "Test",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.Phenomenon,
          itemName: "testPhenomenon",
          difference: {
            description: "Description of phenomenom",
            definition: "TestPhenomenon",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.Unit,
          itemName: "testUnit",
          difference: {
            label: "Test",
            description: "Unit description",
            numerator: 100000,
            unitSystem: "SourceSchema.testUnitSystem",
            phenomenon: "SourceSchema.testPhenomenon",
            definition: "TestUnit",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testUnit")).to.be.eventually.not.undefined
    .then((unit: Unit) => {
      expect(unit).to.have.a.property("schemaItemType", SchemaItemType.Unit);
      expect(unit).to.have.a.property("label").to.equal("Test");
      expect(unit).to.have.a.property("description").to.equal("Unit description");
      expect(unit).to.have.a.property("numerator").to.equal(100000);
      expect(unit).to.have.a.nested.property("unitSystem.fullName").to.equal("TargetSchema.testUnitSystem");
      expect(unit).to.have.a.nested.property("phenomenon.fullName").to.equal("TargetSchema.testPhenomenon");
      expect(unit).to.have.a.property("definition").to.equal("TestUnit");
    });
  });

  it("should merge unit changes", async () => {
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "ReferenceSchema",
          version: "1.2.0",
        },
      ],
      items: {
        testUnit: {
          schemaItemType: "Unit",
          label: "Test",
          description: "Unit description",
          unitSystem: "ReferenceSchema.testUnitSystem",
          phenomenon: "ReferenceSchema.testPhenomenon",
          definition: "TestUnit",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Unit,
          itemName: "testUnit",
          difference: {
            label: "Changed Test",
            description: "Changed Unit description",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testUnit")).to.be.eventually.not.undefined
    .then((unit: Unit) => {
      expect(unit).to.have.a.property("label").to.equal("Changed Test");
      expect(unit).to.have.a.property("description").to.equal("Changed Unit description");
    });
  });

  it("should throw an error when merging unit with a changed unitSystem", async () => {
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "ReferenceSchema",
          version: "1.2.0",
        },
      ],
      items: {
        testUnit: {
          schemaItemType: "Unit",
          label: "Test",
          description: "Unit description",
          unitSystem: "ReferenceSchema.testUnitSystem",
          phenomenon: "ReferenceSchema.testPhenomenon",
          definition: "TestUnit",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.UnitSystem,
          itemName: "testUnitSystem",
          difference: {
            label: "Test",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.Unit,
          itemName: "testUnit",
          difference: {
            unitSystem: "SourceSchema.testUnitSystem",
          },
        },
      ],
      conflicts: undefined,
    });

    await expect(merge).to.be.rejectedWith("Changing the unit 'testUnit' unitSystem is not supported.");
  });

  it("should throw an error when merging unit with a changed phenomenon", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        testUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        testPhenomenon: {
          schemaItemType: "Phenomenon",
          definition: "TestPhenomenon",
        },
        testUnit: {
          schemaItemType: "Unit",
          label: "Test",
          description: "Unit description",
          unitSystem: "TargetSchema.testUnitSystem",
          phenomenon: "TargetSchema.testPhenomenon",
          definition: "TestUnit",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
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
          changeType: "modify",
          schemaType: SchemaItemType.Unit,
          itemName: "testUnit",
          difference: {
            phenomenon: "ReferenceSchema.testPhenomenon",
          },
        },
      ],
      conflicts: undefined,
    });

    await expect(merge).to.be.rejectedWith("Changing the unit 'testUnit' phenomenon is not supported.");
  });

  it("should throw an error when merging unit with a changed definition", async () => {
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "ReferenceSchema",
          version: "1.2.0",
        },
      ],
      items: {
        testUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        testUnit: {
          schemaItemType: "Unit",
          label: "Test",
          description: "Unit description",
          unitSystem: "TargetSchema.testUnitSystem",
          phenomenon: "ReferenceSchema.testPhenomenon",
          definition: "TestUnit",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Unit,
          itemName: "testUnit",
          difference: {
            definition: "ChangedUnit",
          },
        },
      ],
      conflicts: undefined,
    });

    await expect(merge).to.be.rejectedWith("Changing the unit 'testUnit' definition is not supported.");
  });

  describe("iterative tests", () => {
    let sourceContext: SchemaContext;

    beforeEach(async () => {
      sourceContext = await BisTestHelper.getNewContext();
      await Schema.fromJson(referenceJson, sourceContext);
    });

    it("should add a re-mapped unit class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testItem: {
            schemaItemType: "Unit",
            unitSystem: "ReferenceSchema.testUnitSystem",
            phenomenon: "ReferenceSchema.testPhenomenon",
            definition: "TestUnit",
          },
        },
      }, sourceContext);
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "EntityClass",
          },          
        },
      }, targetContext);
  
      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "Unit");
        expect(conflict).to.have.a.property("target", "EntityClass");
        return true;
      });
  
      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Unit;      
      schemaEdits.items.rename(sourceItem, "mergedUnit");
  
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedUnit")).to.be.eventually.fulfilled.then(async (schemaItem) => {
        expect(schemaItem).to.exist;
        expect(schemaItem).to.have.property("schemaItemType").equals(SchemaItemType.Unit);
      });
      await expect(mergedSchema.getItem("testItem")).to.be.eventually.fulfilled.then(async (schemaItem) => {
        expect(schemaItem).to.exist;
        expect(schemaItem).to.have.property("schemaItemType").equals(SchemaItemType.EntityClass);
      });
    });

    it("should merge changes to re-mapped unit class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testItem: {
            schemaItemType: "Unit",
            label: "Changed Test",
            description: "Changed Unit description",
            unitSystem: "ReferenceSchema.testUnitSystem",
            phenomenon: "ReferenceSchema.testPhenomenon",
            definition: "TestUnit",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          mergedUnit: {
            schemaItemType: "Unit",
            label: "Test",
            description: "Unit description",
            unitSystem: "ReferenceSchema.testUnitSystem",
            phenomenon: "ReferenceSchema.testPhenomenon",
            definition: "TestUnit",
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Unit;
      schemaEdits.items.rename(sourceItem, "mergedUnit");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);
 
      await expect(mergedSchema.getItem("mergedUnit")).to.be.eventually.not.undefined
        .then((unit: Unit) => {
          expect(unit).to.have.a.property("label").to.equal("Changed Test");
          expect(unit).to.have.a.property("description").to.equal("Changed Unit description");
        });
    });

    it("should merge missing kindOfQuantity with re-mapped persistence unit", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testKoq: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0030480000000000004,
            persistenceUnit: "SourceSchema.testItem",
          },
          testItem: {
            schemaItemType: "Unit",
            unitSystem: "ReferenceSchema.testUnitSystem",
            phenomenon: "ReferenceSchema.testPhenomenon",
            definition: "TestUnit",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          mergedUnit: {
            schemaItemType: "Unit",
            unitSystem: "ReferenceSchema.testUnitSystem",
            phenomenon: "ReferenceSchema.testPhenomenon",
            definition: "TestUnit",
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 4,
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Unit;
      schemaEdits.items.rename(sourceItem, "mergedUnit");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testKoq")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.a.nested.property("persistenceUnit.fullName").equals("TargetSchema.mergedUnit");
      });
    });
  });
});
