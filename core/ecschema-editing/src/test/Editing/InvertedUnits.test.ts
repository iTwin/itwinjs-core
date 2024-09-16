/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { ECVersion, InvertedUnit, SchemaContext, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";

describe("Inverted Units tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  let invertsUnitKey: SchemaItemKey;
  let unitSystemKey: SchemaItemKey;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    unitSystemKey = (await testEditor.unitSystems.create(testKey, "testUnitSystem"));
    const phenomenonKey = (await testEditor.phenomenons.create(testKey, "testPhenomenon", "testDefinition"));
    invertsUnitKey = (await testEditor.units.create(testKey, "testUnit", "testDefinition", phenomenonKey, unitSystemKey));
  });

  it("should create a valid Inverted Unit", async () => {
    const result = await testEditor.invertedUnits.create(testKey, "testInvertedUnit", invertsUnitKey, unitSystemKey);
    const invertedUnit = await testEditor.schemaContext.getSchemaItem(result) as InvertedUnit;

    expect(await invertedUnit.invertsUnit).to.eql(await testEditor.schemaContext.getSchemaItem(invertsUnitKey));
    expect(invertedUnit.fullName).to.eql("testSchema.testInvertedUnit");
  });

  it("should create a valid Inverted Unit from props", async () => {
    const invertedUnitProps = {
      name: "testInvertedUnit",
      description: "A random Inverted Unit",
      invertsUnit: invertsUnitKey.fullName,
      unitSystem: unitSystemKey.fullName,
    };

    const result = await testEditor.invertedUnits.createFromProps(testKey, invertedUnitProps);
    const invertedUnit = await testEditor.schemaContext.getSchemaItem(result) as InvertedUnit;

    expect(await invertedUnit.invertsUnit).to.eql(await testEditor.schemaContext.getSchemaItem(invertsUnitKey));
    expect(invertedUnit.fullName).to.eql("testSchema.testInvertedUnit");
  });

  it("try creating InvertedUnit in unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    await expect(testEditor.invertedUnits.create(badKey, "testInvertedUnit", invertsUnitKey, unitSystemKey)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Schema Key ${badKey.toString(true)} could not be found in the context.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaNotFound);
    });
  });

  it("try creating InvertedUnit with existing name, throws error", async () => {
    await testEditor.invertedUnits.create(testKey, "testInvertedUnit", invertsUnitKey, unitSystemKey);
    await expect(testEditor.invertedUnits.create(testKey, "testInvertedUnit", invertsUnitKey, unitSystemKey)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `InvertedUnit testSchema.testInvertedUnit already exists in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNameAlreadyExists);
    });
  });

  it("try creating InvertedUnit with unknown invertsUnit, throws error", async () => {
    const badKey = new SchemaItemKey("unknownInvertsUnit", testKey);
    await expect(testEditor.invertedUnits.create(testKey, "testInvertedUnit", badKey, unitSystemKey)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Unit ${badKey.fullName} could not be found in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNotFound);
    });
  });

  it("try creating InvertedUnit with unknown unitSystem, throws error", async () => {
    const badKey = new SchemaItemKey("unknownUnitSystem", testKey);
    await expect(testEditor.invertedUnits.create(testKey, "testInvertedUnit", invertsUnitKey, badKey)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `UnitSystem ${badKey.fullName} could not be found in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNotFound);
    });
  });
});
