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
import { ECEditingStatus } from "../../Editing/Exception";

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
      const schemaKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
      expect(schemaKey).to.not.be.undefined;
      expect(schemaKey).to.deep.equal(new SchemaKey("testSchema", new ECVersion(1,0,0)));
    });
  });

  describe("Class tests", () => {
    beforeEach(async () => {
      testSchemaKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
      const result2 =  await testEditor.schemaContext.getCachedSchema(testSchemaKey);
      if (!result2)
        throw new Error("Could not retrieve cached schema!");
      testSchema = result2;
    });

    it("should create BisCore.Element subclass successfully", async () => {
      const elementKey = new SchemaItemKey("Element", bisSchemaKey);
      const result = await testEditor.entities.createElement(testSchemaKey, "testElement", ECClassModifier.None, elementKey, "test element");
      expect(result).to.not.be.undefined;
      expect(result).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
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
      expect(result).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema!.getItem("testElement") as EntityClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element.baseClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass?.key).to.deep.equal(new SchemaItemKey("Element", bisSchemaKey));

      const result2 = await testEditor.entities.createElement(testSchemaKey, "testElement2", ECClassModifier.None, result, "test element2");
      expect(result2).to.not.be.undefined;
      expect(result2).to.deep.equal(new SchemaItemKey("testElement2", testSchemaKey));
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
      expect(result).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
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
      expect(result).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema!.getItem("testElement") as EntityClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element.baseClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass?.key).to.deep.equal(new SchemaItemKey("ElementUniqueAspect", bisSchemaKey));

      const result2 = await testEditor.entities.createElementUniqueAspect(testSchemaKey, "testElement2", ECClassModifier.None, result, "test element2");
      expect(result2).to.not.be.undefined;
      expect(result2).to.deep.equal(new SchemaItemKey("testElement2", testSchemaKey));
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
      expect(result).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
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
      expect(result).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      const element = await testSchema!.getItem("testElement") as EntityClass;
      expect(element).to.not.be.undefined;
      const baseClass = await element.baseClass;
      expect(baseClass).to.not.be.undefined;
      expect(baseClass?.key).to.deep.equal(new SchemaItemKey("ElementMultiAspect", bisSchemaKey));

      const result2 = await testEditor.entities.createElementMultiAspect(testSchemaKey, "testElement2", ECClassModifier.None, result, "test element2");
      expect(result2).to.not.be.undefined;
      expect(result2).to.deep.equal(new SchemaItemKey("testElement2", testSchemaKey));
      const element2 = await testSchema!.getItem("testElement2") as EntityClass;
      expect(element2).to.not.be.undefined;
      const baseClass2 = await element2.baseClass;
      expect(baseClass2).to.not.be.undefined;
      expect(baseClass2?.key).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
    });

    it("Creating Element, try subclassing unsupported base class, throws", async () => {
      const elementKey = new SchemaItemKey("PhysicalModel", bisSchemaKey);
      await expect(testEditor.entities.createElement(testSchemaKey, "testElement", ECClassModifier.None, elementKey, "test element")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("errorNumber", ECEditingStatus.CreateElement);
        expect(error).to.have.nested.property("innerError.message", `Expected base class ${elementKey.fullName} to derive from BisCore.Element.`);
        expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.BaseClassIsNotElement);
      });
    });

    it("Creating ElementUniqueAspect, try subclassing unsupported base class, throws", async () => {
      const uniqueAspectKey = new SchemaItemKey("PhysicalModel", bisSchemaKey);
      await expect(testEditor.entities.createElementUniqueAspect(testSchemaKey, "testElement", ECClassModifier.None, uniqueAspectKey, "test element")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("errorNumber", ECEditingStatus.CreateElement);
        expect(error).to.have.nested.property("innerError.message", `Expected base class ${uniqueAspectKey.fullName} to derive from BisCore.ElementUniqueAspect.`);
        expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.BaseClassIsNotElementUniqueAspect);
      });
    });

    it("Creating ElementMultiAspect, try subclassing unsupported base class, throws", async () => {
      const multiAspectKey = new SchemaItemKey("PhysicalModel", bisSchemaKey);
      await expect(testEditor.entities.createElementMultiAspect(testSchemaKey, "testElement", ECClassModifier.None, multiAspectKey, "test element")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("errorNumber", ECEditingStatus.CreateElement);
        expect(error).to.have.nested.property("innerError.message", `Expected base class ${multiAspectKey.fullName} to derive from BisCore.ElementMultiAspect.`);
        expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.BaseClassIsNotElementMultiAspect);
      });
    });

    it("should delete class successfully", async () => {
      const multiAspectKey = new SchemaItemKey("ElementMultiAspect", bisSchemaKey);
      const result = await testEditor.entities.createElementMultiAspect(testSchemaKey, "testElement", ECClassModifier.None, multiAspectKey, "test element");
      expect(result).to.not.be.undefined;
      expect(result).to.deep.equal(new SchemaItemKey("testElement", testSchemaKey));
      let element = await testSchema!.getItem("testElement");
      expect(element).to.not.be.undefined;
      await testEditor.entities.delete(result);
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
        entityKey = await testEditor.entities.create(testSchemaKey, "testElement", ECClassModifier.None, "test element", elementKey);
        testEntity = await testSchema!.getItem("testElement");
      });

      it("should successfully create a PrimitiveProperty of type double", async () => {
        await testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.Double, "p");
        const property = await testEntity?.getProperty("p_TestProperty") as PrimitiveProperty;
        expect(property.name).to.equal("p_TestProperty");
      });

      it("should successfully create a PrimitiveProperty of type String", async () => {
        await testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.String, "p");
        const property = await testEntity?.getProperty("p_TestProperty") as PrimitiveProperty;
        expect(property.name).to.equal("p_TestProperty");
      });

      it("should successfully create a PrimitiveProperty of type DateTime", async () => {
        await testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.DateTime, "p");
        const property = await testEntity?.getProperty("p_TestProperty") as PrimitiveProperty;
        expect(property.name).to.equal("p_TestProperty");
      });

      it("should successfully create a PrimitiveProperty of type Integer", async () => {
        await testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.Integer, "p");
        const property = await testEntity?.getProperty("p_TestProperty") as PrimitiveProperty;
        expect(property.name).to.equal("p_TestProperty");
      });

      it("try to create a property of unsupported type, throws", async () => {
        await expect(testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.Boolean, "p")).to.be.rejectedWith(Error, "Property creation is restricted to type Double, String, DateTime, and Integer.");
      });

      it("should successfully delete PrimitiveProperty.", async () => {
        await testEditor.entities.createProperty(entityKey as SchemaItemKey, "TestProperty", PrimitiveType.Double, "p");
        let property = await testEntity?.getProperty("TestProperty") as PrimitiveProperty;

        await testEditor.entities.deleteProperty(entityKey as SchemaItemKey, "p_TestProperty");

        // Should get undefined since property has been deleted
        property = await testEntity?.getProperty("p_TestProperty") as PrimitiveProperty;
        expect(property).to.be.undefined;
      });
    });
  });
});
