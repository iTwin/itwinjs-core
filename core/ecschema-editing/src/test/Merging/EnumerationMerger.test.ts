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
  const targetJson =  {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  describe("Enumeration missing tests", () => {
    it("should merge missing enumeration item", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: true,
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

    it("should merge same Enumerable with different enumerators", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: true,
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

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedEnumeration = await mergedSchema.getItem<Enumeration>("TestEnumeration");
      expect(mergedEnumeration!.toJSON()).deep.eq({
        schemaItemType: "Enumeration",
        type: "int",
        isStrict: true,
        enumerators: [{
          name: "AnotherValue",
          label: "totally different value",
          value: 99,
        },
        {
          name: "FirstValue",
          label: "first value",
          value: 0,
        },
        {
          name: "SecondValue",
          label: "second value",
          value: 1,
        }],
      });
    });

    it("should throw an error if source type is int and target type is string", async () => {
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
      },  new SchemaContext());

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
              value: 'one',
            }],
          },
        },
      },  new SchemaContext());

      const merger = new SchemaMerger();
      try{
        const mergedSchema = await merger.merge(targetSchema, sourceSchema);
        expect(mergedSchema).Throw(Error);
        expect.fail('Expected an error to be thrown')
      }catch (error: any){
        expect(error).to.be.an.instanceOf(Error);
        expect(error.message).to.equal('Enumeration types not equal: Source Enumeration type is int, target Enumeration type is string');
      }
    })

    it("should throw an error if source type is string and target type is int", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "string",
            isStrict: true,
            enumerators: [{
              name: "AnotherValue",
              label: "totally different value",
              value: '99',
            }],
          },
        },
      },  new SchemaContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: true,
            enumerators: [{
              name: "valueOne",
              label: "value one",
              value: 1,
            }],
          },
        },
      },  new SchemaContext());

      const merger = new SchemaMerger();
      try{
        const mergedSchema = await merger.merge(targetSchema, sourceSchema);
        expect(mergedSchema).Throw(Error);
        expect.fail('Expected an error to be thrown')
      }catch (error: any){
        expect(error).to.be.an.instanceOf(Error);
        expect(error.message).to.equal('Enumeration types not equal: Source Enumeration type is string, target Enumeration type is int');
      }
    })
  });
});