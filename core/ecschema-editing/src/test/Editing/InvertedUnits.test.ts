/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECVersion, InvertedUnit, SchemaContext, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

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
    await expect(testEditor.invertedUnits.create(badKey, "testInvertedUnit", invertsUnitKey, unitSystemKey)).to.be.rejectedWith(Error, `Schema Key ${badKey.toString(true)} not found in context`);;
  });

  it("try creating InvertedUnit with existing name, throws error", async () => {
    await testEditor.invertedUnits.create(testKey, "testInvertedUnit", invertsUnitKey, unitSystemKey);
    await expect(testEditor.invertedUnits.create(testKey, "testInvertedUnit", invertsUnitKey, unitSystemKey)).to.be.rejectedWith(Error, `InvertedUnit testInvertedUnit already exists in the schema ${testKey.name}.`);
  });
});
