/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { ECClass, ECClassModifier, ECVersion, EntityClass, PrimitiveProperty, PrimitiveType, Schema, SchemaContext,
  SchemaItemKey, SchemaKey, SchemaMatchType,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { BisTestHelper } from "../TestUtils/BisTestHelper";

const expect = chai.expect;
chai.use(chaiAsPromised);

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
    const result = await context.getSchema(new SchemaKey("BisCore", 1, 0, 1), SchemaMatchType.Latest);
    if (!result)
      throw new Error("Could not retrieve BisCore schema.");
    bisSchema = result;
    bisSchemaKey = bisSchema!.schemaKey;
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
      const result2 =  await testEditor.schemaContext.getCachedSchema(testSchemaKey);
      if (!result2)
        throw new Error("Could not retrieve cached schema!");
      testSchema = result2;
    });

    it("should create BisCore.Element subclass successfully", async () => {
      const elementKey = new SchemaItemKey("Element", bisSchemaKey);
      const result = await testEditor.entities.createElement(testSchemaKey, "testElement", ECClassModifier.None, elementKey, "test element");
      expect(result).to.not.be.undefined;
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema!.getItem("testElement") as EntityClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element.baseClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass?.key).to.deep.equal(new SchemaItemKey("Element", bisSchemaKey));
    });

    it("should create BisCore.Element grandchild successfully", async () => {
      const elementKey = new SchemaItemKey("Element", bisSchemaKey);
      const result = await testEditor.entities.createElement(testSchemaKey, "testElement", ECClassModifier.None, elementKey, "test element");
      expect(result).to.not.be.undefined;
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema!.getItem("testElement") as EntityClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element.baseClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass?.key).to.deep.equal(new SchemaItemKey("Element", bisSchemaKey));

      const result2 = await testEditor.entities.createElement(testSchemaKey, "testElement2", ECClassModifier.None, result.itemKey!, "test element2");
      expect(result2).to.not.be.undefined;
      expect(result2.itemKey).to.not.be.undefined;
      expect(result2.itemKey).to.deep.equal(new SchemaItemKey("testElement2", testSchemaKey));
      const element2 = await testSchema!.getItem("testElement2") as EntityClass;
      expect(element2).to.not.be.undefined;
      const baseClass2 = await element2.baseClass;
      expect(baseClass2).to.not.be.undefined;
      expect(baseClass2?.key).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
    });

    it("should create BisCore.ElementUniqueAspect subclass successfully", async () => {
      const uniqueAspectKey = new SchemaItemKey("ElementUniqueAspect", bisSchemaKey);
      const result = await testEditor.entities.createElementUniqueAspect(testSchemaKey, "testElement", ECClassModifier.None, uniqueAspectKey, "test element");
      expect(result).to.not.be.undefined;
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema!.getItem("testElement") as ECClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element?.baseClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(uniqueAspectKey));
    });

    it("should create BisCore.ElementUniqueAspect grandchild successfully", async () => {
      const elementKey = new SchemaItemKey("ElementUniqueAspect", bisSchemaKey);
      const result = await testEditor.entities.createElementUniqueAspect(testSchemaKey, "testElement", ECClassModifier.None, elementKey, "test element");
      expect(result).to.not.be.undefined;
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema!.getItem("testElement") as EntityClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element.baseClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass?.key).to.deep.equal(new SchemaItemKey("ElementUniqueAspect", bisSchemaKey));

      const result2 = await testEditor.entities.createElementUniqueAspect(testSchemaKey, "testElement2", ECClassModifier.None, result.itemKey!, "test element2");
      expect(result2).to.not.be.undefined;
      expect(result2.itemKey).to.not.be.undefined;
      expect(result2.itemKey).to.deep.equal(new SchemaItemKey("testElement2", testSchemaKey));
      const element2 = await testSchema!.getItem("testElement2") as EntityClass;
      expect(element2).to.not.be.undefined;
      const baseClass2 = await element2.baseClass;
      expect(baseClass2).to.not.be.undefined;
      expect(baseClass2?.key).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
    });

    it("should create BisCore.ElementMultiAspect subclass successfully", async () => {
      const multiAspectKey = new SchemaItemKey("ElementMultiAspect", bisSchemaKey);
      const result = await testEditor.entities.createElementMultiAspect(testSchemaKey, "testElement", ECClassModifier.None, multiAspectKey, "test element");
      expect(result).to.not.be.undefined;
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema!.getItem("testElement") as ECClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element?.baseClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(multiAspectKey));
    });

    it("should create BisCore.ElementMultiAspect grandchild successfully", async () => {
      const elementKey = new SchemaItemKey("ElementMultiAspect", bisSchemaKey);
      const result = await testEditor.entities.createElementMultiAspect(testSchemaKey, "testElement", ECClassModifier.None, elementKey, "test element");
      expect(result).to.not.be.undefined;
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema!.getItem("testElement") as EntityClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element.baseClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass?.key).to.deep.equal(new SchemaItemKey("ElementMultiAspect", bisSchemaKey));

      const result2 = await testEditor.entities.createElementMultiAspect(testSchemaKey, "testElement2", ECClassModifier.None, result.itemKey!, "test element2");
      expect(result2).to.not.be.undefined;
      expect(result2.itemKey).to.not.be.undefined;
      expect(result2.itemKey).to.deep.equal(new SchemaItemKey("testElement2", testSchemaKey));
      const element2 = await testSchema!.getItem("testElement2") as EntityClass;
      expect(element2).to.not.be.undefined;
      const baseClass2 = await element2.baseClass;
      expect(baseClass2).to.not.be.undefined;
      expect(baseClass2?.key).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
    });

    it("Creating Element, try subclassing unsupported base class, throws", async () => {
      const elementKey = new SchemaItemKey("PhysicalModel", bisSchemaKey);
      await expect(testEditor.entities.createElement(testSchemaKey, "testElement", ECClassModifier.None, elementKey, "test element")).to.be.rejectedWith(Error, "The class testElement could not be created because the specified base class BisCore.PhysicalModel is not an Element.");
    });

    it("Creating ElementMultiAspect, try subclassing unsupported base class, throws", async () => {
      const uniqueAspectKey = new SchemaItemKey("PhysicalModel", bisSchemaKey);
      await expect(testEditor.entities.createElementUniqueAspect(testSchemaKey, "testElement", ECClassModifier.None, uniqueAspectKey, "test element")).to.be.rejectedWith(Error, "The class testElement could not be created because the specified base class BisCore.PhysicalModel is not an ElementUniqueAspect.");
    });

    it("Creating ElementMultiAspect, try subclassing unsupported base class, throws", async () => {
      const multiAspectKey = new SchemaItemKey("PhysicalModel", bisSchemaKey);
      await expect(testEditor.entities.createElementMultiAspect(testSchemaKey, "testElement", ECClassModifier.None, multiAspectKey, "test element")).to.be.rejectedWith(Error, "The class testElement could not be created because the specified base class BisCore.PhysicalModel is not an ElementMultiAspect.");
    });

    it("should delete class successfully", async () => {
      const multiAspectKey = new SchemaItemKey("ElementMultiAspect", bisSchemaKey);
      const result = await testEditor.entities.createElementMultiAspect(testSchemaKey, "testElement", ECClassModifier.None, multiAspectKey, "test element");
      expect(result).to.not.be.undefined;
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      let element = await testSchema!.getItem("testElement");
      expect(element).to.not.be.undefined;
      await testEditor.entities.delete(result.itemKey!);
      expect(result.itemKey).to.not.be.undefined;
      expect(result.itemKey).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      element = await testSchema!.getItem("testElements");
      expect(element).to.be.undefined;
      const classes = testSchema!.getClasses();
      for (const _class of classes) {
        expect(false, "Expected no classes in the schema.").to.be.true;
      }
    });

    describe("Property tests", () => {
      let testEntity: EntityClass | undefined;
      let entityKey: SchemaItemKey | undefined;
      beforeEach(async () => {
        const elementKey = new SchemaItemKey("Element", bisSchemaKey);
        const result = await testEditor.entities.create(testSchemaKey, "testElement", ECClassModifier.None, "test element", elementKey);
        entityKey = result.itemKey;
        testEntity = await testSchema!.getItem("testElement");
      });

      it("should successfully create a PrimitiveProperty of type double", async () => {
        const createResult = await testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.Double, "p");
        const property = await testEntity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
        expect(property.class.key).to.eql(createResult.itemKey);
        expect(property.name).to.eql(createResult.propertyName);
        expect(property.name).to.equal("p_TestProperty");
      });

      it("should successfully create a PrimitiveProperty of type String", async () => {
        const createResult = await testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.String, "p");
        const property = await testEntity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
        expect(property.class.key).to.eql(createResult.itemKey);
        expect(property.name).to.eql(createResult.propertyName);
        expect(property.name).to.equal("p_TestProperty");
      });

      it("should successfully create a PrimitiveProperty of type DateTime", async () => {
        const createResult = await testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.DateTime, "p");
        const property = await testEntity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
        expect(property.class.key).to.eql(createResult.itemKey);
        expect(property.name).to.eql(createResult.propertyName);
        expect(property.name).to.equal("p_TestProperty");
      });

      it("should successfully create a PrimitiveProperty of type Integer", async () => {
        const createResult = await testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.Integer, "p");
        const property = await testEntity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
        expect(property.class.key).to.eql(createResult.itemKey);
        expect(property.name).to.eql(createResult.propertyName);
        expect(property.name).to.equal("p_TestProperty");
      });

      it("try to create a property of unsupported type, throws", async () => {
        await expect(testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.Boolean, "p")).to.be.rejectedWith(Error, "Property creation is restricted to type Double, String, DateTime, and Integer.");
      });

      it("should successfully delete PrimitiveProperty.", async () => {
        const createResult = await testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.Double, "p");
        let property = await testEntity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
        expect(property.class.key).to.eql(createResult.itemKey);
        expect(property.name).to.eql(createResult.propertyName);

        const delResult = await testEditor.entities.deleteProperty(entityKey as SchemaItemKey, "p_TestProperty");
        expect(delResult.itemKey).to.eql(entityKey);
        expect(delResult.propertyName).to.eql("p_TestProperty");

        // Should get undefined since property has been deleted
        property = await testEntity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
        expect(property).to.be.undefined;
      });
    });
  });
});
