/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { SchemaItemKey, SchemaKey, Unit } from "@itwin/ecschema-metadata";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("Units tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  let phenomenonKey: SchemaItemKey;
  let unitSystemKey: SchemaItemKey;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;

    const phenomRes = await testEditor.phenomenons.create(testKey, "testPhenomenon", "testDefinition");
    const unitSystemRes = await testEditor.unitSystems.create(testKey, "testUnitSystem");
    phenomenonKey = phenomRes.itemKey!;
    unitSystemKey = unitSystemRes.itemKey!;
  });

  it("should create a valid Unit given a unit system and a phenomenon", async () => {
    const unitRes = await testEditor.units.create(testKey, "testUnit", "testDefinition", phenomenonKey, unitSystemKey);
    const unit = await testEditor.schemaContext.getSchemaItem(unitRes.itemKey!) as Unit;

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
    const unit = await testEditor.schemaContext.getSchemaItem(unitRes.itemKey!) as Unit;

    expect(unit.fullName).to.eql("testSchema.testUnit");
    expect(unit.numerator).to.eql(20.5);
    expect(await unit.phenomenon).to.eql(await testEditor.schemaContext.getSchemaItem(phenomenonKey));
  });
});
