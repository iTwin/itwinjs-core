/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SchemaContext, SchemaKey } from "@bentley/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("Structs tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
  });

  it("should create a new struct Class", async () => {
    const structResult = await testEditor.structs.create(testKey, "testStruct");
    expect(testEditor.schemaContext.getSchemaItemSync(structResult.itemKey!)?.name).to.eql("testStruct");
  });

  it("should delete a struct class", async () => {
    const structResult = await testEditor.structs.create(testKey, "testStruct");
    expect(testEditor.schemaContext.getSchemaItemSync(structResult.itemKey!)?.name).to.eql("testStruct");

    const delRes = await testEditor.structs.delete(testKey, "testStruct");
    expect(delRes.itemKey).to.eql(structResult.itemKey);

    expect(testEditor.schemaContext.getSchemaItemSync(structResult.itemKey!)).to.be.undefined;
  });

  it("should not be able to delete a struct class if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testStruct";
    const struct = await schema?.getItem(className);
    expect(struct).to.be.undefined;

    const delRes = await testEditor.structs.delete(testKey, className);
    expect(delRes.errorMessage).to.eql(`Failed to delete class ${className} because it was not found in schema ${schema!.name}`);
  });
});
