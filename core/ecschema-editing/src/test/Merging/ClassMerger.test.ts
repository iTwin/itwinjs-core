/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, EntityClass, Mixin, Schema, SchemaContext, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Class merger tests", () => {
  let targetContext: SchemaContext;
  let sourceContext: SchemaContext;

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.2.3",
    alias: "source",
  };
  const targetJson =  {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  beforeEach(() => {
    targetContext = new SchemaContext();
    sourceContext = new SchemaContext();
  });

  describe("Class missing tests", () => {
    it("should merge missing struct class", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            label: "Test Structure",
            description: "Description for Test Structure",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<StructClass>("TestStruct");
      const mergedItemy = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(mergedItemy!.toJSON()).deep.eq(sourceItem!.toJSON());
    });

    it("should merge missing custom attribute class", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestCAClass: {
            schemaItemType: "CustomAttributeClass",
            label: "Test Custom Attribute Class",
            appliesTo: "AnyClass",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<CustomAttributeClass>("TestCAClass");
      const mergedItem = await mergedSchema.getItem<CustomAttributeClass>("TestCAClass");
      expect(mergedItem!.toJSON()).deep.eq(sourceItem!.toJSON());
    });

    it("should merge missing entity class with baseClass", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestBase: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            label: "Test Entity",
            description: "Description for TestEntity",
            baseClass: "SourceSchema.TestBase",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON()).deep.eq({
        schemaItemType: "EntityClass",
        label: "Test Entity",
        description: "Description for TestEntity",
        baseClass: "TargetSchema.TestBase",
      });
    });

    it("should merge missing entity class with referenced baseClass", async () => {
      await Schema.fromJson({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "01.00.15",
        alias: "test",
        items: {
          TestBase: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
        },
      }, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            label: "Test Entity",
            description: "Description for TestEntity",
            baseClass: "TestSchema.TestBase",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<EntityClass>("TestEntity");
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON()).deep.eq(sourceItem!.toJSON());
    });

    it("should merge missing entity class with referenced mixin", async () => {
      await Schema.fromJson({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "01.00.15",
        alias: "test",
        items: {
          BaseClass: {
            schemaItemType: "EntityClass",
          },
          TestMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.BaseClass",
          },
        },
      }, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            label: "Test Entity",
            description: "Description for TestEntity",
            baseClass: "TestSchema.BaseClass",
            mixins: ["TestSchema.TestMixin"],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<EntityClass>("TestEntity");
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON()).deep.eq(sourceItem!.toJSON());
    });

    it("should merge missing mixin", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          TestMixin: {
            schemaItemType: "Mixin",
            label: "Test Mixin",
            description: "Description for TestMixin",
            appliesTo: "SourceSchema.TestEntity",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<Mixin>("TestMixin");
      expect(mergedItem!.toJSON()).deep.eq({
        schemaItemType: "Mixin",
        label: "Test Mixin",
        description: "Description for TestMixin",
        appliesTo: "TargetSchema.TestEntity",
      });
    });
  });

  describe("Class delta tests", () => {
    it("should merge struct class changes", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            label: "Test Structure",
            description: "Description for Test Structure",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            label: "Struct",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<StructClass>("TestStruct");
      const mergedItem = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(mergedItem!.toJSON()).deep.eq(sourceItem!.toJSON());
    });

    it("should merge custom attribute class changes", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestCAClass: {
            schemaItemType: "CustomAttributeClass",
            label: "Test Custom Attribute Class",
            appliesTo: "AnyClass",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestCAClass: {
            schemaItemType: "CustomAttributeClass",
            label: "TestCustomAttributeClass",
            appliesTo: "AnyProperty",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<CustomAttributeClass>("TestCAClass");
      expect(mergedItem!.toJSON()).deep.eq({
        schemaItemType: "CustomAttributeClass",
        label: "Test Custom Attribute Class",
        appliesTo: "AnyClass, AnyProperty",
      });
    });

    it("should merge class modifier changed from Sealed to None", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            modifier: "Sealed",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<EntityClass>("TestEntity");
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON()).deep.eq(sourceItem!.toJSON());
    });

    it("should merge class baseclass from the middle of a class hierarchy", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          BaseEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          TestBase: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.BaseEntity",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.TestBase",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          BaseEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TargetSchema.BaseEntity",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().baseClass).deep.eq("TargetSchema.TestBase");
    });

    it("should throw an error when merging classes with different schema item types", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestClass: {
            schemaItemType: "EntityClass",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestClass: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the class 'TestClass' type is not supported.");
    });

    it("should throw an error when merging class modifier changed from Abstract to Sealed", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            modifier: "Sealed",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the class 'TestEntity' modifier is not supported.");
    });

    it("should throw an error when merging base class not in the middle of a class hierarchy", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          SourceBase: {
            schemaItemType: "EntityClass",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.SourceBase",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TargetBase: {
            schemaItemType: "EntityClass",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TargetSchema.TargetBase",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the class 'TestEntity' baseClass is not supported.");
    });

    it("should throw an error when merging base class changed from existing one to undefined", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          BaseEntity: {
            schemaItemType: "EntityClass",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TargetSchema.BaseEntity",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the class 'TestEntity' baseClass is not supported.");
    });

    it("should throw an error when merging base class changed from undefined to existing one", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          BaseEntity: {
            schemaItemType: "EntityClass",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.BaseEntity",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the class 'TestEntity' baseClass is not supported.");
    });

    it("should throw an error when merging mixins with different appliesTo values", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          SourceEntity: {
            schemaItemType: "EntityClass",
          },
          TestMixin: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.SourceEntity",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
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

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the mixin 'TestMixin' appliesTo is not supported.");
    });

    it("should throw an error when merging entity classes with different mixins", async () => {
      const jsonObj = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "01.00.15",
        alias: "test",
        items: {
          TestBase: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          TestMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.TestBase",
          },
        },
      };

      await Schema.fromJson(jsonObj, sourceContext);
      await Schema.fromJson(jsonObj, targetContext);

      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.TestBase",
            mixins: [
              "TestSchema.TestMixin",
            ],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TargetMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.TestBase",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.TestBase",
            mixins: [
              "TargetSchema.TargetMixin",
            ],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the entity class 'TestEntity' mixins is not supported.");
    });
  });
});
