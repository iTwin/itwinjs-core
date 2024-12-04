/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, EntityClass, RelationshipClass, Schema, SchemaContext, SchemaItemType, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { getSchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";
import { SchemaEdits } from "../../ecschema-editing";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Custom Attribute merge", () => {
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
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "01.00.15",
      alias: "test",
      items: {
        TestCA: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Any",
          properties: [
            {
              name: "StringPrimitiveArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "string",
            },
            {
              name: "IntProp",
              type: "PrimitiveProperty",
              typeName: "int",
            },
          ],
        },
      },
    }, targetContext);
  });

  describe("merging custom attribute to class", () => {
    it("should merge missing custom attribute to entity class", async () => {
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
            schemaType: SchemaItemType.CustomAttributeClass,
            itemName: "SourceCA",
            difference: {
              properties: [
                {
                  name: "BooleanProp",
                  type: "PrimitiveProperty",
                  typeName: "boolean",
                },
                {
                  name: "DoubleProp",
                  type: "PrimitiveProperty",
                  typeName: "double",
                },
              ],
              appliesTo: "AnyClass",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            itemName: "TestEntity",
            appliedTo: "SchemaItem",
            difference: {
              IntProp: 5,
              StringPrimitiveArrayProp: [
                "ClassCustomAttribute",
              ],
              className: "TestSchema.TestCA",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            appliedTo: "SchemaItem",
            itemName: "TestEntity",
            difference: {
              BooleanProp: true,
              DoubleProp: 1.2,
              className: "SourceSchema.SourceCA",
            },
          },
        ],
        conflicts: undefined,
      });

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedEntity!.toJSON().customAttributes).deep.eq(
        [
          {
            IntProp: 5,
            StringPrimitiveArrayProp: [
              "ClassCustomAttribute",
            ],
            className: "TestSchema.TestCA",
          },
          {
            BooleanProp: true,
            DoubleProp: 1.2,
            className: "TargetSchema.SourceCA",
          },
        ],
      );
    });

    it("should merge missing custom attribute to struct class", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
          TestStruct: {
            schemaItemType: "StructClass",
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
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            itemName: "TestStruct",
            appliedTo: "SchemaItem",
            difference: {
              className: "SourceSchema.TestCA",
            },
          },
        ],
        conflicts: undefined,
      });

      const mergedStruct = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(mergedStruct!.toJSON().customAttributes).deep.eq(
        [
          {
            className: "TargetSchema.TestCA",
          },
        ],
      );
    });

    it("should merge missing custom attribute to custom attribute class", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
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
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            itemName: "TestCA",
            appliedTo: "SchemaItem",
            difference: {
              IntProp: 100,
              StringPrimitiveArrayProp: [
                "ClassCustomAttribute",
              ],
              className: "TestSchema.TestCA",
            },
          },
        ],
        conflicts: undefined,
      });

      const mergedCA = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
      expect(mergedCA!.toJSON().customAttributes).deep.eq(
        [
          {
            IntProp: 100,
            StringPrimitiveArrayProp: [
              "ClassCustomAttribute",
            ],
            className: "TestSchema.TestCA",
          },
        ],
      );
    });

    it("should merge missing custom attribute to relationship class", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
            properties: [
              {
                name: "BoolProperty",
                type: "PrimitiveProperty",
                typeName: "bool",
              },
            ],
          },
          BaseEntity: {
            schemaItemType: "EntityClass",
          },
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              constraintClasses: [
                "TargetSchema.BaseEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              constraintClasses: [
                "TargetSchema.BaseEntity",
              ],
            },
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
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            itemName: "TestRelationship",
            appliedTo: "SchemaItem",
            difference: {
              className: "TestSchema.TestCA",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            itemName: "TestRelationship",
            appliedTo: "SchemaItem",
            difference: {
              BoolProperty: false,
              className: "SourceSchema.TestCA",
            },
          },
        ],
        conflicts: undefined,
      });

      const mergedRel = await mergedSchema.getItem<RelationshipClass>("TestRelationship");
      expect(mergedRel!.toJSON().customAttributes).deep.eq(
        [
          {
            className: "TestSchema.TestCA",
          },
          {
            BoolProperty: false,
            className: "TargetSchema.TestCA",
          },
        ],
      );
    });
  });

  describe("merging custom attribute to property", () => {
    it("should merge custom attribute to property in an entity class", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyProperty",
            properties: [
              {
                name: "LongProp",
                type: "PrimitiveProperty",
                typeName: "long",
              },
            ],
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "DoubleProp",
                type: "PrimitiveProperty",
                typeName: "double",
              },
              {
                name: "DateTimeProp",
                type: "PrimitiveProperty",
                typeName: "dateTime",
              },
            ],
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
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            appliedTo: "Property",
            itemName: "TestEntity",
            path: "DoubleProp",
            difference: {
              LongProp: 1.999,
              className: "SourceSchema.TestCA",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            appliedTo: "Property",
            itemName: "TestEntity",
            path: "DateTimeProp",
            difference: {
              IntProp: 25,
              StringPrimitiveArrayProp: [
                "PropertyCustomAttribute",
              ],
              className: "TestSchema.TestCA",
            },
          },
        ],
      });
      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedEntity!.toJSON().properties).deep.eq(
        [
          {
            name: "DoubleProp",
            type: "PrimitiveProperty",
            typeName: "double",
            customAttributes: [
              {
                LongProp: 1.999,
                className: "TargetSchema.TestCA",
              },
            ],
          },
          {
            name: "DateTimeProp",
            type: "PrimitiveProperty",
            typeName: "dateTime",
            customAttributes: [
              {
                IntProp: 25,
                StringPrimitiveArrayProp: [
                  "PropertyCustomAttribute",
                ],
                className: "TestSchema.TestCA",
              },
            ],
          },
        ],
      );
    });

    it("should merge custom attribute to property in a custom attribute class", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
            properties: [
              {
                name: "StringArrayProp",
                type: "PrimitiveArrayProperty",
                typeName: "string",
                minOccurs: 1,
                maxOccurs: 10,
              },
            ],
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
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            appliedTo: "Property",
            itemName: "TestCA",
            path: "StringArrayProp",
            difference: {
              StringPrimitiveArrayProp: [
                "Test0",
                "Test1",
              ],
              className: "TestSchema.TestCA",
            },
          },
        ],
      });
      const mergedCA = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
      expect(mergedCA!.toJSON().properties).deep.eq(
        [
          {
            name: "StringArrayProp",
            type: "PrimitiveArrayProperty",
            typeName: "string",
            minOccurs: 1,
            maxOccurs: 10,
            customAttributes: [
              {
                StringPrimitiveArrayProp: [
                  "Test0",
                  "Test1",
                ],
                className: "TestSchema.TestCA",
              },
            ],
          },
        ],
      );
    });

    it("should merge custom attribute to property in a struct class", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyProperty",
            properties: [
              {
                name: "StringProp",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [
              {
                name: "StringProp",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
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
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            appliedTo: "Property",
            itemName: "TestStruct",
            path: "StringProp",
            difference: {
              StringProp: "TestProperty",
              className: "SourceSchema.TestCA",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            appliedTo: "Property",
            itemName: "TestStruct",
            path: "StringProp",
            difference: {
              IntProp: 25,
              className: "TestSchema.TestCA",
            },
          },
        ],
      });
      const mergedStruct = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(mergedStruct!.toJSON().properties).deep.eq(
        [
          {
            name: "StringProp",
            type: "PrimitiveProperty",
            typeName: "string",
            customAttributes: [
              {
                StringProp: "TestProperty",
                className: "TargetSchema.TestCA",
              },
              {
                IntProp: 25,
                className: "TestSchema.TestCA",
              },
            ],
          },
        ],
      );
    });

    it("should merge custom attribute to property in a relationship class", async () => {
      await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyProperty",
            properties: [
              {
                name: "StringProp",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
          BaseEntity: {
            schemaItemType: "EntityClass",
          },
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            properties: [
              {
                name: "LongProp",
                type: "PrimitiveProperty",
                typeName: "long",
              },
            ],
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              constraintClasses: [
                "TargetSchema.BaseEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              constraintClasses: [
                "TargetSchema.BaseEntity",
              ],
            },
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
            schemaType: SchemaOtherTypes.CustomAttributeInstance,
            appliedTo: "Property",
            itemName: "TestRelationship",
            path: "LongProp",
            difference: {
              StringProp: "TestProperty",
              className: "SourceSchema.TestCA",
            },
          },
        ],
      });
      const mergedRel = await mergedSchema.getItem<RelationshipClass>("TestRelationship");
      expect(mergedRel!.toJSON().properties).deep.eq(
        [
          {
            name: "LongProp",
            type: "PrimitiveProperty",
            typeName: "long",
            customAttributes: [
              {
                StringProp: "TestProperty",
                className: "TargetSchema.TestCA",
              },
            ],
          },
        ],
      );
    });
  });

  it("should merge missing schema custom attributes", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TestCA: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
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
          schemaType: SchemaOtherTypes.CustomAttributeInstance,
          appliedTo: "Schema",
          difference: {
            className: "SourceSchema.TestCA",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.CustomAttributeInstance,
          appliedTo: "Schema",
          difference: {
            StringPrimitiveArrayProp: [
              "SchemaCustomAttribute",
            ],
            className: "TestSchema.TestCA",
          },
        },
      ],
    });

    expect(mergedSchema.toJSON().customAttributes).deep.eq(
      [
        ...targetJson.customAttributes,
        {
          className: "TargetSchema.TestCA",
        },
        {
          StringPrimitiveArrayProp: [
            "SchemaCustomAttribute",
          ],
          className: "TestSchema.TestCA",
        },
      ],
    );
  });

  it("should merge missing relationship constraint custom attributes", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        BaseEntity: {
          schemaItemType: "EntityClass",
        },
        TestCA: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyRelationshipConstraint",
          properties: [
            {
              name: "BoolProp",
              type: "PrimitiveProperty",
              typeName: "boolean",
            },
          ],
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          description: "Description of TestRelationship",
          modifier: "None",
          strength: "Referencing",
          strengthDirection: "Forward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "refers to",
            polymorphic: true,
            constraintClasses: [
              "TargetSchema.BaseEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "is referenced by",
            polymorphic: true,
            constraintClasses: [
              "TargetSchema.BaseEntity",
            ],
          },
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
          schemaType: SchemaOtherTypes.CustomAttributeInstance,
          appliedTo: "RelationshipConstraint",
          itemName: "TestRelationship",
          path: "$source",
          difference: {
            className: "TestSchema.TestCA",
            IntProp: 10,
          },
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.CustomAttributeInstance,
          itemName: "TestRelationship",
          appliedTo: "RelationshipConstraint",
          path: "$source",
          difference: {
            className: "SourceSchema.TestCA",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.CustomAttributeInstance,
          itemName: "TestRelationship",
          appliedTo: "RelationshipConstraint",
          path: "$target",
          difference: {
            className: "TestSchema.TestCA",
            StringPrimitiveArrayProp: [
              "RelationshipConstraintCustomAttribute",
            ],
          },
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.CustomAttributeInstance,
          itemName: "TestRelationship",
          appliedTo: "RelationshipConstraint",
          path: "$target",
          difference: {
            className: "SourceSchema.TestCA",
            BoolProp: true,
          },
        },
      ],
    });

    const mergedRelationship = await mergedSchema.getItem<RelationshipClass>("TestRelationship");
    expect(mergedRelationship!.toJSON().source).deep.eq({
      customAttributes: [
        {
          className: "TestSchema.TestCA",
          IntProp: 10,
        },
        {
          className: "TargetSchema.TestCA",
        },
      ],
      multiplicity: "(0..*)",
      roleLabel: "refers to",
      polymorphic: true,
      constraintClasses: [
        "TargetSchema.BaseEntity",
      ],
    });
    expect(mergedRelationship!.toJSON().target).deep.eq({
      customAttributes: [
        {
          className: "TestSchema.TestCA",
          StringPrimitiveArrayProp: ["RelationshipConstraintCustomAttribute"],
        },
        {
          className: "TargetSchema.TestCA",
          BoolProp: true,
        },
      ],
      multiplicity: "(0..*)",
      roleLabel: "is referenced by",
      polymorphic: true,
      constraintClasses: [
        "TargetSchema.BaseEntity",
      ],
    });
  });

  it("should merge custom attribute on entity class", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TestCAClass: {
          schemaItemType: "CustomAttributeClass",
          label: "Test Custom Attribute Class",
          appliesTo: "AnyClass",
        },
        TestClass: {
          schemaItemType: "EntityClass",
          label: "TestClass",
          customAttributes: [{ className: "TargetSchema.TestCAClass" }],
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
          itemName: "TestCAClass",
          path: "BooleanProperty",
          difference: {
            name: "BooleanProperty",
            type: "PrimitiveProperty",
            typeName: "boolean",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.CustomAttributeClass,
          itemName: "AnotherCAClass",
          difference: {
            label: "Test Custom Attribute Class",
            appliesTo: "AnyClass",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.CustomAttributeInstance,
          appliedTo: "SchemaItem",
          itemName: "TestClass",
          difference: {
            className: "SourceSchema.AnotherCAClass",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "AnotherTestClass",
          difference: {
            label: "TestClass",
            properties: [
              {
                name: "StringProperty",
                type: "PrimitiveProperty",
                customAttributes: [
                  {
                    className: "SourceSchema.TestCAClass",
                    BooleanProperty: true,
                  },
                ],
                typeName: "string",
              },
            ],
            customAttributes: [
              {
                className: "SourceSchema.TestCAClass",
                BooleanProperty: false,
              },
            ],
          },
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.CustomAttributeInstance,
          appliedTo: "Property",
          itemName: "AnotherTestClass",
          path: "StringProperty",
          difference: {
            className: "SourceSchema.TestCAClass",
            BooleanProperty: true,
          },
        },
      ],
      conflicts: undefined,
    });

    const testClassItem = await mergedSchema.getItem<EntityClass>("TestClass");
    expect(testClassItem!.toJSON()).deep.eq({
      schemaItemType: "EntityClass",
      label: "TestClass",
      customAttributes: [{ className: "TargetSchema.TestCAClass" }, { className: "TargetSchema.AnotherCAClass" }],
    });
    const anotherClassItem = await mergedSchema.getItem<EntityClass>("AnotherTestClass");
    expect(anotherClassItem!.toJSON()).deep.eq({
      schemaItemType: "EntityClass",
      label: "TestClass",
      customAttributes: [{ className: "TargetSchema.TestCAClass", BooleanProperty: false }],
      properties: [{
        name: "StringProperty",
        type: "PrimitiveProperty",
        typeName: "string",
        customAttributes: [{ className: "TargetSchema.TestCAClass", BooleanProperty: true }],
      }],
    });
  });

  describe("iterative tests", () => {
    it("should merge re-mapped custom attribute to schema", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        customAttributes: [
          ...sourceJson.customAttributes,
          { className: "SourceSchema.testItem", },
        ],
        items: {          
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");
  
      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedCustomAttribute")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.CustomAttributeClass);
      });
      expect(mergedSchema).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
        return customAttributes.has("TargetSchema.mergedCustomAttribute");
      });
    });
  
    it("should add missing entity class with re-mapped custom attributes", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {  
          testEntity: {
            schemaItemType: "EntityClass",
            customAttributes: [{
              className: "SourceSchema.testItem",
            }],
          },       
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");
  
      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedCustomAttribute")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.CustomAttributeClass);
      });
      await expect(mergedSchema.getItem("testEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
          return customAttributes.has("TargetSchema.mergedCustomAttribute");
        });
      });
    });
  
    it("should merge re-mapped custom attributes to existing mixin", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testMixin: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.testEntity", 
            customAttributes: [{
              className: "SourceSchema.testItem",
            }],
          },       
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TargetSchema.testEntity", 
          },  
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");
  
      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedCustomAttribute")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.CustomAttributeClass);
      });
      await expect(mergedSchema.getItem("testMixin")).to.be.eventually.fulfilled.then(async (mixin) => {
        expect(mixin).to.exist;
        expect(mixin).to.have.a.property("schemaItemType").equals(SchemaItemType.Mixin);
        expect(mixin).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
          return customAttributes.has("TargetSchema.mergedCustomAttribute");
        });
      });
    });
  
    it("should add a re-mapped struct class with re-mapped custom attributes", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {  
          testClass: {
            schemaItemType: "StructClass",
            customAttributes: [{
              className: "SourceSchema.testItem",
            }],
          },       
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testClass: {
            schemaItemType: "EntityClass",
          },  
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");
      const testClass = await sourceSchema.getItem("testClass") as StructClass;
      schemaEdits.items.rename(testClass, "mergedStruct");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedCustomAttribute")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.CustomAttributeClass);
      });
      await expect(mergedSchema.getItem("mergedStruct")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.StructClass);
        expect(ecClass).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
          return customAttributes.has("TargetSchema.mergedCustomAttribute");
        });
      });
    });

    it("should merge custom attributes to re-mapped custom attribute class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {  
          testCAClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",            
          },       
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            customAttributes: [{
              className: "SourceSchema.testCAClass",
            }],
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedCustomAttribute")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.CustomAttributeClass);
        expect(ecClass).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
          return customAttributes.has("TargetSchema.testCAClass");
        });
      });
    });

    it("should merge re-mapped custom attributes to property of entity class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {  
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
              customAttributes: [{
                className: "SourceSchema.testItem",
              }],
            }],
          },       
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("testEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.EntityClass);
        await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
            return customAttributes.has("TargetSchema.mergedCustomAttribute");
          });
        });
      });
    });

    it("should merge custom attributes to property of re-mapped custom attribute class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {  
          testCAClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },       
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
              customAttributes: [{
                className: "SourceSchema.testCAClass",
              }],
            }],
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testCAClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
            }],
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedCustomAttribute")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
            return customAttributes.has("TargetSchema.testCAClass");
          });
        });
      });
    });

    it("should merge custom attributes to re-mapped property of re-mapped custom attribute class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {  
          testCAClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },       
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
              customAttributes: [{
                className: "SourceSchema.testCAClass",
              }],
            }],
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testCAClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            properties: [{
              name: "mergedProp",
              type: "PrimitiveProperty",
              typeName: "string",
            },{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "int",
            }],
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");
      schemaEdits.properties.rename(testItem, "testProp", "mergedProp");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedCustomAttribute")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
            return customAttributes.has("TargetSchema.testCAClass");
          });
        });
      });
    });

    it("should merge re-mapped custom attributes to re-mapped property of struct class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {  
          testStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "double",
              customAttributes: [
                { className: "SourceSchema.testItem", }
              ],
            }],
          },       
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveArrayProperty",
              typeName: "string",
            },
            {
              name: "mergedProp",
              type: "PrimitiveProperty",
              typeName: "double",
            }],
          },
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      const testStruct = await sourceSchema.getItem("testStruct") as StructClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");
      schemaEdits.properties.rename(testStruct, "testProp", "mergedProp");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("testStruct")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("mergedProp")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
            return customAttributes.has("TargetSchema.mergedCustomAttribute");
          });
        });
      });
    });

    it.skip("should add relationship class with relationship constraint re-mapped custom attributes", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testRelationship: {
            schemaItemType: "RelationshipClass",
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
              customAttributes: [
                { className: "SourceSchema.testItem", }
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
              customAttributes: [
                { className: "SourceSchema.testItem", }
              ],
            },
          },    
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("testRelationship")).to.be.eventually.not.undefined
        .then((ecClass: RelationshipClass) => {
          expect(ecClass).to.have.a.nested.property("source.customAttributes").to.satisfy((customAttributes: any) => {
            expect(customAttributes).to.exist;
            return customAttributes.has("TargetSchema.mergedCustomAttribute");
          });
          expect(ecClass).to.have.a.nested.property("target.customAttributes").to.satisfy((customAttributes: any) => {
            expect(customAttributes).to.exist;
            return customAttributes.has("TargetSchema.mergedCustomAttribute");
          });
      })
    });

    it("should add re-mapped custom attributes to re-mapped relationship class constraint", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testRelationship: {
            schemaItemType: "RelationshipClass",
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
              customAttributes: [
                { className: "SourceSchema.testItem", }
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
              customAttributes: [
                { className: "SourceSchema.testItem", }
              ],
            },
          },    
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testRelationship: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          mergedRelationship: {
            schemaItemType: "RelationshipClass",
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              constraintClasses: [
                "TargetSchema.testEntity",
              ],              
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              constraintClasses: [
                "TargetSchema.testEntity",
              ],              
            },
          },
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedCustomAttribute");
      const testRelationship = await sourceSchema.getItem("testRelationship") as RelationshipClass;
      schemaEdits.items.rename(testRelationship, "mergedRelationship");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedRelationship")).to.be.eventually.not.undefined
        .then((ecClass: RelationshipClass) => {
          expect(ecClass).to.have.a.nested.property("source.customAttributes").to.satisfy((customAttributes: any) => {
            return customAttributes.has("TargetSchema.mergedCustomAttribute");
          });
          expect(ecClass).to.have.a.nested.property("target.customAttributes").to.satisfy((customAttributes: any) => {
            return customAttributes.has("TargetSchema.mergedCustomAttribute");
          });
      })
    });
  });
});
