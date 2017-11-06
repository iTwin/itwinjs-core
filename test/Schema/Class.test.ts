/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";

import { ECSchema } from "../../source/Metadata/Schema";
import { Class } from "../../source/Metadata/Class";
import { SchemaContext } from "../../source/Context";

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
            baseClass: "TestSchema.testBaseClass",
          },
        },
      };

      const ecschema = ECSchema.fromJson(schemaJson);
      assert.isDefined(ecschema);

      let testClass = ecschema.getClass("testClass");
      assert.isDefined(testClass);
      testClass = testClass as Class;
      assert.isDefined(testClass.baseClass);

      const baseClass = ecschema.getClass("testBaseClass");
      assert.isDefined(baseClass);

      assert.isTrue(baseClass === testClass.baseClass);
    });

    it("class with base class in reference schema", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        references: [
          {
            name: "RefSchema",
            version: "1.0.5",
          },
        ],
        children: {
          testClass: {
            schemaChildType: "EntityClass",
            baseClass: "RefSchema.BaseClassInRef",
          },
        },
      };

      const refSchema = new ECSchema("RefSchema", 1, 0, 5);
      const refBaseClass = refSchema.createEntityClass("BaseClassInRef");

      const context = new SchemaContext();
      context.addSchema(refSchema);

      const schema = ECSchema.fromJson(schemaJson, context);

      const testClass = schema.getClass("testClass");

      assert.isDefined(testClass);
      assert.isDefined(testClass!.baseClass);
      assert.isTrue(testClass!.baseClass === refBaseClass);

    });
  });
});
