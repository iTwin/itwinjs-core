/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { SchemaItemType } from "../../ECObjects";
import { Schema } from "../../Metadata/Schema";
import { UnitSystem } from "../../Metadata/UnitSystem";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

/* eslint-disable @typescript-eslint/naming-convention */

describe("UnitSystem tests", () => {
  let testUnitSystem: UnitSystem;

  describe("SchemaItemType", () => {
    const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
    testUnitSystem = new UnitSystem(schema, "Test");
    it("should return correct item type and string", () => {
      expect(testUnitSystem.schemaItemType).to.equal(SchemaItemType.UnitSystem);
      expect(testUnitSystem.schemaItemType).to.equal("UnitSystem");
    });
  });

  it("should get fullName", async () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      alias: "ts",
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
    const unitSystem = await schema.getItem("testUnitSystem", UnitSystem);
    assert.isDefined(unitSystem);
    expect(unitSystem!.fullName).eq("TestSchema.testUnitSystem");
  });

  describe("type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
      TestUnitSystem: {
        schemaItemType: "UnitSystem",
        label: "Test Unit System",
        description: "Used for testing",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
    });

    let ecSchema: Schema;

    before(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      assert.isDefined(ecSchema);
    });

    it("typeguard and type assertion should work on UnitSystem", async () => {
      const item = await ecSchema.getItem("TestUnitSystem");
      assert.isDefined(item);
      expect(UnitSystem.isUnitSystem(item)).to.be.true;
      expect(() => UnitSystem.assertIsUnitSystem(item)).not.to.throw();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      assert.isDefined(testPhenomenon);
      expect(UnitSystem.isUnitSystem(testPhenomenon)).to.be.false;
      expect(() => UnitSystem.assertIsUnitSystem(testPhenomenon)).to.throw();
    });

    it("UnitSystem type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestUnitSystem", UnitSystem)).to.be.instanceof(UnitSystem);
      expect(ecSchema.getItemSync("TestUnitSystem", UnitSystem)).to.be.instanceof(UnitSystem);
    });

    it("UnitSystem type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", UnitSystem)).to.be.undefined;
      expect(ecSchema.getItemSync("TestPhenomenon", UnitSystem)).to.be.undefined;
    });
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
