/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
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
            backingTypeName: "string",
            description: "Test description",
            label: "Test Enumeration",
            isStrict: true,
          },
        },
      };

      const ecSchema = ECSchema.fromJson(testSchema);
      const testEnum = ecSchema.getChild<Enumeration>("testEnum");
      assert.isDefined(testEnum);

      if (!testEnum)
        return;

      expect(testEnum.description).equal("Test description");
      expect(testEnum.label).equal("Test Enumeration");
      expect(testEnum.isStrict).equal(true);
    });

    it("with enumerators", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testEnum: {
            schemaChildType: "Enumeration",
            backingTypeName: "integer",
            enumerators: [
              {
                value: 0,
                label: "None",
              },
            ],
          },
        },
      };

      const ecSchema = ECSchema.fromJson(testSchema);
      const testEnum = ecSchema.getChild<Enumeration>("testEnum");
      assert.isDefined(testEnum);
    });
  });
});
