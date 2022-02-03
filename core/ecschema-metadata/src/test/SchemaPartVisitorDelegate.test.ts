/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SchemaContext } from "../Context";
import { PrimitiveType, RelationshipEnd } from "../ECObjects";
import type { ECClass, MutableClass} from "../Metadata/Class";
import { StructClass } from "../Metadata/Class";
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

import sinon = require("sinon");
describe("SchemaPartVisitorDelegate Tests", () => {
  let schema: Schema;
  let helper: SchemaPartVisitorDelegate;
  let mockVisitor: any;

  beforeEach(() => {
    schema = new Schema(new SchemaContext(), "Test", "test", 1, 2, 3);
  });

  describe("visitSchema", () => {
    it("full schema is false, visitEmptySchema called once.", async () => {
      mockVisitor = { visitEmptySchema: sinon.spy(), visitFullSchema: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchema(schema, false);
      expect(mockVisitor.visitEmptySchema.calledOnceWithExactly(schema)).to.be.true;
      expect(mockVisitor.visitFullSchema.notCalled).to.be.true;
    });

    it("full schema is true, visitFullSchema called once.", async () => {
      mockVisitor = { visitEmptySchema: sinon.spy(), visitFullSchema: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchema(schema);
      expect(mockVisitor.visitFullSchema.calledOnceWithExactly(schema)).to.be.true;
      expect(mockVisitor.visitEmptySchema.notCalled).to.be.true;
    });
  });

  describe("visitSchemaSync", () => {
    it("full schema is false, visitEmptySchemaSync called once.", () => {
      mockVisitor = { visitEmptySchemaSync: sinon.spy(), visitFullSchemaSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaSync(schema, false);
      expect(mockVisitor.visitEmptySchemaSync.calledOnceWithExactly(schema)).to.be.true;
      expect(mockVisitor.visitFullSchemaSync.notCalled).to.be.true;
    });

    it("full schema is true, visitFullSchemaSync called once.", () => {
      mockVisitor = { visitEmptySchemaSync: sinon.spy(), visitFullSchemaSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaSync(schema);
      expect(mockVisitor.visitFullSchemaSync.calledOnceWithExactly(schema)).to.be.true;
      expect(mockVisitor.visitEmptySchemaSync.notCalled).to.be.true;
    });
  });

  describe("visitSchemaPart", () => {
    beforeEach(() => {
      mockVisitor = {
        visitSchemaItem: sinon.spy(),
        visitClass: sinon.spy(),
        visitCustomAttributeContainer: sinon.spy(),
      };
    });

    it("Constant, visit methods called correctly", async () => {
      const testItem = new Constant(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitConstant: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitConstant.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("Constant, no visitor, call does not error", async () => {
      const testItem = new Constant(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("CustomAttributeClass, visit methods called correctly", async () => {
      const testItem = new CustomAttributeClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitCustomAttributeClass: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitCustomAttributeClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("CustomAttributeClass, no visitor, call does not error", async () => {
      const testItem = new CustomAttributeClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("EntityClass, visit methods called correctly", async () => {
      const testItem = new EntityClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitEntityClass: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitEntityClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("EntityClass, no visitor, call does not error", async () => {
      const testItem = new EntityClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("Enumeration, visit methods called correctly", async () => {
      const testItem = new Enumeration(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitEnumeration: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitEnumeration.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
    });

    it("Enumeration, no visitor, call does not error", async () => {
      const testItem = new Enumeration(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("Format, visit methods called correctly", async () => {
      const testItem = new Format(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitFormat: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitFormat.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
    });

    it("Format, no visitor, call does not error", async () => {
      const testItem = new Format(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("InvertedUnit, visit methods called correctly", async () => {
      const testItem = new InvertedUnit(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitInvertedUnit: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitInvertedUnit.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
    });

    it("InvertedUnit, no visitor, call does not error", async () => {
      const testItem = new InvertedUnit(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("KindOfQuantity, visit methods called correctly", async () => {
      const testItem = new KindOfQuantity(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitKindOfQuantity: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitKindOfQuantity.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
    });

    it("KindOfQuantity, no visitor, call does not error", async () => {
      const testItem = new KindOfQuantity(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("Mixin, visit methods called correctly", async () => {
      const testItem = new Mixin(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitMixin: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitMixin.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("Mixin, no visitor, call does not error", async () => {
      const testItem = new Mixin(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("Phenomenon, visit methods called correctly", async () => {
      const testItem = new Phenomenon(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitPhenomenon: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitPhenomenon.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
    });

    it("Phenomenon, no visitor, call does not error", async () => {
      const testItem = new Phenomenon(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("PropertyCategory, visit methods, called correctly", async () => {
      const testItem = new PropertyCategory(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitPropertyCategory: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitPropertyCategory.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
    });

    it("PropertyCategory, no visitor, call does not error", async () => {
      const testItem = new PropertyCategory(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("RelationshipClass, visit methods called correctly", async () => {
      const testItem = new RelationshipClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitRelationshipClass: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitRelationshipClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("RelationshipClass, no visitor, call does not error", async () => {
      const testItem = new RelationshipClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("StructClass, visit methods called correctly", async () => {
      const testItem = new StructClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitStructClass: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitStructClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("StructClass, no visitor, call does not error", async () => {
      const testItem = new StructClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("Unit, visit methods called correctly", async () => {
      const testItem = new Unit(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitUnit: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitUnit.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
    });

    it("Unit, no visitor, call does not error", async () => {
      const testItem = new Unit(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("UnitSystem, visit methods called correctly", async () => {
      const testItem = new UnitSystem(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitUnitSystem: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitUnitSystem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
    });

    it("UnitSystem, no visitor, call does not error", async () => {
      const testItem = new UnitSystem(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitSchemaItem.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("Property, visit methods called correctly", async () => {
      const testItem = new EntityClass(schema, "TestItem");
      const property = await (testItem as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      mockVisitor = { ...mockVisitor, visitProperty: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(property);

      expect(mockVisitor.visitProperty.calledOnceWithExactly(property)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(property)).to.be.true;
      expect(mockVisitor.visitSchemaItem.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });

    it("RelationshipConstraint, visit methods called correctly", async () => {
      const relationship = new RelationshipClass(schema, "TestRelationship");
      const testItem = new RelationshipConstraint(relationship, RelationshipEnd.Source);
      mockVisitor = { ...mockVisitor, visitRelationshipConstraint: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      await helper.visitSchemaPart(testItem);

      expect(mockVisitor.visitRelationshipConstraint.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainer.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItem.notCalled).to.be.true;
      expect(mockVisitor.visitClass.notCalled).to.be.true;
    });
  });

  describe("visitSchemaPartSync", () => {
    beforeEach(() => {
      mockVisitor = {
        visitSchemaItemSync: sinon.spy(),
        visitClassSync: sinon.spy(),
        visitCustomAttributeContainerSync: sinon.spy(),
      };
    });

    it("Constant, visit methods called correctly", () => {
      const testItem = new Constant(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitConstantSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitConstantSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("Constant, no visitor, call does not error", () => {
      const testItem = new Constant(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("CustomAttributeClass, visit methods called correctly", () => {
      const testItem = new CustomAttributeClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitCustomAttributeClassSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitCustomAttributeClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("CustomAttributeClass, no visitor, call does not error", async () => {
      const testItem = new CustomAttributeClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("EntityClass, visit methods called correctly", async () => {
      const testItem = new EntityClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitEntityClassSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitEntityClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("EntityClass, no visitor, call does not error", async () => {
      const testItem = new EntityClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("Enumeration, visit methods called correctly", () => {
      const testItem = new Enumeration(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitEnumerationSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitEnumerationSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
    });

    it("Enumeration, no visitor, call does not error", () => {
      const testItem = new Enumeration(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("Format, visit methods called correctly", () => {
      const testItem = new Format(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitFormatSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitFormatSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
    });

    it("Format, no visitor, call does not error", () => {
      const testItem = new Format(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("InvertedUnit, visit methods called correctly", () => {
      const testItem = new InvertedUnit(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitInvertedUnitSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitInvertedUnitSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
    });

    it("InvertedUnit, no visitor, call does not error", () => {
      const testItem = new InvertedUnit(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("KindOfQuantity, visit methods called correctly", () => {
      const testItem = new KindOfQuantity(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitKindOfQuantitySync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitKindOfQuantitySync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
    });

    it("KindOfQuantity, no visitor, call does not error", () => {
      const testItem = new KindOfQuantity(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("Mixin, visit methods called correctly", () => {
      const testItem = new Mixin(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitMixinSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitMixinSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("Mixin, no visitor, call does not error", () => {
      const testItem = new Mixin(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("Phenomenon, visit methods called correctly", () => {
      const testItem = new Phenomenon(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitPhenomenonSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitPhenomenonSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
    });

    it("Phenomenon, no visitor, call does not error", () => {
      const testItem = new Phenomenon(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("PropertyCategory, visit methods called correctly", () => {
      const testItem = new PropertyCategory(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitPropertyCategorySync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitPropertyCategorySync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
    });

    it("PropertyCategory, no visitor, call does not error", () => {
      const testItem = new PropertyCategory(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("RelationshipClass, visit methods called correctly", () => {
      const testItem = new RelationshipClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitRelationshipClassSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitRelationshipClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("RelationshipClass, no visitor, call does not error", () => {
      const testItem = new RelationshipClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("StructClass, visit methods called correctly", () => {
      const testItem = new StructClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitStructClassSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitStructClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("StructClass, no visitor, call does not error", () => {
      const testItem = new StructClass(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
    });

    it("Unit, visit methods called correctly", () => {
      const testItem = new Unit(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitUnitSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitUnitSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
    });

    it("Unit, no visitor, call does not error", () => {
      const testItem = new Unit(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("UnitSystem, visit methods called correctly", () => {
      const testItem = new UnitSystem(schema, "TestItem");
      mockVisitor = { ...mockVisitor, visitUnitSystemSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitUnitSystemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
    });

    it("UnitSystem, no visitor, call does not error", () => {
      const testItem = new UnitSystem(schema, "TestItem");
      mockVisitor = { ...mockVisitor };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitSchemaItemSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("Property, visit methods called correctly", async () => {
      const testItem = new EntityClass(schema, "TestItem");
      const property = await (testItem as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      mockVisitor = { ...mockVisitor, visitPropertySync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(property);

      expect(mockVisitor.visitPropertySync.calledOnceWithExactly(property)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(property)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });

    it("RelationshipConstraint, visit methods called correctly", () => {
      const relationship = new RelationshipClass(schema, "TestRelationship");
      const testItem = new RelationshipConstraint(relationship, RelationshipEnd.Source);
      mockVisitor = { ...mockVisitor, visitRelationshipConstraintSync: sinon.spy() };
      helper = new SchemaPartVisitorDelegate(mockVisitor);

      helper.visitSchemaPartSync(testItem);

      expect(mockVisitor.visitRelationshipConstraintSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitCustomAttributeContainerSync.calledOnceWithExactly(testItem)).to.be.true;
      expect(mockVisitor.visitSchemaItemSync.notCalled).to.be.true;
      expect(mockVisitor.visitClassSync.notCalled).to.be.true;
    });
  });
});
