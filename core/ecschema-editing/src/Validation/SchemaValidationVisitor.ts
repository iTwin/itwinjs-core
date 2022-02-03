/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Validation
 */

import type { AnyClass, AnyECType, AnyProperty, Constant, CustomAttribute, CustomAttributeClass, CustomAttributeContainerProps,
  EntityClass, Enumeration, Format, InvertedUnit, ISchemaPartVisitor, KindOfQuantity, Mixin,
  Phenomenon, PropertyCategory, RelationshipClass, RelationshipConstraint, Schema, SchemaItem,
  StructClass, Unit, UnitSystem,
} from "@itwin/ecschema-metadata";

import type { AnyDiagnostic} from "./Diagnostic";
import { DiagnosticCategory } from "./Diagnostic";
import type { IDiagnosticReporter } from "./DiagnosticReporter";
import type { IRuleSet } from "./Rules";
import type { IRuleSuppressionMap, IRuleSuppressionSet, ISuppressionRule } from "./RuleSuppressionSet";

interface RuleSetArray {
  [name: string]: IRuleSet;
}

/**
 * A SchemaWalkerVisitor interface implementation that is used to validate ECObjects schemas using
 * [[IRuleSet]] objects registered with the instance. Also allows for reporting of [[IDiagnostic]]
 * objects returned from failing rules using [[IDiagnosticReporter]] implementations registered
 * with an instance of this class.
 * @beta
 */
export class SchemaValidationVisitor implements ISchemaPartVisitor {
  private _reporters: IDiagnosticReporter[] = [];
  private _ruleSets: RuleSetArray = {};
  private _ruleSuppressionSet?: IRuleSuppressionSet;

  /** Gets the IRule<AnyClass> objects registered with the visitor. */
  public get ruleSets(): RuleSetArray {
    return this._ruleSets;
  }

  public get suppressionSet(): IRuleSuppressionSet | undefined {
    return this._ruleSuppressionSet;
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
    for (const reporter of reporters)
      this._reporters.push(reporter);
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
   * Registers a [[IRuleSuppressionSet]] that will be applied during schema traversal.
   * @param ruleSet The [[IRuleSuppressionSet]] to register.
   * Only supports one Rule Suppression Set, if you call it twice it will overwrite the
   * previous suppression set
   */
  public registerRuleSuppressionSet(suppressionSet: IRuleSuppressionSet) {
    this._ruleSuppressionSet = suppressionSet;
  }

  /**
   * Called before schema traversal.
   * @param schema a Schema object.
   */
  public async visitFullSchema(schema: Schema) {
    for (const index of Object.keys(this._ruleSets))
      await this.applySchemaRules(schema, this._ruleSets[index]);
  }

  /**
   * Called for each [[SchemaItem]] instance found during schema traversal.
   * @param schemaItem a SchemaItem object.
   */
  public async visitSchemaItem(schemaItem: SchemaItem) {
    for (const index of Object.keys(this._ruleSets))
      await this.applySchemaItemRules(schemaItem, this._ruleSets[index]);
  }

  /**
   * Called for each [AnyClass]($ecschema-metadata) instance found during schema traversal.
   * @param ecClass an ECClass object.
   */
  public async visitClass(ecClass: AnyClass): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyClassRules(ecClass, this._ruleSets[index]);
  }

  /**
   * Called for each [AnyProperty]($ecschema-metadata) instance of an ECClass.
   * @param property an AnyProperty object.
   */
  public async visitProperty(property: AnyProperty): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyPropertyRules(property, this._ruleSets[index]);
  }

  /**
   * Called for each [EntityClass]($ecschema-metadata) instance found during schema traversal.
   * @param entityClass an EntityClass object.
   */
  public async visitEntityClass(entity: EntityClass): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyEntityRules(entity, this._ruleSets[index]);
  }

  /**
   * Called for each [StructClass]($ecschema-metadata) instance found during schema traversal.
   * @param structClass a StructClass object.
   */
  public async visitStructClass(struct: StructClass): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyStructRules(struct, this._ruleSets[index]);
  }

  /**
   * Called for each [Mixin]($ecschema-metadata) instance found during schema traversal.
   * @param mixin a Mixin object.
   */
  public async visitMixin(mixin: Mixin): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyMixinRules(mixin, this._ruleSets[index]);
  }

  /**
   * Called for each [RelationshipClass]($ecschema-metadata) instance found during schema traversal.
   * @param relationshipClass a RelationshipClass object.
   */
  public async visitRelationshipClass(relationship: RelationshipClass): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyRelationshipRules(relationship, this._ruleSets[index]);
  }

  /**
   * Called for each [RelationshipConstraint]($ecschema-metadata) of each RelationshipClass found during schema traversal.
   * @param relationshipConstraint a RelationshipConstraint object.
   */
  public async visitRelationshipConstraint(constraint: RelationshipConstraint): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyRelationshipConstraintRules(constraint, this._ruleSets[index]);
  }

  /**
   * Called for each [CustomAttributeClass]($ecschema-metadata) instance found during schema traversal.
   * @param customAttributeClass a CustomAttributeClass object.
   */
  public async visitCustomAttributeClass(customAttribute: CustomAttributeClass): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyCustomAttributeRules(customAttribute, this._ruleSets[index]);
  }

  /**
   * Called for each [CustomAttribute]($ecschema-metadata) container in the schema.
   * @param customAttributeContainer a [[CustomAttributeContainerProps]] object.
   */
  public async visitCustomAttributeContainer(container: CustomAttributeContainerProps): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyCustomAttributeContainerRules(container, this._ruleSets[index]);

    if (undefined === container.customAttributes)
      return;

    for (const [, customAttribute] of container.customAttributes) {
      for (const index of Object.keys(this._ruleSets)) {
        await this.applyCustomAttributeInstanceRules(container, customAttribute, this._ruleSets[index]);
      }
    }
  }

  /**
   * Called for each [Enumeration]($ecschema-metadata) instance found during schema traversal.
   * @param enumeration an Enumeration object.
   */
  public async visitEnumeration(enumeration: Enumeration) {
    for (const index of Object.keys(this._ruleSets))
      await this.applyEnumerationRules(enumeration, this._ruleSets[index]);
  }

  /**
   * Called for each [KindOfQuantity]($ecschema-metadata) instance found during schema traversal.
   * @param koq a KindOfQuantity object.
   */
  public async visitKindOfQuantity(koq: KindOfQuantity) {
    for (const index of Object.keys(this._ruleSets))
      await this.applyKindOfQuantityRules(koq, this._ruleSets[index]);
  }

  /**
   * Called for each [PropertyCategory]($ecschema-metadata) instance found during schema traversal.
   * @param category a PropertyCategory object.
   */
  public async visitPropertyCategory(category: PropertyCategory) {
    for (const index of Object.keys(this._ruleSets))
      await this.applyPropertyCategoryRules(category, this._ruleSets[index]);
  }

  /**
   * Called for each [Format]($ecschema-metadata) instance found during schema traversal.
   * @param format a Format object.
   */
  public async visitFormat(format: Format): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyFormatRules(format, this._ruleSets[index]);
  }

  /**
   * Called for each [Unit]($ecschema-metadata) instance found during schema traversal.
   * @param unit a Unit object.
   */
  public async visitUnit(unit: Unit): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyUnitRules(unit, this._ruleSets[index]);
  }

  /**
   * Called for each [InvertedUnit]($ecschema-metadata) instance found during schema traversal.
   * @param invertedUnit an InvertedUnit object.
   */
  public async visitInvertedUnit(invertedUnit: InvertedUnit): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyInvertedUnitRules(invertedUnit, this._ruleSets[index]);
  }

  /**
   * Called for each [UnitSystem]($ecschema-metadata) instance found during schema traversal.
   * @param unitSystem a UnitSystem object.
   */
  public async visitUnitSystem(unitSystem: UnitSystem): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyUnitSystemRules(unitSystem, this._ruleSets[index]);
  }

  /**
   * Called for each [Phenomenon]($ecschema-metadata) instance found during schema traversal.
   * @param phenomena a Phenomenon object.
   */
  public async visitPhenomenon(phenomenon: Phenomenon): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyPhenomenonRules(phenomenon, this._ruleSets[index]);
  }

  /**
   * Called for each [Constant]($ecschema-metadata) instance found during schema traversal.
   * @param constant a Constant object.
   */
  public async visitConstant(constant: Constant): Promise<void> {
    for (const index of Object.keys(this._ruleSets))
      await this.applyConstantRules(constant, this._ruleSets[index]);
  }

  public async applySchemaRules(schema: Schema, ruleSet: IRuleSet) {
    if (!ruleSet.schemaRules || this.excludeSchemaFromRuleSet(schema, ruleSet))
      return;

    for (const rule of ruleSet.schemaRules) {
      const result = rule(schema);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.schemaRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, schema, suppressions);
      }
    }
  }

  public async applySchemaItemRules(schemaItem: SchemaItem, ruleSet: IRuleSet) {
    if (!ruleSet.schemaItemRules || this.excludeSchemaFromRuleSet(schemaItem.schema, ruleSet))
      return;

    for (const rule of ruleSet.schemaItemRules) {
      const result = rule(schemaItem);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.schemaItemRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, schemaItem, suppressions);
      }
    }
  }

  public async applyClassRules(ecClass: AnyClass, ruleSet: IRuleSet) {
    if (!ruleSet.classRules || this.excludeSchemaFromRuleSet(ecClass.schema, ruleSet))
      return;

    for (const rule of ruleSet.classRules) {
      const result = rule(ecClass);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.classRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, ecClass, suppressions);
      }
    }
  }

  public async applyPropertyRules(property: AnyProperty, ruleSet: IRuleSet) {
    if (!ruleSet.propertyRules || this.excludeSchemaFromRuleSet(property.schema, ruleSet))
      return;

    for (const rule of ruleSet.propertyRules) {
      const result = rule(property);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.propertyRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, property, suppressions);
      }
    }
  }

  public async applyEntityRules(entityClass: EntityClass, ruleSet: IRuleSet) {
    if (!ruleSet.entityClassRules || this.excludeSchemaFromRuleSet(entityClass.schema, ruleSet))
      return;

    for (const rule of ruleSet.entityClassRules) {
      const result = rule(entityClass);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.entityRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, entityClass, suppressions);
      }
    }
  }

  public async applyStructRules(structClass: StructClass, ruleSet: IRuleSet) {
    if (!ruleSet.structClassRules || this.excludeSchemaFromRuleSet(structClass.schema, ruleSet))
      return;

    for (const rule of ruleSet.structClassRules) {
      const result = rule(structClass);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.structRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, structClass, suppressions);
      }
    }
  }

  public async applyMixinRules(mixin: Mixin, ruleSet: IRuleSet) {
    if (!ruleSet.mixinRules || this.excludeSchemaFromRuleSet(mixin.schema, ruleSet))
      return;

    for (const rule of ruleSet.mixinRules) {
      const result = rule(mixin);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.mixinRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, mixin, suppressions);
      }
    }
  }

  public async applyRelationshipRules(relationship: RelationshipClass, ruleSet: IRuleSet) {
    if (!ruleSet.relationshipRules || this.excludeSchemaFromRuleSet(relationship.schema, ruleSet))
      return;

    for (const rule of ruleSet.relationshipRules) {
      const result = rule(relationship);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.relationshipRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, relationship, suppressions);
      }
    }
  }

  public async applyRelationshipConstraintRules(constraint: RelationshipConstraint, ruleSet: IRuleSet) {
    if (!ruleSet.relationshipConstraintRules || this.excludeSchemaFromRuleSet(constraint.schema, ruleSet))
      return;

    for (const rule of ruleSet.relationshipConstraintRules) {
      const result = rule(constraint);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.relationshipConstraintRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, constraint, suppressions);
      }
    }
  }

  public async applyCustomAttributeRules(customAttribute: CustomAttributeClass, ruleSet: IRuleSet) {
    if (!ruleSet.customAttributeClassRules || this.excludeSchemaFromRuleSet(customAttribute.schema, ruleSet))
      return;

    for (const rule of ruleSet.customAttributeClassRules) {
      const result = rule(customAttribute);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.customAttributeRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, customAttribute, suppressions);
      }
    }
  }

  public async applyCustomAttributeContainerRules(container: CustomAttributeContainerProps, ruleSet: IRuleSet) {
    if (!ruleSet.customAttributeContainerRules || this.excludeSchemaFromRuleSet(container.schema, ruleSet))
      return;

    for (const rule of ruleSet.customAttributeContainerRules) {
      const result = rule(container);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.customAttributeContainerSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, container, suppressions);
      }
    }
  }

  public async applyCustomAttributeInstanceRules(container: CustomAttributeContainerProps, customAttribute: CustomAttribute, ruleSet: IRuleSet) {
    if (!ruleSet.customAttributeInstanceRules || this.excludeSchemaFromRuleSet(container.schema, ruleSet))
      return;

    for (const rule of ruleSet.customAttributeInstanceRules) {
      const result = rule(container, customAttribute);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.customAttributeInstanceSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, container, suppressions);
      }
    }
  }

  public async applyEnumerationRules(enumeration: Enumeration, ruleSet: IRuleSet) {
    if (!ruleSet.enumerationRules || this.excludeSchemaFromRuleSet(enumeration.schema, ruleSet))
      return;

    for (const rule of ruleSet.enumerationRules) {
      const result = rule(enumeration);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.enumerationRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, enumeration, suppressions);
      }
    }
  }

  public async applyKindOfQuantityRules(kindOfQuantity: KindOfQuantity, ruleSet: IRuleSet) {
    if (!ruleSet.kindOfQuantityRules || this.excludeSchemaFromRuleSet(kindOfQuantity.schema, ruleSet))
      return;

    for (const rule of ruleSet.kindOfQuantityRules) {
      const result = rule(kindOfQuantity);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.koqRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, kindOfQuantity, suppressions);
      }
    }
  }

  public async applyPropertyCategoryRules(propertyCategory: PropertyCategory, ruleSet: IRuleSet) {
    if (!ruleSet.propertyCategoryRules || this.excludeSchemaFromRuleSet(propertyCategory.schema, ruleSet))
      return;

    for (const rule of ruleSet.propertyCategoryRules) {
      const result = rule(propertyCategory);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.propertyCategoryRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, propertyCategory, suppressions);
      }
    }
  }

  public async applyFormatRules(format: Format, ruleSet: IRuleSet) {
    if (!ruleSet.formatRules || this.excludeSchemaFromRuleSet(format.schema, ruleSet))
      return;

    for (const rule of ruleSet.formatRules) {
      const result = rule(format);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.formatRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, format, suppressions);
      }
    }
  }

  public async applyUnitRules(unit: Unit, ruleSet: IRuleSet) {
    if (!ruleSet.unitRules || this.excludeSchemaFromRuleSet(unit.schema, ruleSet))
      return;

    for (const rule of ruleSet.unitRules) {
      const result = rule(unit);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.unitRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, unit, suppressions);
      }
    }
  }

  public async applyInvertedUnitRules(invertedUnit: InvertedUnit, ruleSet: IRuleSet) {
    if (!ruleSet.invertedUnitRules || this.excludeSchemaFromRuleSet(invertedUnit.schema, ruleSet))
      return;

    for (const rule of ruleSet.invertedUnitRules) {
      const result = rule(invertedUnit);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.invertedUnitRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, invertedUnit, suppressions);
      }
    }
  }

  public async applyUnitSystemRules(unitSystem: UnitSystem, ruleSet: IRuleSet) {
    if (!ruleSet.unitSystemRules || this.excludeSchemaFromRuleSet(unitSystem.schema, ruleSet))
      return;

    for (const rule of ruleSet.unitSystemRules) {
      const result = rule(unitSystem);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.unitSystemRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, unitSystem, suppressions);
      }
    }
  }

  public async applyPhenomenonRules(phenomenon: Phenomenon, ruleSet: IRuleSet) {
    if (!ruleSet.phenomenonRules || this.excludeSchemaFromRuleSet(phenomenon.schema, ruleSet))
      return;

    for (const rule of ruleSet.phenomenonRules) {
      const result = rule(phenomenon);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.phenomenonRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, phenomenon, suppressions);
      }
    }
  }

  public async applyConstantRules(constant: Constant, ruleSet: IRuleSet) {
    if (!ruleSet.constantRules || this.excludeSchemaFromRuleSet(constant.schema, ruleSet))
      return;

    for (const rule of ruleSet.constantRules) {
      const result = rule(constant);
      for await (const diagnostic of result) {
        const suppressions = this._ruleSuppressionSet ? this._ruleSuppressionSet.constantRuleSuppressions : undefined;
        await this.reportDiagnostics(diagnostic, constant, suppressions);
      }
    }
  }

  private findSuppressionRule<T extends AnyECType, U = {}>(suppressionSet: Array<IRuleSuppressionMap<T, U>>, code: string): ISuppressionRule<T, U> | undefined {
    if (!suppressionSet)
      return;

    for (const suppression of suppressionSet) {
      if (suppression.ruleCode === code) {
        return suppression.rule;
      }
    }

    return;
  }

  private excludeSchemaFromRuleSet(schema: Schema, ruleSet: IRuleSet): boolean {
    if (!ruleSet.schemaExclusionSet)
      return false;

    return ruleSet.schemaExclusionSet.includes(schema.name);
  }

  private async reportDiagnostics<T extends AnyECType, U = {}>(diagnostic: AnyDiagnostic, ecType: T, suppressionMap: Array<IRuleSuppressionMap<T, U>> | undefined) {
    if (!diagnostic)
      return;

    if (suppressionMap) {
      const suppressRule = this.findSuppressionRule(suppressionMap, diagnostic.code);
      if (suppressRule) {
        const ecSuppression = await suppressRule(diagnostic, ecType);
        if (ecSuppression) {
          diagnostic.category = DiagnosticCategory.Warning;
        }
      }
    }

    this._reporters.forEach((reporter) => { reporter.report(diagnostic); });
  }
}
