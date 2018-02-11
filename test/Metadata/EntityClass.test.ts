/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import ECSchema from "../../source/Metadata/Schema";
import ECClass from "../../source/Metadata/Class";
import EntityClass from "../../source/Metadata/EntityClass";
import MixinClass from "../../source/Metadata/MixinClass";
import RelationshipClass from "../../source/Metadata/RelationshipClass";
import { ECClassModifier } from "../../source/ECObjects";
import { DelayedPromiseWithProps } from "../../source/DelayedPromise";

describe("entity class", () => {
  describe("get inherited properties", () => {
    let schema: ECSchema;

    beforeEach(() => {
      schema = new ECSchema("TestSchema", 1, 0, 0);
    });

    it("from mixins", async () => {
      const baseClass = new EntityClass(schema, "TestBase");
      const basePrimProp = await baseClass.createPrimitiveProperty("BasePrimProp");

      const mixin = new MixinClass(schema, "TestMixin");
      const mixinPrimProp = await mixin.createPrimitiveProperty("MixinPrimProp");

      const entityClass = new EntityClass(schema, "TestClass");
      await entityClass.createPrimitiveProperty("PrimProp");
      entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);
      entityClass.mixins = [ new DelayedPromiseWithProps(mixin.key, async () => mixin) ];

      expect(await entityClass.getProperty("MixinPrimProp")).to.be.undefined;
      expect(await entityClass.getProperty("MixinPrimProp", true)).equal(mixinPrimProp);
      expect(await entityClass.getInheritedProperty("MixinPrimProp")).equal(mixinPrimProp);

      expect(await entityClass.getProperty("BasePrimProp")).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp", false)).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp", true)).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("BasePrimProp")).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("PrimProp")).to.be.undefined;
    });
  });

  describe("deserialization", () => {
    it("succeed with fully defined", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testEntityClass: {
            schemaChildType: "EntityClass",
            label: "Test Entity Class",
            description: "Used for testing",
            modifier: "None",
          },
        },
      };

      const ecschema = await ECSchema.fromJson(schemaJson);
      const testClass = await ecschema.getClass<ECClass>("testEntityClass");
      assert.isDefined(testClass);

      const testEntity = await ecschema.getClass<EntityClass>("testEntityClass");
      assert.isDefined(testEntity);

      expect(testEntity!.name).equal("testEntityClass");
      expect(testEntity!.label).equal("Test Entity Class");
      expect(testEntity!.description).equal("Used for testing");
      expect(testEntity!.modifier).equal(ECClassModifier.None);
    });

    it("with mixin", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testMixin: {
            schemaChildType: "Mixin",
            appliesTo: "TestSchema.testClass",
          },
          testClass: {
            schemaChildType: "EntityClass",
            mixin: "TestSchema.testMixin",
          },
        },
      };

      const ecschema = await ECSchema.fromJson(schemaJson);
      assert.isDefined(ecschema);

      const testClass = await ecschema.getClass("testClass");
      assert.isDefined(testClass);
      assert.isTrue(testClass instanceof EntityClass);
      const entityClass = testClass as EntityClass;

      const mixinClass = await ecschema.getClass<MixinClass>("testMixin");
      assert.isDefined(mixinClass);

      assert.isDefined(entityClass.mixins);
      expect(entityClass.mixins!.length).equal(1);
      assert.isTrue(await entityClass.mixins![0] === mixinClass);

      assert.isDefined(await mixinClass!.appliesTo);
      assert.isTrue(entityClass === await mixinClass!.appliesTo);
    });

    it("with multiple mixins", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testMixin: {
            schemaChildType: "Mixin",
            appliesTo: "TestSchema.testClass",
          },
          testClass: {
            schemaChildType: "EntityClass",
            mixin: [
              "TestSchema.testMixin",
              "TestSchema.anotherMixin",
            ],
          },
          anotherMixin: {
            schemaChildType: "Mixin",
            appliesTo: "TestSchema.testClass",
          },
        },
      };

      const ecschema = await ECSchema.fromJson(schemaJson);
      assert.isDefined(ecschema);
    });

    it("with base class", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          baseClass: {
            schemaChildType: "EntityClass",
          },
          testClass: {
            schemaChildType: "EntityClass",
            baseClass: "TestSchema.baseClass",
          },
        },
      };

      const ecSchema = await ECSchema.fromJson(schemaJson);
      assert.isDefined(ecSchema);

      const testEntity = await ecSchema.getClass<EntityClass>("testClass");
      assert.isDefined(testEntity);

      const testBaseEntity = await ecSchema.getClass<EntityClass>("baseClass");
      assert.isDefined(testBaseEntity);

      assert.isDefined(await testEntity!.baseClass);
      assert.isTrue(typeof(await testEntity!.baseClass) === "object");

      assert.isTrue(await testEntity!.baseClass === testBaseEntity);
    });

    it("with navigation property", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          NavPropRelationship: {
            schemaChildType: "RelationshipClass",
            strength: "Embedding",
            strengthDirection: "Forward",
            modifier: "Sealed",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Source RoleLabel",
              constraintClasses: [
                "TestSchema.TestClass",
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
            schemaChildType: "EntityClass",
          },
          TestClass: {
            schemaChildType: "EntityClass",
            properties: [
              {
                propertyType: "NavigationProperty",
                name: "testNavProp",
                relationshipName: "TestSchema.NavPropRelationship",
              },
            ],
          },
        },
      };

      const schema = await ECSchema.fromJson(schemaJson);
      assert.isDefined(schema);

      const entityClass = await schema.getClass<EntityClass>("TestClass");
      assert.isDefined(entityClass);

      const navProp = await entityClass!.getProperty("testNavProp");
      assert.isDefined(navProp);
      if (navProp && navProp.isNavigation()) {
        const relClass = await schema.getClass<RelationshipClass>("NavPropRelationship");
        assert.isTrue(await navProp.relationshipClass === relClass);
      } else {
        assert.fail();
      }
    });
  });
});
