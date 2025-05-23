/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { CustomAttributeClass } from "../../Metadata/CustomAttributeClass";
import { RelationshipClass } from "../../Metadata/RelationshipClass";
import { SchemaContext } from "../../Context";
import { DelayedPromiseWithProps } from "../../DelayedPromise";
import { ECSchemaError } from "../../Exception";
import { ECClass, MutableClass, StructClass } from "../../Metadata/Class";
import { CustomAttributeSet } from "../../Metadata/CustomAttribute";
import { EntityClass, MutableEntityClass } from "../../Metadata/EntityClass";
import { Mixin } from "../../Metadata/Mixin";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { SchemaItem } from "../../Metadata/SchemaItem";
import { SchemaKey } from "../../SchemaKey";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument, getElementChildren, getElementChildrenByTagName } from "../TestUtils/SerializationHelper";
import { StrengthDirection } from "../../ECObjects";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

describe("ECClass", () => {
  let schema: Schema;

  describe("get properties", () => {
    beforeEach(() => {
      schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
    });

    it("checks if properties are overridden correctly", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          TestBase: {
            schemaItemType: "EntityClass",
            properties: [
              {
                type: "PrimitiveProperty",
                typeName: "string",
                name: "PrimProp",
                label: "BaseProp",
              },
            ],
          },
          TestClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.TestBase",
            properties: [
              {
                type: "PrimitiveProperty",
                typeName: "string",
                name: "PrimProp",
                label: "DerivedProp",
              },
            ],
          },
          OneMoreClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.TestClass",
          },
        },
      };
      schema = await Schema.fromJson(schemaJson, new SchemaContext());
      const testClass = await schema.getItem("TestClass", EntityClass);
      const testBase = await schema.getItem("TestBase", EntityClass);
      const oneMoreClass = await schema.getItem("OneMoreClass", EntityClass);
      assert.isDefined(testClass);
      assert.isDefined(testBase);
      assert.isDefined(oneMoreClass);
      const testClassPrimProp = await testClass!.getProperty("PrimProp", true);
      const testBasePrimProp = await testBase!.getProperty("PrimProp");
      const oneMoreClassPrimProp = await oneMoreClass!.getProperty("PrimProp");
      assert.isDefined(testClassPrimProp);
      assert.isDefined(testBasePrimProp);
      assert.isDefined(oneMoreClassPrimProp);
      expect(testClassPrimProp).not.to.equal(testBasePrimProp);
      expect(testClassPrimProp?.label).to.equal("DerivedProp");
      expect(oneMoreClassPrimProp?.label).to.equal("DerivedProp");
      expect(oneMoreClassPrimProp).to.equal(testClassPrimProp);
    });

    it("inherited properties from base class", async () => {
      const baseClass = new EntityClass(schema, "TestBase");
      const basePrimProp = await (baseClass as ECClass as MutableClass).createPrimitiveProperty("BasePrimProp");

      const entityClass = new EntityClass(schema, "TestClass");
      await (entityClass as ECClass as MutableClass).createPrimitiveProperty("PrimProp");
      await (entityClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(baseClass.key, async () => baseClass));

      expect(await entityClass.getProperty("BasePrimProp", true)).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp", true)).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp")).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("BasePrimProp")).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("PrimProp")).to.be.undefined;
    });

    it("inherited properties from base class synchronously", async () => {
      const baseClass = (schema as MutableSchema).createEntityClassSync("TestBase");
      const basePrimProp = (baseClass as ECClass as MutableClass).createPrimitivePropertySync("BasePrimProp");

      const entityClass = (schema as MutableSchema).createEntityClassSync("TestClass");
      (entityClass as ECClass as MutableClass).createPrimitivePropertySync("PrimProp");
      await (entityClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(baseClass.key, async () => baseClass));

      expect(entityClass.getPropertySync("BasePrimProp", true)).to.be.undefined;
      expect(entityClass.getPropertySync("BasePrimProp", true)).to.be.undefined;
      expect(entityClass.getPropertySync("BasePrimProp")).equal(basePrimProp);
      expect(entityClass.getInheritedPropertySync("BasePrimProp")).equal(basePrimProp);
      expect(entityClass.getInheritedPropertySync("PrimProp")).to.be.undefined;
    });

    it("case-insensitive search", async () => {
      const entityClass = new EntityClass(schema, "TestClass");
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp");

      expect(await entityClass.getProperty("TESTPROP")).equal(primProp);
      expect(await entityClass.getProperty("testprop")).equal(primProp);
      expect(await entityClass.getProperty("tEsTpRoP")).equal(primProp);
    });

    it("case-insensitive inherited property search", async () => {
      const baseClass = new EntityClass(schema, "BaseClass");
      const primProp = await (baseClass as ECClass as MutableClass).createPrimitiveProperty("TestProp");

      const entityClass = new EntityClass(schema, "TestClass");
      await (entityClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(baseClass.key, async () => baseClass));

      expect(await entityClass.getProperty("TESTPROP")).equal(primProp);
      expect(await entityClass.getProperty("testprop")).equal(primProp);
      expect(await entityClass.getProperty("tEsTpRoP")).equal(primProp);

      expect(await entityClass.getInheritedProperty("TESTPROP")).equal(primProp);
      expect(await entityClass.getInheritedProperty("testprop")).equal(primProp);
      expect(await entityClass.getInheritedProperty("tEsTpRoP")).equal(primProp);
    });
  });

  describe("adding and deleting properties from classes", () => {
    let entityClass: EntityClass;

    beforeEach(() => {
      schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      entityClass = new EntityClass(schema, "TestClass");
    });

    it("should do nothing when deleting property name that is not in class", async () => {
      expect(entityClass.getPropertiesSync()).to.be.empty;
      expect(await entityClass.getProperty("TestProp", true)).to.be.undefined;

      await (entityClass as ECClass as MutableClass).deleteProperty("TestProp");

      expect(entityClass.getPropertiesSync()).to.be.empty;
      expect(await entityClass.getProperty("TestProp", true)).to.be.undefined;
    });

    it("should do nothing when deleting property name that is not in class, synchronous", async () => {
      expect(entityClass.getPropertiesSync()).to.be.empty;
      expect(await entityClass.getProperty("TestProp", true)).to.be.undefined;

      (entityClass as ECClass as MutableClass).deletePropertySync("TestProp");

      expect(entityClass.getPropertiesSync()).to.be.empty;
      expect(await entityClass.getProperty("TestProp", true)).to.be.undefined;
    });

    it("should do nothing if a property is already deleted, synchronous", async () => {
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp");

      expect([...entityClass.getPropertiesSync()].length).to.equal(1);
      expect(await entityClass.getProperty("TestProp")).equal(primProp);

      (entityClass as ECClass as MutableClass).deletePropertySync("TestProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(0);
      expect(await entityClass.getProperty("TestProp")).to.be.undefined;

      (entityClass as ECClass as MutableClass).deletePropertySync("TestProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(0);
      expect(await entityClass.getProperty("TestProp")).to.be.undefined;
    });

    it("should do nothing if a property is already deleted", async () => {
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp");

      expect([...entityClass.getPropertiesSync()].length).to.equal(1);
      expect(await entityClass.getProperty("TestProp")).equal(primProp);

      await (entityClass as ECClass as MutableClass).deleteProperty("TestProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(0);
      expect(await entityClass.getProperty("TestProp")).to.be.undefined;

      await (entityClass as ECClass as MutableClass).deleteProperty("TestProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(0);
      expect(await entityClass.getProperty("TestProp")).to.be.undefined;
    });

    it("should add and delete properties by case-insensitive names", async () => {
      const primProp1 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp1");
      const primProp2 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp2");
      const primProp3 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp3");

      expect([...entityClass.getPropertiesSync()].length).to.equal(3);
      expect(await entityClass.getProperty("TestProp1")).equal(primProp1);
      expect(await entityClass.getProperty("TestProp2")).equal(primProp2);
      expect(await entityClass.getProperty("TestProp3")).equal(primProp3);

      await (entityClass as ECClass as MutableClass).deleteProperty("TestProp1");
      expect([...entityClass.getPropertiesSync()].length).to.equal(2);
      expect(await entityClass.getProperty("TestProp1")).to.be.undefined;

      await (entityClass as ECClass as MutableClass).deleteProperty("testprop2");
      expect([...entityClass.getPropertiesSync()].length).to.equal(1);
      expect(await entityClass.getProperty("TestProp2")).to.be.undefined;

      await (entityClass as ECClass as MutableClass).deleteProperty("TESTPROP3");
      expect([...entityClass.getPropertiesSync()].length).to.equal(0);
      expect(await entityClass.getProperty("TestProp3")).to.be.undefined;
    });

    it("should add and delete properties by case-insensitive names, synchronous", async () => {
      const primProp1 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp1");
      const primProp2 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp2");
      const primProp3 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp3");

      expect([...entityClass.getPropertiesSync()].length).to.equal(3);
      expect(await entityClass.getProperty("TestProp1")).equal(primProp1);
      expect(await entityClass.getProperty("TestProp2")).equal(primProp2);
      expect(await entityClass.getProperty("TestProp3")).equal(primProp3);

      (entityClass as ECClass as MutableClass).deletePropertySync("TestProp1");
      expect([...entityClass.getPropertiesSync()].length).to.equal(2);
      expect(await entityClass.getProperty("TestProp1")).to.be.undefined;

      (entityClass as ECClass as MutableClass).deletePropertySync("testprop2");
      expect([...entityClass.getPropertiesSync()].length).to.equal(1);
      expect(await entityClass.getProperty("TestProp2")).to.be.undefined;

      (entityClass as ECClass as MutableClass).deletePropertySync("TESTPROP3");
      expect([...entityClass.getPropertiesSync()].length).to.equal(0);
      expect(await entityClass.getProperty("TestProp3")).to.be.undefined;
    });

    it("should delete for different kinds of properties", async () => {
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("PrimProp");
      const primArrProp = await (entityClass as ECClass as MutableClass).createPrimitiveArrayProperty("PrimArrProp");
      const structProp = await (entityClass as ECClass as MutableClass).createStructProperty("StructProp", new StructClass(schema, "TestStruct"));
      const structArrProp = await (entityClass as ECClass as MutableClass).createStructArrayProperty("StructArrProp", new StructClass(schema, "TestStruct"));
      const navProp = await (entityClass as MutableEntityClass).createNavigationProperty("NavProp", new RelationshipClass(schema, "TestRel"), StrengthDirection.Forward);

      expect([...entityClass.getPropertiesSync()].length).to.equal(5);
      expect(await entityClass.getProperty("PrimProp")).equal(primProp);
      expect(await entityClass.getProperty("PrimArrProp")).equal(primArrProp);
      expect(await entityClass.getProperty("StructProp")).equal(structProp);
      expect(await entityClass.getProperty("StructArrProp")).equal(structArrProp);
      expect(await entityClass.getProperty("NavProp")).equal(navProp);

      await (entityClass as ECClass as MutableClass).deleteProperty("PrimProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(4);
      expect(await entityClass.getProperty("PrimProp")).to.be.undefined;

      await (entityClass as ECClass as MutableClass).deleteProperty("PrimArrProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(3);
      expect(await entityClass.getProperty("PrimArrProp")).to.be.undefined;

      await (entityClass as ECClass as MutableClass).deleteProperty("StructProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(2);
      expect(await entityClass.getProperty("StructProp")).to.be.undefined;

      await (entityClass as ECClass as MutableClass).deleteProperty("StructArrProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(1);
      expect(await entityClass.getProperty("StructArrProp")).to.be.undefined;

      await (entityClass as ECClass as MutableClass).deleteProperty("NavProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(0);
      expect(await entityClass.getProperty("NavProp")).to.be.undefined;
    });

    it("should delete for different kinds of properties, synchronous", async () => {
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("PrimProp");
      const primArrProp = await (entityClass as ECClass as MutableClass).createPrimitiveArrayProperty("PrimArrProp");
      const structProp = await (entityClass as ECClass as MutableClass).createStructProperty("StructProp", new StructClass(schema, "TestStruct"));
      const structArrProp = await (entityClass as ECClass as MutableClass).createStructArrayProperty("StructArrProp", new StructClass(schema, "TestStruct"));
      const navProp = await (entityClass as MutableEntityClass).createNavigationProperty("NavProp", new RelationshipClass(schema, "TestRel"), StrengthDirection.Forward);

      expect([...entityClass.getPropertiesSync()].length).to.equal(5);
      expect(await entityClass.getProperty("PrimProp")).equal(primProp);
      expect(await entityClass.getProperty("PrimArrProp")).equal(primArrProp);
      expect(await entityClass.getProperty("StructProp")).equal(structProp);
      expect(await entityClass.getProperty("StructArrProp")).equal(structArrProp);
      expect(await entityClass.getProperty("NavProp")).equal(navProp);

      (entityClass as ECClass as MutableClass).deletePropertySync("PrimProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(4);
      expect(await entityClass.getProperty("PrimProp")).to.be.undefined;

      (entityClass as ECClass as MutableClass).deletePropertySync("PrimArrProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(3);
      expect(await entityClass.getProperty("PrimArrProp")).to.be.undefined;

      (entityClass as ECClass as MutableClass).deletePropertySync("StructProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(2);
      expect(await entityClass.getProperty("StructProp")).to.be.undefined;

      (entityClass as ECClass as MutableClass).deletePropertySync("StructArrProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(1);
      expect(await entityClass.getProperty("StructArrProp")).to.be.undefined;

      (entityClass as ECClass as MutableClass).deletePropertySync("NavProp");
      expect([...entityClass.getPropertiesSync()].length).to.equal(0);
      expect(await entityClass.getProperty("NavProp")).to.be.undefined;
    });
  });

  describe("get inherited custom attributes", () => {
    it("class only has local custom attributes, no base classes", async () => {
      const entityClass = new EntityClass(schema, "TestEntity");
      const mutableEntity = entityClass as ECClass as MutableClass;
      mutableEntity.addCustomAttribute({ className: "TestSchema.CustomAttribute0" });
      mutableEntity.addCustomAttribute({ className: "TestSchema.CustomAttribute1" });
      mutableEntity.addCustomAttribute({ className: "TestSchema.CustomAttribute2" });
      mutableEntity.addCustomAttribute({ className: "TestSchema.CustomAttribute3" });

      const localCustomAttributes = entityClass.customAttributes;
      expect(localCustomAttributes).not.to.be.undefined;

      const testInheritanceCA = (inheritedCustomAttributes: CustomAttributeSet) => {
        expect(inheritedCustomAttributes.get("TestSchema.CustomAttribute0")).to.be.equals(localCustomAttributes!.get("TestSchema.CustomAttribute0"));
        expect(inheritedCustomAttributes.get("TestSchema.CustomAttribute1")).to.be.equals(localCustomAttributes!.get("TestSchema.CustomAttribute1"));
        expect(inheritedCustomAttributes.get("TestSchema.CustomAttribute2")).to.be.equals(localCustomAttributes!.get("TestSchema.CustomAttribute2"));
        expect(inheritedCustomAttributes.get("TestSchema.CustomAttribute3")).to.be.equals(localCustomAttributes!.get("TestSchema.CustomAttribute3"));
      };

      testInheritanceCA(await entityClass.getCustomAttributes());
      testInheritanceCA(entityClass.getCustomAttributesSync());
    });

    it("class has one branch inheritance", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          TestFirstBaseCAClass0: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
          TestFirstBaseCAClass1: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
          TestCAClass0: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
          TestCAClass1: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },

          TestFirstBaseClass: {
            schemaItemType: "EntityClass",
            customAttributes: [
              { className: "TestSchema.TestFirstBaseCAClass0" },
              { className: "TestSchema.TestFirstBaseCAClass1" },
            ],
          },
          TestSecondBaseClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.TestFirstBaseClass",
          },
          TestClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.TestSecondBaseClass",
            customAttributes: [
              { className: "TestSchema.TestCAClass0" },
              { className: "TestSchema.TestCAClass1" },
            ],
          },
        },
      };

      schema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(schema).not.to.be.undefined;

      // testClass
      const testClass = schema.getItemSync("TestClass") as ECClass;
      expect(testClass).not.to.be.undefined;

      const testCAClass0 = testClass.customAttributes!.get("TestSchema.TestCAClass0");
      expect(testCAClass0).not.to.be.undefined;
      const testCAClass1 = testClass.customAttributes!.get("TestSchema.TestCAClass1");
      expect(testCAClass1).not.to.be.undefined;

      // testFirstBaseClass
      const testFirstBaseClass = schema.getItemSync("TestFirstBaseClass") as ECClass;
      expect(testFirstBaseClass).not.to.be.undefined;

      const testFirstBaseCAClass0 = testFirstBaseClass.customAttributes!.get("TestSchema.TestFirstBaseCAClass0");
      expect(testFirstBaseCAClass0).not.to.be.undefined;
      const testFirstBaseCAClass1 = testFirstBaseClass.customAttributes!.get("TestSchema.TestFirstBaseCAClass1");
      expect(testFirstBaseCAClass1).not.to.be.undefined;

      // testSecondBaseClass
      const testSecondBaseClass = schema.getItemSync("TestSecondBaseClass") as ECClass;
      expect(testSecondBaseClass).not.to.be.undefined;

      // test inheritance CA
      const testInheritanceCA = (inheritedCustomAttributes: CustomAttributeSet) => {
        expect(inheritedCustomAttributes.get("TestSchema.TestCAClass0")).to.be.equals(testCAClass0);
        expect(inheritedCustomAttributes.get("TestSchema.TestCAClass1")).to.be.equals(testCAClass1);
        expect(inheritedCustomAttributes.get("TestSchema.TestFirstBaseCAClass0")).to.be.equals(testFirstBaseCAClass0);
        expect(inheritedCustomAttributes.get("TestSchema.TestFirstBaseCAClass1")).to.be.equals(testFirstBaseCAClass1);
      };

      testInheritanceCA(await testClass.getCustomAttributes());
      testInheritanceCA(testClass.getCustomAttributesSync());
    });

    it("class has multiple branches of inheritance", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          TestCAClass0: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
          TestCAClass1: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },

          TestFirstBaseCAClass0: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
          TestFirstBaseCAClass1: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },

          TestFirstMixinCAClass0: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
          TestFirstMixinCAClass1: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },

          TestSecondMixinCAClass0: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
          TestSecondMixinCAClass1: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },

          TestMixinClass: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.TestBaseClass",
            customAttributes: [
              { className: "TestSchema.TestCAClass0" },
              { className: "TestSchema.TestCAClass1" },
            ],
          },
          TestFirstMixinClass: {
            schemaItemType: "Mixin",
            baseClass: "TestSchema.TestMixinClass",
            appliesTo: "TestSchema.TestBaseClass",
            customAttributes: [
              { className: "TestSchema.TestFirstMixinCAClass0" },
              { className: "TestSchema.TestFirstMixinCAClass1" },
            ],
          },
          TestSecondMixinClass: {
            schemaItemType: "Mixin",
            baseClass: "TestSchema.TestMixinClass",
            appliesTo: "TestSchema.TestBaseClass",
            customAttributes: [
              { className: "TestSchema.TestSecondMixinCAClass0" },
              { className: "TestSchema.TestSecondMixinCAClass1" },
            ],
          },

          TestBaseClass: {
            schemaItemType: "EntityClass",
            mixins: ["TestSchema.TestMixinClass", "TestSchema.TestFirstMixinClass"],
            customAttributes: [
              { className: "TestSchema.TestFirstBaseCAClass0" },
              { className: "TestSchema.TestFirstBaseCAClass1" },
            ],
          },
          TestClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.TestBaseClass",
            mixins: ["TestSchema.TestFirstMixinClass", "TestSchema.TestSecondMixinClass"],
            customAttributes: [
              { className: "TestSchema.TestCAClass0" },
              { className: "TestSchema.TestCAClass1" },
            ],
          },
        },
      };

      schema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(schema).not.to.be.undefined;

      // testClass
      const testClass = schema.getItemSync("TestClass") as ECClass;
      expect(testClass).not.to.be.undefined;

      const testCAClass0 = testClass.customAttributes!.get("TestSchema.TestCAClass0");
      expect(testCAClass0).not.to.be.undefined;
      const testCAClass1 = testClass.customAttributes!.get("TestSchema.TestCAClass1");
      expect(testCAClass1).not.to.be.undefined;

      // testFirstBaseClass
      const testFirstBaseClass = schema.getItemSync("TestBaseClass") as ECClass;
      expect(testFirstBaseClass).not.to.be.undefined;

      const testFirstBaseCAClass0 = testFirstBaseClass.customAttributes!.get("TestSchema.TestFirstBaseCAClass0");
      expect(testFirstBaseCAClass0).not.to.be.undefined;
      const testFirstBaseCAClass1 = testFirstBaseClass.customAttributes!.get("TestSchema.TestFirstBaseCAClass1");
      expect(testFirstBaseCAClass1).not.to.be.undefined;

      // testMixinClass
      const testMixinClass = schema.getItemSync("TestMixinClass") as Mixin;
      expect(testMixinClass).not.to.be.undefined;

      const testMixinCAClass0 = testMixinClass.customAttributes!.get("TestSchema.TestCAClass0");
      expect(testMixinCAClass0).not.to.be.undefined;
      const testMixinCAClass1 = testMixinClass.customAttributes!.get("TestSchema.TestCAClass1");
      expect(testMixinCAClass1).not.to.be.undefined;

      // testFirstMixinClass
      const testFirstMixinClass = schema.getItemSync("TestFirstMixinClass") as Mixin;
      expect(testFirstMixinClass).not.to.be.undefined;

      const testFirstMixinCAClass0 = testFirstMixinClass.customAttributes!.get("TestSchema.TestFirstMixinCAClass0");
      expect(testFirstMixinCAClass0).not.to.be.undefined;
      const testFirstMixinCAClass1 = testFirstMixinClass.customAttributes!.get("TestSchema.TestFirstMixinCAClass1");
      expect(testFirstMixinCAClass1).not.to.be.undefined;

      // testSecondMixinClass
      const testSecondMixinClass = schema.getItemSync("TestSecondMixinClass") as Mixin;
      expect(testSecondMixinClass).not.to.be.undefined;

      const testSecondMixinCAClass0 = testSecondMixinClass.customAttributes!.get("TestSchema.TestSecondMixinCAClass0");
      expect(testSecondMixinCAClass0).not.to.be.undefined;
      const testSecondMixinCAClass1 = testSecondMixinClass.customAttributes!.get("TestSchema.TestSecondMixinCAClass1");
      expect(testSecondMixinCAClass1).not.to.be.undefined;

      // test inheritance custom attributes
      const testInheritanceCA = (inheritedCustomAttributes: CustomAttributeSet) => {
        expect(inheritedCustomAttributes.get("TestSchema.TestCAClass0")).to.be.equals(testCAClass0);
        expect(inheritedCustomAttributes.get("TestSchema.TestCAClass1")).to.be.equals(testCAClass1);
        expect(inheritedCustomAttributes.get("TestSchema.TestFirstBaseCAClass0")).to.be.equals(testFirstBaseCAClass0);
        expect(inheritedCustomAttributes.get("TestSchema.TestFirstBaseCAClass1")).to.be.equals(testFirstBaseCAClass1);

        expect(inheritedCustomAttributes.get("TestSchema.TestCAClass0")).not.to.be.equals(testMixinCAClass0);
        expect(inheritedCustomAttributes.get("TestSchema.TestCAClass1")).not.to.be.equals(testMixinCAClass1);
        expect(inheritedCustomAttributes.get("TestSchema.TestFirstMixinCAClass0")).to.be.equals(testFirstMixinCAClass0);
        expect(inheritedCustomAttributes.get("TestSchema.TestFirstMixinCAClass1")).to.be.equals(testFirstMixinCAClass1);
        expect(inheritedCustomAttributes.get("TestSchema.TestSecondMixinCAClass0")).to.be.equals(testSecondMixinCAClass0);
        expect(inheritedCustomAttributes.get("TestSchema.TestSecondMixinCAClass1")).to.be.equals(testSecondMixinCAClass1);
      };

      testInheritanceCA(await testClass.getCustomAttributes());
      testInheritanceCA(testClass.getCustomAttributesSync());
    });
  });

  describe("deserialization", () => {
    it("class with base class", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          testBaseClass: {
            schemaItemType: "EntityClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.testBaseClass",
          },
        },
      };

      schema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(schema);

      const testClass = await schema.getItem("testClass", EntityClass);
      assert.isDefined(testClass);
      assert.isDefined(await testClass!.baseClass);

      const baseClass = await schema.getItem("testBaseClass", EntityClass);
      assert.isDefined(baseClass);
      assert.isTrue(baseClass === await testClass!.baseClass);
      const derivedClasses = await baseClass?.getDerivedClasses();
      assert.isDefined(derivedClasses);
      assert.isTrue(derivedClasses?.length === 1);
      assert.isTrue(derivedClasses![0] === testClass);
    });

    it("class with base class in reference schema", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        references: [
          {
            name: "RefSchema",
            version: "1.0.5",
          },
        ],
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "RefSchema.BaseClassInRef",
          },
        },
      };

      const refSchema = new Schema(new SchemaContext(), "RefSchema", "ref", 1, 0, 5);
      const refBaseClass = await (refSchema as MutableSchema).createEntityClass("BaseClassInRef");

      const context = new SchemaContext();
      await context.addSchema(refSchema);

      schema = await Schema.fromJson(schemaJson, context);

      const testClass = await schema.getItem("testClass", EntityClass);

      assert.isDefined(testClass);
      assert.isDefined(await testClass!.baseClass);
      assert.isTrue(await testClass!.baseClass === refBaseClass);
      const derivedClasses = await refBaseClass?.getDerivedClasses();
      assert.isDefined(derivedClasses);
      assert.isTrue(derivedClasses?.length === 1);
      assert.isTrue(derivedClasses![0] === testClass);
    });

    it("should throw for missing base class", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.ClassDoesNotExist",
          },
        },
      };

      await expect(Schema.fromJson(schemaJson, new SchemaContext())).to.be.rejectedWith(ECSchemaError);
    });

    const oneCustomAttributeJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "TestSchema",
      version: "1.2.3",
      alias: "ts",
      items: {
        TestCAClass: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
        testClass: {
          schemaItemType: "EntityClass",
          customAttributes: [
            {
              className: "TestSchema.TestCAClass",
              ShowClasses: true,

            },
          ],
        },
      },
    };
    it("async - Deserialize One Custom Attribute", async () => {

      schema = await Schema.fromJson(oneCustomAttributeJson, new SchemaContext());

      const testClass = await schema.getItem("testClass", EntityClass);

      assert.isDefined(testClass);
      assert.isDefined(testClass!.customAttributes!.get("TestSchema.TestCAClass"));
      assert.isTrue(testClass!.customAttributes!.get("TestSchema.TestCAClass")!.ShowClasses);
    });
    it("sync - Deserialize One Custom Attribute", () => {
      schema = Schema.fromJsonSync(oneCustomAttributeJson, new SchemaContext());

      const testClass = schema.getItemSync("testClass", EntityClass);

      assert.isDefined(testClass);
      assert.isDefined(testClass!.customAttributes!.get("TestSchema.TestCAClass"));
      assert.isTrue(testClass!.customAttributes!.get("TestSchema.TestCAClass")!.ShowClasses);
    });
    const twoCustomAttributesJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "TestSchema",
      version: "1.2.3",
      alias: "ts",
      items: {
        TestCAClassA: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
        TestCAClassB: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
        testClass: {
          schemaItemType: "EntityClass",
          customAttributes: [
            {
              className: "TestSchema.TestCAClassA",
            },
            {
              className: "TestSchema.TestCAClassB",
            },
          ],
        },
      },
    };
    it("async - Deserialize Two Custom Attributes", async () => {

      schema = await Schema.fromJson(twoCustomAttributesJson, new SchemaContext());

      const testClass = await schema.getItem("testClass", EntityClass);

      assert.isDefined(testClass);
      assert.isDefined(testClass!.customAttributes!.get("TestSchema.TestCAClassA"));
      assert.isDefined(testClass!.customAttributes!.get("TestSchema.TestCAClassB"));
    });
    it("sync - Deserialize Two Custom Attributes", () => {
      schema = Schema.fromJsonSync(twoCustomAttributesJson, new SchemaContext());

      const testClass = schema.getItemSync("testClass", EntityClass);

      assert.isDefined(testClass);
      assert.isDefined(testClass!.customAttributes!.get("TestSchema.TestCAClassA"));
      assert.isDefined(testClass!.customAttributes!.get("TestSchema.TestCAClassB"));
    });
    const mustBeAnArrayJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "TestSchema",
      version: "1.2.3",
      alias: "ts",
      items: {
        testClass: {
          schemaItemType: "EntityClass",
          customAttributes: "ExampleCustomAttributes.ExampleSchema",
        },
      },
    };
    it("async - Custom Attributes must be an array", async () => {
      await expect(Schema.fromJson(mustBeAnArrayJson, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECClass TestSchema.testClass has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
    });
    it("sync - Custom Attributes must be an array", async () => {
      assert.throws(() => Schema.fromJsonSync(mustBeAnArrayJson, new SchemaContext()), ECSchemaError, `The ECClass TestSchema.testClass has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
    });
    it("sync - Deserialize Multiple Custom Attributes with additional properties", () => {
      const classJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          TestCAClassA: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
          TestCAClassB: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
          TestCAClassC: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
          testClass: {
            schemaItemType: "EntityClass",
            customAttributes: [
              {
                className: "TestSchema.TestCAClassA",
                ShowClasses: 1.2,
              },
              {
                className: "TestSchema.TestCAClassB",
                ExampleAttribute: true,
              },
              {
                className: "TestSchema.TestCAClassC",
                Example2Attribute: "example",
              },
            ],
          },
        },
      };
      schema = Schema.fromJsonSync(classJson, new SchemaContext());

      const testClass = schema.getItemSync("testClass", EntityClass);

      assert.isDefined(testClass);
      assert.isDefined(testClass!.customAttributes!.get("TestSchema.TestCAClassA"));
      assert.isDefined(testClass!.customAttributes!.get("TestSchema.TestCAClassB"));
      assert.isDefined(testClass!.customAttributes!.get("TestSchema.TestCAClassC"));
      assert.strictEqual(testClass!.customAttributes!.get("TestSchema.TestCAClassA")!.ShowClasses, 1.2);
      assert.isTrue(testClass!.customAttributes!.get("TestSchema.TestCAClassB")!.ExampleAttribute);
      assert.strictEqual(testClass!.customAttributes!.get("TestSchema.TestCAClassC")!.Example2Attribute, "example");
    });

    // Used to test that all property types are deserialized correctly. For failure and other tests look at the property
    // specific test files.
    it("with properties", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          testStruct: {
            schemaItemType: "StructClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                type: "PrimitiveProperty",
                typeName: "double",
                name: "testPrimProp",
              },
              {
                type: "StructProperty",
                name: "testStructProp",
                typeName: "TestSchema.testStruct",
              },
              {
                type: "PrimitiveArrayProperty",
                typeName: "string",
                name: "testPrimArrProp",
              },
              {
                type: "StructArrayProperty",
                name: "testStructArrProp",
                typeName: "TestSchema.testStruct",
              },
            ],
          },
        },
      };

      const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(ecSchema);

      const testEntity = await ecSchema.getItem("testClass", EntityClass);
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

  describe("deserialization sync", () => {
    it("Multiple classes with same base class, derived classes set properly", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          testBaseClass: {
            schemaItemType: "EntityClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.testBaseClass",
          },
          testClass2: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.testBaseClass",
          },
        },
      };

      schema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      assert.isDefined(schema);

      const testClass = schema.getItemSync("testClass", EntityClass);
      assert.isDefined(testClass);
      assert.isDefined(testClass!.getBaseClassSync());

      const testClass2 = schema.getItemSync("testClass2", EntityClass);
      assert.isDefined(testClass2);
      assert.isDefined(testClass2!.getBaseClassSync());

      const baseClass = schema.getItemSync("testBaseClass", EntityClass);
      assert.isDefined(baseClass);
      assert.isTrue(baseClass === testClass!.getBaseClassSync());
      const derivedClasses = await baseClass?.getDerivedClasses();
      assert.isDefined(derivedClasses);
      assert.isTrue(derivedClasses?.length === 2);
      assert.isTrue(derivedClasses![0] === testClass);
      assert.isTrue(derivedClasses![1] === testClass2);
    });

    it("class with base class in reference schema", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        references: [
          {
            name: "RefSchema",
            version: "1.0.5",
          },
        ],
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "RefSchema.BaseClassInRef",
          },
        },
      };

      const refSchema = new Schema(new SchemaContext(), "RefSchema", "ref", 1, 0, 5);
      const refBaseClass = (refSchema as MutableSchema).createEntityClassSync("BaseClassInRef");

      const context = new SchemaContext();
      context.addSchemaSync(refSchema);

      schema = Schema.fromJsonSync(schemaJson, context);

      const testClass = schema.getItemSync("testClass", EntityClass);

      assert.isDefined(testClass);
      assert.isDefined(testClass!.getBaseClassSync());
      assert.isTrue(testClass!.getBaseClassSync() === refBaseClass);
      const derivedClasses = await refBaseClass?.getDerivedClasses();
      assert.isDefined(derivedClasses);
      assert.isTrue(derivedClasses?.length === 1);
      assert.isTrue(derivedClasses![0] === testClass);
    });
    // Used to test that all property types are deserialized correctly. For failure and other tests look at the property
    // specific test files.
    it("with properties", () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          testStruct: {
            schemaItemType: "StructClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                type: "PrimitiveProperty",
                typeName: "double",
                name: "testPrimProp",
              },
              {
                type: "StructProperty",
                name: "testStructProp",
                typeName: "TestSchema.testStruct",
              },
              {
                type: "PrimitiveArrayProperty",
                typeName: "string",
                name: "testPrimArrProp",
              },
              {
                type: "StructArrayProperty",
                name: "testStructArrProp",
                typeName: "TestSchema.testStruct",
              },
            ],
          },
        },
      };

      const ecSchema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      assert.isDefined(ecSchema);

      const testEntity = ecSchema.getItemSync("testClass", EntityClass);
      assert.isDefined(testEntity);

      const testPrimProp = testEntity!.getPropertySync("testPrimProp");
      assert.isDefined(testPrimProp);
      const testPrimArrProp = testEntity!.getPropertySync("testPrimArrProp");
      assert.isDefined(testPrimArrProp);
      const testStructProp = testEntity!.getPropertySync("testStructProp");
      assert.isDefined(testStructProp);
      const testStructArrProp = testEntity!.getPropertySync("testStructArrProp");
      assert.isDefined(testStructArrProp);
    });
  });

  describe("toJSON", () => {
    function getTestSchemaJson(classJson: any = {}) {
      return {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          testBaseClass: {
            schemaItemType: "EntityClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.testBaseClass",
            properties: [
              {
                name: "ValidProp",
                description: "A really long description...",
                label: "SomeDisplayLabel",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 100,
                typeName: "double",
              },
            ],
            ...classJson,
          },
        },
      };
    }
    const schemaJsonOne = getTestSchemaJson();

    it("async - Simple serialization", async () => {
      schema = await Schema.fromJson(schemaJsonOne, new SchemaContext());
      assert.isDefined(schema);

      const testClass = await schema.getItem("testClass", EntityClass);
      assert.isDefined(testClass);
      expect(testClass).to.exist;
      const serialized = testClass!.toJSON(true, true);
      const expectedJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        name: "testClass",
        schema: "TestSchema",
        schemaVersion: "01.02.03",
        ...schemaJsonOne.items.testClass,
      };
      expect(serialized).eql(expectedJson);
    });

    it("async - JSON stringify serialization", async () => {
      schema = await Schema.fromJson(schemaJsonOne, new SchemaContext());
      assert.isDefined(schema);

      const testClass = await schema.getItem("testClass", EntityClass);
      assert.isDefined(testClass);
      expect(testClass).to.exist;
      const json = JSON.stringify(testClass);
      const serialized = JSON.parse(json);
      const expectedJson = {
        ...schemaJsonOne.items.testClass,
      };
      expect(serialized).eql(expectedJson);
    });

    it("should omit modifier if 'None'", async () => {
      schema = await Schema.fromJson(getTestSchemaJson({ modifier: "None" }), new SchemaContext());
      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).to.exist;
      expect(testClass!.toJSON(true, true)).to.not.have.property("modifier");
    });

    it("should include modifier if 'Abstract'", async () => {
      schema = await Schema.fromJson(getTestSchemaJson({ modifier: "Abstract" }), new SchemaContext());
      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).to.exist;
      expect(testClass!.toJSON(true, true)).to.include({ modifier: "Abstract" });
    });

    it("should include modifier if 'Sealed'", async () => {
      schema = await Schema.fromJson(getTestSchemaJson({ modifier: "Sealed" }), new SchemaContext());
      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).to.exist;
      expect(testClass!.toJSON(true, true)).to.include({ modifier: "Sealed" });
    });

    it("should omit customAttributes if empty", async () => {
      schema = await Schema.fromJson(getTestSchemaJson({ customAttributes: [] }), new SchemaContext());
      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).to.exist;
      expect(testClass!.toJSON(true, true)).to.not.have.property("customAttributes");
    });

    it("sync - Simple serialization", () => {
      schema = Schema.fromJsonSync(schemaJsonOne, new SchemaContext());
      assert.isDefined(schema);

      const testClass = schema.getItemSync("testClass", EntityClass);
      assert.isDefined(testClass);
      const serialized = testClass!.toJSON(true, true);
      const expectedJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        name: "testClass",
        schema: "TestSchema",
        schemaVersion: "01.02.03",
        ...schemaJsonOne.items.testClass,
      };
      expect(serialized).eql(expectedJson);
    });

    it("sync - JSON stringify serialization", async () => {
      schema = Schema.fromJsonSync(schemaJsonOne, new SchemaContext());
      assert.isDefined(schema);

      const testClass = await schema.getItem("testClass", EntityClass);
      assert.isDefined(testClass);
      const json = JSON.stringify(testClass);
      const serialized = JSON.parse(json);
      const expectedJson = {
        ...schemaJsonOne.items.testClass,
      };
      expect(serialized).eql(expectedJson);
    });

    const schemaJsonFive = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "TestSchema",
      version: "1.2.3",
      alias: "ts",
      items: {
        TestCAClassA: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyProperty" },
        TestCAClassB: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyProperty" },
        TestCAClassC: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyProperty" },
        testBaseClass: {
          schemaItemType: "EntityClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.testBaseClass",
          properties: [
            {
              name: "ValidProp",
              description: "A really long description...",
              label: "SomeDisplayLabel",
              type: "PrimitiveProperty",
              isReadOnly: true,
              priority: 100,
              typeName: "double",
              customAttributes: [
                {
                  className: "TestSchema.TestCAClassA",
                  ShowClasses: true,
                },
                {
                  className: "TestSchema.TestCAClassB",
                  FloatValue: 1.2,
                },
                {
                  className: "TestSchema.TestCAClassC",
                  IntegerValue: 5,
                },
              ],
            },
          ],
        },
      },
    };
    it("async - Serialization with multiple custom attributes- additional properties", async () => {
      schema = await Schema.fromJson(schemaJsonFive, new SchemaContext());
      assert.isDefined(schema);

      const testClass = await schema.getItem("testClass", EntityClass);
      assert.isDefined(testClass);
      const serialized = testClass!.toJSON(true, true);
      assert.isTrue(serialized.properties![0].customAttributes![0].ShowClasses);
      assert.strictEqual(serialized.properties![0].customAttributes![1].FloatValue, 1.2);
      assert.strictEqual(serialized.properties![0].customAttributes![2].IntegerValue, 5);
    });
    it("sync - Serialization with multiple custom attributes- additional properties", () => {
      schema = Schema.fromJsonSync(schemaJsonFive, new SchemaContext());
      assert.isDefined(schema);

      const testClass = schema.getItemSync("testClass", EntityClass);
      assert.isDefined(testClass);
      const serialized = testClass!.toJSON(true, true);
      assert.isTrue(serialized.properties![0].customAttributes![0].ShowClasses);
      assert.strictEqual(serialized.properties![0].customAttributes![1].FloatValue, 1.2);
      assert.strictEqual(serialized.properties![0].customAttributes![2].IntegerValue, 5);
    });
    const schemaJsonSix = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "TestSchema",
      version: "1.2.3",
      alias: "ts",
      items: {
        testBaseClass: {
          schemaItemType: "EntityClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.testBaseClass",
          properties: [
            {
              name: "A",
              type: "PrimitiveProperty",
              typeName: "double",
            },
            {
              name: "B",
              type: "PrimitiveProperty",
              typeName: "double",
            },
            {
              name: "C",
              type: "PrimitiveProperty",
              typeName: "double",
            },
            {
              name: "D",
              type: "PrimitiveProperty",
              typeName: "double",
            },
          ],
        },
      },
    };
    it("async - Serialization with proper order of properties", async () => {
      schema = await Schema.fromJson(schemaJsonSix, new SchemaContext());
      assert.isDefined(schema);

      const testClass = await schema.getItem("testClass", EntityClass);
      assert.isDefined(testClass);
      const serialized = testClass!.toJSON(true, true);
      assert.strictEqual(serialized.properties![0].name, "A");
      assert.strictEqual(serialized.properties![1].name, "B");
      assert.strictEqual(serialized.properties![2].name, "C");
      assert.strictEqual(serialized.properties![3].name, "D");
    });
    it("sync - Serialization with proper order of properties", () => {
      schema = Schema.fromJsonSync(schemaJsonSix, new SchemaContext());
      assert.isDefined(schema);

      const testClass = schema.getItemSync("testClass", EntityClass);
      assert.isDefined(testClass);
      const serialized = testClass!.toJSON(true, true);
      assert.strictEqual(serialized.properties![0].name, "A");
      assert.strictEqual(serialized.properties![1].name, "B");
      assert.strictEqual(serialized.properties![2].name, "C");
      assert.strictEqual(serialized.properties![3].name, "D");
    });
  });

  describe("toXml", () => {
    function getCustomAttribute(containerElement: Element, name: string): Element {
      const caElements = containerElement.getElementsByTagName("ECCustomAttributes");
      expect(caElements.length).to.equal(1, "Expected 1 ECCustomAttributes Element");
      const caElement = containerElement.getElementsByTagName(name);
      expect(caElement.length).to.equal(1, `Expected one CustomAttribute Element with the name '${name}`);
      return caElement[0];
    }

    function getCAPropertyValueElement(testSchema: Element, caName: string, propertyName: string): Element {
      const attribute = getCustomAttribute(testSchema, caName);
      const propArray = attribute.getElementsByTagName(propertyName);
      expect(propArray.length).to.equal(1, `Expected 1 CustomAttribute Property with the name '${propertyName}'`);
      return propArray[0];
    }

    function getSchemaJson(customAttributeJson?: any) {
      return {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        alias: "ts",
        version: "1.2.3",
        items: {
          ...customAttributeJson,
          testBaseClass: {
            schemaItemType: "EntityClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.testBaseClass",
            modifier: "Sealed",
            properties: [
              {
                name: "A",
                type: "PrimitiveProperty",
                typeName: "double",
              },
              {
                name: "B",
                type: "PrimitiveProperty",
                typeName: "double",
              },
              {
                name: "C",
                type: "PrimitiveProperty",
                typeName: "double",
              },
              {
                name: "D",
                type: "PrimitiveProperty",
                typeName: "double",
              },
            ],
          },
        },
      };
    }
    const newDom = createEmptyXmlDocument();

    it("Simple serialization", async () => {
      schema = await Schema.fromJson(getSchemaJson(), new SchemaContext());
      assert.isDefined(schema);

      const testClass = await schema.getItem("testClass", EntityClass);
      assert.isDefined(testClass);

      const serialized = await testClass!.toXml(newDom);
      expect(serialized.nodeName).to.eql("ECEntityClass");
      expect(serialized.getAttribute("typeName")).to.eql("testClass");
      expect(serialized.getAttribute("modifier")).to.eql("Sealed");
      const children = getElementChildren(serialized);
      assert.strictEqual(children.length, 5);

      const baseClasses = getElementChildrenByTagName(serialized, "BaseClass");
      assert.strictEqual(baseClasses.length, 1);
      const baseClass = baseClasses[0];
      expect(baseClass.textContent).to.eql("testBaseClass");

      const properties = getElementChildrenByTagName(serialized, "ECProperty");
      assert.strictEqual(properties.length, 4);
    });

    it("Serialization with base class in reference Schema, base type reference uses schema alias", async () => {
      const context = new SchemaContext();
      const refSchema = await Schema.fromJson(getSchemaJson(), context);
      const testClass = await refSchema.getItem("testClass") as ECClass;

      const testSchema = new Schema(context, "ChildSchema", "child", 1, 0, 5);
      const childClass = new EntityClass(testSchema, "TestClass");
      await (childClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(testClass.key, async () => testClass));
      (testSchema as MutableSchema).addItem(testClass);

      const serialized = await childClass.toXml(newDom);
      const baseClasses = getElementChildrenByTagName(serialized, "BaseClass");
      assert.strictEqual(baseClasses.length, 1);
      const baseClass = baseClasses[0];
      expect(baseClass.textContent).to.eql("ts:testClass");
    });

    /* it("Serialization with base class in reference Schema, no schema alias defined, throws", async () => {
      const context = new SchemaContext();
      const refSchema = new Schema(context, "BaseSchema", "bad", 1, 0, 5);
      const baseClass = new EntityClass(refSchema, "BaseClass");
      (refSchema as MutableSchema).addItem(baseClass);

      const testSchema = new Schema(context, "ChildSchema", "child", 1, 0, 5);
      const childClass = new EntityClass(testSchema, "TestClass");
      childClass.baseClass = new DelayedPromiseWithProps(baseClass!.key, async () => baseClass!);
      (testSchema as MutableSchema).addItem(childClass);

      await expect(childClass!.toXml(newDom)).to.be.rejectedWith(ECSchemaError, `The schema '${refSchema.name}' has an invalid alias.`);
    }); */

    it("Serialization with one custom attribute defined in ref schema, only class name", async () => {
      const context = new SchemaContext();
      const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
      const refCAClass = await (refSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
      assert.isDefined(refCAClass);
      await context.addSchema(refSchema);
      const testSchema = await Schema.fromJson(getSchemaJson(), new SchemaContext());
      await (testSchema as MutableSchema).addReference(refSchema);
      const testClass = await testSchema.getItem("testClass", EntityClass) as ECClass as MutableClass;
      testClass.addCustomAttribute({ className: "RefSchema.TestCustomAttribute" });
      const serialized = await testClass.toXml(newDom);

      const attributeElement = getCustomAttribute(serialized, "TestCustomAttribute");
      expect(attributeElement.getAttribute("xmlns")).to.equal("RefSchema.01.00.05");
    });

    it("Serialization with one custom attribute defined in same schema, only class name", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
        },
      };
      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const testClass = await testSchema.getItem("testClass", EntityClass) as ECClass as MutableClass;
      testClass.addCustomAttribute({ className: "TestCustomAttribute" });
      const serialized = await testClass.toXml(newDom);

      const attributeElement = getCustomAttribute(serialized, "TestCustomAttribute");
      expect(attributeElement.getAttribute("xmlns")).to.be.empty;
    });

    it("Serialization with one custom attribute, with Primitive property values", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
          properties: [
            {
              type: "PrimitiveProperty",
              typeName: "boolean",
              name: "TrueBoolean",
            },
            {
              type: "PrimitiveProperty",
              typeName: "boolean",
              name: "FalseBoolean",
            },
            {
              type: "PrimitiveProperty",
              typeName: "int",
              name: "Integer",
            },
            {
              type: "PrimitiveProperty",
              typeName: "long",
              name: "Long",
            },
            {
              type: "PrimitiveProperty",
              typeName: "double",
              name: "Double",
            },
            {
              type: "PrimitiveProperty",
              typeName: "dateTime",
              name: "DateTime",
            },
            {
              type: "PrimitiveProperty",
              typeName: "dateTime",
              name: "DateTimeString",
            },
            {
              type: "PrimitiveProperty",
              typeName: "point2d",
              name: "Point2D",
            },
            {
              type: "PrimitiveProperty",
              typeName: "point3d",
              name: "Point3D",
            },
            {
              type: "PrimitiveProperty",
              typeName: "Bentley.Geometry.Common.IGeometry",
              name: "IGeometry",
            },
            {
              type: "PrimitiveProperty",
              typeName: "binary",
              name: "Binary",
            },
          ],
        },
      };

      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const testClass = await testSchema.getItem("testClass", EntityClass) as ECClass as MutableClass;

      const nowTicks = Date.now();
      const ca = {
        className: "TestCustomAttribute",
        TrueBoolean: true,
        FalseBoolean: false,
        Integer: 1,
        Long: 100,
        Double: 200,
        DateTime: new Date(nowTicks),
        DateTimeString: "2021-08-19T16:37:42.278",
        Point2D: { x: 100, y: 200 },
        Point3D: { x: 100, y: 200, z: 300 },
        IGeometry: "geometry",
        Binary: "binary",
      };

      testClass.addCustomAttribute(ca);
      const serialized = await testClass.toXml(newDom);
      const expectedTimeFromString  = new Date("2021-08-19T16:37:42.278").getTime();

      let element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "TrueBoolean");
      expect(element.textContent).to.equal("True");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "FalseBoolean");
      expect(element.textContent).to.equal("False");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Integer");
      expect(element.textContent).to.equal("1");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Long");
      expect(element.textContent).to.equal("100");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Double");
      expect(element.textContent).to.equal("200");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "DateTime");
      expect(element.textContent).to.equal(nowTicks.toString());
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "DateTimeString");
      expect(element.textContent).to.equal(expectedTimeFromString.toString());
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point2D");
      expect(element.textContent).to.equal("100,200");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point3D");
      expect(element.textContent).to.equal("100,200,300");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "IGeometry");
      expect(element.textContent).to.equal("geometry");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Binary");
      expect(element.textContent).to.equal("binary");
    });

    it("Serialization with one custom attribute, with PrimitiveArray property values", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
          properties: [
            {
              type: "PrimitiveArrayProperty",
              typeName: "boolean",
              name: "BooleanArray",
            },
          ],
        },
      };

      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const testClass = await testSchema.getItem("testClass", EntityClass) as ECClass as MutableClass;

      const ca = {
        className: "TestCustomAttribute",
        BooleanArray: [true, false, true],
      };

      testClass.addCustomAttribute(ca);
      const serialized = await testClass.toXml(newDom);

      const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "BooleanArray");
      const children = element.childNodes;
      expect(children.length).to.equal(3);
      expect(children[0].textContent).to.equal("True");
      expect(children[1].textContent).to.equal("False");
      expect(children[2].textContent).to.equal("True");
    });

    it("Serialization with one custom attribute, with Struct property value", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
          properties: [
            {
              type: "StructProperty",
              typeName: "TestSchema.TestStruct",
              name: "Struct",
            },
          ],
        },
        TestStruct: {
          schemaItemType: "StructClass",
          properties: [
            {
              type: "PrimitiveProperty",
              typeName: "int",
              name: "Integer",
            },
            {
              type: "PrimitiveProperty",
              typeName: "string",
              name: "String",
            },
          ],
        },
      };

      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const testClass = await testSchema.getItem("testClass", EntityClass) as ECClass as MutableClass;

      const ca = {
        className: "TestCustomAttribute",
        Struct: {
          Integer: 1,
          String: "test",
        },
      };

      testClass.addCustomAttribute(ca);
      const serialized = await testClass.toXml(newDom);

      const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Struct");
      const children = element.childNodes;
      expect(children.length).to.equal(2);
      expect(children[0].textContent).to.equal("1");
      expect(children[1].textContent).to.equal("test");
    });

    it("Serialization with one custom attribute, with StructArray property value", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
          properties: [
            {
              type: "StructArrayProperty",
              typeName: "TestSchema.TestStruct",
              name: "StructArray",
            },
          ],
        },
        TestStruct: {
          schemaItemType: "StructClass",
          properties: [
            {
              type: "PrimitiveProperty",
              typeName: "int",
              name: "Integer",
            },
            {
              type: "PrimitiveProperty",
              typeName: "string",
              name: "String",
            },
          ],
        },
      };

      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const testClass = await testSchema.getItem("testClass", EntityClass) as ECClass as MutableClass;

      const ca = {
        className: "TestCustomAttribute",
        StructArray: [
          {
            Integer: 1,
            String: "test1",
          },
          {
            Integer: 2,
            String: "test2",
          },
        ],
      };

      testClass.addCustomAttribute(ca);
      const serialized = await testClass.toXml(newDom);

      const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "StructArray");
      const structs = element.getElementsByTagName("TestStruct");
      expect(structs.length).to.equal(2);

      let prop1 = (structs[0]).getElementsByTagName("Integer");
      expect(prop1.length).to.equal(1);
      expect(prop1[0].textContent).to.equal("1");

      let prop2 = (structs[0]).getElementsByTagName("String");
      expect(prop2.length).to.equal(1);
      expect(prop2[0].textContent).to.equal("test1");

      prop1 = (structs[1]).getElementsByTagName("Integer");
      expect(prop1.length).to.equal(1);
      expect(prop1[0].textContent).to.equal("2");

      prop2 = (structs[1]).getElementsByTagName("String");
      expect(prop2.length).to.equal(1);
      expect(prop2[0].textContent).to.equal("test2");
    });
  });

  describe("Base class traversal tests", () => {
    // This is the class hierarchy used in this test. The numbers indicate override priority,
    // i.e., the order that they should be returned by testClass.getAllBaseClasses():
    //
    //  2[A]  3(B)  5(C)  7(D)          [] := EntityClass
    //     \   /     /     /            () := Mixin
    //    1[ G ]  4(E)  6(F)
    //        \    /     /
    //        [    H    ]
    //
    const testSchemaJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "TestSchema",
      version: "01.00.00",
      alias: "ts",
      items: {
        A: { schemaItemType: "EntityClass" },
        B: { schemaItemType: "Mixin", appliesTo: "TestSchema.A" },
        C: { schemaItemType: "Mixin", appliesTo: "TestSchema.A" },
        D: { schemaItemType: "Mixin", appliesTo: "TestSchema.A" },
        E: { schemaItemType: "Mixin", appliesTo: "TestSchema.A", baseClass: "TestSchema.C" },
        F: { schemaItemType: "Mixin", appliesTo: "TestSchema.A", baseClass: "TestSchema.D" },
        G: { schemaItemType: "EntityClass", baseClass: "TestSchema.A", mixins: ["TestSchema.B"] },
        H: { schemaItemType: "EntityClass", baseClass: "TestSchema.G", mixins: ["TestSchema.E", "TestSchema.F"] },
      },
    };

    const childSchemaJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "ChildSchema",
      version: "01.00.00",
      alias: "ts",
      references: [
        {
          name: "TestSchema",
          version: "1.0.0",
        },
      ],
      items: {
        I: { schemaItemType: "EntityClass", baseClass: "TestSchema.H" },
      },
    };

    const grandChildSchemaJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "GrandChildSchema",
      version: "01.00.00",
      alias: "ts",
      references: [
        {
          name: "ChildSchema",
          version: "1.0.0",
        },
      ],
      items: {
        J: { schemaItemType: "EntityClass", baseClass: "ChildSchema.I" },
      },
    };

    const expectedNames = ["G", "A", "B", "E", "C", "F", "D"];

    it("getAllBaseClasses, should correctly traverse a complex inheritance hierarchy", async () => {
      const actualNames: string[] = [];

      schema = await Schema.fromJson(testSchemaJson, new SchemaContext());
      expect(schema).to.exist;

      const testClass = await schema.getItem("H", ECClass);
      expect(testClass).to.exist;
      for await (const baseClass of testClass!.getAllBaseClasses()) {
        actualNames.push(baseClass.name);
      }

      expect(actualNames).to.eql(expectedNames);
    });

    it("getAllBaseClassesSync, should correctly traverse a complex inheritance hierarchy synchronously", () => {
      schema = Schema.fromJsonSync(testSchemaJson, new SchemaContext());
      expect(schema).to.exist;
      const testClass = schema.getItemSync("H", ECClass);
      expect(testClass).to.exist;

      const syncActualNames: string[] = [];
      for (const baseClass of testClass!.getAllBaseClassesSync()) {
        syncActualNames.push(baseClass.name);
      }
      expect(syncActualNames).to.eql(expectedNames);
    });

    const expectedCallBackObjects = [
      { name: "G", arg: "testArg" }, { name: "A", arg: "testArg" }, { name: "B", arg: "testArg" }, { name: "E", arg: "testArg" },
      { name: "C", arg: "testArg" }, { name: "F", arg: "testArg" }, { name: "D", arg: "testArg" },
    ];

    it("traverseBaseClasses, should correctly traverse a complex inheritance hierarchy", async () => {
      const result: Array<{ name: string, arg: string }> = [];

      schema = await Schema.fromJson(testSchemaJson, new SchemaContext());
      expect(schema).to.exist;

      const testClass = await schema.getItem("H", ECClass);
      expect(testClass).to.exist;

      await testClass!.traverseBaseClasses((ecClass, arg) => {
        result.push({ name: ecClass.name, arg });
        return false;
      }, "testArg");

      expect(result).to.eql(expectedCallBackObjects);
    });

    it("traverseBaseClassesSync, should correctly traverse a complex inheritance hierarchy synchronously", () => {
      const result: Array<{ name: string, arg: string }> = [];

      schema = Schema.fromJsonSync(testSchemaJson, new SchemaContext());
      expect(schema).to.exist;

      const testClass = schema.getItemSync("H");
      expect(testClass).to.exist;
      if(!ECClass.isECClass(testClass))
        assert.fail("Expected ECClass");

      testClass.traverseBaseClassesSync((ecClass, arg) => {
        result.push({ name: ecClass.name, arg });
        return false;
      }, "testArg");

      expect(result).to.eql(expectedCallBackObjects);
    });

    it("class 'is' a base class", async () => {
      schema = Schema.fromJsonSync(testSchemaJson, new SchemaContext());
      expect(schema).to.exist;

      const aClass = await schema.getItem("A", ECClass);
      const bClass = await schema.getItem("B", ECClass);
      const cClass = await schema.getItem("C", ECClass);
      const dClass = await schema.getItem("D", ECClass);
      const eClass = await schema.getItem("E", ECClass);
      const fClass = await schema.getItem("F", ECClass);
      const gClass = await schema.getItem("G", ECClass);
      const hClass = await schema.getItem("H", ECClass);

      expect(await hClass!.is(gClass!)).to.be.true;
      expect(await hClass!.is(aClass!)).to.be.true;
      expect(await hClass!.is(bClass!)).to.be.true;
      expect(await hClass!.is(eClass!)).to.be.true;
      expect(await hClass!.is(cClass!)).to.be.true;
      expect(await hClass!.is(fClass!)).to.be.true;
      expect(await hClass!.is(dClass!)).to.be.true;

      expect(await gClass!.is(eClass!)).to.be.false;
      expect(await gClass!.is(dClass!)).to.be.false;
      expect(await gClass!.is(hClass!)).to.be.false;
    });

    it("class 'is' a base class from different schema", async () => {
      const context = new SchemaContext();
      schema = await Schema.fromJson(testSchemaJson, context);
      const childSchema = await Schema.fromJson(childSchemaJson, context);
      const grandChildSchema = await Schema.fromJson(grandChildSchemaJson, context);

      const aClass = await schema.getItem("A", ECClass);
      const bClass = await schema.getItem("B", ECClass);
      const cClass = await schema.getItem("C", ECClass);
      const dClass = await schema.getItem("D", ECClass);
      const eClass = await schema.getItem("E", ECClass);
      const fClass = await schema.getItem("F", ECClass);
      const gClass = await schema.getItem("G", ECClass);
      const hClass = await schema.getItem("H", ECClass);
      const iClass = await childSchema.getItem("I", ECClass);
      const jClass = await grandChildSchema.getItem("J", ECClass);

      expect(await iClass!.is(gClass!)).to.be.true;
      expect(await iClass!.is(aClass!)).to.be.true;
      expect(await iClass!.is(bClass!)).to.be.true;
      expect(await iClass!.is(eClass!)).to.be.true;
      expect(await iClass!.is(cClass!)).to.be.true;
      expect(await iClass!.is(fClass!)).to.be.true;
      expect(await iClass!.is(dClass!)).to.be.true;
      expect(await iClass!.is(hClass!)).to.be.true;

      expect(await jClass!.is(gClass!)).to.be.true;
      expect(await jClass!.is(aClass!)).to.be.true;
      expect(await jClass!.is(bClass!)).to.be.true;
      expect(await jClass!.is(eClass!)).to.be.true;
      expect(await jClass!.is(cClass!)).to.be.true;
      expect(await jClass!.is(fClass!)).to.be.true;
      expect(await jClass!.is(dClass!)).to.be.true;
      expect(await jClass!.is(hClass!)).to.be.true;
      expect(await jClass!.is(iClass!)).to.be.true;

      expect(await gClass!.is(iClass!)).to.be.false;
      expect(await gClass!.is(jClass!)).to.be.false;
    });

    it("class 'is' a base class synchronous", () => {
      schema = Schema.fromJsonSync(testSchemaJson, new SchemaContext());
      expect(schema).to.exist;

      const aClass = schema.getItemSync("A", ECClass);
      const bClass = schema.getItemSync("B", ECClass);
      const cClass = schema.getItemSync("C", ECClass);
      const dClass = schema.getItemSync("D", ECClass);
      const eClass = schema.getItemSync("E", ECClass);
      const fClass = schema.getItemSync("F", ECClass);
      const gClass = schema.getItemSync("G", ECClass);
      const hClass = schema.getItemSync("H", ECClass);

      if(aClass === undefined ||
        bClass === undefined ||
        cClass === undefined ||
        dClass === undefined ||
        eClass === undefined ||
        fClass === undefined ||
        gClass === undefined ||
        hClass === undefined)
        assert.fail("Expected classes");

      expect(hClass.isSync(gClass)).to.be.true;
      expect(hClass.isSync(aClass)).to.be.true;
      expect(hClass.isSync(bClass)).to.be.true;
      expect(hClass.isSync(eClass)).to.be.true;
      expect(hClass.isSync(cClass)).to.be.true;
      expect(hClass.isSync(fClass)).to.be.true;
      expect(hClass.isSync(dClass)).to.be.true;

      expect(gClass.isSync(eClass)).to.be.false;
      expect(gClass.isSync(dClass)).to.be.false;
      expect(gClass.isSync(hClass)).to.be.false;
    });
  });

  describe("NavProperty on CustomAttributeClass", () => {
    function createSchemaJson(nestedJson: any): any {
      return createSchemaJsonWithItems({
        TestCA: {
          schemaItemType: "CustomAttributeClass",
          ...nestedJson,
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
        NavPropRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: ["TestSchema.TestEntity"],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: ["TestSchema.TestEntity"],
          },
        },
      });
    }

    it("should throw", async () => {
      const json = createSchemaJson({
        appliesTo: "Any",
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: "forward",
          },
        ],
      });

      await assert.isRejected(Schema.fromJson(json, new SchemaContext()), "The Navigation Property TestCA.testNavProp is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.");
    });

    it("should throw synchronously", () => {
      const json = createSchemaJson({
        appliesTo: "Any",
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: "forward",
          },
        ],
      });

      assert.throw(() => Schema.fromJsonSync(json, new SchemaContext()), "The Navigation Property TestCA.testNavProp is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.");
    });
  });

  describe("classesAreEqualByKey tests", () => {
    const schemaKeyA = new SchemaKey("SchemaTest", 1, 2, 3);
    const schemaKeyB = new SchemaKey("OtherTestSchema", 1, 2, 3);
    const schemaA = new Schema(new SchemaContext(), schemaKeyA, "test");
    const schemaB = new Schema(new SchemaContext(), schemaKeyB, "other");

    it("should return false if names do not match", () => {
      const testClassA = new Mixin(schemaA, "MixinA");
      const testClassB = new Mixin(schemaA, "MixinB");
      expect(SchemaItem.equalByKey(testClassA, testClassB)).to.be.false;
    });

    it("should return false if types do not match", () => {
      const testClassA = new Mixin(schemaA, "MixinA");
      const testClassB = new Mixin(schemaB, "MixinA");
      expect(SchemaItem.equalByKey(testClassA, testClassB)).to.be.false;
    });

    it("should return true if keys match", () => {
      const testClassA = new Mixin(schemaA, "MixinA");
      const testClassB = new Mixin(schemaA, "MixinA");
      expect(SchemaItem.equalByKey(testClassA, testClassB)).to.be.true;
    });
  });

  describe("isECClass tests", async () => {
    const testSchema = createSchemaJsonWithItems({
      TestMixin: {
        schemaItemType: "Mixin",
        baseClass: "TestSchema.BaseMixin",
        appliesTo: "TestSchema.TestEntity",
      },
      BaseMixin: {
        schemaItemType: "Mixin",
        appliesTo: "TestSchema.TestEntity",
      },
      TestEntity: {
        schemaItemType: "EntityClass",
        properties: [
          {
            type: "StructProperty",
            name: "testStructProp",
            typeName: "TestSchema.TestStruct",
          },
        ],
      },
      TestStruct: {
        schemaItemType: "StructClass",
      },
      TestCustomAttribute: {
        schemaItemType: "CustomAttributeClass",
        appliesTo: "AnyClass",
      },
      TestRelationship: {
        schemaItemType: "RelationshipClass",
        strength: "Embedding",
        strengthDirection: "Forward",
        modifier: "Sealed",
        source: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          constraintClasses: ["TestSchema.TestEntity"],
        },
        target: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          constraintClasses: ["TestSchema.TestEntity"],
        },
      },
    });

    it("should return false if class is undefined", () => {
      expect(ECClass.isECClass(undefined)).to.be.false;
    });

    it("should return true if object is of ECClass type", async () => {
      const schemaClass = await Schema.fromJson(testSchema, new SchemaContext());
      expect(schemaClass).to.exist;
      const testMixin = await schemaClass.getItem("TestMixin", Mixin);
      expect(ECClass.isECClass(testMixin)).to.be.true;
      const testEntity = await schemaClass.getItem("TestEntity", EntityClass);
      expect(ECClass.isECClass(testEntity)).to.be.true;
      const testStruct = await schemaClass.getItem("TestStruct", StructClass);
      expect(ECClass.isECClass(testStruct)).to.be.true;
      const testCustomAttribute = await schemaClass.getItem("TestCustomAttribute", CustomAttributeClass);
      expect(ECClass.isECClass(testCustomAttribute)).to.be.true;
      const testRelationship = await schemaClass.getItem("TestRelationship", RelationshipClass);
      expect(ECClass.isECClass(testRelationship)).to.be.true;
    });

    it("should return false if object is not of ECClass type", async () => {
      const schemaClass = await Schema.fromJson(testSchema, new SchemaContext());
      const testEntity = await schemaClass.getItem("TestEntity", EntityClass);
      const testStructProp = await testEntity!.getProperty("testStructProp");
      assert.isDefined(testStructProp);
      expect(ECClass.isECClass(testSchema)).to.be.false;
      expect(ECClass.isECClass(testStructProp)).to.be.false;
    });
  });
});
