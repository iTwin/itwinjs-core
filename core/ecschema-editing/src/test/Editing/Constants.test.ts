import { expect } from "chai";
import { SchemaContextEditor } from "../../Editing/Editor";
import { Constant, ConstantProps, ECVersion, SchemaContext, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { ECEditingStatus } from "../../Editing/Exception";

describe("Constant tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  let phenomenonKey: SchemaItemKey;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    const phenomRes = await testEditor.phenomenons.create(testKey, "testPhenomenon", "testDefinition");
    phenomenonKey = phenomRes;
  });

  it("should create a valid Constant from ConstantProps", async () => {
    const constantProps: ConstantProps = {
      name: "testConstant",
      phenomenon: phenomenonKey.fullName,
      definition: "testDefinition",
    };

    const result = await testEditor.constants.createFromProps(testKey, constantProps);
    const constant = await testEditor.schemaContext.getSchemaItem(result) as Constant;
    expect(constant.fullName).to.eql("testSchema.testConstant");
    expect(await constant.phenomenon).to.eql(await testEditor.schemaContext.getSchemaItem(phenomenonKey));
    expect(constant.definition).to.eql("testDefinition");
  });

  it("should create a valid Constant", async () => {
    const result = await testEditor.constants.create(testKey, "testConstant", phenomenonKey, "testDefinition");
    const constant = await testEditor.schemaContext.getSchemaItem(result) as Constant;
    expect(constant.fullName).to.eql("testSchema.testConstant");
    expect(await constant.phenomenon).to.eql(await testEditor.schemaContext.getSchemaItem(phenomenonKey));
    expect(constant.definition).to.eql("testDefinition");
  });

  it("try creating Constant to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    await expect(testEditor.constants.create(badKey, "testConstant", phenomenonKey, "testDefinition")).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Schema Key ${badKey.toString(true)} could not be found in the context.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaNotFound);
    });
  });

  it("try creating Constant with existing name, throws error", async () => {
    await testEditor.constants.create(testKey, "testConstant", phenomenonKey, "testDefinition");
    await expect(testEditor.constants.create(testKey, "testConstant", phenomenonKey, "testDefinition")).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Constant testSchema.testConstant already exists in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNameAlreadyExists);
    });
  });
});
