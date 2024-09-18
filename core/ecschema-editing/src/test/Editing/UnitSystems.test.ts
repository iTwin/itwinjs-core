/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { ECVersion, SchemaContext, SchemaItemType, SchemaKey, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";

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
    expect(testUnitSystem.schemaItemType).toBe(SchemaItemType.UnitSystem);
    expect(testUnitSystem.fullName).toBe("testSchema.testUnitSystem");
    expect(testUnitSystem.label).toBe("testDec");
  });

  it("try creating UnitSystem to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1, 0, 0));
    await expect(testEditor.unitSystems.create(badKey, "testUnitSystem", "testDefinition")).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: expect.objectContaining({
        message: `Schema Key ${badKey.toString(true)} could not be found in the context.`,
        errorNumber: ECEditingStatus.SchemaNotFound,
      }),
    });
  });

  it("try creating UnitSystem with existing name, throws error", async () => {
    await testEditor.unitSystems.create(testKey, "testUnitSystem", "testDefinition");
    await expect(testEditor.unitSystems.create(testKey, "testUnitSystem", "testDefinition")).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: expect.objectContaining({
        message: `UnitSystem testSchema.testUnitSystem already exists in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNameAlreadyExists,
      }),
    });
  });
});
