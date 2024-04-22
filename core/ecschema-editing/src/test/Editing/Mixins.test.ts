/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECClassModifier, ECVersion, Mixin, NavigationProperty, NavigationPropertyProps, RelationshipClass, SchemaContext, SchemaItemKey, SchemaKey, StrengthDirection, StrengthType } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("Mixins tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  let entityKey: SchemaItemKey;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;

    const entityResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    entityKey = entityResult.itemKey!;
  });

  it("should create a new mixin", async () => {
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey);
    expect(testEditor.schemaContext.getSchemaItemSync(mixinResult.itemKey!)?.name).to.eql("testMixin");
  });

  it("should create a new navigation property from NavigationPropertyProps", async () => {
    const testMixinRes = await testEditor.mixins.create(testKey, "testMixin", entityKey);
    const testRelRes = await testEditor.relationships.create(testKey, "testRelationship", ECClassModifier.None, StrengthType.Embedding, StrengthDirection.Forward);
    const navProps: NavigationPropertyProps = {
      name: "testProperty",
      type: "NavigationProperty",
      relationshipName: "testSchema.testRelationship",
      direction: "Forward",
    };

    const mixin = await testEditor.schemaContext.getSchemaItem(testMixinRes.itemKey!) as Mixin;
    const relClass = await testEditor.schemaContext.getSchemaItem(testRelRes.itemKey!) as RelationshipClass;

    const result = await testEditor.mixins.createNavigationPropertyFromProps(mixin.key, navProps);
    const navProperty = await mixin.getProperty(result.propertyName!) as NavigationProperty;
    expect(await navProperty.relationshipClass).to.eql(relClass);
    expect(navProperty.direction).to.eql(StrengthDirection.Forward);
  });

  it("should delete a mixin", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testMixin";
    const mixinResult = await testEditor.mixins.create(testKey, className, entityKey);
    const mixin = await schema?.getItem(className);
    expect(mixin).not.undefined;

    const key = mixin?.key as SchemaItemKey;
    const delRes = await testEditor.mixins.delete(key);
    expect(delRes.itemKey).to.eql(mixinResult.itemKey);
    expect(testEditor.schemaContext.getSchemaItemSync(mixinResult.itemKey!)).to.be.undefined;
  });

  it("should not be able to delete a mixin if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testMixin";
    const key = schema?.schemaKey as SchemaKey;
    const classKey = new SchemaItemKey(className, key);
    const mixin = await schema?.getItem(className);
    expect(mixin).to.be.undefined;

    const delRes = await testEditor.mixins.delete(classKey);
    expect(delRes).to.eql({});
  });

  it("should add a mixin baseClass to a mixin item", async () => {
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey);

    const anotherEntityResult = await testEditor.entities.create(testKey, "anotherTestEntity", ECClassModifier.None);

    const mixinBaseClass  = await testEditor.mixins.create(testKey, "testMixinBaseClass", anotherEntityResult.itemKey!);
    const setResult = await testEditor.mixins.setBaseClass(mixinResult.itemKey!, mixinBaseClass.itemKey);

    const mixin = testEditor.schemaContext.getSchemaItemSync(mixinResult.itemKey!) as Mixin;

    expect(setResult.errorMessage).to.be.undefined;
    expect(mixin.baseClass?.fullName).to.deep.equal("testSchema.testMixinBaseClass");
  });

  it("should change the mixin base class with class from superset of existing base class", async () => {
    const baseClassRes = await testEditor.mixins.create(testKey, "testBaseClass", entityKey);
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey, "testLabel", baseClassRes.itemKey);

    const testMixin = await testEditor.schemaContext.getSchemaItem<Mixin>(mixinResult.itemKey!);
    expect(await testMixin?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(baseClassRes.itemKey!));

    const newBaseClassRes = await testEditor.mixins.create(testKey, "newBaseClass", entityKey, "newLabel", baseClassRes.itemKey);
    const result = await testEditor.mixins.setBaseClass(mixinResult.itemKey!, newBaseClassRes.itemKey);
    expect(result.errorMessage).to.be.undefined;
    expect(await testMixin?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(newBaseClassRes.itemKey!));
  });

  it("should remove the base class from the existing mixin", async () => {
    const baseClassRes = await testEditor.mixins.create(testKey, "testBaseClass", entityKey);
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey, "testLabel", baseClassRes.itemKey);

    const testMixin = await testEditor.schemaContext.getSchemaItem<Mixin>(mixinResult.itemKey!);
    expect(await testMixin?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(baseClassRes.itemKey!));

    const result = await testEditor.mixins.setBaseClass(mixinResult.itemKey!, undefined);
    expect(result.errorMessage).to.be.undefined;
    expect(await testMixin?.baseClass).to.eql(undefined);
  });

  it("should return error message because it tries to set base class that is not of mixin type", async () => {
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey);
    const setResult = await testEditor.mixins.setBaseClass(mixinResult.itemKey!, entityKey);

    expect(setResult).to.not.be.undefined;
    expect(setResult.errorMessage).to.not.be.undefined;
    expect(setResult.errorMessage).to.equal(`${entityKey.fullName} is not of type Mixin Class.`);
  });

  it("should return an error message when a base class cannot be found in the context", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const mixinRes = await testEditor.mixins.create(testKey, "testMixin", entityKey);
    const result = await testEditor.mixins.setBaseClass(mixinRes.itemKey!, baseClassKey);

    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Unable to locate base class ${baseClassKey.fullName} in schema ${testKey.name}.`);
  });

  it("adding a base class to a non-existing mixin should result in an error message", async () => {
    const baseClassRes = await testEditor.mixins.create(testKey, "testBaseClass", entityKey);
    const mixinKey =  new SchemaItemKey("testMixin", testKey);

    const result = await testEditor.mixins.setBaseClass(mixinKey, baseClassRes.itemKey);
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Mixin Class ${mixinKey.fullName} not found in schema context.`);
  });

  it("adding a base class with an unknown schema to mixin, should result in an error message", async () => {
    const schemaKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", schemaKey);
    const mixinRes = await testEditor.mixins.create(testKey, "testMixin", entityKey);

    const result = await testEditor.mixins.setBaseClass(mixinRes.itemKey!, baseClassKey);
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Schema Key ${schemaKey.toString(true)} not found in context`);
  });

  it("changing the mixin base class to one that doesn't derive from, should result in an error message", async () => {
    const baseClassRes = await testEditor.mixins.create(testKey, "testBaseClass", entityKey);
    const mixinRes = await testEditor.mixins.create(testKey, "testMixin", entityKey, "testLabel", baseClassRes.itemKey);

    const testMixin = await testEditor.schemaContext.getSchemaItem<Mixin>(mixinRes.itemKey!);
    expect(await testMixin?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<Mixin>(baseClassRes.itemKey!));

    const newBaseClassRes = await testEditor.mixins.create(testKey, "newBaseClass", entityKey);
    const result = await testEditor.mixins.setBaseClass(mixinRes.itemKey!, newBaseClassRes.itemKey);
    expect(result.errorMessage).to.be.not.undefined;
    expect(result.errorMessage).to.equal(`Baseclass ${newBaseClassRes.itemKey!.fullName} must derive from ${baseClassRes.itemKey!.fullName}.`);
  });
});
