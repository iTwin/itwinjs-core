/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeAll, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { StructClass } from "../../Metadata/Class";
import { Schema } from "../../Metadata/Schema";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

/* eslint-disable @typescript-eslint/naming-convention */

describe("StructClass", () => {
	it("should get fullName", async () => {
		const schemaJson = createSchemaJsonWithItems({
			testStruct: {
				schemaItemType: "StructClass",
			},
		});

		const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
		expect(ecSchema).toBeDefined();
		const structClass = await ecSchema.getItem("testStruct", StructClass);
		expect(structClass).toBeDefined();
		expect(structClass!.fullName).toBe("TestSchema.testStruct");
	});

	describe("struct class type safety checks", () => {
		const typeCheckJson = createSchemaJsonWithItems({
			TestStructClass: {
				schemaItemType: "StructClass",
				label: "Test Struct Class",
				description: "Used for testing",
				modifier: "Sealed",
			},
			TestPhenomenon: {
				schemaItemType: "Phenomenon",
				definition: "LENGTH(1)",
			},
		});

		let ecSchema: Schema;

		beforeAll(async () => {
			ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
			expect(ecSchema).toBeDefined();
		});

		it("typeguard and type assertion should work on StructClass", async () => {
			const testStructClass = await ecSchema.getItem("TestStructClass");
			expect(testStructClass).toBeDefined();
			expect(StructClass.isStructClass(testStructClass)).toBe(true);
			expect(() => StructClass.assertIsStructClass(testStructClass)).not.toThrow();
			// verify against other schema item type
			const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
			expect(testPhenomenon).toBeDefined();
			expect(StructClass.isStructClass(testPhenomenon)).toBe(false);
			expect(() => StructClass.assertIsStructClass(testPhenomenon)).toThrow();
		});

		it("StructClass type should work with getItem/Sync", async () => {
			expect(await ecSchema.getItem("TestStructClass", StructClass)).toBeInstanceOf(StructClass);
			expect(ecSchema.getItemSync("TestStructClass", StructClass)).toBeInstanceOf(StructClass);
		});

		it("StructClass type should reject for other item types on getItem/Sync", async () => {
			expect(await ecSchema.getItem("TestPhenomenon", StructClass)).toBeUndefined();
			expect(ecSchema.getItemSync("TestPhenomenon", StructClass)).toBeUndefined();
		});
	});
});
