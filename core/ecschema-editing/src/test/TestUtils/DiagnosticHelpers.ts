/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import type { AnyClass, AnyProperty, Constant, CustomAttribute, CustomAttributeClass, CustomAttributeContainerProps, EntityClass,
  Enumeration, Format, InvertedUnit, KindOfQuantity, Mixin, Phenomenon, PropertyCategory,
  RelationshipClass, RelationshipConstraint, Schema, SchemaItem, StructClass, Unit, UnitSystem,
} from "@itwin/ecschema-metadata";
import * as Diagnostics from "../../Validation/Diagnostic";
import type { IDiagnosticReporter } from "../../Validation/DiagnosticReporter";
import type { IRuleSet } from "../../Validation/Rules";
import type { IRuleSuppressionSet } from "../../Validation/RuleSuppressionSet";

/* eslint-disable @typescript-eslint/naming-convention */

export class TestReporter implements IDiagnosticReporter {
  public async report(_diagnostic: Diagnostics.AnyDiagnostic) {
  }
}

const ruleSetName = "TestDiagnostics";

function getCode(code: number): string {
  return `${ruleSetName}-${code}`;
}

export const TestDiagnosticCodes = {
  FailingSchemaDiagnostic: getCode(1),
  FailingSchemaItemDiagnostic: getCode(2),
  FailingClassDiagnostic: getCode(3),
  FailingPropertyDiagnostic: getCode(4),
  FailingEntityClassDiagnostic: getCode(5),
  FailingStructClassDiagnostic: getCode(6),
  FailingMixinDiagnostic: getCode(7),
  FailingRelationshipDiagnostic: getCode(8),
  FailingRelationshipConstraintDiagnostic: getCode(9),
  FailingCustomAttributeClassDiagnostic: getCode(10),
  FailingCustomAttributeContainerDiagnostic: getCode(11),
  FailingEnumerationDiagnostic: getCode(12),
  FailingKindOfQuantityDiagnostic: getCode(13),
  FailingPropertyCategoryDiagnostic: getCode(14),
  FailingFormatDiagnostic: getCode(15),
  FailingUnitDiagnostic: getCode(16),
  FailingInvertedUnitFormatDiagnostic: getCode(17),
  FailingUnitSystemDiagnostic: getCode(18),
  FailingPhenomenonDiagnostic: getCode(19),
  FailingConstantDiagnostic: getCode(20),
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const TestDiagnostics = {
  FailingSchemaDiagnostic: Diagnostics.createSchemaDiagnosticClass<[string, string]>(TestDiagnosticCodes.FailingSchemaDiagnostic,
    "Failed with param {0} {1}"),
  FailingSchemaItemDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<SchemaItem, [string, string]>(TestDiagnosticCodes.FailingSchemaItemDiagnostic,
    "Failed with param {0} {1}"),
  FailingClassDiagnostic: Diagnostics.createClassDiagnosticClass<[string, string]>(TestDiagnosticCodes.FailingClassDiagnostic,
    "Failed with params {0} {1}"),
  FailingPropertyDiagnostic: Diagnostics.createPropertyDiagnosticClass<[string, string]>(TestDiagnosticCodes.FailingPropertyDiagnostic,
    "Failed with param {0} {1}"),
  FailingEntityClassDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<EntityClass, [string, string]>(TestDiagnosticCodes.FailingEntityClassDiagnostic,
    "Failed with params {0} {1}"),
  FailingStructClassDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<StructClass, [string, string]>(TestDiagnosticCodes.FailingStructClassDiagnostic,
    "Failed with params {0} {1}"),
  FailingMixinDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Mixin, [string, string]>(TestDiagnosticCodes.FailingMixinDiagnostic,
    "Failed with params {0} {1}"),
  FailingRelationshipDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<RelationshipClass, [string, string]>(TestDiagnosticCodes.FailingRelationshipDiagnostic,
    "Failed with param {0} {1}"),
  FailingRelationshipConstraintDiagnostic: Diagnostics.createRelationshipConstraintDiagnosticClass<[string, string]>(TestDiagnosticCodes.FailingRelationshipConstraintDiagnostic,
    "Failed with param {0} {1}"),
  FailingCustomAttributeClassDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<CustomAttributeClass, [string, string]>(TestDiagnosticCodes.FailingCustomAttributeClassDiagnostic,
    "Failed with param {0} {1}"),
  FailingCustomAttributeContainerDiagnostic: Diagnostics.createCustomAttributeContainerDiagnosticClass<[string, string]>(TestDiagnosticCodes.FailingCustomAttributeContainerDiagnostic,
    "Failed with param {0} {1}"),
  FailingEnumerationDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Enumeration, [string, string]>(TestDiagnosticCodes.FailingEnumerationDiagnostic,
    "Failed with param {0} {1}"),
  FailingKindOfQuantityDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<KindOfQuantity, [string, string]>(TestDiagnosticCodes.FailingKindOfQuantityDiagnostic,
    "Failed with param {0} {1}"),
  FailingPropertyCategoryDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<PropertyCategory, [string, string]>(TestDiagnosticCodes.FailingPropertyCategoryDiagnostic,
    "Failed with param {0} {1}"),
  FailingFormatDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Format, [string, string]>(TestDiagnosticCodes.FailingFormatDiagnostic,
    "Failed with param {0} {1}"),
  FailingUnitDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Unit, [string, string]>(TestDiagnosticCodes.FailingUnitDiagnostic,
    "Failed with param {0} {1}"),
  FailingInvertedUnitFormatDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<InvertedUnit, [string, string]>(TestDiagnosticCodes.FailingInvertedUnitFormatDiagnostic,
    "Failed with param {0} {1}"),
  FailingUnitSystemDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<UnitSystem, [string, string]>(TestDiagnosticCodes.FailingUnitSystemDiagnostic,
    "Failed with param {0} {1}"),
  FailingPhenomenonDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Phenomenon, [string, string]>(TestDiagnosticCodes.FailingPhenomenonDiagnostic,
    "Failed with param {0} {1}"),
  FailingConstantDiagnostic: Diagnostics.createSchemaItemDiagnosticClass<Constant, [string, string]>(TestDiagnosticCodes.FailingConstantDiagnostic,
    "Failed with param {0} {1}"),
};

export async function* failingSchemaRule(schema: Schema): AsyncIterable<Diagnostics.SchemaDiagnostic<[string, string]>> {
  yield new TestDiagnostics.FailingSchemaDiagnostic(schema, ["Param1", "Param2"]);
}

export async function* passingSchemaRule(_schema: Schema): AsyncIterable<Diagnostics.SchemaDiagnostic<any[]>> {
  return undefined;
}

export async function* failingSchemaItemRule(schemaItem: SchemaItem): AsyncIterable<Diagnostics.SchemaItemDiagnostic<SchemaItem, [string, string]>> {
  yield new TestDiagnostics.FailingSchemaItemDiagnostic(schemaItem, ["Param1", "Param2"]);
}

export async function* passingSchemaItemRule(_schemaItem: SchemaItem): AsyncIterable<Diagnostics.SchemaItemDiagnostic<SchemaItem, any[]>> {
  return undefined;
}

export async function* failingClassRule(ecClass: AnyClass): AsyncIterable<Diagnostics.ClassDiagnostic<[string, string]>> {
  yield new TestDiagnostics.FailingClassDiagnostic(ecClass, ["Param1", "Param2"]);
}

export async function* passingClassRule(_ecClass: AnyClass): AsyncIterable<Diagnostics.ClassDiagnostic<any[]>> {
  return undefined;
}

export async function* failingPropertyRule(property: AnyProperty): AsyncIterable<Diagnostics.PropertyDiagnostic<[string, string]>> {
  yield new TestDiagnostics.FailingPropertyDiagnostic(property, ["Param1", "Param2"]);
}

export async function* passingPropertyRule(_property: AnyProperty): AsyncIterable<Diagnostics.PropertyDiagnostic<any[]>> {
  return undefined;
}

export async function* failingEntityClassRule(entityClass: EntityClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<EntityClass, [string, string]>> {
  yield new TestDiagnostics.FailingEntityClassDiagnostic(entityClass, ["Param1", "Param2"]);
}

export async function* passingEntityClassRule(_entityClass: EntityClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<EntityClass, any[]>> {
  return undefined;
}

export async function* failingStructClassRule(structClass: StructClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<StructClass, [string, string]>> {
  yield new TestDiagnostics.FailingStructClassDiagnostic(structClass, ["Param1", "Param2"]);
}

export async function* passingStructClassRule(_structClass: StructClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<StructClass, any[]>> {
  return undefined;
}

export async function* failingMixinRule(mixin: Mixin): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Mixin, [string, string]>> {
  yield new TestDiagnostics.FailingMixinDiagnostic(mixin, ["Param1", "Param2"]);
}

export async function* passingMixinRule(_mixin: Mixin): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Mixin, any[]>> {
  return undefined;
}

export async function* failingRelationshipRule(relationship: RelationshipClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<RelationshipClass, [string, string]>> {
  yield new TestDiagnostics.FailingRelationshipDiagnostic(relationship, ["Param1", "Param2"]);
}

export async function* passingRelationshipRule(_relationship: RelationshipClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<RelationshipClass, any[]>> {
  return undefined;
}

export async function* failingRelationshipConstraintRule(constraint: RelationshipConstraint): AsyncIterable<Diagnostics.RelationshipConstraintDiagnostic<[string, string]>> {
  yield new TestDiagnostics.FailingRelationshipConstraintDiagnostic(constraint, ["Param1", "Param2"]);
}

export async function* passingRelationshipConstraintRule(_constraint: RelationshipConstraint): AsyncIterable<Diagnostics.RelationshipConstraintDiagnostic<any[]>> {
  return undefined;
}

export async function* failingCustomAttributeClassRule(customAttributeClass: CustomAttributeClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<CustomAttributeClass, [string, string]>> {
  yield new TestDiagnostics.FailingCustomAttributeClassDiagnostic(customAttributeClass, ["Param1", "Param2"]);
}

export async function* passingCustomAttributeClassRule(_customAttributeClass: CustomAttributeClass): AsyncIterable<Diagnostics.SchemaItemDiagnostic<CustomAttributeClass, any[]>> {
  return undefined;
}

export async function* failingCustomAttributeContainerRule(container: CustomAttributeContainerProps): AsyncIterable<Diagnostics.CustomAttributeContainerDiagnostic<[string, string]>> {
  yield new TestDiagnostics.FailingCustomAttributeContainerDiagnostic(container, ["Param1", "Param2"]);
}

export async function* passingCustomAttributeContainerRule(_container: CustomAttributeContainerProps): AsyncIterable<Diagnostics.CustomAttributeContainerDiagnostic<any[]>> {
  return undefined;
}

export async function* failingCustomAttributeRule(container: CustomAttributeContainerProps, _customAttribute: CustomAttribute): AsyncIterable<Diagnostics.CustomAttributeContainerDiagnostic<[string, string]>> {
  yield new TestDiagnostics.FailingCustomAttributeContainerDiagnostic(container, ["Param1", "Param2"]);
}

export async function* passingCustomAttributeRule(_container: CustomAttributeContainerProps, _customAttribute: CustomAttribute): AsyncIterable<Diagnostics.CustomAttributeContainerDiagnostic<any[]>> {
  return undefined;
}

export async function* failingEnumerationRule(enumeration: Enumeration): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Enumeration, [string, string]>> {
  yield new TestDiagnostics.FailingEnumerationDiagnostic(enumeration, ["Param1", "Param2"]);
}

export async function* passingEnumerationRule(_enumeration: Enumeration): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Enumeration, any[]>> {
  return undefined;
}

export async function* failingKindOfQuantityRule(kindOfQuantity: KindOfQuantity): AsyncIterable<Diagnostics.SchemaItemDiagnostic<KindOfQuantity, [string, string]>> {
  yield new TestDiagnostics.FailingKindOfQuantityDiagnostic(kindOfQuantity, ["Param1", "Param2"]);
}

export async function* passingKindOfQuantityRule(_kindOfQuantity: KindOfQuantity): AsyncIterable<Diagnostics.SchemaItemDiagnostic<KindOfQuantity, any[]>> {
  return undefined;
}

export async function* failingPropertyCategoryRule(propertyCategory: PropertyCategory): AsyncIterable<Diagnostics.SchemaItemDiagnostic<PropertyCategory, [string, string]>> {
  yield new TestDiagnostics.FailingPropertyCategoryDiagnostic(propertyCategory, ["Param1", "Param2"]);
}

export async function* passingPropertyCategoryRule(_propertyCategory: PropertyCategory): AsyncIterable<Diagnostics.SchemaItemDiagnostic<PropertyCategory, any[]>> {
  return undefined;
}

export async function* failingFormatRule(format: Format): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Format, [string, string]>> {
  yield new TestDiagnostics.FailingFormatDiagnostic(format, ["Param1", "Param2"]);
}

export async function* passingFormatRule(_format: Format): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Format, any[]>> {
  return undefined;
}

export async function* failingUnitRule(unit: Unit): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Unit, [string, string]>> {
  yield new TestDiagnostics.FailingUnitDiagnostic(unit, ["Param1", "Param2"]);
}

export async function* passingUnitRule(_unit: Unit): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Unit, any[]>> {
  return undefined;
}

export async function* failingInvertedUnitRule(invertedUnit: InvertedUnit): AsyncIterable<Diagnostics.SchemaItemDiagnostic<InvertedUnit, [string, string]>> {
  yield new TestDiagnostics.FailingInvertedUnitFormatDiagnostic(invertedUnit, ["Param1", "Param2"]);
}

export async function* passingInvertedUnitRule(_invertedUnit: InvertedUnit): AsyncIterable<Diagnostics.SchemaItemDiagnostic<InvertedUnit, any[]>> {
  return undefined;
}

export async function* failingUnitSystemRule(unitSystem: UnitSystem): AsyncIterable<Diagnostics.SchemaItemDiagnostic<UnitSystem, [string, string]>> {
  yield new TestDiagnostics.FailingUnitSystemDiagnostic(unitSystem, ["Param1", "Param2"]);
}

export async function* passingUnitSystemRule(_format: UnitSystem): AsyncIterable<Diagnostics.SchemaItemDiagnostic<UnitSystem, any[]>> {
  return undefined;
}

export async function* failingPhenomenonRule(phenomenon: Phenomenon): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Phenomenon, [string, string]>> {
  yield new TestDiagnostics.FailingPhenomenonDiagnostic(phenomenon, ["Param1", "Param2"]);
}

export async function* passingPhenomenonRule(_phenomenon: Phenomenon): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Phenomenon, any[]>> {
  return undefined;
}

export async function* failingConstantRule(constant: Constant): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Constant, [string, string]>> {
  yield new TestDiagnostics.FailingConstantDiagnostic(constant, ["Param1", "Param2"]);
}

export async function* passingConstantRule(_constant: Constant): AsyncIterable<Diagnostics.SchemaItemDiagnostic<Constant, any[]>> {
  return undefined;
}

// Suppression Rules
export async function ignoreSchemaSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _schema: Schema): Promise<boolean> {
  return false;
}

export async function applySchemaSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _schema: Schema): Promise<boolean> {
  return true;
}

export async function ignoreSchemaItemSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _schemaItem: SchemaItem): Promise<boolean> {
  return false;
}

export async function applySchemaItemSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _schemaItem: SchemaItem): Promise<boolean> {
  return true;
}

export async function ignoreClassSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _ecClass: AnyClass): Promise<boolean> {
  return false;
}

export async function applyClassSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _ecClass: AnyClass): Promise<boolean> {
  return true;
}

export async function ignorePropertySuppression(_diagnostic: Diagnostics.AnyDiagnostic, _property: AnyProperty): Promise<boolean> {
  return false;
}

export async function applyPropertySuppression(_diagnostic: Diagnostics.AnyDiagnostic, _property: AnyProperty): Promise<boolean> {
  return true;
}

export async function ignoreEntityClassSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _entityClass: EntityClass): Promise<boolean> {
  return false;
}

export async function applyEntityClassSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _entityClass: EntityClass): Promise<boolean> {
  return true;
}

export async function ignoreStructClassSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _structClass: StructClass): Promise<boolean> {
  return false;
}

export async function applyStructClassSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _structClass: StructClass): Promise<boolean> {
  return true;
}

export async function ignoreMixinSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _mixin: Mixin): Promise<boolean> {
  return false;
}

export async function applyMixinSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _mixin: Mixin): Promise<boolean> {
  return true;
}

export async function ignoreRelationshipClassSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _relationship: RelationshipClass): Promise<boolean> {
  return false;
}

export async function applyRelationshipClassSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _relationship: RelationshipClass): Promise<boolean> {
  return true;
}

export async function ignoreRelationshipConstraintSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _constraint: RelationshipConstraint): Promise<boolean> {
  return false;
}

export async function applyRelationshipConstraintSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _constraint: RelationshipConstraint): Promise<boolean> {
  return true;
}

export async function ignoreCustomAttributeClassSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _customAttributeClass: CustomAttributeClass): Promise<boolean> {
  return false;
}

export async function applyCustomAttributeClassSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _customAttributeClass: CustomAttributeClass): Promise<boolean> {
  return true;
}

export async function ignoreCustomAttributeContainerSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _container: CustomAttributeContainerProps): Promise<boolean> {
  return false;
}

export async function applyCustomAttributeContainerSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _container: CustomAttributeContainerProps): Promise<boolean> {
  return true;
}

export async function ignoreCustomAttributeInstanceSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _container: CustomAttributeContainerProps, _customAttribute: CustomAttribute): Promise<boolean> {
  return false;
}

export async function applyCustomAttributeInstanceSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _container: CustomAttributeContainerProps, _customAttribute: CustomAttribute): Promise<boolean> {
  return true;
}

export async function ignoreEnumerationSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _enumeration: Enumeration): Promise<boolean> {
  return false;
}

export async function applyEnumerationSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _enumeration: Enumeration): Promise<boolean> {
  return true;
}

export async function ignoreKindofQuantitySuppression(_diagnostic: Diagnostics.AnyDiagnostic, _kindOfQuantity: KindOfQuantity): Promise<boolean> {
  return false;
}

export async function applyKindOfQuantitySuppression(_diagnostic: Diagnostics.AnyDiagnostic, _kindOfQuantity: KindOfQuantity): Promise<boolean> {
  return true;
}

export async function ignorePropertyCategorySuppression(_diagnostic: Diagnostics.AnyDiagnostic, _propertyCategory: PropertyCategory): Promise<boolean> {
  return false;
}

export async function applyPropertyCategorySuppression(_diagnostic: Diagnostics.AnyDiagnostic, _propertyCategory: PropertyCategory): Promise<boolean> {
  return true;
}

export async function ignoreFormatSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _format: Format): Promise<boolean> {
  return false;
}

export async function applyFormatSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _format: Format): Promise<boolean> {
  return true;
}

export async function ignoreUnitSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _unit: Unit): Promise<boolean> {
  return false;
}

export async function applyUnitSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _unit: Unit): Promise<boolean> {
  return true;
}

export async function ignoreInvertedUnitSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _invertedUnit: InvertedUnit): Promise<boolean> {
  return false;
}

export async function applyInvertedUnitSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _invertedUnit: InvertedUnit): Promise<boolean> {
  return true;
}

export async function ignoreUnitSystemSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _unitSystem: UnitSystem): Promise<boolean> {
  return false;
}

export async function applyUnitSystemSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _unitSystem: UnitSystem): Promise<boolean> {
  return true;
}

export async function ignorePhenomenonSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _phenomenon: Phenomenon): Promise<boolean> {
  return false;
}

export async function applyPhenomenonSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _phenomenon: Phenomenon): Promise<boolean> {
  return true;
}

export async function ignoreConstantSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _constant: Constant): Promise<boolean> {
  return false;
}

export async function applyConstantSuppression(_diagnostic: Diagnostics.AnyDiagnostic, _constant: Constant): Promise<boolean> {
  return true;
}

export class ApplySuppressionSet implements IRuleSuppressionSet {
  public name = "ApplySuppressionSet";
  public schemaRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingSchemaDiagnostic, rule: sinon.spy(applySchemaSuppression) },
  ];
  public schemaItemRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingSchemaItemDiagnostic, rule: sinon.spy(applySchemaItemSuppression) },
  ];
  public classRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingClassDiagnostic, rule: sinon.spy(applyClassSuppression) },
  ];
  public propertyRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingPropertyDiagnostic, rule: sinon.spy(applyPropertySuppression) },
  ];
  public entityRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingEntityClassDiagnostic, rule: sinon.spy(applyEntityClassSuppression) },
  ];
  public structRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingStructClassDiagnostic, rule: sinon.spy(applyStructClassSuppression) },
  ];
  public mixinRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingMixinDiagnostic, rule: sinon.spy(applyMixinSuppression) },
  ];
  public relationshipRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingRelationshipDiagnostic, rule: sinon.spy(applyRelationshipClassSuppression) },
  ];
  public relationshipConstraintRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingRelationshipConstraintDiagnostic, rule: sinon.spy(applyRelationshipConstraintSuppression) },
  ];
  public customAttributeRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingCustomAttributeClassDiagnostic, rule: sinon.spy(applyCustomAttributeClassSuppression) },
  ];
  public customAttributeContainerSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingCustomAttributeContainerDiagnostic, rule: sinon.spy(applyCustomAttributeContainerSuppression) },
  ];
  public customAttributeInstanceSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingCustomAttributeContainerDiagnostic, rule: sinon.spy(applyCustomAttributeInstanceSuppression) },
  ];
  public enumerationRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingEnumerationDiagnostic, rule: sinon.spy(applyEnumerationSuppression) },
  ];
  public koqRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingKindOfQuantityDiagnostic, rule: sinon.spy(applyKindOfQuantitySuppression) },
  ];
  public propertyCategoryRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingPropertyCategoryDiagnostic, rule: sinon.spy(applyPropertyCategorySuppression) },
  ];
  public formatRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingFormatDiagnostic, rule: sinon.spy(applyFormatSuppression) },
  ];
  public unitRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingUnitDiagnostic, rule: sinon.spy(applyUnitSuppression) },
  ];
  public invertedUnitRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingInvertedUnitFormatDiagnostic, rule: sinon.spy(applyInvertedUnitSuppression) },
  ];
  public unitSystemRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingUnitSystemDiagnostic, rule: sinon.spy(applyUnitSystemSuppression) },
  ];
  public phenomenonRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingPhenomenonDiagnostic, rule: sinon.spy(applyPhenomenonSuppression) },
  ];
  public constantRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingConstantDiagnostic, rule: sinon.spy(applyConstantSuppression) },
  ];
}

export class IgnoreSuppressionSet implements IRuleSuppressionSet {
  public name = "IgnoreSuppressionSet";
  public schemaRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingSchemaDiagnostic, rule: sinon.spy(ignoreSchemaSuppression) },
  ];
  public schemaItemRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingSchemaItemDiagnostic, rule: sinon.spy(ignoreSchemaItemSuppression) },
  ];
  public classRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingClassDiagnostic, rule: sinon.spy(ignoreClassSuppression) },
  ];
  public propertyRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingPropertyDiagnostic, rule: sinon.spy(ignorePropertySuppression) },
  ];
  public entityRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingEntityClassDiagnostic, rule: sinon.spy(ignoreEntityClassSuppression) },
  ];
  public structRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingStructClassDiagnostic, rule: sinon.spy(ignoreStructClassSuppression) },
  ];
  public mixinRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingMixinDiagnostic, rule: sinon.spy(ignoreMixinSuppression) },
  ];
  public relationshipRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingRelationshipDiagnostic, rule: sinon.spy(ignoreRelationshipClassSuppression) },
  ];
  public relationshipConstraintRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingRelationshipConstraintDiagnostic, rule: sinon.spy(ignoreRelationshipConstraintSuppression) },
  ];
  public customAttributeRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingCustomAttributeClassDiagnostic, rule: sinon.spy(ignoreCustomAttributeClassSuppression) },
  ];
  public customAttributeContainerSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingCustomAttributeContainerDiagnostic, rule: sinon.spy(ignoreCustomAttributeContainerSuppression) },
  ];
  public customAttributeInstanceSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingCustomAttributeContainerDiagnostic, rule: sinon.spy(ignoreCustomAttributeInstanceSuppression) },
  ];
  public enumerationRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingEnumerationDiagnostic, rule: sinon.spy(ignoreEnumerationSuppression) },
  ];
  public koqRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingKindOfQuantityDiagnostic, rule: sinon.spy(ignoreKindofQuantitySuppression) },
  ];
  public propertyCategoryRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingPropertyCategoryDiagnostic, rule: sinon.spy(ignorePropertyCategorySuppression) },
  ];
  public formatRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingFormatDiagnostic, rule: sinon.spy(ignoreFormatSuppression) },
  ];
  public unitRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingUnitDiagnostic, rule: sinon.spy(ignoreUnitSuppression) },
  ];
  public invertedUnitRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingInvertedUnitFormatDiagnostic, rule: sinon.spy(ignoreInvertedUnitSuppression) },
  ];
  public unitSystemRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingUnitSystemDiagnostic, rule: sinon.spy(ignoreUnitSystemSuppression) },
  ];
  public phenomenonRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingPhenomenonDiagnostic, rule: sinon.spy(ignorePhenomenonSuppression) },
  ];
  public constantRuleSuppressions = [
    { ruleCode: TestDiagnosticCodes.FailingConstantDiagnostic, rule: sinon.spy(ignoreConstantSuppression) },
  ];
}

export class EmptyRuleSet implements IRuleSet {
  public name: string = "EmptyRuleSet";
}

export class TestRuleSet implements IRuleSet {
  private _excludeTestSchema: boolean;

  constructor(excludeTestSchema: boolean = false) {
    this._excludeTestSchema = excludeTestSchema;
  }

  public name = "TestRuleSet";

  public get schemaExclusionSet(): string[] {
    if (!this._excludeTestSchema)
      return [];

    return ["TestSchema"];
  }

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

export async function toArray(asyncIterable: AsyncIterable<Diagnostics.AnyDiagnostic>): Promise<Diagnostics.AnyDiagnostic[]> {
  const result: Diagnostics.AnyDiagnostic[] = [];
  for await (const value of asyncIterable) {
    result.push(value);
  }
  return result;
}
