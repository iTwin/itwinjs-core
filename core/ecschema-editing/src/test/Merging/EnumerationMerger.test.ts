/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

describe.only("Enumeration merge tests", () => {
  let targetContext: SchemaContext;
  let sourceContext: SchemaContext;
  let merger: SchemaMerger;

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

  const TestEnumeration = {
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
  }

  beforeEach(() => {
    targetContext = new SchemaContext();
    sourceContext = new SchemaContext();
    merger = new SchemaMerger();
  });

  describe("Enumeration missing tests", () => {
    it("should create a new enumeration item for target schema", async () =>{
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration,
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedEnumeration = await mergedSchema.getItem<Enumeration>("TestEnumeration");
      expect(mergedEnumeration!.fullName).eq("TargetSchema.TestEnumeration");
    })

    it("should merge missing enumeration item", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration,
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceEnumeration = await sourceSchema.getItem<Enumeration>("TestEnumeration");
      const mergedEnumeration = await mergedSchema.getItem<Enumeration>("TestEnumeration");
      expect(sourceEnumeration!.toJSON()).deep.eq(mergedEnumeration!.toJSON());
    });

    it("should merge different enumerators from source into same enumeration item in target", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration
        },
      }, sourceContext);

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
      }, targetContext);

      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedEnumeration = await mergedSchema.getItem<Enumeration>("TestEnumeration");
      expect(mergedEnumeration!.toJSON()).deep.eq({
        schemaItemType: "Enumeration",
        type: "int",
        isStrict: true,
        enumerators: [
          {
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

    it.only("should throw an error if source enumeration has the same name as target enumeration but different primitive type", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEnumeration
        },
      }, sourceContext);

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
      }, targetContext);

      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      // Need to investigate
      //await expect(mergedSchema).to.be.rejectedWith(Error, "Failed to merge: primitive type mismatch");
    })

  });
});
