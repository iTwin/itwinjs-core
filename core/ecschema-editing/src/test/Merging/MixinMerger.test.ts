/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECClassModifier, Mixin, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaEdits } from "../../ecschema-editing";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Mixin merger tests", () => {
  let targetContext: SchemaContext;
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

  beforeEach(async () => {
    targetContext = await BisTestHelper.getNewContext();
  });

  it("should merge missing mixin", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
          difference: {
            modifier: "Abstract",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.Mixin,
          itemName: "TestMixin",
          difference: {
            label: "Test Mixin",
            description: "Description for TestMixin",
            appliesTo: "SourceSchema.TestEntity",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestMixin")).to.be.eventually.not.undefined
      .then((mergedItem: Mixin) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.Mixin);
        expect(mergedItem).to.have.a.property("label", "Test Mixin");
        expect(mergedItem).to.have.a.property("description", "Description for TestMixin");
        expect(mergedItem).to.have.a.nested.property("appliesTo.fullName", "TargetSchema.TestEntity");
      });
  });

  it("should merge mixin base class derived from the current base class", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        BaseEntity: {
          schemaItemType: SchemaItemType.EntityClass,
          modifier: "Abstract",
        },
        TestEntity: {
          schemaItemType: SchemaItemType.EntityClass,
          baseClass: "TargetSchema.BaseEntity",
        },
        BaseMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TargetSchema.BaseEntity",
        },
        TestMixin: {
          schemaItemType: "Mixin",
          baseClass: "TargetSchema.BaseMixin",
          appliesTo: "TargetSchema.TestEntity",
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
          schemaType: SchemaItemType.Mixin,
          itemName: "TestBase",
          difference: {
            baseClass: "SourceSchema.BaseMixin",
            appliesTo: "SourceSchema.BaseEntity",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.Mixin,
          itemName: "TestMixin",
          difference: {
            baseClass: "SourceSchema.TestBase",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestMixin")).to.be.eventually.not.undefined
      .then((mergedItem: Mixin) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.Mixin);
        expect(mergedItem).to.have.a.nested.property("baseClass.fullName", "TargetSchema.TestBase");
      });
  });

  it("should throw an error when merging mixins with different appliesTo values", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TargetEntity: {
          schemaItemType: "EntityClass",
        },
        TestMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TargetSchema.TargetEntity",
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
          schemaType: SchemaItemType.EntityClass,
          itemName: "SourceEntity",
          difference: {
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.Mixin,
          itemName: "TestMixin",
          difference: {
            appliesTo: "SourceSchema.SourceEntity",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the mixin 'TestMixin' appliesTo is not supported.");
  });

  describe("iterative tests", () => {
    it("should add a re-mapped mixin class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.testEntity",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
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
        expect(conflict).to.have.a.property("source", "Mixin");
        expect(conflict).to.have.a.property("target", "UnitSystem");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Mixin;
      schemaEdits.items.rename(testItem, "mergedMixin");
  
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedMixin")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.Mixin);
        expect(ecClass).has.a.nested.property("appliesTo.name").equals("testEntity");
      });
    });

    it("should merge changes to re-mapped mixin class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "Mixin",
            modifier: "None",
            label: "Changed Phasing",
            description: "Changed Phasing Mixin",
            appliesTo: "SourceSchema.testEntity",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          mergedMixin: {
            schemaItemType: "Mixin",
            modifier: "Sealed",
            label: "Phasing",
            description: "Phasing Mixin",
            appliesTo: "TargetSchema.testEntity",
          },
          testItem: {
            schemaItemType: "UnitSystem",
          },          
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Mixin;
      schemaEdits.items.rename(testItem, "mergedMixin");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
 
      await expect(mergedSchema.getItem("mergedMixin")).to.be.eventually.not.undefined
        .then((mixin: Mixin) => {
          expect(mixin).to.have.a.property("label").to.equal("Changed Phasing");
          expect(mixin).to.have.a.property("description").to.equal("Changed Phasing Mixin");
          expect(mixin).to.have.a.property("modifier").to.equal(ECClassModifier.None);
          expect(mixin).to.have.a.nested.property("appliesTo.name").to.equal("testEntity");
        });
    });

    it("should add a mixin with re-mapped mixin as base class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testMixin: {
            schemaItemType: "Mixin",
            baseClass: "SourceSchema.testItem",
            appliesTo: "SourceSchema.testEntity",
          },
          testItem: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.testEntity",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          mergedMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TargetSchema.testEntity",
          },
          testItem: {
            schemaItemType: "UnitSystem",
          },          
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Mixin;
      schemaEdits.items.rename(testItem, "mergedMixin");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
 
      await expect(mergedSchema.getItem("testMixin")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.Mixin);
        expect(ecClass).to.have.a.nested.property("baseClass.name").to.equal("mergedMixin");
      });
    });

    it("should add an entity class with re-mapped mixin", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          sourceEntity: {
            schemaItemType: "EntityClass",
            mixins: [
              "SourceSchema.testItem",
            ],
          },
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.testEntity",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          mergedMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TargetSchema.testEntity",
          },
          testItem: {
            schemaItemType: "UnitSystem",
          },          
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Mixin;
      schemaEdits.items.rename(testItem, "mergedMixin");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
 
      await expect(mergedSchema.getItem("sourceEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.EntityClass);
        expect(ecClass).to.have.a.nested.property("mixins[0].name").equals("mergedMixin");
      });
    });

    it("should throw an error when merging mixins with different appliesTo values", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          sourceEntity: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.sourceEntity",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          mergedMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TargetSchema.testEntity",
          },
          testItem: {
            schemaItemType: "UnitSystem",
          },          
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as Mixin;
      schemaEdits.items.rename(testItem, "mergedMixin");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);     
      const merger = new SchemaMerger(targetContext);
      await expect(merger.merge(result, schemaEdits)).to.be.rejectedWith("Changing the mixin 'testItem' appliesTo is not supported.");
    });
  });
});
