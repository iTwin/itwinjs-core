/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeAll, describe, expect, it } from "vitest";
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
		expect(ecSchema).toBeDefined();
		const unit = await ecSchema.getItem("TestUnit", Unit);
		expect(unit).toBeDefined();
		expect(unit!.fullName).toBe("TestSchema.TestUnit");
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

		beforeAll(async () => {
			ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
			expect(ecSchema).toBeDefined();
		});

		it("typeguard and type assertion should work on Unit", async () => {
			const testUnit = await ecSchema.getItem("TestUnit");
			expect(testUnit).toBeDefined();
			expect(Unit.isUnit(testUnit)).toBe(true);
			expect(() => Unit.assertIsUnit(testUnit)).not.toThrow();
			// verify against other schema item type
			const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
			expect(testPhenomenon).toBeDefined();
			expect(Unit.isUnit(testPhenomenon)).toBe(false);
			expect(() => Unit.assertIsUnit(testPhenomenon)).toThrow();
		});

		it("Unit type should work with getItem/Sync", async () => {
			expect(await ecSchema.getItem("TestUnit", Unit)).toBeInstanceOf(Unit);
			expect(ecSchema.getItemSync("TestUnit", Unit)).toBeInstanceOf(Unit);
		});

		it("Unit type should reject for other item types on getItem/Sync", async () => {
			expect(await ecSchema.getItem("TestPhenomenon", Unit)).toBeUndefined();
			expect(ecSchema.getItemSync("TestPhenomenon", Unit)).toBeUndefined();
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
			expect(unit).toBeDefined();

			const phen = await ecSchema.getItem("TestPhenomenon", Phenomenon);
			expect(phen).toBeDefined();
			expect((await unit!.phenomenon) === phen).toBe(true);

			const unitSystem = await ecSchema.getItem("TestUnitSystem", UnitSystem);
			expect(unitSystem).toBeDefined();
			expect((await unit!.unitSystem) === unitSystem).toBe(true);

			expect(unit!.definition).toEqual("[MILLI]*Units.MM");
			expect(unit!.denominator).toEqual(1);
			expect(unit!.numerator).toEqual(5);
			expect(unit!.offset).toEqual(4);
		});

		it("sync - should succeed with fully defined", () => {
			const ecSchema = Schema.fromJsonSync(fullyDefinedUnit, new SchemaContext());
			const unit = ecSchema.getItemSync("TestUnit", Unit);
			expect(unit).toBeDefined();

			const phen = ecSchema.getItemSync("TestPhenomenon", Phenomenon);
			expect(phen).toBeDefined();
			expect(phen).toBe(ecSchema.getItemSync(unit!.phenomenon!.name, Phenomenon));

			const unitSystem = ecSchema.getItemSync("TestUnitSystem", UnitSystem);
			expect(unitSystem).toBeDefined();
			expect(unitSystem).toBe(ecSchema.getItemSync(unit!.unitSystem!.name, UnitSystem));

			expect(unit!.definition).toEqual("[MILLI]*Units.MM");
			expect(unit!.denominator).toEqual(1);
			expect(unit!.numerator).toEqual(5);
			expect(unit!.offset).toEqual(4);
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
			expect(ecSchema).toBeDefined();
			expect(await ecSchema.getItem("Length", Phenomenon)).toBeDefined();
			expect(await ecSchema.getItem("Metric", UnitSystem)).toBeDefined();
			expect(await ecSchema.getItem("M", Unit)).toBeDefined();
		});

		it("sync - should succeed with dependency order", () => {
			const ecSchema = Schema.fromJsonSync(reverseOrderJson, new SchemaContext());
			expect(ecSchema).toBeDefined();
			expect(ecSchema.getItemSync("Length", Phenomenon)).toBeDefined();
			expect(ecSchema.getItemSync("Metric", UnitSystem)).toBeDefined();
			expect(ecSchema.getItemSync("M", Unit)).toBeDefined();
		});

		// Missing phenomenon
		const missingPhenomenonJson = {
			unitSystem: "TestSchema.TestUnitSystem",
			definition: "[MILLI]*Units.M",
		};
		it("async - should throw for missing phenomenon", async () => {
			await expect(Schema.fromJson(createSchemaJson(missingPhenomenonJson), new SchemaContext())).rejects.toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit does not have the required 'phenomenon' attribute.`),
				})
			);
		});
		it("sync - should throw for missing phenomenon", () => {
			expect(() => Schema.fromJsonSync(createSchemaJson(missingPhenomenonJson), new SchemaContext())).toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit does not have the required 'phenomenon' attribute.`),
				})
			);
		});

		// Invalid phenomenon
		const invalidPhenomenonJson = {
			phenomenon: 5,
			unitSystem: "TestSchema.TestUnitSystem",
			definition: "[MILLI]*Units.M",
		};
		it("async - should throw for invalid phenomenon", async () => {
			await expect(Schema.fromJson(createSchemaJson(invalidPhenomenonJson), new SchemaContext())).rejects.toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'phenomenon' attribute. It should be of type 'string'`),
				})
			);
		});
		it("sync - should throw for invalid phenomenon", () => {
			expect(() => Schema.fromJsonSync(createSchemaJson(invalidPhenomenonJson), new SchemaContext())).toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'phenomenon' attribute. It should be of type 'string'`),
				})
			);
		});

		// Missing UnitSystem
		const missingUnitSystemJson = {
			phenomenon: "TestSchema.TestPhenomenon",
			definition: "[MILLI]*Units.M",
		};
		it("async - should throw for missing unit system", async () => {
			await expect(Schema.fromJson(createSchemaJson(missingUnitSystemJson), new SchemaContext())).rejects.toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit does not have the required 'unitSystem' attribute.`),
				})
			);
		});
		it("sync - should throw for missing unit system", () => {
			expect(() => Schema.fromJsonSync(createSchemaJson(missingUnitSystemJson), new SchemaContext())).toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit does not have the required 'unitSystem' attribute.`),
				})
			);
		});

		// Invalid UnitSystem
		const invalidUnitSystemJson = {
			unitSystem: 5,
			phenomenon: "TestSchema.TestPhenomenon",
			definition: "[MILLI]*Units.M",
		};
		it("async - should throw for invalid unit system", async () => {
			await expect(Schema.fromJson(createSchemaJson(invalidUnitSystemJson), new SchemaContext())).rejects.toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'unitSystem' attribute. It should be of type 'string'`),
				})
			);
		});
		it("sync - should throw for invalid unit system", () => {
			expect(() => Schema.fromJsonSync(createSchemaJson(invalidUnitSystemJson), new SchemaContext())).toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'unitSystem' attribute. It should be of type 'string'`),
				})
			);
		});

		// Missing Definition
		const missingDefinitionJson = {
			phenomenon: "TestSchema.TestPhenomenon",
			unitSystem: "TestSchema.TestUnitSystem",
		};
		it("async - should throw for missing definition", async () => {
			await expect(Schema.fromJson(createSchemaJson(missingDefinitionJson), new SchemaContext())).rejects.toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit does not have the required 'definition' attribute.`),
				})
			);
		});
		it("sync - should throw for missing definition", () => {
			expect(() => Schema.fromJsonSync(createSchemaJson(missingDefinitionJson), new SchemaContext())).toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit does not have the required 'definition' attribute.`),
				})
			);
		});

		// Missing Definition
		const invalidDefinitionJson = {
			definition: 5,
			phenomenon: "TestSchema.TestPhenomenon",
			unitSystem: "TestSchema.TestUnitSystem",
		};
		it("async - should throw for invalid definition", async () => {
			await expect(Schema.fromJson(createSchemaJson(invalidDefinitionJson), new SchemaContext())).rejects.toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'definition' attribute. It should be of type 'string'`),
				})
			);
		});
		it("sync - should throw for invalid definition", () => {
			expect(() => Schema.fromJsonSync(createSchemaJson(invalidDefinitionJson), new SchemaContext())).toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'definition' attribute. It should be of type 'string'`),
				})
			);
		});

		// Invalid numerator
		const invalidNumeratorJson = {
			phenomenon: "TestSchema.TestPhenomenon",
			unitSystem: "TestSchema.TestUnitSystem",
			definition: "[MILLI]*Units.MM",
			numerator: "5",
		};
		it("async - should throw for invalid numerator", async () => {
			await expect(Schema.fromJson(createSchemaJson(invalidNumeratorJson), new SchemaContext())).rejects.toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'numerator' attribute. It should be of type 'number'.`),
				})
			);
		});
		it("sync - should throw for invalid numerator", () => {
			expect(() => Schema.fromJsonSync(createSchemaJson(invalidNumeratorJson), new SchemaContext())).toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'numerator' attribute. It should be of type 'number'.`),
				})
			);
		});

		// Invalid denominator
		const invalidDenominatorJson = {
			phenomenon: "TestSchema.TestPhenomenon",
			unitSystem: "TestSchema.TestUnitSystem",
			definition: "[MILLI]*Units.MM",
			denominator: "5",
		};
		it("async - should throw for invalid denominator", async () => {
			await expect(Schema.fromJson(createSchemaJson(invalidDenominatorJson), new SchemaContext())).rejects.toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'denominator' attribute. It should be of type 'number'.`),
				})
			);
		});
		it("sync - should throw for invalid denominator", () => {
			expect(() => Schema.fromJsonSync(createSchemaJson(invalidDenominatorJson), new SchemaContext())).toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'denominator' attribute. It should be of type 'number'.`),
				})
			);
		});

		// Invalid offset
		const invalidOffsetJson = {
			phenomenon: "TestSchema.TestPhenomenon",
			unitSystem: "TestSchema.TestUnitSystem",
			definition: "[MILLI]*Units.MM",
			offset: "5",
		};
		it("async - should throw for invalid offset", async () => {
			await expect(Schema.fromJson(createSchemaJson(invalidOffsetJson), new SchemaContext())).rejects.toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'offset' attribute. It should be of type 'number'.`),
				})
			);
		});
		it("sync - should throw for invalid offset", () => {
			expect(() => Schema.fromJsonSync(createSchemaJson(invalidOffsetJson), new SchemaContext())).toThrowError(
				expect.objectContaining({
					constructor: ECSchemaError,
					message: expect.stringContaining(`The Unit TestSchema.TestUnit has an invalid 'offset' attribute. It should be of type 'number'.`),
				})
			);
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
			expect(unit).toBeDefined();
			const unitSerialization = unit!.toJSON(true, true);

			expect(unitSerialization.phenomenon).toEqual("TestSchema.TestPhenomenon");
			expect(unitSerialization.unitSystem).toEqual("TestSchema.TestUnitSystem");
			expect(unitSerialization.definition).toEqual("[MILLI]*Units.MM");
			expect(unitSerialization.denominator).toEqual(1);
			expect(unitSerialization.numerator).toEqual(5);
			expect(unitSerialization.offset).toEqual(4);
		});

		it("sync - should succeed with fully defined", () => {
			const ecSchema = Schema.fromJsonSync(fullyDefinedUnit, new SchemaContext());
			const unit = ecSchema.getItemSync("TestUnit", Unit);
			expect(unit).toBeDefined();
			const unitSerialization = unit!.toJSON(true, true);

			expect(unitSerialization.phenomenon).toEqual("TestSchema.TestPhenomenon");
			expect(unitSerialization.unitSystem).toEqual("TestSchema.TestUnitSystem");
			expect(unitSerialization.definition).toEqual("[MILLI]*Units.MM");
			expect(unitSerialization.denominator).toEqual(1);
			expect(unitSerialization.numerator).toEqual(5);
			expect(unitSerialization.offset).toEqual(4);
		});

		it("async - JSON stringify serialization, should succeed with fully defined", async () => {
			const ecSchema = await Schema.fromJson(fullyDefinedUnit, new SchemaContext());
			const unit = await ecSchema.getItem("TestUnit", Unit);
			expect(unit).toBeDefined();
			const json = JSON.stringify(unit);
			const unitSerialization = JSON.parse(json);

			expect(unitSerialization.phenomenon).toEqual("TestSchema.TestPhenomenon");
			expect(unitSerialization.unitSystem).toEqual("TestSchema.TestUnitSystem");
			expect(unitSerialization.definition).toEqual("[MILLI]*Units.MM");
			expect(unitSerialization.denominator).toEqual(1);
			expect(unitSerialization.numerator).toEqual(5);
			expect(unitSerialization.offset).toEqual(4);
		});

		it("sync - JSON stringify serialization, should succeed with fully defined", () => {
			const ecSchema = Schema.fromJsonSync(fullyDefinedUnit, new SchemaContext());
			const unit = ecSchema.getItemSync("TestUnit", Unit);
			expect(unit).toBeDefined();
			const json = JSON.stringify(unit);
			const unitSerialization = JSON.parse(json);

			expect(unitSerialization.phenomenon).toEqual("TestSchema.TestPhenomenon");
			expect(unitSerialization.unitSystem).toEqual("TestSchema.TestUnitSystem");
			expect(unitSerialization.definition).toEqual("[MILLI]*Units.MM");
			expect(unitSerialization.denominator).toEqual(1);
			expect(unitSerialization.numerator).toEqual(5);
			expect(unitSerialization.offset).toEqual(4);
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
			expect(ecSchema).toBeDefined();
			const unit = await ecSchema.getItem("M", Unit);
			expect(unit).toBeDefined();
			const unitSerialization = unit!.toJSON(true, true);

			expect(unitSerialization.phenomenon).toEqual("TestSchema.Length");
			expect(unitSerialization.unitSystem).toEqual("TestSchema.Metric");
			expect(unitSerialization.definition).toEqual("[MILLI]*M");
		});

		it("sync - should succeed with dependency order", () => {
			const ecSchema = Schema.fromJsonSync(reverseOrderJson, new SchemaContext());
			expect(ecSchema).toBeDefined();
			const unit = ecSchema.getItemSync("M", Unit);
			expect(unit).toBeDefined();
			const unitSerialization = unit!.toJSON(true, true);

			expect(unitSerialization.phenomenon).toEqual("TestSchema.Length");
			expect(unitSerialization.unitSystem).toEqual("TestSchema.Metric");
			expect(unitSerialization.definition).toEqual("[MILLI]*M");
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
			expect(unit).toBeDefined();
			const unitSerialization = unit!.toJSON(true, true);

			expect(unitSerialization.numerator).toEqual(10);
			expect(unitSerialization.denominator).toBeUndefined();
			expect(unitSerialization.offset).toBeUndefined();
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
			expect(unit).toBeDefined();
			const unitSerialization = unit!.toJSON(true, true);

			expect(unitSerialization.offset).toEqual(10);
			expect(unitSerialization.denominator).toEqual(12);
			expect(unitSerialization.numerator).toBeUndefined();
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
			expect(unit).toBeDefined();
			const serialized = await unit!.toXml(newDom);
			expect(serialized.nodeName).toEqual("Unit");
			expect(serialized.getAttribute("typeName")).toEqual("TestUnit");
			expect(serialized.getAttribute("phenomenon")).toEqual("TestPhenomenon");
			expect(serialized.getAttribute("unitSystem")).toEqual("TestUnitSystem");
			expect(serialized.getAttribute("definition")).toEqual("[MILLI]*Units.MM");
			expect(serialized.getAttribute("numerator")).toEqual("5.1");
			expect(serialized.getAttribute("denominator")).toEqual("2.4");
			expect(serialized.getAttribute("offset")).toEqual("4");
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
			expect(unit).toBeDefined();
			const serialized = await unit!.toXml(newDom);

			expect(serialized.getAttribute("numerator")).toEqual("5.1");
			expect(serialized.getAttribute("denominator")).toEqual("");
			expect(serialized.getAttribute("offset")).toEqual("");
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
			expect(unit).toBeDefined();
			const serialized = await unit!.toXml(newDom);

			expect(serialized.getAttribute("numerator")).toEqual("");
			expect(serialized.getAttribute("denominator")).toEqual("2.4");
			expect(serialized.getAttribute("offset")).toEqual("4");
		});
	});
});
