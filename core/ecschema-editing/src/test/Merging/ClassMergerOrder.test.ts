/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, Mixin, Schema, SchemaContext, SchemaItemType, StructClass } from "@itwin/ecschema-metadata";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";

describe("Class items merging order tests", () => {
  let context: SchemaContext;

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

  beforeEach(async () => {
    context = await BisTestHelper.getNewContext();
  });

  it("should merge the missing entity class with base class before the base class item", async () => {
    await Schema.fromJson(targetJson, context);
    const merger = new SchemaMerger(context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "bracket",
          difference: {
            description: "Bracket test class",
            baseClass: "SourceSchema.sps",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "sps",
          difference: {
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
      ],
    });

    const targetBracketBaseClass = await mergedSchema.getItem("bracket") as EntityClass;
    expect(targetBracketBaseClass.baseClass?.fullName).to.deep.equal("TargetSchema.sps");
  });

  it("should merge entity class with derived mixins before base mixin", async () => {
    await Schema.fromJson(targetJson, context);
    const merger = new SchemaMerger(context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "testClass",
          difference: {
            description: "Test class",
            mixins: [
              "SourceSchema.mixinA",
              "SourceSchema.mixinB",
            ],
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.Mixin,
          itemName: "mixinA",
          difference: {
            description: "Mixin A",
            appliesTo: "SourceSchema.testClass",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.Mixin,
          itemName: "mixinB",
          difference: {
            description: "Mixin B",
            appliesTo: "SourceSchema.testClass",
          },
        },
      ],
    });

    const mergedItem = await mergedSchema.getItem<EntityClass>("testClass");
    const classMixins = mergedItem?.mixins;
    if (classMixins) {
      expect((classMixins[0]).fullName).to.deep.equal("TargetSchema.mixinA");
      expect((classMixins[1]).fullName).to.deep.equal("TargetSchema.mixinB");
    }
    expect(classMixins?.length).be.equal(2);
  });

  it("should merge missing mixin with baseClass and appliesTo before the base class item and class that it appliesTo", async () => {
    await Schema.fromJson(targetJson, context);
    const merger = new SchemaMerger(context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.Mixin,
          itemName: "mixinA",
          difference: {
            description: "Mixin A",
            baseClass: "SourceSchema.testBaseMixinClass",
            appliesTo: "SourceSchema.testClass",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "testClass",
          difference: {
            description: "Test class",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.Mixin,
          itemName: "testBaseMixinClass",
          difference: {
            description: "Test mixin class",
            appliesTo: "SourceSchema.testClass",
          },
        },
      ],
      conflicts: undefined,
    });

    const mergedItem = await mergedSchema.getItem<Mixin>("mixinA");
    expect(mergedItem?.appliesTo?.fullName).to.deep.equal("TargetSchema.testClass");
    expect(mergedItem?.baseClass?.fullName).to.deep.equal("TargetSchema.testBaseMixinClass");
  });

  it("it should merge missing entity class with struct properties before the struct class items", async () => {
    await Schema.fromJson(targetJson, context);
    const merger = new SchemaMerger(context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "sps",
          difference: {
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
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.StructClass,
          itemName: "middle",
          difference: {
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
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.StructClass,
          itemName: "allocation",
          difference: {
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
      ],
    });

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

  it("it should merge missing struct properties of existing entity class before the struct class item", async () => {
    await Schema.fromJson({
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

    const merger = new SchemaMerger(context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.Property,
          itemName: "sps",
          path: "Status",
          difference: {
            name: "Status",
            type: "PrimitiveProperty",
            isReadOnly: true,
            priority: 0,
            typeName: "string",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.Property,
          itemName: "sps",
          path: "Allocation",
          difference: {
            name: "Allocation",
            type: "StructArrayProperty",
            isReadOnly: true,
            priority: 0,
            typeName: "SourceSchema.middle",
            minOccurs: 0,
            maxOccurs: 2147483647,
          },
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.Property,
          itemName: "middle",
          path: "Allocation",
          difference: {
            name: "Allocation",
            type: "StructArrayProperty",
            isReadOnly: true,
            priority: 0,
            typeName: "SourceSchema.allocation",
            minOccurs: 0,
            maxOccurs: 2147483647,
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.StructClass,
          itemName: "allocation",
          difference: {
            description: "Allocation test Class",
            properties: [
              {
                name: "BracketSlot",
                type: "StructArrayProperty",
                label: "Bracket Slot",
                isReadOnly: true,
                typeName: "SourceSchema.bracketSlot",
                minOccurs: 0,
                maxOccurs: 2147483647,
              },
            ],
          },
        },
      ],
    });

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
