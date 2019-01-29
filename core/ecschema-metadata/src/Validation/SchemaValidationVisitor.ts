/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AnyClass, ISchemaPartVisitor } from "../Interfaces";
import { StructClass } from "../Metadata/Class";
import { Constant } from "../Metadata/Constant";
import { CustomAttribute, CustomAttributeContainerProps } from "../Metadata/CustomAttribute";
import { CustomAttributeClass } from "../Metadata/CustomAttributeClass";
import { EntityClass } from "../Metadata/EntityClass";
import { Enumeration } from "../Metadata/Enumeration";
import { Format } from "../Metadata/Format";
import { InvertedUnit } from "../Metadata/InvertedUnit";
import { KindOfQuantity } from "../Metadata/KindOfQuantity";
import { Mixin } from "../Metadata/Mixin";
import { Phenomenon } from "../Metadata/Phenomenon";
import { AnyProperty } from "../Metadata/Property";
import { PropertyCategory } from "../Metadata/PropertyCategory";
import { RelationshipClass, RelationshipConstraint } from "../Metadata/RelationshipClass";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";
import { Unit } from "../Metadata/Unit";
import { UnitSystem } from "../Metadata/UnitSystem";
import { AnyDiagnostic } from "./Diagnostic";
import { IDiagnosticReporter } from "./DiagnosticReporter";
import { IRule, IRuleSet } from "./Rules";

interface RuleSetArray {
  [name: string]: IRuleSet;
}

/**
 * A SchemaWalkerVisitor interface implementation that is used to validate ECObjects schemas using
 * [[IRuleSet]] objects registered with the instance. Also allows for reporting of [[IDiagnostic]]
 * objects returned from failing rules using [[IDiagnosticReporter]] implementations registered
 * with an instance of this class.
 */
export class SchemaValidationVisitor implements ISchemaPartVisitor {
  private _reporters: IDiagnosticReporter[] = [];
  private _ruleSets: RuleSetArray = {};
  private _classRules: Array<IRule<AnyClass>> = [];
  private _propertyRules: Array<IRule<AnyProperty>> = [];
  private _relationshipRules: Array<IRule<RelationshipClass>> = [];
  private _relationshipConstraintRules: Array<IRule<RelationshipConstraint>> = [];
  private _customAttributeContainerRules: Array<IRule<CustomAttributeContainerProps>> = [];
  private _enumerationRules: Array<IRule<Enumeration>> = [];
  private _kindOfQuantityRules: Array<IRule<KindOfQuantity>> = [];

  /** Gets the IRule<AnyClass> objects registered with the visitor. */
  public get ruleSets(): RuleSetArray {
    return this._ruleSets;
  }

  /** Gets the IRule<AnyClass> objects registered with the visitor. */
  public get classRules(): Array<IRule<AnyClass>> {
    return this._classRules;
  }

  /** Gets the IRule<AnyProperty> objects registered with the visitor. */
  public get propertyRules(): Array<IRule<AnyProperty>> {
    return this._propertyRules;
  }

  /** Gets the IRule<RelationshipClass> objects registered with the visitor. */
  public get relationshipRules(): Array<IRule<RelationshipClass>> {
    return this._relationshipRules;
  }

  /** Gets the IRule<RelationshipConstraint> objects registered with the visitor. */
  public get relationshipConstraintRules(): Array<IRule<RelationshipConstraint>> {
    return this._relationshipConstraintRules;
  }

  /** Gets the IRule<CustomAttributeContainerProps> objects registered with the visitor. */
  public get customAttributeContainerRules(): Array<IRule<CustomAttributeContainerProps>> {
    return this._customAttributeContainerRules;
  }

  /** Gets the IRule<Enumeration> objects registered with the visitor. */
  public get enumerationRules(): Array<IRule<Enumeration>> {
    return this._enumerationRules;
  }

  /** Gets the IRule<KindOfQuantity> objects registered with the visitor. */
  public get kindOfQuantityRules(): Array<IRule<KindOfQuantity>> {
    return this._kindOfQuantityRules;
  }

  /** Gets the IDiagnosticReporter objects registered with the visitor. */
  public get diagnosticReporters(): IDiagnosticReporter[] {
    return this._reporters;
  }

  /**
   * Registers a [[IDiagnosticReporter]] allowing the reporter to be
   * notified when a [[IDiagnostic]] is created due to a rule violation.
   * @param reporter The [[DiagnosticReporter]] to register.
   */
  public registerReporter(...reporters: IDiagnosticReporter[]) {
    for (const reporter of reporters) {
      this._reporters.push(reporter);
    }
  }

  /**
   * Registers a [[IRuleSet]] that will applied during schema traversal.
   * @param ruleSet The [[IRuleSet]] to register.
   */
  public registerRuleSet(ruleSet: IRuleSet) {
    if (undefined !== this.ruleSets[ruleSet.name])
      throw new Error(`A RuleSet with the name '${ruleSet.name}' has already been registered.`);

    this.ruleSets[ruleSet.name] = ruleSet;
  }

  /**
   * Called before schema traversal.
   * @param schema a Schema object.
   */
  public async visitFullSchema(schema: Schema) {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applySchemaRules(schema, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[SchemaItem]] instance found during schema traversal.
   * @param schemaItem a SchemaItem object.
   */
  public async visitSchemaItem(schemaItem: SchemaItem) {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applySchemaItemRules(schemaItem, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[AnyClass]] instance found during schema traversal.
   * @param ecClass an ECClass object.
   */
  public async visitClass(ecClass: AnyClass): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyClassRules(ecClass, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[AnyProperty]] instance of an ECClass.
   * @param property an AnyProperty object.
   */
  public async visitProperty(property: AnyProperty): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyPropertyRules(property, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[EntityClass]] instance found during schema traversal.
   * @param entityClass an EntityClass object.
   */
  public async visitEntityClass(entity: EntityClass): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyEntityRules(entity, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[StructClass]] instance found during schema traversal.
   * @param structClass a StructClass object.
   */
  public async visitStructClass(struct: StructClass): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyStructRules(struct, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[Mixin]] instance found during schema traversal.
   * @param mixin a Mixin object.
   */
  public async visitMixin(mixin: Mixin): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyMixinRules(mixin, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[RelationshipClass]] instance found during schema traversal.
   * @param relationshipClass a RelationshipClass object.
   */
  public async visitRelationshipClass(relationship: RelationshipClass): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyRelationshipRules(relationship, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[RelationshipConstraint]] of each RelationshipClass found during schema traversal.
   * @param relationshipConstraint a RelationshipConstraint object.
   */
  public async visitRelationshipConstraint(constraint: RelationshipConstraint): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyRelationshipConstraintRules(constraint, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[CustomAttributeClass]] instance found during schema traversal.
   * @param customAttributeClass a CustomAttributeClass object.
   */
  public async visitCustomAttributeClass(customAttribute: CustomAttributeClass): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyCustomAttributeRules(customAttribute, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[CustomAttribute]] container in the schema.
   * @param customAttributeContainer a [[CustomAttributeContainerProps]] object.
   */
  public async visitCustomAttributeContainer(container: CustomAttributeContainerProps): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyCustomAttributeContainerRules(container, this._ruleSets[index]);
    }

    if (!container.customAttributes)
      return;

    for (const [, customAttribute] of container.customAttributes) {
      for (const index of Object.keys(this._ruleSets)) {
        await this.applyCustomAttributeInstanceRules(container, customAttribute, this._ruleSets[index]);
      }
    }
  }

  /**
   * Called for each [[Enumeration]] instance found during schema traversal.
   * @param enumeration an Enumeration object.
   */
  public async visitEnumeration(enumeration: Enumeration) {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyEnumerationRules(enumeration, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[KindOfQuantity]] instance found during schema traversal.
   * @param koq a KindOfQuantity object.
   */
  public async visitKindOfQuantity(koq: KindOfQuantity) {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyKindOfQuantityRules(koq, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[PropertyCategory]] instance found during schema traversal.
   * @param category a PropertyCategory object.
   */
  public async visitPropertyCategory(category: PropertyCategory) {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyPropertyCategoryRules(category, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[Format]] instance found during schema traversal.
   * @param format a Format object.
   */
  public async visitFormat(format: Format): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyFormatRules(format, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[Unit]] instance found during schema traversal.
   * @param unit a Unit object.
   */
  public async visitUnit(unit: Unit): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyUnitRules(unit, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[InvertedUnit]] instance found during schema traversal.
   * @param invertedUnit an InvertedUnit object.
   */
  public async visitInvertedUnit(invertedUnit: InvertedUnit): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyInvertedUnitRules(invertedUnit, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[UnitSystem]] instance found during schema traversal.
   * @param unitSystem a UnitSystem object.
   */
  public async visitUnitSystem(unitSystem: UnitSystem): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyUnitSystemRules(unitSystem, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[Phenomenon]] instance found during schema traversal.
   * @param phenomena a Phenomenon object.
   */
  public async visitPhenomenon(phenomenon: Phenomenon): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyPhenomenonRules(phenomenon, this._ruleSets[index]);
    }
  }

  /**
   * Called for each [[Constant]] instance found during schema traversal.
   * @param constant a Constant object.
   */
  public async visitConstant(constant: Constant): Promise<void> {
    for (const index of Object.keys(this._ruleSets)) {
      await this.applyConstantRules(constant, this._ruleSets[index]);
    }
  }

  public async applySchemaRules(schema: Schema, ruleSet: IRuleSet) {
    if (!ruleSet.schemaRules)
      return;

    for (const rule of ruleSet.schemaRules) {
      const result = rule(schema);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applySchemaItemRules(schemaItem: SchemaItem, ruleSet: IRuleSet) {
    if (!ruleSet.schemaItemRules)
      return;

    for (const rule of ruleSet.schemaItemRules) {
      const result = rule(schemaItem);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyClassRules(ecClass: AnyClass, ruleSet: IRuleSet) {
    if (!ruleSet.classRules)
      return;

    for (const rule of ruleSet.classRules) {
      const result = rule(ecClass);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyPropertyRules(property: AnyProperty, ruleSet: IRuleSet) {
    if (!ruleSet.propertyRules)
      return;

    for (const rule of ruleSet.propertyRules) {
      const result = rule(property);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyEntityRules(entityClass: EntityClass, ruleSet: IRuleSet) {
    if (!ruleSet.entityClassRules)
      return;

    for (const rule of ruleSet.entityClassRules) {
      const result = rule(entityClass);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyStructRules(structClass: StructClass, ruleSet: IRuleSet) {
    if (!ruleSet.structClassRules)
      return;

    for (const rule of ruleSet.structClassRules) {
      const result = rule(structClass);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyMixinRules(mixin: Mixin, ruleSet: IRuleSet) {
    if (!ruleSet.mixinRules)
      return;

    for (const rule of ruleSet.mixinRules) {
      const result = rule(mixin);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyRelationshipRules(relationship: RelationshipClass, ruleSet: IRuleSet) {
    if (!ruleSet.relationshipRules)
      return;

    for (const rule of ruleSet.relationshipRules) {
      const result = rule(relationship);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyRelationshipConstraintRules(constraint: RelationshipConstraint, ruleSet: IRuleSet) {
    if (!ruleSet.relationshipConstraintRules)
      return;

    for (const rule of ruleSet.relationshipConstraintRules) {
      const result = rule(constraint);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyCustomAttributeRules(customAttribute: CustomAttributeClass, ruleSet: IRuleSet) {
    if (!ruleSet.customAttributeClassRules)
      return;

    for (const rule of ruleSet.customAttributeClassRules) {
      const result = rule(customAttribute);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyCustomAttributeContainerRules(container: CustomAttributeContainerProps, ruleSet: IRuleSet) {
    if (!ruleSet.customAttributeContainerRules)
      return;

    for (const rule of ruleSet.customAttributeContainerRules) {
      const result = rule(container);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyCustomAttributeInstanceRules(container: CustomAttributeContainerProps, customAttribute: CustomAttribute, ruleSet: IRuleSet) {
    if (!ruleSet.customAttributeInstanceRules)
      return;

    for (const rule of ruleSet.customAttributeInstanceRules) {
      const result = rule(container, customAttribute);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyEnumerationRules(enumeration: Enumeration, ruleSet: IRuleSet) {
    if (!ruleSet.enumerationRules)
      return;

    for (const rule of ruleSet.enumerationRules) {
      const result = rule(enumeration);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyKindOfQuantityRules(kindOfQuantity: KindOfQuantity, ruleSet: IRuleSet) {
    if (!ruleSet.kindOfQuantityRules)
      return;

    for (const rule of ruleSet.kindOfQuantityRules) {
      const result = rule(kindOfQuantity);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyPropertyCategoryRules(propertyCategory: PropertyCategory, ruleSet: IRuleSet) {
    if (!ruleSet.propertyCategoryRules)
      return;

    for (const rule of ruleSet.propertyCategoryRules) {
      const result = rule(propertyCategory);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyFormatRules(format: Format, ruleSet: IRuleSet) {
    if (!ruleSet.formatRules)
      return;

    for (const rule of ruleSet.formatRules) {
      const result = rule(format);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyUnitRules(unit: Unit, ruleSet: IRuleSet) {
    if (!ruleSet.unitRules)
      return;

    for (const rule of ruleSet.unitRules) {
      const result = rule(unit);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyInvertedUnitRules(invertedUnit: InvertedUnit, ruleSet: IRuleSet) {
    if (!ruleSet.invertedUnitRules)
      return;

    for (const rule of ruleSet.invertedUnitRules) {
      const result = rule(invertedUnit);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyUnitSystemRules(unitSystem: UnitSystem, ruleSet: IRuleSet) {
    if (!ruleSet.unitSystemRules)
      return;

    for (const rule of ruleSet.unitSystemRules) {
      const result = rule(unitSystem);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyPhenomenonRules(phenomenon: Phenomenon, ruleSet: IRuleSet) {
    if (!ruleSet.phenomenonRules)
      return;

    for (const rule of ruleSet.phenomenonRules) {
      const result = rule(phenomenon);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  public async applyConstantRules(constant: Constant, ruleSet: IRuleSet) {
    if (!ruleSet.constantRules)
      return;

    for (const rule of ruleSet.constantRules) {
      const result = rule(constant);
      if (!result)
        continue;

      await this.reportDiagnostics(result);
    }
  }

  private async reportDiagnostics(diagnostics: AsyncIterable<AnyDiagnostic>) {
    for await (const diagnostic of diagnostics) {
      if (diagnostic)
        this._reporters.forEach((reporter) => { reporter.report(diagnostic); });
    }
  }
}
