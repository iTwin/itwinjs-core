/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { CustomAttributeContainerType, ECClassModifier, SchemaItemType } from "../../ECObjects";
import { ECSchemaError } from "../../Exception";
import { CustomAttributeClass } from "../../Metadata/CustomAttributeClass";
import { Schema } from "../../Metadata/Schema";
import { expectAsyncToThrow } from "../TestUtils/AssertionHelpers";
import { createSchemaJsonWithItems, deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument, getElementChildrenByTagName, xmlToString } from "../TestUtils/SerializationHelper";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

describe("CustomAttributeClass", () => {
  it("should get fullName", async () => {
    const schemaJson = createSchemaJsonWithItems({
      TestCAClass: {
        schemaItemType: "CustomAttributeClass",
        label: "Test CustomAttribute Class",
        description: "Used for testing",
        modifier: "Sealed",
        appliesTo: "AnyClass",
      },
    });

    const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
    const testCAClass = await ecschema.getItem("TestCAClass", CustomAttributeClass);
    expect(testCAClass).toBeDefined();
    expect(testCAClass!.fullName).eq("TestSchema.TestCAClass");
  });

  describe("type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
      TestCAClass: {
        schemaItemType: "CustomAttributeClass",
        label: "Test CustomAttribute Class",
        description: "Used for testing",
        modifier: "Sealed",
        appliesTo: "AnyClass",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
    });

    let ecSchema: Schema;

    beforeEach(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      expect(ecSchema);
    });

    it("typeguard and type assertion should work on CustomAttributeClass", async () => {
      const testCustomAttributeClass = await ecSchema.getItem("TestCAClass");
      expect(testCustomAttributeClass);
      expect(CustomAttributeClass.isCustomAttributeClass(testCustomAttributeClass)).toBe(true);
      expect(() => CustomAttributeClass.assertIsCustomAttributeClass(testCustomAttributeClass)).not.toThrow();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      expect(testPhenomenon);
      expect(CustomAttributeClass.isCustomAttributeClass(testPhenomenon)).toBe(false);
      expect(() => CustomAttributeClass.assertIsCustomAttributeClass(testPhenomenon)).toThrow();
    });

    it("CustomAttributeClass type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestCAClass", CustomAttributeClass)).toBeInstanceOf(CustomAttributeClass);
      expect(ecSchema.getItemSync("TestCAClass", CustomAttributeClass)).toBeInstanceOf(CustomAttributeClass);
    });

    it("CustomAttributeClass type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", CustomAttributeClass)).toBeUndefined();
      expect(ecSchema.getItemSync("TestPhenomenon", CustomAttributeClass)).toBeUndefined();
    });
  });

  describe("deserialization", () => {
    function createSchemaJson(caClassJson: any): any {
      return createSchemaJsonWithItems({
        TestCAClass: {
          schemaItemType: "CustomAttributeClass",
          ...caClassJson,
        },
      });
    }

    it("should succeed with fully defined", async () => {
      const schemaJson = createSchemaJson({
        label: "Test CustomAttribute Class",
        description: "Used for testing",
        modifier: "Sealed",
        appliesTo: "AnyClass",
      });

      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());

      const testCAClass = await ecschema.getItem("TestCAClass", CustomAttributeClass);
      expect(testCAClass).toBeDefined();

      expect(testCAClass!.name).toEqual("TestCAClass");
      expect(testCAClass!.label).toEqual("Test CustomAttribute Class");
      expect(testCAClass!.description).toEqual("Used for testing");
      expect(testCAClass!.modifier).toEqual(ECClassModifier.Sealed);
      expect(testCAClass!.appliesTo).toEqual(CustomAttributeContainerType.AnyClass);
    });

    it("should throw for NavigationProperty", async () => {
      const json = createSchemaJson({
        appliesTo: "Schema",
        properties: [{ name: "navProp", type: "NavigationProperty" }],
      });
      await expectAsyncToThrow(async () => Schema.fromJson(json, new SchemaContext()), ECSchemaError, `The Navigation Property TestCAClass.navProp is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.`);
    });
  });

  describe("fromJson", () => {
    it("TODO", () => {
      // TODO: Need a test...
    });
  });

  describe("toJSON", () => {
    let testClass: CustomAttributeClass;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testClass = new CustomAttributeClass(schema, "TestCustomAttribute");
    });

    it("async - should succeed with fully defined standalone", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        schema: "TestSchema",
        schemaVersion: "1.0.0",
        schemaItemType: "CustomAttributeClass",
        name: "TestCustomAttribute",
        modifier: "sealed",
        appliesTo: "Schema, AnyProperty",
      };

      await testClass.fromJSON(schemaJson);
      const caJson = testClass!.toJSON(true, true);
      expect(caJson.$schema, ECSchemaNamespaceUris.SCHEMAITEMURL3_2);
      expect(caJson.appliesTo, "Schema, AnyProperty");
      expect(caJson.modifier, "Sealed");
      expect(caJson.name, "TestCustomAttribute");
      expect(caJson.schema, "TestSchema");
      expect(caJson.schemaItemType, "CustomAttributeClass");
      expect(caJson.schemaVersion, "01.00.00");
    });
    it("sync - should succeed with fully defined standalone", () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        schema: "TestSchema",
        schemaVersion: "1.0.0",
        schemaItemType: "CustomAttributeClass",
        name: "TestCustomAttribute",
        modifier: "sealed",
        appliesTo: "Schema, AnyProperty",
      };

      testClass.fromJSONSync(schemaJson);
      const caJson = testClass!.toJSON(true, true);
      expect(caJson.$schema, ECSchemaNamespaceUris.SCHEMAITEMURL3_2);
      expect(caJson.appliesTo, "Schema, AnyProperty");
      expect(caJson.modifier, "Sealed");
      expect(caJson.name, "TestCustomAttribute");
      expect(caJson.schema, "TestSchema");
      expect(caJson.schemaItemType, "CustomAttributeClass");
      expect(caJson.schemaVersion, "01.00.00");
    });
    it("async - should succeed with fully defined without standalone", async () => {
      const schemaJson = createSchemaJsonWithItems({
        testMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.testClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          mixins: ["TestSchema.testMixin"],
        },
        testCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          modifier: "sealed",
          appliesTo: "Schema, AnyProperty",
        },
      });
      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(ecschema);

      const testCustomAttribute = await ecschema.getItem("testCustomAttribute");
      expect(testCustomAttribute);
      expect(testCustomAttribute?.schemaItemType === SchemaItemType.CustomAttributeClass);
      const customAttributeClass = testCustomAttribute as CustomAttributeClass;
      const caSerialization = customAttributeClass.toJSON(false, true);
      expect(caSerialization);
      expect(caSerialization.appliesTo).eql("Schema, AnyProperty");
      expect(caSerialization.modifier).eql("Sealed");
    });
    it("sync - should succeed with fully defined without standalone", () => {
      const schemaJson = createSchemaJsonWithItems({
        testMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.testClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          mixins: ["TestSchema.testMixin"],
        },
        testCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          modifier: "sealed",
          appliesTo: "Schema, AnyProperty",
        },
      });
      const ecschema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      expect(ecschema);

      const testCustomAttribute = ecschema.getItemSync("testCustomAttribute");
      expect(testCustomAttribute);
      expect(testCustomAttribute?.schemaItemType === SchemaItemType.CustomAttributeClass);
      const customAttributeClass = testCustomAttribute as CustomAttributeClass;
      const caSerialization = customAttributeClass.toJSON(false, false);
      expect(caSerialization);
      expect(caSerialization.appliesTo).eql("Schema, AnyProperty");
      expect(caSerialization.modifier).eql("Sealed");
    });

    it("async - JSON stringify should succeed with fully defined", async () => {
      const schemaJson = createSchemaJsonWithItems({
        testMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.testClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          mixins: ["TestSchema.testMixin"],
        },
        testCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          modifier: "sealed",
          appliesTo: "Schema, AnyProperty",
        },
      });
      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(ecschema);

      const testCustomAttribute = await ecschema.getItem("testCustomAttribute");
      expect(testCustomAttribute);
      expect(testCustomAttribute?.schemaItemType === SchemaItemType.CustomAttributeClass);
      const customAttributeClass = testCustomAttribute as CustomAttributeClass;
      const json = JSON.stringify(customAttributeClass);
      const caSerialization = JSON.parse(json);
      expect(caSerialization);
      expect(caSerialization.appliesTo).eql("Schema, AnyProperty");
      expect(caSerialization.modifier).eql("Sealed");
    });

    it("sync - JSON stringify should succeed with fully defined", () => {
      const schemaJson = createSchemaJsonWithItems({
        testMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.testClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          mixins: ["TestSchema.testMixin"],
        },
        testCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          modifier: "sealed",
          appliesTo: "Schema, AnyProperty",
        },
      });
      const ecschema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      expect(ecschema);

      const testCustomAttribute = ecschema.getItemSync("testCustomAttribute");
      expect(testCustomAttribute);
      expect(testCustomAttribute?.schemaItemType === SchemaItemType.CustomAttributeClass);
      const customAttributeClass = testCustomAttribute as CustomAttributeClass;
      const json = JSON.stringify(customAttributeClass);
      const caSerialization = JSON.parse(json);
      expect(caSerialization);
      expect(caSerialization.appliesTo).eql("Schema, AnyProperty");
      expect(caSerialization.modifier).eql("Sealed");
    });
  });

  describe("toXml", () => {
    function createCustomAttributeJson(propertyJson: any) {
      return createSchemaJsonWithItems({
        testCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          modifier: "sealed",
          appliesTo: "Schema, AnyProperty",
          ...propertyJson,
        },
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "int",
          enumerators: [
            {
              name: "FirstValue",
              value: 1,
            },
          ],
        },
      });
    }

    const newDom = createEmptyXmlDocument();

    it("should properly serialize custom attributes having struct inheritance", async () => {
      const schema = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.0.0",
        alias: "ts",
        customAttributes: [
          {
            className: "TestSchema.HasColors",
            color: {
              a: 255,
              r: 40,
              g: 128,
              b: 68,
            },
          },
        ],
        items: {
          ColorRGB: {
            schemaItemType: "StructClass",
            properties: [
            {
              type: "PrimitiveProperty",
              typeName: "int",
              name: "r",
            },
            {
              type: "PrimitiveProperty",
              typeName: "int",
              name: "g",
            },
            {
              type: "PrimitiveProperty",
              typeName: "int",
              name: "b",
            },
            ],
          },
          ColorARGB: {
            schemaItemType: "StructClass",
            baseClass: "TestSchema.ColorRGB",
            properties: [
            {
              type: "PrimitiveProperty",
              typeName: "int",
              name: "a",
            },
            ],

          },
          HasColors: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
            properties: [
            {
              name: "color",
              type: "StructProperty",
              typeName: "TestSchema.ColorARGB",
            },
            ],
          },
        },
      };

      const ecschema = await Schema.fromJson(schema, new SchemaContext());
      expect(ecschema);
      const document = await ecschema.toXml(newDom);
      expect(document);
      const xmlString = xmlToString(document);
      expect(xmlString);
      const resultSchema = deserializeXmlSync(xmlString, new SchemaContext());
      expect(resultSchema);
      const customAttributeSet = resultSchema.customAttributes;
      expect(customAttributeSet);
      const colorCA = customAttributeSet!.get("TestSchema.HasColors");
      expect(colorCA);
      const colorStruct = colorCA!.color;
      expect(colorStruct);
      expect(colorStruct.a).toEqual(255);
      expect(colorStruct.r).toEqual(40);
      expect(colorStruct.g).toEqual(128);
      expect(colorStruct.b).toEqual(68);
    });

    it("should properly serialize", async () => {
      const ecschema = Schema.fromJsonSync(createCustomAttributeJson({}), new SchemaContext());
      expect(ecschema);

      const testCustomAttribute = ecschema.getItemSync("testCustomAttribute", CustomAttributeClass);
      expect(testCustomAttribute);
      const serialized = await testCustomAttribute!.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECCustomAttributeClass");
      expect(serialized.getAttribute("appliesTo")).toEqual("Schema, AnyProperty");
    });

    it("with property, should properly serialize", async () => {
      const propertyJson = {
        properties: [
          {
            type: "PrimitiveProperty",
            typeName: "boolean",
            name: "TestProperty",
          },
        ],
      };
      const ecschema = Schema.fromJsonSync(createCustomAttributeJson(propertyJson), new SchemaContext());
      expect(ecschema);

      const testCustomAttribute = ecschema.getItemSync("testCustomAttribute", CustomAttributeClass);
      expect(testCustomAttribute);
      const serialized = await testCustomAttribute!.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECCustomAttributeClass");
      expect(serialized.getAttribute("appliesTo")).toEqual("Schema, AnyProperty");
      const properties = getElementChildrenByTagName(serialized, "ECProperty");
      expect(properties.length).toBe(1);
      expect(properties[0].getAttribute("propertyName")).toEqual("TestProperty");
      expect(properties[0].getAttribute("typeName")).toEqual("boolean");
    });
  });
});
