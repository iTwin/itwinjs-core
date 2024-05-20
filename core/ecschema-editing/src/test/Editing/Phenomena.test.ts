/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECVersion, Phenomenon, SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

// TODO: Must add phenomenon and Unit system tests before you can do this.
describe("Phenomenons tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
  });

  it("should create a valid phenomenon", async () => {
    const result = await testEditor.phenomenons.create(testKey, "testPhenomenon", "Units.LENGTH(2)");
    const phenomenon = await testEditor.schemaContext.getSchemaItem(result) as Phenomenon;
    expect(phenomenon.definition).to.eql("Units.LENGTH(2)");
  });

  it("should create a valid phenomenon from PhenomenonProps", async () => {
    const phenomenonProps = {
      name: "testPhenomenon",
      description: "test description",
      definition: "Units.LENGTH(2)",
    };
    const result = await testEditor.phenomenons.createFromProps(testKey, phenomenonProps);
    const phenomenon = await testEditor.schemaContext.getSchemaItem(result) as Phenomenon;
    expect(phenomenon.description).to.eql("test description");
    expect(phenomenon.definition).to.eql("Units.LENGTH(2)");
    expect(phenomenon.fullName).to.eql("testSchema.testPhenomenon");
  });

  it("try creating Phenomenon class to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    await expect(testEditor.phenomenons.create(badKey, "testPhenomenon", "Units.LENGTH(2)")).to.be.rejectedWith(Error, `Schema Key ${badKey.toString(true)} not found in context`);;
  });

  it("try creating Phenomenon with existing name, throws error", async () => {
    await testEditor.phenomenons.create(testKey, "testPhenomenon", "Units.LENGTH(2)");
    await expect(testEditor.phenomenons.create(testKey, "testPhenomenon", "Units.LENGTH(2)")).to.be.rejectedWith(Error, `Phenomenon testPhenomenon already exists in the schema ${testKey.name}.`);
  });
});
