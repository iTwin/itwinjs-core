import { SchemaContext, SchemaItemKey, SchemaKey, UnitSystem } from "@itwin/ecschema-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { SchemaContextEditor } from "../../ecschema-editing";
import { ECEditingStatus } from "../../Editing/Exception";

describe("Properties editing tests", () => {
  // Uses an entity class to create properties.
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("TestSchema", "test", 1, 0, 0);
  });

  it("should successfully set SchemaItem description", async () => {
    const key = await testEditor.unitSystems.create(testKey, "TestUnitSystem");
    const item = await testEditor.schemaContext.getSchemaItem<UnitSystem>(key) as UnitSystem;
    expect(item?.description).toBeUndefined();
    await testEditor.unitSystems.setDescription(key, "test description");
    expect(item?.description).toBe("test description");
  });

  it("should successfully set SchemaItem displayLabel", async () => {
    const key = await testEditor.unitSystems.create(testKey, "TestUnitSystem");
    const item = await testEditor.schemaContext.getSchemaItem<UnitSystem>(key) as UnitSystem;
    expect(item?.label).toBeUndefined();
    await testEditor.unitSystems.setDisplayLabel(key, "TestLabel");
    expect(item?.label).toBe("TestLabel");
  });

  it("try setting description to unknown SchemaItem, returns error", async () => {
    const unknownKey = new SchemaItemKey("testUnitSystem", testKey);

    await expect(testEditor.unitSystems.setDescription(unknownKey, "test description")).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetDescription,
      innerError: {
        message: `UnitSystem ${unknownKey.fullName} could not be found in the schema context.`,
        errorNumber: ECEditingStatus.SchemaItemNotFoundInContext,
      },
    });
  });
  it("try setting label to unknown SchemaItem, returns error", async () => {
    const unknownKey = new SchemaItemKey("testUnitSystem", testKey);

    await expect(testEditor.unitSystems.setDisplayLabel(unknownKey, "label")).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetLabel,
      innerError: {
        message: `UnitSystem ${unknownKey.fullName} could not be found in the schema context.`,
        errorNumber: ECEditingStatus.SchemaItemNotFoundInContext,
      },
    });
  });
});
