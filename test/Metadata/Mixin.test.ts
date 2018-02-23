/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import EntityClass from "../../source/Metadata/EntityClass";
import Mixin from "../../source/Metadata/Mixin";
import { ECObjectsError } from "../../source/Exception";

describe("Mixin", () => {
  describe("deserialization", () => {
    it("fully defined", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          TestMixin: {
            schemaChildType: "Mixin",
            baseClass: "TestSchema.BaseMixin",
            appliesTo: "TestSchema.TestEntity",
          },
          BaseMixin: {
            schemaChildType: "Mixin",
            appliesTo: "TestSchema.TestEntity",
          },
          TestEntity: {
            schemaChildType: "EntityClass",
          },
        },
      };

      const schema = await Schema.fromJson(testSchema);
      assert.isDefined(schema);

      const entity = await schema.getChild<EntityClass>("TestEntity");
      const baseMixin = await schema.getChild<Mixin>("BaseMixin");

      const mixin = await schema.getChild<Mixin>("TestMixin");
      assert.isDefined(mixin);

      assert.isDefined(await mixin!.appliesTo);
      assert.isTrue(await mixin!.appliesTo === entity);
      assert.isTrue(await mixin!.baseClass === baseMixin);
    });
  });

  describe("fromJson", () => {
    let testEntity: EntityClass;
    let testMixin: Mixin;
    const baseJson = { schemaChildType: "Mixin" };

    beforeEach(async () => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testEntity = await schema.createEntityClass("TestEntity");
      testMixin = new Mixin(schema, "TestMixin");
    });

    it("should successfully deserialize valid JSON", async () => {
      const json = {
        ...baseJson,
        appliesTo: "TestSchema.TestEntity",
      };
      expect(testMixin).to.exist;
      await testMixin.fromJson(json);

      expect(await testMixin.appliesTo).to.eql(testEntity);
    });

    it("should throw for missing appliesTo", async () => {
      expect(testMixin).to.exist;
      await expect(testMixin.fromJson({...baseJson})).to.be.rejectedWith(ECObjectsError, `The Mixin TestMixin is missing the required 'appliesTo' attribute.`);
    });

    it("should throw for invalid appliesTo", async () => {
      expect(testMixin).to.exist;
      const invalidAppliesToJson = { ...baseJson, appliesTo: 0 };
      await expect(testMixin.fromJson(invalidAppliesToJson)).to.be.rejectedWith(ECObjectsError, `The Mixin TestMixin has an invalid 'appliesTo' attribute. It should be of type 'string'.`);

      const unloadedAppliesToJson = { ...baseJson, appliesTo: "ThisClassDoesNotExist" };
      await expect(testMixin.fromJson(unloadedAppliesToJson)).to.be.rejectedWith(ECObjectsError);
    });
  });
});
