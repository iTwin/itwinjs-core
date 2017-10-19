/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ECSchema } from "../../source/Metadata/Schema";
import { Enumeration  } from "../../source/Metadata/Enumeration";

describe("enumeration", () => {
  describe("deserialization", () => {
    it("minimum values", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testEnum: {
            schemaChildType: "Enumeration",
          },
        },
      };

      const ecSchema = ECSchema.fromObject(testSchema);
      const testEnum = ecSchema.getChild<Enumeration>("testEnum");
      assert.isDefined(testEnum);
    });
  });
});
