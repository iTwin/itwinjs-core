/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECClassModifier, SchemaContext, SchemaItemKey, SchemaKey } from "@bentley/ecschema-metadata";
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
});