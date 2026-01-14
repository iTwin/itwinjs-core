/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaContext } from "../../Context";
import { DelayedPromiseWithProps } from "../../DelayedPromise";
import { StrengthDirection } from "../../ECObjects";
import { EntityClass } from "../../Metadata/EntityClass";
import { Mixin } from "../../Metadata/Mixin";
import { NavigationProperty } from "../../Metadata/Property";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { expectAsyncToThrow } from "../TestUtils/AssertionHelpers";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument, getElementChildrenByTagName } from "../TestUtils/SerializationHelper";
import { ECSchemaError } from "../../Exception";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Mixin", () => {

  function createSchemaJson(mixinJson: any): any {
    return createSchemaJsonWithItems({
      TestMixin: {
        schemaItemType: "Mixin",
        ...mixinJson,
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

  it("should get fullName", async () => {
    const schemaJson = createSchemaJsonWithItems({
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
      },
    });

    const schema = await Schema.fromJson(schemaJson, new SchemaContext());
    expect(schema).toBeDefined();
    const baseMixin = await schema.getItem("BaseMixin", Mixin);
    const mixin = await schema.getItem("TestMixin", Mixin);
    expect(baseMixin!.fullName).toEqual("TestSchema.BaseMixin");
    expect(mixin!.fullName).toEqual("TestSchema.TestMixin");
  });

  describe("type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
      TestMixin: {
        schemaItemType: "Mixin",
        label: "Test Mixin",
        description: "Used for testing",
        appliesTo: "TestSchema.TestEntityClass",
      },
      TestEntityClass: {
        schemaItemType: "EntityClass",
        label: "Test Entity Class",
        description: "Used for testing",
        modifier: "Sealed",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
    });

    let ecSchema: Schema;

    beforeEach(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      expect(ecSchema).toBeDefined();
    });

    it("typeguard and type assertion should work on Mixin", async () => {
      const testMixin = await ecSchema.getItem("TestMixin");
      expect(testMixin).toBeDefined();
      expect(Mixin.isMixin(testMixin)).toBe(true);
      expect(() => Mixin.assertIsMixin(testMixin)).not.toThrow();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      expect(testPhenomenon).toBeDefined();
      expect(Mixin.isMixin(testPhenomenon)).toBe(false);
      expect(() => Mixin.assertIsMixin(testPhenomenon)).toThrow();
    });

    it("Mixin type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestMixin", Mixin)).toBeInstanceOf(Mixin);
      expect(ecSchema.getItemSync("TestMixin", Mixin)).toBeInstanceOf(Mixin);
    });

    it("Mixin type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", Mixin)).toBeUndefined();
      expect(ecSchema.getItemSync("TestPhenomenon", Mixin)).toBeUndefined();
    });
  });

  describe("deserialization", () => {
    it("should succeed with fully defined", async () => {
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
        },
      });

      const schema = await Schema.fromJson(testSchema, new SchemaContext());
      expect(schema).toBeDefined();

      const entity = await schema.getItem("TestEntity", EntityClass);
      const baseMixin = await schema.getItem("BaseMixin", Mixin);

      const mixin = await schema.getItem("TestMixin", Mixin);
      expect(mixin).toBeDefined();

      expect(await mixin!.appliesTo).toBeDefined();
      expect(await mixin!.appliesTo === entity).toBe(true);
      expect(await mixin!.baseClass === baseMixin).toBe(true);
      expect(await mixin!.applicableTo(entity!)).toBe(true);
    });

    it("should succeed with NavigationProperty", async () => {
      const json = createSchemaJson({
        appliesTo: "TestSchema.TestEntity",
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: "forward",
          },
        ],
      });

      const schema = await Schema.fromJson(json, new SchemaContext());
      expect(schema).toBeDefined();

      const mixin = await schema.getItem("TestMixin", Mixin);
      expect(mixin).toBeDefined();

      const navProp = await mixin!.getProperty("testNavProp", false) as NavigationProperty;
      expect(navProp).toBeDefined();
      expect(navProp.isNavigation()).toBe(true);
      expect(navProp.direction).toEqual(StrengthDirection.Forward);
    });

    it("should succeed with NavigationPropertySynchronously", () => {
      const json = createSchemaJson({
        appliesTo: "TestSchema.TestEntity",
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: "forward",
          },
        ],
      });

      const schema = Schema.fromJsonSync(json, new SchemaContext());
      expect(schema).toBeDefined();

      const mixin = schema.getItemSync("TestMixin", Mixin);
      expect(mixin).toBeDefined();

      const navProp = mixin!.getPropertySync("testNavProp", false) as NavigationProperty;
      expect(navProp).toBeDefined();
      expect(navProp.isNavigation()).toBe(true);
      expect(navProp.direction).toEqual(StrengthDirection.Forward);
    });

    it("should throw for invalid appliesTo", async () => {
      const json = createSchemaJson({
        appliesTo: 0,
      });
      await expectAsyncToThrow(async () => Schema.fromJson(json, new SchemaContext()), ECSchemaError, `The Mixin TestSchema.TestMixin has an invalid 'appliesTo' attribute. It should be of type 'string'.`);
    });

    it("applicableTo, wrong entity, fails", async () => {
      const json = createSchemaJson({
        appliesTo: "TestSchema.TestEntity",
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: "forward",
          },
        ],
      });

      const schema = Schema.fromJsonSync(json, new SchemaContext());
      expect(schema).toBeDefined();

      const mixin = schema.getItemSync("TestMixin", Mixin);
      expect(mixin).toBeDefined();

      const validEntity = schema.getItemSync("TestEntity", EntityClass);
      expect(validEntity).toBeDefined();

      const invalidEntity = new EntityClass(schema, "TestEntityB");

      expect(await mixin!.applicableTo(validEntity!)).toBe(true);
      expect(await mixin!.applicableTo(invalidEntity)).toBe(false);
    });
  });

  describe("Async fromJson", () => {
    let testEntity: EntityClass;
    let testMixin: Mixin;
    const baseJson = { schemaItemType: "Mixin" };

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testEntity = await (schema as MutableSchema).createEntityClass("TestEntity");
      testMixin = new Mixin(schema, "TestMixin");
    });

    it("should successfully deserialize valid JSON", async () => {
      const json = {
        ...baseJson,
        appliesTo: "TestSchema.TestEntity",
      };
      expect(testMixin).toBeDefined();
      await testMixin.fromJSON(json);
      expect(await testMixin.appliesTo).toEqual(testEntity);
      expect(await testMixin.applicableTo(testEntity)).toBe(true);
    });

    it("should throw for invalid appliesTo", async () => {
      expect(testMixin).toBeDefined();
      const unloadedAppliesToJson = { ...baseJson, appliesTo: "ThisClassDoesNotExist" };
      await expectAsyncToThrow(async () => testMixin.fromJSON(unloadedAppliesToJson), ECSchemaError);
    });
  });
  describe("Sync fromJson", () => {
    let testEntity: EntityClass;
    let testMixin: Mixin;
    const baseJson = { schemaItemType: "Mixin" };

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testEntity = (schema as MutableSchema).createEntityClassSync("TestEntity");
      testMixin = new Mixin(schema, "TestMixin");
    });

    it("should successfully deserialize valid JSON", async () => {
      const json = {
        ...baseJson,
        appliesTo: "TestSchema.TestEntity",
      };
      expect(testMixin).toBeDefined();
      testMixin.fromJSONSync(json);

      expect(await testMixin.appliesTo).toEqual(testEntity);
    });
    it("should throw for invalid appliesTo", async () => {
      expect(testMixin).toBeDefined();
      const json = { ...baseJson, appliesTo: "ThisClassDoesNotExist" };
      expect(() => testMixin.fromJSONSync(json)).toThrow(ECSchemaError);
    });
  });

  describe("Validation tests", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("applicableTo, wrong entity, fails", async () => {
      const json = createSchemaJson({
        appliesTo: "TestSchema.TestEntity",
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: "forward",
          },
        ],
      });

      const schema = Schema.fromJsonSync(json, new SchemaContext());
      expect(schema).toBeDefined();

      const mixin = schema.getItemSync("TestMixin", Mixin);
      expect(mixin).toBeDefined();

      const validEntity = schema.getItemSync("TestEntity", EntityClass);
      expect(validEntity).toBeDefined();

      const invalidEntity = new EntityClass(schema, "TestEntityB");

      expect(await mixin!.applicableTo(validEntity!)).toBe(true);
      expect(await mixin!.applicableTo(invalidEntity)).toBe(false);
    });

    it("applicableTo, appliesTo undefined, should throw", async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      const mixin = new Mixin(schema, "TestMixin");
      const entity = new EntityClass(schema, "TestEntity");

      await expectAsyncToThrow(async () => mixin.applicableTo(entity), ECSchemaError, `appliesTo is undefined in the class ${mixin.fullName}`);
    });

    it("applicableTo, appliesTo resolves undefined, should throw", async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      const entity = new EntityClass(schema, "TestEntity");
      const mixin = new Mixin(schema, "TestMixin");
      const promise = new DelayedPromiseWithProps(entity.key, async () => undefined);
      vi.spyOn(Mixin.prototype, "appliesTo", "get").mockReturnValue(promise as any);

      await expectAsyncToThrow(async () => mixin.applicableTo(entity), ECSchemaError, `Unable to locate the appliesTo ${promise.fullName}`);
    });
  });

  describe("toJSON", () => {
    it("should always omit modifier", async () => {
      const testSchema = createSchemaJsonWithItems({
        TestMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.TestEntity",
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      });

      const schemaA = await Schema.fromJson(testSchema, new SchemaContext());
      expect(schemaA).toBeDefined();
      const mixinA = await schemaA.getItem("TestMixin", Mixin);
      expect(mixinA).toBeDefined();
      expect(mixinA!.toJSON(true, true)).not.toHaveProperty("modifier");

      testSchema.items.TestMixin.modifier = "Abstract";
      const schemaB = await Schema.fromJson(testSchema, new SchemaContext());
      expect(schemaB).toBeDefined();
      const mixinB = await schemaB.getItem("TestMixin", Mixin);
      expect(mixinB).toBeDefined();
      expect(mixinB!.toJSON(true, true)).not.toHaveProperty("modifier");
    });

    it("JSON stringify serialization successful", async () => {
      const testSchema = createSchemaJsonWithItems({
        TestMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.TestEntity",
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      });

      const schemaA = await Schema.fromJson(testSchema, new SchemaContext());
      expect(schemaA).toBeDefined();
      const mixinA = await schemaA.getItem("TestMixin", Mixin);
      expect(mixinA).toBeDefined();
      const jsonA = JSON.stringify(mixinA);
      const serializedA = JSON.parse(jsonA);
      expect(serializedA.schemaItemType).toEqual("Mixin");
      expect(serializedA.appliesTo).toEqual("TestSchema.TestEntity");
      expect(serializedA).not.toHaveProperty("modifier");

      testSchema.items.TestMixin.modifier = "Abstract";
      const schemaB = await Schema.fromJson(testSchema, new SchemaContext());
      expect(schemaB).toBeDefined();
      const mixinB = await schemaB.getItem("TestMixin", Mixin);
      expect(mixinB).toBeDefined();
      const jsonB = JSON.stringify(mixinA);
      const serializedB = JSON.parse(jsonB);
      expect(serializedB.schemaItemType).toEqual("Mixin");
      expect(serializedB.appliesTo).toEqual("TestSchema.TestEntity");
      expect(serializedB).not.toHaveProperty("modifier");
    });
  });

  describe("toXml", () => {
    const testSchema = createSchemaJsonWithItems({
      TestMixin: {
        schemaItemType: "Mixin",
        appliesTo: "TestSchema.TestEntity",
        modifier: "Abstract",
      },
      TestEntity: {
        schemaItemType: "EntityClass",
      },
    });
    const newDom = createEmptyXmlDocument();

    it("should properly serialize", async () => {
      const schema = await Schema.fromJson(testSchema, new SchemaContext());
      expect(schema).toBeDefined();
      const mixin = await schema.getItem("TestMixin", Mixin);
      expect(mixin).toBeDefined();
      const serialized = await mixin!.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECEntityClass");
      expect(serialized.hasAttribute("modifier")).toEqual(true);

      const customAttributesResult = getElementChildrenByTagName(serialized, "ECCustomAttributes");
      expect(customAttributesResult.length).toBe(1);
      const customAttributes = customAttributesResult[0];
      const mixinPropsResult = getElementChildrenByTagName(customAttributes, "IsMixin");
      expect(mixinPropsResult.length).toBe(1);
      const mixinProps = mixinPropsResult[0];
      const appliesToResult = getElementChildrenByTagName(mixinProps, "AppliesToEntityClass");
      expect(appliesToResult.length).toBe(1);
      const appliesTo = appliesToResult[0];
      expect(appliesTo.textContent).toEqual("TestEntity");
    });
  });
});
