/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { SchemaItemTypeName } from "../../Differencing/SchemaDifference";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Enumeration merge tests", () => {

  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  it("should merge missing enumeration", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
    }, new SchemaContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: SchemaItemTypeName.Enumeration,
          itemName: "TestEnumeration",
          difference: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 0,
                label: "first value",
              },
              {
                name: "SecondValue",
                value: 1,
                label: "second value",
              },
            ],
          },
        },
      ],
    });

    const mergedEnumeration = await mergedSchema.getItem("TestEnumeration") as Enumeration;
    expect(mergedEnumeration.toJSON()).deep.equals({
      type: "int",
      schemaItemType: "Enumeration",
      isStrict: false,
      enumerators: [
        {
          label: "first value",
          name: "FirstValue",
          value: 0,
        },
        {
          label: "second value",
          name: "SecondValue",
          value: 1,
        },
      ],
    });
  });

  it("should merge missing enumerators of the same enumeration", async () => {
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

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: SchemaItemTypeName.Enumeration,
          itemName: "TestEnumeration",
          path: "$enumerators",
          difference: {
            name: "FirstValue",
            value: "F",
            label: "first value",
            description: undefined,
          },
        },
      ],
    });

    const mergedEnumeration = await mergedSchema.getItem("TestEnumeration") as Enumeration;
    expect(mergedEnumeration.toJSON()).deep.equals({
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

  it("should merge a super-set enumeration", async () => {
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

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: SchemaItemTypeName.Enumeration,
          itemName: "TestEnumeration",
          path: "$enumerators",
          difference: {
            name: "ThirdValue",
            value: 2,
            label: "Third value",
          },
        },
      ],
    });

    const mergedEnumeration = await mergedSchema.getItem("TestEnumeration") as Enumeration;
    expect(mergedEnumeration.toJSON()).deep.equals({
      type: "int",
      schemaItemType: "Enumeration",
      isStrict: false,
      enumerators: [
        {
          label: "first value",
          name: "FirstValue",
          value: 0,
        },
        {
          label: "second value",
          name: "SecondValue",
          value: 1,
        },
        {
          label: "Third value",
          name: "ThirdValue",
          value: 2,
        },
      ],
    });
  });

  it("should merge missing enumerator attributes", async () => {
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
              value: 100,
            },
          ],
        },
      },
    }, new SchemaContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: SchemaItemTypeName.Enumeration,
          itemName: "TestEnumeration",
          path: "$enumerators.EnumeratorOne",
          difference: {
            description: "This is for enumerator one",
            label: "Enumerator One",
          },
        },
      ],
    });

    const mergedEnumeration = await mergedSchema.getItem("TestEnumeration") as Enumeration;
    expect(mergedEnumeration.toJSON()).deep.eq({
      type: "int",
      schemaItemType: "Enumeration",
      isStrict: true,
      enumerators: [
        {
          description: "This is for enumerator one",
          label: "Enumerator One",
          name: "EnumeratorOne",
          value: 100,
        },
      ],
    });
  });

  it("should throw an error if source enumeration and target enumeration type mismatch", async () => {
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

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: SchemaItemTypeName.Enumeration,
          itemName: "TestEnumeration",
          difference: {
            type: "int",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith(Error, "The Enumeration TestEnumeration has an incompatible type. It must be \"string\", not \"int\".");
  });

  it("should throw an error if enumerator value attribute conflict exist", async () => {
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

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: SchemaItemTypeName.Enumeration,
          itemName: "TestEnumeration",
          path: "$enumerators.EnumeratorOne",
          difference: {
            value: 100,
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Failed to merge enumerator attribute, Enumerator \"EnumeratorOne\" has different values.");
  });
});
