/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECClassModifier, ECVersion, EntityClass, Schema, SchemaContext, SchemaItemKey, SchemaKey, SchemaMatchType } from "@bentley/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { BisTestHelper } from "../TestUtils/BisTestHelper";

describe("SchemaEditor tests", () => {
  let testEditor: SchemaContextEditor;
  let testSchema: Schema;
  let testSchemaKey: SchemaKey;
  let bisSchema: Schema;
  let bisSchemaKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = await BisTestHelper.getNewContext();
    testEditor = new SchemaContextEditor(context);
    bisSchema = await context.getSchema(new SchemaKey("BisCore", 1, 0, 1), SchemaMatchType.Latest) as Schema;
    bisSchemaKey = bisSchema.schemaKey;
  });

  describe("Schema tests", () => {
    it("should create a new schema and return a SchemaEditResults", async () => {
      const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
      expect(result).to.not.be.undefined;
      expect(result.schemaKey).to.not.be.undefined;
      expect(result.schemaKey).to.deep.equal(new SchemaKey("testSchema", new ECVersion(1,0,0)));
    });
  });

  describe("Class tests", () => {
    beforeEach(async () => {
      const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
      expect(result).to.not.be.undefined;
      testSchemaKey = result.schemaKey as SchemaKey;
      testSchema = await testEditor.schemaContext.getCachedSchema(testSchemaKey) as Schema;
    });

    it("should create BisCore.Element subclass successfully", async () => {
      const elementKey = new SchemaItemKey("Element", bisSchemaKey);
      const result = await testEditor.entities.create(testSchemaKey, "testElement", ECClassModifier.None, "test element", elementKey);
      expect(result).to.not.be.undefined;
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema.getItem("testElement") as EntityClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element.baseClass as EntityClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass.key).to.deep.equal(new SchemaItemKey("Element", bisSchemaKey));
    });

    it("should create BisCore.ElementUniqueAspect subclass successfully", async () => {
      const uniqueAspectKey = new SchemaItemKey("ElementUniqueAspect", bisSchemaKey);
      const result = await testEditor.entities.create(testSchemaKey, "testElement", ECClassModifier.None, "test element", uniqueAspectKey);
      expect(result).to.not.be.undefined;
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema.getItem("testElement") as EntityClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element.baseClass as EntityClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(uniqueAspectKey));
    });

    it("should create BisCore.ElementMultiAspect subclass successfully", async () => {
      const multiAspectKey = new SchemaItemKey("ElementMultiAspect", bisSchemaKey);
      const result = await testEditor.entities.create(testSchemaKey, "testElement", ECClassModifier.None, "test element", multiAspectKey);
      expect(result).to.not.be.undefined;
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema.getItem("testElement") as EntityClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element.baseClass as EntityClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(multiAspectKey));
    });
  });
});
