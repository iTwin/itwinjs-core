/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

import Schema, { MutableSchema } from "../../src/Metadata/Schema";
import ECClass, { MutableClass } from "../../src/Metadata/Class";
import EntityClass, { MutableEntityClass } from "../../src/Metadata/EntityClass";
import Mixin from "../../src/Metadata/Mixin";
import RelationshipClass from "../../src/Metadata/RelationshipClass";
import { ECClassModifier } from "../../src/ECObjects";
import { DelayedPromiseWithProps } from "../../src/DelayedPromise";
import { ECObjectsError } from "../../src/Exception";

describe("EntityClass", () => {
  describe("get inherited properties", () => {
    let schema: Schema;

    beforeEach(() => {
      schema = new Schema("TestSchema", 1, 0, 0);
    });

    it("from mixins", async () => {
      const baseClass = new EntityClass(schema, "TestBase");
      const basePrimProp = await (baseClass as ECClass as MutableClass).createPrimitiveProperty("BasePrimProp");

      const mixin = new Mixin(schema, "TestMixin");
      const mixinPrimProp = await (mixin as ECClass as MutableClass).createPrimitiveProperty("MixinPrimProp");

      const entityClass = new EntityClass(schema, "TestClass");
      await (entityClass as ECClass as MutableClass).createPrimitiveProperty("PrimProp");
      entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);
      (entityClass as MutableEntityClass).addMixin(mixin);

      expect(await entityClass.getProperty("MixinPrimProp")).to.be.undefined;
      expect(await entityClass.getProperty("MixinPrimProp", true)).equal(mixinPrimProp);
      expect(await entityClass.getInheritedProperty("MixinPrimProp")).equal(mixinPrimProp);

      expect(await entityClass.getProperty("BasePrimProp")).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp", false)).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp", true)).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("BasePrimProp")).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("PrimProp")).to.be.undefined;
    });

    it("from mixins synchronously", () => {
      const baseClass = (schema as MutableSchema).createEntityClassSync("TestBase");
      const basePrimProp = (baseClass as ECClass as MutableClass).createPrimitivePropertySync("BasePrimProp");

      const mixin = (schema as MutableSchema).createMixinClassSync("TestMixin");
      const mixinPrimProp = (mixin as ECClass as MutableClass).createPrimitivePropertySync("MixinPrimProp");

      const entityClass = (schema as MutableSchema).createEntityClassSync("TestClass");
      (entityClass as ECClass as MutableClass).createPrimitivePropertySync("PrimProp");
      entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);
      (entityClass as MutableEntityClass).addMixin(mixin);

      expect(entityClass.getPropertySync("MixinPrimProp")).to.be.undefined;
      expect(entityClass.getPropertySync("MixinPrimProp", true)).equal(mixinPrimProp);
      expect(entityClass.getInheritedPropertySync("MixinPrimProp")).equal(mixinPrimProp);

      expect(entityClass.getPropertySync("BasePrimProp")).to.be.undefined;
      expect(entityClass.getPropertySync("BasePrimProp", false)).to.be.undefined;
      expect(entityClass.getPropertySync("BasePrimProp", true)).equal(basePrimProp);
      expect(entityClass.getInheritedPropertySync("BasePrimProp")).equal(basePrimProp);
      expect(entityClass.getInheritedPropertySync("PrimProp")).to.be.undefined;
    });
  });

  describe("deserialization", () => {
    function createSchemaJson(entityClassJson: any): any {
      return createSchemaJsonWithItems({
        TestEntityClass: {
          schemaItemType: "EntityClass",
          ...entityClassJson,
        },
      });
    }

    function createNavPropSchemaJson(entityClassJson: any): any {
      return createSchemaJsonWithItems({
        TestEntityClass: {
          schemaItemType: "EntityClass",
          ...entityClassJson,
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
            constraintClasses: [
              "TestSchema.TestEntityClass",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "TestSchema.TargetClass",
            ],
          },
        },
        TargetClass: {
          schemaItemType: "EntityClass",
        },
      });
    }

    it("should succeed with fully defined", async () => {
      const schemaJson = createSchemaJson({
        label: "Test Entity Class",
        description: "Used for testing",
        modifier: "None",
      });

      const ecschema = await Schema.fromJson(schemaJson);
      const testClass = await ecschema.getItem<ECClass>("TestEntityClass");
      assert.isDefined(testClass);

      const testEntity = await ecschema.getItem<EntityClass>("TestEntityClass");
      assert.isDefined(testEntity);

      expect(testEntity!.name).equal("TestEntityClass");
      expect(testEntity!.label).equal("Test Entity Class");
      expect(testEntity!.description).equal("Used for testing");
      expect(testEntity!.modifier).equal(ECClassModifier.None);
    });

    it("should succeed with mixin", async () => {
      const schemaJson = createSchemaJsonWithItems({
        testMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.testClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          mixins: ["TestSchema.testMixin"],
        },
      });

      const ecschema = await Schema.fromJson(schemaJson);
      assert.isDefined(ecschema);

      const testClass = await ecschema.getItem("testClass");
      assert.isDefined(testClass);
      assert.isTrue(testClass instanceof EntityClass);
      const entityClass = testClass as EntityClass;

      const mixinClass = await ecschema.getItem<Mixin>("testMixin");
      assert.isDefined(mixinClass);

      assert.isDefined(entityClass.mixins);
      expect(entityClass.mixins!.length).equal(1);
      assert.isTrue(await entityClass.mixins![0] === mixinClass);

      assert.isDefined(await mixinClass!.appliesTo);
      assert.isTrue(entityClass === await mixinClass!.appliesTo);
    });

    it("should succeed with multiple mixins", async () => {
      const schemaJson = createSchemaJsonWithItems({
        testMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.testClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          mixins: [
            "TestSchema.testMixin",
            "TestSchema.anotherMixin",
          ],
        },
        anotherMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.testClass",
        },
      });
      const ecschema = await Schema.fromJson(schemaJson);
      assert.isDefined(ecschema);
    });

    it("should succeed with multiple mixins synchronously", () => {
      const schemaJson = createSchemaJsonWithItems({
        testMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.testClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          mixins: [
            "TestSchema.testMixin",
            "TestSchema.anotherMixin",
          ],
        },
        anotherMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.testClass",
        },
      });
      const ecschema = Schema.fromJsonSync(schemaJson);
      assert.isDefined(ecschema);
    });

    it("should succeed with base class", async () => {
      const schemaJson = createSchemaJsonWithItems({
        baseClass: {
          schemaItemType: "EntityClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.baseClass",
        },
      });

      const ecSchema = await Schema.fromJson(schemaJson);
      assert.isDefined(ecSchema);

      const testEntity = await ecSchema.getItem<EntityClass>("testClass");
      assert.isDefined(testEntity);

      const testBaseEntity = await ecSchema.getItem<EntityClass>("baseClass");
      assert.isDefined(testBaseEntity);

      assert.isDefined(await testEntity!.baseClass);
      assert.isTrue(typeof (await testEntity!.baseClass) === "object");

      assert.isTrue(await testEntity!.baseClass === testBaseEntity);
    });

    it("should succeed with base class synchronously", () => {
      const schemaJson = createSchemaJsonWithItems({
        baseClass: {
          schemaItemType: "EntityClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.baseClass",
        },
      });

      const ecSchema = Schema.fromJsonSync(schemaJson);
      assert.isDefined(ecSchema);

      const testEntity = ecSchema.getItemSync<EntityClass>("testClass");
      assert.isDefined(testEntity);

      const testBaseEntity = ecSchema.getItemSync<EntityClass>("baseClass");
      assert.isDefined(testBaseEntity);

      const baseClass = testEntity!.getBaseClassSync();
      assert.isDefined(baseClass);
      assert.isTrue(typeof (baseClass) === "object");

      assert.isTrue(baseClass === testBaseEntity);
    });

    it("with navigation property", async () => {
      const schemaJson = createNavPropSchemaJson({
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: "forward",
          },
        ],
      });

      const schema = await Schema.fromJson(schemaJson);
      assert.isDefined(schema);

      const entityClass = await schema.getItem<EntityClass>("TestEntityClass");
      assert.isDefined(entityClass);

      const navProp = await entityClass!.getProperty("testNavProp");
      assert.isDefined(navProp);
      if (navProp && navProp.isNavigation()) {
        const relClass = await schema.getItem<RelationshipClass>("NavPropRelationship");
        assert.isTrue(await navProp.relationshipClass === relClass);  // << For some reason type guard was failing..?
      } else {
        assert.fail();
      }
    });

    it("with navigation property synchronously", () => {
      const schemaJson = createNavPropSchemaJson({
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: "forward",
          },
        ],
      });

      const schema = Schema.fromJsonSync(schemaJson);
      assert.isDefined(schema);

      const entityClass = schema.getItemSync<EntityClass>("TestEntityClass");
      assert.isDefined(entityClass);

      const navProp = entityClass!.getPropertySync("testNavProp");
      assert.isDefined(navProp);
      if (navProp && navProp.isNavigation()) {
        const relClass = schema.getItemSync<RelationshipClass>("NavPropRelationship");
        assert.isTrue(navProp.getRelationshipClassSync() === relClass);
      } else {
        assert.fail();
      }
    });

    it("should throw for invalid baseClass", async () => {
      const json = createSchemaJson({ baseClass: 0 });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECClass TestEntityClass has an invalid 'baseClass' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid mixins", async () => {
      let json: any = createSchemaJson({ mixins: 0 });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECClass TestEntityClass has an invalid 'mixins' attribute. It should be of type 'string[]'.`);

      json = createSchemaJson({ mixins: [0] });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECClass TestEntityClass has an invalid 'mixins' attribute. It should be of type 'string[]'.`);
    });

    it("should throw for invalid properties", async () => {
      let json: any = createSchemaJson({ properties: 0 });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECClass TestEntityClass has an invalid 'properties' attribute. It should be of type 'object[]'.`);

      json = createSchemaJson({
        properties: [0],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECClass TestEntityClass has an invalid 'properties' attribute. It should be of type 'object[]'.`);
    });

    it("should throw for property with missing name", async () => {
      const json = createSchemaJson({
        properties: [{ type: "PrimitiveProperty" }],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `An ECProperty in TestSchema.TestEntityClass is missing the required 'name' property.`);
    });

    it("should throw for property with invalid name", async () => {
      const json = createSchemaJson({
        properties: [{ type: "PrimitiveProperty", name: 0 }],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `An ECProperty in TestSchema.TestEntityClass has an invalid 'name' property. It should be of type 'string'.`);
    });

    it("should throw for property with missing type", async () => {
      const json = createSchemaJson({
        properties: [{ name: "badProp" }],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECProperty TestSchema.TestEntityClass.badProp is missing the required 'type' property.`);
    });

    it("should throw for property with invalid type", async () => {
      const json = createSchemaJson({
        properties: [{ name: "badProp", type: 0 }],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECProperty TestSchema.TestEntityClass.badProp has an invalid 'type' property. It should be of type 'string'.`);
    });

    it("should throw for property with missing typeName", async () => {
      const json = createSchemaJson({
        properties: [{ name: "badProp", type: "PrimitiveProperty" }],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECProperty TestSchema.TestEntityClass.badProp is missing the required 'typeName' property.`);
    });

    it("should throw for property with invalid typeName", async () => {
      const json = createSchemaJson({
        properties: [{ name: "badProp", type: "PrimitiveProperty", typeName: 0 }],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECProperty TestSchema.TestEntityClass.badProp has an invalid 'typeName' property. It should be of type 'string'.`);
    });

    it("should throw for property with invalid category", async () => {
      const json = createSchemaJson({
        properties: [
          {
            type: "PrimitiveProperty",
            typeName: "double",
            name: "testProp",
            category: 0,
          },
        ],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECProperty TestEntityClass.testProp has an invalid 'category' property. It should be of type 'string'.`);
    });

    it("should throw for property with invalid kindOfQuantity", async () => {
      const json = createSchemaJson({
        properties: [
          {
            type: "PrimitiveProperty",
            typeName: "double",
            name: "testProp",
            kindOfQuantity: 0,
          },
        ],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECProperty TestEntityClass.testProp has an invalid 'kindOfQuantity' property. It should be of type 'string'.`);
    });

    it("should throw for navigation property with missing relationshipName", async () => {
      const json = createNavPropSchemaJson({
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            direction: "forward",
          },
        ],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Navigation Property TestEntityClass.testNavProp is missing the required 'relationshipName' property.`);
    });

    it("should throw for navigation property with invalid relationshipName", async () => {
      const json = createNavPropSchemaJson({
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            direction: "forward",
            relationshipName: 0,
          },
        ],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Navigation Property TestEntityClass.testNavProp has an invalid 'relationshipName' property. It should be of type 'string'.`);
    });

    it("should throw for navigation property with nonexistent relationship", async () => {
      const json = createNavPropSchemaJson({
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            direction: "forward",
            relationshipName: "BadSchema.ThisDoesNotExist",
          },
        ],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `Unable to locate SchemaItem BadSchema.ThisDoesNotExist.`);
    });

    it("should throw for navigation property with missing direction", async () => {
      const json = createNavPropSchemaJson({
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
          },
        ],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Navigation Property TestEntityClass.testNavProp is missing the required 'direction' property.`);
    });

    it("should throw for navigation property with invalid direction", async () => {
      const json = createNavPropSchemaJson({
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: 0,
          },
        ],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Navigation Property TestEntityClass.testNavProp has an invalid 'direction' property. It should be of type 'string'.`);
    });
  });

  describe("fromJson", () => {
    let testClass: EntityClass;
    const baseJson = { schemaItemType: "EntityClass" };

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testClass = new EntityClass(schema, "TestEntity");
    });

    it("should throw for invalid mixins", async () => {
      expect(testClass).to.exist;
      let json: any = { ...baseJson, mixins: 0 };
      await expect(testClass.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECEntityClass TestEntity has an invalid 'mixins' attribute. It should be of type 'string[]'.`);

      json = { ...baseJson, mixins: [0] };
      await expect(testClass.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The ECEntityClass TestEntity has an invalid 'mixins' attribute. It should be of type 'string[]'.`);

      json = { ...baseJson, mixins: ["DoesNotExist"] };
      await expect(testClass.fromJson(json)).to.be.rejectedWith(ECObjectsError, `Unable to find the referenced SchemaItem DoesNotExist.`);
    });

    it("should throw for invalid mixins synchronously", () => {
      expect(testClass).to.exist;
      let json: any = { ...baseJson, mixins: 0 };
      expect(() => testClass.fromJsonSync(json)).to.throw(ECObjectsError, `The ECEntityClass TestEntity has an invalid 'mixins' attribute. It should be of type 'string[]'.`);

      json = { ...baseJson, mixins: [0] };
      expect(() => testClass.fromJsonSync(json)).to.throw(ECObjectsError, `The ECEntityClass TestEntity has an invalid 'mixins' attribute. It should be of type 'string[]'.`);

      json = { ...baseJson, mixins: ["DoesNotExist"] };
      expect(() => testClass.fromJsonSync(json)).to.throw(ECObjectsError, `Unable to find the referenced SchemaItem DoesNotExist.`);
    });
  });
  describe("toJson", () => {
    const schema = new Schema("TestSchema", 1, 0, 0);
    const testEntityClass = new EntityClass(schema, "testClass");
    const schemaJsonOne = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      version: "1.2.3",
      name: "testClass",
      schemaItemType: "EntityClass",
      baseClass: "TestSchema.testBaseClass",
    };
    it("async - Simple serialization", async () => {
      await testEntityClass.fromJson(schemaJsonOne);
      const serialized = testEntityClass.toJson(true, true);
      assert(serialized.baseClass, "TestSchema.testBaseClass");
      assert(serialized.modifier, "None");
      assert(serialized.schemaVersion, "1.0.0");
      assert(serialized.name, "testClass");
    });
    it("sync - Simple serialization", () => {
      testEntityClass.fromJsonSync(schemaJsonOne);
      const serialized = testEntityClass.toJson(true, true);
      assert(serialized.baseClass, "TestSchema.testBaseClass");
      assert(serialized.modifier, "None");
      assert(serialized.schemaVersion, "1.0.0");
      assert(serialized.name, "testClass");
    });
    it("should succeed with mixin", async () => {
      const schemaJson = createSchemaJsonWithItems({
        testMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.testClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          mixins: ["TestSchema.testMixin"],
        },
      });

      const ecschema = await Schema.fromJson(schemaJson);
      assert.isDefined(ecschema);

      const testClass = await ecschema.getItem("testClass");
      assert.isDefined(testClass);
      assert.isTrue(testClass instanceof EntityClass);
      const entityClass = testClass as EntityClass;
      const entityClassSerialization = entityClass!.toJson(false, true);
      const expectedResult = {
        schemaItemType: "EntityClass",
        modifier: "None",
        mixins: ["TestSchema.testMixin"],
      };
      expect(entityClassSerialization).to.deep.equal(expectedResult);
    });
  });
});
