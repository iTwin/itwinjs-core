/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

import Schema from "../../src/Metadata/Schema";
import Unit from "../../src/Metadata/Unit";
import Phenomenon from "../../src/Metadata/Phenomenon";
import UnitSystem from "../../src/Metadata/UnitSystem";
import { ECObjectsError } from "../../src/Exception";

describe("Unit", () => {
  before(() => {
    Schema.ec32 = true;
  });

  after(() => {
    Schema.ec32 = false;
  });

  describe("accept", () => {
    let testUnit: Unit;
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
    }, true);
  }

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
      const ecSchema = await Schema.fromJson(fullyDefinedUnit);
      const unit = await ecSchema.getItem<Unit>("TestUnit");
      assert.isDefined(unit);

      const phen = await ecSchema.getItem<Phenomenon>("TestPhenomenon");
      assert.isDefined(phen);
      assert.isTrue((await unit!.phenomenon) === phen);

      const unitSystem = await ecSchema.getItem<UnitSystem>("TestUnitSystem");
      assert.isDefined(unitSystem);
      assert.isTrue((await unit!.unitSystem) === unitSystem);

      expect(unit!.definition).to.eql("[MILLI]*Units.MM");
      expect(unit!.denominator).to.equal(1);
      expect(unit!.numerator).to.equal(5);
      expect(unit!.offset).to.equal(4);
    });

    it("sync - should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedUnit);
      const unit = ecSchema.getItemSync<Unit>("TestUnit");
      assert.isDefined(unit);

      const phen = ecSchema.getItemSync<Phenomenon>("TestPhenomenon");
      assert.isDefined(phen);
      assert.equal(phen, ecSchema.getItemSync<Phenomenon>(unit!.phenomenon!.name));

      const unitSystem = ecSchema.getItemSync<UnitSystem>("TestUnitSystem");
      assert.isDefined(unitSystem);
      assert.equal(unitSystem, ecSchema.getItemSync<UnitSystem>(unit!.unitSystem!.name));

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
    }, true);
    it("async - order shouldn't matter", async () => {
      const ecSchema = await Schema.fromJson(reverseOrderJson);
      assert.isDefined(ecSchema);
      assert.isDefined(await ecSchema.getItem<Phenomenon>("Length"));
      assert.isDefined(await ecSchema.getItem<UnitSystem>("Metric"));
      assert.isDefined(await ecSchema.getItem<Unit>("M"));
    });

    it("sync - should succeed with dependency order", () => {
      const ecSchema = Schema.fromJsonSync(reverseOrderJson);
      assert.isDefined(ecSchema);
      assert.isDefined(ecSchema.getItemSync<Phenomenon>("Length"));
      assert.isDefined(ecSchema.getItemSync<UnitSystem>("Metric"));
      assert.isDefined(ecSchema.getItemSync<Unit>("M"));
    });

    // Missing phenomenon
    const missingPhenomenonJson = {
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.M",
    };
    it("async - should throw for missing phenomenon", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingPhenomenonJson))).to.be.rejectedWith(ECObjectsError, `The Unit TestUnit does not have the required 'phenomenon' attribute.`);
    });
    it("sync - should throw for missing phenomenon", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingPhenomenonJson)), ECObjectsError, `The Unit TestUnit does not have the required 'phenomenon' attribute.`);
    });

    // Invalid phenomenon
    const invalidPhenomenonJson = {
      phenomenon: 5,
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.M",
    };
    it("async - should throw for invalid phenomenon", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidPhenomenonJson))).to.be.rejectedWith(ECObjectsError, `The Unit TestUnit has an invalid 'phenomenon' attribute. It should be of type 'string'`);
    });
    it("sync - should throw for invalid phenomenon", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidPhenomenonJson)), ECObjectsError, `The Unit TestUnit has an invalid 'phenomenon' attribute. It should be of type 'string'`);
    });

    // Missing UnitSystem
    const missingUnitSystemJson = {
      phenomenon: "TestSchema.TestPhenomenon",
      definition: "[MILLI]*Units.M",
    };
    it("async - should throw for missing unit system", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingUnitSystemJson))).to.be.rejectedWith(ECObjectsError, `The Unit TestUnit does not have the required 'unitSystem' attribute.`);
    });
    it("sync - should throw for missing unit system", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingUnitSystemJson)), ECObjectsError, `The Unit TestUnit does not have the required 'unitSystem' attribute.`);
    });

    // Invalid UnitSystem
    const invalidUnitSystemJson = {
      unitSystem: 5,
      phenomenon: "TestSchema.TestPhenomenon",
      definition: "[MILLI]*Units.M",
    };
    it("async - should throw for invalid unit system", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidUnitSystemJson))).to.be.rejectedWith(ECObjectsError, `The Unit TestUnit has an invalid 'unitSystem' attribute. It should be of type 'string'`);
    });
    it("sync - should throw for invalid unit system", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidUnitSystemJson)), ECObjectsError, `The Unit TestUnit has an invalid 'unitSystem' attribute. It should be of type 'string'`);
    });

    // Missing Definition
    const missingDefinitionJson = {
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
    };
    it("async - should throw for missing definition", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingDefinitionJson))).to.be.rejectedWith(ECObjectsError, `The Unit TestUnit does not have the required 'definition' attribute.`);
    });
    it("sync - should throw for missing definition", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingDefinitionJson)), ECObjectsError, `The Unit TestUnit does not have the required 'definition' attribute.`);
    });

    // Missing Definition
    const invalidDefinitionJson = {
      definition: 5,
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
    };
    it("async - should throw for invalid definition", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidDefinitionJson))).to.be.rejectedWith(ECObjectsError, `The Unit TestUnit has an invalid 'definition' attribute. It should be of type 'string'`);
    });
    it("sync - should throw for invalid definition", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidDefinitionJson)), ECObjectsError, `The Unit TestUnit has an invalid 'definition' attribute. It should be of type 'string'`);
    });

    // Invalid numerator
    const invalidNumeratorJson = {
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.MM",
      numerator: "5",
    };
    it("async - should throw for invalid numerator", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidNumeratorJson))).to.be.rejectedWith(ECObjectsError, `The Unit TestUnit has an invalid 'numerator' attribute. It should be of type 'number'.`);
    });
    it("sync - should throw for invalid numerator", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidNumeratorJson)), ECObjectsError, `The Unit TestUnit has an invalid 'numerator' attribute. It should be of type 'number'.`);
    });

    // Invalid denominator
    const invalidDenominatorJson = {
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.MM",
      denominator: "5",
    };
    it("async - should throw for invalid denominator", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidDenominatorJson))).to.be.rejectedWith(ECObjectsError, `The Unit TestUnit has an invalid 'denominator' attribute. It should be of type 'number'.`);
    });
    it("sync - should throw for invalid denominator", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidDenominatorJson)), ECObjectsError, `The Unit TestUnit has an invalid 'denominator' attribute. It should be of type 'number'.`);
    });

    // Invalid offset
    const invalidOffsetJson = {
      phenomenon: "TestSchema.TestPhenomenon",
      unitSystem: "TestSchema.TestUnitSystem",
      definition: "[MILLI]*Units.MM",
      offset: "5",
    };
    it("async - should throw for invalid offset", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidOffsetJson))).to.be.rejectedWith(ECObjectsError, `The Unit TestUnit has an invalid 'offset' attribute. It should be of type 'number'.`);
    });
    it("sync - should throw for invalid offset", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidOffsetJson)), ECObjectsError, `The Unit TestUnit has an invalid 'offset' attribute. It should be of type 'number'.`);
    });
  });
  describe("toJson", () => {
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
      const ecSchema = await Schema.fromJson(fullyDefinedUnit);
      const unit = await ecSchema.getItem<Unit>("TestUnit");
      assert.isDefined(unit);
      const unitSerialization = unit!.toJson(true, true);

      expect(unitSerialization.phenomenon).to.eql("TestSchema.TestPhenomenon");
      expect(unitSerialization.unitSystem).to.eql("TestSchema.TestUnitSystem");
      expect(unitSerialization.definition).to.eql("[MILLI]*Units.MM");
      expect(unitSerialization.denominator).to.equal(1);
      expect(unitSerialization.numerator).to.equal(5);
      expect(unitSerialization.offset).to.equal(4);
    });

    it("sync - should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedUnit);
      const unit = ecSchema.getItemSync<Unit>("TestUnit");
      assert.isDefined(unit);
      const unitSerialization = unit!.toJson(true, true);

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
    }, true);
    it("async - order shouldn't matter", async () => {
      const ecSchema = await Schema.fromJson(reverseOrderJson);
      assert.isDefined(ecSchema);
      const unit = await ecSchema.getItem<Unit>("M");
      assert.isDefined(unit);
      const unitSerialization = unit!.toJson(true, true);

      expect(unitSerialization.phenomenon).to.eql("TestSchema.Length");
      expect(unitSerialization.unitSystem).to.eql("TestSchema.Metric");
      expect(unitSerialization.definition).to.eql("[MILLI]*M");
    });

    it("sync - should succeed with dependency order", () => {
      const ecSchema = Schema.fromJsonSync(reverseOrderJson);
      assert.isDefined(ecSchema);
      const unit = ecSchema.getItemSync<Unit>("M");
      assert.isDefined(unit);
      const unitSerialization = unit!.toJson(true, true);

      expect(unitSerialization.phenomenon).to.eql("TestSchema.Length");
      expect(unitSerialization.unitSystem).to.eql("TestSchema.Metric");
      expect(unitSerialization.definition).to.eql("[MILLI]*M");
    });
  });
});
