/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AnyClass } from "../../src/Interfaces";
import { Constant } from "../../src/Metadata/Constant";
import { CustomAttributeContainerProps, CustomAttribute } from "../../src/Metadata/CustomAttribute";
import { Enumeration } from "../../src/Metadata/Enumeration";
import { Format } from "../../src/Metadata/Format";
import { InvertedUnit } from "../../src/Metadata/InvertedUnit";
import { KindOfQuantity } from "../../src/Metadata/KindOfQuantity";
import { Phenomenon } from "../../src/Metadata/Phenomenon";
import { AnyProperty } from "../../src/Metadata/Property";
import { PropertyCategory } from "../../src/Metadata/PropertyCategory";
import { RelationshipClass, RelationshipConstraint } from "../../src/Metadata/RelationshipClass";
import { Schema } from "../../src/Metadata/Schema";
import { Unit } from "../../src/Metadata/Unit";
import { UnitSystem } from "../../src/Metadata/UnitSystem";
import { IDiagnosticReporter } from "../../src/Validation/DiagnosticReporter";
import * as Diagnostics from "../../src/Validation/Diagnostic";
import { IRuleSet } from "../../src/Validation/Rules";
import sinon = require("sinon");
import { SchemaItem } from "../../src/Metadata/SchemaItem";
import { EntityClass, StructClass, Mixin, CustomAttributeClass } from "../../src/ecschema-metadata";

export class TestReporter implements IDiagnosticReporter {
  public async report(_diagnostic: Diagnostics.AnyDiagnostic) {
  }
}

const ruleSetName = "TestDiagnostics";

function getCode(code: number): string {
  return ruleSetName + "-" + code;
}

// tslint:disable-next-line:variable-name
export const TestDiagnostics = {
  FailingSchemaDiagnostic: Diagnostics.createSchemaDiagnosticClass<[string, string]>(getCode(1),
    "Failed with param {0} {1}"),
  FailingSchemaItemDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<SchemaItem, [string, string]>(getCode(2),
    "Failed with param {0} {1}"),
  FailingClassDiagnostic: Diagnostics.createClassDiagnosticClass<[string, string]>(getCode(3),
    "Failed with params {0} {1}"),
  FailingPropertyDiagnostic: Diagnostics.createPropertyDiagnosticClass<[string, string]>(getCode(4),
    "Failed with param {0} {1}"),
  FailingEntityClassDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<EntityClass, [string, string]>(getCode(5),
    "Failed with params {0} {1}"),
  FailingStructClassDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<StructClass, [string, string]>(getCode(6),
    "Failed with params {0} {1}"),
  FailingMixinDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Mixin, [string, string]>(getCode(8),
    "Failed with params {0} {1}"),
  FailingRelationshipDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<RelationshipClass, [string, string]>(getCode(8),
    "Failed with param {0} {1}"),
  FailingRelationshipConstraintDiagnostic: Diagnostics.createRelationshipConstraintDiagnosticClass<[string, string]>(getCode(9),
    "Failed with param {0} {1}"),
  FailingCustomAttributeClassDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<CustomAttributeClass, [string, string]>(getCode(10),
    "Failed with param {0} {1}"),
  FailingCustomAttributeContainerDiagnostic: Diagnostics.createCustomAttributeContainerDiagnosticClass<[string, string]>(getCode(11),
    "Failed with param {0} {1}"),
  FailingEnumerationDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Enumeration, [string, string]>(getCode(12),
    "Failed with param {0} {1}"),
  FailingKindOfQuantityDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<KindOfQuantity, [string, string]>(getCode(13),
    "Failed with param {0} {1}"),
  FailingPropertyCategoryDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<PropertyCategory, [string, string]>(getCode(14),
    "Failed with param {0} {1}"),
  FailingFormatDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Format, [string, string]>(getCode(15),
    "Failed with param {0} {1}"),
  FailingUnitDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Unit, [string, string]>(getCode(16),
    "Failed with param {0} {1}"),
  FailingInvertedUnitFormatDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<InvertedUnit, [string, string]>(getCode(17),
    "Failed with param {0} {1}"),
  FailingUnitSystemDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<UnitSystem, [string, string]>(getCode(18),
    "Failed with param {0} {1}"),
  FailingPhenomenonDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Phenomenon, [string, string]>(getCode(19),
    "Failed with param {0} {1}"),
  FailingConstantDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Constant, [string, string]>(getCode(20),
    "Failed with param {0} {1}"),
};

export async function* failingSchemaRule(schema: Schema): AsyncIterable<Diagnostics.SchemaDiagnostic<[string, string]>> | undefined {
  yield new TestDiagnostics.FailingSchemaDiagnostic(schema, ["Param1", "Param2"]);
}

export async function* passingSchemaRule(_schema: Schema): AsyncIterable<Diagnostics.SchemaDiagnostic<any[]>> | undefined {
  return undefined;
}

export async function* failingSchemaItemRule(schemaItem: SchemaItem): AsyncIterable<Diagnostics.SchemaItemDiagnostic<SchemaItem, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingSchemaItemDiagnostic(schemaItem, ["Param1", "Param2"]);
}

export async function* passingSchemaItemRule(_schemaItem: SchemaItem): AsyncIterable<Diagnostics.SchemaItemDiagnostic<SchemaItem, any[]>> | undefined {
  return undefined;
}

export async function* failingClassRule(ecClass: AnyClass): AsyncIterable<Diagnostics.ClassDiagnostic<[string, string]>> | undefined {
  yield new TestDiagnostics.FailingClassDiagnostic(ecClass, ["Param1", "Param2"]);
}

export async function* passingClassRule(_ecClass: AnyClass): AsyncIterable<Diagnostics.ClassDiagnostic<any[]>> | undefined {
  return undefined;
}

export async function* failingPropertyRule(property: AnyProperty): AsyncIterable<Diagnostics.PropertyDiagnostic<[string, string]>> | undefined {
  yield new TestDiagnostics.FailingPropertyDiagnostic(property, ["Param1", "Param2"]);
}

export async function* passingPropertyRule(_relationship: RelationshipClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<RelationshipClass, any[]>> | undefined {
  return undefined;
}

export async function* failingEntityClassRule(entityClass: EntityClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<EntityClass, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingEntityClassDiagnostic(entityClass, ["Param1", "Param2"]);
}

export async function* passingEntityClassRule(_entityClass: EntityClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<EntityClass, any[]>> | undefined {
  return undefined;
}

export async function* failingStructClassRule(structClass: StructClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<StructClass, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingStructClassDiagnostic(structClass, ["Param1", "Param2"]);
}

export async function* passingStructClassRule(_structClass: StructClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<StructClass, any[]>> | undefined {
  return undefined;
}

export async function* failingMixinRule(mixin: Mixin): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Mixin, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingMixinDiagnostic(mixin, ["Param1", "Param2"]);
}

export async function* passingMixinRule(_mixin: Mixin): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Mixin, any[]>> | undefined {
  return undefined;
}

export async function* failingRelationshipRule(relationship: RelationshipClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<RelationshipClass, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingRelationshipDiagnostic(relationship, ["Param1", "Param2"]);
}

export async function* passingRelationshipRule(_relationship: RelationshipClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<RelationshipClass, any[]>> | undefined {
  return undefined;
}

export async function* failingRelationshipConstraintRule(constraint: RelationshipConstraint): AsyncIterable<Diagnostics.RelationshipConstraintDiagnostic<[string, string]>> | undefined {
  yield new TestDiagnostics.FailingRelationshipConstraintDiagnostic(constraint, ["Param1", "Param2"]);
}

export async function* passingRelationshipConstraintRule(_constraint: RelationshipConstraint): AsyncIterable<Diagnostics.RelationshipConstraintDiagnostic<any[]>> | undefined {
  return undefined;
}

export async function* failingCustomAttributeClassRule(customAttributeClass: CustomAttributeClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<CustomAttributeClass, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingCustomAttributeClassDiagnostic(customAttributeClass, ["Param1", "Param2"]);
}

export async function* passingCustomAttributeClassRule(_customAttributeClass: CustomAttributeClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<CustomAttributeClass, any[]>> | undefined {
  return undefined;
}

export async function* failingCustomAttributeContainerRule(container: CustomAttributeContainerProps): AsyncIterable<Diagnostics.CustomAttributeContainerDiagnostic<[string, string]>> | undefined {
  yield new TestDiagnostics.FailingCustomAttributeContainerDiagnostic(container, ["Param1", "Param2"]);
}

export async function* passingCustomAttributeContainerRule(_container: CustomAttributeContainerProps): AsyncIterable<Diagnostics.CustomAttributeContainerDiagnostic<any[]>> | undefined {
  return undefined;
}

export async function* failingCustomAttributeRule(container: CustomAttributeContainerProps, _customAttribute: CustomAttribute): AsyncIterable<Diagnostics.CustomAttributeContainerDiagnostic<[string, string]>> | undefined {
  yield new TestDiagnostics.FailingCustomAttributeContainerDiagnostic(container, ["Param1", "Param2"]);
}

export async function* passingCustomAttributeRule(_container: CustomAttributeContainerProps, _customAttribute: CustomAttribute): AsyncIterable<Diagnostics.CustomAttributeContainerDiagnostic<any[]>> | undefined {
  return undefined;
}

export async function* failingEnumerationRule(enumeration: Enumeration): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Enumeration, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingEnumerationDiagnostic(enumeration, ["Param1", "Param2"]);
}

export async function* passingEnumerationRule(_enumeration: Enumeration): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Enumeration, any[]>> | undefined {
  return undefined;
}

export async function* failingKindOfQuantityRule(kindOfQuantity: KindOfQuantity): AsyncIterable<Diagnostics.SchemaItemDiagnostic<KindOfQuantity, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingKindOfQuantityDiagnostic(kindOfQuantity, ["Param1", "Param2"]);
}

export async function* passingKindOfQuantityRule(_kindOfQuantity: KindOfQuantity): AsyncIterable<Diagnostics.SchemaItemDiagnostic<KindOfQuantity, any[]>> | undefined {
  return undefined;
}

export async function* failingPropertyCategoryRule(propertyCategory: PropertyCategory): AsyncIterable<Diagnostics.SchemaItemDiagnostic<PropertyCategory, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingPropertyCategoryDiagnostic(propertyCategory, ["Param1", "Param2"]);
}

export async function* passingPropertyCategoryRule(_propertyCategory: PropertyCategory): AsyncIterable<Diagnostics.SchemaItemDiagnostic<PropertyCategory, any[]>> | undefined {
  return undefined;
}

export async function* failingFormatRule(format: Format): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Format, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingFormatDiagnostic(format, ["Param1", "Param2"]);
}

export async function* passingFormatRule(_format: Format): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Format, any[]>> | undefined {
  return undefined;
}

export async function* failingUnitRule(unit: Unit): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Unit, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingUnitDiagnostic(unit, ["Param1", "Param2"]);
}

export async function* passingUnitRule(_unit: Unit): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Unit, any[]>> | undefined {
  return undefined;
}

export async function* failingInvertedUnitRule(invertedUnit: InvertedUnit): AsyncIterable<Diagnostics.SchemaItemDiagnostic<InvertedUnit, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingInvertedUnitFormatDiagnostic(invertedUnit, ["Param1", "Param2"]);
}

export async function* passingInvertedUnitRule(_invertedUnit: InvertedUnit): AsyncIterable<Diagnostics.SchemaItemDiagnostic<InvertedUnit, any[]>> | undefined {
  return undefined;
}

export async function* failingUnitSystemRule(unitSystem: UnitSystem): AsyncIterable<Diagnostics.SchemaItemDiagnostic<UnitSystem, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingUnitSystemDiagnostic(unitSystem, ["Param1", "Param2"]);
}

export async function* passingUnitSystemRule(_format: UnitSystem): AsyncIterable<Diagnostics.SchemaItemDiagnostic<UnitSystem, any[]>> | undefined {
  return undefined;
}

export async function* failingPhenomenonRule(phenomenon: Phenomenon): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Phenomenon, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingPhenomenonDiagnostic(phenomenon, ["Param1", "Param2"]);
}

export async function* passingPhenomenonRule(_phenomenon: Phenomenon): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Phenomenon, any[]>> | undefined {
  return undefined;
}

export async function* failingConstantRule(constant: Constant): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Constant, [string, string]>> | undefined {
  yield new TestDiagnostics.FailingConstantDiagnostic(constant, ["Param1", "Param2"]);
}

export async function* passingConstantRule(_constant: Constant): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Constant, any[]>> | undefined {
  return undefined;
}

export class EmptyRuleSet implements IRuleSet {
  public name: string = "EmptyRuleSet";
}

export class TestRuleSet implements IRuleSet {
  public name = "TestRuleSet";
  public schemaRules = [
    sinon.spy(failingSchemaRule),
    sinon.spy(passingSchemaRule),
  ];
  public schemaItemRules = [
    sinon.spy(failingSchemaItemRule),
    sinon.spy(passingSchemaItemRule),
  ];
  public classRules = [
    sinon.spy(failingClassRule),
    sinon.spy(passingClassRule),
  ];
  public propertyRules = [
    sinon.spy(failingPropertyRule),
    sinon.spy(passingPropertyRule),
  ];
  public entityClassRules = [
    sinon.spy(failingEntityClassRule),
    sinon.spy(passingEntityClassRule),
  ];
  public structClassRules = [
    sinon.spy(failingStructClassRule),
    sinon.spy(passingStructClassRule),
  ];
  public mixinRules = [
    sinon.spy(failingMixinRule),
    sinon.spy(passingMixinRule),
  ];
  public relationshipRules = [
    sinon.spy(failingRelationshipRule),
    sinon.spy(passingRelationshipRule),
  ];
  public relationshipConstraintRules = [
    sinon.spy(failingRelationshipConstraintRule),
    sinon.spy(passingRelationshipConstraintRule),
  ];
  public customAttributeClassRules = [
    sinon.spy(failingCustomAttributeClassRule),
    sinon.spy(passingCustomAttributeClassRule),
  ];
  public customAttributeContainerRules = [
    sinon.spy(failingCustomAttributeContainerRule),
    sinon.spy(passingCustomAttributeContainerRule),
  ];
  public customAttributeInstanceRules = [
    sinon.spy(failingCustomAttributeRule),
    sinon.spy(passingCustomAttributeRule),
  ];
  public enumerationRules = [
    sinon.spy(failingEnumerationRule),
    sinon.spy(passingEnumerationRule),
  ];
  public kindOfQuantityRules = [
    sinon.spy(failingKindOfQuantityRule),
    sinon.spy(passingKindOfQuantityRule),
  ];
  public propertyCategoryRules = [
    sinon.spy(failingPropertyCategoryRule),
    sinon.spy(passingPropertyCategoryRule),
  ];
  public formatRules = [
    sinon.spy(failingFormatRule),
    sinon.spy(passingFormatRule),
  ];
  public unitRules = [
    sinon.spy(failingUnitRule),
    sinon.spy(passingUnitRule),
  ];
  public invertedUnitRules = [
    sinon.spy(failingInvertedUnitRule),
    sinon.spy(passingInvertedUnitRule),
  ];
  public unitSystemRules = [
    sinon.spy(failingUnitSystemRule),
    sinon.spy(passingUnitSystemRule),
  ];
  public phenomenonRules = [
    sinon.spy(failingPhenomenonRule),
    sinon.spy(passingPhenomenonRule),
  ];
  public constantRules = [
    sinon.spy(failingConstantRule),
    sinon.spy(passingConstantRule),
  ];
}

export class TestRuleSetB implements IRuleSet {
  public name = "TestRuleSetB";

  public schemaRules = [
    sinon.spy(failingSchemaRule),
    sinon.spy(passingSchemaRule),
  ];
  public schemaItemRules = [
    sinon.spy(failingSchemaItemRule),
    sinon.spy(passingSchemaItemRule),
  ];
  public classRules = [
    sinon.spy(failingClassRule),
    sinon.spy(passingClassRule),
  ];
  public propertyRules = [
    sinon.spy(failingPropertyRule),
    sinon.spy(passingPropertyRule),
  ];
  public entityClassRules = [
    sinon.spy(failingEntityClassRule),
    sinon.spy(passingEntityClassRule),
  ];
  public structClassRules = [
    sinon.spy(failingStructClassRule),
    sinon.spy(passingStructClassRule),
  ];
  public mixinRules = [
    sinon.spy(failingMixinRule),
    sinon.spy(passingMixinRule),
  ];
  public relationshipRules = [
    sinon.spy(failingRelationshipRule),
    sinon.spy(passingRelationshipRule),
  ];
  public customAttributeClassRules = [
    sinon.spy(failingCustomAttributeClassRule),
    sinon.spy(passingCustomAttributeClassRule),
  ];
  public relationshipConstraintRules = [
    sinon.spy(failingRelationshipConstraintRule),
    sinon.spy(passingRelationshipConstraintRule),
  ];
  public customAttributeContainerRules = [
    sinon.spy(failingCustomAttributeContainerRule),
    sinon.spy(passingCustomAttributeContainerRule),
  ];
  public customAttributeRules = [
    sinon.spy(failingCustomAttributeRule),
    sinon.spy(passingCustomAttributeRule),
  ];
  public enumerationRules = [
    sinon.spy(failingEnumerationRule),
    sinon.spy(passingEnumerationRule),
  ];
  public kindOfQuantityRules = [
    sinon.spy(failingKindOfQuantityRule),
    sinon.spy(passingKindOfQuantityRule),
  ];
  public propertyCategoryRules = [
    sinon.spy(failingPropertyCategoryRule),
    sinon.spy(passingPropertyCategoryRule),
  ];
  public formatRules = [
    sinon.spy(failingFormatRule),
    sinon.spy(passingFormatRule),
  ];
  public unitRules = [
    sinon.spy(failingUnitRule),
    sinon.spy(passingUnitRule),
  ];
  public invertedUnitRules = [
    sinon.spy(failingInvertedUnitRule),
    sinon.spy(passingInvertedUnitRule),
  ];
  public unitSystemRules = [
    sinon.spy(failingUnitSystemRule),
    sinon.spy(passingUnitSystemRule),
  ];
  public phenomenonRules = [
    sinon.spy(failingPhenomenonRule),
    sinon.spy(passingPhenomenonRule),
  ];
  public constantRules = [
    sinon.spy(failingConstantRule),
    sinon.spy(passingConstantRule),
  ];
}

export class PassingRuleSet implements IRuleSet {
  public name = "PassingRuleSet";
  public schemaRules = [
    sinon.spy(passingSchemaRule),
  ];
  public schemaItemRules = [
    sinon.spy(passingSchemaItemRule),
  ];
  public classRules = [
    sinon.spy(passingClassRule),
  ];
  public propertyRules = [
    sinon.spy(passingPropertyRule),
  ];
  public entityClassRules = [
    sinon.spy(passingEntityClassRule),
  ];
  public structClassRules = [
    sinon.spy(passingStructClassRule),
  ];
  public mixinRules = [
    sinon.spy(passingMixinRule),
  ];
  public relationshipRules = [
    sinon.spy(passingRelationshipRule),
  ];
  public relationshipConstraintRules = [
    sinon.spy(passingRelationshipConstraintRule),
  ];
  public customAttributeClassRules = [
    sinon.spy(passingCustomAttributeClassRule),
  ];
  public customAttributeContainerRules = [
    sinon.spy(passingCustomAttributeContainerRule),
  ];
  public customAttributeInstanceRules = [
    sinon.spy(passingCustomAttributeRule),
  ];
  public enumerationRules = [
    sinon.spy(passingEnumerationRule),
  ];
  public kindOfQuantityRules = [
    sinon.spy(passingKindOfQuantityRule),
  ];
  public propertyCategoryRules = [
    sinon.spy(passingPropertyCategoryRule),
  ];
  public formatRules = [
    sinon.spy(passingFormatRule),
  ];
  public unitRules = [
    sinon.spy(passingUnitRule),
  ];
  public invertedUnitRules = [
    sinon.spy(passingInvertedUnitRule),
  ];
  public unitSystemRules = [
    sinon.spy(passingUnitSystemRule),
  ];
  public phenomenonRules = [
    sinon.spy(passingPhenomenonRule),
  ];
  public constantRules = [
    sinon.spy(passingConstantRule),
  ];
}
