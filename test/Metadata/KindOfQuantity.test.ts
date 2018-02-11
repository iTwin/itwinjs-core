/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import ECSchema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import KindOfQuantity from "../../source/Metadata/KindOfQuantity";

describe("KindOfQuantity", () => {
  describe("deserialization", () => {
    it("fully defined", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testKoQ: {
            schemaChildType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: {
              format: "DefaultReal",
              unit: "MM",
            },
            presentationUnits: [
              {
                format: "DefaultReal",
                unit: "CM",
              },
              {
                format: "DefaultReal",
                unit: "IN",
              },
            ],
          },
        },
      };

      const ecSchema = await ECSchema.fromJson(testSchema);
      assert.isDefined(ecSchema);

      const testChild = await ecSchema.getChild("testKoQ");
      assert.isDefined(testChild);
      assert.isTrue(testChild instanceof KindOfQuantity);

      const testKoQ: KindOfQuantity = testChild as KindOfQuantity;
      assert.isDefined(testKoQ);

      expect(testKoQ.precision).equal(5);
      assert.isDefined(testKoQ.persistenceUnit);

      const persistenceUnit = testKoQ.persistenceUnit;
      expect(persistenceUnit.format).equal("DefaultReal");

      expect(testKoQ.presentationUnits.length).equal(2);

      assert.isTrue(testKoQ.presentationUnits[0] === testKoQ.defaultPresentationUnit);
    });

    it("should throw when precision is not a number", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          invalidKoQ: {
            schemaChildType: "KindOfQuantity",
            precision: "5",
          },
        },
      };

      await expect(ECSchema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError);
    });
  });
});
