/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ECSchema } from "../../source/Metadata/Schema";
import { EntityClass } from "../../source/Metadata/Class";

describe("entity class", () => {
  describe("deserialization", () => {
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

      const ecschema = ECSchema.fromObject(schemaJson);
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
  });
});
