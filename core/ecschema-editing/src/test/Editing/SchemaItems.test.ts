import { SchemaContext, SchemaItemKey, SchemaKey, UnitSystem } from "@itwin/ecschema-metadata";
import { expect } from "chai";
import { SchemaContextEditor } from "../../ecschema-editing";
import { ECEditingStatus } from "../../Editing/Exception";
import { SchemaEditType } from "../../Editing/SchemaEditType";

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
    expect(item.description).to.eql(undefined);
    await testEditor.unitSystems.setDescription(key, "test description");
    expect(item.description).to.eql("test description");
  });

  it("should successfully set SchemaItem displayLabel", async () => {
    const key = await testEditor.unitSystems.create(testKey, "TestUnitSystem");
    const item = await testEditor.schemaContext.getSchemaItem<UnitSystem>(key) as UnitSystem;
    expect(item.label).to.eql(undefined);
    await testEditor.unitSystems.setDisplayLabel(key, "TestLabel");
    expect(item.label).to.eql("TestLabel");
  });

  it("try setting description to unknown SchemaItem, returns error", async () => {
    const unknownKey = new SchemaItemKey("testUnitSystem", testKey);

    await expect(testEditor.unitSystems.setDescription(unknownKey, "test description")).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("schemaEditType", SchemaEditType.SetDescription);
      expect(error).to.have.nested.property("innerError.message", `UnitSystem ${unknownKey.fullName} could not be found in the schema context.`);
      expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaItemNotFoundInContext);
    });
  });

  it("try setting label to unknown SchemaItem, returns error", async () => {
    const unknownKey = new SchemaItemKey("testUnitSystem", testKey);

    await expect(testEditor.unitSystems.setDisplayLabel(unknownKey, "label")).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("schemaEditType", SchemaEditType.SetLabel);
      expect(error).to.have.nested.property("innerError.message", `UnitSystem ${unknownKey.fullName} could not be found in the schema context.`);
      expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaItemNotFoundInContext);
    });
  });
});
