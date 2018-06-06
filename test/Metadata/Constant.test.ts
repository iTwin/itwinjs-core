/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import Constant from "../../source/Metadata/Constant";
import { ECObjectsError } from "../../source/Exception";
import * as sinon from "sinon";

describe("Constant tests", () => {
  let testConstant: Constant;
  describe("accept", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testConstant = new Constant(schema, "TestEnumeration");
    });

    it("should call visitConstant on a SchemaItemVisitor object", async () => {
      expect(testConstant).to.exist;
      const mockVisitor = { visitConstant: sinon.spy() };
      await testConstant.accept(mockVisitor);
      expect(mockVisitor.visitConstant.calledOnce).to.be.true;
      expect(mockVisitor.visitConstant.calledWithExactly(testConstant)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitConstant defined", async () => {
      expect(testConstant).to.exist;
      await testConstant.accept({});
    });
  });
  describe("fromJson", () => {
    beforeEach(() => {
      const schema = new Schema("ExampleSchema", 1, 0, 0);
      testConstant = new Constant(schema, "PI");
    });
    it("Basic test", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: "Pi",
        definition: "ONE",
        numerator: 3.1415926535897932384626433832795,
        phenomenon: "Units.LENGTH_RATIO",
      };
      await testConstant.fromJson(json);
      assert(testConstant.label, "Pi");
      assert(testConstant.phenomenon, "Units.LENGTH_RATIO");
    });
    it("Name is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        label: "Pi",
        definition: "ONE",
        numerator: 3.1415926535897932384626433832795,
        phenomenon: "Units.LENGTH_RATIO",
      };
      await expect(testConstant.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Constant PI does not have the required 'name' attribute.`);
    });
    it("Name must be valid ECName", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "3.14PI",
        label: "Pi",
        definition: "ONE",
        numerator: 3.1415926535897932384626433832795,
        phenomenon: "Units.LENGTH_RATIO",
      };
      await expect(testConstant.fromJson(json)).to.be.rejectedWith(ECObjectsError, ``);
    });
    it("Label must be string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: 3.14,
        definition: "ONE",
        numerator: 3.1415926535897932384626433832795,
        phenomenon: "Units.LENGTH_RATIO",
      };
      await expect(testConstant.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem PI has an invalid 'label' attribute. It should be of type 'string'.`);
    });
    it("Description must be string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: "Pi",
        description: 3.14,
        definition: "ONE",
        numerator: 3.1415926535897932384626433832795,
        phenomenon: "Units.LENGTH_RATIO",
      };
      await expect(testConstant.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem PI has an invalid 'description' attribute. It should be of type 'string'.`);
    });
    it("Phenomenon is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: "Pi",
        definition: "ONE",
        numerator: 3.1415926535897932384626433832795,
      };
      await expect(testConstant.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Constant PI does not have the required 'phenomenon' attribute.`);
    });
    it("Definition is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: "Pi",
        numerator: 3.1415926535897932384626433832795,
        phenomenon: "Units.LENGTH_RATIO",
      };
      await expect(testConstant.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Constant PI does not have the required 'definition' attribute.`);
    });
    it("Definition must be a string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: "Pi",
        definition: 1,
        numerator: 3.1415926535897932384626433832795,
        phenomenon: "Units.LENGTH_RATIO",
      };
      await expect(testConstant.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Constant PI has an invalid 'definition' attribute. It should be of type 'string'.`);
    });
    it("Numerator, denominator default values are both 1.0", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: "Pi",
        definition: "ONE",
        phenomenon: "Units.LENGTH_RATIO",
      };
      await testConstant.fromJson(json);
      assert(testConstant.numerator === 1.0);
      assert(testConstant.denominator === 1.0);
    });
    it("Numerator, denominator are different than default", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: "Pi",
        definition: "ONE",
        numerator: 3.1415926535897932384626433832795,
        phenomenon: "Units.LENGTH_RATIO",
        denominator: 6.0,
      };
      await testConstant.fromJson(json);
      assert(testConstant.numerator === 3.1415926535897932384626433832795);
      assert(testConstant.denominator === 6.0);
    });
    it("Numerator and denominator must be numbers", async () => {
      const jsonNumerator = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: "Pi",
        definition: "ONE",
        numerator: "3.1415926535897932384626433832795",
        phenomenon: "Units.LENGTH_RATIO",
        denominator: 6.0,
      };
      const jsonDenominator = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: "Pi",
        definition: "ONE",
        numerator: 3.1415926535897932384626433832795,
        phenomenon: "Units.LENGTH_RATIO",
        denominator: "6.0",
      };
      await expect(testConstant.fromJson(jsonNumerator)).to.be.rejectedWith(ECObjectsError, `The Constant PI has an invalid 'numerator' attribute. It should be of type 'number'.`);
      await expect(testConstant.fromJson(jsonDenominator)).to.be.rejectedWith(ECObjectsError, `The Constant PI has an invalid 'denominator' attribute. It should be of type 'number'.`);
    });
  });
});
