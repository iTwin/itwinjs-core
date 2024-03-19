/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, RelationshipClass, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaItemTypeName } from "../../Differencing/SchemaDifference";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Custom Attribute merge", () => {
  let targetContext: SchemaContext;
  const targetJson =  {
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
          schemaType: "Schema",
          path: "$references",
          difference: {
            name: "TestSchema",
            version: "01.00.15",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemTypeName.CustomAttributeClass,
          itemName: "SourceCA",
          difference: {
            schemaItemType: "CustomAttributeClass",
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
          schemaType: "CustomAttribute",
          itemName: "TestEntity",
          appliesTo: "SchemaItem",
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
          schemaType: "CustomAttribute",
          appliesTo: "SchemaItem",
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
          schemaType: "Schema",
          path: "$references",
          difference: {
            name: "TestSchema",
            version: "01.00.15",
          },
        },
        {
          changeType: "add",
          schemaType: "CustomAttribute",
          appliesTo: "Property",
          itemName: "TestEntity",
          path: "DoubleProp",
          difference: {
            LongProp: 1.999,
            className: "SourceSchema.TestCA",
          },
        },
        {
          changeType: "add",
          schemaType: "CustomAttribute",
          appliesTo: "Property",
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
          schemaType: "Schema",
          path: "$references",
          difference: {
            name: "TestSchema",
            version: "01.00.15",
          },
        },
        {
          changeType: "add",
          schemaType: "CustomAttribute",
          appliesTo: "Schema",
          difference: {
            className: "SourceSchema.TestCA",
          },
        },
        {
          changeType: "add",
          schemaType: "CustomAttribute",
          appliesTo: "Schema",
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
          schemaType: "Schema",
          path: "$references",
          difference: {
            name: "TestSchema",
            version: "01.00.15",
          },
        },
        {
          changeType: "add",
          schemaType: "CustomAttribute",
          appliesTo: "RelationshipConstraint",
          itemName: "TestRelationship",
          path: "$source",
          difference: {
            className: "TestSchema.TestCA",
            IntProp: 10,
          },
        },
        {
          changeType: "add",
          schemaType: "CustomAttribute",
          itemName: "TestRelationship",
          appliesTo: "RelationshipConstraint",
          path: "$source",
          difference: {
            className: "SourceSchema.TestCA",
          },
        },
        {
          changeType: "add",
          schemaType: "CustomAttribute",
          itemName: "TestRelationship",
          appliesTo: "RelationshipConstraint",
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
          schemaType: "CustomAttribute",
          itemName: "TestRelationship",
          appliesTo: "RelationshipConstraint",
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
});
