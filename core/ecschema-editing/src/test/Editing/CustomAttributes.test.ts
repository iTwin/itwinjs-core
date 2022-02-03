/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { SchemaKey } from "@itwin/ecschema-metadata";
import { CustomAttributeContainerType, SchemaContext, SchemaItemKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("CustomAttribute tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
  });

  it("should create a new customAttribute Class", async () => {
    const customAttributeResult = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.Schema);
    expect(testEditor.schemaContext.getSchemaItemSync(customAttributeResult.itemKey!)?.name).to.eql("testCustomAttribute");
  });

  it("should delete a customAttribute class", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const customAttributeResult = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.Schema);
    const customAttribute = await schema?.getItem("testCustomAttribute");
    expect(testEditor.schemaContext.getSchemaItemSync(customAttributeResult.itemKey!)?.name).to.eql("testCustomAttribute");

    const key = customAttribute?.key as SchemaItemKey;
    const delRes = await testEditor.customAttributes.delete(key);
    expect(delRes.itemKey).to.eql(customAttributeResult.itemKey);

    expect(testEditor.schemaContext.getSchemaItemSync(customAttributeResult.itemKey!)).to.be.undefined;
  });

  it("should not be able to delete a customAttribute class if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testCustomAttribute";
    const key = schema?.schemaKey as SchemaKey;
    const classKey = new SchemaItemKey(className, key);
    const customAttribute = await schema?.getItem(className);
    expect(customAttribute).to.be.undefined;

    const delRes = await testEditor.customAttributes.delete(classKey);
    expect(delRes).to.eql({});
  });
});
