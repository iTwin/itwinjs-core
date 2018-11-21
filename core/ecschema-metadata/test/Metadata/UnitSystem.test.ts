/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";
import { Schema } from "../../src/Metadata/Schema";
import { UnitSystem } from "../../src/Metadata/UnitSystem";
import { schemaItemTypeToString, SchemaItemType } from "../../src/ECObjects";

describe("UnitSystem tests", () => {
  let testUnitSystem: UnitSystem;
  describe("accept", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testUnitSystem = new UnitSystem(schema, "TestEnumeration");
    });

    it("should call visitUnitSystem on a SchemaItemVisitor object", async () => {
      expect(testUnitSystem).to.exist;
      const mockVisitor = { visitUnitSystem: sinon.spy() };
      await testUnitSystem.accept(mockVisitor);
      expect(mockVisitor.visitUnitSystem.calledOnce).to.be.true;
      expect(mockVisitor.visitUnitSystem.calledWithExactly(testUnitSystem)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitUnitSystem defined", async () => {
      expect(testUnitSystem).to.exist;
      await testUnitSystem.accept({});
    });
  });

  describe("SchemaItemType", () => {
    const schema = new Schema("TestSchema", 1, 0, 0);
    testUnitSystem = new UnitSystem(schema, "Test");
    it("should return correct item type and string", () => {
      assert.equal(testUnitSystem.schemaItemType, SchemaItemType.UnitSystem);
      assert.equal(schemaItemTypeToString(testUnitSystem.schemaItemType), "UnitSystem");
    });
  });

  describe("Async fromJson", () => {
    beforeEach(() => {
      const schema = new Schema("ExampleSchema", 1, 0, 0);
      testUnitSystem = new UnitSystem(schema, "IMPERIAL");
    });
    it("Basic test", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "UnitSystem",
        name: "IMPERIAL",
        label: "Imperial",
      };
      await testUnitSystem.deserialize(json);
      assert(testUnitSystem.label, "Imperial");
      assert(testUnitSystem.description === undefined);
    });

    describe("Sync fromJson", () => {
      beforeEach(() => {
        const schema = new Schema("ExampleSchema", 1, 0, 0);
        testUnitSystem = new UnitSystem(schema, "IMPERIAL");
      });
      it("Basic test", () => {
        const json = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
          schemaItemType: "UnitSystem",
          name: "IMPERIAL",
          label: "Imperial",
        };
        testUnitSystem.deserializeSync(json);
        assert(testUnitSystem.label, "Imperial");
        assert(testUnitSystem.description === undefined);
      });
    });
  });
});
