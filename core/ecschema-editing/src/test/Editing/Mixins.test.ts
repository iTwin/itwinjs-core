/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { ECClassModifier, ECVersion, Mixin, NavigationProperty, NavigationPropertyProps, RelationshipClass, SchemaContext, SchemaItemKey, SchemaKey, StrengthDirection, StrengthType } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";

describe("Mixins tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  let entityKey: SchemaItemKey;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);

    const entityResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    entityKey = entityResult;
  });

  it("should create a new mixin", async () => {
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey);
    expect(testEditor.schemaContext.getSchemaItemSync(mixinResult)?.name).toEqual("testMixin");
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

    const mixin = await testEditor.schemaContext.getSchemaItem(testMixinRes) as Mixin;
    const relClass = await testEditor.schemaContext.getSchemaItem(testRelRes) as RelationshipClass;

    await testEditor.mixins.createNavigationPropertyFromProps(mixin.key, navProps);
    const navProperty = await mixin.getProperty("testProperty") as NavigationProperty;
    expect(await navProperty.relationshipClass).toEqual(relClass);
    expect(navProperty.direction).toEqual(StrengthDirection.Forward);
  });

  it("should delete a mixin", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testMixin";
    const mixinResult = await testEditor.mixins.create(testKey, className, entityKey);
    const mixin = await schema?.getItem(className);
    expect(mixin).not.undefined;

    const key = mixin?.key as SchemaItemKey;
    await testEditor.mixins.delete(key);
    expect(testEditor.schemaContext.getSchemaItemSync(mixinResult)).toBeUndefined();
  });

  it("should not be able to delete a mixin if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testMixin";
    const key = schema?.schemaKey as SchemaKey;
    const classKey = new SchemaItemKey(className, key);
    const mixin = await schema?.getItem(className);
    expect(mixin).toBeUndefined();

    await testEditor.mixins.delete(classKey);
    expect(testEditor.schemaContext.getSchemaItemSync(classKey)).toBeUndefined();
  });

  it("should add a mixin baseClass to a mixin item", async () => {
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey);

    const anotherEntityResult = await testEditor.entities.create(testKey, "anotherTestEntity", ECClassModifier.None);

    const mixinBaseClass  = await testEditor.mixins.create(testKey, "testMixinBaseClass", anotherEntityResult);
    await testEditor.mixins.setBaseClass(mixinResult, mixinBaseClass);

    const mixin = testEditor.schemaContext.getSchemaItemSync(mixinResult) as Mixin;

    expect(mixin.baseClass?.fullName).toEqual("testSchema.testMixinBaseClass");
  });

  it("should change the mixin base class with class from superset of existing base class", async () => {
    const baseClassRes = await testEditor.mixins.create(testKey, "testBaseClass", entityKey);
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey, "testLabel", baseClassRes);

    const testMixin = await testEditor.schemaContext.getSchemaItem<Mixin>(mixinResult);
    expect(await testMixin?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(baseClassRes));

    const newBaseClassRes = await testEditor.mixins.create(testKey, "newBaseClass", entityKey, "newLabel",baseClassRes);
    await testEditor.mixins.setBaseClass(mixinResult, newBaseClassRes);
    expect(await testMixin?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(newBaseClassRes));
  });

  it("should remove the base class from the existing mixin", async () => {
    const baseClassRes = await testEditor.mixins.create(testKey, "testBaseClass", entityKey);
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey, "testLabel", baseClassRes);

    const testMixin = await testEditor.schemaContext.getSchemaItem<Mixin>(mixinResult);
    expect(await testMixin?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(baseClassRes));

    await testEditor.mixins.setBaseClass(mixinResult, undefined);
    expect(await testMixin?.baseClass).toEqual(undefined);
  });

  it("should return error message because it tries to set base class that is not of mixin type", async () => {
    const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey);
    await expect(testEditor.mixins.setBaseClass(mixinResult, entityKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Expected ${entityKey.fullName} to be of type Mixin.`,
        errorNumber: ECEditingStatus.InvalidSchemaItemType,
      },
    });
  });

  it("should return an error message when a base class cannot be found in the context", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const mixinRes = await testEditor.mixins.create(testKey, "testMixin", entityKey);
    await expect(testEditor.mixins.setBaseClass(mixinRes, baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Mixin ${baseClassKey.fullName} could not be found in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNotFound,
      },
    });
  });

  it("adding a base class to a non-existing mixin should result in an error message", async () => {
    await testEditor.mixins.create(testKey, "testBaseClass", entityKey);
    const mixinKey = new SchemaItemKey("testMixin", testKey);

    await expect(testEditor.mixins.setBaseClass(mixinKey, entityKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Mixin ${mixinKey.fullName} could not be found in the schema context.`,
        errorNumber: ECEditingStatus.SchemaItemNotFoundInContext,
      },
    });
  });

  it("adding a base class with an unknown schema to mixin, should result in an error message", async () => {
    const schemaKey = new SchemaKey("unknownSchema", new ECVersion(1, 0, 0));
    const baseClassKey = new SchemaItemKey("testBaseClass", schemaKey);
    const mixinRes = await testEditor.mixins.create(testKey, "testMixin", entityKey);

    await expect(testEditor.mixins.setBaseClass(mixinRes, baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Schema Key ${schemaKey.toString(true)} could not be found in the context.`,
        errorNumber: ECEditingStatus.SchemaNotFound,
      },
    });
  });

  it("changing the mixin base class to one that doesn't derive from, should result in an error message", async () => {
    const baseClassRes = await testEditor.mixins.create(testKey, "testBaseClass", entityKey);
    const mixinRes = await testEditor.mixins.create(testKey, "testMixin", entityKey, "testLabel", baseClassRes);

    const testMixin = await testEditor.schemaContext.getSchemaItem<Mixin>(mixinRes);
    expect(await testMixin?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem<Mixin>(baseClassRes));

    const newBaseClassRes = await testEditor.mixins.create(testKey, "newBaseClass", entityKey);

    await expect(testEditor.mixins.setBaseClass(mixinRes, newBaseClassRes)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Base class ${newBaseClassRes.fullName} must derive from ${baseClassRes.fullName}.`,
        errorNumber: ECEditingStatus.InvalidBaseClass,
      },
    });
  });

  it("try creating mixin class to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1, 0, 0));
    await expect(testEditor.mixins.create(badKey, "testMixin", entityKey, "testLabel")).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `Schema Key ${badKey.toString(true)} could not be found in the context.`,
        errorNumber: ECEditingStatus.SchemaNotFound,
      },
    });
  });

  it("try creating mixin class with unknown base class, throws error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    await expect(testEditor.mixins.create(testKey, "testMixin", entityKey, "testLabel", baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `Mixin ${baseClassKey.fullName} could not be found in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNotFound,
      },
    });
  });

  it("try creating mixin with existing name, throws error", async () => {
    await testEditor.mixins.create(testKey, "testMixin", entityKey, "testLabel");
    await expect(testEditor.mixins.create(testKey, "testMixin", entityKey, "testLabel")).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `Mixin testSchema.testMixin already exists in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNameAlreadyExists,
      },
    });
  });

  it("try creating mixin with invalid appliesTo type, throws error", async () => {
    const unitSystemProps = {
      name: "testUnitSystem",
      description: "test description",
      label: "testDec",
    };
    const unitResult = await testEditor.unitSystems.createFromProps(testKey, unitSystemProps);
    await expect(testEditor.mixins.create(testKey, "testMixin", unitResult, "testLabel")).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `Expected ${unitResult.fullName} to be of type EntityClass.`,
        errorNumber: ECEditingStatus.InvalidSchemaItemType,
      },
    });
  });

  it("try creating mixin with unknown appliesTo key, throws error", async () => {
    const badKey = new SchemaItemKey("unknownEntityKey", testKey);
    await expect(testEditor.mixins.create(testKey, "testMixin", badKey, "testLabel")).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `EntityClass ${badKey.fullName} could not be found in the schema context.`,
        errorNumber: ECEditingStatus.SchemaItemNotFoundInContext,
      },
    });
  });
});
