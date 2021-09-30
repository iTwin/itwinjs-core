/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { InvertedUnit, SchemaContext, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
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
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
    unitSystemKey = (await testEditor.unitSystems.create(testKey, "testUnitSystem")).itemKey!;
    const phenomenonKey = (await testEditor.phenomenons.create(testKey, "testPhenomenon", "testDefinition")).itemKey!;
    invertsUnitKey = (await testEditor.units.create(testKey, "testUnit", "testDefinition", phenomenonKey, unitSystemKey)).itemKey!;
  });

  it("should create a valid Inverted Unit", async () => {
    const result = await testEditor.invertedUnits.create(testKey, "testInvertedUnit", invertsUnitKey, unitSystemKey);
    const invertedUnit = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as InvertedUnit;

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
    const invertedUnit = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as InvertedUnit;

    expect(await invertedUnit.invertsUnit).to.eql(await testEditor.schemaContext.getSchemaItem(invertsUnitKey));
    expect(invertedUnit.fullName).to.eql("testSchema.testInvertedUnit");
  });
});
