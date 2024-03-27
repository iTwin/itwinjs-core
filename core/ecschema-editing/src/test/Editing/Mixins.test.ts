/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECClassModifier, Mixin, NavigationProperty, NavigationPropertyProps, RelationshipClass, SchemaContext, SchemaItemKey, SchemaKey, StrengthDirection, StrengthType } from "@itwin/ecschema-metadata";
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
    const setResult = await testEditor.mixins.setMixinBaseClass(mixinResult.itemKey!, mixinBaseClass.itemKey);

    const mixin = testEditor.schemaContext.getSchemaItemSync(mixinResult.itemKey!) as Mixin;

    expect(setResult.errorMessage).to.be.undefined;
    expect(mixin.baseClass?.fullName).to.deep.equal("testSchema.testMixinBaseClass");
  });

  it("should return error message because it tries to set base class that is not of mixin type", async () => {
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey);
    const setResult = await testEditor.mixins.setMixinBaseClass(mixinResult.itemKey!, entityKey);

    expect(setResult).to.not.be.undefined;
    expect(setResult.errorMessage).to.not.be.undefined;
    expect(setResult.errorMessage).to.equal(`${entityKey.fullName} is not of type Mixin Class.`);
  });
});
