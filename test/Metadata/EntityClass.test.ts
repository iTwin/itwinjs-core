/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { ECSchema } from "../../source/Metadata/Schema";
import { ECClass, EntityClass, MixinClass, RelationshipClass } from "../../source/Metadata/Class";
import { ECClassModifier } from "../../source/ECObjects";
import { NavigationProperty } from "../../source/Metadata/Property";

describe("entity class", () => {
  describe("get inherited properties", () => {
    it("from mixins", () => {
      const baseClass = new EntityClass("TestBase");
      const basePrimProp = baseClass.createPrimitiveProperty("BasePrimProp");

      const mixin = new MixinClass("TestMixin");
      const mixinPrimProp = mixin.createPrimitiveProperty("MixinPrimProp");

      const entityClass = new EntityClass("TestClass");
      entityClass.createPrimitiveProperty("PrimProp");
      entityClass.baseClass = baseClass;
      entityClass.mixins = [mixin];

      expect(entityClass.getProperty("MixinPrimProp")).to.be.undefined;
      expect(entityClass.getProperty("MixinPrimProp", true)).equal(mixinPrimProp);
      expect(entityClass.getInheritedProperty("MixinPrimProp")).equal(mixinPrimProp);

      expect(entityClass.getProperty("BasePrimProp")).to.be.undefined;
      expect(entityClass.getProperty("BasePrimProp", false)).to.be.undefined;
      expect(entityClass.getProperty("BasePrimProp", true)).equal(basePrimProp);
      expect(entityClass.getInheritedProperty("BasePrimProp")).equal(basePrimProp);
      expect(entityClass.getInheritedProperty("PrimProp")).to.be.undefined;
    });
  });

  describe("deserialization", () => {
    it("succeed with fully defined", () => {
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

      const ecschema = ECSchema.fromJson(schemaJson);
      const testClass = ecschema.getClass<ECClass>("testEntityClass");
      assert.isDefined(testClass);

      const testEntity = ecschema.getClass<EntityClass>("testEntityClass");
      assert.isDefined(testEntity);

      expect(testEntity!.name).equal("testEntityClass");
      expect(testEntity!.label).equal("Test Entity Class");
      expect(testEntity!.description).equal("Used for testing");
      expect(testEntity!.modifier).equal(ECClassModifier.None);
    });

    it("with mixin", () => {
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

      const ecschema = ECSchema.fromJson(schemaJson);
      assert.isDefined(ecschema);

      const testClass = ecschema.getClass("testClass");
      assert.isDefined(testClass);
      assert.isTrue(testClass instanceof EntityClass);
      const entityClass = testClass as EntityClass;

      const mixinClass = ecschema.getClass<MixinClass>("testMixin");
      assert.isDefined(mixinClass);

      assert.isDefined(entityClass.mixins);
      expect(entityClass.mixins!.length).equal(1);
      assert.isTrue(entityClass.mixins![0] === mixinClass);

      assert.isDefined(mixinClass!.appliesTo);
      assert.isTrue(entityClass === mixinClass!.appliesTo);
    });

    it("with multiple mixins", () => {
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

      const ecschema = ECSchema.fromJson(schemaJson);
      assert.isDefined(ecschema);
    });

    it("with base class", () => {
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

      const ecSchema = ECSchema.fromJson(schemaJson);
      assert.isDefined(ecSchema);

      const testEntity = ecSchema.getClass<EntityClass>("testClass");
      assert.isDefined(testEntity);

      const testBaseEntity = ecSchema.getClass<EntityClass>("baseClass");
      assert.isDefined(testBaseEntity);

      assert.isDefined(testEntity!.baseClass);
      assert.isTrue(typeof(testEntity!.baseClass) === "object");

      assert.isTrue(testEntity!.baseClass === testBaseEntity);
    });

    it("with navigation property", () => {
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

      const schema = ECSchema.fromJson(schemaJson);
      assert.isDefined(schema);

      const entityClass = schema.getClass<EntityClass>("TestClass");
      assert.isDefined(entityClass);

      const navProp = entityClass!.getProperty<NavigationProperty>("testNavProp");
      assert.isDefined(navProp);

      const relClass = schema.getClass<RelationshipClass>("NavPropRelationship");

      assert.isTrue(navProp!.relationship === relClass);
    });
  });
});
