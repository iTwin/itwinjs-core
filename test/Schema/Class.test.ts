/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";

import { ECSchema } from "../../source/Metadata/Schema";
import { Class } from "../../source/Metadata/Class";

describe("class", () => {
  describe("deserialization", () => {
    it("class with base class", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testBaseClass: {
            schemaChildType: "EntityClass",
          },
          testClass: {
            schemaChildType: "EntityClass",
            baseClass: "testBaseClass",
          },
        },
      };

      const ecschema = ECSchema.fromObject(schemaJson);
      assert.isDefined(ecschema);

      let testClass = ecschema.getClass("testClass");
      assert.isDefined(testClass);
      testClass = testClass as Class;
      assert.isDefined(testClass.baseClass);

      const baseClass = ecschema.getClass("testBaseClass");
      assert.isDefined(baseClass);

      assert.isTrue(baseClass === testClass.baseClass);
    });
  });
});
