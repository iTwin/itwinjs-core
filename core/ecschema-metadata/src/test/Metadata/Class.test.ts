/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, beforeEach, describe, expect, it } from "vitest";
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
import { expectAsyncToThrow, expectToThrow } from "../TestUtils/AssertionHelpers";

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
      expect(testClass).toBeDefined();
      expect(testBase).toBeDefined();
      expect(oneMoreClass).toBeDefined();
      const testClassPrimProp = await testClass!.getProperty("PrimProp", true);
      const testBasePrimProp = await testBase!.getProperty("PrimProp");
      const oneMoreClassPrimProp = await oneMoreClass!.getProperty("PrimProp");
      expect(testClassPrimProp).toBeDefined();
      expect(testBasePrimProp).toBeDefined();
      expect(oneMoreClassPrimProp).toBeDefined();
      expect(testClassPrimProp).not.toEqual(testBasePrimProp);
      expect(testClassPrimProp?.label).toEqual("DerivedProp");
      expect(oneMoreClassPrimProp?.label).toEqual("DerivedProp");
      expect(oneMoreClassPrimProp).toEqual(testClassPrimProp);
    });

    it("inherited properties from base class", async () => {
      const baseClass = new EntityClass(schema, "TestBase");
      const basePrimProp = await (baseClass as ECClass as MutableClass).createPrimitiveProperty("BasePrimProp");

      const entityClass = new EntityClass(schema, "TestClass");
      await (entityClass as ECClass as MutableClass).createPrimitiveProperty("PrimProp");
      await (entityClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(baseClass.key, async () => baseClass));

      expect(await entityClass.getProperty("BasePrimProp", true)).toBeUndefined();
      expect(await entityClass.getProperty("BasePrimProp", true)).toBeUndefined();
      expect(await entityClass.getProperty("BasePrimProp")).toEqual(basePrimProp);
      expect(await entityClass.getInheritedProperty("BasePrimProp")).toEqual(basePrimProp);
      expect(await entityClass.getInheritedProperty("PrimProp")).toBeUndefined();
    });

    it("inherited properties from base class synchronously", async () => {
      const baseClass = (schema as MutableSchema).createEntityClassSync("TestBase");
      const basePrimProp = (baseClass as ECClass as MutableClass).createPrimitivePropertySync("BasePrimProp");

      const entityClass = (schema as MutableSchema).createEntityClassSync("TestClass");
      (entityClass as ECClass as MutableClass).createPrimitivePropertySync("PrimProp");
      await (entityClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(baseClass.key, async () => baseClass));

      expect(entityClass.getPropertySync("BasePrimProp", true)).toBeUndefined();
      expect(entityClass.getPropertySync("BasePrimProp", true)).toBeUndefined();
      expect(entityClass.getPropertySync("BasePrimProp")).toEqual(basePrimProp);
      expect(entityClass.getInheritedPropertySync("BasePrimProp")).toEqual(basePrimProp);
      expect(entityClass.getInheritedPropertySync("PrimProp")).toBeUndefined();
    });

    it("case-insensitive search", async () => {
      const entityClass = new EntityClass(schema, "TestClass");
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp");

      expect(await entityClass.getProperty("TESTPROP")).toEqual(primProp);
      expect(await entityClass.getProperty("testprop")).toEqual(primProp);
      expect(await entityClass.getProperty("tEsTpRoP")).toEqual(primProp);
    });

    it("case-insensitive inherited property search", async () => {
      const baseClass = new EntityClass(schema, "BaseClass");
      const primProp = await (baseClass as ECClass as MutableClass).createPrimitiveProperty("TestProp");

      const entityClass = new EntityClass(schema, "TestClass");
      await (entityClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(baseClass.key, async () => baseClass));

      expect(await entityClass.getProperty("TESTPROP")).toEqual(primProp);
      expect(await entityClass.getProperty("testprop")).toEqual(primProp);
      expect(await entityClass.getProperty("tEsTpRoP")).toEqual(primProp);

      expect(await entityClass.getInheritedProperty("TESTPROP")).toEqual(primProp);
      expect(await entityClass.getInheritedProperty("testprop")).toEqual(primProp);
      expect(await entityClass.getInheritedProperty("tEsTpRoP")).toEqual(primProp);
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
      expect(await entityClass.getProperty("TestProp", true)).toBeUndefined();

      await (entityClass as ECClass as MutableClass).deleteProperty("TestProp");

      expect(entityClass.getPropertiesSync()).to.be.empty;
      expect(await entityClass.getProperty("TestProp", true)).toBeUndefined();
    });

    it("should do nothing when deleting property name that is not in class, synchronous", async () => {
      expect(entityClass.getPropertiesSync()).to.be.empty;
      expect(await entityClass.getProperty("TestProp", true)).toBeUndefined();

      (entityClass as ECClass as MutableClass).deletePropertySync("TestProp");

      expect(entityClass.getPropertiesSync()).to.be.empty;
      expect(await entityClass.getProperty("TestProp", true)).toBeUndefined();
    });

    it("should do nothing if a property is already deleted, synchronous", async () => {
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp");

      expect([...entityClass.getPropertiesSync()].length).toEqual(1);
      expect(await entityClass.getProperty("TestProp")).toEqual(primProp);

      (entityClass as ECClass as MutableClass).deletePropertySync("TestProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(0);
      expect(await entityClass.getProperty("TestProp")).toBeUndefined();

      (entityClass as ECClass as MutableClass).deletePropertySync("TestProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(0);
      expect(await entityClass.getProperty("TestProp")).toBeUndefined();
    });

    it("should do nothing if a property is already deleted", async () => {
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp");

      expect([...entityClass.getPropertiesSync()].length).toEqual(1);
      expect(await entityClass.getProperty("TestProp")).toEqual(primProp);

      await (entityClass as ECClass as MutableClass).deleteProperty("TestProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(0);
      expect(await entityClass.getProperty("TestProp")).toBeUndefined();

      await (entityClass as ECClass as MutableClass).deleteProperty("TestProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(0);
      expect(await entityClass.getProperty("TestProp")).toBeUndefined();
    });

    it("should add and delete properties by case-insensitive names", async () => {
      const primProp1 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp1");
      const primProp2 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp2");
      const primProp3 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp3");

      expect([...entityClass.getPropertiesSync()].length).toEqual(3);
      expect(await entityClass.getProperty("TestProp1")).toEqual(primProp1);
      expect(await entityClass.getProperty("TestProp2")).toEqual(primProp2);
      expect(await entityClass.getProperty("TestProp3")).toEqual(primProp3);

      await (entityClass as ECClass as MutableClass).deleteProperty("TestProp1");
      expect([...entityClass.getPropertiesSync()].length).toEqual(2);
      expect(await entityClass.getProperty("TestProp1")).toBeUndefined();

      await (entityClass as ECClass as MutableClass).deleteProperty("testprop2");
      expect([...entityClass.getPropertiesSync()].length).toEqual(1);
      expect(await entityClass.getProperty("TestProp2")).toBeUndefined();

      await (entityClass as ECClass as MutableClass).deleteProperty("TESTPROP3");
      expect([...entityClass.getPropertiesSync()].length).toEqual(0);
      expect(await entityClass.getProperty("TestProp3")).toBeUndefined();
    });

    it("should add and delete properties by case-insensitive names, synchronous", async () => {
      const primProp1 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp1");
      const primProp2 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp2");
      const primProp3 = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp3");

      expect([...entityClass.getPropertiesSync()].length).toEqual(3);
      expect(await entityClass.getProperty("TestProp1")).toEqual(primProp1);
      expect(await entityClass.getProperty("TestProp2")).toEqual(primProp2);
      expect(await entityClass.getProperty("TestProp3")).toEqual(primProp3);

      (entityClass as ECClass as MutableClass).deletePropertySync("TestProp1");
      expect([...entityClass.getPropertiesSync()].length).toEqual(2);
      expect(await entityClass.getProperty("TestProp1")).toBeUndefined();

      (entityClass as ECClass as MutableClass).deletePropertySync("testprop2");
      expect([...entityClass.getPropertiesSync()].length).toEqual(1);
      expect(await entityClass.getProperty("TestProp2")).toBeUndefined();

      (entityClass as ECClass as MutableClass).deletePropertySync("TESTPROP3");
      expect([...entityClass.getPropertiesSync()].length).toEqual(0);
      expect(await entityClass.getProperty("TestProp3")).toBeUndefined();
    });

    it("should delete for different kinds of properties", async () => {
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("PrimProp");
      const primArrProp = await (entityClass as ECClass as MutableClass).createPrimitiveArrayProperty("PrimArrProp");
      const structProp = await (entityClass as ECClass as MutableClass).createStructProperty("StructProp", new StructClass(schema, "TestStruct"));
      const structArrProp = await (entityClass as ECClass as MutableClass).createStructArrayProperty("StructArrProp", new StructClass(schema, "TestStruct"));
      const navProp = await (entityClass as MutableEntityClass).createNavigationProperty("NavProp", new RelationshipClass(schema, "TestRel"), StrengthDirection.Forward);

      expect([...entityClass.getPropertiesSync()].length).toEqual(5);
      expect(await entityClass.getProperty("PrimProp")).toEqual(primProp);
      expect(await entityClass.getProperty("PrimArrProp")).toEqual(primArrProp);
      expect(await entityClass.getProperty("StructProp")).toEqual(structProp);
      expect(await entityClass.getProperty("StructArrProp")).toEqual(structArrProp);
      expect(await entityClass.getProperty("NavProp")).toEqual(navProp);

      await (entityClass as ECClass as MutableClass).deleteProperty("PrimProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(4);
      expect(await entityClass.getProperty("PrimProp")).toBeUndefined();

      await (entityClass as ECClass as MutableClass).deleteProperty("PrimArrProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(3);
      expect(await entityClass.getProperty("PrimArrProp")).toBeUndefined();

      await (entityClass as ECClass as MutableClass).deleteProperty("StructProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(2);
      expect(await entityClass.getProperty("StructProp")).toBeUndefined();

      await (entityClass as ECClass as MutableClass).deleteProperty("StructArrProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(1);
      expect(await entityClass.getProperty("StructArrProp")).toBeUndefined();

      await (entityClass as ECClass as MutableClass).deleteProperty("NavProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(0);
      expect(await entityClass.getProperty("NavProp")).toBeUndefined();
    });

    it("should delete for different kinds of properties, synchronous", async () => {
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("PrimProp");
      const primArrProp = await (entityClass as ECClass as MutableClass).createPrimitiveArrayProperty("PrimArrProp");
      const structProp = await (entityClass as ECClass as MutableClass).createStructProperty("StructProp", new StructClass(schema, "TestStruct"));
      const structArrProp = await (entityClass as ECClass as MutableClass).createStructArrayProperty("StructArrProp", new StructClass(schema, "TestStruct"));
      const navProp = await (entityClass as MutableEntityClass).createNavigationProperty("NavProp", new RelationshipClass(schema, "TestRel"), StrengthDirection.Forward);

      expect([...entityClass.getPropertiesSync()].length).toEqual(5);
      expect(await entityClass.getProperty("PrimProp")).toEqual(primProp);
      expect(await entityClass.getProperty("PrimArrProp")).toEqual(primArrProp);
      expect(await entityClass.getProperty("StructProp")).toEqual(structProp);
      expect(await entityClass.getProperty("StructArrProp")).toEqual(structArrProp);
      expect(await entityClass.getProperty("NavProp")).toEqual(navProp);

      (entityClass as ECClass as MutableClass).deletePropertySync("PrimProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(4);
      expect(await entityClass.getProperty("PrimProp")).toBeUndefined();

      (entityClass as ECClass as MutableClass).deletePropertySync("PrimArrProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(3);
      expect(await entityClass.getProperty("PrimArrProp")).toBeUndefined();

      (entityClass as ECClass as MutableClass).deletePropertySync("StructProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(2);
      expect(await entityClass.getProperty("StructProp")).toBeUndefined();

      (entityClass as ECClass as MutableClass).deletePropertySync("StructArrProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(1);
      expect(await entityClass.getProperty("StructArrProp")).toBeUndefined();

      (entityClass as ECClass as MutableClass).deletePropertySync("NavProp");
      expect([...entityClass.getPropertiesSync()].length).toEqual(0);
      expect(await entityClass.getProperty("NavProp")).toBeUndefined();
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
      expect(localCustomAttributes).not.toBeUndefined();

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
      expect(schema).not.toBeUndefined();

      // testClass
      const testClass = schema.getItemSync("TestClass") as ECClass;
      expect(testClass).not.toBeUndefined();

      const testCAClass0 = testClass.customAttributes!.get("TestSchema.TestCAClass0");
      expect(testCAClass0).not.toBeUndefined();
      const testCAClass1 = testClass.customAttributes!.get("TestSchema.TestCAClass1");
      expect(testCAClass1).not.toBeUndefined();

      // testFirstBaseClass
      const testFirstBaseClass = schema.getItemSync("TestFirstBaseClass") as ECClass;
      expect(testFirstBaseClass).not.toBeUndefined();

      const testFirstBaseCAClass0 = testFirstBaseClass.customAttributes!.get("TestSchema.TestFirstBaseCAClass0");
      expect(testFirstBaseCAClass0).not.toBeUndefined();
      const testFirstBaseCAClass1 = testFirstBaseClass.customAttributes!.get("TestSchema.TestFirstBaseCAClass1");
      expect(testFirstBaseCAClass1).not.toBeUndefined();

      // testSecondBaseClass
      const testSecondBaseClass = schema.getItemSync("TestSecondBaseClass") as ECClass;
      expect(testSecondBaseClass).not.toBeUndefined();

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
      expect(schema).not.toBeUndefined();

      // testClass
      const testClass = schema.getItemSync("TestClass") as ECClass;
      expect(testClass).not.toBeUndefined();

      const testCAClass0 = testClass.customAttributes!.get("TestSchema.TestCAClass0");
      expect(testCAClass0).not.toBeUndefined();
      const testCAClass1 = testClass.customAttributes!.get("TestSchema.TestCAClass1");
      expect(testCAClass1).not.toBeUndefined();

      // testFirstBaseClass
      const testFirstBaseClass = schema.getItemSync("TestBaseClass") as ECClass;
      expect(testFirstBaseClass).not.toBeUndefined();

      const testFirstBaseCAClass0 = testFirstBaseClass.customAttributes!.get("TestSchema.TestFirstBaseCAClass0");
      expect(testFirstBaseCAClass0).not.toBeUndefined();
      const testFirstBaseCAClass1 = testFirstBaseClass.customAttributes!.get("TestSchema.TestFirstBaseCAClass1");
      expect(testFirstBaseCAClass1).not.toBeUndefined();

      // testMixinClass
      const testMixinClass = schema.getItemSync("TestMixinClass") as Mixin;
      expect(testMixinClass).not.toBeUndefined();

      const testMixinCAClass0 = testMixinClass.customAttributes!.get("TestSchema.TestCAClass0");
      expect(testMixinCAClass0).not.toBeUndefined();
      const testMixinCAClass1 = testMixinClass.customAttributes!.get("TestSchema.TestCAClass1");
      expect(testMixinCAClass1).not.toBeUndefined();

      // testFirstMixinClass
      const testFirstMixinClass = schema.getItemSync("TestFirstMixinClass") as Mixin;
      expect(testFirstMixinClass).not.toBeUndefined();

      const testFirstMixinCAClass0 = testFirstMixinClass.customAttributes!.get("TestSchema.TestFirstMixinCAClass0");
      expect(testFirstMixinCAClass0).not.toBeUndefined();
      const testFirstMixinCAClass1 = testFirstMixinClass.customAttributes!.get("TestSchema.TestFirstMixinCAClass1");
      expect(testFirstMixinCAClass1).not.toBeUndefined();

      // testSecondMixinClass
      const testSecondMixinClass = schema.getItemSync("TestSecondMixinClass") as Mixin;
      expect(testSecondMixinClass).not.toBeUndefined();

      const testSecondMixinCAClass0 = testSecondMixinClass.customAttributes!.get("TestSchema.TestSecondMixinCAClass0");
      expect(testSecondMixinCAClass0).not.toBeUndefined();
      const testSecondMixinCAClass1 = testSecondMixinClass.customAttributes!.get("TestSchema.TestSecondMixinCAClass1");
      expect(testSecondMixinCAClass1).not.toBeUndefined();

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
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();
      expect(await testClass!.baseClass).toBeDefined();

      const baseClass = await schema.getItem("testBaseClass", EntityClass);
      expect(baseClass).toBeDefined();
      expect(baseClass === await testClass!.baseClass).toBe(true);
      const derivedClasses = await baseClass?.getDerivedClasses();
      expect(derivedClasses).toBeDefined();
      expect(derivedClasses?.length === 1).toBe(true);
      expect(derivedClasses![0] === testClass).toBe(true);
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

      const context = new SchemaContext();
      const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
      const refBaseClass = await (refSchema as MutableSchema).createEntityClass("BaseClassInRef");
      await context.addSchema(refSchema);

      schema = await Schema.fromJson(schemaJson, context);

      const testClass = await schema.getItem("testClass", EntityClass);

      expect(testClass).toBeDefined();
      expect(await testClass!.baseClass).toBeDefined();
      expect(await testClass!.baseClass === refBaseClass).toBe(true);
      const derivedClasses = await refBaseClass?.getDerivedClasses();
      expect(derivedClasses).toBeDefined();
      expect(derivedClasses?.length === 1).toBe(true);
      expect(derivedClasses![0] === testClass).toBe(true);
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

      await expect(Schema.fromJson(schemaJson, new SchemaContext())).rejects.toThrow(ECSchemaError);
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

      expect(testClass).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClass")).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClass")!.ShowClasses).toBe(true);
    });
    it("sync - Deserialize One Custom Attribute", () => {
      schema = Schema.fromJsonSync(oneCustomAttributeJson, new SchemaContext());

      const testClass = schema.getItemSync("testClass", EntityClass);

      expect(testClass).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClass")).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClass")!.ShowClasses).toBe(true);
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

      expect(testClass).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClassA")).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClassB")).toBeDefined();
    });
    it("sync - Deserialize Two Custom Attributes", () => {
      schema = Schema.fromJsonSync(twoCustomAttributesJson, new SchemaContext());

      const testClass = schema.getItemSync("testClass", EntityClass);

      expect(testClass).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClassA")).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClassB")).toBeDefined();
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
      await expectAsyncToThrow(async () => Schema.fromJson(mustBeAnArrayJson, new SchemaContext()), ECSchemaError, `The ECClass TestSchema.testClass has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
    });
    it("sync - Custom Attributes must be an array", () => {
      expectToThrow(() => Schema.fromJsonSync(mustBeAnArrayJson, new SchemaContext()), ECSchemaError, `The ECClass TestSchema.testClass has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
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

      expect(testClass).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClassA")).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClassB")).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClassC")).toBeDefined();
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClassA")!.ShowClasses).toBe(1.2);
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClassB")!.ExampleAttribute).toBe(true);
      expect(testClass!.customAttributes!.get("TestSchema.TestCAClassC")!.Example2Attribute).toBe("example");
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
      expect(ecSchema).toBeDefined();

      const testEntity = await ecSchema.getItem("testClass", EntityClass);
      expect(testEntity).toBeDefined();

      const testPrimProp = await testEntity!.getProperty("testPrimProp");
      expect(testPrimProp).toBeDefined();
      const testPrimArrProp = await testEntity!.getProperty("testPrimArrProp");
      expect(testPrimArrProp).toBeDefined();
      const testStructProp = await testEntity!.getProperty("testStructProp");
      expect(testStructProp).toBeDefined();
      const testStructArrProp = await testEntity!.getProperty("testStructArrProp");
      expect(testStructArrProp).toBeDefined();
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
      expect(schema).toBeDefined();

      const testClass = schema.getItemSync("testClass", EntityClass);
      expect(testClass).toBeDefined();
      expect(testClass!.getBaseClassSync()).toBeDefined();

      const testClass2 = schema.getItemSync("testClass2", EntityClass);
      expect(testClass2).toBeDefined();
      expect(testClass2!.getBaseClassSync()).toBeDefined();

      const baseClass = schema.getItemSync("testBaseClass", EntityClass);
      expect(baseClass).toBeDefined();
      expect(baseClass === testClass!.getBaseClassSync()).toBe(true);
      const derivedClasses = await baseClass?.getDerivedClasses();
      expect(derivedClasses).toBeDefined();
      expect(derivedClasses?.length === 2).toBe(true);
      expect(derivedClasses![0] === testClass).toBe(true);
      expect(derivedClasses![1] === testClass2).toBe(true);
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

      const context = new SchemaContext();
      const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
      const refBaseClass = (refSchema as MutableSchema).createEntityClassSync("BaseClassInRef");
      context.addSchemaSync(refSchema);

      schema = Schema.fromJsonSync(schemaJson, context);

      const testClass = schema.getItemSync("testClass", EntityClass);

      expect(testClass).toBeDefined();
      expect(testClass!.getBaseClassSync()).toBeDefined();
      expect(testClass!.getBaseClassSync() === refBaseClass).toBe(true);
      const derivedClasses = await refBaseClass?.getDerivedClasses();
      expect(derivedClasses).toBeDefined();
      expect(derivedClasses?.length === 1).toBe(true);
      expect(derivedClasses![0] === testClass).toBe(true);
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
      expect(ecSchema).toBeDefined();

      const testEntity = ecSchema.getItemSync("testClass", EntityClass);
      expect(testEntity).toBeDefined();

      const testPrimProp = testEntity!.getPropertySync("testPrimProp");
      expect(testPrimProp).toBeDefined();
      const testPrimArrProp = testEntity!.getPropertySync("testPrimArrProp");
      expect(testPrimArrProp).toBeDefined();
      const testStructProp = testEntity!.getPropertySync("testStructProp");
      expect(testStructProp).toBeDefined();
      const testStructArrProp = testEntity!.getPropertySync("testStructArrProp");
      expect(testStructArrProp).toBeDefined();
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
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();
      expect(testClass).toBeDefined();
      const serialized = testClass!.toJSON(true, true);
      const expectedJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        name: "testClass",
        schema: "TestSchema",
        schemaVersion: "01.02.03",
        ...schemaJsonOne.items.testClass,
      };
      expect(serialized).toEqual(expectedJson);
    });

    it("async - JSON stringify serialization", async () => {
      schema = await Schema.fromJson(schemaJsonOne, new SchemaContext());
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();
      expect(testClass).toBeDefined();
      const json = JSON.stringify(testClass);
      const serialized = JSON.parse(json);
      const expectedJson = {
        ...schemaJsonOne.items.testClass,
      };
      expect(serialized).toEqual(expectedJson);
    });

    it("should omit modifier if 'None'", async () => {
      schema = await Schema.fromJson(getTestSchemaJson({ modifier: "None" }), new SchemaContext());
      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();
      expect(testClass!.toJSON(true, true)).to.not.have.property("modifier");
    });

    it("should include modifier if 'Abstract'", async () => {
      schema = await Schema.fromJson(getTestSchemaJson({ modifier: "Abstract" }), new SchemaContext());
      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();
      expect(testClass!.toJSON(true, true)).to.include({ modifier: "Abstract" });
    });

    it("should include modifier if 'Sealed'", async () => {
      schema = await Schema.fromJson(getTestSchemaJson({ modifier: "Sealed" }), new SchemaContext());
      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();
      expect(testClass!.toJSON(true, true)).to.include({ modifier: "Sealed" });
    });

    it("should omit customAttributes if empty", async () => {
      schema = await Schema.fromJson(getTestSchemaJson({ customAttributes: [] }), new SchemaContext());
      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();
      expect(testClass!.toJSON(true, true)).to.not.have.property("customAttributes");
    });

    it("sync - Simple serialization", () => {
      schema = Schema.fromJsonSync(schemaJsonOne, new SchemaContext());
      expect(schema).toBeDefined();

      const testClass = schema.getItemSync("testClass", EntityClass);
      expect(testClass).toBeDefined();
      const serialized = testClass!.toJSON(true, true);
      const expectedJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        name: "testClass",
        schema: "TestSchema",
        schemaVersion: "01.02.03",
        ...schemaJsonOne.items.testClass,
      };
      expect(serialized).toEqual(expectedJson);
    });

    it("sync - JSON stringify serialization", async () => {
      schema = Schema.fromJsonSync(schemaJsonOne, new SchemaContext());
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();
      const json = JSON.stringify(testClass);
      const serialized = JSON.parse(json);
      const expectedJson = {
        ...schemaJsonOne.items.testClass,
      };
      expect(serialized).toEqual(expectedJson);
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
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();
      const serialized = testClass!.toJSON(true, true);
      expect(serialized.properties![0].customAttributes![0].ShowClasses).toBe(true);
      expect(serialized.properties![0].customAttributes![1].FloatValue).toBe(1.2);
      expect(serialized.properties![0].customAttributes![2].IntegerValue).toBe(5);
    });
    it("sync - Serialization with multiple custom attributes- additional properties", () => {
      schema = Schema.fromJsonSync(schemaJsonFive, new SchemaContext());
      expect(schema).toBeDefined();

      const testClass = schema.getItemSync("testClass", EntityClass);
      expect(testClass).toBeDefined();
      const serialized = testClass!.toJSON(true, true);
      expect(serialized.properties![0].customAttributes![0].ShowClasses).toBe(true);
      expect(serialized.properties![0].customAttributes![1].FloatValue).toBe(1.2);
      expect(serialized.properties![0].customAttributes![2].IntegerValue).toBe(5);
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
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();
      const serialized = testClass!.toJSON(true, true);
      expect(serialized.properties![0].name).toBe("A");
      expect(serialized.properties![1].name).toBe("B");
      expect(serialized.properties![2].name).toBe("C");
      expect(serialized.properties![3].name).toBe("D");
    });
    it("sync - Serialization with proper order of properties", () => {
      schema = Schema.fromJsonSync(schemaJsonSix, new SchemaContext());
      expect(schema).toBeDefined();

      const testClass = schema.getItemSync("testClass", EntityClass);
      expect(testClass).toBeDefined();
      const serialized = testClass!.toJSON(true, true);
      expect(serialized.properties![0].name).toBe("A");
      expect(serialized.properties![1].name).toBe("B");
      expect(serialized.properties![2].name).toBe("C");
      expect(serialized.properties![3].name).toBe("D");
    });
  });

  describe("toXml", () => {
    function getCustomAttribute(containerElement: Element, name: string): Element {
      const caElements = containerElement.getElementsByTagName("ECCustomAttributes");
      expect(caElements.length).toBe(1);
      const caElement = containerElement.getElementsByTagName(name);
      expect(caElement.length).toBe(1);
      return caElement[0];
    }

    function getCAPropertyValueElement(testSchema: Element, caName: string, propertyName: string): Element {
      const attribute = getCustomAttribute(testSchema, caName);
      const propArray = attribute.getElementsByTagName(propertyName);
      expect(propArray.length).toBe(1);
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
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("testClass", EntityClass);
      expect(testClass).toBeDefined();

      const serialized = await testClass!.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECEntityClass");
      expect(serialized.getAttribute("typeName")).toEqual("testClass");
      expect(serialized.getAttribute("modifier")).toEqual("Sealed");
      const children = getElementChildren(serialized);
      expect(children.length).toBe(5);

      const baseClasses = getElementChildrenByTagName(serialized, "BaseClass");
      expect(baseClasses.length).toBe(1);
      const baseClass = baseClasses[0];
      expect(baseClass.textContent).toEqual("testBaseClass");

      const properties = getElementChildrenByTagName(serialized, "ECProperty");
      expect(properties.length).toBe(4);
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
      expect(baseClasses.length).toBe(1);
      const baseClass = baseClasses[0];
      expect(baseClass.textContent).toEqual("ts:testClass");
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

      await expect(childClass!.toXml(newDom)).rejects.toThrow(`The schema '${refSchema.name}' has an invalid alias.`);
    }); */

    it("Serialization with one custom attribute defined in ref schema, only class name", async () => {
      const context = new SchemaContext();
      const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
      const refCAClass = await (refSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
      expect(refCAClass).toBeDefined();
      await context.addSchema(refSchema);
      const testSchema = await Schema.fromJson(getSchemaJson(), new SchemaContext());
      await (testSchema as MutableSchema).addReference(refSchema);
      const testClass = await testSchema.getItem("testClass", EntityClass) as ECClass as MutableClass;
      testClass.addCustomAttribute({ className: "RefSchema.TestCustomAttribute" });
      const serialized = await testClass.toXml(newDom);

      const attributeElement = getCustomAttribute(serialized, "TestCustomAttribute");
      expect(attributeElement.getAttribute("xmlns")).toEqual("RefSchema.01.00.05");
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
      const expectedTimeFromString = new Date("2021-08-19T16:37:42.278").getTime();

      let element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "TrueBoolean");
      expect(element.textContent).toEqual("True");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "FalseBoolean");
      expect(element.textContent).toEqual("False");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Integer");
      expect(element.textContent).toEqual("1");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Long");
      expect(element.textContent).toEqual("100");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Double");
      expect(element.textContent).toEqual("200");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "DateTime");
      expect(element.textContent).toEqual(nowTicks.toString());
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "DateTimeString");
      expect(element.textContent).toEqual(expectedTimeFromString.toString());
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point2D");
      expect(element.textContent).toEqual("100,200");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point3D");
      expect(element.textContent).toEqual("100,200,300");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "IGeometry");
      expect(element.textContent).toEqual("geometry");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Binary");
      expect(element.textContent).toEqual("binary");
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
      expect(children.length).toEqual(3);
      expect(children[0].textContent).toEqual("True");
      expect(children[1].textContent).toEqual("False");
      expect(children[2].textContent).toEqual("True");
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
      expect(children.length).toEqual(2);
      expect(children[0].textContent).toEqual("1");
      expect(children[1].textContent).toEqual("test");
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
      expect(structs.length).toEqual(2);

      let prop1 = (structs[0]).getElementsByTagName("Integer");
      expect(prop1.length).toEqual(1);
      expect(prop1[0].textContent).toEqual("1");

      let prop2 = (structs[0]).getElementsByTagName("String");
      expect(prop2.length).toEqual(1);
      expect(prop2[0].textContent).toEqual("test1");

      prop1 = (structs[1]).getElementsByTagName("Integer");
      expect(prop1.length).toEqual(1);
      expect(prop1[0].textContent).toEqual("2");

      prop2 = (structs[1]).getElementsByTagName("String");
      expect(prop2.length).toEqual(1);
      expect(prop2[0].textContent).toEqual("test2");
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
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("H", ECClass);
      expect(testClass).toBeDefined();
      for await (const baseClass of testClass!.getAllBaseClasses()) {
        actualNames.push(baseClass.name);
      }

      expect(actualNames).toEqual(expectedNames);
    });

    it("getAllBaseClassesSync, should correctly traverse a complex inheritance hierarchy synchronously", () => {
      schema = Schema.fromJsonSync(testSchemaJson, new SchemaContext());
      expect(schema).toBeDefined();
      const testClass = schema.getItemSync("H", ECClass);
      expect(testClass).toBeDefined();

      const syncActualNames: string[] = [];
      for (const baseClass of testClass!.getAllBaseClassesSync()) {
        syncActualNames.push(baseClass.name);
      }
      expect(syncActualNames).toEqual(expectedNames);
    });

    const expectedCallBackObjects = [
      { name: "G", arg: "testArg" }, { name: "A", arg: "testArg" }, { name: "B", arg: "testArg" }, { name: "E", arg: "testArg" },
      { name: "C", arg: "testArg" }, { name: "F", arg: "testArg" }, { name: "D", arg: "testArg" },
    ];

    it("traverseBaseClasses, should correctly traverse a complex inheritance hierarchy", async () => {
      const result: Array<{ name: string, arg: string }> = [];

      schema = await Schema.fromJson(testSchemaJson, new SchemaContext());
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("H", ECClass);
      expect(testClass).toBeDefined();

      await testClass!.traverseBaseClasses((ecClass, arg) => {
        result.push({ name: ecClass.name, arg });
        return false;
      }, "testArg");

      expect(result).toEqual(expectedCallBackObjects);
    });

    it("traverseBaseClassesSync, should correctly traverse a complex inheritance hierarchy synchronously", () => {
      const result: Array<{ name: string, arg: string }> = [];

      schema = Schema.fromJsonSync(testSchemaJson, new SchemaContext());
      expect(schema).toBeDefined();

      const testClass = schema.getItemSync("H");
      expect(testClass).toBeDefined();
      if (!ECClass.isECClass(testClass))
        assert.fail("Expected ECClass");

      testClass.traverseBaseClassesSync((ecClass, arg) => {
        result.push({ name: ecClass.name, arg });
        return false;
      }, "testArg");

      expect(result).toEqual(expectedCallBackObjects);
    });

    it("class 'is' a base class", async () => {
      schema = Schema.fromJsonSync(testSchemaJson, new SchemaContext());
      expect(schema).toBeDefined();

      const aClass = await schema.getItem("A", ECClass);
      const bClass = await schema.getItem("B", ECClass);
      const cClass = await schema.getItem("C", ECClass);
      const dClass = await schema.getItem("D", ECClass);
      const eClass = await schema.getItem("E", ECClass);
      const fClass = await schema.getItem("F", ECClass);
      const gClass = await schema.getItem("G", ECClass);
      const hClass = await schema.getItem("H", ECClass);

      expect(await hClass!.is(gClass!)).toBe(true);
      expect(await hClass!.is(aClass!)).toBe(true);
      expect(await hClass!.is(bClass!)).toBe(true);
      expect(await hClass!.is(eClass!)).toBe(true);
      expect(await hClass!.is(cClass!)).toBe(true);
      expect(await hClass!.is(fClass!)).toBe(true);
      expect(await hClass!.is(dClass!)).toBe(true);

      expect(await gClass!.is(eClass!)).toBe(false);
      expect(await gClass!.is(dClass!)).toBe(false);
      expect(await gClass!.is(hClass!)).toBe(false);
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

      expect(await iClass!.is(gClass!)).toBe(true);
      expect(await iClass!.is(aClass!)).toBe(true);
      expect(await iClass!.is(bClass!)).toBe(true);
      expect(await iClass!.is(eClass!)).toBe(true);
      expect(await iClass!.is(cClass!)).toBe(true);
      expect(await iClass!.is(fClass!)).toBe(true);
      expect(await iClass!.is(dClass!)).toBe(true);
      expect(await iClass!.is(hClass!)).toBe(true);

      expect(await jClass!.is(gClass!)).toBe(true);
      expect(await jClass!.is(aClass!)).toBe(true);
      expect(await jClass!.is(bClass!)).toBe(true);
      expect(await jClass!.is(eClass!)).toBe(true);
      expect(await jClass!.is(cClass!)).toBe(true);
      expect(await jClass!.is(fClass!)).toBe(true);
      expect(await jClass!.is(dClass!)).toBe(true);
      expect(await jClass!.is(hClass!)).toBe(true);
      expect(await jClass!.is(iClass!)).toBe(true);

      expect(await gClass!.is(iClass!)).toBe(false);
      expect(await gClass!.is(jClass!)).toBe(false);
    });

    it("class 'is' a base class synchronous", () => {
      schema = Schema.fromJsonSync(testSchemaJson, new SchemaContext());
      expect(schema).toBeDefined();

      const aClass = schema.getItemSync("A", ECClass);
      const bClass = schema.getItemSync("B", ECClass);
      const cClass = schema.getItemSync("C", ECClass);
      const dClass = schema.getItemSync("D", ECClass);
      const eClass = schema.getItemSync("E", ECClass);
      const fClass = schema.getItemSync("F", ECClass);
      const gClass = schema.getItemSync("G", ECClass);
      const hClass = schema.getItemSync("H", ECClass);

      if (aClass === undefined ||
        bClass === undefined ||
        cClass === undefined ||
        dClass === undefined ||
        eClass === undefined ||
        fClass === undefined ||
        gClass === undefined ||
        hClass === undefined)
        assert.fail("Expected classes");

      expect(hClass.isSync(gClass)).toBe(true);
      expect(hClass.isSync(aClass)).toBe(true);
      expect(hClass.isSync(bClass)).toBe(true);
      expect(hClass.isSync(eClass)).toBe(true);
      expect(hClass.isSync(cClass)).toBe(true);
      expect(hClass.isSync(fClass)).toBe(true);
      expect(hClass.isSync(dClass)).toBe(true);

      expect(gClass.isSync(eClass)).toBe(false);
      expect(gClass.isSync(dClass)).toBe(false);
      expect(gClass.isSync(hClass)).toBe(false);
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

      await expectAsyncToThrow(async () => Schema.fromJson(json, new SchemaContext()), ECSchemaError, "The Navigation Property TestCA.testNavProp is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.");
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

      expectToThrow(() => Schema.fromJsonSync(json, new SchemaContext()), ECSchemaError, "The Navigation Property TestCA.testNavProp is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.");
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
      expect(SchemaItem.equalByKey(testClassA, testClassB)).toBe(false);
    });

    it("should return false if types do not match", () => {
      const testClassA = new Mixin(schemaA, "MixinA");
      const testClassB = new Mixin(schemaB, "MixinA");
      expect(SchemaItem.equalByKey(testClassA, testClassB)).toBe(false);
    });

    it("should return true if keys match", () => {
      const testClassA = new Mixin(schemaA, "MixinA");
      const testClassB = new Mixin(schemaA, "MixinA");
      expect(SchemaItem.equalByKey(testClassA, testClassB)).toBe(true);
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
      expect(ECClass.isECClass(undefined)).toBe(false);
    });

    it("should return true if object is of ECClass type", async () => {
      const schemaClass = await Schema.fromJson(testSchema, new SchemaContext());
      expect(schemaClass).toBeDefined();
      const testMixin = await schemaClass.getItem("TestMixin", Mixin);
      expect(ECClass.isECClass(testMixin)).toBe(true);
      const testEntity = await schemaClass.getItem("TestEntity", EntityClass);
      expect(ECClass.isECClass(testEntity)).toBe(true);
      const testStruct = await schemaClass.getItem("TestStruct", StructClass);
      expect(ECClass.isECClass(testStruct)).toBe(true);
      const testCustomAttribute = await schemaClass.getItem("TestCustomAttribute", CustomAttributeClass);
      expect(ECClass.isECClass(testCustomAttribute)).toBe(true);
      const testRelationship = await schemaClass.getItem("TestRelationship", RelationshipClass);
      expect(ECClass.isECClass(testRelationship)).toBe(true);
    });

    it("should return false if object is not of ECClass type", async () => {
      const schemaClass = await Schema.fromJson(testSchema, new SchemaContext());
      const testEntity = await schemaClass.getItem("TestEntity", EntityClass);
      const testStructProp = await testEntity!.getProperty("testStructProp");
      expect(testStructProp).toBeDefined();
      expect(ECClass.isECClass(testSchema)).toBe(false);
      expect(ECClass.isECClass(testStructProp)).toBe(false);
    });
  });
  describe("ECClassHierarchy tests", async () => {

    // Class having base class in a reference two levels up
    // Schema hierarchy:
    // TestRef2Schema: D, E
    // TestRef1Schema: C (extends D, applies to E), F (extends C), B (extends F)
    // TestSchema: A (extends B)
    //
    // Expected traversal order for A:
    // B -> F -> C -> D
    it("class having base class in a reference two levels up", async () => {
      const testSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.0.1",
        alias: "ts",
        references: [
          {
            name: "TestRef1Schema",
            version: "1.0.1",
          },
        ],
        items: {
          A: {
            schemaItemType: "EntityClass",
            baseClass: "TestRef1Schema.B",
          }
        }
      };

      const TestRef1Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestRef1Schema",
        version: "1.0.1",
        alias: "tr1",
        references: [
          {
            name: "TestRef2Schema",
            version: "1.0.1",
          },
        ],
        items: {
          C: {
            schemaItemType: "Mixin",
            baseClass: "TestRef2Schema.D",
            appliesTo: "TestRef2Schema.E"
          },
          F: {
            schemaItemType: "EntityClass",
            baseClass: "TestRef1Schema.C",
          },
          B: {
            schemaItemType: "EntityClass",
            baseClass: "TestRef1Schema.F",
          }
        }
      };

      const TestRef2Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestRef2Schema",
        version: "1.0.1",
        alias: "tr2",
        items: {
          D: {
            schemaItemType: "EntityClass",
          },
          E: {
            schemaItemType: "EntityClass",
          },
        }
      };

      const expectedClassList = [
        "B",
        "F",
        "C",
        "D",
      ];

      const context = new SchemaContext();
      const TestRef2SchemaInstance = await Schema.fromJson(TestRef2Schema, context);
      expect(TestRef2SchemaInstance).toBeDefined();
      const TestRef1SchemaInstance = await Schema.fromJson(TestRef1Schema, context);
      expect(TestRef1SchemaInstance).toBeDefined();
      const schema = await Schema.fromJson(testSchema, context);
      expect(schema).toBeDefined();

      const classA = await schema.getItem("A", ECClass);
      expect(classA).toBeDefined();
      const actualNames: string[] = [];
      for await (const baseClass of classA!.getAllBaseClasses()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });

    // Multiple schema references with mixins across boundaries
    // Schema hierarchy:
    // BaseSchema: A -> B
    // MixinSchema: C -> (applies to BaseSchema.A)
    // IntermediateSchema: D (extends C) -> E -> (applies to BaseSchema.B)
    // FinalSchema: F (extends BaseSchema.B, mixins: [D, E])
    //
    // Expected traversal order:
    // B -> A -> D -> C -> E
    it("multiple schema references with complex mixin inheritance", async () => {
      const baseSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "BaseSchema",
        version: "1.0.1",
        alias: "base",
        items: {
          A: {
            schemaItemType: "EntityClass",
          },
          B: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.A",
          }
        }
      };

      const mixinSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "MixinSchema",
        version: "1.0.1",
        alias: "mixin",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
        ],
        items: {
          C: {
            schemaItemType: "Mixin",
            appliesTo: "BaseSchema.A"
          }
        }
      };

      const intermediateSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "IntermediateSchema",
        version: "1.0.1",
        alias: "inter",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
          {
            name: "MixinSchema",
            version: "1.0.1",
          },
        ],
        items: {
          D: {
            schemaItemType: "Mixin",
            baseClass: "MixinSchema.C",
            appliesTo: "BaseSchema.A"
          },
          E: {
            schemaItemType: "Mixin",
            appliesTo: "BaseSchema.B"
          }
        }
      };

      const finalSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "FinalSchema",
        version: "1.0.1",
        alias: "final",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
          {
            name: "IntermediateSchema",
            version: "1.0.1",
          },
        ],
        items: {
          F: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.B",
            mixins: ["IntermediateSchema.D", "IntermediateSchema.E"]
          }
        }
      };

      const expectedClassList = [
        "B",
        "A",
        "D",
        "C",
        "E"
      ];

      const context = new SchemaContext();
      await Schema.fromJson(baseSchema, context);
      await Schema.fromJson(mixinSchema, context);
      await Schema.fromJson(intermediateSchema, context);
      const schema = await Schema.fromJson(finalSchema, context);

      const classF = await schema.getItem("F", ECClass);
      expect(classF).toBeDefined();

      const actualNames: string[] = [];
      for await (const baseClass of classF!.getAllBaseClasses()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });

    // Diamond inheritance pattern across multiple schemas
    // Schema hierarchy:
    // BaseSchema: A
    // LeftSchema: B -> A
    // RightSchema: C -> A
    // MiddleSchema: F -> B, mixins: [E -> C]
    // FinalSchema: G -> F
    //
    // Expected traversal order (depth-first):
    // F -> B -> A -> E -> C -> A
    it("diamond inheritance pattern across multiple schemas", async () => {
      const baseSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "BaseSchema",
        version: "1.0.1",
        alias: "base",
        items: {
          A: {
            schemaItemType: "EntityClass",
          }
        }
      };

      const leftSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "LeftSchema",
        version: "1.0.1",
        alias: "left",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
        ],
        items: {
          B: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.A",
          }
        }
      };

      const rightSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "RightSchema",
        version: "1.0.1",
        alias: "right",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
        ],
        items: {
          C: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.A",
          }
        }
      };

      const middleSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "MiddleSchema",
        version: "1.0.1",
        alias: "middle",
        references: [
          {
            name: "LeftSchema",
            version: "1.0.1",
          },
          {
            name: "RightSchema",
            version: "1.0.1",
          },
        ],
        items: {
          D: {
            schemaItemType: "Mixin",
            baseClass: "LeftSchema.B",
            appliesTo: "LeftSchema.B"
          },
          E: {
            schemaItemType: "Mixin",
            baseClass: "RightSchema.C",
            appliesTo: "RightSchema.C"
          },
          F: {
            schemaItemType: "EntityClass",
            baseClass: "LeftSchema.B",
            mixins: ["MiddleSchema.E"]
          }
        }
      };

      const finalSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "FinalSchema",
        version: "1.0.1",
        alias: "final",
        references: [
          {
            name: "MiddleSchema",
            version: "1.0.1",
          },
        ],
        items: {
          G: {
            schemaItemType: "EntityClass",
            baseClass: "MiddleSchema.F"
          }
        }
      };

      const expectedClassList = [
        "F",
        "B",
        "A",
        "E",
        "C",
        "A"
      ];

      const context = new SchemaContext();
      await Schema.fromJson(baseSchema, context);
      await Schema.fromJson(leftSchema, context);
      await Schema.fromJson(rightSchema, context);
      await Schema.fromJson(middleSchema, context);
      const schema = await Schema.fromJson(finalSchema, context);

      const classG = await schema.getItem("G", ECClass);
      expect(classG).toBeDefined();

      const actualNames: string[] = [];
      for await (const baseClass of classG!.getAllBaseClasses()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });

    // Deep inheritance chain across five schemas
    // Schema hierarchy:
    // Schema1: A
    // Schema2: B -> Schema1.A
    // Schema3: C -> Schema2.B
    // Schema4: D -> Schema3.C
    // Schema5: E -> Schema4.D
    //
    // Expected traversal order:
    // D -> C -> B -> A
    it("deep inheritance chain across five schemas", async () => {
      const schema1 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Schema1",
        version: "1.0.1",
        alias: "s1",
        items: {
          A: {
            schemaItemType: "EntityClass",
          }
        }
      };

      const schema2 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Schema2",
        version: "1.0.1",
        alias: "s2",
        references: [
          {
            name: "Schema1",
            version: "1.0.1",
          },
        ],
        items: {
          B: {
            schemaItemType: "EntityClass",
            baseClass: "Schema1.A",
          }
        }
      };

      const schema3 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Schema3",
        version: "1.0.1",
        alias: "s3",
        references: [
          {
            name: "Schema2",
            version: "1.0.1",
          },
        ],
        items: {
          C: {
            schemaItemType: "EntityClass",
            baseClass: "Schema2.B",
          }
        }
      };

      const schema4 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Schema4",
        version: "1.0.1",
        alias: "s4",
        references: [
          {
            name: "Schema3",
            version: "1.0.1",
          },
        ],
        items: {
          D: {
            schemaItemType: "EntityClass",
            baseClass: "Schema3.C",
          }
        }
      };

      const schema5 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Schema5",
        version: "1.0.1",
        alias: "s5",
        references: [
          {
            name: "Schema4",
            version: "1.0.1",
          },
        ],
        items: {
          E: {
            schemaItemType: "EntityClass",
            baseClass: "Schema4.D",
          }
        }
      };

      const expectedClassList = [
        "D",
        "C",
        "B",
        "A"
      ];

      const context = new SchemaContext();
      await Schema.fromJson(schema1, context);
      await Schema.fromJson(schema2, context);
      await Schema.fromJson(schema3, context);
      await Schema.fromJson(schema4, context);
      const schema = await Schema.fromJson(schema5, context);

      const classE = await schema.getItem("E", ECClass);
      expect(classE).toBeDefined();

      const actualNames: string[] = [];
      for await (const baseClass of classE!.getAllBaseClasses()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });

    // Complex mixin inheritance with multiple base mixins across schemas
    // Schema hierarchy:
    // BaseSchema: A, B -> A
    // MixinSchema1: C -> (applies to BaseSchema.A), D -> (applies to BaseSchema.A)
    // MixinSchema2: E -> C, F -> D
    // FinalSchema: G -> B, mixins: [E, F]
    //
    // Expected traversal order:
    // B -> A -> E -> C -> F -> D
    it("complex mixin inheritance with multiple base mixins across schemas", async () => {
      const baseSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "BaseSchema",
        version: "1.0.1",
        alias: "base",
        items: {
          A: {
            schemaItemType: "EntityClass",
          },
          B: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.A",
          }
        }
      };

      const mixinSchema1 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "MixinSchema1",
        version: "1.0.1",
        alias: "mixin1",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
        ],
        items: {
          C: {
            schemaItemType: "Mixin",
            appliesTo: "BaseSchema.A"
          },
          D: {
            schemaItemType: "Mixin",
            appliesTo: "BaseSchema.A"
          }
        }
      };

      const mixinSchema2 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "MixinSchema2",
        version: "1.0.1",
        alias: "mixin2",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
          {
            name: "MixinSchema1",
            version: "1.0.1",
          },
        ],
        items: {
          E: {
            schemaItemType: "Mixin",
            baseClass: "MixinSchema1.C",
            appliesTo: "BaseSchema.A"
          },
          F: {
            schemaItemType: "Mixin",
            baseClass: "MixinSchema1.D",
            appliesTo: "BaseSchema.A"
          }
        }
      };

      const finalSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "FinalSchema",
        version: "1.0.1",
        alias: "final",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
          {
            name: "MixinSchema2",
            version: "1.0.1",
          },
        ],
        items: {
          G: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.B",
            mixins: ["MixinSchema2.E", "MixinSchema2.F"]
          }
        }
      };

      const expectedClassList = [
        "B",
        "A",
        "E",
        "C",
        "F",
        "D"
      ];

      const context = new SchemaContext();
      await Schema.fromJson(baseSchema, context);
      await Schema.fromJson(mixinSchema1, context);
      await Schema.fromJson(mixinSchema2, context);
      const schema = await Schema.fromJson(finalSchema, context);

      const classG = await schema.getItem("G", ECClass);
      expect(classG).toBeDefined();

      const actualNames: string[] = [];
      for await (const baseClass of classG!.getAllBaseClasses()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });

    // Hierarchical schema dependencies with nested mixin inheritance
    // Schema hierarchy:
    // CoreSchema: A
    // Domain1Schema: B -> A, C -> (applies to CoreSchema.A)
    // Domain2Schema: D -> B, E -> C
    // Application1Schema: F -> D, G -> E
    // Application2Schema: H -> F, mixins: [G]
    //
    // Expected traversal order:
    // F -> D -> B -> A -> G -> E -> C
    it("hierarchical schema dependencies with nested mixin inheritance", async () => {
      const coreSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "CoreSchema",
        version: "1.0.1",
        alias: "core",
        items: {
          A: {
            schemaItemType: "EntityClass",
          }
        }
      };

      const domain1Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Domain1Schema",
        version: "1.0.1",
        alias: "d1",
        references: [
          {
            name: "CoreSchema",
            version: "1.0.1",
          },
        ],
        items: {
          B: {
            schemaItemType: "EntityClass",
            baseClass: "CoreSchema.A",
          },
          C: {
            schemaItemType: "Mixin",
            appliesTo: "CoreSchema.A"
          }
        }
      };

      const domain2Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Domain2Schema",
        version: "1.0.1",
        alias: "d2",
        references: [
          {
            name: "Domain1Schema",
            version: "1.0.1",
          },
        ],
        items: {
          D: {
            schemaItemType: "EntityClass",
            baseClass: "Domain1Schema.B",
          },
          E: {
            schemaItemType: "Mixin",
            baseClass: "Domain1Schema.C",
            appliesTo: "Domain1Schema.B"
          }
        }
      };

      const application1Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Application1Schema",
        version: "1.0.1",
        alias: "app1",
        references: [
          {
            name: "Domain1Schema",
            version: "1.0.1",
          },
          {
            name: "Domain2Schema",
            version: "1.0.1",
          },
        ],
        items: {
          F: {
            schemaItemType: "EntityClass",
            baseClass: "Domain2Schema.D",
          },
          G: {
            schemaItemType: "Mixin",
            baseClass: "Domain2Schema.E",
            appliesTo: "Domain1Schema.B"
          }
        }
      };

      const application2Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Application2Schema",
        version: "1.0.1",
        alias: "app2",
        references: [
          {
            name: "Application1Schema",
            version: "1.0.1",
          },
        ],
        items: {
          H: {
            schemaItemType: "EntityClass",
            baseClass: "Application1Schema.F",
            mixins: ["Application1Schema.G"]
          }
        }
      };

      const expectedClassList = [
        "F",
        "D",
        "B",
        "A",
        "G",
        "E",
        "C"
      ];

      const context = new SchemaContext();
      await Schema.fromJson(coreSchema, context);
      await Schema.fromJson(domain1Schema, context);
      await Schema.fromJson(domain2Schema, context);
      await Schema.fromJson(application1Schema, context);
      const schema = await Schema.fromJson(application2Schema, context);

      const classH = await schema.getItem("H", ECClass);
      expect(classH).toBeDefined();

      const actualNames: string[] = [];
      for await (const baseClass of classH!.getAllBaseClasses()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });
  });
  describe("ECClassHierarchy Sync tests", async () => {

    // Class having base class in a reference two levels up
    // Schema hierarchy:
    // TestRef2Schema: D, E
    // TestRef1Schema: C (extends D, applies to E), F (extends C), B (extends F)
    // TestSchema: A (extends B)
    //
    // Expected traversal order for A:
    // B -> F -> C -> D
    it("class having base class in a reference two levels up sync", () => {
      const testSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.0.1",
        alias: "ts",
        references: [
          {
            name: "TestRef1Schema",
            version: "1.0.1",
          },
        ],
        items: {
          A: {
            schemaItemType: "EntityClass",
            baseClass: "TestRef1Schema.B",
          }
        }
      };

      const TestRef1Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestRef1Schema",
        version: "1.0.1",
        alias: "tr1",
        references: [
          {
            name: "TestRef2Schema",
            version: "1.0.1",
          },
        ],
        items: {
          C: {
            schemaItemType: "Mixin",
            baseClass: "TestRef2Schema.D",
            appliesTo: "TestRef2Schema.E"
          },
          F: {
            schemaItemType: "EntityClass",
            baseClass: "TestRef1Schema.C",
          },
          B: {
            schemaItemType: "EntityClass",
            baseClass: "TestRef1Schema.F",
          }
        }
      };

      const TestRef2Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestRef2Schema",
        version: "1.0.1",
        alias: "tr2",
        items: {
          D: {
            schemaItemType: "EntityClass",
          },
          E: {
            schemaItemType: "EntityClass",
          },
        }
      };

      const expectedClassList = [
        "B",
        "F",
        "C",
        "D",
      ];

      const context = new SchemaContext();
      const TestRef2SchemaInstance = Schema.fromJsonSync(TestRef2Schema, context);
      expect(TestRef2SchemaInstance).toBeDefined();
      const TestRef1SchemaInstance = Schema.fromJsonSync(TestRef1Schema, context);
      expect(TestRef1SchemaInstance).toBeDefined();
      const schema = Schema.fromJsonSync(testSchema, context);
      expect(schema).toBeDefined();

      const classA = schema.getItemSync("A", ECClass);
      expect(classA).toBeDefined();
      const actualNames: string[] = [];
      for (const baseClass of classA!.getAllBaseClassesSync()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });

    // Multiple schema references with mixins across boundaries
    // Schema hierarchy:
    // BaseSchema: A -> B
    // MixinSchema: C -> (applies to BaseSchema.A)
    // IntermediateSchema: D (extends C) -> E -> (applies to BaseSchema.B)
    // FinalSchema: F (extends BaseSchema.B, mixins: [D, E])
    //
    // Expected traversal order:
    // B -> A -> D -> C -> E
    it("multiple schema references with complex mixin inheritance sync", () => {
      const baseSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "BaseSchema",
        version: "1.0.1",
        alias: "base",
        items: {
          A: {
            schemaItemType: "EntityClass",
          },
          B: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.A",
          }
        }
      };

      const mixinSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "MixinSchema",
        version: "1.0.1",
        alias: "mixin",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
        ],
        items: {
          C: {
            schemaItemType: "Mixin",
            appliesTo: "BaseSchema.A"
          }
        }
      };

      const intermediateSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "IntermediateSchema",
        version: "1.0.1",
        alias: "inter",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
          {
            name: "MixinSchema",
            version: "1.0.1",
          },
        ],
        items: {
          D: {
            schemaItemType: "Mixin",
            baseClass: "MixinSchema.C",
            appliesTo: "BaseSchema.A"
          },
          E: {
            schemaItemType: "Mixin",
            appliesTo: "BaseSchema.B"
          }
        }
      };

      const finalSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "FinalSchema",
        version: "1.0.1",
        alias: "final",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
          {
            name: "IntermediateSchema",
            version: "1.0.1",
          },
        ],
        items: {
          F: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.B",
            mixins: ["IntermediateSchema.D", "IntermediateSchema.E"]
          }
        }
      };

      const expectedClassList = [
        "B",
        "A",
        "D",
        "C",
        "E"
      ];

      const context = new SchemaContext();
      Schema.fromJsonSync(baseSchema, context);
      Schema.fromJsonSync(mixinSchema, context);
      Schema.fromJsonSync(intermediateSchema, context);
      const schema = Schema.fromJsonSync(finalSchema, context);

      const classF = schema.getItemSync("F", ECClass);
      expect(classF).toBeDefined();

      const actualNames: string[] = [];
      for (const baseClass of classF!.getAllBaseClassesSync()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });

    // Diamond inheritance pattern across multiple schemas
    // Schema hierarchy:
    // BaseSchema: A
    // LeftSchema: B -> A
    // RightSchema: C -> A
    // MiddleSchema: F -> B, mixins: [E -> C]
    // FinalSchema: G -> F
    //
    // Expected traversal order (depth-first):
    // F -> B -> A -> E -> C -> A
    it("diamond inheritance pattern across multiple schemas sync", () => {
      const baseSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "BaseSchema",
        version: "1.0.1",
        alias: "base",
        items: {
          A: {
            schemaItemType: "EntityClass",
          }
        }
      };

      const leftSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "LeftSchema",
        version: "1.0.1",
        alias: "left",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
        ],
        items: {
          B: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.A",
          }
        }
      };

      const rightSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "RightSchema",
        version: "1.0.1",
        alias: "right",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
        ],
        items: {
          C: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.A",
          }
        }
      };

      const middleSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "MiddleSchema",
        version: "1.0.1",
        alias: "middle",
        references: [
          {
            name: "LeftSchema",
            version: "1.0.1",
          },
          {
            name: "RightSchema",
            version: "1.0.1",
          },
        ],
        items: {
          D: {
            schemaItemType: "Mixin",
            baseClass: "LeftSchema.B",
            appliesTo: "LeftSchema.B"
          },
          E: {
            schemaItemType: "Mixin",
            baseClass: "RightSchema.C",
            appliesTo: "RightSchema.C"
          },
          F: {
            schemaItemType: "EntityClass",
            baseClass: "LeftSchema.B",
            mixins: ["MiddleSchema.E"]
          }
        }
      };

      const finalSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "FinalSchema",
        version: "1.0.1",
        alias: "final",
        references: [
          {
            name: "MiddleSchema",
            version: "1.0.1",
          },
        ],
        items: {
          G: {
            schemaItemType: "EntityClass",
            baseClass: "MiddleSchema.F"
          }
        }
      };

      const expectedClassList = [
        "F",
        "B",
        "A",
        "E",
        "C",
        "A"
      ];

      const context = new SchemaContext();
      Schema.fromJsonSync(baseSchema, context);
      Schema.fromJsonSync(leftSchema, context);
      Schema.fromJsonSync(rightSchema, context);
      Schema.fromJsonSync(middleSchema, context);
      const schema = Schema.fromJsonSync(finalSchema, context);
      const classG = schema.getItemSync("G", ECClass);
      expect(classG).toBeDefined();

      const actualNames: string[] = [];
      for (const baseClass of classG!.getAllBaseClassesSync()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });

    // Deep inheritance chain across five schemas
    // Schema hierarchy:
    // Schema1: A
    // Schema2: B -> Schema1.A
    // Schema3: C -> Schema2.B
    // Schema4: D -> Schema3.C
    // Schema5: E -> Schema4.D
    //
    // Expected traversal order:
    // D -> C -> B -> A
    it("deep inheritance chain across five schemas sync", () => {
      const schema1 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Schema1",
        version: "1.0.1",
        alias: "s1",
        items: {
          A: {
            schemaItemType: "EntityClass",
          }
        }
      };

      const schema2 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Schema2",
        version: "1.0.1",
        alias: "s2",
        references: [
          {
            name: "Schema1",
            version: "1.0.1",
          },
        ],
        items: {
          B: {
            schemaItemType: "EntityClass",
            baseClass: "Schema1.A",
          }
        }
      };

      const schema3 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Schema3",
        version: "1.0.1",
        alias: "s3",
        references: [
          {
            name: "Schema2",
            version: "1.0.1",
          },
        ],
        items: {
          C: {
            schemaItemType: "EntityClass",
            baseClass: "Schema2.B",
          }
        }
      };

      const schema4 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Schema4",
        version: "1.0.1",
        alias: "s4",
        references: [
          {
            name: "Schema3",
            version: "1.0.1",
          },
        ],
        items: {
          D: {
            schemaItemType: "EntityClass",
            baseClass: "Schema3.C",
          }
        }
      };

      const schema5 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Schema5",
        version: "1.0.1",
        alias: "s5",
        references: [
          {
            name: "Schema4",
            version: "1.0.1",
          },
        ],
        items: {
          E: {
            schemaItemType: "EntityClass",
            baseClass: "Schema4.D",
          }
        }
      };

      const expectedClassList = [
        "D",
        "C",
        "B",
        "A"
      ];

      const context = new SchemaContext();
      Schema.fromJsonSync(schema1, context);
      Schema.fromJsonSync(schema2, context);
      Schema.fromJsonSync(schema3, context);
      Schema.fromJsonSync(schema4, context);
      const schema = Schema.fromJsonSync(schema5, context);

      const classE = schema.getItemSync("E", ECClass);
      expect(classE).toBeDefined();

      const actualNames: string[] = [];
      for (const baseClass of classE!.getAllBaseClassesSync()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });

    // Complex mixin inheritance with multiple base mixins across schemas
    // Schema hierarchy:
    // BaseSchema: A, B -> A
    // MixinSchema1: C -> (applies to BaseSchema.A), D -> (applies to BaseSchema.A)
    // MixinSchema2: E -> C, F -> D
    // FinalSchema: G -> B, mixins: [E, F]
    //
    // Expected traversal order:
    // B -> A -> E -> C -> F -> D
    it("complex mixin inheritance with multiple base mixins across schemas sync", () => {
      const baseSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "BaseSchema",
        version: "1.0.1",
        alias: "base",
        items: {
          A: {
            schemaItemType: "EntityClass",
          },
          B: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.A",
          }
        }
      };

      const mixinSchema1 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "MixinSchema1",
        version: "1.0.1",
        alias: "mixin1",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
        ],
        items: {
          C: {
            schemaItemType: "Mixin",
            appliesTo: "BaseSchema.A"
          },
          D: {
            schemaItemType: "Mixin",
            appliesTo: "BaseSchema.A"
          }
        }
      };

      const mixinSchema2 = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "MixinSchema2",
        version: "1.0.1",
        alias: "mixin2",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
          {
            name: "MixinSchema1",
            version: "1.0.1",
          },
        ],
        items: {
          E: {
            schemaItemType: "Mixin",
            baseClass: "MixinSchema1.C",
            appliesTo: "BaseSchema.A"
          },
          F: {
            schemaItemType: "Mixin",
            baseClass: "MixinSchema1.D",
            appliesTo: "BaseSchema.A"
          }
        }
      };

      const finalSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "FinalSchema",
        version: "1.0.1",
        alias: "final",
        references: [
          {
            name: "BaseSchema",
            version: "1.0.1",
          },
          {
            name: "MixinSchema2",
            version: "1.0.1",
          },
        ],
        items: {
          G: {
            schemaItemType: "EntityClass",
            baseClass: "BaseSchema.B",
            mixins: ["MixinSchema2.E", "MixinSchema2.F"]
          }
        }
      };

      const expectedClassList = [
        "B",
        "A",
        "E",
        "C",
        "F",
        "D"
      ];

      const context = new SchemaContext();
      Schema.fromJsonSync(baseSchema, context);
      Schema.fromJsonSync(mixinSchema1, context);
      Schema.fromJsonSync(mixinSchema2, context);
      const schema = Schema.fromJsonSync(finalSchema, context);

      const classG = schema.getItemSync("G", ECClass);
      expect(classG).toBeDefined();

      const actualNames: string[] = [];
      for (const baseClass of classG!.getAllBaseClassesSync()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });

    // Hierarchical schema dependencies with nested mixin inheritance
    // Schema hierarchy:
    // CoreSchema: A
    // Domain1Schema: B -> A, C -> (applies to CoreSchema.A)
    // Domain2Schema: D -> B, E -> C
    // Application1Schema: F -> D, G -> E
    // Application2Schema: H -> F, mixins: [G]
    //
    // Expected traversal order:
    // F -> D -> B -> A -> G -> E -> C
    it("hierarchical schema dependencies with nested mixin inheritance sync", () => {
      const coreSchema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "CoreSchema",
        version: "1.0.1",
        alias: "core",
        items: {
          A: {
            schemaItemType: "EntityClass",
          }
        }
      };

      const domain1Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Domain1Schema",
        version: "1.0.1",
        alias: "d1",
        references: [
          {
            name: "CoreSchema",
            version: "1.0.1",
          },
        ],
        items: {
          B: {
            schemaItemType: "EntityClass",
            baseClass: "CoreSchema.A",
          },
          C: {
            schemaItemType: "Mixin",
            appliesTo: "CoreSchema.A"
          }
        }
      };

      const domain2Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Domain2Schema",
        version: "1.0.1",
        alias: "d2",
        references: [
          {
            name: "Domain1Schema",
            version: "1.0.1",
          },
        ],
        items: {
          D: {
            schemaItemType: "EntityClass",
            baseClass: "Domain1Schema.B",
          },
          E: {
            schemaItemType: "Mixin",
            baseClass: "Domain1Schema.C",
            appliesTo: "Domain1Schema.B"
          }
        }
      };

      const application1Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Application1Schema",
        version: "1.0.1",
        alias: "app1",
        references: [
          {
            name: "Domain1Schema",
            version: "1.0.1",
          },
          {
            name: "Domain2Schema",
            version: "1.0.1",
          },
        ],
        items: {
          F: {
            schemaItemType: "EntityClass",
            baseClass: "Domain2Schema.D",
          },
          G: {
            schemaItemType: "Mixin",
            baseClass: "Domain2Schema.E",
            appliesTo: "Domain1Schema.B"
          }
        }
      };

      const application2Schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "Application2Schema",
        version: "1.0.1",
        alias: "app2",
        references: [
          {
            name: "Application1Schema",
            version: "1.0.1",
          },
        ],
        items: {
          H: {
            schemaItemType: "EntityClass",
            baseClass: "Application1Schema.F",
            mixins: ["Application1Schema.G"]
          }
        }
      };

      const expectedClassList = [
        "F",
        "D",
        "B",
        "A",
        "G",
        "E",
        "C"
      ];

      const context = new SchemaContext();
      Schema.fromJsonSync(coreSchema, context);
      Schema.fromJsonSync(domain1Schema, context);
      Schema.fromJsonSync(domain2Schema, context);
      Schema.fromJsonSync(application1Schema, context);
      const schema = Schema.fromJsonSync(application2Schema, context);
      const classH = schema.getItemSync("H", ECClass);
      expect(classH).toBeDefined();

      const actualNames: string[] = [];
      for (const baseClass of classH!.getAllBaseClassesSync()) {
        actualNames.push(baseClass.name);
      }
      expect(actualNames).toEqual(expectedClassList);
    });
  });
});
