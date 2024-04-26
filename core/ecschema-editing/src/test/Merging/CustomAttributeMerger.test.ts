/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, RelationshipClass, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Custom Attribute merge", () => {
  let targetContext: SchemaContext;
  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  beforeEach(async () => {
    targetContext = new SchemaContext();
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

  it("should merge missing class custom attributes", async () => {
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

  it("should merge missing property custom attributes", async () => {
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
      changes: [
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
      changes: [
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
      changes: [
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
      changes: [
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
});
