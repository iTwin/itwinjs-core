/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Enumeration merge tests", () => {

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

  describe("Enumeration missing tests", () => {
    it("should merge missing enumeration", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [{
              name: "FirstValue",
              label: "first value",
              value: 0,
            },
            {
              name: "SecondValue",
              label: "second value",
              value: 1,
            }],
          },
        },
      }, new SchemaContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, new SchemaContext());

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);

      const sourceEnumeration = await sourceSchema.getItem<Enumeration>("TestEnumeration");
      const mergedEnumeration = await mergedSchema.getItem<Enumeration>("TestEnumeration");
      expect(sourceEnumeration!.toJSON()).deep.eq(mergedEnumeration!.toJSON());
    });

    it("should merge a super-set enumeration", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [{
              name: "FirstValue",
              label: "first value",
              value: 0,
            },
            {
              name: "SecondValue",
              label: "second value",
              value: 1,
            },
            {
              name: "ThirdValue",
              label: "Third value",
              value: 2,
            }],
          },
        },
      }, new SchemaContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [{
              name: "FirstValue",
              label: "first value",
              value: 0,
            },
            {
              name: "SecondValue",
              label: "second value",
              value: 1,
            }],
          },
        },
      }, new SchemaContext());

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);

      const sourceEnumeration = await sourceSchema.getItem<Enumeration>("TestEnumeration");
      const mergedEnumeration = await mergedSchema.getItem<Enumeration>("TestEnumeration");
      expect(sourceEnumeration!.toJSON()).deep.eq(mergedEnumeration!.toJSON());
    });
  });

  

  describe.only("Enumeration delta tests", () => {
    it("should merge missing enumerators of the same enumeration", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "string",
            isStrict: true,
            enumerators: [{
              name: "FirstValue",
              label: "first value",
              value: "F",
            }],
          },
        },
      }, new SchemaContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "string",
            isStrict: true,
            enumerators: [{
              name: "AnotherValue",
              label: "totally different value",
              value: "T",
            }],
          },
        },
      }, new SchemaContext());

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedEnumeration = await mergedSchema.getItem<Enumeration>("TestEnumeration");
      expect(mergedEnumeration!.toJSON()).deep.eq({
        schemaItemType: "Enumeration",
        type: "string",
        isStrict: true,
        enumerators: [{
          name: "AnotherValue",
          label: "totally different value",
          value: "T",
        },
        {
          name: "FirstValue",
          label: "first value",
          value: "F",
        }],
      });
    });

    it("should throw an error if merged enumeration types mismatch", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: true,
            enumerators: [{
              name: "AnotherValue",
              label: "totally different value",
              value: 99,
            }],
          },
        },
      }, new SchemaContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "string",
            isStrict: true,
            enumerators: [{
              name: "valueOne",
              label: "string value one",
              value: "one",
            }],
          },
        },
      }, new SchemaContext());

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, "Merged enumeration TestEnumeration types not equal: string -> int");
    });

    it.only("should throw an error if enumerator value attribute conflict exist", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: true,
            enumerators: [
              {
                name: "EnumeratorOne",
                label: "Enumerator One",
                value: 100,
              },
            ],
          },
        },
      }, new SchemaContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: true,
            enumerators: [
              {
                name: "EnumeratorOne",
                label: "Enumerator One",
                value: 200,
              },
            ],
          },
        },
      }, new SchemaContext());

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, "Enumerator attribute conflict: Value: 100 -> 200");

    });
  });
});