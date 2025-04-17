/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { DelayedPromiseWithProps } from "../../DelayedPromise";
import { ECClassModifier, SchemaItemType } from "../../ECObjects";
import { ECSchemaError } from "../../Exception";
import { ECClass, MutableClass } from "../../Metadata/Class";
import { EntityClass, MutableEntityClass } from "../../Metadata/EntityClass";
import { Mixin } from "../../Metadata/Mixin";
import { RelationshipClass } from "../../Metadata/RelationshipClass";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument, getElementChildrenByTagName } from "../TestUtils/SerializationHelper";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

describe("EntityClass", () => {
  describe("type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
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

    before(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      assert.isDefined(ecSchema);
    });

    it("typeguard and type assertion should work on EntityClass", async () => {
      const testEntityClass = await ecSchema.getItem("TestEntityClass");
      assert.isDefined(testEntityClass);
      expect(EntityClass.isEntityClass(testEntityClass)).to.be.true;
      expect(() => EntityClass.assertIsEntityClass(testEntityClass)).not.to.throw();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      assert.isDefined(testPhenomenon);
      expect(EntityClass.isEntityClass(testPhenomenon)).to.be.false;
      expect(() => EntityClass.assertIsEntityClass(testPhenomenon)).to.throw();
    });

    it("EntityClass type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestEntityClass", EntityClass)).to.be.instanceof(EntityClass);
      expect(ecSchema.getItemSync("TestEntityClass", EntityClass)).to.be.instanceof(EntityClass);
    });

    it("EntityClass type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", EntityClass)).to.be.undefined;
      expect(ecSchema.getItemSync("TestPhenomenon", EntityClass)).to.be.undefined;
    });
  });

  describe("get inherited properties", () => {
    let schema: Schema;

    beforeEach(() => {
      schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
    });

    it("should get fullName", () => {
      const entityClass = new EntityClass(schema, "TestClass");
      expect(entityClass.fullName).eq("TestSchema.TestClass");
    });

    it("from mixins", async () => {
      const baseClass = new EntityClass(schema, "TestBase");
      const basePrimProp = await (baseClass as ECClass as MutableClass).createPrimitiveProperty("BasePrimProp");

      const mixin = new Mixin(schema, "TestMixin");
      const mixinPrimProp = await (mixin as ECClass as MutableClass).createPrimitiveProperty("MixinPrimProp");

      const entityClass = new EntityClass(schema, "TestClass");
      await (entityClass as ECClass as MutableClass).createPrimitiveProperty("PrimProp");
      await (entityClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(baseClass.key, async () => baseClass));
      (entityClass as MutableEntityClass).addMixin(mixin);

      expect(await entityClass.getProperty("MixinPrimProp", true)).to.be.undefined;
      expect(await entityClass.getProperty("MixinPrimProp")).equal(mixinPrimProp);
      expect(await entityClass.getInheritedProperty("MixinPrimProp")).equal(mixinPrimProp);

      expect(await entityClass.getProperty("BasePrimProp", true)).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp", true)).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp")).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("BasePrimProp")).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("PrimProp")).to.be.undefined;
    });

    it("from mixins synchronously", async () => {
      const baseClass = (schema as MutableSchema).createEntityClassSync("TestBase");
      const basePrimProp = (baseClass as ECClass as MutableClass).createPrimitivePropertySync("BasePrimProp");

      const mixin = (schema as MutableSchema).createMixinClassSync("TestMixin");
      const mixinPrimProp = (mixin as ECClass as MutableClass).createPrimitivePropertySync("MixinPrimProp");

      const entityClass = (schema as MutableSchema).createEntityClassSync("TestClass");
      (entityClass as ECClass as MutableClass).createPrimitivePropertySync("PrimProp");
      await (entityClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(baseClass.key, async () => baseClass));
      (entityClass as MutableEntityClass).addMixin(mixin);

      expect(entityClass.getPropertySync("MixinPrimProp", true)).to.be.undefined;
      expect(entityClass.getPropertySync("MixinPrimProp")).equal(mixinPrimProp);
      expect(entityClass.getInheritedPropertySync("MixinPrimProp")).equal(mixinPrimProp);

      expect(entityClass.getPropertySync("BasePrimProp", true)).to.be.undefined;
      expect(entityClass.getPropertySync("BasePrimProp", true)).to.be.undefined;
      expect(entityClass.getPropertySync("BasePrimProp")).equal(basePrimProp);
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

      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
      const testClass = await ecschema.getItem("TestEntityClass", ECClass);
      assert.isDefined(testClass);

      const testEntity = await ecschema.getItem("TestEntityClass", EntityClass);
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

      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(ecschema);

      const testClass = await ecschema.getItem("testClass");
      assert.isDefined(testClass);
      assert.isTrue(testClass?.schemaItemType === SchemaItemType.EntityClass);
      const entityClass = testClass as EntityClass;

      const mixinClass = await ecschema.getItem("testMixin", Mixin);
      assert.isDefined(mixinClass);

      assert.isDefined(entityClass.mixins);
      expect(entityClass.mixins.length).equal(1);
      assert.isTrue(await entityClass.mixins[0] === mixinClass);

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
      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
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
      const ecschema = Schema.fromJsonSync(schemaJson, new SchemaContext());
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

      const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(ecSchema);

      const testEntity = await ecSchema.getItem("testClass", EntityClass);
      assert.isDefined(testEntity);

      const testBaseEntity = await ecSchema.getItem("baseClass", EntityClass);
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

      const ecSchema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      assert.isDefined(ecSchema);

      const testEntity = ecSchema.getItemSync("testClass", EntityClass);
      assert.isDefined(testEntity);

      const testBaseEntity = ecSchema.getItemSync("baseClass", EntityClass);
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

      const schema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(schema);

      const entityClass = await schema.getItem("TestEntityClass", EntityClass);
      assert.isDefined(entityClass);

      const navProp = await entityClass!.getProperty("testNavProp");
      assert.isDefined(navProp);
      if (navProp && navProp.isNavigation()) {
        const relClass = await schema.getItem("NavPropRelationship", RelationshipClass);
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

      const schema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      assert.isDefined(schema);

      const entityClass = schema.getItemSync("TestEntityClass", EntityClass);
      assert.isDefined(entityClass);

      const navProp = entityClass!.getPropertySync("testNavProp");
      assert.isDefined(navProp);
      if (navProp && navProp.isNavigation()) {
        const relClass = schema.getItemSync("NavPropRelationship", RelationshipClass);
        assert.isTrue(navProp.getRelationshipClassSync() === relClass);
      } else {
        assert.fail();
      }
    });

    it("should throw for invalid baseClass", async () => {
      const json = createSchemaJson({ baseClass: 0 });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECClass TestSchema.TestEntityClass has an invalid 'baseClass' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid mixins", async () => {
      let json: any = createSchemaJson({ mixins: 0, schema: "TestSchema" });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECEntityClass TestSchema.TestEntityClass has an invalid 'mixins' attribute. It should be of type 'string[]'.`);

      json = createSchemaJson({ mixins: [0], schema: "TestSchema" });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECEntityClass TestSchema.TestEntityClass has an invalid 'mixins' attribute. It should be of type 'string[]'.`);
    });

    it("should throw for invalid properties", async () => {
      let json: any = createSchemaJson({ properties: 0 });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECClass TestSchema.TestEntityClass has an invalid 'properties' attribute. It should be of type 'object[]'.`);

      json = createSchemaJson({
        properties: [0],
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `An ECProperty in TestSchema.TestEntityClass is an invalid JSON object.`);
    });

    it("should throw for property with missing name", async () => {
      const json = createSchemaJson({
        properties: [{ type: "PrimitiveProperty" }],
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `An ECProperty in TestSchema.TestEntityClass is missing the required 'name' attribute.`);
    });

    it("should throw for property with invalid name", async () => {
      const json = createSchemaJson({
        properties: [{ type: "PrimitiveProperty", name: 0 }],
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `An ECProperty in TestSchema.TestEntityClass has an invalid 'name' attribute. It should be of type 'string'.`);
    });

    it("should throw for property with missing type", async () => {
      const json = createSchemaJson({
        properties: [{ name: "badProp" }],
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECProperty TestSchema.TestEntityClass.badProp does not have the required 'type' attribute.`);
    });

    it("should throw for property with invalid type", async () => {
      const json = createSchemaJson({
        properties: [{ name: "badProp", type: 0 }],
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECProperty TestSchema.TestEntityClass.badProp has an invalid 'type' attribute. It should be of type 'string'.`);
    });

    it("should throw for property with missing typeName", async () => {
      const json = createSchemaJson({
        properties: [{ name: "badProp", type: "PrimitiveProperty" }],
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECProperty TestSchema.TestEntityClass.badProp is missing the required 'typeName' attribute.`);
    });

    it("should throw for property with invalid typeName", async () => {
      const json = createSchemaJson({
        properties: [{ name: "badProp", type: "PrimitiveProperty", typeName: 0 }],
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECProperty TestSchema.TestEntityClass.badProp has an invalid 'typeName' attribute. It should be of type 'string'.`);
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
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECProperty TestSchema.TestEntityClass.testProp has an invalid 'category' attribute. It should be of type 'string'.`);
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
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The ECProperty TestSchema.TestEntityClass.testProp has an invalid 'kindOfQuantity' attribute. It should be of type 'string'.`);
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
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Navigation Property TestSchema.TestEntityClass.testNavProp is missing the required 'relationshipName' property.`);
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
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Navigation Property TestSchema.TestEntityClass.testNavProp has an invalid 'relationshipName' property. It should be of type 'string'.`);
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
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `Unable to locate SchemaItem BadSchema.ThisDoesNotExist.`);
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
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Navigation Property TestSchema.TestEntityClass.testNavProp is missing the required 'direction' property.`);
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
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Navigation Property TestSchema.TestEntityClass.testNavProp has an invalid 'direction' property. It should be of type 'string'.`);
    });
  });

  describe("fromJson", () => {
    let testClass: EntityClass;
    const baseJson = {
      schemaItemType: "EntityClass",
      schema: "TestSchema",
    };

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testClass = new EntityClass(schema, "TestEntity");
    });

    it("should throw for invalid mixins", async () => {
      expect(testClass).to.exist;
      const props = { ...baseJson, mixins: ["DoesNotExist"] };
      await expect(testClass.fromJSON(props)).to.be.rejectedWith(ECSchemaError, `Unable to find the referenced SchemaItem DoesNotExist.`);
    });

    it("should throw for invalid mixins synchronously", () => {
      expect(testClass).to.exist;
      const props = { ...baseJson, mixins: ["DoesNotExist"] };
      expect(() => testClass.fromJSONSync(props)).to.throw(ECSchemaError, `Unable to find the referenced SchemaItem DoesNotExist.`);
    });
  });

  describe("toJSON", () => {
    const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
    const testEntityClass = new EntityClass(schema, "testClass");
    const schemaJsonOne = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      version: "1.2.3",
      name: "testClass",
      schemaItemType: "EntityClass",
      baseClass: "TestSchema.testBaseClass",
    };
    it("async - Simple serialization", async () => {
      await testEntityClass.fromJSON(schemaJsonOne);
      const serialized = testEntityClass.toJSON(true, true);
      assert.strictEqual(serialized.baseClass, "TestSchema.testBaseClass");
      assert.notProperty(serialized, "modifier");
      assert.strictEqual(serialized.schemaVersion, "01.00.00");
      assert.strictEqual(serialized.name, "testClass");
    });
    it("sync - Simple serialization", () => {
      testEntityClass.fromJSONSync(schemaJsonOne);
      const serialized = testEntityClass.toJSON(true, true);
      assert.strictEqual(serialized.baseClass, "TestSchema.testBaseClass");
      assert.notProperty(serialized, "modifier");
      assert.strictEqual(serialized.schemaVersion, "01.00.00");
      assert.strictEqual(serialized.name, "testClass");
    });
    it("async - JSON stringify serialization succeeds", async () => {
      await testEntityClass.fromJSON(schemaJsonOne);
      const json = JSON.stringify(testEntityClass);
      const serialized = JSON.parse(json);
      assert.strictEqual(serialized.baseClass, "TestSchema.testBaseClass");
      assert.notProperty(serialized, "modifier");
      assert.strictEqual(serialized.schemaVersion, undefined);
      assert.strictEqual(serialized.name, undefined);
    });
    it("sync - JSON stringify serialization succeeds", () => {
      testEntityClass.fromJSONSync(schemaJsonOne);
      const json = JSON.stringify(testEntityClass);
      const serialized = JSON.parse(json);
      assert.strictEqual(serialized.baseClass, "TestSchema.testBaseClass");
      assert.notProperty(serialized, "modifier");
      assert.strictEqual(serialized.schemaVersion, undefined);
      assert.strictEqual(serialized.name, undefined);
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

      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(ecschema);

      const testClass = await ecschema.getItem("testClass");
      assert.isDefined(testClass);
      assert.isTrue(testClass?.schemaItemType === SchemaItemType.EntityClass);
      const entityClass = testClass as EntityClass;
      const entityClassSerialization = entityClass.toJSON(false, true);
      const expectedResult = {
        schemaItemType: "EntityClass",
        mixins: ["TestSchema.testMixin"],
      };
      expect(entityClassSerialization).to.deep.equal(expectedResult);
    });
  });

  describe("toXml", () => {
    const newDom = createEmptyXmlDocument();
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

    it("should properly serialize", async () => {
      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(ecschema);
      const testClass = await ecschema.getItem("testClass", EntityClass);
      assert.isDefined(testClass);
      const serialized = await testClass!.toXml(newDom);
      expect(serialized.nodeName).to.eql("ECEntityClass");

      const baseClasses = getElementChildrenByTagName(serialized, "BaseClass");
      assert.strictEqual(baseClasses.length, 1);

      const mixin = baseClasses[0];
      expect(mixin.textContent).to.eql("testMixin");
    });
  });
});
