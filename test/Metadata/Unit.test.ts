/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import Unit from "../../source/Metadata/Unit";
import { ECObjectsError } from "../../source/Exception";
import * as sinon from "sinon";

describe("Unit tests", () => {
  let testUnit: Unit;
  describe("accept", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testUnit = new Unit(schema, "TestUnit");
    });

    it("should call visitUnit on a SchemaItemVisitor object", async () => {
      expect(testUnit).to.exist;
      const mockVisitor = { visitUnit: sinon.spy() };
      await testUnit.accept(mockVisitor);
      expect(mockVisitor.visitUnit.calledOnce).to.be.true;
      expect(mockVisitor.visitUnit.calledWithExactly(testUnit)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitUnit defined", async () => {
      expect(testUnit).to.exist;
      await testUnit.accept({});
    });
  });
  describe("fromJson", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testUnit = new Unit(schema, "MM");
    });
    it("Basic test for definition", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "MM",
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "Units.Length",
        unitSystem: "Units.Metric",
        definition: "[MILLI]*Units.M",
        numerator: 1.0,
        denominator: 1.0,
        offset: 0.0,
      };
      await testUnit.fromJson(json);
      assert(testUnit.definition, "[MILLI]*Units.M");
    });
    it("Label must be a string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "MM",
        label: 77,
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "Units.Length",
        unitSystem: "Units.Metric",
        definition: "[MILLI]*Units.M",
        numerator: 1.0,
        denominator: 1.0,
        offset: 0.0,
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem MM has an invalid 'label' attribute. It should be of type 'string'.`);
    });
    it("Name in json must match name in constructor", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "MMM",
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "Units.Length",
        unitSystem: "Units.Metric",
        definition: "[MILLI]*Units.M",
        numerator: 1.0,
        denominator: 1.0,
        offset: 0.0,
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, ``);
    });
    it("Phenomenon can't be undefined", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "MM",
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        unitSystem: "Units.Metric",
        definition: "[MILLI]*Units.M",
        numerator: 1.0,
        denominator: 1.0,
        offset: 0.0,
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Unit MM does not have the required 'phenomenon' attribute.`);
    });
    it("Numerator can't be a string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "MM",
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "Units.Length",
        unitSystem: "Units.Metric",
        definition: "[MILLI]*Units.M",
        numerator: "1.0",
        denominator: 1.0,
        offset: 0.0,
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Unit MM has an invalid 'numerator' attribute. It should be of type 'number'.`);
    });
    it("Numerator, denominator, offset default values are 1.0, 1.0, 0.0, respectively", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "MM",
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "Units.Length",
        unitSystem: "Units.Metric",
        definition: "[MILLI]*Units.M",
      };
      await testUnit.fromJson(json);
      assert(testUnit.numerator === 1.0);
      assert(testUnit.denominator === 1.0);
      assert(testUnit.offset === 0.0);
    });
    it("Numerator, denominator, offset are different than default", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "MM",
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "Units.Length",
        unitSystem: "Units.Metric",
        definition: "[MILLI]*Units.M",
        numerator: 3.0,
        denominator: 6.0,
        offset: 4.0,
      };
      await testUnit.fromJson(json);
      assert(testUnit.numerator === 3.0);
      assert(testUnit.denominator === 6.0);
      assert(testUnit.offset === 4.0);
    });
    it("Check fully qualified name of Phenomenon & Unit System", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "MM",
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "Units.Length",
        unitSystem: "Units.Metric",
        definition: "[MILLI]*Units.M",
      };
      await testUnit.fromJson(json);
      assert(testUnit.phenomenon === "Units.Length");
      assert(testUnit.unitSystem === "Units.Metric");
    });
    it("Invalid ECName", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "5MM",
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "Units.Length",
        unitSystem: "Units.Metric",
        definition: "[MILLI]*Units.M",
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, ``);
    });
    it("Unit System is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "MM",
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "Units.Length",
        definition: "[MILLI]*Units.M",
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Unit MM does not have the required 'unitSystem' attribute.`);
    });
    it("Definition is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Unit",
        name: "MM",
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "Units.Length",
        unitSystem: "Units.Metric",
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Unit MM does not have the required 'definition' attribute.`);
    });
  });
});
