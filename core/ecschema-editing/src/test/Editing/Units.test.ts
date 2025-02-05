/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECVersion, SchemaContext, SchemaItemKey, SchemaKey, Unit } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";
import { SchemaEditType } from "../../Editing/SchemaEditType";

describe("Units tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  let phenomenonKey: SchemaItemKey;
  let unitSystemKey: SchemaItemKey;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);

    phenomenonKey = await testEditor.phenomenons.create(testKey, "testPhenomenon", "testDefinition");
    unitSystemKey = await testEditor.unitSystems.create(testKey, "testUnitSystem");
  });

  it("should create a valid Unit given a unit system and a phenomenon", async () => {
    const unitRes = await testEditor.units.create(testKey, "testUnit", "testDefinition", phenomenonKey, unitSystemKey);
    const unit = await testEditor.schemaContext.getSchemaItem(unitRes) as Unit;

    expect(unit.fullName).to.eql("testSchema.testUnit");
    expect(await unit.phenomenon).to.eql(await testEditor.schemaContext.getSchemaItem(phenomenonKey));
  });

  it("should create a valid Unit given a UnitProps", async () => {
    const unitProps = {
      name: "testUnit",
      numerator: 20.5,
      phenomenon: phenomenonKey.fullName,
      unitSystem: unitSystemKey.fullName,
      definition: "testDefinition",
    };
    const unitRes = await testEditor.units.createFromProps(testKey, unitProps);
    const unit = await testEditor.schemaContext.getSchemaItem(unitRes) as Unit;

    expect(unit.fullName).to.eql("testSchema.testUnit");
    expect(unit.numerator).to.eql(20.5);
    expect(await unit.phenomenon).to.eql(await testEditor.schemaContext.getSchemaItem(phenomenonKey));
  });

  it("try creating Unit to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1, 0, 0));
    await expect(testEditor.units.create(badKey, "testUnit", "testDefinition", phenomenonKey, unitSystemKey)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("schemaEditType", SchemaEditType.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Schema Key ${badKey.toString(true)} could not be found in the context.`);
      expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaNotFound);
    });
  });

  it("try creating Unit with existing name, throws error", async () => {
    await testEditor.units.create(testKey, "testUnit", "testDefinition", phenomenonKey, unitSystemKey);
    await expect(testEditor.units.create(testKey, "testUnit", "testDefinition", phenomenonKey, unitSystemKey)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("schemaEditType", SchemaEditType.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Unit testSchema.testUnit already exists in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaItemNameAlreadyExists);
    });
  });
});
