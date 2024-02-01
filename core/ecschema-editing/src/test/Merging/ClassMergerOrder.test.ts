/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {  EntityClass, Mixin, Schema, SchemaContext, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../ecschema-editing";
import { expect } from "chai";

describe("Class items merging order tests", () => {
  let context: SchemaContext;

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

  beforeEach(async () => {
    context = new SchemaContext();
  });

  describe("Entity, Struct and Mixing class merging order tests", () => {
    it("should merge the missing entity class with base class before the base class item", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          bracket:{
            schemaItemType: "EntityClass",
            description: "Bracket test class",
            baseClass: "SourceSchema.sps",
          },
          sps: {
            schemaItemType: "EntityClass",
            description: "Sps test Class",
            properties: [
              {
                name: "Status",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "string",
              },
            ],
          },
        },
      }, context);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, context);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const targetBracketBaseClass = await mergedSchema.getItem("bracket") as EntityClass;
      expect(targetBracketBaseClass.baseClass?.fullName).to.deep.equal("TargetSchema.sps");
    });

    it("should merge entity class with derived mixins before base mixin", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            description: "Test class",
            mixins: ["SourceSchema.mixinA", "SourceSchema.mixinB"],
          },
          mixinA: {
            schemaItemType: "Mixin",
            description: "Mixin A",
            appliesTo: "SourceSchema.testClass",
          },
          mixinB: {
            schemaItemType: "Mixin",
            description: "Mixin B",
            appliesTo: "SourceSchema.testClass",
          },
        },
      }, context);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, context);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<EntityClass>("testClass");

      const classMixins = mergedItem?.mixins;
      if(classMixins){
        expect((classMixins[0]).fullName).to.deep.equal("TargetSchema.mixinA");
        expect((classMixins[1]).fullName).to.deep.equal("TargetSchema.mixinB");
      }
      expect(classMixins?.length).be.equal(2);
    });

    it("should merge missing mixin with baseClass and appliesTo before the base class item and class that it appliesTo", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          mixinA: {
            schemaItemType: "Mixin",
            description: "Mixin A",
            baseClass: "SourceSchema.testBaseMixinClass",
            appliesTo: "SourceSchema.testClass",
          },
          testBaseMixinClass: {
            schemaItemType: "Mixin",
            description: "Test mixin class",
            appliesTo: "SourceSchema.testClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            description: "Test class",
          },
        },
      }, context);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, context);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<Mixin>("mixinA");

      expect(mergedItem?.appliesTo?.fullName).to.deep.equal("TargetSchema.testClass");
      expect(mergedItem?.baseClass?.fullName).to.deep.equal("TargetSchema.testBaseMixinClass");
    });

    it("it should merge missing entity class with struct properties before the struct class items", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          sps: {
            schemaItemType: "EntityClass",
            description: "Sps test Class",
            properties: [
              {
                name: "Status",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "string",
              },
              {
                name: "Allocation",
                type: "StructArrayProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "SourceSchema.middle",
                minOccurs: 0,
                maxOccurs: 2147483647,
              },
            ],
          },
          middle: {
            schemaItemType: "StructClass",
            description: "Middle test class",
            properties: [
              {
                name: "Support",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "int",
              },
              {
                name: "Allocation",
                type: "StructArrayProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "SourceSchema.allocation",
                minOccurs: 0,
                maxOccurs: 2147483647,
              },
            ],
          },
          allocation: {
            schemaItemType: "StructClass",
            description: "Allocation test Class",
            properties: [
              {
                name: "Quantity",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "int",
              },
            ],
          },
        },
      }, context);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, context);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const middleTarget = await mergedSchema.getItem("middle") as StructClass;

      expect(middleTarget.toJSON()).to.deep.equal({
        schemaItemType: "StructClass",
        description: "Middle test class",
        properties: [
          {
            name: "Support",
            type: "PrimitiveProperty",
            isReadOnly: true,
            priority: 0,
            typeName: "int",
          },
          {
            name: "Allocation",
            type: "StructArrayProperty",
            isReadOnly: true,
            priority: 0,
            typeName: "TargetSchema.allocation",
            minOccurs: 0,
            maxOccurs: 2147483647,
          },
        ],
      });
    });

    it("it should merge missing struct properties of existing entity class before the struct class item",async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          sps: {
            schemaItemType: "EntityClass",
            description: "Sps test Class",
            properties: [
              {
                name: "Status",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "string",
              },
              {
                name: "Allocation",
                type: "StructArrayProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "SourceSchema.middle",
                minOccurs: 0,
                maxOccurs: 2147483647,
              },
            ],
          },
          middle: {
            schemaItemType: "StructClass",
            description: "Middle test class",
            properties: [
              {
                name: "Support",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "int",
              },
              {
                name: "Allocation",
                type: "StructArrayProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "SourceSchema.allocation",
                minOccurs: 0,
                maxOccurs: 2147483647,
              },
            ],

          },
          allocation: {
            schemaItemType: "StructClass",
            description: "Allocation test Class",
            properties: [
              {
                name: "BracketSlot",
                type: "StructArrayProperty",
                label: "Bracket Slot",
                isReadOnly: true,
                typeName: "sourceSchema.bracketSlot",
                minOccurs: 0,
                maxOccurs: 2147483647,
              },
            ],
          },
          bracketSlot: {
            schemaItemType: "StructClass",
            description: "BracketSlot Class",
            properties: [
              {
                name: "Status",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "int",
              },
            ],
          },
        },
      }, context);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          sps: {
            schemaItemType: "EntityClass",
            description: "Sps test Class",
          },
          middle: {
            schemaItemType: "StructClass",
            description: "Middle test class",
            properties: [
              {
                name: "Support",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "int",
              },
            ],

          },
          bracketSlot: {
            schemaItemType: "StructClass",
            description: "BracketSlot Class",
            properties: [
              {
                name: "Status",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "int",
              },
            ],
          },
        },
      }, context);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);

      const middleTarget = await mergedSchema.getItem("middle") as StructClass;
      const allocationTarget = await mergedSchema.getItem("allocation") as StructClass;

      expect(middleTarget.toJSON()).to.deep.equal({
        schemaItemType: "StructClass",
        description: "Middle test class",
        properties: [
          {
            name: "Support",
            type: "PrimitiveProperty",
            isReadOnly: true,
            priority: 0,
            typeName: "int",
          },
          {
            name: "Allocation",
            type: "StructArrayProperty",
            isReadOnly: true,
            priority: 0,
            typeName: "TargetSchema.allocation",
            minOccurs: 0,
            maxOccurs: 2147483647,
          },
        ],
      });

      expect(allocationTarget.toJSON()).to.deep.equal({
        schemaItemType: "StructClass",
        description: "Allocation test Class",
        properties: [
          {
            name: "BracketSlot",
            type: "StructArrayProperty",
            label: "Bracket Slot",
            isReadOnly: true,
            typeName: "TargetSchema.bracketSlot",
            minOccurs: 0,
            maxOccurs: 2147483647,
          },
        ],
      });
    });
  });
});
