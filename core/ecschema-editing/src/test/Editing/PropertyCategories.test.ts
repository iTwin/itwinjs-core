/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
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
    expect(testPropCategory.priority).to.eql(5);
    expect(testPropCategory.schemaItemType).to.eql(SchemaItemType.PropertyCategory);
  });

  it("should create a valid Property Category from props", async () => {
    const propCatProps = {
      name: "testPropCategory",
      label: "testLbl",
      priority: 9,
    };
    const result = await testEditor.propertyCategories.createFromProps(testKey, propCatProps);
    const testPropCategory = await testEditor.schemaContext.getSchemaItem(result) as PropertyCategory;
    expect(testPropCategory.priority).to.eql(9);
    expect(testPropCategory.label).to.eql("testLbl");
    expect(testPropCategory.schemaItemType).to.eql(SchemaItemType.PropertyCategory);
  });

  it("try creating PropertyCategory to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    await expect(testEditor.propertyCategories.create(badKey, "testPropCategory", 5)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Schema Key ${badKey.toString(true)} could not be found in the context.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaNotFound);
    });
  });

  it("try creating PropertyCategory with existing name, throws error", async () => {
    await testEditor.propertyCategories.create(testKey, "testPropCategory", 5);
    await expect(testEditor.propertyCategories.create(testKey, "testPropCategory", 5)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `PropertyCategory testSchema.testPropCategory already exists in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNameAlreadyExists);
    });
  });
});
