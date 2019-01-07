/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Schema } from "../../src/Metadata/Schema";
import { Phenomenon } from "../../src/Metadata/Phenomenon";
import * as sinon from "sinon";

describe("Phenomenon tests", () => {
  let testPhenomenon: Phenomenon;
  describe("accept", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "TestEnumeration");
    });

    it("should call visitPhenomenon on a SchemaItemVisitor object", async () => {
      expect(testPhenomenon).to.exist;
      const mockVisitor = { visitPhenomenon: sinon.spy() };
      await testPhenomenon.accept(mockVisitor);
      expect(mockVisitor.visitPhenomenon.calledOnce).to.be.true;
      expect(mockVisitor.visitPhenomenon.calledWithExactly(testPhenomenon)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitPhenomenon defined", async () => {
      expect(testPhenomenon).to.exist;
      await testPhenomenon.accept({});
    });
  });
  describe("Async fromJson", () => {
    beforeEach(() => {
      const schema = new Schema("ExampleSchema", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "AREA");
    });
    it("Basic test", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        label: "Area",
        definition: "Units.LENGTH(2)",
      };
      await testPhenomenon.deserialize(json);
      assert(testPhenomenon.label, "Area");
      assert(testPhenomenon.definition, "Units.LENGTH(2)");
    });
  });
  describe("Sync fromJson", () => {
    beforeEach(() => {
      const schema = new Schema("ExampleSchema", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "AREA");
    });
    it("Basic test", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        label: "Area",
        definition: "Units.LENGTH(2)",
      };
      testPhenomenon.deserializeSync(json)
      assert(testPhenomenon.label, "Area");
      assert(testPhenomenon.definition, "Units.LENGTH(2)");
    });
  });
  describe("toJson", () => {
    beforeEach(() => {
      const schema = new Schema("ExampleSchema", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "AREA");
    });
    it("async - Basic test", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        definition: "Units.LENGTH(2)",
      };
      await testPhenomenon.deserialize(json);
      const phenomSerialization = testPhenomenon.toJson(true, true);
      assert(phenomSerialization.definition, "Units.LENGTH(2)");
    });
    it("sync - Basic test", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        definition: "Units.LENGTH(2)",
      };
      testPhenomenon.deserializeSync(json);
      const phenomSerialization = testPhenomenon.toJson(true, true);
      assert(phenomSerialization.definition, "Units.LENGTH(2)");
    });
  });
});
