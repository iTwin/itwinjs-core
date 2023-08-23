/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, Schema, SchemaContext } from "@itwin/ecschema-metadata";
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

  describe("EntityClass missing tests", () => {
    it("should merge missing entity class", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestClass: {
            schemaItemType: "EntityClass",
            description: "Description for TestClass",
            properties: [
              {
                name: "TestProp",
                type: "PrimitiveProperty",
                typeName: "int",
                description: "Description for TestProp",
              },
            ],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);

      const sourceEntity = await sourceSchema.getItem<EntityClass>("TestClass");
      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestClass");
      expect(sourceEntity!.toJSON()).deep.eq(mergedEntity!.toJSON());
    });
  });

  describe("EntityClass delta tests", () => {
    it("should merge missing primitive property", async () => {
      const propJson = {
        name: "TestProp",
        type: "PrimitiveProperty",
        typeName: "string",
        description: "Description for TestProp",
      };

      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestClass: {
            schemaItemType: "EntityClass",
            properties: [propJson],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestClass: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestClass");
      expect(mergedEntity).not.undefined;

      const properties = await mergedEntity!.getProperties();
      expect(properties.length).eq(1);
      expect(properties[0].toJSON()).deep.eq(propJson);
    });

    it("should merge missing primitive array property", async () => {
      const propJson = {
        name: "TestProp",
        type: "PrimitiveArrayProperty",
        typeName: "int",
        minOccurs: 1,
        maxOccurs: 5,
        minValue: 0,
        maxValue: 100,
      };

      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestClass: {
            schemaItemType: "EntityClass",
            properties: [propJson],
          },
        },
      }, targetContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestClass: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestClass");
      expect(mergedEntity).not.undefined;

      const properties = await mergedEntity!.getProperties();
      expect(properties.length).eq(1);
      expect(properties[0].toJSON()).deep.eq(propJson);
    });

    it("should throw an error when property is not primitive", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
          },
          TestClass: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "TestProp",
              type: "StructProperty",
              typeName: "SourceSchema.TestStruct",
            }],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestClass: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, "Failed to merge 'TestProp' property: not supported type");
    });
  });
});
