/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SchemaContext, SchemaItemType, SchemaKey, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("UnitSystems tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
  });

  it("should create a valid UnitSystem from UnitSystemProps", async () => {
    const unitSystemProps = {
      name: "testUnitSystem",
      description: "test description",
      label: "testDec",
    };
    const result = await testEditor.unitSystems.createFromProps(testKey, unitSystemProps);
    const testUnitSystem = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as UnitSystem;
    expect(testUnitSystem.schemaItemType).to.eql(SchemaItemType.UnitSystem);
    expect(testUnitSystem.fullName).to.eql("testSchema.testUnitSystem");
    expect(testUnitSystem.label).to.eql("testDec");
  });
});
