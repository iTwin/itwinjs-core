/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration, Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { describe, expect, it } from "vitest";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { BisTestHelper } from "../TestUtils/BisTestHelper";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Enumeration merge tests", () => {

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

  it("should merge missing enumeration", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.Enumeration,
          itemName: "TestEnumeration",
          difference: {
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
    expect(mergedEnumeration).toBeDefined();
    expect(mergedEnumeration.schemaItemType).toBe(SchemaItemType.Enumeration);
    expect(mergedEnumeration.isInt).toBe(true);
    expect(mergedEnumeration.isStrict).toBe(false);
    expect(mergedEnumeration.enumerators).toHaveLength(2);
    expect(mergedEnumeration.enumerators[0]).toEqual({
      description: undefined,
      label: "first value",
      name: "FirstValue",
      value: 0,
    });
    expect(mergedEnumeration.enumerators[1]).toEqual({
      description: undefined,
      label: "second value",
      name: "SecondValue",
      value: 1,
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
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.Enumerator,
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
    expect(mergedEnumeration).toBeDefined();
    expect(mergedEnumeration.schemaItemType).toBe(SchemaItemType.Enumeration);
    expect(mergedEnumeration.isString).toBe(true);
    expect(mergedEnumeration.isStrict).toBe(true);
    expect(mergedEnumeration.enumerators).toHaveLength(2);
    expect(mergedEnumeration.enumerators[0]).toEqual({
      description: undefined,
      label: "totally different value",
      name: "AnotherValue",
      value: "T",
    });
    expect(mergedEnumeration.enumerators[1]).toEqual({
      description: undefined,
      label: "first value",
      name: "FirstValue",
      value: "F",
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
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.Enumerator,
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
    expect(mergedEnumeration).toBeDefined();
    expect(mergedEnumeration.schemaItemType).toBe(SchemaItemType.Enumeration);
    expect(mergedEnumeration.isInt).toBe(true);
    expect(mergedEnumeration.isStrict).toBe(false);
    expect(mergedEnumeration.enumerators).toHaveLength(3);
    expect(mergedEnumeration.enumerators[0]).toEqual({
      description: undefined,
      label: "first value",
      name: "FirstValue",
      value: 0,
    });
    expect(mergedEnumeration.enumerators[1]).toEqual({
      description: undefined,
      label: "second value",
      name: "SecondValue",
      value: 1,
    });
    expect(mergedEnumeration.enumerators[2]).toEqual({
      description: undefined,
      label: "Third value",
      name: "ThirdValue",
      value: 2,
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
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.Enumerator,
          itemName: "TestEnumeration",
          path: "EnumeratorOne",
          difference: {
            description: "This is for enumerator one",
            label: "Enumerator One",
          },
        },
      ],
    });

    const mergedEnumeration = await mergedSchema.getItem("TestEnumeration") as Enumeration;
    expect(mergedEnumeration).toBeDefined();
    expect(mergedEnumeration.schemaItemType).toBe(SchemaItemType.Enumeration);
    expect(mergedEnumeration.isInt).toBe(true);
    expect(mergedEnumeration.isStrict).toBe(true);
    expect(mergedEnumeration.enumerators).toHaveLength(1);
    expect(mergedEnumeration.enumerators[0]).toEqual({
      description: "This is for enumerator one",
      label: "Enumerator One",
      name: "EnumeratorOne",
      value: 100,
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
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Enumeration,
          itemName: "TestEnumeration",
          difference: {
            type: "int",
          },
        },
      ],
    });

    await expect(merge).rejects.toThrowError("The Enumeration TestEnumeration has an incompatible type. It must be \"string\", not \"int\".");
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
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.Enumerator,
          itemName: "TestEnumeration",
          path: "EnumeratorOne",
          difference: {
            value: 100,
          },
        },
      ],
    });

    await expect(merge).rejects.toThrowError("Failed to merge enumerator attribute, Enumerator \"EnumeratorOne\" has different values.");
  });
});
