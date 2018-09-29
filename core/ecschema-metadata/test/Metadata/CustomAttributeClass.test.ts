/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

import Schema from "../../src/Metadata/Schema";
import { ECObjectsError } from "../../src/Exception";
import CustomAttributeClass from "../../src/Metadata/CustomAttributeClass";
import { ECClassModifier } from "../../src/ECObjects";
import { CustomAttributeContainerType } from "../../src";

describe("CustomAttributeClass", () => {

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

      const ecschema = await Schema.fromJson(schemaJson);

      const testCAClass = await ecschema.getItem<CustomAttributeClass>("TestCAClass");
      expect(testCAClass).to.exist;

      expect(testCAClass!.name).to.equal("TestCAClass");
      expect(testCAClass!.label).to.equal("Test CustomAttribute Class");
      expect(testCAClass!.description).to.equal("Used for testing");
      expect(testCAClass!.modifier).to.equal(ECClassModifier.Sealed);
      expect(testCAClass!.containerType).to.equal(CustomAttributeContainerType.AnyClass);
    });

    it("should throw for NavigationProperty", async () => {
      const json = createSchemaJson({
        appliesTo: "Schema",
        properties: [{ name: "navProp", type: "NavigationProperty" }],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Navigation Property TestCAClass.navProp is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.`);
    });
  });

  describe("fromJson", () => {
    let testClass: CustomAttributeClass;
    const baseJson = { schemaItemType: "CustomAttributeClass" };

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testClass = new CustomAttributeClass(schema, "TestCustomAttribute");
    });

    it("should throw for missing appliesTo", async () => {
      expect(testClass).to.exist;
      await expect(testClass.fromJson({ ...baseJson })).to.be.rejectedWith(ECObjectsError, `The CustomAttributeClass TestCustomAttribute is missing the required 'appliesTo' attribute.`);
    });

    it("should throw for invalid appliesTo", async () => {
      expect(testClass).to.exist;
      const json = {
        ...baseJson,
        appliesTo: 0,
      };
      await expect(testClass.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The CustomAttributeClass TestCustomAttribute has an invalid 'appliesTo' attribute. It should be of type 'string'.`);
    });
  });
  describe("toJson", () => {
    let testClass: CustomAttributeClass;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testClass = new CustomAttributeClass(schema, "TestCustomAttribute");
    });

    it("async - should succeed with fully defined standalone", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
        schema: "TestSchema",
        schemaVersion: "1.0.0",
        schemaItemType: "CustomAttributeClass",
        name: "TestCustomAttribute",
        modifier: "sealed",
        appliesTo: "Schema, AnyProperty",
      };

      await testClass.fromJson(schemaJson);
      const caJson = testClass!.toJson(true, true);
      assert(caJson.$schema, "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem");
      assert(caJson.appliesTo, "Schema,AnyProperty");
      assert(caJson.modifier, "Sealed");
      assert(caJson.name, "TestCustomAttribute");
      assert(caJson.schema, "TestSchema");
      assert(caJson.schemaItemType, "CustomAttributeClass");
      assert(caJson.schemaVersion, "1.0.0");
    });
    it("sync - should succeed with fully defined standalone", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
        schema: "TestSchema",
        schemaVersion: "1.0.0",
        schemaItemType: "CustomAttributeClass",
        name: "TestCustomAttribute",
        modifier: "sealed",
        appliesTo: "Schema, AnyProperty",
      };

      testClass.fromJsonSync(schemaJson);
      const caJson = testClass!.toJson(true, true);
      assert(caJson.$schema, "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem");
      assert(caJson.appliesTo, "Schema,AnyProperty");
      assert(caJson.modifier, "Sealed");
      assert(caJson.name, "TestCustomAttribute");
      assert(caJson.schema, "TestSchema");
      assert(caJson.schemaItemType, "CustomAttributeClass");
      assert(caJson.schemaVersion, "1.0.0");
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
      const ecschema = await Schema.fromJson(schemaJson);
      assert.isDefined(ecschema);

      const testCustomAttribute = await ecschema.getItem("testCustomAttribute");
      assert.isDefined(testCustomAttribute);
      assert.isTrue(testCustomAttribute instanceof CustomAttributeClass);
      const customAttributeClass = testCustomAttribute as CustomAttributeClass;
      const caSerialization = customAttributeClass!.toJson(false, true);
      assert.isDefined(caSerialization);
      expect(caSerialization.appliesTo).eql("Schema,AnyProperty");
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
      const ecschema = Schema.fromJsonSync(schemaJson);
      assert.isDefined(ecschema);

      const testCustomAttribute = ecschema.getItemSync("testCustomAttribute");
      assert.isDefined(testCustomAttribute);
      assert.isTrue(testCustomAttribute instanceof CustomAttributeClass);
      const customAttributeClass = testCustomAttribute as CustomAttributeClass;
      const caSerialization = customAttributeClass!.toJson(false, false);
      assert.isDefined(caSerialization);
      expect(caSerialization.appliesTo).eql("Schema,AnyProperty");
      expect(caSerialization.modifier).eql("Sealed");
    });
  });
});
