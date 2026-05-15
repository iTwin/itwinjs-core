/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert as bAssert } from "@itwin/core-bentley";
import { beforeEach, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { DelayedPromiseWithProps } from "../../DelayedPromise";
import { PrimitiveType, StrengthDirection } from "../../ECObjects";
import { ECSchemaError } from "../../Exception";
import { expectAsyncToThrow } from "../TestUtils/AssertionHelpers";
import { ECClass, MutableClass, StructClass } from "../../Metadata/Class";
import { CustomAttribute } from "../../Metadata/CustomAttribute";
import { EntityClass } from "../../Metadata/EntityClass";
import { Enumeration } from "../../Metadata/Enumeration";
import { KindOfQuantity } from "../../Metadata/KindOfQuantity";
import {
  EnumerationArrayProperty, EnumerationProperty, MutableProperty, NavigationProperty, PrimitiveArrayProperty, PrimitiveProperty, Property,
  StructArrayProperty, StructProperty,
} from "../../Metadata/Property";
import { PropertyCategory } from "../../Metadata/PropertyCategory";
import { RelationshipClass } from "../../Metadata/RelationshipClass";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { PropertyType } from "../../PropertyTypes";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";
import { TestSchemaLocater } from "../TestUtils/FormatTestHelper";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Property", () => {
  let testClass: EntityClass;
  let testCategory: PropertyCategory;
  let testKindOfQuantity: KindOfQuantity;
  let testEnumeration: Enumeration;
  let testStruct: StructClass;
  let testRelationship: RelationshipClass;

  class MockProperty extends Property implements MutableProperty {
    constructor(name: string, type: PropertyType = PropertyType.String) {
      super(testClass, name, type);
    }

    public override addCustomAttribute(customAttribute: CustomAttribute) {
      super.addCustomAttribute(customAttribute);
    }
  }

  beforeEach(async () => {
    const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
    const mutable = schema as MutableSchema;
    testClass = await mutable.createEntityClass("TestClass");
    testCategory = await mutable.createPropertyCategory("TestCategory");
    testKindOfQuantity = await mutable.createKindOfQuantity("TestKoQ");
    testEnumeration = await mutable.createEnumeration("TestEnumeration");
    testStruct = await mutable.createStructClass("TestStruct");
    testRelationship = await mutable.createRelationshipClass("TestRelationship");
  });

  describe("type guards", () => {
    let primitiveProperty: PrimitiveProperty;
    let enumProperty: EnumerationProperty;
    let structProperty: StructProperty;
    let navProperty: NavigationProperty;
    let primitiveArrayProperty: PrimitiveArrayProperty;
    let enumArrayProperty: EnumerationArrayProperty;
    let structArrayProperty: StructArrayProperty;

    beforeEach(() => {
      primitiveProperty = new PrimitiveProperty(testClass, "A");
      enumProperty = new EnumerationProperty(testClass, "B", new DelayedPromiseWithProps(testEnumeration.key, async () => testEnumeration));
      structProperty = new StructProperty(testClass, "C", testStruct);
      navProperty = new NavigationProperty(testClass, "D", new DelayedPromiseWithProps(testRelationship.key, async () => testRelationship));
      primitiveArrayProperty = new PrimitiveArrayProperty(testClass, "E");
      enumArrayProperty = new EnumerationArrayProperty(testClass, "F", new DelayedPromiseWithProps(testEnumeration.key, async () => testEnumeration));
      structArrayProperty = new StructArrayProperty(testClass, "G", testStruct);
    });

    it("should correctly determine when a property is an ArrayProperty", async () => {
      expect(primitiveProperty.isArray()).toEqual(false);
      expect(enumProperty.isArray()).toEqual(false);
      expect(structProperty.isArray()).toEqual(false);
      expect(navProperty.isArray()).toEqual(false);
      expect(primitiveArrayProperty.isArray()).toEqual(true);
      expect(enumArrayProperty.isArray()).toEqual(true);
      expect(structArrayProperty.isArray()).toEqual(true);
    });

    it("should correctly determine when a property is a PrimitiveProperty", async () => {
      expect(primitiveProperty.isPrimitive()).toEqual(true);
      expect(enumProperty.isPrimitive()).toEqual(true);
      expect(structProperty.isPrimitive()).toEqual(false);
      expect(navProperty.isPrimitive()).toEqual(false);
      expect(primitiveArrayProperty.isPrimitive()).toEqual(true);
      expect(enumArrayProperty.isPrimitive()).toEqual(true);
      expect(structArrayProperty.isPrimitive()).toEqual(false);
    });

    it("should correctly determine when a property is a StructProperty", async () => {
      expect(primitiveProperty.isStruct()).toEqual(false);
      expect(enumProperty.isStruct()).toEqual(false);
      expect(structProperty.isStruct()).toEqual(true);
      expect(navProperty.isStruct()).toEqual(false);
      expect(primitiveArrayProperty.isStruct()).toEqual(false);
      expect(enumArrayProperty.isStruct()).toEqual(false);
      expect(structArrayProperty.isStruct()).toEqual(true);
    });

    it("should correctly determine when a property is an EnumerationProperty", async () => {
      expect(primitiveProperty.isEnumeration()).toEqual(false);
      expect(enumProperty.isEnumeration()).toEqual(true);
      expect(structProperty.isEnumeration()).toEqual(false);
      expect(navProperty.isEnumeration()).toEqual(false);
      expect(primitiveArrayProperty.isEnumeration()).toEqual(false);
      expect(enumArrayProperty.isEnumeration()).toEqual(true);
      expect(structArrayProperty.isEnumeration()).toEqual(false);
    });

    it("should correctly determine when a property is a NavigationProperty", async () => {
      expect(primitiveProperty.isNavigation()).toEqual(false);
      expect(enumProperty.isNavigation()).toEqual(false);
      expect(structProperty.isNavigation()).toEqual(false);
      expect(navProperty.isNavigation()).toEqual(true);
      expect(primitiveArrayProperty.isNavigation()).toEqual(false);
      expect(enumArrayProperty.isNavigation()).toEqual(false);
      expect(structArrayProperty.isNavigation()).toEqual(false);
    });
  });

  describe("fromJson", () => {
    it("should successfully deserialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProp",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        type: "PrimitiveProperty",
        priority: 1000,
        isReadOnly: false,
        category: "TestSchema.TestCategory",
        kindOfQuantity: "TestSchema.TestKoQ",
      };
      const testProp = new MockProperty("TestProp");
      expect(testProp).toBeDefined();
      await testProp.fromJSON(propertyJson);
      expect(testProp.name).toEqual("TestProp");
      expect(testProp.label).toEqual("SomeDisplayLabel");
      expect(testProp.description).toEqual("A really long description...");
      expect(testProp.priority).toEqual(1000);
      expect(testProp.isReadOnly).toEqual(false);
      expect(await testProp.category).toEqual(testCategory);
      expect(await testProp.kindOfQuantity).toEqual(testKindOfQuantity);
      expect(testProp.propertyType).toEqual(PropertyType.String);
      expect(testProp.fullName).toEqual("TestClass.TestProp");
    });

    it("should throw for non-existent category", async () => {
      const testProp = new MockProperty("BadProp");
      // Also test for a PropertyCategory that doesn't exist
      const propertyJson = {
        name: "BadProp",
        type: "PrimitiveProperty",
        category: "TestSchema.NonExistentPropertyCategory",
      };
      await testProp.fromJSON(propertyJson);
      await expectAsyncToThrow(async () => testProp.category, ECSchemaError, `The Property BadProp has a 'category' ("TestSchema.NonExistentPropertyCategory") that cannot be found.`);

    });

    it("should throw for non-existent kindOfQuantity", async () => {
      const testProp = new MockProperty("BadProp");
      const propertyJson = {
        name: "BadProp",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.NonExistentKindOfQuantity",
      };
      await testProp.fromJSON(propertyJson);
      await expectAsyncToThrow(async () => testProp.kindOfQuantity, ECSchemaError, `The Property BadProp has a 'kindOfQuantity' ("TestSchema.NonExistentKindOfQuantity") that cannot be found.`);
    });
  });

  describe("toJSON", () => {
    it("Simple serialization", async () => {
      const propertyJson = {
        name: "ValidProp",
        description: "A really long description...",
        label: "SomeDisplayLabel",
        type: "PrimitiveProperty",
        isReadOnly: true,
        priority: 100,
      };
      const testProp = new MockProperty("ValidProp");
      await testProp.fromJSON(propertyJson);
      const serialized = testProp.toJSON();
      expect(serialized).toEqual({ ...propertyJson });
    });

    it("should omit undefined isReadOnly", async () => {
      const propertyJson = {
        name: "ValidProp",
        type: "PrimitiveProperty",
      };
      const testProp = new MockProperty("ValidProp");
      await testProp.fromJSON(propertyJson);
      expect(testProp.toJSON()).not.toHaveProperty("isReadOnly");
    });

    it("should include false isReadOnly", async () => {
      const propertyJson = {
        name: "ValidProp",
        type: "PrimitiveProperty",
        isReadOnly: false,
      };
      const testProp = new MockProperty("ValidProp");
      await testProp.fromJSON(propertyJson);
      expect(testProp.toJSON()).to.include({ isReadOnly: false });
    });

    it("should omit undefined priority", async () => {
      const propertyJson = {
        name: "ValidProp",
        type: "PrimitiveProperty",
      };
      const testProp = new MockProperty("ValidProp");
      await testProp.fromJSON(propertyJson);
      expect(testProp.toJSON()).not.toHaveProperty("priority");
    });

    it("should include 0 priority", async () => {
      const propertyJson = {
        name: "ValidProp",
        type: "PrimitiveProperty",
        priority: 0,
      };
      const testProp = new MockProperty("ValidProp");
      await testProp.fromJSON(propertyJson);
      expect(testProp.toJSON()).to.include({ priority: 0 });
    });

    it("should include kindOfQuantity", async () => {
      const propertyJson = {
        name: "ValidProp",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.TestKoQ",
      };
      const testProp = new MockProperty("ValidProp");
      await testProp.fromJSON(propertyJson);
      expect(testProp.toJSON()).to.include({ kindOfQuantity: "TestSchema.TestKoQ" });
    });

    it("should include category", async () => {
      const propertyJson = {
        name: "ValidProp",
        type: "PrimitiveProperty",
        category: "TestSchema.TestCategory",
      };
      const testProp = new MockProperty("ValidProp");
      await testProp.fromJSON(propertyJson);
      expect(testProp.toJSON()).to.include({ category: "TestSchema.TestCategory" });
    });

    it("should omit customAttributes if empty", async () => {
      const propertyJson = {
        name: "ValidProp",
        type: "PrimitiveProperty",
        customAttributes: [],
      };
      const testProp = new MockProperty("ValidProp");
      await testProp.fromJSON(propertyJson);
      expect(testProp.toJSON()).not.toHaveProperty("customAttributes");
    });

    it("Serialization with one custom attribute- only class name", async () => {
      const propertyJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        name: "ValidProp",
        type: "PrimitiveProperty",
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).toBeDefined();
      await testProp.fromJSON(propertyJson);
      testProp.addCustomAttribute({
        className: "CoreCustomAttributes.HiddenSchema",
      });
      const serialized = testProp.toJSON();
      expect(serialized.customAttributes![0].className, "CoreCustomAttributes.HiddenSchema");
    });
    it("Serialization with one custom attribute- additional properties", () => {
      const propertyJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        name: "ValidProp",
        type: "PrimitiveProperty",
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).toBeDefined();
      testProp.fromJSONSync(propertyJson);
      testProp.addCustomAttribute({
        className: "CoreCustomAttributes.HiddenSchema",
        ShowClasses: true,
      });
      const serialized = testProp.toJSON();
      expect(serialized.customAttributes![0].className, "CoreCustomAttributes.HiddenSchema");
      expect(serialized.customAttributes![0].ShowClasses);
    });
    it("Serialization with multiple custom attributes- only class name", async () => {
      const propertyJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        name: "ValidProp",
        type: "PrimitiveProperty",
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).toBeDefined();
      await testProp.fromJSON(propertyJson);
      testProp.addCustomAttribute({ className: "CoreCustomAttributes.HiddenSchema" });
      testProp.addCustomAttribute({ className: "CoreAttributes.HiddenSchema" });
      testProp.addCustomAttribute({ className: "CoreCustom.HiddenSchema" });
      const serialized = testProp.toJSON();
      expect(serialized.customAttributes![0].className, "CoreCustomAttributes.HiddenSchema");
      expect(serialized.customAttributes![1].className, "CoreAttributes.HiddenSchema");
      expect(serialized.customAttributes![2].className, "CoreCustom.HiddenSchema");
    });
    it("Serialization with multiple custom attributes- additional properties", async () => {
      const propertyJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        name: "ValidProp",
        type: "PrimitiveProperty",
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).toBeDefined();
      await testProp.fromJSON(propertyJson);
      testProp.addCustomAttribute({
        className: "CoreCustomAttributes.HiddenSchema",
        ShowClasses: true,
      });
      testProp.addCustomAttribute({
        className: "CoreAttributes.HiddenSchema",
        FloatValue: 1.2,
      });
      testProp.addCustomAttribute({
        className: "CoreCustom.HiddenSchema",
        IntegerValue: 5,
      });
      const serialized = testProp.toJSON();
      expect(serialized.customAttributes![0].ShowClasses).toBeDefined();
      expect(serialized.customAttributes![1].FloatValue).toBe(1.2);
      expect(serialized.customAttributes![2].IntegerValue).toBe(5);
    });
  });

  describe("toXml", () => {
    const newDom = createEmptyXmlDocument();

    function getCustomAttribute(containerElement: Element, name: string): Element {
      const caElements = containerElement.getElementsByTagName("ECCustomAttributes");
      expect(caElements.length).toBe(1);
      const caElement = containerElement.getElementsByTagName(name);
      expect(caElement.length).toBe(1);
      return caElement[0];
    }

    function getCAPropertyValueElement(schema: Element, caName: string, propertyName: string): Element {
      const attribute = getCustomAttribute(schema, caName);
      const propArray = attribute.getElementsByTagName(propertyName);
      expect(propArray.length).toBe(1);
      return propArray[0];
    }

    function getSchemaJson(customAttributeJson?: any) {
      return {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          ...customAttributeJson,
          testClass: {
            schemaItemType: "EntityClass",
            modifier: "Sealed",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
        },
      };
    }

    it("Simple serialization", async () => {
      const propertyJson = {
        name: "ValidProp",
        description: "A really long description...",
        label: "SomeDisplayLabel",
        type: "PrimitiveProperty",
        isReadOnly: true,
        priority: 100,
        kindOfQuantity: "TestSchema.TestKoQ",
        category: "TestSchema.TestCategory",
      };

      const testProp = new MockProperty("ValidProp");
      await testProp.fromJSON(propertyJson);
      const serialized = await testProp.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECProperty");
      expect(serialized.getAttribute("propertyName")).toEqual("ValidProp");
      expect(serialized.getAttribute("displayLabel")).toEqual("SomeDisplayLabel");
      expect(serialized.getAttribute("description")).toEqual("A really long description...");
      expect(serialized.getAttribute("readOnly")).toEqual("true");
      expect(serialized.getAttribute("priority")).toEqual("100");
      expect(serialized.getAttribute("kindOfQuantity")).toEqual("TestKoQ");
      expect(serialized.getAttribute("category")).toEqual("TestCategory");
    });

    it("Serialization with one custom attribute defined in ref schema, only class name", async () => {
      const context = new SchemaContext();
      const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
      const refCAClass = await (refSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
      expect(refCAClass);
      await context.addSchema(refSchema);
      const testSchema = await Schema.fromJson(getSchemaJson(), new SchemaContext());
      await (testSchema as MutableSchema).addReference(refSchema);
      const entityClass = await testSchema.getItem("testClass", EntityClass) as ECClass;
      const property = await entityClass.getProperty("TestProperty") as MutableProperty;
      property.addCustomAttribute({ className: "RefSchema.TestCustomAttribute" });
      const serialized = await property.toXml(newDom);

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
      const entityClass = await testSchema.getItem("testClass", EntityClass) as ECClass;
      const property = await entityClass.getProperty("TestProperty") as MutableProperty;
      property.addCustomAttribute({ className: "TestCustomAttribute" });
      const serialized = await property.toXml(newDom);

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
      const entityClass = await testSchema.getItem("testClass", EntityClass) as ECClass;
      const property = await entityClass.getProperty("TestProperty") as MutableProperty;

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

      property.addCustomAttribute(ca);
      const serialized = await property.toXml(newDom);
      const expectedTimeFromString  = new Date("2021-08-19T16:37:42.278").getTime();

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
      const entityClass = await testSchema.getItem("testClass", EntityClass) as ECClass;
      const property = await entityClass.getProperty("TestProperty") as MutableProperty;

      const ca = {
        className: "TestCustomAttribute",
        BooleanArray: [true, false, true],
      };

      property.addCustomAttribute(ca);
      const serialized = await property.toXml(newDom);

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
      const entityClass = await testSchema.getItem("testClass", EntityClass) as ECClass;
      const property = await entityClass.getProperty("TestProperty") as MutableProperty;

      const ca = {
        className: "TestCustomAttribute",
        Struct: {
          Integer: 1,
          String: "test",
        },
      };

      property.addCustomAttribute(ca);
      const serialized = await property.toXml(newDom);

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
      const entityClass = await testSchema.getItem("testClass", EntityClass) as ECClass;
      const property = await entityClass.getProperty("TestProperty") as MutableProperty;

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

      property.addCustomAttribute(ca);
      const serialized = await property.toXml(newDom);

      const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "StructArray");
      const structs = element.getElementsByTagName("TestStruct");
      expect(structs.length).toEqual(2);

      let prop1 = structs[0].getElementsByTagName("Integer");
      expect(prop1.length).toEqual(1);
      expect(prop1[0].textContent).toEqual("1");

      let prop2 = structs[0].getElementsByTagName("String");
      expect(prop2.length).toEqual(1);
      expect(prop2[0].textContent).toEqual("test1");

      prop1 = structs[1].getElementsByTagName("Integer");
      expect(prop1.length).toEqual(1);
      expect(prop1[0].textContent).toEqual("2");

      prop2 = structs[1].getElementsByTagName("String");
      expect(prop2.length).toEqual(1);
      expect(prop2[0].textContent).toEqual("test2");
    });
  });
});

describe("Custom Attributes", () => {
  function createSchemaJson(schemaItemJson: any): any {
    return createSchemaJsonWithItems({
      CaClass1: {
        schemaItemType: "CustomAttributeClass",
        appliesTo: "Any",
        properties: [
          {
            type: "PrimitiveProperty",
            typeName: "string",
            name: "CaProp",
          },
        ],
      },
      CaClass2: {
        schemaItemType: "CustomAttributeClass",
        appliesTo: "Any",
      },
      BaseBaseClass: {
        schemaItemType: "EntityClass",

        properties: [
          {
            type: "PrimitiveProperty",
            typeName: "int",
            name: "TestProp",
            customAttributes: [
              { className: "TestSchema.CaClass1" },
            ],
          },
        ],
      },
      MrMixin: {
        schemaItemType: "Mixin",
        appliesTo: "TestSchema.BaseBaseClass",
        properties: [
          {
            type: "PrimitiveProperty",
            name: "MrTestProp",
            typeName: "string",
            customAttributes: [
              { className: "TestSchema.CaClass1" },
            ],
          },
        ],
      },
      BaseClass: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.BaseBaseClass",
        mixins: ["TestSchema.MrMixin"],
        properties: [
          {
            type: "PrimitiveProperty",
            name: "TestProp2",
            typeName: "string",
            customAttributes: [
              { className: "TestSchema.CaClass1" },
            ],
          },
          {
            type: "PrimitiveProperty",
            name: "TestProp3",
            typeName: "string",
            customAttributes: [
              {
                className: "TestSchema.CaClass1",
                caProp: "Base",
              },
              { className: "TestSchema.CaClass2" },
            ],
          },
          {
            type: "PrimitiveProperty",
            name: "MrTestProp",
            typeName: "string",
          },
        ],
      },
      TestClass: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.BaseClass",
        properties: [
          {
            type: "PrimitiveProperty",
            name: "TestProp",
            typeName: "int",
          },
          {
            type: "PrimitiveProperty",
            name: "TestProp2",
            typeName: "string",
            customAttributes: [
              { className: "TestSchema.CaClass2" },
            ],
          },
          {
            type: "PrimitiveProperty",
            name: "TestProp3",
            typeName: "string",
            customAttributes: [
              {
                className: "TestSchema.CaClass1",
                caProp: "Derived",
              },
            ],
          },
          {
            type: "PrimitiveProperty",
            name: "MrTestProp",
            typeName: "string",
            customAttributes: [
              { className: "TestSchema.CaClass2" },
            ],
          },
        ],
      },
      ...schemaItemJson,
    });
  }

  const context: SchemaContext = new SchemaContext();
  const schema: Schema = Schema.fromJsonSync(createSchemaJson(""), context);

  it("Property CustomAttributes are inherited from base class", async () => {
    const testClass = schema.getItemSync("TestClass") as EntityClass;
    expect(testClass).toBeDefined();
    const testProp = testClass.getPropertySync("TestProp", false);
    expect(testProp).toBeDefined();
    const tpCustomAttributes = testProp!.getCustomAttributesSync();
    expect(tpCustomAttributes).toBeDefined();
    expect(tpCustomAttributes.has("TestSchema.CaClass1")).toBe(true);
  });

  it("Property CustomAttributes are merged with base class", async () => {
    const testClass = schema.getItemSync("TestClass") as EntityClass;
    expect(testClass).toBeDefined();
    const testProp = testClass.getPropertySync("TestProp2", false);
    expect(testProp).toBeDefined();
    const tpCustomAttributes = testProp!.getCustomAttributesSync();
    expect(tpCustomAttributes).toBeDefined();
    expect(tpCustomAttributes.has("TestSchema.CaClass1")).toBe(true);
    expect(tpCustomAttributes.has("TestSchema.CaClass2")).toBe(true);
  });

  it("Property CustomAttributes from derived property override those from base property", async () => {
    const testClass = schema.getItemSync("TestClass") as EntityClass;
    expect(testClass).toBeDefined();
    const testProp = testClass.getPropertySync("TestProp3", false);
    expect(testProp).toBeDefined();
    const tpCustomAttributes = testProp!.getCustomAttributesSync();
    expect(tpCustomAttributes).toBeDefined();
    const caInst1 = tpCustomAttributes.get("TestSchema.CaClass1");
    expect(caInst1).toBeDefined();
    expect(caInst1!.caProp).toEqual("Derived");
    expect(tpCustomAttributes.has("TestSchema.CaClass2")).toBe(true);
  });

  it("Property CustomAttributes are inherited from mixin", async () => {
    const testClass = schema.getItemSync("TestClass") as EntityClass;
    expect(testClass).toBeDefined();
    const testProp = testClass.getPropertySync("MrTestProp", false);
    expect(testProp).toBeDefined();
    const tpCustomAttributes = testProp!.getCustomAttributesSync();
    expect(tpCustomAttributes).toBeDefined();
    expect(tpCustomAttributes.has("TestSchema.CaClass1")).toBe(true);
    expect(tpCustomAttributes.has("TestSchema.CaClass2")).toBe(true);
  });
});

describe("PrimitiveProperty", () => {
  describe("fromJson", () => {
    let testProperty: PrimitiveProperty;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      testProperty = new PrimitiveProperty(testClass, "TestProperty", PrimitiveType.Double);
    });

    it("should successfully deserialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "double",
        minLength: 2,
        maxLength: 4,
        minValue: 6,
        maxValue: 8,
        extendedTypeName: "SomeExtendedType",
      };
      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);

      expect(testProperty.minLength).toEqual(2);
      expect(testProperty.maxLength).toEqual(4);
      expect(testProperty.minValue).toEqual(6);
      expect(testProperty.maxValue).toEqual(8);
      expect(testProperty.extendedTypeName).toEqual("SomeExtendedType");
    });

    it("should throw for mismatched typeName", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "string",
      };
      expect(testProperty).to.exist;
      await expectAsyncToThrow(async () => testProperty.fromJSON(propertyJson), ECSchemaError);
    });
  });

  describe("KindOfQuantity in referenced schema", () => {
    let testProperty: PrimitiveProperty;
    beforeEach(() => {
      const context = new SchemaContext();
      const referencedSchema = new Schema(context, "Reference", "ref", 1, 0, 0) as MutableSchema;
      referencedSchema.createKindOfQuantitySync("MyKindOfQuantity");

      const schema = new Schema(context, "TestSchema", "ts", 1, 0, 0) as MutableSchema;
      schema.addReferenceSync(referencedSchema);

      const testClass = schema.createEntityClassSync("TestClass") as ECClass as MutableClass;
      testProperty = testClass.createPrimitivePropertySync("Primitive", PrimitiveType.Double);
    });

    const propertyJson = {
      kindOfQuantity: "Reference.MyKindOfQuantity",
      name: "Primitive",
      type: "PrimitiveProperty",
      typeName: "double",
    };

    it("Should load KindOfQuantity synchronously", () => {
      testProperty.fromJSONSync(propertyJson);
      const koq = testProperty.getKindOfQuantitySync();
      bAssert(koq !== undefined);
      expect(koq.name, "MyKindOfQuantity");
    });

    it("Should load KindOfQuantity", async () => {
      await testProperty.fromJSON(propertyJson);
      const koq = await testProperty.kindOfQuantity;
      bAssert(koq !== undefined);
      expect(koq.name, "MyKindOfQuantity");
    });
  });

  describe("PropertyCategory in referenced schema", () => {
    let testProperty: PrimitiveProperty;
    beforeEach(() => {
      const context = new SchemaContext();
      const referencedSchema = new Schema(context, "Reference", "ref", 1, 0, 0) as MutableSchema;
      referencedSchema.createPropertyCategorySync("MyCategory");

      const schema = new Schema(context, "TestSchema", "ts", 1, 0, 0) as MutableSchema;
      schema.addReferenceSync(referencedSchema);

      const testClass = schema.createEntityClassSync("TestClass") as ECClass as MutableClass;
      testProperty = testClass.createPrimitivePropertySync("Primitive", PrimitiveType.Double);
    });

    const propertyJson = {
      category: "Reference.MyCategory",
      name: "Primitive",
      type: "PrimitiveProperty",
      typeName: "double",
    };

    it("Should load PropertyCategory synchronously", () => {
      testProperty.fromJSONSync(propertyJson);
      const cat = testProperty.getCategorySync();
      bAssert(cat !== undefined);
      expect(cat.name, "MyCategory");
    });

    it("Should load PropertyCategory", async () => {
      await testProperty.fromJSON(propertyJson);
      const cat = await testProperty.category;
      bAssert(cat !== undefined);
      expect(cat.name, "MyCategory");
    });
  });

  describe("toJSON", () => {
    let testProperty: PrimitiveProperty;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      testProperty = new PrimitiveProperty(testClass, "TestProperty", PrimitiveType.Double);
    });

    it("should successfully serialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "double",
        minLength: 2,
        maxLength: 4,
        minValue: 6,
        maxValue: 8,
        extendedTypeName: "SomeExtendedType",
      };
      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);
      const testPropSerialization = testProperty.toJSON();
      expect(testPropSerialization.minLength).toEqual(2);
      expect(testPropSerialization.maxLength).toEqual(4);
      expect(testPropSerialization.minValue).toEqual(6);
      expect(testPropSerialization.maxValue).toEqual(8);
      expect(testPropSerialization.extendedTypeName).toEqual("SomeExtendedType");
    });
  });

  describe("toXml", () => {
    let testProperty: PrimitiveProperty;
    const newDom = createEmptyXmlDocument();

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      testProperty = new PrimitiveProperty(testClass, "TestProperty", PrimitiveType.Double);
    });

    it("Simple serialization", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "double",
        minLength: 2,
        maxLength: 4,
        minValue: 6,
        maxValue: 8,
        extendedTypeName: "SomeExtendedType",
      };

      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);
      const serialized = await testProperty.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECProperty");
      expect(serialized.getAttribute("propertyName")).toEqual("TestProperty");
      expect(serialized.getAttribute("typeName")).toEqual("double");
      expect(serialized.getAttribute("minimumLength")).toEqual("2");
      expect(serialized.getAttribute("maximumLength")).toEqual("4");
      expect(serialized.getAttribute("minimumValue")).toEqual("6");
      expect(serialized.getAttribute("maximumValue")).toEqual("8");
      expect(serialized.getAttribute("extendedTypeName")).toEqual("SomeExtendedType");
    });
  });
});

describe("EnumerationProperty", () => {
  describe("fromJson", () => {
    let testProperty: EnumerationProperty;
    let testEnum: Enumeration;

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = await (schema as MutableSchema).createEntityClass("TestClass");
      testEnum = await (schema as MutableSchema).createEnumeration("TestEnum");
      testProperty = new EnumerationProperty(testClass, "TestProperty", new DelayedPromiseWithProps(testEnum.key, async () => testEnum));
    });

    it("should successfully deserialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "TestSchema.TestEnum",
      };
      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);
      expect(await testProperty.enumeration).toEqual(testEnum);
    });

    it("should throw for mismatched typeName", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "ThisDoesNotMatch",
      };
      expect(testProperty).to.exist;
      await expectAsyncToThrow(async () => testProperty.fromJSON(propertyJson), ECSchemaError);
    });
  });

  describe("toJSON", () => {
    let testProperty: EnumerationProperty;
    let testEnum: Enumeration;

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = await (schema as MutableSchema).createEntityClass("TestClass");
      testEnum = await (schema as MutableSchema).createEnumeration("TestEnum");
      testProperty = new EnumerationProperty(testClass, "TestProperty", new DelayedPromiseWithProps(testEnum.key, async () => testEnum));
    });

    it("should successfully serialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "TestSchema.TestEnum",
      };
      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);
      const testPropSerialization = testProperty.toJSON();
      expect(testPropSerialization.typeName, "TestSchema.TestEnum");
    });
  });

  describe("toXml", () => {
    let testProperty: EnumerationProperty;
    let testEnum: Enumeration;
    const newDom = createEmptyXmlDocument();

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = await (schema as MutableSchema).createEntityClass("TestClass");
      testEnum = await (schema as MutableSchema).createEnumeration("TestEnumeration");
      testProperty = new EnumerationProperty(testClass, "TestProperty", new DelayedPromiseWithProps(testEnum.key, async () => testEnum));
    });

    it("Simple serialization", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "TestSchema.TestEnumeration",
      };

      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);
      const serialized = await testProperty.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECProperty");
      expect(serialized.getAttribute("propertyName")).toEqual("TestProperty");
      expect(serialized.getAttribute("typeName")).toEqual("TestEnumeration");
    });

    it("Simple serialization with schema reference", async () => {
      const context = new SchemaContext();
      const referencedSchema = new Schema(context, "ReferenceSchema", "ref", 1, 0, 0) as MutableSchema;
      testEnum = referencedSchema.createEnumerationSync("TestEnumeration");
      const schema = new Schema(context, "TestSchema", "ts", 1, 0, 0) as MutableSchema;
      schema.addReferenceSync(referencedSchema);

      const testClass = schema.createEntityClassSync("TestClass") as ECClass as MutableClass;
      testProperty = new EnumerationProperty(testClass, "TestProperty", new DelayedPromiseWithProps(testEnum.key, async () => testEnum));

      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "ReferenceSchema.TestEnumeration",
      };

      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);
      const serialized = await testProperty.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECProperty");
      expect(serialized.getAttribute("propertyName")).toEqual("TestProperty");
      expect(serialized.getAttribute("typeName")).toEqual("ref:TestEnumeration");
    });
  });
});

describe("StructProperty", () => {
  describe("fromJson", () => {
    let testProperty: StructProperty;
    let testStruct: StructClass;

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = await (schema as MutableSchema).createEntityClass("TestClass");
      testStruct = await (schema as MutableSchema).createStructClass("TestStruct");
      testProperty = new StructProperty(testClass, "TestProperty", testStruct);
    });

    it("should successfully deserialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "StructProperty",
        typeName: "TestSchema.TestStruct",
      };
      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);
      expect(testProperty.structClass).toEqual(testStruct);
    });

    it("should throw for mismatched typeName", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "StructProperty",
        typeName: "ThisDoesNotMatch",
      };
      expect(testProperty).to.exist;
      await expectAsyncToThrow(async () => testProperty.fromJSON(propertyJson), ECSchemaError);
    });
  });

  describe("toJSON", () => {
    let testProperty: StructProperty;
    let testStruct: StructClass;

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = await (schema as MutableSchema).createEntityClass("TestClass");
      testStruct = await (schema as MutableSchema).createStructClass("TestStruct");
      testProperty = new StructProperty(testClass, "TestProperty", testStruct);
    });

    it("should successfully serialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "StructProperty",
        typeName: "TestSchema.TestStruct",
      };
      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);
      const testPropSerialization = testProperty.toJSON();
      expect(testPropSerialization.typeName, "TestSchema.TestStruct");
    });
  });

  describe("toXml", () => {
    let testProperty: StructProperty;
    let testStruct: StructClass;
    const newDom = createEmptyXmlDocument();

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = await (schema as MutableSchema).createEntityClass("TestClass");
      testStruct = await (schema as MutableSchema).createStructClass("TestStruct");
      testProperty = new StructProperty(testClass, "TestProperty", testStruct);
    });

    it("Simple serialization", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "StructProperty",
        typeName: "TestSchema.TestStruct",
      };
      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);
      const serialized = await testProperty.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECStructProperty");
      expect(serialized.getAttribute("typeName")).toEqual("TestStruct");
    });
  });
});

describe("PrimitiveArrayProperty", () => {
  describe("fromJson", () => {
    let testProperty: PrimitiveArrayProperty;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      testProperty = new PrimitiveArrayProperty(testClass, "TestProperty");
    });

    it("should successfully deserialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveArrayProperty",
        minOccurs: 2,
        maxOccurs: 4,
      };
      expect(testProperty).toBeDefined();
      await testProperty.fromJSON(propertyJson);

      expect(testProperty.minOccurs).toEqual(2);
      expect(testProperty.maxOccurs).toEqual(4);
    });

    describe("toJSON", () => {
      let testArrayProperty: PrimitiveArrayProperty;

      beforeEach(() => {
        const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
        const testClass = new EntityClass(schema, "TestClass");
        testArrayProperty = new PrimitiveArrayProperty(testClass, "TestProperty");
      });

      it("should successfully serialize valid JSON", async () => {
        const propertyJson = {
          name: "TestProperty",
          type: "PrimitiveArrayProperty",
          minOccurs: 2,
          maxOccurs: 4,
        };
        expect(testArrayProperty).toBeDefined();
        await testArrayProperty.fromJSON(propertyJson);
        const testPropSerialization = testArrayProperty.toJSON();
        expect(testPropSerialization.minOccurs).toEqual(2);
        expect(testPropSerialization.maxOccurs).toEqual(4);
      });
    });

    describe("toXml", () => {
      let testArrayProperty: PrimitiveArrayProperty;
      const newDom = createEmptyXmlDocument();

      beforeEach(() => {
        const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
        const testClass = new EntityClass(schema, "TestClass");
        testArrayProperty = new PrimitiveArrayProperty(testClass, "TestProperty");
      });

      it("Simple serialization", async () => {
        const propertyJson = {
          name: "TestProperty",
          type: "PrimitiveArrayProperty",
          minOccurs: 2,
          maxOccurs: 4,
        };
        expect(testArrayProperty).toBeDefined();
        await testArrayProperty.fromJSON(propertyJson);
        const serialized = await testArrayProperty.toXml(newDom);
        expect(serialized.nodeName).toEqual("ECArrayProperty");
        expect(serialized.getAttribute("minOccurs")).toEqual("2");
        expect(serialized.getAttribute("maxOccurs")).toEqual("4");
      });
    });
  });
});

describe("NavigationProperty (Deserialization not fully implemented)", () => {
  describe("toXml", () => {
    let testNavigationProperty: NavigationProperty;
    const newDom = createEmptyXmlDocument();

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      const relationshipClass = new RelationshipClass(schema, "TestRelationship");
      const lazyRelationship = new DelayedPromiseWithProps(relationshipClass.key, async () => relationshipClass);
      testNavigationProperty = new NavigationProperty(testClass, "TestProperty", lazyRelationship, StrengthDirection.Forward);
    });

    it("Simple serialization", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "NavigationProperty",
        relationshipName: "TestSchema.TestRelationship",
        direction: "Forward",
      };
      expect(testNavigationProperty).toBeDefined();
      await testNavigationProperty.fromJSON(propertyJson);
      const serialized = await testNavigationProperty.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECNavigationProperty");
      expect(serialized.getAttribute("relationshipName")).toEqual("TestRelationship");
      expect(serialized.getAttribute("direction")).toEqual("Forward");
    });
  });

  describe("isProperty", async () => {
    it("should return false if property is undefined", () => {
      const undefinedProperty = undefined;
      expect(Property.isProperty(undefinedProperty)).toBe(false);
    });

    it("should return true if object is of Property type", async () => {
      const testSchema = new Schema(new SchemaContext(), "testSchema", "ts", 12, 22, 93);
      const mutable = testSchema as MutableSchema;
      const testClass = await mutable.createEntityClass("TestClass");
      const testEnum = new Enumeration(testSchema, "TestEnumeration", PrimitiveType.Integer);
      const testStruct = await mutable.createStructClass("TestStruct");
      const testRelationship = await mutable.createRelationshipClass("TestRelationship");

      const primitiveProperty = new PrimitiveProperty(testClass, "A");
      expect(Property.isProperty(primitiveProperty)).toBe(true);
      const enumProperty = new EnumerationProperty(testClass, "B", new DelayedPromiseWithProps(testEnum.key, async () => testEnum));
      expect(Property.isProperty(enumProperty)).toBe(true);
      const structProperty = new StructProperty(testClass, "C", testStruct);
      expect(Property.isProperty(structProperty)).toBe(true);
      const navProperty = new NavigationProperty(testClass, "D", new DelayedPromiseWithProps(testRelationship.key, async () => testRelationship));
      expect(Property.isProperty(navProperty)).toBe(true);
      const primitiveArrayProperty = new PrimitiveArrayProperty(testClass, "E");
      expect(Property.isProperty(primitiveArrayProperty)).toBe(true);
      const enumArrayProperty = new EnumerationArrayProperty(testClass, "F", new DelayedPromiseWithProps(testEnum.key, async () => testEnum));
      expect(Property.isProperty(enumArrayProperty)).toBe(true);
      const structArrayProperty = new StructArrayProperty(testClass, "G", testStruct);
      expect(Property.isProperty(structArrayProperty)).toBe(true);
    });

    it("should return false if object is not of Property type", () => {
      const testSchema = new Schema(new SchemaContext(), "testSchema", "ts", 12, 22, 93);
      const testClass = new EntityClass(testSchema, "ExampleEntity");
      expect(Property.isProperty(testClass)).toBe(false);
      expect(Property.isProperty(testSchema)).toBe(false);
    });
  });
});

describe("should get property from baseProperty", () => {

  function createSchemaJson(schemaItemJson: any): any {
    return createSchemaJsonWithItems({

      // KOQ properties
      MyKindOfQuantity: {
        schemaItemType: "KindOfQuantity",
        name: "myKindOfQuantity",
        relativeError: 1.0,
        persistenceUnit: "Formats.IN",
      },
      OverrideKindOfQuantity: {
        schemaItemType: "KindOfQuantity",
        name: "OverrideKindOfQuantity",
        relativeError: 0.01,
        persistenceUnit: "Formats.M",
      },

      // category properties
      TestCategory: {
        schemaItemType: "PropertyCategory",
        type: "string",
        typeName: "testCategory"
      },

      BasebaseClass: {
        schemaItemType: "EntityClass",
        properties: [
          {
            type: "PrimitiveProperty",
            name: "TestProp2",
            typeName: "string",
            kindOfQuantity: "TestSchema.MyKindOfQuantity",
            category: "TestSchema.TestCategory",
            priority: 101,
          },
        ],
      },
      BaseClass: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.BasebaseClass",
        properties: [
          {
            type: "PrimitiveProperty",
            name: "TestProp",
            typeName: "string",
            kindOfQuantity: "TestSchema.MyKindOfQuantity",
            category: "TestSchema.TestCategory",
            priority: 100,
          },
          {
            type: "PrimitiveProperty",
            name: "TestProp4",
            typeName: "string",
            kindOfQuantity: "TestSchema.MyKindOfQuantity",
          }
        ],
      },
      TestClass: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.BaseClass",
        properties: [
          {
            type: "PrimitiveProperty",
            name: "TestProp",
            typeName: "string",
          },
          {
            type: "PrimitiveProperty",
            name: "TestProp2",
            typeName: "string",
          },
          {
            type: "PrimitiveProperty",
            name: "TestProp3",
            typeName: "string",
          },
          {
            type: "PrimitiveProperty",
            name: "TestProp4",
            typeName: "string",
            kindOfQuantity: "TestSchema.OverrideKindOfQuantity",
          }
        ],
      },

      ...schemaItemJson,
    }, {
      references: [
        {
          name: "Formats",
          version: "1.0.0",
          alias: "f",
        },
      ],
    });
  }

  const context = new SchemaContext();
  context.addLocater(new TestSchemaLocater());
  const schema: Schema = Schema.fromJsonSync(createSchemaJson(""), context);

  let testClass: EntityClass;
  beforeEach(() => {
    testClass = schema.getItemSync("TestClass") as EntityClass;
    expect(testClass).toBeDefined();
  });

  it("should get from base property", async () => {
    const testProp = testClass.getPropertySync("TestProp", false);
    expect(testProp).toBeDefined();

    // with getter
    const koq = testProp!.kindOfQuantity;
    expect(koq).toBeDefined();
    expect(koq!.name).toEqual("MyKindOfQuantity");

    const cat = testProp!.category;
    expect(cat).toBeDefined();
    expect(cat!.name).toEqual("TestCategory");

    const priority = testProp!.priority;
    expect(priority).toBeDefined();
    expect(priority).toEqual(100);

    // with get sync methods
    const koqfromSync = testProp!.getKindOfQuantitySync();
    expect(koqfromSync).toBeDefined();
    expect(koqfromSync!.name).toEqual("MyKindOfQuantity");

    const catfromSync = testProp!.getCategorySync();
    expect(catfromSync).toBeDefined();
    expect(catfromSync!.name).toEqual("TestCategory");
  });

  it("should get from base property's base property", async () => {
    const testProp = testClass.getPropertySync("TestProp2", false);
    expect(testProp).toBeDefined();

    // with getter
    const koq = testProp!.kindOfQuantity;
    expect(koq).toBeDefined();
    expect(koq!.name).toEqual("MyKindOfQuantity");
    const cat = testProp!.category;
    expect(cat).toBeDefined();
    expect(cat!.name).toEqual("TestCategory");
    const priority = testProp!.priority;
    expect(priority).toBeDefined();
    expect(priority).toEqual(101);

    // with get sync methods
    const koqfromSync = testProp!.getKindOfQuantitySync();
    expect(koqfromSync).toBeDefined();
    expect(koqfromSync!.name).toEqual("MyKindOfQuantity");

    const catfromSync = testProp!.getCategorySync();
    expect(catfromSync).toBeDefined();
    expect(catfromSync!.name).toEqual("TestCategory");
  });

  it("should return undefined if property & base property all undefined", async () => {
    const testProp = testClass.getPropertySync("TestProp3", false);
    expect(testProp).toBeDefined();

    // with getter
    const koq = testProp!.kindOfQuantity;
    expect(koq).toBeUndefined();
    const cat = testProp!.category;
    expect(cat).toBeUndefined();

    // with get sync methods
    const koqfromSync = testProp!.getKindOfQuantitySync();
    expect(koqfromSync).toBeUndefined();
    const catfromSync = testProp!.getCategorySync();
    expect(catfromSync).toBeUndefined();
  });

  it("should success with property override", async () => {
    const testProp = testClass.getPropertySync("TestProp4", false);
    expect(testProp).toBeDefined();

    // with getter
    const koq = testProp!.kindOfQuantity;
    expect(koq).toBeDefined();
    expect(koq!.name).toEqual("OverrideKindOfQuantity");

    // with get sync methods
    const koqfromSync = testProp!.getKindOfQuantitySync();
    expect(koqfromSync).toBeDefined();
    expect(koqfromSync!.name).toEqual("OverrideKindOfQuantity");
  });

  it("should not serialize with property override", async() => {
    const testProp = testClass.getPropertySync("TestProp", false);
    expect(testProp).toBeDefined();

    const serializedJSON = testProp!.toJSON();
    expect(serializedJSON.kindOfQuantity).toBeUndefined();
    expect(serializedJSON.category).toBeUndefined();
    expect(serializedJSON.priority).toBeUndefined();

    const newDom = createEmptyXmlDocument();
    const serializedXML = await testProp!.toXml(newDom);
    expect(serializedXML.getAttribute("kindOfQuantity")).toEqual("");
    expect(serializedXML.getAttribute("category")).toEqual("");
    expect(serializedXML.getAttribute("priority")).toEqual("");
  });
})
