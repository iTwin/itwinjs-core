/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";
import Schema from "../../src/Metadata/Schema";
import UnitSystem from "../../src/Metadata/UnitSystem";
import { ECObjectsError } from "../../src/Exception";
import { schemaItemTypeToString, SchemaItemType } from "../../src/ECObjects";
import { JsonParser } from "../../src/Deserialization/JsonParser";

describe("UnitSystem tests", () => {
  let testUnitSystem: UnitSystem;
  const parser = new JsonParser();
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
      await testUnitSystem.deserialize(parser.parseSchemaItemProps(json, testUnitSystem.schema.name, json.name));
      assert(testUnitSystem.label, "Imperial");
      assert(testUnitSystem.description === undefined);
    });
    it("Name must be a valid ECName", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "UnitSystem",
        name: "12IMPERIAL",
        label: "Imperial",
        description: "Units of measure from the british imperial empire",
      };
      assert.throws(() => parser.parseSchemaItemProps(json, testUnitSystem.schema.name, json.name), ECObjectsError, `A SchemaItem in ExampleSchema has an invalid 'name' attribute. '12IMPERIAL' is not a valid ECName.`);
    });
    it("Label must be a string", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "UnitSystem",
        name: "IMPERIAL",
        label: 1,
        description: "Units of measure from the british imperial empire",
      };
      assert.throws(() => parser.parseSchemaItemProps(json, testUnitSystem.schema.name, json.name), ECObjectsError, `The SchemaItem ExampleSchema.IMPERIAL has an invalid 'label' attribute. It should be of type 'string'.`);
    });
    it("Description must be a string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "UnitSystem",
        name: "IMPERIAL",
        label: "Imperial",
        description: 1,
      };
      assert.throws(() => parser.parseSchemaItemProps(json, testUnitSystem.schema.name, json.name), ECObjectsError, `The SchemaItem ExampleSchema.IMPERIAL has an invalid 'description' attribute. It should be of type 'string'.`);
    });
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
      testUnitSystem.deserializeSync(parser.parseSchemaItemProps(json, testUnitSystem.schema.name, json.name));
      assert(testUnitSystem.label, "Imperial");
      assert(testUnitSystem.description === undefined);
    });
    it("Name must be a valid ECName", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "UnitSystem",
        name: "12IMPERIAL",
        label: "Imperial",
        description: "Units of measure from the british imperial empire",
      };
      assert.throws(() => testUnitSystem.deserializeSync(parser.parseSchemaItemProps(json, testUnitSystem.schema.name, json.name)), ECObjectsError, ``);
    });
    it("Label must be a string", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "UnitSystem",
        name: "IMPERIAL",
        label: 1,
        description: "Units of measure from the british imperial empire",
      };
      assert.throws(() => parser.parseSchemaItemProps(json, testUnitSystem.schema.name, json.name), ECObjectsError, `The SchemaItem ExampleSchema.IMPERIAL has an invalid 'label' attribute. It should be of type 'string'.`);

    });
    it("Description must be a string", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "UnitSystem",
        name: "IMPERIAL",
        label: "Imperial",
        description: 1,
      };
      assert.throws(() => parser.parseSchemaItemProps(json, testUnitSystem.schema.name, json.name), ECObjectsError, `The SchemaItem ExampleSchema.IMPERIAL has an invalid 'description' attribute. It should be of type 'string'.`);
    });
  });
});
