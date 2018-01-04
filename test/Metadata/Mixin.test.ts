/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ECSchema } from "../../source/Metadata/Schema";
import { EntityClass, MixinClass } from "../../source/Metadata/Class";

describe("mixin", () => {
  describe("deserialization", () => {
    it("fully defined", () => {
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

      const schema = ECSchema.fromJson(testSchema);
      assert.isDefined(schema);

      const entity = schema.getChild<EntityClass>("TestEntity");
      const baseMixin = schema.getChild<MixinClass>("BaseMixin");

      const mixin = schema.getChild<MixinClass>("TestMixin");
      assert.isDefined(mixin);

      assert.isDefined(mixin!.appliesTo);
      assert.isTrue(mixin!.appliesTo === entity);
      assert.isTrue(mixin!.baseClass === baseMixin);
    });
  });
});
