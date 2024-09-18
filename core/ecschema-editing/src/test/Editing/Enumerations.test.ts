/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";

import { ECClassModifier, Enumeration, EnumerationProps, PrimitiveType, SchemaContext, SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";

describe("Enumerations tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
  });

  it("should create a new Enumeration class using a SchemaEditor", async () => {
    const enumerators = [
      { name: "enum1", value: 1 },
      { name: "enum2", value: 2 },
    ];
    await testEditor.enumerations.create(testKey, "testEnumeration", PrimitiveType.Integer, "label", true, enumerators);
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const testEnumeration = await schema?.getItem("testEnumeration") as Enumeration;
    expect(testEnumeration).toBeDefined();
    expect(testEnumeration?.schemaItemType).toBe(SchemaItemType.Enumeration);
    const enumerator1 = testEnumeration?.getEnumeratorByName("enum1");
    expect(enumerator1).toBeDefined();
    expect(enumerator1?.value).toBe(1);
    const enumerator2 = testEnumeration?.getEnumeratorByName("enum2");
    expect(enumerator2).toBeDefined();
    expect(enumerator2?.value).toBe(2);
  });

  it("should create a new Enumeration class using EnumerationProps", async () => {
    const enumerationProps: EnumerationProps = {
      name: "testEnumeration",
      type: "string",
      isStrict: true,
      enumerators: [
        {
          name: "testEnumerator",
          value: "test",
        },
      ],
    };

    const result = await testEditor.enumerations.createFromProps(testKey, enumerationProps);
    const testEnumeration = await testEditor.schemaContext.getSchemaItem<Enumeration>(result) as Enumeration;
    expect(testEnumeration.name).toBe("testEnumeration");
    const enumerator = testEnumeration.getEnumeratorByName("testEnumerator");
    expect(enumerator).toBeDefined();
    expect(enumerator?.value).toBe("test");
  });

  it("should add Enumerator to existing Enumeration.", async () => {
    const enumerator = { name: "testEnum", value: 1 };
    const enumResult  = await testEditor.enumerations.create(testKey, "testEnumeration", PrimitiveType.Integer);
    await testEditor.enumerations.addEnumerator(enumResult, enumerator);
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const testEnumeration = await schema?.getItem("testEnumeration") as Enumeration;
    const testEnum = testEnumeration.getEnumeratorByName("testEnum");
    expect(testEnum).toBeDefined();
    expect(testEnum?.value).toBe(1);
  });

  it("add Enumerator to a type that is not an enumeration, throws.", async () => {
    const enumerator = { name: "testEnum", value: 1 };
    const result  = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    await expect(testEditor.enumerations.addEnumerator(result, enumerator)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.AddEnumerator,
      innerError: {
        message: `Expected ${result.fullName} to be of type Enumeration.`,
        errorNumber: ECEditingStatus.InvalidSchemaItemType,
      },
    });
  });

  it("add string Enumerator to an enumeration of type number, throws.", async () => {
    const enumerator = { name: "testEnum", value: "one" };
    const result  = await testEditor.enumerations.create(testKey, "testEnumeration", PrimitiveType.Integer);
    await expect(testEditor.enumerations.addEnumerator(result, enumerator)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.AddEnumerator,
      innerError: {
        message: `The Enumeration ${result.fullName} has type int, while Enumerator testEnum has type string.`,
        errorNumber: ECEditingStatus.InvalidEnumeratorType,
      },
    });
  });

  it("add number Enumerator to an enumeration of type string, throws.", async () => {
    const enumerator = { name: "testEnum", value: 1 };
    const result  = await testEditor.enumerations.create(testKey, "testEnumeration", PrimitiveType.String);
    await expect(testEditor.enumerations.addEnumerator(result, enumerator)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.AddEnumerator,
      innerError: {
        message: `The Enumeration ${result.fullName} has type string, while Enumerator testEnum has type int.`,
        errorNumber: ECEditingStatus.InvalidEnumeratorType,
      },
    });
  });

  it("add string Enumerator to an enumeration that can't be found, throws.", async () => {
    const enumerator = { name: "testEnum", value: 1 };
    const badKey = new SchemaItemKey("badKey", testKey);
    await expect(testEditor.enumerations.addEnumerator(badKey, enumerator)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.AddEnumerator,
      innerError: {
        message: `Enumeration ${badKey.fullName} could not be found in the schema context.`,
        errorNumber: ECEditingStatus.SchemaItemNotFoundInContext,
      },
    });
  });
});
