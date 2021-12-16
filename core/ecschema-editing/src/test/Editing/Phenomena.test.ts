/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Phenomenon, SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

// TODO: Must add phenomenon and Unit system tests before you can do this.
describe("Phenomenons tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
  });

  it("should create a valid phenomenon", async () => {
    const result = await testEditor.phenomenons.create(testKey, "testPhenomenon", "Units.LENGTH(2)");
    const phenomenon = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as Phenomenon;
    expect(phenomenon.definition).to.eql("Units.LENGTH(2)");
  });

  it("should create a valid phenomenon from PhenomenonProps", async () => {
    const phenomenonProps = {
      name: "testPhenomenon",
      description: "test description",
      definition: "Units.LENGTH(2)",
    };
    const result = await testEditor.phenomenons.createFromProps(testKey, phenomenonProps);
    const phenomenon = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as Phenomenon;
    expect(phenomenon.description).to.eql("test description");
    expect(phenomenon.definition).to.eql("Units.LENGTH(2)");
    expect(phenomenon.fullName).to.eql("testSchema.testPhenomenon");
  });
});
