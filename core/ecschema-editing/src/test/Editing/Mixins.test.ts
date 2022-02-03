/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { SchemaKey } from "@itwin/ecschema-metadata";
import { ECClassModifier, SchemaContext, SchemaItemKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("Mixins tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  let entityKey: SchemaItemKey;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;

    const entityResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    entityKey = entityResult.itemKey!;
  });

  it("should create a new mixin", async () => {
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey);
    expect(testEditor.schemaContext.getSchemaItemSync(mixinResult.itemKey!)?.name).to.eql("testMixin");
  });

  it("should delete a mixin", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testMixin";
    const mixinResult = await testEditor.mixins.create(testKey, className, entityKey);
    const mixin = await schema?.getItem(className);
    expect(mixin).not.undefined;

    const key = mixin?.key as SchemaItemKey;
    const delRes = await testEditor.mixins.delete(key);
    expect(delRes.itemKey).to.eql(mixinResult.itemKey);
    expect(testEditor.schemaContext.getSchemaItemSync(mixinResult.itemKey!)).to.be.undefined;
  });

  it("should not be able to delete a mixin if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testMixin";
    const key = schema?.schemaKey as SchemaKey;
    const classKey = new SchemaItemKey(className, key);
    const mixin = await schema?.getItem(className);
    expect(mixin).to.be.undefined;

    const delRes = await testEditor.mixins.delete(classKey);
    expect(delRes).to.eql({});
  });
});
