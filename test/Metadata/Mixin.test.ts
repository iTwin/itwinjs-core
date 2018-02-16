/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import EntityClass from "../../source/Metadata/EntityClass";
import MixinClass from "../../source/Metadata/MixinClass";
import { ECObjectsError } from "../../source/Exception";

describe("MixinClass", () => {
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
      const baseMixin = await schema.getChild<MixinClass>("BaseMixin");

      const mixin = await schema.getChild<MixinClass>("TestMixin");
      assert.isDefined(mixin);

      assert.isDefined(await mixin!.appliesTo);
      assert.isTrue(await mixin!.appliesTo === entity);
      assert.isTrue(await mixin!.baseClass === baseMixin);
    });
  });

  describe("fromJson", () => {
    let testMixin: MixinClass;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testMixin = new MixinClass(schema, "TestMixin");
    });

    it("should throw for missing appliesTo", async () => {
      expect(testMixin).to.exist;
      await expect(testMixin.fromJson({})).to.be.rejectedWith(ECObjectsError, `The MixinClass TestMixin is missing the required 'appliesTo' attribute.`);
    });

    it("should throw for invalid appliesTo", async () => {
      expect(testMixin).to.exist;
      const invalidAppliesToJson = { appliesTo: 0 };
      await expect(testMixin.fromJson(invalidAppliesToJson)).to.be.rejectedWith(ECObjectsError, `The MixinClass TestMixin has an invalid 'appliesTo' attribute. It should be of type 'string'.`);

      const unloadedAppliesToJson = { appliesTo: "ThisClassDoesNotExist" };
      await expect(testMixin.fromJson(unloadedAppliesToJson)).to.be.rejectedWith(ECObjectsError);
    });
  });
});
