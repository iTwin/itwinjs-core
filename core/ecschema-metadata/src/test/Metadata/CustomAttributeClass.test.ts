/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { ECSchemaNamespaceUris } from "../../Constants.js";
import { SchemaContext } from "../../Context.js";
import { CustomAttributeContainerType, ECClassModifier, SchemaItemType } from "../../ECObjects.js";
import { ECObjectsError } from "../../Exception.js";
import { CustomAttributeClass } from "../../Metadata/CustomAttributeClass.js";
import { Schema } from "../../Metadata/Schema.js";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers.js";
import { createEmptyXmlDocument, getElementChildrenByTagName } from "../TestUtils/SerializationHelper.js";

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
    expect(testCAClass).to.exist;
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

    before(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      assert.isDefined(ecSchema);
    });

    it("typeguard and type assertion should work on CustomAttributeClass", async () => {
      const testCustomAttributeClass = await ecSchema.getItem("TestCAClass");
      assert.isDefined(testCustomAttributeClass);
      expect(CustomAttributeClass.isCustomAttributeClass(testCustomAttributeClass)).to.be.true;
      expect(() => CustomAttributeClass.assertIsCustomAttributeClass(testCustomAttributeClass)).not.to.throw();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      assert.isDefined(testPhenomenon);
      expect(CustomAttributeClass.isCustomAttributeClass(testPhenomenon)).to.be.false;
      expect(() => CustomAttributeClass.assertIsCustomAttributeClass(testPhenomenon)).to.throw();
    });

    it("CustomAttributeClass type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestCAClass", CustomAttributeClass)).to.be.instanceof(CustomAttributeClass);
      expect(ecSchema.getItemSync("TestCAClass", CustomAttributeClass)).to.be.instanceof(CustomAttributeClass);
    });

    it("CustomAttributeClass type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", CustomAttributeClass)).to.be.undefined;
      expect(ecSchema.getItemSync("TestPhenomenon", CustomAttributeClass)).to.be.undefined;
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
      expect(testCAClass).to.exist;

      expect(testCAClass!.name).to.equal("TestCAClass");
      expect(testCAClass!.label).to.equal("Test CustomAttribute Class");
      expect(testCAClass!.description).to.equal("Used for testing");
      expect(testCAClass!.modifier).to.equal(ECClassModifier.Sealed);
      expect(testCAClass!.appliesTo).to.equal(CustomAttributeContainerType.AnyClass);
    });

    it("should throw for NavigationProperty", async () => {
      const json = createSchemaJson({
        appliesTo: "Schema",
        properties: [{ name: "navProp", type: "NavigationProperty" }],
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The Navigation Property TestCAClass.navProp is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.`);
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
      assert.strictEqual(caJson.$schema, ECSchemaNamespaceUris.SCHEMAITEMURL3_2);
      assert.strictEqual(caJson.appliesTo, "Schema, AnyProperty");
      assert.strictEqual(caJson.modifier, "Sealed");
      assert.strictEqual(caJson.name, "TestCustomAttribute");
      assert.strictEqual(caJson.schema, "TestSchema");
      assert.strictEqual(caJson.schemaItemType, "CustomAttributeClass");
      assert.strictEqual(caJson.schemaVersion, "01.00.00");
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
      assert.strictEqual(caJson.$schema, ECSchemaNamespaceUris.SCHEMAITEMURL3_2);
      assert.strictEqual(caJson.appliesTo, "Schema, AnyProperty");
      assert.strictEqual(caJson.modifier, "Sealed");
      assert.strictEqual(caJson.name, "TestCustomAttribute");
      assert.strictEqual(caJson.schema, "TestSchema");
      assert.strictEqual(caJson.schemaItemType, "CustomAttributeClass");
      assert.strictEqual(caJson.schemaVersion, "01.00.00");
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
      assert.isDefined(ecschema);

      const testCustomAttribute = await ecschema.getItem("testCustomAttribute");
      assert.isDefined(testCustomAttribute);
      assert.isTrue(testCustomAttribute?.schemaItemType === SchemaItemType.CustomAttributeClass);
      const customAttributeClass = testCustomAttribute as CustomAttributeClass;
      const caSerialization = customAttributeClass.toJSON(false, true);
      assert.isDefined(caSerialization);
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
      assert.isDefined(ecschema);

      const testCustomAttribute = ecschema.getItemSync("testCustomAttribute");
      assert.isDefined(testCustomAttribute);
      assert.isTrue(testCustomAttribute?.schemaItemType === SchemaItemType.CustomAttributeClass);
      const customAttributeClass = testCustomAttribute as CustomAttributeClass;
      const caSerialization = customAttributeClass.toJSON(false, false);
      assert.isDefined(caSerialization);
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
      assert.isDefined(ecschema);

      const testCustomAttribute = await ecschema.getItem("testCustomAttribute");
      assert.isDefined(testCustomAttribute);
      assert.isTrue(testCustomAttribute?.schemaItemType === SchemaItemType.CustomAttributeClass);
      const customAttributeClass = testCustomAttribute as CustomAttributeClass;
      const json = JSON.stringify(customAttributeClass);
      const caSerialization = JSON.parse(json);
      assert.isDefined(caSerialization);
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
      assert.isDefined(ecschema);

      const testCustomAttribute = ecschema.getItemSync("testCustomAttribute");
      assert.isDefined(testCustomAttribute);
      assert.isTrue(testCustomAttribute?.schemaItemType === SchemaItemType.CustomAttributeClass);
      const customAttributeClass = testCustomAttribute as CustomAttributeClass;
      const json = JSON.stringify(customAttributeClass);
      const caSerialization = JSON.parse(json);
      assert.isDefined(caSerialization);
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

    it("should properly serialize", async () => {
      const ecschema = Schema.fromJsonSync(createCustomAttributeJson({}), new SchemaContext());
      assert.isDefined(ecschema);

      const testCustomAttribute = ecschema.getItemSync("testCustomAttribute", CustomAttributeClass);
      assert.isDefined(testCustomAttribute);
      const serialized = await testCustomAttribute!.toXml(newDom);
      expect(serialized.nodeName).to.eql("ECCustomAttributeClass");
      expect(serialized.getAttribute("appliesTo")).to.eql("Schema, AnyProperty");
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
      assert.isDefined(ecschema);

      const testCustomAttribute = ecschema.getItemSync("testCustomAttribute", CustomAttributeClass);
      assert.isDefined(testCustomAttribute);
      const serialized = await testCustomAttribute!.toXml(newDom);
      expect(serialized.nodeName).to.eql("ECCustomAttributeClass");
      expect(serialized.getAttribute("appliesTo")).to.eql("Schema, AnyProperty");
      const properties = getElementChildrenByTagName(serialized, "ECProperty");
      assert.strictEqual(properties.length, 1);
      expect(properties[0].getAttribute("propertyName")).to.eql("TestProperty");
      expect(properties[0].getAttribute("typeName")).to.eql("boolean");
    });
  });
});
