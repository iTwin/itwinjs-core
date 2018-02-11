/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import ECSchema from "../../source/Metadata/Schema";
import EntityClass from "../../source/Metadata/EntityClass";
import MixinClass from "../../source/Metadata/MixinClass";

describe("mixin", () => {
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

      const schema = await ECSchema.fromJson(testSchema);
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
});
