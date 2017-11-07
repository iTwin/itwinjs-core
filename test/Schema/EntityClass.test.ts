/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { ECSchema } from "../../source/Metadata/Schema";
import { Class, EntityClass } from "../../source/Metadata/Class";
import { ECClassModifier } from "../../source/ECObjects";

describe("entity class", () => {
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
      const testClass = ecschema.getClass<Class>("testEntityClass");
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
            appliesTo: "testClass",
          },
          testClass: {
            schemaChildType: "EntityClass",
            mixin: "testMixin",
          },
        },
      };

      const ecschema = ECSchema.fromJson(schemaJson);
      assert.isDefined(ecschema);

      const testClass = ecschema.getClass("testClass");
      assert.isDefined(testClass);
      assert.isTrue(testClass instanceof EntityClass);

      const mixinClass = ecschema.getClass("testMixin");
      assert.isDefined(mixinClass);

      const entityClass = testClass as EntityClass;
      assert.isDefined(entityClass.mixin);
      assert.isTrue(typeof(entityClass.mixin) === "object");

      assert.isTrue(entityClass.mixin === mixinClass);
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
  });
});
