/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECVersion, SchemaContext, SchemaItemType, SchemaKey, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";
import { SchemaEditType } from "../../Editing/SchmaEditType";

describe("UnitSystems tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
  });

  it("should create a valid UnitSystem from UnitSystemProps", async () => {
    const unitSystemProps = {
      name: "testUnitSystem",
      description: "test description",
      label: "testDec",
    };
    const result = await testEditor.unitSystems.createFromProps(testKey, unitSystemProps);
    const testUnitSystem = await testEditor.schemaContext.getSchemaItem(result) as UnitSystem;
    expect(testUnitSystem.schemaItemType).to.eql(SchemaItemType.UnitSystem);
    expect(testUnitSystem.fullName).to.eql("testSchema.testUnitSystem");
    expect(testUnitSystem.label).to.eql("testDec");
  });

  it("try creating Unit to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1, 0, 0));
    await expect(testEditor.unitSystems.create(badKey, "testUnitSystem", "testDefinition")).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("schemaEditType", SchemaEditType.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Schema Key ${badKey.toString(true)} could not be found in the context.`);
      expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaNotFound);
    });
  });

  it("try creating Unit with existing name, throws error", async () => {
    await testEditor.unitSystems.create(testKey, "testUnitSystem", "testDefinition");
    await expect(testEditor.unitSystems.create(testKey, "testUnitSystem", "testDefinition")).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("schemaEditType", SchemaEditType.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `UnitSystem testSchema.testUnitSystem already exists in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaItemNameAlreadyExists);
    });
  });
});
