/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import PropertyCategory from "../../source/Metadata/PropertyCategory";

describe("PropertyCategory", () => {
  describe("deserialization", () => {
    it("fully defined ", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testPropCategory: {
            schemaChildType: "PropertyCategory",
            priority: 5,
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema);
      assert.isDefined(ecSchema);

      const child = await ecSchema.getChild("testPropCategory");
      assert.isDefined(child);
      assert.isTrue(child instanceof PropertyCategory);

      const propCat = child as PropertyCategory;
      assert.isDefined(propCat);
      expect(propCat.priority).equal(5);
    });

    it("should throw when priority is not a number", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          invalidPropCategory: {
            schemaChildType: "PropertyCategory",
            priority: "5",
          },
        },
      };

      await expect(Schema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError);
    });
  });
});
