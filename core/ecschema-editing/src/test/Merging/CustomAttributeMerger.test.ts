/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
/* eslint-disable @typescript-eslint/naming-convention */

describe("Custom Attribute merge", () => {
  let sourceContext: SchemaContext;
  let targetContext: SchemaContext;

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

  beforeEach(async () => {
    sourceContext = new SchemaContext();
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
    }, sourceContext);
  });

  describe("Custom Attributes missing tests", () => {
    it("should merge missing class custom attributes", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          SourceCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
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
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            customAttributes: [
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
                className: "SourceSchema.SourceCA",
              },
            ],
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
                customAttributes: [
                  {
                    LongProp: 1.999,
                    className: "SourceSchema.TestCA",
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
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
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

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
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
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        customAttributes: [
          {
            className: "SourceSchema.TestCA",
          },
          {
            StringPrimitiveArrayProp: [
              "SchemaCustomAttribute",
            ],
            className: "TestSchema.TestCA",
          },
        ],
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
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
  });
});
