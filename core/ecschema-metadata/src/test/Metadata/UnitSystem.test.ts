/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { SchemaItemType, schemaItemTypeToString } from "../../ECObjects";
import { Schema } from "../../Metadata/Schema";
import { UnitSystem } from "../../Metadata/UnitSystem";

describe("UnitSystem tests", () => {
  let testUnitSystem: UnitSystem;

  describe("SchemaItemType", () => {
    const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
    testUnitSystem = new UnitSystem(schema, "Test");
    it("should return correct item type and string", () => {
      expect(testUnitSystem.schemaItemType).to.equal(SchemaItemType.UnitSystem);
      expect(schemaItemTypeToString(testUnitSystem.schemaItemType)).to.equal("UnitSystem");
    });
  });

  it("should get fullName", async () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        testUnitSystem: {
          schemaItemType: "UnitSystem",
          name: "IMPERIAL",
          label: "Imperial",
        },
      },
    };

    const schema = await Schema.fromJson(schemaJson, new SchemaContext());
    assert.isDefined(schema);
    const unitSystem = await schema.getItem<UnitSystem>("testUnitSystem");
    assert.isDefined(unitSystem);
    expect(unitSystem!.fullName).eq("TestSchema.testUnitSystem");
  });

  describe("Async fromJson", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", "es", 1, 0, 0);
      testUnitSystem = new UnitSystem(schema, "IMPERIAL");
    });
    it("Basic test", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schemaItemType: "UnitSystem",
        name: "IMPERIAL",
        label: "Imperial",
      };
      await testUnitSystem.fromJSON(json);
      expect(testUnitSystem.label).to.equal("Imperial");
      expect(testUnitSystem.description).to.be.undefined;
    });

    describe("Sync fromJson", () => {
      beforeEach(() => {
        const schema = new Schema(new SchemaContext(), "ExampleSchema", "es", 1, 0, 0);
        testUnitSystem = new UnitSystem(schema, "IMPERIAL");
      });
      it("Basic test", () => {
        const json = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
          schemaItemType: "UnitSystem",
          name: "IMPERIAL",
          label: "Imperial",
        };
        testUnitSystem.fromJSONSync(json);
        expect(testUnitSystem.label).to.equal("Imperial");
        expect(testUnitSystem.description).to.be.undefined;
      });
    });
  });
});
