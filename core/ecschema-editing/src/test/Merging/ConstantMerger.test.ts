/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, Phenomenon, Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { getSchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";
import { AnySchemaDifferenceConflict, ConflictCode, SchemaEdits } from "../../ecschema-editing";

describe("Constant merger tests", () => {
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
    const mergedSchema = await merger.merge({
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

    await expect(mergedSchema.getItem("testConstant")).to.be.eventually.not.undefined
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

    await expect(mergedSchema.getItem("testConstant")).to.be.eventually.not.undefined
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
    await expect(merge).to.be.rejectedWith("The Constant testConstant has an invalid 'numerator' attribute.");
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
    await expect(merge).to.be.rejectedWith("The Constant testConstant has an invalid 'denominator' attribute.");
  });

  describe("iterative tests", () => {
    it("should add a re-mapped constant class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "testPhenomenon",
          },
          testItem: {
            schemaItemType: "Constant",
            phenomenon: "SourceSchema.testPhenomenon",
            definition: "ONE",
            numerator: 100,
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
        expect(conflict).to.have.a.property("source", "Constant");
        expect(conflict).to.have.a.property("target", "PropertyCategory");
        return true;
      });
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Constant;      
      schemaEdits.items.rename(testItem, "mergedConstant");
  
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedConstant")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.Constant);
        expect(ecClass).has.a.nested.property("phenomenon.name").equals("testPhenomenon");
      });
    });

    it("should merge changes to re-mapped constant class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "testPhenomenon",
          },
          testItem: {
            schemaItemType: "Constant",
            label: "Changed Hecto",
            description: "Changed Hecto Constant",
            phenomenon: "SourceSchema.testPhenomenon",
            definition: "ONE",
            numerator: 100,
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "testPhenomenon",
          },
          mergedConstant: {
            schemaItemType: "Constant",
            label: "Hecto",
            description: "Hecto Constant",
            phenomenon: "TargetSchema.testPhenomenon",
            definition: "ONE",
            numerator: 100,
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Constant;      
      schemaEdits.items.rename(testItem, "mergedConstant");

      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);
 
      await expect(mergedSchema.getItem("mergedConstant")).to.be.eventually.not.undefined
        .then((constant: Constant) => {
          expect(constant).to.have.a.property("label").to.equal("Changed Hecto");
          expect(constant).to.have.a.property("description").to.equal("Changed Hecto Constant");
        });
    });

    it("should merge re-mapped phenomenon to re-mapped constant", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          phenomenonItem: {
            schemaItemType: "Phenomenon",
            definition: "phenomenonItem",
          },
          testItem: {
            schemaItemType: "Constant",
            phenomenon: "SourceSchema.phenomenonItem",
            definition: "ONE",
            numerator: 100,
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          phenomenonItem: {
            schemaItemType: "StructClass",
          },
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "testPhenomenon",
          },
          mergedConstant: {
            schemaItemType: "Constant",
            phenomenon: "TargetSchema.testPhenomenon",
            definition: "ONE",
            numerator: 100,
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Constant;      
      schemaEdits.items.rename(testItem, "mergedConstant");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "Phenomenon");
        expect(conflict).to.have.a.property("target", "StructClass");
        return true;
      });
  
      const phenomenonItem = await sourceSchema.getItem("phenomenonItem") as Phenomenon;      
      schemaEdits.items.rename(phenomenonItem, "mergedPhenomenon");
  
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("mergedPhenomenon")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.Phenomenon);
      });
      await expect(mergedSchema.getItem("mergedConstant")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.a.nested.property("phenomenon.name").equals("mergedPhenomenon");
      });
    });

    it("should throw an error when a re-mapped constant definition conflict exists", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "testPhenomenon",
          },
          testItem: {
            schemaItemType: "Constant",
            phenomenon: "SourceSchema.testPhenomenon",
            definition: "PI",
            numerator: 100,
          }, 
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "testPhenomenon",
          },
          mergedConstant: {
            schemaItemType: "Constant",
            phenomenon: "TargetSchema.testPhenomenon",
            definition: "ONE",
            numerator: 100,
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Constant;      
      schemaEdits.items.rename(testItem, "mergedConstant");

      const merger = new SchemaMerger(targetSchema.context);
      await expect(merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits)).to.be.rejectedWith("The Constant testItem has an invalid 'definition' attribute.");
    });

    it("should throw an error when a re-mapped constant numerator conflict exists", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "testPhenomenon",
          },
          testItem: {
            schemaItemType: "Constant",
            phenomenon: "SourceSchema.testPhenomenon",
            definition: "ONE",
            numerator: 1,
          }, 
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "testPhenomenon",
          },
          mergedConstant: {
            schemaItemType: "Constant",
            phenomenon: "TargetSchema.testPhenomenon",
            definition: "ONE",
            numerator: 100,
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Constant;      
      schemaEdits.items.rename(testItem, "mergedConstant");

      const merger = new SchemaMerger(targetSchema.context);
      await expect(merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits)).to.be.rejectedWith("The Constant testItem has an invalid 'numerator' attribute.");
    });

    it("should throw an error when a re-mapped constant denominator conflict exists", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "testPhenomenon",
          },
          testItem: {
            schemaItemType: "Constant",
            phenomenon: "SourceSchema.testPhenomenon",
            definition: "ONE",
            numerator: 100,
            denominator: 9,
          }, 
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "testPhenomenon",
          },
          mergedConstant: {
            schemaItemType: "Constant",
            phenomenon: "TargetSchema.testPhenomenon",
            definition: "ONE",
            numerator: 100,
            denominator: 5,
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Constant;      
      schemaEdits.items.rename(testItem, "mergedConstant");

      const merger = new SchemaMerger(targetSchema.context);
      await expect(merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits)).to.be.rejectedWith("The Constant testItem has an invalid 'denominator' attribute.");
    });
  });
});
