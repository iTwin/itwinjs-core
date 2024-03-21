/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, EntityClass, Mixin, Schema, SchemaContext, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
/* eslint-disable @typescript-eslint/naming-convention */

describe("Property merger tests", () => {
  let targetContext: SchemaContext;
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
    targetContext = new SchemaContext();
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
        changes: [
          {
            changeType: "add",
            schemaType: "Schema",
            path: "$references",
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: "PropertyCategory",
            itemName: "TestCategory",
            difference: {
              priority: 4,
            },
          },
          {
            changeType: "add",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "add",
            schemaType: "StructClass",
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

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        changes: [
          {
            changeType: "add",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "add",
            schemaType: "Schema",
            path: "$references",
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "add",
            schemaType: "Schema",
            path: "$references",
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: "PropertyCategory",
            itemName: "TestCategory",
            difference: {
              priority: 4,
            },
          },
          {
            changeType: "add",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "add",
            schemaType: "Schema",
            path: "$references",
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: "StructClass",
            itemName: "TestStruct",
            difference: { },
          },
          {
            changeType: "add",
            schemaType: "EntityClass",
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
        changes: [
          {
            changeType: "add",
            schemaType: "Schema",
            path: "$references",
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "add",
            schemaType: "Schema",
            path: "$references",
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "add",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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

    it("should throw an error when merging properties kind of quantity changed", async () => {
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
      const merge = merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        changes: [
          {
            changeType: "add",
            schemaType: "Schema",
            path: "$references",
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "modify",
            schemaType: "Property",
            itemName: "TestEntity",
            path: "Prop",
            difference: {
              kindOfQuantity: "TestSchema.TestKoq",
            },
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestEntity.Prop' kind of quantity is not supported.");
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
        changes: [
          {
            changeType: "add",
            schemaType: "Schema",
            path: "$references",
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "add",
            schemaType: "StructClass",
            itemName: "SourceStruct",
            difference: { },
          },
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "add",
            schemaType: "Schema",
            path: "$references",
            difference: {
              name: "TestSchema",
              version: "01.00.15",
            },
          },
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "add",
            schemaType: "Enumeration",
            itemName: "SourceEnumeration",
            difference: {
              type: "int",
              isStrict: undefined,
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
            schemaType: "Property",
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
        changes: [
          {
            changeType: "modify",
            schemaType: "Property",
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
        changes: [
          {
            changeType: "add",
            schemaType: "RelationshipClass",
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
            schemaType: "Property",
            itemName: "TestEntity",
            path: "NavProp",
            difference: {
              relationshipClass: "SourceSchema.SourceRelationship",
            } as any,
          },
        ],
      });
      await expect(merge).to.be.rejectedWith("Changing the property 'TestEntity.NavProp' relationship class is not supported.");
    });
  });
});
