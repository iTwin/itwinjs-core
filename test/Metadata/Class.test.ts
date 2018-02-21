/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import EntityClass from "../../source/Metadata/EntityClass";
import { SchemaContext } from "../../source/Context";
import { DelayedPromiseWithProps } from "../../source/DelayedPromise";
import ECClass from "../../source/Metadata/Class";
import { ECObjectsError } from "../../source/Exception";
import { SchemaChildType } from "../../source/ECObjects";

describe("ECClass", () => {
  let schema: Schema;

  describe("get properties", () => {
    beforeEach(() => {
      schema = new Schema("TestSchema", 1, 0, 0);
    });

    it("inherited properties from base class", async () => {
      const baseClass = new EntityClass(schema, "TestBase");
      const basePrimProp = await baseClass.createPrimitiveProperty("BasePrimProp");

      const entityClass = new EntityClass(schema, "TestClass");
      await entityClass.createPrimitiveProperty("PrimProp");
      entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

      expect(await entityClass.getProperty("BasePrimProp")).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp", false)).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp", true)).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("BasePrimProp")).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("PrimProp")).to.be.undefined;
    });

    it("case-insensitive search", async () => {
      const entityClass = new EntityClass(schema, "TestClass");
      const primProp = await entityClass.createPrimitiveProperty("TestProp");

      expect(await entityClass.getProperty("TESTPROP")).equal(primProp);
      expect(await entityClass.getProperty("testprop")).equal(primProp);
      expect(await entityClass.getProperty("tEsTpRoP")).equal(primProp);
    });

    it("case-insensitive inherited property search", async () => {
      const baseClass = new EntityClass(schema, "BaseClass");
      const primProp = await baseClass.createPrimitiveProperty("TestProp");

      const entityClass = new EntityClass(schema, "TestClass");
      entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

      expect(await entityClass.getProperty("TESTPROP", true)).equal(primProp);
      expect(await entityClass.getProperty("testprop", true)).equal(primProp);
      expect(await entityClass.getProperty("tEsTpRoP", true)).equal(primProp);

      expect(await entityClass.getInheritedProperty("TESTPROP")).equal(primProp);
      expect(await entityClass.getInheritedProperty("testprop")).equal(primProp);
      expect(await entityClass.getInheritedProperty("tEsTpRoP")).equal(primProp);
    });
  });

  describe("deserialization", () => {
    it("class with base class", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testBaseClass: {
            schemaChildType: "EntityClass",
          },
          testClass: {
            schemaChildType: "EntityClass",
            baseClass: "TestSchema.testBaseClass",
          },
        },
      };

      schema = await Schema.fromJson(schemaJson);
      assert.isDefined(schema);

      const testClass = await schema.getClass<EntityClass>("testClass");
      assert.isDefined(testClass);
      assert.isDefined(await testClass!.baseClass);

      const baseClass = await schema.getClass<EntityClass>("testBaseClass");
      assert.isDefined(baseClass);
      assert.isTrue(baseClass === await testClass!.baseClass);
    });

    it("class with base class in reference schema", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        references: [
          {
            name: "RefSchema",
            version: "1.0.5",
          },
        ],
        children: {
          testClass: {
            schemaChildType: "EntityClass",
            baseClass: "RefSchema.BaseClassInRef",
          },
        },
      };

      const refSchema = new Schema("RefSchema", 1, 0, 5);
      const refBaseClass = await refSchema.createEntityClass("BaseClassInRef");

      const context = new SchemaContext();
      await context.addSchema(refSchema);

      schema = await Schema.fromJson(schemaJson, context);

      const testClass = await schema.getClass<EntityClass>("testClass");

      assert.isDefined(testClass);
      assert.isDefined(await testClass!.baseClass);
      assert.isTrue(await testClass!.baseClass === refBaseClass);
    });

    // Used to test that all property types are deserialized correctly. For failure and other tests look at the property
    // specific test files.
    it("with properties", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testStruct: {
            schemaChildType: "StructClass",
          },
          testClass: {
            schemaChildType: "EntityClass",
            properties: [
              {
                propertyType: "PrimitiveProperty",
                name: "testPrimProp",
              },
              {
                propertyType: "StructProperty",
                name: "testStructProp",
                typeName: "TestSchema.testStruct",
              },
              {
                propertyType: "PrimitiveArrayProperty",
                name: "testPrimArrProp",
              },
              {
                propertyType: "StructArrayProperty",
                name: "testStructArrProp",
                typeName: "TestSchema.testStruct",
              },
            ],
          },
        },
      };

      const ecSchema = await Schema.fromJson(schemaJson);
      assert.isDefined(ecSchema);

      const testEntity = await ecSchema.getClass("testClass");
      assert.isDefined(testEntity);

      const testPrimProp = await testEntity!.getProperty("testPrimProp");
      assert.isDefined(testPrimProp);
      const testPrimArrProp = await testEntity!.getProperty("testPrimArrProp");
      assert.isDefined(testPrimArrProp);
      const testStructProp = await testEntity!.getProperty("testStructProp");
      assert.isDefined(testStructProp);
      const testStructArrProp = await testEntity!.getProperty("testStructArrProp");
      assert.isDefined(testStructArrProp);
    });
  });

  describe("fromJson", () => {
    let testClass: ECClass;
    class MockECClass extends ECClass {}

    beforeEach(() => {
      testClass = new MockECClass(schema, "TestClass", SchemaChildType.EntityClass);
    });

    it("should throw for invalid modifier", async () => {
      expect(testClass).to.exist;
      const invalidModifierJson = { schemaChildType: "EntityClass", modifier: 0 };
      await expect(testClass.fromJson(invalidModifierJson)).to.be.rejectedWith(ECObjectsError, `The ECClass TestClass has an invalid 'modifier' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid baseClass", async () => {
      expect(testClass).to.exist;
      const invalidBaseClassJson = { schemaChildType: "EntityClass", baseClass: 0 };
      await expect(testClass.fromJson(invalidBaseClassJson)).to.be.rejectedWith(ECObjectsError, `The ECClass TestClass has an invalid 'baseClass' attribute. It should be of type 'string'.`);

      const unloadedBaseClassJson = { schemaChildType: "EntityClass", baseClass: "ThisClassDoesNotExist" };
      await expect(testClass.fromJson(unloadedBaseClassJson)).to.be.rejectedWith(ECObjectsError);
    });
  });
});
