/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { InvertedUnit, KindOfQuantity, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { getSchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { AnySchemaDifferenceConflict, ConflictCode } from "../../Differencing/SchemaConflicts";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { SchemaEdits } from "../../Merging/Edits/SchemaEdits";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";

describe("InvertedUnit merge tests", () => {
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
      testUnit: {
        schemaItemType: "Unit",
        unitSystem: "ReferenceSchema.testUnitSystem",
        phenomenon: "ReferenceSchema.testPhenomenon",
        definition: "TestUnit",
      },
    },
  };

  beforeEach(async () => {
    targetContext = await BisTestHelper.getNewContext();
    await Schema.fromJson(referenceJson, targetContext);
  });

  it("should merge missing invertedUnit with referenced unitSystem and invertsUnit", async () => {
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
          schemaType: SchemaItemType.InvertedUnit,
          itemName: "testInvertedUnit",
          difference: {
            label: "Test",
            description: "InvertedUnit description",
            unitSystem: "ReferenceSchema.testUnitSystem",
            invertsUnit: "ReferenceSchema.testUnit",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testInvertedUnit")).to.be.eventually.not.undefined
    .then((invertedUnit: InvertedUnit) => {
      expect(invertedUnit).to.have.a.property("schemaItemType", SchemaItemType.InvertedUnit);
      expect(invertedUnit).to.have.a.property("label").to.equal("Test");
      expect(invertedUnit).to.have.a.property("description").to.equal("InvertedUnit description");
      expect(invertedUnit).to.have.a.nested.property("unitSystem.fullName").to.equal("ReferenceSchema.testUnitSystem");
      expect(invertedUnit).to.have.a.nested.property("invertsUnit.fullName").to.equal("ReferenceSchema.testUnit");
    });
  });

  it("should merge missing invertedUnit with added unitSystem and invertsUnit", async () => {
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
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.Unit,
          itemName: "testUnit",
          difference: {
            unitSystem: "SourceSchema.testUnitSystem",
            phenomenon: "SourceSchema.testPhenomenon",
            definition: "TestUnit",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.InvertedUnit,
          itemName: "testInvertedUnit",
          difference: {
            label: "Test",
            description: "InvertedUnit description",
            unitSystem: "SourceSchema.testUnitSystem",
            invertsUnit: "SourceSchema.testUnit",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testInvertedUnit")).to.be.eventually.not.undefined
    .then((invertedUnit: InvertedUnit) => {
      expect(invertedUnit).to.have.a.property("schemaItemType", SchemaItemType.InvertedUnit);
      expect(invertedUnit).to.have.a.property("label").to.equal("Test");
      expect(invertedUnit).to.have.a.property("description").to.equal("InvertedUnit description");
      expect(invertedUnit).to.have.a.nested.property("unitSystem.fullName").to.equal("TargetSchema.testUnitSystem");
      expect(invertedUnit).to.have.a.nested.property("invertsUnit.fullName").to.equal("TargetSchema.testUnit");
    });
  });

  it("should merge invertedUnit changes", async () => {
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
        testInvertedUnit: {
          schemaItemType: "InvertedUnit",
          label: "Test",
          description: "InvertedUnit description",
          unitSystem: "ReferenceSchema.testUnitSystem",
          invertsUnit: "ReferenceSchema.testUnit",
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
          schemaType: SchemaItemType.InvertedUnit,
          itemName: "testInvertedUnit",
          difference: {
            label: "Changed Test",
            description: "Changed InvertedUnit description",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testInvertedUnit")).to.be.eventually.not.undefined
    .then((invertedUnit: InvertedUnit) => {
      expect(invertedUnit).to.have.a.property("label").to.equal("Changed Test");
      expect(invertedUnit).to.have.a.property("description").to.equal("Changed InvertedUnit description");
    });
  });

  it("should throw an error when merging invertedUnit with a changed unitSystem", async () => {
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
        testInvertedUnit: {
          schemaItemType: "InvertedUnit",
          unitSystem: "ReferenceSchema.testUnitSystem",
          invertsUnit: "ReferenceSchema.testUnit",
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
          schemaType: SchemaItemType.InvertedUnit,
          itemName: "testInvertedUnit",
          difference: {
            unitSystem: "SourceSchema.testUnitSystem",
          },
        },
      ],
      conflicts: undefined,
    });

    await expect(merge).to.be.rejectedWith("Changing the invertedUnit 'testInvertedUnit' unitSystem is not supported.");
  });

  it("should throw an error when merging invertedUnit with a changed invertsUnit", async () => {
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
          unitSystem: "TargetSchema.testUnitSystem",
          phenomenon: "TargetSchema.testPhenomenon",
          definition: "TestUnit",
        },
        testInvertedUnit: {
          schemaItemType: "InvertedUnit",
          unitSystem: "TargetSchema.testUnitSystem",
          invertsUnit: "TargetSchema.testUnit",
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
          schemaType: SchemaItemType.InvertedUnit,
          itemName: "testInvertedUnit",
          difference: {
            invertsUnit: "ReferenceSchema.testUnit",
          },
        },
      ],
      conflicts: undefined,
    });

    await expect(merge).to.be.rejectedWith("Changing the invertedUnit 'testInvertedUnit' invertsUnit is not supported.");
  });

  describe("iterative tests", () => {
    let sourceContext: SchemaContext;

    beforeEach(async () => {
      sourceContext = await BisTestHelper.getNewContext();
      await Schema.fromJson(referenceJson, sourceContext);
    });

    it("should add a re-mapped invertedUnit class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testItem: {
            schemaItemType: "InvertedUnit",
            label: "Test",
            description: "InvertedUnit description",
            unitSystem: "ReferenceSchema.testUnitSystem",
            invertsUnit: "ReferenceSchema.testUnit",
          },
        },
      }, sourceContext);
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "UnitSystem",
          },
        },
      }, targetContext);
  
      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "InvertedUnit");
        expect(conflict).to.have.a.property("target", "UnitSystem");
        return true;
      });
  
      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as InvertedUnit;
      schemaEdits.items.rename(sourceItem, "mergedInvertedUnit");
  
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedInvertedUnit")).to.be.eventually.fulfilled.then(async (schemaItem) => {
        expect(schemaItem).to.exist;
        expect(schemaItem).to.have.property("schemaItemType").equals(SchemaItemType.InvertedUnit);
      });
      await expect(mergedSchema.getItem("testItem")).to.be.eventually.fulfilled.then(async (schemaItem) => {
        expect(schemaItem).to.exist;
        expect(schemaItem).to.have.property("schemaItemType").equals(SchemaItemType.UnitSystem);
      });
    });

    it("should merge changes to re-mapped invertedUnit class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testItem: {
            schemaItemType: "InvertedUnit",
            label: "Changed Test",
            description: "Changed InvertedUnit description",
            unitSystem: "ReferenceSchema.testUnitSystem",
            invertsUnit: "ReferenceSchema.testUnit",
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
          mergedInvertedUnit: {
            schemaItemType: "InvertedUnit",
            label: "Test",
            description: "InvertedUnit description",
            unitSystem: "ReferenceSchema.testUnitSystem",
            invertsUnit: "ReferenceSchema.testUnit",
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as InvertedUnit;
      schemaEdits.items.rename(sourceItem, "mergedInvertedUnit");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);
 
      await expect(mergedSchema.getItem("mergedInvertedUnit")).to.be.eventually.not.undefined
        .then((invertedUnit: InvertedUnit) => {
          expect(invertedUnit).to.have.a.property("label").to.equal("Changed Test");
          expect(invertedUnit).to.have.a.property("description").to.equal("Changed InvertedUnit description");
        });
    });

    it("should merge missing kindOfQuantity with re-mapped persistence invertedUnit", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testItem: {
            schemaItemType: "InvertedUnit",
            unitSystem: "ReferenceSchema.testUnitSystem",
            invertsUnit: "ReferenceSchema.testUnit",
          },
          testKoq: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0030480000000000004,
            persistenceUnit: "SourceSchema.testItem",
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
          mergedInvertedUnit: {
            schemaItemType: "InvertedUnit",
            unitSystem: "ReferenceSchema.testUnitSystem",
            invertsUnit: "ReferenceSchema.testUnit",
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 4,
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as InvertedUnit;
      schemaEdits.items.rename(sourceItem, "mergedInvertedUnit");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testKoq")).to.be.eventually.not.undefined
      .then((koq: KindOfQuantity) => {
        expect(koq).to.have.a.nested.property("persistenceUnit.fullName").to.equal("TargetSchema.mergedInvertedUnit");
      });
    });
  });
});
