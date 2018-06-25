/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import Unit from "../../source/Metadata/Unit";
import { ECObjectsError } from "../../source/Exception";
import * as sinon from "sinon";
import Phenomenon from "../../source/Metadata/Phenomenon";
import UnitSystem from "../../source/Metadata/UnitSystem";

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
  describe("Async fromJson", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testUnit = new Unit(schema, "MM");
    });
    it("Basic test for definition", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            label: "Millimeter",
            description: "A unit defining the millimeter metric unit of length",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*Units.MM",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.MM",
          },
        },
      };
      const ecSchema = await Schema.fromJson(testSchema);
      const schemaUnit = await ecSchema.getItem("MM");
      assert.isDefined(schemaUnit);
      const unitTest: Unit = schemaUnit as Unit;
      assert(unitTest.definition, "[MILLI]*Units.MM");
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
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            label: "Millimeter",
            description: "A unit defining the millimeter metric unit of length",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*Units.MM",
            numerator: "5",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.MM",
          },
        },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Unit MM has an invalid 'numerator' attribute. It should be of type 'number'.`);
    });
    it("Numerator, denominator, offset default values are 1.0, 1.0, 0.0, respectively", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            label: "Millimeter",
            description: "A unit defining the millimeter metric unit of length",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*Units.MM",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.MM",
          },
        },
      };
      const ecSchema = await Schema.fromJson(testSchema);
      const schemaUnit = await ecSchema.getItem("MM");
      assert.isDefined(schemaUnit);
      const unitTest: Unit = schemaUnit as Unit;
      assert(unitTest.numerator === 1.0);
      assert(unitTest.denominator === 1.0);
      assert(unitTest.offset === 0.0);
    });
    it("Numerator, denominator, offset are different than default", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            label: "Millimeter",
            description: "A unit defining the millimeter metric unit of length",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*Units.MM",
            numerator: 3.0,
            denominator: 6.0,
            offset: 4.0,
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.MM",
          },
        },
      };
      const ecSchema = await Schema.fromJson(testSchema);
      const schemaUnit = await ecSchema.getItem("MM");
      assert.isDefined(schemaUnit);
      const unitTest: Unit = schemaUnit as Unit;
      assert(unitTest.numerator === 3.0);
      assert(unitTest.denominator === 6.0);
      assert(unitTest.offset === 4.0);
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
    it("Definition is required", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            label: "Millimeter",
            description: "A unit defining the millimeter metric unit of length",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.MM",
          },
        },
      };
      await expect(Schema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError, `The Unit MM does not have the required 'definition' attribute.`);
    });
  });
  describe("Async DelayedPromise Tests", () => {
    it("should successfully deserialize valid JSON I", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testPhenomenonItem = await ecSchema.getItem<Phenomenon>("Length");
      const testUnitSystemItem = await ecSchema.getItem<UnitSystem>("Metric");
      const testUnitItem = await ecSchema.getItem<Unit>("M");
      assert.isDefined(testPhenomenonItem);
      assert.isDefined(testUnitSystemItem);
      assert.isDefined(testUnitItem);
      assert.isTrue(testPhenomenonItem instanceof Phenomenon);
      assert.isTrue(testUnitSystemItem instanceof UnitSystem);
      assert.isTrue(testUnitItem instanceof Unit);
      assert(testPhenomenonItem!.definition === "LENGTH(1)");
      assert(testUnitItem!.phenomenon!.name, testPhenomenonItem!.name);
      assert(testUnitItem!.unitSystem!.name, testUnitSystemItem!.name);
    });
    it("should successfully deserialize valid JSON II", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
            label: "length",
          },
          Metric: {
            schemaItemType: "UnitSystem",
            label: "metric",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testPhenomenonItem = await ecSchema.getItem<Phenomenon>("Length");
      const testUnitSystemItem = await ecSchema.getItem<UnitSystem>("Metric");
      const testUnitItem = await ecSchema.getItem<Unit>("M");
      assert(testUnitItem!.phenomenon!.then((value: Phenomenon) => value.label === testPhenomenonItem!.label));
      assert(testUnitItem!.unitSystem!.then((value: UnitSystem) => value.label === testUnitSystemItem!.label));
    });
    it("Order shouldn't matter", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
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
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testPhenomenonItem = await ecSchema.getItem<Phenomenon>("Length");
      const testUnitSystemItem = await ecSchema.getItem<UnitSystem>("Metric");
      const testUnitItem = await ecSchema.getItem<Unit>("M");
      assert(testUnitItem!.phenomenon!.then((value: Phenomenon) => value.label === testPhenomenonItem!.label));
      assert(testUnitItem!.unitSystem!.then((value: UnitSystem) => value.label === testUnitSystemItem!.label));
    });
  });
  describe("Sync DelayedPromise Tests", () => {
    it("should successfully deserialize valid JSON I", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(json);
      assert.isDefined(ecSchema);
      const testPhenomenonItem = ecSchema.getItemSync<Phenomenon>("Length");
      const testUnitSystemItem = ecSchema.getItemSync<UnitSystem>("Metric");
      const testUnitItem = ecSchema.getItemSync<Unit>("M");
      assert.isDefined(testPhenomenonItem);
      assert.isDefined(testUnitSystemItem);
      assert.isDefined(testUnitItem);
      assert.isTrue(testPhenomenonItem instanceof Phenomenon);
      assert.isTrue(testUnitSystemItem instanceof UnitSystem);
      assert.isTrue(testUnitItem instanceof Unit);
      assert(testPhenomenonItem!.definition === "LENGTH(1)");
      assert(testUnitItem!.phenomenon!.name, testPhenomenonItem!.name);
      assert(testUnitItem!.unitSystem!.name, testUnitSystemItem!.name);
    });
    it("should successfully deserialize valid JSON II", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
            label: "length",
          },
          Metric: {
            schemaItemType: "UnitSystem",
            label: "metric",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(json);
      assert.isDefined(ecSchema);
      const testPhenomenonItem = ecSchema.getItemSync<Phenomenon>("Length");
      const testUnitSystemItem = ecSchema.getItemSync<UnitSystem>("Metric");
      const testUnitItem = ecSchema.getItemSync<Unit>("M");
      assert(testUnitItem!.phenomenon!.then((value: Phenomenon) => value.label === testPhenomenonItem!.label));
      assert(testUnitItem!.unitSystem!.then((value: UnitSystem) => value.label === testUnitSystemItem!.label));
    });
    it("Order shouldn't matter", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
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
        },
      };
      const ecSchema = Schema.fromJsonSync(json);
      assert.isDefined(ecSchema);
      const testPhenomenonItem = ecSchema.getItemSync<Phenomenon>("Length");
      const testUnitSystemItem = ecSchema.getItemSync<UnitSystem>("Metric");
      const testUnitItem = ecSchema.getItemSync<Unit>("M");
      assert(testUnitItem!.phenomenon!.then((value: Phenomenon) => value.label === testPhenomenonItem!.label));
      assert(testUnitItem!.unitSystem!.then((value: UnitSystem) => value.label === testUnitSystemItem!.label));
    });
  });
  describe("Sync fromJson", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testUnit = new Unit(schema, "MM");
    });
    it("Basic test for definition", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            label: "Millimeter",
            description: "A unit defining the millimeter metric unit of length",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*Units.MM",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.MM",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(testSchema);
      const schemaUnit = ecSchema.getItemSync("MM");
      assert.isDefined(schemaUnit);
      const unitTest: Unit = schemaUnit as Unit;
      assert(unitTest.definition, "[MILLI]*Units.MM");
    });
    it("Label must be a string", () => {
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
      assert.throws(() => testUnit.fromJsonSync(json), ECObjectsError, `The SchemaItem MM has an invalid 'label' attribute. It should be of type 'string'.`);
    });
    it("Name in json must match name in constructor", () => {
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
      assert.throws(() => testUnit.fromJsonSync(json), ECObjectsError,  ``);
    });
    it("Phenomenon can't be undefined", () => {
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
      assert.throws(() => testUnit.fromJsonSync(json), ECObjectsError, `The Unit MM does not have the required 'phenomenon' attribute.`);
    });
    it("Numerator can't be a string", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            label: "Millimeter",
            description: "A unit defining the millimeter metric unit of length",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*Units.MM",
            numerator: "5",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.MM",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(json), ECObjectsError, `The Unit MM has an invalid 'numerator' attribute. It should be of type 'number'.`);
    });
    it("Numerator, denominator, offset default values are 1.0, 1.0, 0.0, respectively", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            label: "Millimeter",
            description: "A unit defining the millimeter metric unit of length",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*Units.MM",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.MM",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(testSchema);
      const schemaUnit = ecSchema.getItemSync("MM");
      assert.isDefined(schemaUnit);
      const unitTest: Unit = schemaUnit as Unit;
      assert(unitTest.numerator === 1.0);
      assert(unitTest.denominator === 1.0);
      assert(unitTest.offset === 0.0);
    });
    it("Numerator, denominator, offset are different than default", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            label: "Millimeter",
            description: "A unit defining the millimeter metric unit of length",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*Units.MM",
            numerator: 3.0,
            denominator: 6.0,
            offset: 4.0,
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.MM",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(testSchema);
      const schemaUnit = ecSchema.getItemSync("MM");
      assert.isDefined(schemaUnit);
      const unitTest: Unit = schemaUnit as Unit;
      assert(unitTest.numerator === 3.0);
      assert(unitTest.denominator === 6.0);
      assert(unitTest.offset === 4.0);
    });
    it("Invalid ECName", () => {
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
      assert.throws(() => testUnit.fromJsonSync(json), ECObjectsError,  ``);
    });
    it("Definition is required", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            label: "Millimeter",
            description: "A unit defining the millimeter metric unit of length",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.MM",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(testSchema), ECObjectsError, `The Unit MM does not have the required 'definition' attribute.`);
    });
  });
});
