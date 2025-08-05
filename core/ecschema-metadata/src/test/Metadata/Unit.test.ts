/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { ECSchemaError } from "../../Exception";
import { Phenomenon } from "../../Metadata/Phenomenon";
import { Schema } from "../../Metadata/Schema";
import { Unit } from "../../Metadata/Unit";
import { UnitSystem } from "../../Metadata/UnitSystem";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Unit", () => {

  function createSchemaJson(unitJson: any): any {
    return createSchemaJsonWithItems({
      TestUnit: {
        schemaItemType: "Unit",
        ...unitJson,
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
      TestUnitSystem: {
        schemaItemType: "UnitSystem",
      },
    });
  }

  it("should get fullName", async () => {
    const fullyDefinedUnit = createSchemaJson({
      label: "Millimeter",
      description: "A unit defining the millimeter metric unit of length",
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.MM",
      numerator: 5,
      denominator: 1,
      offset: 4,
    });

    const ecSchema = await Schema.fromJson(fullyDefinedUnit, new SchemaContext());
    assert.isDefined(ecSchema);
    const unit = await ecSchema.getItem("TestUnit", Unit);
    assert.isDefined(unit);
    expect(unit!.fullName).eq("TestSchema.TestUnit");
  });

  describe("type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
      TestUnit: {
        schemaItemType: "Unit",
        label: "Test Unit",
        description: "Used for testing",
        phenomenon: "TestSchema.TestPhenomenon",
        unitSystem: "TestSchema.TestUnitSystem",
        definition: "M",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
      TestUnitSystem: {
        schemaItemType: "UnitSystem",
        label: "Metric",
        description: "Metric system",
      },
    });

    let ecSchema: Schema;

    before(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      assert.isDefined(ecSchema);
    });

    it("typeguard and type assertion should work on Unit", async () => {
      const testUnit = await ecSchema.getItem("TestUnit");
      assert.isDefined(testUnit);
      expect(Unit.isUnit(testUnit)).to.be.true;
      expect(() => Unit.assertIsUnit(testUnit)).not.to.throw();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      assert.isDefined(testPhenomenon);
      expect(Unit.isUnit(testPhenomenon)).to.be.false;
      expect(() => Unit.assertIsUnit(testPhenomenon)).to.throw();
    });

    it("Unit type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestUnit", Unit)).to.be.instanceof(Unit);
      expect(ecSchema.getItemSync("TestUnit", Unit)).to.be.instanceof(Unit);
    });

    it("Unit type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", Unit)).to.be.undefined;
      expect(ecSchema.getItemSync("TestPhenomenon", Unit)).to.be.undefined;
    });
  });

  describe("deserialization", () => {
    const fullyDefinedUnit = createSchemaJson({
      label: "Millimeter",
      description: "A unit defining the millimeter metric unit of length",
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.MM",
      numerator: 5,
      denominator: 1,
      offset: 4,
    });

    it("async - should succeed with fully defined", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedUnit, new SchemaContext());
      const unit = await ecSchema.getItem("TestUnit", Unit);
      assert.isDefined(unit);

      const phen = await ecSchema.getItem("TestPhenomenon", Phenomenon);
      assert.isDefined(phen);
      assert.isTrue((await unit!.phenomenon) === phen);

      const unitSystem = await ecSchema.getItem("TestUnitSystem", UnitSystem);
      assert.isDefined(unitSystem);
      assert.isTrue((await unit!.unitSystem) === unitSystem);

      expect(unit!.definition).to.eql("[MILLI]*Units.MM");
      expect(unit!.denominator).to.equal(1);
      expect(unit!.numerator).to.equal(5);
      expect(unit!.offset).to.equal(4);
    });

    it("sync - should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedUnit, new SchemaContext());
      const unit = ecSchema.getItemSync("TestUnit", Unit);
      assert.isDefined(unit);

      const phen = ecSchema.getItemSync("TestPhenomenon", Phenomenon);
      assert.isDefined(phen);
      assert.strictEqual(phen, ecSchema.getItemSync(unit!.phenomenon!.name, Phenomenon));

      const unitSystem = ecSchema.getItemSync("TestUnitSystem", UnitSystem);
      assert.isDefined(unitSystem);
      assert.strictEqual(unitSystem, ecSchema.getItemSync(unit!.unitSystem!.name, UnitSystem));

      expect(unit!.definition).to.eql("[MILLI]*Units.MM");
      expect(unit!.denominator).to.equal(1);
      expect(unit!.numerator).to.equal(5);
      expect(unit!.offset).to.equal(4);
    });

    // Check order of schema items shouldn't matter
    const reverseOrderJson = createSchemaJsonWithItems({
      M: {
        schemaItemType: "Unit",
        phenomenon: "TestSchema.Length",
        unitSystem: "TestSchema.Metric",
        definition: "[MILLI]*M",
      },
      Length: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
        label: "length",
      },
      Metric: {
        schemaItemType: "UnitSystem",
        label: "metric",
      },
    });
    it("async - order shouldn't matter", async () => {
      const ecSchema = await Schema.fromJson(reverseOrderJson, new SchemaContext());
      assert.isDefined(ecSchema);
      assert.isDefined(await ecSchema.getItem("Length", Phenomenon));
      assert.isDefined(await ecSchema.getItem("Metric", UnitSystem));
      assert.isDefined(await ecSchema.getItem("M", Unit));
    });

    it("sync - should succeed with dependency order", () => {
      const ecSchema = Schema.fromJsonSync(reverseOrderJson, new SchemaContext());
      assert.isDefined(ecSchema);
      assert.isDefined(ecSchema.getItemSync("Length", Phenomenon));
      assert.isDefined(ecSchema.getItemSync("Metric", UnitSystem));
      assert.isDefined(ecSchema.getItemSync("M", Unit));
    });

    // Missing phenomenon
    const missingPhenomenonJson = {
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.M",
    };
    it("async - should throw for missing phenomenon", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingPhenomenonJson), new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Unit TestSchema.TestUnit does not have the required 'phenomenon' attribute.`);
    });
    it("sync - should throw for missing phenomenon", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingPhenomenonJson), new SchemaContext()), ECSchemaError, `The Unit TestSchema.TestUnit does not have the required 'phenomenon' attribute.`);
    });

    // Invalid phenomenon
    const invalidPhenomenonJson = {
      phenomenon: 5,
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.M",
    };
    it("async - should throw for invalid phenomenon", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidPhenomenonJson), new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'phenomenon' attribute. It should be of type 'string'`);
    });
    it("sync - should throw for invalid phenomenon", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidPhenomenonJson), new SchemaContext()), ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'phenomenon' attribute. It should be of type 'string'`);
    });

    // Missing UnitSystem
    const missingUnitSystemJson = {
      phenomenon: "TestSchema.TestPhenomenon",
      definition: "[MILLI]*Units.M",
    };
    it("async - should throw for missing unit system", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingUnitSystemJson), new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Unit TestSchema.TestUnit does not have the required 'unitSystem' attribute.`);
    });
    it("sync - should throw for missing unit system", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingUnitSystemJson), new SchemaContext()), ECSchemaError, `The Unit TestSchema.TestUnit does not have the required 'unitSystem' attribute.`);
    });

    // Invalid UnitSystem
    const invalidUnitSystemJson = {
      unitSystem: 5,
      phenomenon: "TestSchema.TestPhenomenon",
      definition: "[MILLI]*Units.M",
    };
    it("async - should throw for invalid unit system", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidUnitSystemJson), new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'unitSystem' attribute. It should be of type 'string'`);
    });
    it("sync - should throw for invalid unit system", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidUnitSystemJson), new SchemaContext()), ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'unitSystem' attribute. It should be of type 'string'`);
    });

    // Missing Definition
    const missingDefinitionJson = {
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
    };
    it("async - should throw for missing definition", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingDefinitionJson), new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Unit TestSchema.TestUnit does not have the required 'definition' attribute.`);
    });
    it("sync - should throw for missing definition", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingDefinitionJson), new SchemaContext()), ECSchemaError, `The Unit TestSchema.TestUnit does not have the required 'definition' attribute.`);
    });

    // Missing Definition
    const invalidDefinitionJson = {
      definition: 5,
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
    };
    it("async - should throw for invalid definition", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidDefinitionJson), new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'definition' attribute. It should be of type 'string'`);
    });
    it("sync - should throw for invalid definition", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidDefinitionJson), new SchemaContext()), ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'definition' attribute. It should be of type 'string'`);
    });

    // Invalid numerator
    const invalidNumeratorJson = {
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.MM",
      numerator: "5",
    };
    it("async - should throw for invalid numerator", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidNumeratorJson), new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'numerator' attribute. It should be of type 'number'.`);
    });
    it("sync - should throw for invalid numerator", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidNumeratorJson), new SchemaContext()), ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'numerator' attribute. It should be of type 'number'.`);
    });

    // Invalid denominator
    const invalidDenominatorJson = {
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.MM",
      denominator: "5",
    };
    it("async - should throw for invalid denominator", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidDenominatorJson), new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'denominator' attribute. It should be of type 'number'.`);
    });
    it("sync - should throw for invalid denominator", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidDenominatorJson), new SchemaContext()), ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'denominator' attribute. It should be of type 'number'.`);
    });

    // Invalid offset
    const invalidOffsetJson = {
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.MM",
      offset: "5",
    };
    it("async - should throw for invalid offset", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidOffsetJson), new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'offset' attribute. It should be of type 'number'.`);
    });
    it("sync - should throw for invalid offset", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidOffsetJson), new SchemaContext()), ECSchemaError, `The Unit TestSchema.TestUnit has an invalid 'offset' attribute. It should be of type 'number'.`);
    });
  });

  describe("toJSON", () => {
    const fullyDefinedUnit = createSchemaJson({
      label: "Millimeter",
      description: "A unit defining the millimeter metric unit of length",
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.MM",
      numerator: 5,
      denominator: 1,
      offset: 4,
    });

    it("async - should succeed with fully defined", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedUnit, new SchemaContext());
      const unit = await ecSchema.getItem("TestUnit", Unit);
      assert.isDefined(unit);
      const unitSerialization = unit!.toJSON(true, true);

      expect(unitSerialization.phenomenon).to.eql("TestSchema.TestPhenomenon");
      expect(unitSerialization.unitSystem).to.eql("TestSchema.TestUnitSystem");
      expect(unitSerialization.definition).to.eql("[MILLI]*Units.MM");
      expect(unitSerialization.denominator).to.equal(1);
      expect(unitSerialization.numerator).to.equal(5);
      expect(unitSerialization.offset).to.equal(4);
    });

    it("sync - should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedUnit, new SchemaContext());
      const unit = ecSchema.getItemSync("TestUnit", Unit);
      assert.isDefined(unit);
      const unitSerialization = unit!.toJSON(true, true);

      expect(unitSerialization.phenomenon).to.eql("TestSchema.TestPhenomenon");
      expect(unitSerialization.unitSystem).to.eql("TestSchema.TestUnitSystem");
      expect(unitSerialization.definition).to.eql("[MILLI]*Units.MM");
      expect(unitSerialization.denominator).to.equal(1);
      expect(unitSerialization.numerator).to.equal(5);
      expect(unitSerialization.offset).to.equal(4);
    });

    it("async - JSON stringify serialization, should succeed with fully defined", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedUnit, new SchemaContext());
      const unit = await ecSchema.getItem("TestUnit", Unit);
      assert.isDefined(unit);
      const json = JSON.stringify(unit);
      const unitSerialization = JSON.parse(json);

      expect(unitSerialization.phenomenon).to.eql("TestSchema.TestPhenomenon");
      expect(unitSerialization.unitSystem).to.eql("TestSchema.TestUnitSystem");
      expect(unitSerialization.definition).to.eql("[MILLI]*Units.MM");
      expect(unitSerialization.denominator).to.equal(1);
      expect(unitSerialization.numerator).to.equal(5);
      expect(unitSerialization.offset).to.equal(4);
    });

    it("sync - JSON stringify serialization, should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedUnit, new SchemaContext());
      const unit = ecSchema.getItemSync("TestUnit", Unit);
      assert.isDefined(unit);
      const json = JSON.stringify(unit);
      const unitSerialization = JSON.parse(json);

      expect(unitSerialization.phenomenon).to.eql("TestSchema.TestPhenomenon");
      expect(unitSerialization.unitSystem).to.eql("TestSchema.TestUnitSystem");
      expect(unitSerialization.definition).to.eql("[MILLI]*Units.MM");
      expect(unitSerialization.denominator).to.equal(1);
      expect(unitSerialization.numerator).to.equal(5);
      expect(unitSerialization.offset).to.equal(4);
    });

    // Check order of schema items shouldn't matter
    const reverseOrderJson = createSchemaJsonWithItems({
      M: {
        schemaItemType: "Unit",
        phenomenon: "TestSchema.Length",
        unitSystem: "TestSchema.Metric",
        definition: "[MILLI]*M",
      },
      Length: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
        label: "length",
      },
      Metric: {
        schemaItemType: "UnitSystem",
        label: "metric",
      },
    });
    it("async - order shouldn't matter", async () => {
      const ecSchema = await Schema.fromJson(reverseOrderJson, new SchemaContext());
      assert.isDefined(ecSchema);
      const unit = await ecSchema.getItem("M", Unit);
      assert.isDefined(unit);
      const unitSerialization = unit!.toJSON(true, true);

      expect(unitSerialization.phenomenon).to.eql("TestSchema.Length");
      expect(unitSerialization.unitSystem).to.eql("TestSchema.Metric");
      expect(unitSerialization.definition).to.eql("[MILLI]*M");
    });

    it("sync - should succeed with dependency order", () => {
      const ecSchema = Schema.fromJsonSync(reverseOrderJson, new SchemaContext());
      assert.isDefined(ecSchema);
      const unit = ecSchema.getItemSync("M", Unit);
      assert.isDefined(unit);
      const unitSerialization = unit!.toJSON(true, true);

      expect(unitSerialization.phenomenon).to.eql("TestSchema.Length");
      expect(unitSerialization.unitSystem).to.eql("TestSchema.Metric");
      expect(unitSerialization.definition).to.eql("[MILLI]*M");
    });

    it("Numerator is explicitly set, default values of numerator, denominator and offset should not be serialized", async () => {
      const schemaJson = createSchemaJson({
        label: "Millimeter",
        description: "Test unit",
        phenomenon: "TestSchema.TestPhenomenon",
        unitSystem: "TestSchema.TestUnitSystem",
        definition: "[MILLI]*Units.MM",
        numerator: 10,
      });

      const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
      const unit = await ecSchema.getItem("TestUnit", Unit);
      assert.isDefined(unit);
      const unitSerialization = unit!.toJSON(true, true);

      expect(unitSerialization.numerator).to.equal(10);
      expect(unitSerialization.denominator).to.be.undefined;
      expect(unitSerialization.offset).to.be.undefined;
    });

    it("Denominator and offset are explicitly set, default values of numerator, denominator and offset should not be serialized", async () => {
      const schemaJson = createSchemaJson({
        label: "Millimeter",
        description: "Test unit",
        phenomenon: "TestSchema.TestPhenomenon",
        unitSystem: "TestSchema.TestUnitSystem",
        definition: "[MILLI]*Units.MM",
        denominator: 12,
        offset: 10,
      });

      const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
      const unit = await ecSchema.getItem("TestUnit", Unit);
      assert.isDefined(unit);
      const unitSerialization = unit!.toJSON(true, true);

      expect(unitSerialization.offset).to.equal(10);
      expect(unitSerialization.denominator).to.equal(12);
      expect(unitSerialization.numerator).to.be.undefined;
    });
  });

  describe("toXml", () => {
    const newDom = createEmptyXmlDocument();
    const schemaJson = createSchemaJson({
      label: "Millimeter",
      description: "A unit defining the millimeter metric unit of length",
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.MM",
      numerator: 5.1,
      denominator: 2.4,
      offset: 4,
    });

    it("should properly serialize with all defined", async () => {
      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
      const unit = await ecschema.getItem("TestUnit", Unit);
      assert.isDefined(unit);
      const serialized = await unit!.toXml(newDom);
      expect(serialized.nodeName).to.eql("Unit");
      expect(serialized.getAttribute("typeName")).to.eql("TestUnit");
      expect(serialized.getAttribute("phenomenon")).to.eql("TestPhenomenon");
      expect(serialized.getAttribute("unitSystem")).to.eql("TestUnitSystem");
      expect(serialized.getAttribute("definition")).to.eql("[MILLI]*Units.MM");
      expect(serialized.getAttribute("numerator")).to.eql("5.1");
      expect(serialized.getAttribute("denominator")).to.eql("2.4");
      expect(serialized.getAttribute("offset")).to.eql("4");
    });

    it("Numerator is explicitly set, default values of numerator, denominator and offset should not be serialized", async () => {
      const testSchemaJson = createSchemaJson({
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "TestSchema.TestPhenomenon",
        unitSystem: "TestSchema.TestUnitSystem",
        definition: "[MILLI]*Units.MM",
        numerator: 5.1,
      });

      const ecschema = await Schema.fromJson(testSchemaJson, new SchemaContext());
      const unit = await ecschema.getItem("TestUnit", Unit);
      assert.isDefined(unit);
      const serialized = await unit!.toXml(newDom);

      expect(serialized.getAttribute("numerator")).to.eql("5.1");
      expect(serialized.getAttribute("denominator")).to.eql("");
      expect(serialized.getAttribute("offset")).to.eql("");
    });

    it("Denominator and offset are explicitly set, default values of numerator, denominator and offset should not be serialized", async () => {
      const testSchemaJson = createSchemaJson({
        label: "Millimeter",
        description: "A unit defining the millimeter metric unit of length",
        phenomenon: "TestSchema.TestPhenomenon",
        unitSystem: "TestSchema.TestUnitSystem",
        definition: "[MILLI]*Units.MM",
        denominator: 2.4,
        offset: 4,
      });

      const ecschema = await Schema.fromJson(testSchemaJson, new SchemaContext());
      const unit = await ecschema.getItem("TestUnit", Unit);
      assert.isDefined(unit);
      const serialized = await unit!.toXml(newDom);

      expect(serialized.getAttribute("numerator")).to.eql("");
      expect(serialized.getAttribute("denominator")).to.eql("2.4");
      expect(serialized.getAttribute("offset")).to.eql("4");
    });
  });
});
