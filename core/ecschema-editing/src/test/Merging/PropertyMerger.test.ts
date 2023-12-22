/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, EntityClass, Schema, SchemaContext, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
/* eslint-disable @typescript-eslint/naming-convention */

describe("Property merger tests", () => {
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

  const testJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TestSchema",
    version: "01.00.15",
    alias: "test",
    items: {
      TestCategory: {
        schemaItemType: "PropertyCategory",
        priority: 4,
      },
      TestUnitSystem: {
        schemaItemType: "UnitSystem",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "Test Phenomenon",
      },
      TestUnit: {
        schemaItemType: "Unit",
        unitSystem: "TestSchema.TestUnitSystem",
        phenomenon: "TestSchema.TestPhenomenon",
        definition: "YRD",
      },
      TestKoq: {
        schemaItemType: "KindOfQuantity",
        relativeError: 0.00001,
        persistenceUnit: "TestSchema.TestUnit",
      },
      TestEnumeration: {
        schemaItemType: "Enumeration",
        type: "string",
        enumerators: [
          {
            name: "None",
            label: "None",
            value: "-",
          },
        ],
      },
      TestStruct: {
        schemaItemType: "StructClass",
      },
    },
  };

  beforeEach(async () => {
    targetContext = new SchemaContext();
    sourceContext = new SchemaContext();
    await Schema.fromJson(testJson, sourceContext);
  });

  describe("Property missing tests", () => {
    it("should merge missing primitive property", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestCategory: {
            schemaItemType: "PropertyCategory",
            priority: 4,
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "StringProp",
              type: "PrimitiveProperty",
              typeName: "string",
              label: "String Property",
              description: "Description for string property",
              category: "SourceSchema.TestCategory",
              kindOfQuantity: "TestSchema.TestKoq",
              minLength: 5,
              maxLength: 450,
              extendedTypeName: "json",
            }],
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
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "StringProp",
        type: "PrimitiveProperty",
        typeName: "string",
        label: "String Property",
        description: "Description for string property",
        category: "TargetSchema.TestCategory",
        kindOfQuantity: "TestSchema.TestKoq",
        minLength: 5,
        maxLength: 450,
        extendedTypeName: "json",
      }]);
    });

    it("should merge missing primitive array property", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "IntArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "int",
              label: "Integer Array Property",
              description: "Description for int array property",
              minValue: 2,
              maxValue: 20002,
              minOccurs: 5,
              maxOccurs: 250,
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<StructClass>("TestStruct");
      const mergedItem = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(mergedItem!.toJSON().properties).deep.eq(sourceItem!.toJSON().properties);
    });

    it("should merge missing enumeration property", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            enumerators: [
              {
                name: "None",
                label: "None",
                value: 0,
              },
            ],
          },
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
            properties: [{
              name: "EnumProp",
              type: "PrimitiveProperty",
              typeName: "SourceSchema.TestEnumeration",
              label: "Enumeration Property",
              description: "Description for enumeration property",
              isReadOnly: true,
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            enumerators: [
              {
                name:  "None",
                label: "None",
                value: 0,
              },
            ],
          },
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "EnumProp",
        type: "PrimitiveProperty",
        typeName: "TargetSchema.TestEnumeration",
        label: "Enumeration Property",
        description: "Description for enumeration property",
        isReadOnly: true,
      }]);
    });

    it("should merge missing enumeration array property", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyProperty",
            properties: [{
              name: "EnumArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "TestSchema.TestEnumeration",
              label: "Enumeration Array Property",
              description: "Description for enumeration array property",
              category: "TestSchema.TestCategory",
              minOccurs: 5,
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyProperty",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<CustomAttributeClass>("TestCA");
      const mergedItem = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
      expect(mergedItem!.toJSON().properties).deep.eq(sourceItem!.toJSON().properties);
    });

    it("should merge missing struct property", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestCategory: {
            schemaItemType: "PropertyCategory",
            priority: 4,
          },
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "StructProp",
              type: "StructProperty",
              typeName: "TestSchema.TestStruct",
              label: "Struct Property",
              description: "Description for struct property",
              category: "SourceSchema.TestCategory",
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "BoolProp",
              type: "PrimitiveProperty",
              typeName: "boolean",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "BoolProp",
        type: "PrimitiveProperty",
        typeName: "boolean",
      }, {
        name: "StructProp",
        type: "StructProperty",
        typeName: "TestSchema.TestStruct",
        label: "Struct Property",
        description: "Description for struct property",
        category: "TargetSchema.TestCategory",
      }]);
    });

    it("should merge missing struct array property", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "StructArrayProp",
              type: "StructArrayProperty",
              typeName: "SourceSchema.TestStruct",
              description: "Description for struct property",
              category: "TestSchema.TestCategory",
              kindOfQuantity: "TestSchema.TestKoq",
              minOccurs: 5,
              maxOccurs: 105,
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "StructArrayProp",
        type: "StructArrayProperty",
        typeName: "TargetSchema.TestStruct",
        description: "Description for struct property",
        category: "TestSchema.TestCategory",
        kindOfQuantity: "TestSchema.TestKoq",
        minOccurs: 5,
        maxOccurs: 105,
      }]);
    });
  });

  describe("Property delta tests", () => {
    it("should merge primitive property changes", async () => {
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
            properties: [{
              name: "StringProp",
              type: "PrimitiveProperty",
              typeName: "string",
              label: "String Property",
              description: "Description for string property",
              isReadOnly: true,
              category: "TestSchema.TestCategory",
              kindOfQuantity: "TestSchema.TestKoq",
              minLength: 1,
              maxLength: 101,
              extendedTypeName: "json",
            }],
          },
        },
      }, sourceContext);

      await Schema.fromJson(testJson, targetContext);
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "StringProp",
              type: "PrimitiveProperty",
              typeName: "string",
              label: "StringProperty",
              description: "Description for stringprop",
              category: "TestSchema.TestCategory",
              kindOfQuantity: "TestSchema.TestKoq",
              minLength: 2,
              maxLength: 202,
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<EntityClass>("TestEntity");
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().properties).deep.eq(sourceItem!.toJSON().properties);
    });

    it("should merge primitive array property changes", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "IntArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "int",
              label: "Integer Array Property",
              description: "Description for int array property",
              minOccurs: 3,
              maxOccurs: 306,
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "IntArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "int",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<EntityClass>("TestEntity");
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().properties).deep.eq(sourceItem!.toJSON().properties);
    });

    it("should merge enumeration property changes", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "EnumProp",
              type: "PrimitiveProperty",
              typeName: "TestSchema.TestEnumeration",
              label: "Enumeration Property",
              description: "Description for enumeration property",
              category: "TestSchema.TestCategory",
              isReadOnly: true,
            }],
          },
        },
      }, sourceContext);

      await Schema.fromJson(testJson, targetContext);
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "EnumProp",
              type: "PrimitiveProperty",
              typeName: "TestSchema.TestEnumeration",
              label: "EnumProperty",
              category: "TestSchema.TestCategory",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<StructClass>("TestStruct");
      const mergedItem = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(mergedItem!.toJSON().properties).deep.eq(sourceItem!.toJSON().properties);
    });

    it("should merge enumeration array property changes", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            enumerators: [
              {
                name: "None",
                label: "None",
                value: 0,
              },
            ],
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "EnumArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "SourceSchema.TestEnumeration",
              label: "Enumeration Array Property",
              description: "Description for enumeration array property",
              priority: 4,
              minOccurs: 5,
              maxOccurs: 25,
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            enumerators: [
              {
                name: "None",
                label: "None",
                value: 0,
              },
            ],
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "EnumArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "TargetSchema.TestEnumeration",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "EnumArrayProp",
        type: "PrimitiveArrayProperty",
        typeName: "TargetSchema.TestEnumeration",
        label: "Enumeration Array Property",
        description: "Description for enumeration array property",
        priority: 4,
        minOccurs: 5,
        maxOccurs: 25,
      }]);
    });

    it("should merge struct property changes", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "StructProp",
              type: "StructProperty",
              typeName: "SourceSchema.TestStruct",
              label: "Struct Property",
              description: "Description for struct property",
              priority: 5,
              isReadOnly: true,
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "StructProp",
              type: "StructProperty",
              typeName: "TargetSchema.TestStruct",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "StructProp",
        type: "StructProperty",
        typeName: "TargetSchema.TestStruct",
        label: "Struct Property",
        description: "Description for struct property",
        priority: 5,
        isReadOnly: true,
      }]);
    });

    it("should merge struct array property changes", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            properties: [{
              name: "StructArrayProp",
              type: "StructArrayProperty",
              typeName: "TestSchema.TestStruct",
              description: "Description for struct array property",
              kindOfQuantity: "TestSchema.TestKoq",
              priority: 5,
              isReadOnly: false,
              minOccurs: 11,
              maxOccurs: 121,
            }],
          },
        },
      }, sourceContext);

      await Schema.fromJson(testJson, targetContext);
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            properties: [{
              name: "StructArrayProp",
              type: "StructArrayProperty",
              typeName: "TestSchema.TestStruct",
              description: "Description for structarrayproperty",
              kindOfQuantity: "TestSchema.TestKoq",
              priority: 2,
              isReadOnly: true,
              minOccurs: 1,
              maxOccurs: 12,
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
      const mergedItem = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
      expect(mergedItem!.toJSON().properties).deep.eq(sourceItem!.toJSON().properties);
    });

    // Negative cases
    it("should throw an error when merging properties typeName changed from int to boolean", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "Prop",
              type: "PrimitiveProperty",
              typeName: "bool",
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "Prop",
              type: "PrimitiveProperty",
              typeName: "int",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the property 'Prop' primitiveType is not supported.");
    });

    it("should throw an error when merging properties type changed from PrimitiveArrayProperty to PrimitiveProperty", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "Prop",
              type: "PrimitiveProperty",
              typeName: "string",
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "Prop",
              type: "PrimitiveArrayProperty",
              typeName: "string",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the property 'Prop' type is not supported.");
    });

    it("should throw an error when merging properties category changed", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "Prop",
              type: "PrimitiveProperty",
              typeName: "string",
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "Prop",
              type: "PrimitiveArrayProperty",
              typeName: "string",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the property 'Prop' type is not supported.");
    });

    it("should throw an error when merging struct properties structClass changed", async () => {
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
            properties: [{
              name: "StructProp",
              type: "StructProperty",
              typeName: "TestSchema.TestStruct",
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TargetStruct: {
            schemaItemType: "StructClass",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "StructProp",
              type: "StructProperty",
              typeName: "TargetSchema.TargetStruct",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the property 'StructProp' structClass is not supported.");
    });

    it("should throw an error when merging struct array properties structClass changed", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          SourceStruct: {
            schemaItemType: "StructClass",
          },
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "StructArrayProp",
              type: "StructArrayProperty",
              typeName: "SourceSchema.SourceStruct",
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TargetStruct: {
            schemaItemType: "StructClass",
          },
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "StructArrayProp",
              type: "StructArrayProperty",
              typeName: "TargetSchema.TargetStruct",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the property 'StructArrayProp' structClass is not supported.");
    });

    it("should throw an error when merging enumeration properties enumeration changed", async () => {
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
            properties: [{
              name: "EnumProp",
              type: "PrimitiveProperty",
              typeName: "TestSchema.TestEnumeration",
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TargetEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            enumerators: [
              {
                name: "None",
                label: "None",
                value: 0,
              },
            ],
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "EnumProp",
              type: "PrimitiveProperty",
              typeName: "TargetSchema.TargetEnumeration",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the property 'EnumProp' enumeration is not supported.");
    });

    it("should throw an error when merging enumeration array properties enumeration changed", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          SourceEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            enumerators: [
              {
                name: "None",
                label: "None",
                value: 0,
              },
            ],
          },
          TestEntity: {
            schemaItemType: "StructClass",
            properties: [{
              name: "EnumArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "SourceSchema.SourceEnumeration",
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TargetEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            enumerators: [
              {
                name: "None",
                label: "None",
                value: 0,
              },
            ],
          },
          TestEntity: {
            schemaItemType: "StructClass",
            properties: [{
              name: "EnumArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "TargetSchema.TargetEnumeration",
            }],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the property 'EnumArrayProp' enumeration is not supported.");
    });
  });
});
