/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, ECClass, EntityClass, Mixin, Property, PropertyType, Schema, SchemaContext, SchemaItemType, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { getSchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";
import { AnySchemaDifferenceConflict, ConflictCode, SchemaEdits } from "../../ecschema-editing";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Property merger tests", () => {
  let targetContext: SchemaContext;

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
      TestUnit2: {
        schemaItemType: "Unit",
        unitSystem: "TestSchema.TestUnitSystem",
        phenomenon: "TestSchema.TestPhenomenon",
        definition: "Ft",
      },
      TestKoq: {
        schemaItemType: "KindOfQuantity",
        relativeError: 0.00001,
        persistenceUnit: "TestSchema.TestUnit",
      },
      TestKoqCopy: {
        schemaItemType: "KindOfQuantity",
        relativeError: 0.00001,
        persistenceUnit: "TestSchema.TestUnit",
      },
      TestKoqDifferentUnit: {
        schemaItemType: "KindOfQuantity",
        relativeError: 0.00001,
        persistenceUnit: "TestSchema.TestUnit2",
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
      ConstraintEntity: {
        schemaItemType: "EntityClass",
      },
      TestRelationship: {
        schemaItemType: "RelationshipClass",
        strength: "Embedding",
        strengthDirection: "Forward",
        source: {
          multiplicity: "(1..1)",
          polymorphic: true,
          roleLabel: "contains",
          constraintClasses: [
            "TestSchema.ConstraintEntity",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "is contained by",
          polymorphic: true,
          constraintClasses: [
            "TestSchema.ConstraintEntity",
          ],
        },
      },
    },
  };

  beforeEach(async () => {
    targetContext = await BisTestHelper.getNewContext();
    await Schema.fromJson(testJson, targetContext);
  });

  describe("Property missing tests", () => {
    it("should merge missing primitive property", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
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
            schemaType: SchemaOtherTypes.SchemaReference,
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaItemType.PropertyCategory,
            itemName: "TestCategory",
            difference: {
              priority: 4,
            },
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "StringProp",
            difference: {
              name: "StringProp",
              type: "PrimitiveProperty",
              description: "Description for string property",
              label: "String Property",
              category: "SourceSchema.TestCategory",
              kindOfQuantity: "TestSchema.TestKoq",
              extendedTypeName: "json",
              minLength: 5,
              maxLength: 450,
              typeName: "string",
            },
          },
        ],
      });

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
      await Schema.fromJson(targetJson, targetContext);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaItemType.StructClass,
            itemName: "TestStruct",
            difference: {
              properties: [
                {
                  name: "IntArrayProp",
                  type: "PrimitiveArrayProperty",
                  description: "Description for int array property",
                  label: "Integer Array Property",
                  minValue: 2,
                  maxValue: 20002,
                  typeName: "int",
                  minOccurs: 5,
                  maxOccurs: 250,
                },
              ],
            },
          },
        ],
      });

      const mergedItem = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "IntArrayProp",
        type: "PrimitiveArrayProperty",
        description: "Description for int array property",
        label: "Integer Array Property",
        minValue: 2,
        maxValue: 20002,
        typeName: "int",
        minOccurs: 5,
        maxOccurs: 250,
      }]);
    });

    it("should merge missing enumeration property", async () => {
      await Schema.fromJson({
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
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
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
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestCA",
            path: "EnumProp",
            difference: {
              name: "EnumProp",
              type: "PrimitiveProperty",
              description: "Description for enumeration property",
              label: "Enumeration Property",
              isReadOnly: true,
              typeName: "SourceSchema.TestEnumeration",
            },
          },
        ],
      });
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
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyProperty",
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
            schemaType: SchemaOtherTypes.SchemaReference,
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestCA",
            path: "EnumArrayProp",
            difference: {
              name: "EnumArrayProp",
              type: "PrimitiveArrayProperty",
              description: "Description for enumeration array property",
              label: "Enumeration Array Property",
              category: "TestSchema.TestCategory",
              typeName: "TestSchema.TestEnumeration",
              minOccurs: 5,
              maxOccurs: 2147483647,
            },
          },
        ],
      });

      const mergedItem = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "EnumArrayProp",
        type: "PrimitiveArrayProperty",
        description: "Description for enumeration array property",
        label: "Enumeration Array Property",
        category: "TestSchema.TestCategory",
        typeName: "TestSchema.TestEnumeration",
        minOccurs: 5,
        maxOccurs: 2147483647,
      }]);
    });

    it("should merge missing struct property", async () => {
      await Schema.fromJson({
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

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.SchemaReference,
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaItemType.PropertyCategory,
            itemName: "TestCategory",
            difference: {
              priority: 4,
            },
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestStruct",
            path: "StructProp",
            difference: {
              name: "StructProp",
              type: "StructProperty",
              description: "Description for struct property",
              label: "Struct Property",
              category: "SourceSchema.TestCategory",
              typeName: "TestSchema.TestStruct",
            },
          },
        ],
      });

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
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaItemType.StructClass,
            itemName: "TestStruct",
            difference: {},
          },
          {
            changeType: "add",
            schemaType: SchemaItemType.EntityClass,
            itemName: "TestEntity",
            difference: {
              properties: [
                {
                  name: "StructArrayProp",
                  type: "StructArrayProperty",
                  description: "Description for struct property",
                  category: "TestSchema.TestCategory",
                  kindOfQuantity: "TestSchema.TestKoq",
                  typeName: "SourceSchema.TestStruct",
                  minOccurs: 5,
                  maxOccurs: 105,
                },
              ],
            },
          },
        ],
      });

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

    it("should merge missing entityclass navigation property", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
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
            schemaType: SchemaOtherTypes.SchemaReference,
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "NavigationProp",
            difference: {
              name: "NavigationProp",
              type: "NavigationProperty",
              description: "Description for navigation property",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          },
        ],
      });

      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "NavigationProp",
        type: "NavigationProperty",
        description: "Description for navigation property",
        direction: "Backward",
        relationshipName: "TestSchema.TestRelationship",
      }]);
    });

    it("should merge missing mixin navigation property", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
          },
          TestMixin: {
            schemaItemType: "Mixin",
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
            schemaType: SchemaOtherTypes.SchemaReference,
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestMixin",
            path: "NavigationProp",
            difference: {
              name: "NavigationProp",
              type: "NavigationProperty",
              description: "Description for navigation property",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          },
        ],
      });

      const mergedItem = await mergedSchema.getItem<Mixin>("TestMixin");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "NavigationProp",
        type: "NavigationProperty",
        description: "Description for navigation property",
        direction: "Backward",
        relationshipName: "TestSchema.TestRelationship",
      }]);
    });
  });

  describe("Property delta tests", () => {
    it("should merge primitive property changes", async () => {
      await Schema.fromJson(testJson, targetContext);
      await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
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

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "StringProp",
            difference: {
              label: "String Property",
              description: "Description for string property",
              isReadOnly: true,
              minLength: 1,
              maxLength: 101,
              extendedTypeName: "json",
            },
          },
        ],
      });

      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().properties).deep.eq([{
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
      }]);
    });

    it("should merge primitive array property changes", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "IntArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "int",
              minValue: 0,
              maxValue: 50,
            }],
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
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "IntArrayProp",
            difference: {
              label: "Integer Array Property",
              description: "Description for int array property",
              minOccurs: 3,
              maxOccurs: 306,
              minValue: 1,
              maxValue: 100,
            },
          },
        ],
        conflicts: undefined,
      });

      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "IntArrayProp",
        type: "PrimitiveArrayProperty",
        typeName: "int",
        label: "Integer Array Property",
        description: "Description for int array property",
        minValue: 1,
        maxValue: 100,
        minOccurs: 3,
        maxOccurs: 306,
      }]);
    });

    it("should merge enumeration property changes", async () => {
      await Schema.fromJson(testJson, targetContext);
      await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TargetCategory: {
            schemaItemType: "PropertyCategory",
            priority: 4,
          },
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "EnumProp",
              type: "PrimitiveProperty",
              typeName: "TestSchema.TestEnumeration",
              label: "EnumProperty",
              category: "TargetSchema.TargetCategory",
            }],
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
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestStruct",
            path: "EnumProp",
            difference: {
              label: "Enumeration Property",
              description: "Description for enumeration property",
              isReadOnly: true,
              category: "TestSchema.TestCategory",
            },
          },
        ],
      });

      const mergedItem = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "EnumProp",
        type: "PrimitiveProperty",
        typeName: "TestSchema.TestEnumeration",
        label: "Enumeration Property",
        description: "Description for enumeration property",
        category: "TestSchema.TestCategory",
        isReadOnly: true,
      }]);
    });

    it("should merge enumeration array property changes", async () => {
      await Schema.fromJson({
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

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "EnumArrayProp",
            difference: {
              label: "Enumeration Array Property",
              description: "Description for enumeration array property",
              priority: 4,
              minOccurs: 5,
              maxOccurs: 25,
            },
          },
        ],
      });
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
      await Schema.fromJson({
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
              priority: 3,
            }],
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
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "StructProp",
            difference: {
              label: "Struct Property",
              description: "Description for struct property",
              isReadOnly: true,
              priority: 5,
            },
          },
        ],
      });
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
      await Schema.fromJson(testJson, targetContext);
      await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
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

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestCA",
            path: "StructArrayProp",
            difference: {
              description: "Description for struct array property",
              isReadOnly: false,
              priority: 5,
              minOccurs: 11,
              maxOccurs: 121,
            },
          },
        ],
      });

      const mergedItem = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "StructArrayProp",
        type: "StructArrayProperty",
        typeName: "TestSchema.TestStruct",
        description: "Description for struct array property",
        kindOfQuantity: "TestSchema.TestKoq",
        priority: 5,
        isReadOnly: false,
        minOccurs: 11,
        maxOccurs: 121,
      }]);
    });

    it("should merge navigation property changes", async () => {
      await Schema.fromJson(testJson, targetContext);
      await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "NavProp",
              type: "NavigationProperty",
              description: "Description for NavigationProperty",
              isReadOnly: true,
              direction: "Backward",
              relationshipName: "TestSchema.TestRelationship",
            }],
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
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "NavProp",
            difference: {
              label: "Some navigation label",
              description: "Description for Navigation Property",
              isReadOnly: false,
            },
          },
        ],
      });

      const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedItem!.toJSON().properties).deep.eq([{
        name: "NavProp",
        type: "NavigationProperty",
        description: "Description for Navigation Property",
        label: "Some navigation label",
        direction: "Backward",
        isReadOnly: false,
        relationshipName: "TestSchema.TestRelationship",
      }]);
    });

    it("should throw an error when merging properties primitive type changed from int to boolean", async () => {
      await Schema.fromJson({
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

      const merger = new SchemaMerger(targetContext);
      const merge = merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestStruct",
            path: "Prop",
            difference: {
              typeName: "bool",
            },
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestStruct.Prop' primitiveType is not supported.");
    });

    it("should throw an error when merging array properties primitive type changed from double to string", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyProperty",
            properties: [{
              name: "ArrProp",
              type: "PrimitiveArrayProperty",
              typeName: "double",
            }],
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
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestCA",
            path: "ArrProp",
            difference: {
              typeName: "string",
            },
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestCA.ArrProp' primitiveType is not supported.");
    });

    it("should throw an error when merging properties type changed from PrimitiveArrayProperty to PrimitiveProperty", async () => {
      await Schema.fromJson({
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

      const merger = new SchemaMerger(targetContext);
      const merge = merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "Prop",
            difference: {
              type: "PrimitiveProperty",
            },
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestEntity.Prop' type is not supported.");
    });

    it("should not throw an error when merging properties with changed kind of quantity but same persistence unit", async () => {
      await Schema.fromJson(testJson, targetContext);
      await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "Prop",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "TestSchema.TestKoq",
            }],
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
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "Prop",
            difference: {
              kindOfQuantity: "TestSchema.TestKoqCopy",
            },
          },
        ],
      });

      await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.not.undefined
        .then(async (ecClass: ECClass) => {
          await expect(ecClass.getProperty("Prop")).to.be.eventually.not.undefined
            .then((property: Property) => {
              expect(property).to.have.nested.property("kindOfQuantity.fullName", "TestSchema.TestKoqCopy");
            });
        });
    });

    it("should not throw an error when merging properties with changed kind of quantity from undefined", async () => {
      await Schema.fromJson({
        ...targetJson,
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
      }, targetContext);

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.SchemaReference,
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "Prop",
            difference: {
              kindOfQuantity: "TestSchema.TestKoq",
            },
          },
        ],
      });

      await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.not.undefined
        .then(async (ecClass: ECClass) => {
          await expect(ecClass.getProperty("Prop")).to.be.eventually.not.undefined
            .then((property: Property) => {
              expect(property).to.have.nested.property("kindOfQuantity.fullName", "TestSchema.TestKoq");
            });
        });
    });

    it("should throw an error when merging properties kind of quantity changed", async () => {
      await Schema.fromJson(testJson, targetContext);
      await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "Prop",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "TestSchema.TestKoq",
            }],
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
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "Prop",
            difference: {
              kindOfQuantity: "TestSchema.TestKoqDifferentUnit",
            },
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("KindOfQuantity can only be changed if it has the same persistence unit as the property.");
    });

    it("should throw an error when merging struct properties structClass changed", async () => {
      await Schema.fromJson({
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

      const merger = new SchemaMerger(targetContext);
      const merge = merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.SchemaReference,
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "StructProp",
            difference: {
              structClass: "TestSchema.TestStruct",
            } as any,
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestEntity.StructProp' structClass is not supported.");
    });

    it("should throw an error when merging struct array properties structClass changed", async () => {
      await Schema.fromJson({
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

      const merger = new SchemaMerger(targetContext);
      const merge = merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaItemType.StructClass,
            itemName: "SourceStruct",
            difference: {},
          },
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestStruct",
            path: "StructArrayProp",
            difference: {
              structClass: "SourceSchema.SourceStruct",
            } as any,
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestStruct.StructArrayProp' structClass is not supported.");
    });

    it("should throw an error when merging enumeration properties enumeration changed", async () => {
      await Schema.fromJson({
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

      const merger = new SchemaMerger(targetContext);
      const merge = merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.SchemaReference,
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "EnumProp",
            difference: {
              enumeration: "TestSchema.TestEnumeration",
            } as any,
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestEntity.EnumProp' enumeration is not supported.");
    });

    it("should throw an error when merging enumeration array properties enumeration changed", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TargetEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
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

      const merger = new SchemaMerger(targetContext);
      const merge = merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaItemType.Enumeration,
            itemName: "SourceEnumeration",
            difference: {
              type: "int",
              isStrict: false,
              enumerators: [
                {
                  name: "None",
                  value: 0,
                  label: "None",
                },
              ],
            } as any,
          },
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "EnumArrayProp",
            difference: {
              enumeration: "SourceSchema.SourceEnumeration",
            } as any,
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestEntity.EnumArrayProp' enumeration is not supported.");
    });

    it("should throw an error when merging navigation properties direction changed", async () => {
      await Schema.fromJson(testJson, targetContext);
      await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "NavProp",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            }],
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
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "NavProp",
            difference: {
              direction: "Backward",
            },
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestEntity.NavProp' direction is not supported.");
    });

    it("should throw an error when merging navigation properties relationship class changed", async () => {
      await Schema.fromJson(testJson, targetContext);
      await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "NavProp",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            }],
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
            schemaType: SchemaItemType.RelationshipClass,
            itemName: "SourceRelationship",
            difference: {
              modifier: "None",
              strength: "Referencing",
              strengthDirection: "Forward",
              source: {
                multiplicity: "(1..1)",
                roleLabel: "is base model for",
                polymorphic: true,
                constraintClasses: [
                  "TestSchema.ConstraintEntity",
                ],
              },
              target: {
                multiplicity: "(0..*)",
                roleLabel: "has base",
                polymorphic: true,
                constraintClasses: [
                  "TestSchema.ConstraintEntity",
                ],
              },
            },
          },
          {
            changeType: "modify",
            schemaType: SchemaOtherTypes.Property,
            itemName: "TestEntity",
            path: "NavProp",
            difference: {
              relationshipClass: "SourceSchema.SourceRelationship",
            } as any, // Any-Cast to send invalid structure to the merger.
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestEntity.NavProp' relationship class is not supported.");
    });
  });
  
  describe("iterative tests", () => {
    let sourceSchema: Schema;

    describe("re-mapped property tests", () => {

      describe("adding re-mapped properties", () => {

        async function mergeSchemas(handler: (mergedSchema: Schema) => Promise<void>) {          
          const targetSchema = await Schema.fromJson({
            ...targetJson,
            items: {                                                
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "PrimitiveProperty",
                  typeName: "int",
                }],
              },
            },
          }, targetContext);

          const result = await getSchemaDifferences(targetSchema, sourceSchema);
          expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
          expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
            expect(conflict).to.exist;
            expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyName);
            expect(conflict).to.have.a.property("target", "int");
            return true;
          });
    
          const schemaEdits = new SchemaEdits();
          const testItem = await sourceSchema.getItem("testItem") as EntityClass;
          schemaEdits.properties.rename(testItem, "testProp", "mergedProp");
    
          const merger = new SchemaMerger(targetContext);
          const mergedSchema = await merger.merge(result, schemaEdits);
                
          await handler(mergedSchema);
        };

        it("should add a re-mapped primitive property", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "PrimitiveProperty",
                  typeName: "string",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("testItem")).to.be.eventually.fulfilled.then(async (ecClass) => {
              expect(ecClass).to.exist;
              await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Integer);
              });
              await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.String);
              });
            });
          });
        });

        it("should add a re-mapped enumeration property", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {
              testEnum: {
                schemaItemType: "Enumeration",
                type: "int",
                isStrict: false,
                enumerators: [
                  {
                    name: "FirstValue",
                    value: 0,
                    label: "first value",
                  },
                ],
              },
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "PrimitiveProperty",
                  typeName: "SourceSchema.testEnum",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("testItem")).to.be.eventually.fulfilled.then(async (ecClass) => {
              expect(ecClass).to.exist;
              await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Integer);
              });
              await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Integer_Enumeration);
                expect(property).to.have.a.nested.property("enumeration.name").to.equal("testEnum");
              });
            });
          });          
        });

        it("should add a re-mapped struct property", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {
              testStruct: {
                schemaItemType: "StructClass",
              },
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "StructProperty",
                  typeName: "SourceSchema.testStruct",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("testItem")).to.be.eventually.fulfilled.then(async (ecClass) => {
              expect(ecClass).to.exist;
              await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Integer);
              });
              await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Struct);
                expect(property).to.have.a.nested.property("structClass.name").to.equal("testStruct");
              });
            });
          });     
        });

        it("should add a re-mapped navigation property", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {
              testEntity: {
                schemaItemType: "EntityClass",
              },
              testRelationship: {
                schemaItemType: "RelationshipClass",
                strength: "Embedding",
                strengthDirection: "Forward",
                source: {
                  multiplicity: "(1..1)",
                  polymorphic: true,
                  roleLabel: "contains",
                  constraintClasses: [
                    "SourceSchema.testEntity",
                  ],
                },
                target: {
                  multiplicity: "(0..*)",
                  roleLabel: "is contained by",
                  polymorphic: true,
                  constraintClasses: [
                    "SourceSchema.testEntity",
                  ],
                },
              }, 
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "NavigationProperty",
                  relationshipName: "SourceSchema.testRelationship",
                  direction: "Backward",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("testItem")).to.be.eventually.fulfilled.then(async (ecClass) => {
              expect(ecClass).to.exist;
              await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Integer);
              });
              await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Navigation);
                expect(property).to.have.a.nested.property("relationshipClass.name").to.equal("testRelationship");
              });
            });
          });
        });
      });

      describe("modifying re-mapped properties", () => {

        async function mergeSchemas(propertyName: string, handler: (mergedSchema: Schema) => Promise<void>) {          
          const targetSchema = await Schema.fromJson({
            ...targetJson,
            items: {
              testEnum: {
                schemaItemType: "Enumeration",
                type: "int",
                isStrict: false,
                enumerators: [
                  {
                    name: "FirstValue",
                    value: 0,
                    label: "first value",
                  },
                ],
              },
              testStruct: {
                schemaItemType: "StructClass",
              },
              testEntity: {
                schemaItemType: "EntityClass",
              },
              testRelationship: {
                schemaItemType: "RelationshipClass",
                strength: "Embedding",
                strengthDirection: "Forward",
                source: {
                  multiplicity: "(1..1)",
                  polymorphic: true,
                  roleLabel: "contains",
                  constraintClasses: [
                    "TargetSchema.testEntity",
                  ],
                },
                target: {
                  multiplicity: "(0..*)",
                  roleLabel: "is contained by",
                  polymorphic: true,
                  constraintClasses: [
                    "TargetSchema.testEntity",
                  ],
                },
              },
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "PrimitiveProperty",
                  typeName: "bool",
                }, 
                {
                  name: "intProp",
                  type: "PrimitiveProperty",
                  typeName: "int",
                },{
                  name: "enumProp",
                  type: "PrimitiveProperty",
                  typeName: "TargetSchema.testEnum",
                },{
                  name: "structProp",
                  type: "StructProperty",
                  typeName: "TargetSchema.testStruct",
                },{
                  name: "navigationProp",
                  type: "NavigationProperty",
                  relationshipName: "TargetSchema.testRelationship",
                  direction: "Backward",
                }],
              },              
            },
          }, targetContext);
          
          const schemaEdits = new SchemaEdits();
          const testItem = await sourceSchema.getItem("testItem") as EntityClass;
          schemaEdits.properties.rename(testItem, "testProp", propertyName);
    
          const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
          const merger = new SchemaMerger(targetContext);
          const mergedSchema = await merger.merge(result, schemaEdits);
          
          await handler(mergedSchema);
        };

        it("should merge changes to a re-mapped primitive property", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "PrimitiveProperty",
                  typeName: "int",
                  label: "integer",
                  description: "integer property",
                  priority: 102,
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas("intProp", async(mergedSchema) => {
            await expect(mergedSchema.getItem("testItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("intProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("label").to.equal("integer");
                expect(property).to.have.a.property("description").to.equal("integer property");
                expect(property).to.have.a.property("priority").to.equal(102);
              });
            });
          });
        });

        it("should merge changes to a re-mapped enumeration property", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {
              testEnum: {
                schemaItemType: "Enumeration",
                type: "int",
                isStrict: false,
                enumerators: [
                  {
                    name: "FirstValue",
                    value: 0,
                    label: "first value",
                  },
                ],
              },
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "PrimitiveProperty",
                  typeName: "SourceSchema.testEnum",
                  label: "enumeration",
                  description: "enumeration property",
                  isReadOnly: true,
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas("enumProp", async(mergedSchema) => {
            await expect(mergedSchema.getItem("testItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("enumProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("label").to.equal("enumeration");
                expect(property).to.have.a.property("description").to.equal("enumeration property");
                expect(property).to.have.a.property("isReadOnly").to.equal(true);
              });
            });
          });
        });

        it("should merge changes to a re-mapped struct property", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {
              testCategory: {
                schemaItemType: "PropertyCategory",
                priority: 103, 
              },
              testStruct: {
                schemaItemType: "StructClass",                
              },
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "StructProperty",
                  typeName: "SourceSchema.testStruct",
                  label: "struct",
                  description: "struct property",
                  category: "SourceSchema.testCategory",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas("structProp", async(mergedSchema) => {
            await expect(mergedSchema.getItem("testItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("structProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("label").to.equal("struct");
                expect(property).to.have.a.property("description").to.equal("struct property");
                expect(property).to.have.a.nested.property("category.name").to.equal("testCategory");
              });
            });
          });
        });

        it("should merge changes to a re-mapped navigation property", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {
              testEntity: {
                schemaItemType: "EntityClass",
              },
              testRelationship: {
                schemaItemType: "RelationshipClass",
                strength: "Embedding",
                strengthDirection: "Forward",
                source: {
                  multiplicity: "(1..1)",
                  polymorphic: true,
                  roleLabel: "contains",
                  constraintClasses: [
                    "SourceSchema.testEntity",
                  ],
                },
                target: {
                  multiplicity: "(0..*)",
                  roleLabel: "is contained by",
                  polymorphic: true,
                  constraintClasses: [
                    "SourceSchema.testEntity",
                  ],
                },
              },
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "NavigationProperty",
                  relationshipName: "SourceSchema.testRelationship",
                  direction: "Backward",
                  label: "navigation",
                  priority: 105,
                  isReadOnly: true,
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas("navigationProp", async(mergedSchema) => {
            await expect(mergedSchema.getItem("testItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("navigationProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("label").to.equal("navigation");
                expect(property).to.have.a.property("isReadOnly").to.equal(true);
                expect(property).to.have.a.property("priority").to.equal(105);
                expect(property).to.have.a.nested.property("relationshipClass.name").to.equal("testRelationship");
              });
            });
          });
        });
      });
    });

    describe("re-mapped class tests", () => {
      describe("adding properties to a re-mapped class", () => {

        async function mergeSchemas(handler: (mergedSchema: Schema) => Promise<void>) {
          const targetSchema = await Schema.fromJson({
            ...targetJson,
            items: {
              mergedItem: {
                schemaItemType: "EntityClass",
              },
              testItem: {
                schemaItemType: "CustomAttributeClass",
                appliesTo: "Any",
              },
            },
          }, targetContext);

          const schemaEdits = new SchemaEdits();
          const testItem = await sourceSchema.getItem("testItem") as EntityClass;
          schemaEdits.items.rename(testItem, "mergedItem");
    
          const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
          const merger = new SchemaMerger(targetContext);
          const mergedSchema = await merger.merge(result, schemaEdits);
          
          await handler(mergedSchema);
        };

        it("should add a primitive property to a re-mapped class", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "PrimitiveProperty",
                  typeName: "double",
                },
                {
                  name: "testArrayProp",
                  type: "PrimitiveArrayProperty",
                  typeName: "int",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Double);
              });
              await expect(ecClass.getProperty("testArrayProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Integer_Array);
              });
            });
          });        
        });
  
        it("should add an enumaration property to a re-mapped class", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {        
              testEnum: {
                schemaItemType: "Enumeration",
                type: "int",
                isStrict: false,
                enumerators: [
                  {
                    name: "FirstValue",
                    value: 0,
                    label: "first value",
                  },
                ],
              },    
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "PrimitiveProperty",
                  typeName: "SourceSchema.testEnum",
                },
                {
                  name: "testArrayProp",
                  type: "PrimitiveArrayProperty",
                  typeName: "SourceSchema.testEnum",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Integer_Enumeration);
                expect(property).to.have.a.nested.property("enumeration.name").to.equal("testEnum");
              });
              await expect(ecClass.getProperty("testArrayProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Integer_Enumeration_Array);
                expect(property).to.have.a.nested.property("enumeration.name").to.equal("testEnum");
              });
            });
          });       
        });
  
        it("should add a struct property to a re-mapped class", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {        
              testStruct: {
                schemaItemType: "StructClass",                
              },    
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "StructProperty",
                  typeName: "SourceSchema.testStruct",
                },
                {
                  name: "testArrayProp",
                  type: "StructArrayProperty",
                  typeName: "SourceSchema.testStruct",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Struct);
                expect(property).to.have.a.nested.property("structClass.name").to.equal("testStruct");
              });
              await expect(ecClass.getProperty("testArrayProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Struct_Array);
                expect(property).to.have.a.nested.property("structClass.name").to.equal("testStruct");
              });
            });
          });
        });
  
        it("should add a navigation property to a re-mapped class", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {        
              testEntity: {
                schemaItemType: "EntityClass",
              },
              testRelationship: {
                schemaItemType: "RelationshipClass",
                strength: "Embedding",
                strengthDirection: "Forward",
                source: {
                  multiplicity: "(1..1)",
                  polymorphic: true,
                  roleLabel: "contains",
                  constraintClasses: [
                    "SourceSchema.testEntity",
                  ],
                },
                target: {
                  multiplicity: "(0..*)",
                  roleLabel: "is contained by",
                  polymorphic: true,
                  constraintClasses: [
                    "SourceSchema.testEntity",
                  ],
                },
              },   
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "testProp",
                  type: "NavigationProperty",
                  relationshipName: "SourceSchema.testRelationship",
                  direction: "Backward",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Navigation);
                expect(property).to.have.a.nested.property("relationshipClass.name").to.equal("testRelationship");
              });              
            });
          });
        });
      });

      describe("modifying properties of a re-mapped class", () => {

        async function mergeSchemas(handler: (mergedSchema: Schema) => Promise<void>) {          
          const targetSchema = await Schema.fromJson({
            ...targetJson,
            items: {
              testEnum: {
                schemaItemType: "Enumeration",
                type: "int",
                isStrict: false,
                enumerators: [
                  {
                    name: "FirstValue",
                    value: 0,
                    label: "first value",
                  },
                ],
              },
              testStruct: {
                schemaItemType: "StructClass",
              },
              testEntity: {
                schemaItemType: "EntityClass",
              },
              testRelationship: {
                schemaItemType: "RelationshipClass",
                strength: "Embedding",
                strengthDirection: "Forward",
                source: {
                  multiplicity: "(1..1)",
                  polymorphic: true,
                  roleLabel: "contains",
                  constraintClasses: [
                    "TargetSchema.testEntity",
                  ],
                },
                target: {
                  multiplicity: "(0..*)",
                  roleLabel: "is contained by",
                  polymorphic: true,
                  constraintClasses: [
                    "TargetSchema.testEntity",
                  ],
                },
              },
              mergedItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "doubleProp",
                  type: "PrimitiveArrayProperty",
                  typeName: "double",
                },{
                  name: "enumProp",
                  type: "PrimitiveProperty",
                  typeName: "TargetSchema.testEnum",
                },{
                  name: "structProp",
                  type: "StructProperty",
                  typeName: "TargetSchema.testStruct",
                },{
                  name: "navigationProp",
                  type: "NavigationProperty",
                  relationshipName: "TargetSchema.testRelationship",
                  direction: "Backward",
                }],
              },
              testItem: {
                schemaItemType: "CustomAttributeClass",
                appliesTo: "Any",
              },
            },
          }, targetContext);
          
          const schemaEdits = new SchemaEdits();
          const testItem = await sourceSchema.getItem("testItem") as EntityClass;
          schemaEdits.items.rename(testItem, "mergedItem");
    
          const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
          const merger = new SchemaMerger(targetContext);
          const mergedSchema = await merger.merge(result, schemaEdits);
          
          await handler(mergedSchema);
        };

        it("should merge changes to a primitive property of a re-mapped class", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "doubleProp",
                  type: "PrimitiveArrayProperty",
                  typeName: "double",
                  label: "double",
                  minValue: 1.0,
                  maxValue: 99.9,
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("doubleProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("label").to.equal("double");
                expect(property).to.have.a.property("minValue").to.equal(1.0);
                expect(property).to.have.a.property("maxValue").to.equal(99.9);
              });
            });
          });        
        });
  
        it("should merge changes to a enumeration property of a re-mapped class", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {        
              testEnum: {
                schemaItemType: "Enumeration",
                type: "int",
                isStrict: false,
                enumerators: [
                  {
                    name: "FirstValue",
                    value: 0,
                    label: "first value",
                  },
                ],
              },
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "enumProp",
                  type: "PrimitiveProperty",
                  typeName: "SourceSchema.testEnum",
                  label: "enumeration",
                  description: "enumeration property",
                  isReadOnly: true,
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("enumProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("label").to.equal("enumeration");
                expect(property).to.have.a.property("description").to.equal("enumeration property");
                expect(property).to.have.a.property("isReadOnly").to.equal(true);
              });
            });
          });       
        });
  
        it("should merge changes to a struct property of a re-mapped class", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {        
              testCategory: {
                schemaItemType: "PropertyCategory",
                priority: 106,
              },
              testStruct: {
                schemaItemType: "StructClass",                
              },    
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "structProp",
                  type: "StructProperty",
                  typeName: "SourceSchema.testStruct",
                  description: "struct property",
                  priority: 103,
                  category: "SourceSchema.testCategory",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("structProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("description").to.equal("struct property");
                expect(property).to.have.a.property("priority").to.equal(103);
                expect(property).to.have.a.nested.property("category.name").to.equal("testCategory");
              });              
            });
          });
        });
  
        it("should merge changes to a navigation property of a re-mapped class", async() => {
          sourceSchema = await Schema.fromJson({
            ...sourceJson,
            items: {        
              testEntity: {
                schemaItemType: "EntityClass",
              },
              testRelationship: {
                schemaItemType: "RelationshipClass",
                strength: "Embedding",
                strengthDirection: "Forward",
                source: {
                  multiplicity: "(1..1)",
                  polymorphic: true,
                  roleLabel: "contains",
                  constraintClasses: [
                    "SourceSchema.testEntity",
                  ],
                },
                target: {
                  multiplicity: "(0..*)",
                  roleLabel: "is contained by",
                  polymorphic: true,
                  constraintClasses: [
                    "SourceSchema.testEntity",
                  ],
                },
              },   
              testItem: {
                schemaItemType: "EntityClass",
                properties: [{
                  name: "navigationProp",
                  type: "NavigationProperty",
                  relationshipName: "SourceSchema.testRelationship",
                  direction: "Backward",
                  isReadOnly: true, 
                  priority: 156, 
                  label: "navigation",
                }],
              },
            },
          }, await BisTestHelper.getNewContext());

          await mergeSchemas(async(mergedSchema) => {
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("navigationProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("label").to.equal("navigation");
                expect(property).to.have.a.property("priority").to.equal(156);
                expect(property).to.have.a.property("isReadOnly").to.equal(true);
              });              
            });
          });
        });
      });

      describe ("re-mapped property tests", ()=> {
        describe ("adding re-mapped properties to a re-mapped class", ()=> {

          async function mergeSchemas(handler: (mergedSchema: Schema) => Promise<void>) {          
            const targetSchema = await Schema.fromJson({
              ...targetJson,
              items: {                                                
                mergedItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "PrimitiveProperty",
                    typeName: "double",
                  }],
                },
                testItem: {
                  schemaItemType: "StructClass",
                },
              },
            }, targetContext);

            const schemaEdits = new SchemaEdits();
            const testItem = await sourceSchema.getItem("testItem") as EntityClass;            
            schemaEdits.items.rename(testItem, "mergedItem");

            const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
            expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
            expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
              expect(conflict).to.exist;
              expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyName);
              expect(conflict).to.have.a.property("target", "double");
              return true;
            });
    
            schemaEdits.properties.rename(testItem, "testProp", "mergedProp");
      
            const merger = new SchemaMerger(targetContext);
            const mergedSchema = await merger.merge(result, schemaEdits);
                  
            await handler(mergedSchema);
          };
            
          it("should add a re-mapped primitive property to a re-mapped class", async() => {
            sourceSchema = await Schema.fromJson({
              ...sourceJson,
              items: {
                testItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "PrimitiveArrayProperty",
                    typeName: "string",
                  }],
                },
              },
            }, await BisTestHelper.getNewContext());

            await mergeSchemas(async(mergedSchema) => {
              await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.fulfilled.then(async (ecClass) => {
                expect(ecClass).to.exist;
                await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                  expect(property).to.exist;
                  expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Double);
                });
                await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                  expect(property).to.exist;
                  expect(property).to.have.a.property("propertyType").to.equal(PropertyType.String_Array);
                });
              });
            });
          });

          it("should add a re-mapped enumeration property to a re-mapped class", async() => {
            sourceSchema = await Schema.fromJson({
              ...sourceJson,
              items: {
                testEnum: {
                  schemaItemType: "Enumeration",
                  type: "int",
                  isStrict: false,
                  enumerators: [
                    {
                      name: "FirstValue",
                      value: 0,
                      label: "first value",
                    },
                  ],
                },
                testItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "PrimitiveProperty",
                    typeName: "SourceSchema.testEnum",
                  }],
                },
              },
            }, await BisTestHelper.getNewContext());

            await mergeSchemas(async(mergedSchema) => {
              await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.fulfilled.then(async (ecClass) => {
                expect(ecClass).to.exist;
                await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                  expect(property).to.exist;
                  expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Double);
                });
                await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                  expect(property).to.exist;
                  expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Integer_Enumeration);
                  expect(property).to.have.a.nested.property("enumeration.name").to.equal("testEnum");
                });
              });
            });
          });

          it("should add a re-mapped struct property to a re-mapped class", async() => {
            sourceSchema = await Schema.fromJson({
              ...sourceJson,
              items: {
                testStruct: {
                  schemaItemType: "StructClass",
                },
                testItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "StructProperty",
                    typeName: "SourceSchema.testStruct",
                  }],
                },
              },
            }, await BisTestHelper.getNewContext());

            await mergeSchemas(async(mergedSchema) => {
              await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.fulfilled.then(async (ecClass) => {
                expect(ecClass).to.exist;
                await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                  expect(property).to.exist;
                  expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Double);
                });
                await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                  expect(property).to.exist;
                  expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Struct);
                  expect(property).to.have.a.nested.property("structClass.name").to.equal("testStruct");
                });
              });
            });
          });

          it("should add a re-mapped navigation property to a re-mapped class",async() => {
            sourceSchema = await Schema.fromJson({
              ...sourceJson,
              items: {
                testEntity: {
                  schemaItemType: "EntityClass",
                },
                testRelationship: {
                  schemaItemType: "RelationshipClass",
                  strength: "Embedding",
                  strengthDirection: "Forward",
                  source: {
                    multiplicity: "(1..1)",
                    polymorphic: true,
                    roleLabel: "contains",
                    constraintClasses: [
                      "SourceSchema.testEntity",
                    ],
                  },
                  target: {
                    multiplicity: "(0..*)",
                    roleLabel: "is contained by",
                    polymorphic: true,
                    constraintClasses: [
                      "SourceSchema.testEntity",
                    ],
                  },
                },
                testItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "NavigationProperty",
                    relationshipName: "SourceSchema.testRelationship",
                    direction: "Backward",
                  }],
                },
              },
            }, await BisTestHelper.getNewContext());

            await mergeSchemas(async(mergedSchema) => {
              await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.fulfilled.then(async (ecClass) => {
                expect(ecClass).to.exist;
                await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
                  expect(property).to.exist;
                  expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Double);
                });
                await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                  expect(property).to.exist;
                  expect(property).to.have.a.property("propertyType").to.equal(PropertyType.Navigation);
                  expect(property).to.have.a.nested.property("relationshipClass.name").to.equal("testRelationship");
                });
              });
            });
          });
        });

        describe("modifying re-mapped properties of a re-mapped class", ()=> {
          it("should merge changes to a re-mapped primitive property of a re-mapped class", async()=> {
            sourceSchema = await Schema.fromJson({
              ...sourceJson,
              items: {
                testItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "PrimitiveProperty", 
                    typeName: "int",
                    label: "integer",
                    description: "integer property",
                    priority: 102,
                  }],
                },
              },
            }, await BisTestHelper.getNewContext());
  
            const targetSchema = await Schema.fromJson({
              ...targetJson,              
              items: {
                testItem: {
                  schemaItemType: "CustomAttributeClass",
                  appliesTo: "Any",
                },
                mergedItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "PrimitiveArrayProperty",
                    typeName: "int",
                  },
                  {
                    name: "mergedProp",
                    type: "PrimitiveProperty",
                    typeName: "int",
                  }],
                },
              },
            }, targetContext);
  
            const schemaEdits = new SchemaEdits();
            const testItem = await sourceSchema.getItem("testItem") as EntityClass;
            schemaEdits.items.rename(testItem, "mergedItem");
            schemaEdits.properties.rename(testItem, "testProp", "mergedProp");
      
            const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
            const merger = new SchemaMerger(targetContext);
            const mergedSchema = await merger.merge(result, schemaEdits);
       
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("label").to.equal("integer");
                expect(property).to.have.a.property("description").to.equal("integer property");
                expect(property).to.have.a.property("priority").to.equal(102);
              });
            });
          });

          it("should merge changes to a re-mapped enumeration property of a re-mapped class", async()=> {
            sourceSchema = await Schema.fromJson({
              ...sourceJson,
              items: {
                testEnum: {
                  schemaItemType: "Enumeration",
                  type: "int",
                  isStrict: false,
                  enumerators: [
                    {
                      name: "FirstValue",
                      value: 0,
                      label: "first value",
                    },
                  ],
                },
                testItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "PrimitiveProperty", 
                    typeName: "SourceSchema.testEnum",
                    label: "enumeration",
                    description: "enumeration property",
                    isReadOnly: true,
                  }],
                },
              },
            }, await BisTestHelper.getNewContext());
  
            const targetSchema = await Schema.fromJson({
              ...targetJson,              
              items: {
                testEnum: {
                  schemaItemType: "Enumeration",
                  type: "int",
                  isStrict: false,
                  enumerators: [
                    {
                      name: "FirstValue",
                      value: 0,
                      label: "first value",
                    },
                  ],
                },
                testItem: {
                  schemaItemType: "CustomAttributeClass",
                  appliesTo: "Any",
                },
                mergedItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "PrimitiveArrayProperty",
                    typeName: "int",
                  },
                  {
                    name: "mergedProp",
                    typeName: "TargetSchema.testEnum",
                    type: "PrimitiveProperty",
                  }],
                },
              },
            }, targetContext);
  
            const schemaEdits = new SchemaEdits();
            const testItem = await sourceSchema.getItem("testItem") as EntityClass;
            schemaEdits.items.rename(testItem, "mergedItem");
            schemaEdits.properties.rename(testItem, "testProp", "mergedProp");
      
            const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
            const merger = new SchemaMerger(targetContext);
            const mergedSchema = await merger.merge(result, schemaEdits);
       
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("label").to.equal("enumeration");
                expect(property).to.have.a.property("description").to.equal("enumeration property");
                expect(property).to.have.a.property("isReadOnly").to.equal(true);
              });
            });
          });

          it("should merge changes to a re-mapped struct property of a re-mapped class", async()=> {
            sourceSchema = await Schema.fromJson({
              ...sourceJson,
              items: {
                testStruct: {
                  schemaItemType: "StructClass",
                },
                testItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "StructArrayProperty", 
                    typeName: "SourceSchema.testStruct",
                    description: "struct property",
                    minOccurs: 2,
                    maxOccurs: 5,
                  }],
                },
              },
            }, await BisTestHelper.getNewContext());
  
            const targetSchema = await Schema.fromJson({
              ...targetJson,              
              items: {
                testStruct: {
                  schemaItemType: "StructClass",
                },
                testItem: {
                  schemaItemType: "CustomAttributeClass",
                  appliesTo: "Any",
                },
                mergedItem: {
                  schemaItemType: "EntityClass",
                  properties: [{
                    name: "testProp",
                    type: "PrimitiveArrayProperty",
                    typeName: "int",
                  },
                  {
                    name: "mergedProp",
                    typeName: "TargetSchema.testStruct",
                    type: "StructArrayProperty",
                  }],
                },
              },
            }, targetContext);
  
            const schemaEdits = new SchemaEdits();
            const testItem = await sourceSchema.getItem("testItem") as EntityClass;
            schemaEdits.items.rename(testItem, "mergedItem");
            schemaEdits.properties.rename(testItem, "testProp", "mergedProp");
      
            const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
            const merger = new SchemaMerger(targetContext);
            const mergedSchema = await merger.merge(result, schemaEdits);
       
            await expect(mergedSchema.getItem("mergedItem")).to.be.eventually.not.undefined
            .then(async(ecClass: EntityClass) => {
              await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
                expect(property).to.exist;
                expect(property).to.have.a.property("minOccurs").to.equal(2);
                expect(property).to.have.a.property("maxOccurs").to.equal(5);
                expect(property).to.have.a.property("description").to.equal("struct property");
              });
            });
          });
        });
      });
    });  
  });
});
