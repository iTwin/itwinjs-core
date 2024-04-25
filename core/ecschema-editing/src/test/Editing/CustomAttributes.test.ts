/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CustomAttributeClass, CustomAttributeContainerType, ECVersion, SchemaContext, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("CustomAttribute tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
  });

  it("should create a new customAttribute Class", async () => {
    const customAttributeResult = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.Schema);
    expect(testEditor.schemaContext.getSchemaItemSync(customAttributeResult.itemKey!)?.name).to.eql("testCustomAttribute");
  });

  it("should delete a customAttribute class", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const customAttributeResult = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.Schema);
    const customAttribute = await schema?.getItem("testCustomAttribute");
    expect(testEditor.schemaContext.getSchemaItemSync(customAttributeResult.itemKey!)?.name).to.eql("testCustomAttribute");

    const key = customAttribute?.key as SchemaItemKey;
    const delRes = await testEditor.customAttributes.delete(key);
    expect(delRes.itemKey).to.eql(customAttributeResult.itemKey);

    expect(testEditor.schemaContext.getSchemaItemSync(customAttributeResult.itemKey!)).to.be.undefined;
  });

  it("should add a base class to custom attribute class", async () => {
    const baseClassRes = await testEditor.customAttributes.create(testKey, "testBaseClass", CustomAttributeContainerType.AnyClass);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.AnyClass);

    const result = await testEditor.customAttributes.setBaseClass(caRes.itemKey!, baseClassRes.itemKey);
    expect(result.errorMessage).to.be.undefined;

    const testCA = await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(caRes.itemKey!);
    expect(await testCA?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(baseClassRes.itemKey!));
  });

  it("should change custom attribute base class with class derived from", async () => {
    const baseClassRes = await testEditor.customAttributes.create(testKey, "testBaseClass", CustomAttributeContainerType.AnyProperty);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.AnyProperty, "testLabel", baseClassRes.itemKey);
    const newBaseClassRes = await testEditor.customAttributes.create(testKey, "newBaseClass", CustomAttributeContainerType.AnyProperty, "newLabel", baseClassRes.itemKey);

    const testCA = await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(caRes.itemKey!);
    expect(await testCA?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(baseClassRes.itemKey!));

    const result = await testEditor.customAttributes.setBaseClass(caRes.itemKey!, newBaseClassRes.itemKey);
    expect(result.errorMessage).to.be.undefined;
    expect(await testCA?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(newBaseClassRes.itemKey!));
  });

  it("should remove a base class from custom attribute class", async () => {
    const baseClassRes = await testEditor.customAttributes.create(testKey, "testBaseClass", CustomAttributeContainerType.AnyRelationshipConstraint);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.AnyRelationshipConstraint, "testLabel", baseClassRes.itemKey);

    const testCA = await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(caRes.itemKey!);
    expect(await testCA?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(baseClassRes.itemKey!));

    const result = await testEditor.customAttributes.setBaseClass(caRes.itemKey!, undefined);
    expect(result.errorMessage).to.be.undefined;
    expect(await testCA?.baseClass).to.eql(undefined);
  });

  it("should not be able to delete a customAttribute class if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testCustomAttribute";
    const key = schema?.schemaKey as SchemaKey;
    const classKey = new SchemaItemKey(className, key);
    const customAttribute = await schema?.getItem(className);
    expect(customAttribute).to.be.undefined;

    const delRes = await testEditor.customAttributes.delete(classKey);
    expect(delRes).to.eql({});
  });

  it("try adding base class to custom attribute class with different SchemaItemType, returns error", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.NavigationProperty);
    const result = await testEditor.customAttributes.setBaseClass(caRes.itemKey!, baseClassRes.itemKey);

    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`${baseClassRes.itemKey?.fullName} is not of type CustomAttributeClass.`);
  });

  it("try adding base class to a custom attribute class where the base class cannot be located, returns error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.PrimitiveProperty);
    const result = await testEditor.customAttributes.setBaseClass(caRes.itemKey!, baseClassKey);

    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Unable to locate base class ${baseClassKey.fullName} in schema ${testKey.name}.`);
  });

  it("try adding base class to non-existing custom attribute class, returns error", async () => {
    const baseClassRes = await testEditor.customAttributes.create(testKey, "testBaseClass", CustomAttributeContainerType.RelationshipClass);
    const caKey =  new SchemaItemKey("testCustomAttribute", testKey);

    const result = await testEditor.customAttributes.setBaseClass(caKey, baseClassRes.itemKey);
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Class ${caKey.fullName} not found in schema context.`);
  });

  it("try adding base class with unknown schema to existing custom attribute class, returns error", async () => {
    const schemaKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", schemaKey);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.StructProperty);

    const result = await testEditor.customAttributes.setBaseClass(caRes.itemKey!, baseClassKey);
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Schema Key ${schemaKey.toString(true)} not found in context`);
  });

  it("try changing the custom attribute base class to one that doesn't derive from, returns error", async () => {
    const baseClassRes = await testEditor.customAttributes.create(testKey, "testBaseClass", CustomAttributeContainerType.TargetRelationshipConstraint);
    const caRes = await testEditor.customAttributes.create(testKey, "testCustomAttribute", CustomAttributeContainerType.TargetRelationshipConstraint, "testLabel", baseClassRes.itemKey);

    const testCA = await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(caRes.itemKey!);
    expect(await testCA?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<CustomAttributeClass>(baseClassRes.itemKey!));

    const newBaseClassRes = await testEditor.customAttributes.create(testKey, "newBaseClass", CustomAttributeContainerType.TargetRelationshipConstraint);
    const result = await testEditor.customAttributes.setBaseClass(caRes.itemKey!, newBaseClassRes.itemKey);
    expect(result.errorMessage).to.be.not.undefined;
    expect(result.errorMessage).to.equal(`Baseclass ${newBaseClassRes.itemKey!.fullName} must derive from ${baseClassRes.itemKey!.fullName}.`);
  });
});
