/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { ECVersion, PropertyCategory, SchemaContext, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";

describe("Property Category tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
  });

  it("should create a valid PropertyCategory", async () => {
    const result = await testEditor.propertyCategories.create(testKey, "testPropCategory", 5);
    const testPropCategory = await testEditor.schemaContext.getSchemaItem(result) as PropertyCategory;
    expect(testPropCategory.priority).toBe(5);
    expect(testPropCategory.schemaItemType).toBe(SchemaItemType.PropertyCategory);
  });

  it("should create a valid Property Category from props", async () => {
    const propCatProps = {
      name: "testPropCategory",
      label: "testLbl",
      priority: 9,
    };
    const result = await testEditor.propertyCategories.createFromProps(testKey, propCatProps);
    const testPropCategory = await testEditor.schemaContext.getSchemaItem(result) as PropertyCategory;
    expect(testPropCategory.priority).toBe(9);
    expect(testPropCategory.label).toBe("testLbl");
    expect(testPropCategory.schemaItemType).toBe(SchemaItemType.PropertyCategory);
  });

  it("try creating PropertyCategory to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    await expect(testEditor.propertyCategories.create(badKey, "testPropCategory", 5)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: expect.objectContaining({
        message: `Schema Key ${badKey.toString(true)} could not be found in the context.`,
        errorNumber: ECEditingStatus.SchemaNotFound,
      }),
    });
  });

  it("try creating PropertyCategory with existing name, throws error", async () => {
    await testEditor.propertyCategories.create(testKey, "testPropCategory", 5);
    await expect(testEditor.propertyCategories.create(testKey, "testPropCategory", 5)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: expect.objectContaining({
        message: `PropertyCategory testSchema.testPropCategory already exists in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNameAlreadyExists,
      }),
    });
  });
});
