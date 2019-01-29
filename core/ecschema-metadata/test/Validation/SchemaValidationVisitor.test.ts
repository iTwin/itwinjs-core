/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon = require("sinon");

import { SchemaContext } from "../../src/Context";
import { PrimitiveType, RelationshipEnd } from "../../src/ECObjects";
import { ECClass, MutableClass, StructClass } from "../../src/Metadata/Class";
import { Constant } from "../../src/Metadata/Constant";
import { EntityClass } from "../../src/Metadata/EntityClass";
import { Enumeration } from "../../src/Metadata/Enumeration";
import { Format } from "../../src/Metadata/Format";
import { InvertedUnit } from "../../src/Metadata/InvertedUnit";
import { KindOfQuantity } from "../../src/Metadata/KindOfQuantity";
import { Mixin } from "../../src/Metadata/Mixin";
import { Phenomenon } from "../../src/Metadata/Phenomenon";
import { AnyProperty, MutableProperty } from "../../src/Metadata/Property";
import { PropertyCategory } from "../../src/Metadata/PropertyCategory";
import { RelationshipClass, RelationshipConstraint } from "../../src/Metadata/RelationshipClass";
import { Schema } from "../../src/Metadata/Schema";
import { Unit } from "../../src/Metadata/Unit";
import { UnitSystem } from "../../src/Metadata/UnitSystem";
import { SchemaValidationVisitor } from "../../src/Validation/SchemaValidationVisitor";
import { TESTDIAGNOSTICS, TestReporter, TestRuleSet, TestRuleSetB } from "../TestUtils/DiagnosticHelpers";

describe("SchemaValidationVisitor tests", () => {
  let visitor: SchemaValidationVisitor;
  let schema: Schema;

  beforeEach(async () => {
    visitor = new SchemaValidationVisitor();
    schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("registerRuleSet, rule sets registered properly", async () => {
    const testRuleSet = new TestRuleSet();
    visitor.registerRuleSet(testRuleSet);

    const testRuleSetB = new TestRuleSetB();
    visitor.registerRuleSet(testRuleSetB);

    expect(visitor.ruleSets[testRuleSet.name]).to.be.not.undefined;
    expect(visitor.ruleSets[testRuleSetB.name]).to.be.not.undefined;
  });

  it("registerRuleSet, rule set already registered, throws", async () => {
    const testRuleSet = new TestRuleSet();
    visitor.registerRuleSet(testRuleSet);

    expect(() => visitor.registerRuleSet(testRuleSet)).to.throw(Error, `A RuleSet with the name '${testRuleSet.name}' has already been registered.`);
  });

  it("registerReporter, reporter registered properly", async () => {
    expect(visitor.diagnosticReporters.length).to.equal(0);
    const reporter = new TestReporter();

    visitor.registerReporter(reporter);

    expect(visitor.diagnosticReporters.length).to.equal(1);
    expect(visitor.diagnosticReporters[0]).to.equal(reporter);
  });

  describe("visitSchema tests", () => {
    it("calls rules properly", async () => {
      const ruleSetA = new TestRuleSet();
      const ruleSetB = new TestRuleSetB();
      visitor.registerRuleSet(ruleSetA);
      visitor.registerRuleSet(ruleSetB);
      const testSchema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);

      await visitor.visitFullSchema(testSchema);

      ruleSetA.schemaRules.forEach((spy) => expect(spy.calledOnceWithExactly(schema)).to.be.true);
      ruleSetB.schemaRules.forEach((spy) => expect(spy.calledOnceWithExactly(schema)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const testSchema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);

      await visitor.visitFullSchema(testSchema);

      const diagnostic = new TESTDIAGNOSTICS.FailingSchemaDiagnostic(schema, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitSchemaItem tests", () => {
    it("calls rules properly", async () => {
      const ruleSetA = new TestRuleSet();
      const ruleSetB = new TestRuleSetB();
      visitor.registerRuleSet(ruleSetA);
      visitor.registerRuleSet(ruleSetB);
      const schemaItem = new EntityClass(schema, "TestClass");

      await visitor.visitSchemaItem(schemaItem);

      ruleSetA.schemaItemRules.forEach((spy) => expect(spy.calledOnceWithExactly(schemaItem)).to.be.true);
      ruleSetB.schemaItemRules.forEach((spy) => expect(spy.calledOnceWithExactly(schemaItem)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const schemaItem = new EntityClass(schema, "TestClass");

      await visitor.visitSchemaItem(schemaItem);

      const diagnostic = new TESTDIAGNOSTICS.FailingSchemaItemDiagnostic(schemaItem, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitClass tests", () => {
    it("calls class rules properly", async () => {
      const ruleSetA = new TestRuleSet();
      const ruleSetB = new TestRuleSetB();
      visitor.registerRuleSet(ruleSetA);
      visitor.registerRuleSet(ruleSetB);
      const entityClass = new EntityClass(schema, "TestClass");

      await visitor.visitClass(entityClass);

      ruleSetA.classRules.forEach((spy) => expect(spy.calledOnceWithExactly(entityClass)).to.be.true);
      ruleSetB.classRules.forEach((spy) => expect(spy.calledOnceWithExactly(entityClass)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const entityClass = new EntityClass(schema, "TestClass");

      await visitor.visitClass(entityClass);

      const diagnostic = new TESTDIAGNOSTICS.FailingClassDiagnostic(entityClass, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitProperty tests", () => {
    it("calls property rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const entityClass = new EntityClass(schema, "TestClass");
      await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestPropertyA", PrimitiveType.String);

      await visitor.visitProperty(entityClass.properties![0] as AnyProperty);

      ruleSet.propertyRules.forEach((spy) => expect(spy.calledOnceWithExactly(entityClass.properties![0])).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const entityClass = new EntityClass(schema, "TestClass");
      await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestPropertyA", PrimitiveType.String);

      await visitor.visitProperty(entityClass.properties![0] as AnyProperty);

      const diagnostic = new TESTDIAGNOSTICS.FailingPropertyDiagnostic(entityClass.properties![0] as AnyProperty, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitEntityClass tests", () => {
    it("calls rules properly", async () => {
      const ruleSetA = new TestRuleSet();
      const ruleSetB = new TestRuleSetB();
      visitor.registerRuleSet(ruleSetA);
      visitor.registerRuleSet(ruleSetB);
      const entity = new EntityClass(schema, "TestClass");

      await visitor.visitEntityClass(entity);

      ruleSetA.entityClassRules.forEach((spy) => expect(spy.calledOnceWithExactly(entity)).to.be.true);
      ruleSetB.entityClassRules.forEach((spy) => expect(spy.calledOnceWithExactly(entity)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const entity = new EntityClass(schema, "TestClass");

      await visitor.visitEntityClass(entity);

      const diagnostic = new TESTDIAGNOSTICS.FailingEntityClassDiagnostic(entity, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitStructClass tests", () => {
    it("calls rules properly", async () => {
      const ruleSetA = new TestRuleSet();
      const ruleSetB = new TestRuleSetB();
      visitor.registerRuleSet(ruleSetA);
      visitor.registerRuleSet(ruleSetB);
      const struct = new StructClass(schema, "TestClass");

      await visitor.visitStructClass(struct);

      ruleSetA.structClassRules.forEach((spy) => expect(spy.calledOnceWithExactly(struct)).to.be.true);
      ruleSetB.structClassRules.forEach((spy) => expect(spy.calledOnceWithExactly(struct)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const struct = new StructClass(schema, "TestClass");

      await visitor.visitStructClass(struct);

      const diagnostic = new TESTDIAGNOSTICS.FailingStructClassDiagnostic(struct, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitMixin tests", () => {
    it("calls rules properly", async () => {
      const ruleSetA = new TestRuleSet();
      const ruleSetB = new TestRuleSetB();
      visitor.registerRuleSet(ruleSetA);
      visitor.registerRuleSet(ruleSetB);
      const mixin = new Mixin(schema, "TestClass");

      await visitor.visitMixin(mixin);

      ruleSetA.mixinRules.forEach((spy) => expect(spy.calledOnceWithExactly(mixin)).to.be.true);
      ruleSetB.mixinRules.forEach((spy) => expect(spy.calledOnceWithExactly(mixin)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const mixin = new Mixin(schema, "TestClass");

      await visitor.visitMixin(mixin);

      const diagnostic = new TESTDIAGNOSTICS.FailingMixinDiagnostic(mixin, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitRelationshipClass tests", () => {
    it("calls relationship rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const relationshipClass = new RelationshipClass(schema, "TestClass");

      await visitor.visitRelationshipClass(relationshipClass);

      ruleSet.relationshipRules.forEach((spy) => expect(spy.calledOnceWithExactly(relationshipClass)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const relationship = new RelationshipClass(schema, "TestClass");

      await visitor.visitRelationshipClass(relationship);

      const diagnostic = new TESTDIAGNOSTICS.FailingRelationshipDiagnostic(relationship, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitRelationshipConstraint tests", () => {
    it("calls relationship constraint rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const relationshipClass = new RelationshipClass(schema, "TestClass");
      const constraint = new RelationshipConstraint(relationshipClass, RelationshipEnd.Source);

      await visitor.visitRelationshipConstraint(constraint);

      ruleSet.relationshipConstraintRules.forEach((spy) => expect(spy.calledOnceWithExactly(constraint)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const relationship = new RelationshipClass(schema, "TestClass");
      const constraint = new RelationshipConstraint(relationship, RelationshipEnd.Source);

      await visitor.visitRelationshipConstraint(constraint);

      const diagnostic = new TESTDIAGNOSTICS.FailingRelationshipConstraintDiagnostic(constraint, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitCustomAttributeContainerTests tests", () => {
    it("EntityClass, calls CustomAttributeContainer and CustomAttribute rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const entityClass = new EntityClass(schema, "TestClass");
      (entityClass as unknown as MutableClass).addCustomAttribute({ className: "TestSchema.TestCA" });

      await visitor.visitCustomAttributeContainer(entityClass);

      ruleSet.customAttributeContainerRules.forEach((spy) => expect(spy.calledOnceWithExactly(entityClass)).to.be.true);
      ruleSet.customAttributeInstanceRules.forEach((spy) => expect(spy.calledOnceWithExactly(entityClass, entityClass.customAttributes!.get("TestSchema.TestCA"))).to.be.true);
    });

    it("Property, calls CustomAttributeContainer rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const entityClass = new EntityClass(schema, "TestClass");
      const property = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestPropertyA", PrimitiveType.String);
      (property as unknown as MutableProperty).addCustomAttribute({ className: "TestSchema.TestCA" });

      await visitor.visitCustomAttributeContainer(entityClass.properties![0] as AnyProperty);

      ruleSet.customAttributeContainerRules.forEach((spy) => expect(spy.calledOnceWithExactly(entityClass.properties![0])).to.be.true);
      ruleSet.customAttributeInstanceRules.forEach((spy) => expect(spy.calledOnceWithExactly(entityClass.properties![0], property.customAttributes!.get("TestSchema.TestCA"))).to.be.true);
    });

    it("RelationshipClass, calls CustomAttributeContainer rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const relationshipClass = new RelationshipClass(schema, "TestClass");
      (relationshipClass as unknown as MutableClass).addCustomAttribute({ className: "TestSchema.TestCA" });

      await visitor.visitCustomAttributeContainer(relationshipClass);

      ruleSet.customAttributeContainerRules.forEach((spy) => expect(spy.calledOnceWithExactly(relationshipClass)).to.be.true);
      ruleSet.customAttributeInstanceRules.forEach((spy) => expect(spy.calledOnceWithExactly(relationshipClass, relationshipClass.customAttributes!.get("TestSchema.TestCA"))).to.be.true);
    });

    it("RelationshipConstraint, calls CustomAttributeContainer rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const relationshipClass = new RelationshipClass(schema, "TestClass");
      const constraint = new RelationshipConstraint(relationshipClass, RelationshipEnd.Source);
      (constraint as unknown as MutableClass).addCustomAttribute({ className: "TestSchema.TestCA" });

      await visitor.visitCustomAttributeContainer(constraint);

      ruleSet.customAttributeContainerRules.forEach((spy) => expect(spy.calledOnceWithExactly(constraint)).to.be.true);
      ruleSet.customAttributeInstanceRules.forEach((spy) => expect(spy.calledOnceWithExactly(constraint, constraint.customAttributes!.get("TestSchema.TestCA"))).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const entityClass = new EntityClass(schema, "TestClass");
      (entityClass as unknown as MutableClass).addCustomAttribute({ className: "TestSchema.TestCA" });

      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);

      await visitor.visitCustomAttributeContainer(entityClass);

      const diagnostic = new TESTDIAGNOSTICS.FailingCustomAttributeContainerDiagnostic(entityClass, ["Param1", "Param2"]);
      expect(reportSpy.calledTwice).to.be.true;
      expect(reportSpy.calledWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitEnumeration tests", () => {
    it("calls rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const enumeration = new Enumeration(schema, "TestClass");

      await visitor.visitEnumeration(enumeration);

      ruleSet.enumerationRules.forEach((spy) => expect(spy.calledOnceWithExactly(enumeration)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const enumeration = new Enumeration(schema, "TestClass");

      await visitor.visitEnumeration(enumeration);

      const diagnostic = new TESTDIAGNOSTICS.FailingEnumerationDiagnostic(enumeration, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitKindOfQuantity tests", () => {
    it("calls rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const koq = new KindOfQuantity(schema, "TestClass");

      await visitor.visitKindOfQuantity(koq);

      ruleSet.kindOfQuantityRules.forEach((spy) => expect(spy.calledOnceWithExactly(koq)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const koq = new KindOfQuantity(schema, "TestClass");

      await visitor.visitKindOfQuantity(koq);

      const diagnostic = new TESTDIAGNOSTICS.FailingKindOfQuantityDiagnostic(koq, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitPropertyCategory tests", () => {
    it("calls rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const category = new PropertyCategory(schema, "TestClass");

      await visitor.visitPropertyCategory(category);

      ruleSet.propertyCategoryRules.forEach((spy) => expect(spy.calledOnceWithExactly(category)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const category = new PropertyCategory(schema, "TestClass");

      await visitor.visitPropertyCategory(category);

      const diagnostic = new TESTDIAGNOSTICS.FailingPropertyCategoryDiagnostic(category, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitFormat tests", () => {
    it("calls rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const format = new Format(schema, "TestClass");

      await visitor.visitFormat(format);

      ruleSet.formatRules.forEach((spy) => expect(spy.calledOnceWithExactly(format)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const format = new Format(schema, "TestClass");

      await visitor.visitFormat(format);

      const diagnostic = new TESTDIAGNOSTICS.FailingFormatDiagnostic(format, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitUnit tests", () => {
    it("calls rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const unit = new Unit(schema, "TestClass");

      await visitor.visitUnit(unit);

      ruleSet.unitRules.forEach((spy) => expect(spy.calledOnceWithExactly(unit)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const unit = new Unit(schema, "TestClass");

      await visitor.visitUnit(unit);

      const diagnostic = new TESTDIAGNOSTICS.FailingUnitDiagnostic(unit, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitInvertedUnit tests", () => {
    it("calls rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const invertedUnit = new InvertedUnit(schema, "TestClass");

      await visitor.visitInvertedUnit(invertedUnit);

      ruleSet.invertedUnitRules.forEach((spy) => expect(spy.calledOnceWithExactly(invertedUnit)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const invertedUnit = new InvertedUnit(schema, "TestClass");

      await visitor.visitInvertedUnit(invertedUnit);

      const diagnostic = new TESTDIAGNOSTICS.FailingInvertedUnitFormatDiagnostic(invertedUnit, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitUnitSystem tests", () => {
    it("calls rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const unitSystem = new UnitSystem(schema, "TestClass");

      await visitor.visitUnitSystem(unitSystem);

      ruleSet.unitSystemRules.forEach((spy) => expect(spy.calledOnceWithExactly(unitSystem)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const unitSystem = new UnitSystem(schema, "TestClass");

      await visitor.visitUnitSystem(unitSystem);

      const diagnostic = new TESTDIAGNOSTICS.FailingUnitSystemDiagnostic(unitSystem, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitPhenomenon tests", () => {
    it("calls rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const phenomenon = new Phenomenon(schema, "TestClass");

      await visitor.visitPhenomenon(phenomenon);

      ruleSet.phenomenonRules.forEach((spy) => expect(spy.calledOnceWithExactly(phenomenon)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const phenomenon = new Phenomenon(schema, "TestClass");

      await visitor.visitPhenomenon(phenomenon);

      const diagnostic = new TESTDIAGNOSTICS.FailingPhenomenonDiagnostic(phenomenon, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });

  describe("visitConstant tests", () => {
    it("calls rules properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const constant = new Constant(schema, "TestClass");

      await visitor.visitConstant(constant);

      ruleSet.constantRules.forEach((spy) => expect(spy.calledOnceWithExactly(constant)).to.be.true);
    });

    it("failing rules, reporter called properly", async () => {
      const ruleSet = new TestRuleSet();
      visitor.registerRuleSet(ruleSet);
      const reporter = new TestReporter();
      const reportSpy = sinon.spy(reporter, "report");
      visitor.registerReporter(reporter);
      const constant = new Constant(schema, "TestClass");

      await visitor.visitConstant(constant);

      const diagnostic = new TESTDIAGNOSTICS.FailingConstantDiagnostic(constant, ["Param1", "Param2"]);
      expect(reportSpy.calledOnceWithExactly(diagnostic)).to.be.true;
    });
  });
});
