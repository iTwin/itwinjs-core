/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CustomAttributeClass, CustomAttributeContainerType, ECVersion, SchemaContext, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";

describe("CustomAttribute tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
  });

  it("should create a new customAttribute Class", async () => {
    const customAttributeResult = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.Schema);
    expect(testEditor.schemaContext.getSchemaItemSync(customAttributeResult)?.name).to.eql("testCustomAttribute");
  });

  it("should delete a customAttribute class", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const customAttributeResult = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.Schema);
    const customAttribute = await schema?.getItem("testCustomAttribute");
    expect(testEditor.schemaContext.getSchemaItemSync(customAttributeResult)?.name).to.eql("testCustomAttribute");

    const key = customAttribute?.key as SchemaItemKey;
    await testEditor.customAttributes.delete(key);
    expect(testEditor.schemaContext.getSchemaItemSync(customAttributeResult)).to.be.undefined;
  });

  it("should add a base class to custom attribute class", async () => {
    const baseClassRes = await testEditor.customAttributes.create(testKey, "testBaseClass", CustomAttributeContainerType.AnyClass);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.AnyClass);

    await testEditor.customAttributes.setBaseClass(caRes,baseClassRes);

    const testCA = await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(caRes);
    expect(await testCA?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(baseClassRes));
  });

  it("should change custom attribute base class with class derived from", async () => {
    const baseClassRes = await testEditor.customAttributes.create(testKey, "testBaseClass", CustomAttributeContainerType.AnyProperty);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.AnyProperty, "testLabel",baseClassRes);
    const newBaseClassRes = await testEditor.customAttributes.create(testKey, "newBaseClass", CustomAttributeContainerType.AnyProperty, "newLabel",baseClassRes);

    const testCA = await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(caRes);
    expect(await testCA?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(baseClassRes));

    await testEditor.customAttributes.setBaseClass(caRes, newBaseClassRes);
    expect(await testCA?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(newBaseClassRes));
  });

  it("should remove a base class from custom attribute class", async () => {
    const baseClassRes = await testEditor.customAttributes.create(testKey, "testBaseClass", CustomAttributeContainerType.AnyRelationshipConstraint);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.AnyRelationshipConstraint, "testLabel",baseClassRes);

    const testCA = await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(caRes);
    expect(await testCA?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(baseClassRes));

    await testEditor.customAttributes.setBaseClass(caRes, undefined);
    expect(await testCA?.baseClass).to.eql(undefined);
  });

  it("should not be able to delete a customAttribute class if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testCustomAttribute";
    const key = schema?.schemaKey as SchemaKey;
    const classKey = new SchemaItemKey(className, key);
    const customAttribute = await schema?.getItem(className);
    expect(customAttribute).to.be.undefined;

    await testEditor.customAttributes.delete(classKey);
    expect(testEditor.schemaContext.getSchemaItemSync(classKey)).to.be.undefined;
  });

  it("try adding base class to custom attribute class with different SchemaItemType, returns error", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.NavigationProperty);
    await expect(testEditor.customAttributes.setBaseClass(caRes,baseClassRes)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.SetBaseClass);
      expect(error).to.have.nested.property("innerError.message", `Expected ${baseClassRes.fullName} to be of type CustomAttributeClass.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.InvalidSchemaItemType);
    });
  });

  it("try adding base class to a custom attribute class where the base class cannot be located, returns error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.PrimitiveProperty);
    await expect(testEditor.customAttributes.setBaseClass(caRes, baseClassKey)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.SetBaseClass);
      expect(error).to.have.nested.property("innerError.message", `CustomAttributeClass ${baseClassKey.fullName} could not be found in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNotFound);
    });
  });

  it("try adding base class to non-existing custom attribute class, returns error", async () => {
    const baseClassRes = await testEditor.customAttributes.create(testKey, "testBaseClass", CustomAttributeContainerType.RelationshipClass);
    const caKey =  new SchemaItemKey("testCustomAttribute", testKey);

    await expect(testEditor.customAttributes.setBaseClass(caKey,baseClassRes)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.SetBaseClass);
      expect(error).to.have.nested.property("innerError.message", `CustomAttributeClass ${caKey.fullName} could not be found in the schema context.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNotFoundInContext);
    });
  });

  it("try adding base class with unknown schema to existing custom attribute class, returns error", async () => {
    const schemaKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", schemaKey);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.StructProperty);

    await expect(testEditor.customAttributes.setBaseClass(caRes, baseClassKey)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.SetBaseClass);
      expect(error).to.have.nested.property("innerError.message", `Schema Key ${schemaKey.toString(true)} could not be found in the context.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaNotFound);
    });
  });

  it("try changing the custom attribute base class to one that doesn't derive from, returns error", async () => {
    const baseClassRes = await testEditor.customAttributes.create(testKey, "testBaseClass", CustomAttributeContainerType.TargetRelationshipConstraint);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.TargetRelationshipConstraint, "testLabel",baseClassRes);

    const testCA = await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(caRes);
    expect(await testCA?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(baseClassRes));

    const newBaseClassRes = await testEditor.customAttributes.create(testKey, "newBaseClass", CustomAttributeContainerType.TargetRelationshipConstraint);
    await expect(testEditor.customAttributes.setBaseClass(caRes, newBaseClassRes)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.SetBaseClass);
      expect(error).to.have.nested.property("innerError.message", `Base class ${newBaseClassRes.fullName} must derive from ${baseClassRes.fullName}.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.InvalidBaseClass);
    });
  });

  it("try creating custom attribute class to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    await expect(testEditor.customAttributes.create(badKey, "testCustomAttribute", CustomAttributeContainerType.StructProperty)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Schema Key ${badKey.toString(true)} could not be found in the context.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaNotFound);
    });
  });

  it("try creating custom attribute class with unknown base class, throws error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    await expect(testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.StructProperty, undefined, baseClassKey)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `CustomAttributeClass ${baseClassKey.fullName} could not be found in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNotFound);
    });
  });

  it("try creating custom attribute class with existing name, throws error", async () => {
    await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.StructProperty);
    await expect(testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.StructProperty)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `CustomAttributeClass testSchema.testCustomAttribute already exists in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNameAlreadyExists);
    });
  });
});
