/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import InvertedUnit from "../../source/Metadata/InvertedUnit";
import { ECObjectsError } from "../../source/Exception";
import * as sinon from "sinon";

describe("Inverted Unit tests", () => {
  let testUnit: InvertedUnit;
  describe("accept", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testUnit = new InvertedUnit(schema, "TestInvertedUnit");
    });

    it("should call visitInvertedUnit on a SchemaItemVisitor object", async () => {
      expect(testUnit).to.exist;
      const mockVisitor = { visitInvertedUnit: sinon.spy() };
      await testUnit.accept(mockVisitor);
      expect(mockVisitor.visitInvertedUnit.calledOnce).to.be.true;
      expect(mockVisitor.visitInvertedUnit.calledWithExactly(testUnit)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitInvertedUnit defined", async () => {
      expect(testUnit).to.exist;
      await testUnit.accept({});
    });
  });
  describe("fromJson", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testUnit = new InvertedUnit(schema, "HORIZONTAL_PER_VERTICAL");
    });
    it("Basic test for label", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "InvertedUnit",
        name: "HORIZONTAL_PER_VERTICAL",
        label: "Horizontal/Vertical",
        description: "A unit representing run over rise",
        unitSystem: "ExampleSchema.INTERNATIONAL",
        invertsUnit: "ExampleSchema.VERTICAL_PER_HORIZONTAL",
      };
      await testUnit.fromJson(json);
      assert(testUnit.label, "Horizontal/Vertical");
    });
    it("Name is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "InvertedUnit",
        label: "Horizontal/Vertical",
        description: "A unit representing run over rise",
        unitSystem: "ExampleSchema.INTERNATIONAL",
        invertsUnit: "ExampleSchema.VERTICAL_PER_HORIZONTAL",
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The InvertedUnit HORIZONTAL_PER_VERTICAL does not have the required 'name' attribute.`);
    });
    it("Name is not a valid ECName", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "InvertedUnit",
        name: "111HORIZONTAL_PER_VERTICAL",
        label: "Horizontal/Vertical",
        description: "A unit representing run over rise",
        unitSystem: "ExampleSchema.INTERNATIONAL",
        invertsUnit: "ExampleSchema.VERTICAL_PER_HORIZONTAL",
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, ``);
    });
    it("Label and description are optional", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "InvertedUnit",
        name: "HORIZONTAL_PER_VERTICAL",
        unitSystem: "ExampleSchema.INTERNATIONAL",
        invertsUnit: "ExampleSchema.VERTICAL_PER_HORIZONTAL",
      };
      await testUnit.fromJson(json);
      assert(testUnit.unitSystem, "ExampleSchema.INTERNATIONAL");
      assert(testUnit.invertsUnit, "ExampleSchema.VERTICAL_PER_HORIZONTAL");
    });
    it("Label must be string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "InvertedUnit",
        name: "HORIZONTAL_PER_VERTICAL",
        label: 5,
        description: "A unit representing run over rise",
        unitSystem: "ExampleSchema.INTERNATIONAL",
        invertsUnit: "ExampleSchema.VERTICAL_PER_HORIZONTAL",
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem HORIZONTAL_PER_VERTICAL has an invalid 'label' attribute. It should be of type 'string'.`);
    });
    it("Description must be string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "InvertedUnit",
        name: "HORIZONTAL_PER_VERTICAL",
        label: "Horizontal/Vertical",
        description: 5,
        unitSystem: "ExampleSchema.INTERNATIONAL",
        invertsUnit: "ExampleSchema.VERTICAL_PER_HORIZONTAL",
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem HORIZONTAL_PER_VERTICAL has an invalid 'description' attribute. It should be of type 'string'.`);
    });
    it("invertsUnit is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "InvertedUnit",
        name: "HORIZONTAL_PER_VERTICAL",
        label: "Horizontal/Vertical",
        description: "A unit representing run over rise",
        unitSystem: "ExampleSchema.INTERNATIONAL",
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The InvertedUnit HORIZONTAL_PER_VERTICAL does not have the required 'invertsUnit' attribute.`);
    });
    it("unitSystem is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "InvertedUnit",
        name: "HORIZONTAL_PER_VERTICAL",
        label: "Horizontal/Vertical",
        description: "A unit representing run over rise",
        invertsUnit: "ExampleSchema.VERTICAL_PER_HORIZONTAL",
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The InvertedUnit HORIZONTAL_PER_VERTICAL does not have the required 'unitSystem' attribute.`);
    });
    it("$schema URL doesnt match EC3.2 URL", async () => {
      const json = {
        $schema: "https://dev.bentley.com",
        schemaItemType: "InvertedUnit",
        name: "HORIZONTAL_PER_VERTICAL",
        label: "Horizontal/Vertical",
        description: "A unit representing run over rise",
        unitSystem: "ExampleSchema.INTERNATIONAL",
        invertsUnit: "ExampleSchema.VERTICAL_PER_HORIZONTAL",
      };
      await expect(testUnit.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The InvertedUnit HORIZONTAL_PER_VERTICAL does not have the required schema URL.`);
    });
  });
});
