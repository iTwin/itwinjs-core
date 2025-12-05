/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaContext } from "../Context";
import { PrimitiveType, RelationshipEnd } from "../ECObjects";
import { ECClass, MutableClass, StructClass } from "../Metadata/Class";
import { Constant } from "../Metadata/Constant";
import { CustomAttributeClass } from "../Metadata/CustomAttributeClass";
import { EntityClass } from "../Metadata/EntityClass";
import { Enumeration } from "../Metadata/Enumeration";
import { Format } from "../Metadata/Format";
import { InvertedUnit } from "../Metadata/InvertedUnit";
import { KindOfQuantity } from "../Metadata/KindOfQuantity";
import { Mixin } from "../Metadata/Mixin";
import { Phenomenon } from "../Metadata/Phenomenon";
import { PropertyCategory } from "../Metadata/PropertyCategory";
import { RelationshipClass, RelationshipConstraint } from "../Metadata/RelationshipClass";
import { Schema } from "../Metadata/Schema";
import { Unit } from "../Metadata/Unit";
import { UnitSystem } from "../Metadata/UnitSystem";
import { SchemaPartVisitorDelegate } from "../SchemaPartVisitorDelegate";

describe("SchemaPartVisitorDelegate Tests", () => {
	let schema: Schema;
	let helper: SchemaPartVisitorDelegate;
	let mockVisitor: any;

	beforeEach(() => {
		schema = new Schema(new SchemaContext(), "Test", "test", 1, 2, 3);
	});

	describe("visitSchema", () => {
		it("full schema is false, visitEmptySchema called once.", async () => {
			mockVisitor = { visitEmptySchema: vi.fn(), visitFullSchema: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchema(schema, false);
			expect(mockVisitor.visitEmptySchema).toHaveBeenCalledOnce();
			expect(mockVisitor.visitEmptySchema).toHaveBeenCalledWith(schema);
			expect(mockVisitor.visitFullSchema).not.toHaveBeenCalled();
		});

		it("full schema is true, visitFullSchema called once.", async () => {
			mockVisitor = { visitEmptySchema: vi.fn(), visitFullSchema: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchema(schema);
			expect(mockVisitor.visitFullSchema).toHaveBeenCalledOnce();
			expect(mockVisitor.visitFullSchema).toHaveBeenCalledWith(schema);
			expect(mockVisitor.visitEmptySchema).not.toHaveBeenCalled();
		});
	});

	describe("visitSchemaSync", () => {
		it("full schema is false, visitEmptySchemaSync called once.", () => {
			mockVisitor = { visitEmptySchemaSync: vi.fn(), visitFullSchemaSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaSync(schema, false);
			expect(mockVisitor.visitEmptySchemaSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitEmptySchemaSync).toHaveBeenCalledWith(schema);
			expect(mockVisitor.visitFullSchemaSync).not.toHaveBeenCalled();
		});

		it("full schema is true, visitFullSchemaSync called once.", () => {
			mockVisitor = { visitEmptySchemaSync: vi.fn(), visitFullSchemaSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaSync(schema);
			expect(mockVisitor.visitFullSchemaSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitFullSchemaSync).toHaveBeenCalledWith(schema);
			expect(mockVisitor.visitEmptySchemaSync).not.toHaveBeenCalled();
		});
	});

	describe("visitSchemaPart", () => {
		beforeEach(() => {
			mockVisitor = {
				visitSchemaItem: vi.fn(),
				visitClass: vi.fn(),
				visitCustomAttributeContainer: vi.fn(),
			};
		});

		it("Constant, visit methods called correctly", async () => {
			const testItem = new Constant(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitConstant: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitConstant).toHaveBeenCalledOnce();
			expect(mockVisitor.visitConstant).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("Constant, no visitor, call does not error", async () => {
			const testItem = new Constant(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("CustomAttributeClass, visit methods called correctly", async () => {
			const testItem = new CustomAttributeClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitCustomAttributeClass: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitCustomAttributeClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClass).toHaveBeenCalledWith(testItem);
		});

		it("CustomAttributeClass, no visitor, call does not error", async () => {
			const testItem = new CustomAttributeClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClass).toHaveBeenCalledWith(testItem);
		});

		it("EntityClass, visit methods called correctly", async () => {
			const testItem = new EntityClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitEntityClass: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitEntityClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitEntityClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
		});

		it("EntityClass, no visitor, call does not error", async () => {
			const testItem = new EntityClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
		});

		it("Enumeration, visit methods called correctly", async () => {
			const testItem = new Enumeration(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitEnumeration: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitEnumeration).toHaveBeenCalledOnce();
			expect(mockVisitor.visitEnumeration).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
		});

		it("Enumeration, no visitor, call does not error", async () => {
			const testItem = new Enumeration(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("Format, visit methods called correctly", async () => {
			const testItem = new Format(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitFormat: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitFormat).toHaveBeenCalledOnce();
			expect(mockVisitor.visitFormat).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
		});

		it("Format, no visitor, call does not error", async () => {
			const testItem = new Format(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("InvertedUnit, visit methods called correctly", async () => {
			const testItem = new InvertedUnit(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitInvertedUnit: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitInvertedUnit).toHaveBeenCalledOnce();
			expect(mockVisitor.visitInvertedUnit).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
		});

		it("InvertedUnit, no visitor, call does not error", async () => {
			const testItem = new InvertedUnit(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("KindOfQuantity, visit methods called correctly", async () => {
			const testItem = new KindOfQuantity(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitKindOfQuantity: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitKindOfQuantity).toHaveBeenCalledOnce();
			expect(mockVisitor.visitKindOfQuantity).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
		});

		it("KindOfQuantity, no visitor, call does not error", async () => {
			const testItem = new KindOfQuantity(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("Mixin, visit methods called correctly", async () => {
			const testItem = new Mixin(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitMixin: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitMixin).toHaveBeenCalledOnce();
			expect(mockVisitor.visitMixin).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
		});

		it("Mixin, no visitor, call does not error", async () => {
			const testItem = new Mixin(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
		});

		it("Phenomenon, visit methods called correctly", async () => {
			const testItem = new Phenomenon(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitPhenomenon: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitPhenomenon).toHaveBeenCalledOnce();
			expect(mockVisitor.visitPhenomenon).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
		});

		it("Phenomenon, no visitor, call does not error", async () => {
			const testItem = new Phenomenon(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("PropertyCategory, visit methods, called correctly", async () => {
			const testItem = new PropertyCategory(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitPropertyCategory: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitPropertyCategory).toHaveBeenCalledOnce();
			expect(mockVisitor.visitPropertyCategory).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
		});

		it("PropertyCategory, no visitor, call does not error", async () => {
			const testItem = new PropertyCategory(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("RelationshipClass, visit methods called correctly", async () => {
			const testItem = new RelationshipClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitRelationshipClass: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitRelationshipClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitRelationshipClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
		});

		it("RelationshipClass, no visitor, call does not error", async () => {
			const testItem = new RelationshipClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
		});

		it("StructClass, visit methods called correctly", async () => {
			const testItem = new StructClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitStructClass: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitStructClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitStructClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
		});

		it("StructClass, no visitor, call does not error", async () => {
			const testItem = new StructClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClass).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
		});

		it("Unit, visit methods called correctly", async () => {
			const testItem = new Unit(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitUnit: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitUnit).toHaveBeenCalledOnce();
			expect(mockVisitor.visitUnit).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
		});

		it("Unit, no visitor, call does not error", async () => {
			const testItem = new Unit(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("UnitSystem, visit methods called correctly", async () => {
			const testItem = new UnitSystem(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitUnitSystem: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitUnitSystem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitUnitSystem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
		});

		it("UnitSystem, no visitor, call does not error", async () => {
			const testItem = new UnitSystem(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItem).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("Property, visit methods called correctly", async () => {
			const testItem = new EntityClass(schema, "TestItem");
			const property = await (testItem as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
			mockVisitor = { ...mockVisitor, visitProperty: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(property);

			expect(mockVisitor.visitProperty).toHaveBeenCalledOnce();
			expect(mockVisitor.visitProperty).toHaveBeenCalledWith(property);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(property);
			expect(mockVisitor.visitSchemaItem).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});

		it("RelationshipConstraint, visit methods called correctly", async () => {
			const relationship = new RelationshipClass(schema, "TestRelationship");
			const testItem = new RelationshipConstraint(relationship, RelationshipEnd.Source);
			mockVisitor = { ...mockVisitor, visitRelationshipConstraint: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			await helper.visitSchemaPart(testItem);

			expect(mockVisitor.visitRelationshipConstraint).toHaveBeenCalledOnce();
			expect(mockVisitor.visitRelationshipConstraint).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItem).not.toHaveBeenCalled();
			expect(mockVisitor.visitClass).not.toHaveBeenCalled();
		});
	});

	describe("visitSchemaPartSync", () => {
		beforeEach(() => {
			mockVisitor = {
				visitSchemaItemSync: vi.fn(),
				visitClassSync: vi.fn(),
				visitCustomAttributeContainerSync: vi.fn(),
			};
		});

		it("Constant, visit methods called correctly", () => {
			const testItem = new Constant(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitConstantSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitConstantSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitConstantSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("Constant, no visitor, call does not error", () => {
			const testItem = new Constant(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("CustomAttributeClass, visit methods called correctly", () => {
			const testItem = new CustomAttributeClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitCustomAttributeClassSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitCustomAttributeClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClassSync).toHaveBeenCalledWith(testItem);
		});

		it("CustomAttributeClass, no visitor, call does not error", async () => {
			const testItem = new CustomAttributeClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClassSync).toHaveBeenCalledWith(testItem);
		});

		it("EntityClass, visit methods called correctly", async () => {
			const testItem = new EntityClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitEntityClassSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitEntityClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitEntityClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
		});

		it("EntityClass, no visitor, call does not error", async () => {
			const testItem = new EntityClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
		});

		it("Enumeration, visit methods called correctly", () => {
			const testItem = new Enumeration(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitEnumerationSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitEnumerationSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitEnumerationSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
		});

		it("Enumeration, no visitor, call does not error", () => {
			const testItem = new Enumeration(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("Format, visit methods called correctly", () => {
			const testItem = new Format(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitFormatSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitFormatSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitFormatSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
		});

		it("Format, no visitor, call does not error", () => {
			const testItem = new Format(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("InvertedUnit, visit methods called correctly", () => {
			const testItem = new InvertedUnit(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitInvertedUnitSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitInvertedUnitSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitInvertedUnitSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
		});

		it("InvertedUnit, no visitor, call does not error", () => {
			const testItem = new InvertedUnit(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("KindOfQuantity, visit methods called correctly", () => {
			const testItem = new KindOfQuantity(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitKindOfQuantitySync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitKindOfQuantitySync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitKindOfQuantitySync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
		});

		it("KindOfQuantity, no visitor, call does not error", () => {
			const testItem = new KindOfQuantity(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("Mixin, visit methods called correctly", () => {
			const testItem = new Mixin(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitMixinSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitMixinSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitMixinSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
		});

		it("Mixin, no visitor, call does not error", () => {
			const testItem = new Mixin(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
		});

		it("Phenomenon, visit methods called correctly", () => {
			const testItem = new Phenomenon(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitPhenomenonSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitPhenomenonSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitPhenomenonSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
		});

		it("Phenomenon, no visitor, call does not error", () => {
			const testItem = new Phenomenon(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("PropertyCategory, visit methods called correctly", () => {
			const testItem = new PropertyCategory(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitPropertyCategorySync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitPropertyCategorySync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitPropertyCategorySync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
		});

		it("PropertyCategory, no visitor, call does not error", () => {
			const testItem = new PropertyCategory(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("RelationshipClass, visit methods called correctly", () => {
			const testItem = new RelationshipClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitRelationshipClassSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitRelationshipClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitRelationshipClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
		});

		it("RelationshipClass, no visitor, call does not error", () => {
			const testItem = new RelationshipClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
		});

		it("StructClass, visit methods called correctly", () => {
			const testItem = new StructClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitStructClassSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitStructClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitStructClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
		});

		it("StructClass, no visitor, call does not error", () => {
			const testItem = new StructClass(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitClassSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
		});

		it("Unit, visit methods called correctly", () => {
			const testItem = new Unit(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitUnitSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitUnitSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitUnitSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
		});

		it("Unit, no visitor, call does not error", () => {
			const testItem = new Unit(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("UnitSystem, visit methods called correctly", () => {
			const testItem = new UnitSystem(schema, "TestItem");
			mockVisitor = { ...mockVisitor, visitUnitSystemSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitUnitSystemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitUnitSystemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
		});

		it("UnitSystem, no visitor, call does not error", () => {
			const testItem = new UnitSystem(schema, "TestItem");
			mockVisitor = { ...mockVisitor };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitSchemaItemSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("Property, visit methods called correctly", async () => {
			const testItem = new EntityClass(schema, "TestItem");
			const property = await (testItem as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
			mockVisitor = { ...mockVisitor, visitPropertySync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(property);

			expect(mockVisitor.visitPropertySync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitPropertySync).toHaveBeenCalledWith(property);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(property);
			expect(mockVisitor.visitSchemaItemSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});

		it("RelationshipConstraint, visit methods called correctly", () => {
			const relationship = new RelationshipClass(schema, "TestRelationship");
			const testItem = new RelationshipConstraint(relationship, RelationshipEnd.Source);
			mockVisitor = { ...mockVisitor, visitRelationshipConstraintSync: vi.fn() };
			helper = new SchemaPartVisitorDelegate(mockVisitor);

			helper.visitSchemaPartSync(testItem);

			expect(mockVisitor.visitRelationshipConstraintSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitRelationshipConstraintSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledOnce();
			expect(mockVisitor.visitCustomAttributeContainerSync).toHaveBeenCalledWith(testItem);
			expect(mockVisitor.visitSchemaItemSync).not.toHaveBeenCalled();
			expect(mockVisitor.visitClassSync).not.toHaveBeenCalled();
		});
	});
});
