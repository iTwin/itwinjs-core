/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { SchemaContext } from "../../src/Context";
import { SchemaItemType, schemaItemTypeToString } from "../../src/ECObjects";
import { Schema } from "../../src/Metadata/Schema";
import { UnitSystem } from "../../src/Metadata/UnitSystem";

describe("UnitSystem tests", () => {
  let testUnitSystem: UnitSystem;

  describe("SchemaItemType", () => {
    const schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
    testUnitSystem = new UnitSystem(schema, "Test");
    it("should return correct item type and string", () => {
      expect(testUnitSystem.schemaItemType).to.equal(SchemaItemType.UnitSystem);
      expect(schemaItemTypeToString(testUnitSystem.schemaItemType)).to.equal("UnitSystem");
    });
  });

  describe("Async fromJson", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", 1, 0, 0);
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
      expect(testUnitSystem.label).to.equal("Imperial");
      expect(testUnitSystem.description).to.be.undefined;
    });

    describe("Sync fromJson", () => {
      beforeEach(() => {
        const schema = new Schema(new SchemaContext(), "ExampleSchema", 1, 0, 0);
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
        expect(testUnitSystem.label).to.equal("Imperial");
        expect(testUnitSystem.description).to.be.undefined;
      });
    });
  });
});
