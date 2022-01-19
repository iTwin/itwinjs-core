/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Comparison
 */

import { AnyClass, AnyEnumerator, AnyProperty, Constant, CustomAttribute,
  CustomAttributeClass, CustomAttributeContainerProps, EntityClass, Enumeration, Format, InvertedUnit, KindOfQuantity,
  Mixin, OverrideFormat, Phenomenon, PropertyCategory, RelationshipClass, RelationshipConstraint,
  Schema, SchemaItem, Unit,
} from "@itwin/ecschema-metadata";
import { AnyDiagnostic } from "./Diagnostic";
import { SchemaChanges } from "./SchemaChanges";
import { SchemaCompareDiagnostics } from "./SchemaCompareDiagnostics";
import { SchemaCompareDirection } from "./SchemaComparer";
import { ISchemaCompareReporter } from "./SchemaCompareReporter";

/**
 * Used by the [[SchemaComparer]] to report differences found during schema comparison.
 * @internal
 */
export class SchemaCompareResultDelegate {
  private _schemaChangeReporters: ISchemaCompareReporter[];
  private _schemaAChanges: SchemaChanges;
  private _schemaBChanges?: SchemaChanges;

  /**
   * Initializes a new SchemaCompareResultDelegate instance.
   * @param reporters The [[ISchemaCompareReporter]] objects to use to report schema differences.
   */
  constructor(schemaA: Schema, schemaB: Schema, ...reporters: ISchemaCompareReporter[]) {
    this._schemaChangeReporters = reporters;
    const keyMismatch = !schemaA.schemaKey.matches(schemaB.schemaKey);
    this._schemaAChanges = new SchemaChanges(schemaA);
    if (keyMismatch)
      this._schemaBChanges = new SchemaChanges(schemaB);
  }

  public get schemaChangeReporters(): ISchemaCompareReporter[] {
    return this._schemaChangeReporters;
  }

  /**
   * Called by the SchemaComparer when the comparison is complete.
   */
  public compareComplete() {
    this.schemaChangeReporters.forEach((r) => r.report(this._schemaAChanges));
    if (this._schemaBChanges)
      this.schemaChangeReporters.forEach((r) => r.report(this._schemaBChanges!));
  }

  /**
   * Reports differences between Schema properties.
   * @param schemaA The first Schema supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first Schema.
   * @param valueB The value from the second Schema.
   */
  public async reportSchemaDelta(schemaA: Schema, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.SchemaDelta(schemaA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences in the schema reference collection of two schemas.
   * @param schemaA The first Schema supplied for comparison.
   * @param referenceSchema The missing schema reference.
   */
  public async reportSchemaReferenceMissing(schemaA: Schema, referenceSchema: Schema, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.SchemaReferenceMissing(schemaA, [referenceSchema]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences in the schema reference collection of two schemas where the reference version differs.
   * @param schemaA The first Schema supplied for comparison.
   * @param referenceSchema The missing schema reference.
   */
  public async reportSchemaReferenceDelta(schemaA: Schema, referenceSchema: Schema, versionA: string, versionB: string, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.SchemaReferenceDelta(schemaA, [referenceSchema, versionA, versionB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports that a given SchemaItem could not be found in the second Schema.
   * @param schemaItemA The SchemaItem from the first Schema.
   */
  public async reportSchemaItemMissing(schemaItemA: SchemaItem, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.SchemaItemMissing(schemaItemA, []);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between SchemaItem properties.
   * @param schemaItemA The first SchemaItem supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first SchemaItem.
   * @param valueB The value from the second SchemaItem.
   */
  public async reportSchemaItemDelta(schemaItemA: SchemaItem, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.SchemaItemDelta(schemaItemA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between ECClass properties.
   * @param classA The first ECClass supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first ECClass.
   * @param valueB The value from the second ECClass.
   */
  public async reportClassDelta(classA: AnyClass, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.ClassDelta(classA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences of the base class defined between two ECClass objects.
   * @param classA The first ECClass supplied for comparison.
   * @param baseClassA The base class of the first ECClass.
   * @param baseClassB The base class of the second ECClass.
   */
  public async reportBaseClassDelta(classA: AnyClass, baseClassA: AnyClass | undefined, baseClassB: AnyClass | undefined, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.BaseClassDelta(classA, [baseClassA, baseClassB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between ECProperty properties.
   * @param propertyA The first ECProperty supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first ECProperty.
   * @param valueB The value from the second ECProperty.
   */
  public async reportPropertyDelta(propertyA: AnyProperty, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.PropertyDelta(propertyA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports that an ECProperty found in the first ECClass could not be found in the second.
   * @param propertyA The ECProperty supplied for comparison.
   */
  public async reportPropertyMissing(propertyA: AnyProperty, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.PropertyMissing(propertyA, []);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports that a Mixin found in the first EntityClass could not be found in the second.
   * @param entityClassA The first EntityClass that is missing the Mixin.
   * @param mixinA The Mixin from the first EntityClass.
   */
  public async reportEntityMixinMissing(entityClassA: EntityClass, mixinA: Mixin, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.EntityMixinMissing(entityClassA, [mixinA]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between Mixin properties.
   * @param mixinA The first Mixin supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first Mixin.
   * @param valueB The value from the second Mixin.
   */
  public async reportMixinDelta(mixinA: Mixin, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.MixinDelta(mixinA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between RelationshipClass properties.
   * @param relationshipClassA The first RelationshipClass supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first RelationshipClass.
   * @param valueB The value from the second RelationshipClass.
   */
  public async reportRelationshipClassDelta(relationshipClassA: RelationshipClass, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.RelationshipDelta(relationshipClassA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between RelationshipConstraint properties.
   * @param constraintA The first RelationshipConstraint supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first RelationshipConstraint.
   * @param valueB The value from the second RelationshipConstraint.
   */
  public async reportRelationshipConstraintDelta(constraintA: RelationshipConstraint, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.RelationshipConstraintDelta(constraintA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports that a constraint class found in the first RelationshipConstraint could not be found in the second.
   * @param constraintA The first RelationshipConstraint that is missing the class constraint.
   * @param constraintClass The constraint ECClass from the first RelationshipConstraint.
   */
  public async reportRelationshipConstraintClassMissing(constraintA: RelationshipConstraint, constraintClass: EntityClass | Mixin | RelationshipClass, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.RelationshipConstraintClassMissing(constraintA, [constraintClass]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between CustomAttributeClass properties.
   * @param customAttributeA The first CustomAttributeClass supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first CustomAttributeClass.
   * @param valueB The value from the second CustomAttributeClass.
   */
  public async reportCustomAttributeClassDelta(customAttributeA: CustomAttributeClass, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.CustomAttributeClassDelta(customAttributeA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports that a CustomAttribute instance found in the first CustomAttribute container could not be found in the second.
   * @param customAttributeContainerA The first CustomAttribute container that is missing the CustomAttribute instance.
   * @param customAttribute The CustomAttribute missing.
   */
  public async reportCustomAttributeInstanceClassMissing(customAttributeContainerA: CustomAttributeContainerProps, customAttribute: CustomAttribute, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.CustomAttributeInstanceClassMissing(customAttributeContainerA, [customAttribute]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between Enumeration properties.
   * @param enumerationA The first Enumeration supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first Enumeration.
   * @param valueB The value from the second Enumeration.
   */
  public async reportEnumerationDelta(enumerationA: Enumeration, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.EnumerationDelta(enumerationA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports that a enumerator found in the first Enumeration could not be found in the second.
   * @param enumerationA The first Enumeration that is missing the enumerator.
   * @param enumerator The enumerator missing from the second schema.
   */
  public async reportEnumeratorMissing(enumerationA: Enumeration, enumerator: AnyEnumerator, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.EnumeratorMissing(enumerationA, [enumerator]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between enumerator properties within a given Enumeration.
   * @param enumerationA The first Enumeration supplied for comparison.
   * @param enumerator The enumerator containing differing property values.
   * @param propertyName The name of the property.
   * @param valueA The value from the first enumerator.
   * @param valueB The value from the second enumerator.
   */
  public async reportEnumeratorDelta(enumerationA: Enumeration, enumerator: AnyEnumerator, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.EnumeratorDelta(enumerationA, [enumerator, propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between KindOfQuantity properties.
   * @param koqA The first KindOfQuantity supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first KindOfQuantity.
   * @param valueB The value from the second KindOfQuantity.
   */
  public async reportKoqDelta(koqA: KindOfQuantity, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.KoqDelta(koqA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports that a presentation unit found in the first KindOfQuantity could not be found in the second.
   * @param koqA The first KindOfQuantity that is missing the presentation unit.
   * @param unit The Format or OverrideFormat presentation unit missing from the second schema.
   */
  public async reportPresentationUnitMissing(koqA: KindOfQuantity, unit: Format | OverrideFormat, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.PresentationUnitMissing(koqA, [unit]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between PropertyCategory properties.
   * @param categoryA The first PropertyCategory supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first PropertyCategory.
   * @param valueB The value from the second PropertyCategory.
   */
  public async reportPropertyCategoryDelta(categoryA: PropertyCategory, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.PropertyCategoryDelta(categoryA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between Format properties.
   * @param formatA The first Format supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first Format.
   * @param valueB The value from the second Format.
   */
  public async reportFormatDelta(formatA: Format, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.FormatDelta(formatA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports that a unit found in the first Format could not be found in the second.
   * @param formatA The first Format that is missing the unit.
   * @param unit The Unit or InvertedUnit missing from the second schema.
   */
  public async reportFormatUnitMissing(formatA: Format, unit: Unit | InvertedUnit, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.FormatUnitMissing(formatA, [unit]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between overridden labels within the Units of a given Format.
   * @param formatA The first Format supplied for comparison.
   * @param unit The Unit or InvertedUnit with differing label overrides.
   * @param labelA The value from the first label.
   * @param labelB The value from the second label.
   */
  public async reportUnitLabelOverrideDelta(formatA: Format, unit: Unit | InvertedUnit, labelA: string | undefined, labelB: string | undefined, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.UnitLabelOverrideDelta(formatA, [unit, labelA, labelB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between Unit properties.
   * @param unitA The first Unit supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first Unit.
   * @param valueB The value from the second Unit.
   */
  public async reportUnitDelta(unitA: Unit, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.UnitDelta(unitA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between InvertedUnit properties.
   * @param invertedUnitA The first InvertedUnit supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first InvertedUnit.
   * @param valueB The value from the second InvertedUnit.
   */
  public async reportInvertedUnitDelta(invertedUnitA: InvertedUnit, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.InvertedUnitDelta(invertedUnitA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between Phenomenon properties.
   * @param phenomenonA The first Phenomenon supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first Phenomenon.
   * @param valueB The value from the second Phenomenon.
   */
  public async reportPhenomenonDelta(phenomenonA: Phenomenon, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.PhenomenonDelta(phenomenonA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  /**
   * Reports differences between Constant properties.
   * @param constantA The first Constant supplied for comparison.
   * @param propertyName The name of the property.
   * @param valueA The value from the first Constant.
   * @param valueB The value from the second Constant.
   */
  public async reportConstantDelta(constantA: Constant, propertyName: string, valueA: any, valueB: any, _compareDirection: SchemaCompareDirection): Promise<void> {
    const diag = new SchemaCompareDiagnostics.ConstantDelta(constantA, [propertyName, valueA, valueB]);
    await this.reportDiagnostic(diag);
  }

  private async reportDiagnostic(diagnostic: AnyDiagnostic): Promise<void> {
    if (!this._schemaBChanges || this._schemaAChanges.schema === diagnostic.schema) {
      this._schemaAChanges.addDiagnostic(diagnostic);
      return;
    }
    if (this._schemaBChanges.schema === diagnostic.schema) {
      this._schemaBChanges.addDiagnostic(diagnostic);
      return;
    }
  }
}
