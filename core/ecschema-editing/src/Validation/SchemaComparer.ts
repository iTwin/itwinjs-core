/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Comparison
 */

import {
  AnyClass, AnyEnumerator, AnyProperty, classModifierToString, Constant, containerTypeToString, CustomAttribute, CustomAttributeClass,
  CustomAttributeContainerProps, EntityClass, Enumeration, Format, InvertedUnit, KindOfQuantity, Mixin, OverrideFormat, Phenomenon,
  primitiveTypeToString, PropertyCategory, propertyTypeToString, RelationshipClass, RelationshipConstraint, Schema,
  SchemaItem, SchemaItemKey, strengthDirectionToString, strengthToString, Unit,
} from "@itwin/ecschema-metadata";
import { formatTraitsToArray, formatTypeToString, scientificTypeToString, showSignOptionToString } from "@itwin/core-quantity";
import { ISchemaCompareReporter } from "./SchemaCompareReporter";
import { SchemaCompareResultDelegate } from "./SchemaCompareResultDelegate";
import { SchemaCompareVisitor } from "./SchemaCompareVisitor";
import { SchemaWalker } from "./SchemaWalker";

/**
 * Enum that identifies if Schema A is being iterated (Forward) or
 * Schema B is being iterated (Backward);
 * @alpha
 */
export enum SchemaCompareDirection {
  Forward = 0,
  Backward = 1,
}
/**
 * Interface for comparing EC Schemas.
 * @alpha
 */
export interface ISchemaComparer {
  compareSchemas(schemaA: Schema, schemaB: Schema): void;
  compareSchemaProps(schemaA: Schema, schemaB: Schema): void;
  compareSchemaItems(schemaItemA: SchemaItem, schemaItemB: SchemaItem | undefined): void;
  compareClasses(classA: AnyClass, classB: AnyClass | undefined): void;
  compareProperties(propertyA: AnyProperty, propertyB: AnyProperty | undefined): void;
  compareEntityClasses(entityA: EntityClass, entityB: EntityClass | undefined): void;
  compareMixins(mixinA: Mixin, mixinB: Mixin | undefined): void;
  compareRelationshipClasses(relationshipClassA: RelationshipClass, relationshipClassB: RelationshipClass | undefined): void;
  compareRelationshipConstraints(relationshipConstraintA: RelationshipConstraint, relationshipConstraintB: RelationshipConstraint | undefined): void;
  compareCustomAttributeClasses(customAttributeClassA: CustomAttributeClass, customAttributeClassB: CustomAttributeClass | undefined): void;
  compareCustomAttributeContainers(containerA: CustomAttributeContainerProps, containerB: CustomAttributeContainerProps | undefined): void;
  compareEnumerations(enumA: Enumeration, enumB: Enumeration | undefined): void;
  compareKindOfQuantities(koqA: KindOfQuantity, koqB: KindOfQuantity | undefined): void;
  comparePropertyCategories(categoryA: PropertyCategory, categoryB: PropertyCategory | undefined): void;
  compareFormats(formatA: Format, formatB: Format | undefined): void;
  compareUnits(unitA: Unit, unitB: Unit | undefined): void;
  compareInvertedUnits(invertedUnitA: InvertedUnit, invertedUnitB: InvertedUnit | undefined): void;
  comparePhenomenons(phenomenonA: Phenomenon, phenomenonB: Phenomenon | undefined): void;
  compareConstants(constantA: Constant, constantB: Constant | undefined): void;
}

function labelsMatch(label1?: string, label2?: string) {
  label1 = label1 === undefined ? "" : label1;
  label2 = label2 === undefined ? "" : label2;
  return label1 === label2;
}

/**
 * Compares EC Schemas and reports differences using the [[IDiagnosticReporter]] objects
 * specified.
 * @alpha
 */
export class SchemaComparer {
  private _compareDirection: SchemaCompareDirection;
  private _reporter!: SchemaCompareResultDelegate;
  private _reporters: ISchemaCompareReporter[];

  /**
   * Initializes a new SchemaComparer instance.
   * @param reporters The [[IDiagnosticReporter]] object(s) to use to report the results.
   */
  constructor(...reporters: ISchemaCompareReporter[]) {
    this._compareDirection = SchemaCompareDirection.Forward;
    this._reporters = reporters;
  }

  /**
   * Compares two schemas to identify differences.
   * @param schemaA The first Schema.
   * @param schemaB The second Schema.
   */
  public async compareSchemas(schemaA: Schema, schemaB: Schema) {
    this._reporter = new SchemaCompareResultDelegate(schemaA, schemaB, ...this._reporters);
    let visitor = new SchemaCompareVisitor(this, schemaB);
    let walker = new SchemaWalker(visitor);
    await walker.traverseSchema(schemaA);

    this._compareDirection = SchemaCompareDirection.Backward;

    visitor = new SchemaCompareVisitor(this, schemaA);
    walker = new SchemaWalker(visitor);
    await walker.traverseSchema(schemaB);

    this._compareDirection = SchemaCompareDirection.Forward;
    this._reporter.compareComplete();
  }

  /**
   * Compares two schemas to identify differences between property values.
   * @param schemaA The first Schema.
   * @param schemaB The second Schema.
   */
  public async compareSchemaProps(schemaA: Schema, schemaB: Schema): Promise<void> {
    const promises: Array<Promise<void>> = [];
    for (const ref of schemaA.references) {
      const refB = await schemaB.getReference(ref.fullName);
      if (!refB)
        promises.push(this._reporter.reportSchemaReferenceMissing(schemaA, ref, this._compareDirection));
      else if (!refB.schemaKey.matches(ref.schemaKey))
        promises.push(this._reporter.reportSchemaReferenceDelta(schemaA, ref, ref.schemaKey.version.toString(), refB.schemaKey.version.toString(), this._compareDirection));
    }

    if (this._compareDirection === SchemaCompareDirection.Backward)
      return;

    if (schemaA.schemaKey.toString() !== schemaB.schemaKey.toString())
      promises.push(this._reporter.reportSchemaDelta(schemaA, "schemaKey", schemaA.schemaKey.toString(), schemaB.schemaKey.toString(), this._compareDirection));

    if (schemaA.alias !== schemaB.alias)
      promises.push(this._reporter.reportSchemaDelta(schemaA, "alias", schemaA.alias, schemaB.alias, this._compareDirection));

    if (schemaA.description !== schemaB.description)
      promises.push(this._reporter.reportSchemaDelta(schemaA, "description", schemaA.description, schemaB.description, this._compareDirection));

    if (schemaA.label !== schemaB.label)
      promises.push(this._reporter.reportSchemaDelta(schemaA, "label", schemaA.label, schemaB.label, this._compareDirection));

    await Promise.all(promises);
  }

  /**
   * Compares two SchemaItems to identify differences between property values.
   * @param schemaItemA The first SchemaItem.
   * @param schemaItemB The second SchemaItem.
   */
  public async compareSchemaItems(schemaItemA: SchemaItem, schemaItemB: SchemaItem | undefined): Promise<void> {
    const promises: Array<Promise<void>> = [];
    if (!schemaItemB) {
      promises.push(this._reporter.reportSchemaItemMissing(schemaItemA, this._compareDirection));
      await Promise.all(promises);
      return;
    }

    if (this._compareDirection === SchemaCompareDirection.Backward)
      return;

    if (schemaItemA.description !== schemaItemB.description)
      promises.push(this._reporter.reportSchemaItemDelta(schemaItemA, "description", schemaItemA.description, schemaItemB.description, this._compareDirection));

    if (!labelsMatch(schemaItemA.label, schemaItemB.label))
      promises.push(this._reporter.reportSchemaItemDelta(schemaItemA, "label", schemaItemA.label, schemaItemB.label, this._compareDirection));

    if (schemaItemA.schemaItemType !== schemaItemB.schemaItemType) {
      const aType = schemaItemA.schemaItemType;
      const bType = schemaItemB.schemaItemType;
      promises.push(this._reporter.reportSchemaItemDelta(schemaItemA, "schemaItemType", aType, bType, this._compareDirection));
    }

    await Promise.all(promises);
  }

  /**
   * Compares two ECClasses to identify differences between property values.
   * @param classA The first ECClass.
   * @param classB The second ECClass.
   */
  public async compareClasses(classA: AnyClass, classB: AnyClass | undefined): Promise<void> {
    if (this._compareDirection === SchemaCompareDirection.Backward || !classB)
      return;

    const promises: Array<Promise<void>> = [];

    if (classA.modifier !== classB.modifier) {
      const aMod = classModifierToString(classA.modifier);
      const bMod = classModifierToString(classB.modifier);
      promises.push(this._reporter.reportClassDelta(classA, "modifier", aMod, bMod, this._compareDirection));
    }

    if (classA.baseClass || classB.baseClass) {
      const fullNameA = classA.baseClass?.fullName;
      const fullNameB = classB.baseClass?.fullName;

      if (fullNameA !== fullNameB) {
        const areSameByName = this.areItemsSameByName(classA.baseClass, classB.baseClass, classA.schema.name, classB.schema.name);
        if (!areSameByName) {
          const baseA = await classA.baseClass as AnyClass;
          const baseB = await classB.baseClass as AnyClass;
          promises.push(this._reporter.reportBaseClassDelta(classA, baseA, baseB, this._compareDirection));
        }
      }
    }

    await Promise.all(promises);
  }

  /**
   * Compares two ECProperties to identify differences between property values.
   * @param propertyA The first ECProperty.
   * @param propertyB The second ECProperty.
   */
  public async compareProperties(propertyA: AnyProperty, propertyB: AnyProperty | undefined): Promise<void> {
    const promises: Array<Promise<void>> = [];

    if (!propertyB) {
      promises.push(this._reporter.reportPropertyMissing(propertyA, this._compareDirection));
      await Promise.all(promises);
      return;
    }

    if (this._compareDirection === SchemaCompareDirection.Backward)
      return;

    if (!labelsMatch(propertyA.label, propertyB.label))
      promises.push(this._reporter.reportPropertyDelta(propertyA, "label", propertyA.label, propertyB.label, this._compareDirection));

    if (propertyA.description !== propertyB.description)
      promises.push(this._reporter.reportPropertyDelta(propertyA, "description", propertyA.description, propertyB.description, this._compareDirection));

    if (propertyA.isReadOnly !== propertyB.isReadOnly)
      promises.push(this._reporter.reportPropertyDelta(propertyA, "isReadOnly", propertyA.isReadOnly, propertyB.isReadOnly, this._compareDirection));

    if (propertyA.priority !== propertyB.priority)
      promises.push(this._reporter.reportPropertyDelta(propertyA, "priority", propertyA.priority, propertyB.priority, this._compareDirection));

    if (propertyA.category || propertyB.category) {
      const catKeyA = propertyA.category?.fullName;
      const catKeyB = propertyB.category?.fullName;
      if (catKeyA !== catKeyB) {
        const areSameByName = this.areItemsSameByName(propertyA.category, propertyB.category, propertyA.schema.name, propertyB.schema.name);
        if (!areSameByName)
          promises.push(this._reporter.reportPropertyDelta(propertyA, "category", catKeyA, catKeyB, this._compareDirection));
      }
    }

    if (propertyA.kindOfQuantity || propertyB.kindOfQuantity) {
      const koqKeyA = propertyA.kindOfQuantity?.fullName;
      const koqKeyB = propertyB.kindOfQuantity?.fullName;
      if (koqKeyA !== koqKeyB) {
        const areSameByName = this.areItemsSameByName(propertyA.kindOfQuantity, propertyB.kindOfQuantity, propertyA.schema.name, propertyB.schema.name);
        if (!areSameByName)
          promises.push(this._reporter.reportPropertyDelta(propertyA, "kindOfQuantity", koqKeyA, koqKeyB, this._compareDirection));
      }
    }

    promises.push(this.comparePropertyType(propertyA, propertyB));
    await Promise.all(promises);
  }

  /**
   * Compares two EntityClass objects to identify differences between property values.
   * @param entityA
   * @param entityB
   */
  public async compareEntityClasses(entityA: EntityClass, entityB: EntityClass | undefined): Promise<void> {
    const promises: Array<Promise<void>> = [];
    if (entityB) {
      for (const mixinA of entityA.mixins) {
        if (-1 === entityB.mixins.findIndex((mixinB) => this.areItemsSameByName(mixinA, mixinB, entityA.schema.name, entityB.schema.name)))
          promises.push(this._reporter.reportEntityMixinMissing(entityA, await mixinA, this._compareDirection));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Compares two Mixin objects to identify differences between property values.
   * @param mixinA
   * @param mixinB
   */
  public async compareMixins(mixinA: Mixin, mixinB: Mixin | undefined): Promise<void> {
    if (this._compareDirection === SchemaCompareDirection.Backward || !mixinB)
      return;

    if (mixinA.appliesTo || mixinB.appliesTo) {
      const appliesToA = mixinA.appliesTo?.fullName;
      const appliesToB = mixinB.appliesTo?.fullName;
      if (appliesToA !== appliesToB) {
        const areSameByName = this.areItemsSameByName(mixinA.appliesTo, mixinB.appliesTo, mixinA.schema.name, mixinB.schema.name);
        if (!areSameByName)
          await this._reporter.reportMixinDelta(mixinA, "appliesTo", appliesToA, appliesToB, this._compareDirection);
      }
    }
  }

  /**
   * Compares two RelationshipClass objects to identify differences between property values.
   * @param relationshipA
   * @param relationshipB
   */
  public async compareRelationshipClasses(relationshipA: RelationshipClass, relationshipB: RelationshipClass | undefined): Promise<void> {
    if (this._compareDirection === SchemaCompareDirection.Backward || !relationshipB)
      return;

    const promises: Array<Promise<void>> = [];

    if (relationshipA.strength !== relationshipB.strength) {
      const strengthAString = strengthToString(relationshipA.strength);
      const strengthBString = strengthToString(relationshipB.strength);
      promises.push(this._reporter.reportRelationshipClassDelta(relationshipA, "strength", strengthAString, strengthBString, this._compareDirection));
    }

    if (relationshipA.strengthDirection !== relationshipB.strengthDirection) {
      const directionAString = strengthDirectionToString(relationshipA.strengthDirection);
      const directionBString = strengthDirectionToString(relationshipB.strengthDirection);
      promises.push(this._reporter.reportRelationshipClassDelta(relationshipA, "strengthDirection", directionAString, directionBString, this._compareDirection));
    }

    await Promise.all(promises);
  }

  /**
   * Compares two RelationshipConstraint objects to identify differences between property values.
   * @param relationshipConstraintA
   * @param relationshipConstraintB
   */
  public async compareRelationshipConstraints(constraintA: RelationshipConstraint, constraintB: RelationshipConstraint | undefined): Promise<void> {
    const promises: Array<Promise<void>> = [];

    if (constraintB && constraintA.constraintClasses) {
      for (const classA of constraintA.constraintClasses) {
        if (!constraintB.constraintClasses || -1 === constraintB.constraintClasses.findIndex((classB) =>
          this.areItemsSameByName(classA, classB, constraintA.schema.name, constraintB.schema.name)))
          promises.push(this._reporter.reportRelationshipConstraintClassMissing(constraintA, await classA, this._compareDirection));
      }
    }

    if (this._compareDirection === SchemaCompareDirection.Backward || !constraintB) {
      await Promise.all(promises);
      return;
    }

    if (constraintA.multiplicity || constraintB.multiplicity) {
      const multiplicityA = constraintA.multiplicity.toString();
      const multiplicityB = constraintB.multiplicity.toString();
      if (multiplicityA !== multiplicityB)
        promises.push(this._reporter.reportRelationshipConstraintDelta(constraintA, "multiplicity", multiplicityA, multiplicityB, this._compareDirection));
    }

    if (constraintA.roleLabel !== constraintB.roleLabel)
      promises.push(this._reporter.reportRelationshipConstraintDelta(constraintA, "roleLabel", constraintA.roleLabel, constraintB.roleLabel, this._compareDirection));

    if (constraintA.polymorphic !== constraintB.polymorphic)
      promises.push(this._reporter.reportRelationshipConstraintDelta(constraintA, "polymorphic", constraintA.polymorphic, constraintB.polymorphic, this._compareDirection));

    if (constraintA.abstractConstraint || constraintB.abstractConstraint) {
      const abstractA = constraintA.abstractConstraint?.fullName;
      const abstractB = constraintB.abstractConstraint?.fullName;
      if (abstractA !== abstractB) {
        const areSameByName = this.areItemsSameByName(constraintA.abstractConstraint, constraintB.abstractConstraint, constraintA.schema.name, constraintB.schema.name);
        if (!areSameByName) {
          promises.push(this._reporter.reportRelationshipConstraintDelta(constraintA, "abstractConstraint", abstractA, abstractB, this._compareDirection));
        }
      }
    }

    await Promise.all(promises);
  }

  /**
   * Compares two CustomAttributeClass objects to identify differences between property values.
   * @param customAttributeClassA
   * @param customAttributeClassB
   */
  public async compareCustomAttributeClasses(customAttributeClassA: CustomAttributeClass, customAttributeClassB: CustomAttributeClass | undefined): Promise<void> {
    if (this._compareDirection === SchemaCompareDirection.Backward || !customAttributeClassB)
      return;

    if (customAttributeClassA.containerType !== customAttributeClassB.containerType) {
      const typeA = containerTypeToString(customAttributeClassA.containerType);
      const typeB = containerTypeToString(customAttributeClassB.containerType);
      await this._reporter.reportCustomAttributeClassDelta(customAttributeClassA, "appliesTo", typeA, typeB, this._compareDirection);
    }
  }

  /**
   * Compares two CustomAttributeContainerProps objects to identify differences between property values.
   * @param containerA
   * @param containerB
   */
  public async compareCustomAttributeContainers(containerA: CustomAttributeContainerProps, containerB: CustomAttributeContainerProps | undefined): Promise<void> {
    const promises: Array<Promise<void>> = [];

    if (containerB && containerA.customAttributes) {
      for (const ca of containerA.customAttributes) {
        if (!containerB.customAttributes || !this.containerHasClass(ca[1], containerA, containerB))
          promises.push(this._reporter.reportCustomAttributeInstanceClassMissing(containerA, ca[1], this._compareDirection));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Compares two Enumeration objects to identify differences between property values.
   * @param enumA
   * @param enumB
   */
  public async compareEnumerations(enumA: Enumeration, enumB: Enumeration | undefined): Promise<void> {
    const promises: Array<Promise<void>> = [];

    if (enumB) {
      for (const enumeratorA of enumA.enumerators) {
        const enumeratorB = enumB.enumerators.find((e) => e.name === enumeratorA.name);
        if (!enumeratorB) {
          promises.push(this._reporter.reportEnumeratorMissing(enumA, enumeratorA, this._compareDirection));
        } else if (this._compareDirection === SchemaCompareDirection.Forward) {
          promises.push(this.compareEnumerators(enumeratorA, enumeratorB, enumA, enumB));
        }
      }
    }

    if (this._compareDirection === SchemaCompareDirection.Backward || !enumB) {
      await Promise.all(promises);
      return;
    }
    if (enumA.type !== enumB.type) {
      const typeAString = enumA.type ? primitiveTypeToString(enumA.type) : undefined;
      const typeBString = enumB.type ? primitiveTypeToString(enumB.type) : undefined;
      promises.push(this._reporter.reportEnumerationDelta(enumA, "type", typeAString, typeBString, this._compareDirection));
    }

    if (enumA.isStrict !== enumB.isStrict)
      promises.push(this._reporter.reportEnumerationDelta(enumA, "isStrict", enumA.isStrict, enumB.isStrict, this._compareDirection));

    await Promise.all(promises);
  }

  /**
   * Compares two KindOfQuantity objects to identify differences between property values.
   * @param koqA
   * @param koqB
   */
  public async compareKindOfQuantities(koqA: KindOfQuantity, koqB: KindOfQuantity | undefined): Promise<void> {
    const promises: Array<Promise<void>> = [];

    if (koqB && koqA.presentationFormats) {
      for (const unitA of koqA.presentationFormats) {
        if (-1 === koqB.presentationFormats.findIndex((unitB) => this.areOverrideFormatsSameByName(unitA, unitB, koqA.schema.name, koqB.schema.name)))
          promises.push(this._reporter.reportPresentationUnitMissing(koqA, unitA, this._compareDirection));
      }
    }

    if (this._compareDirection === SchemaCompareDirection.Backward || !koqB) {
      await Promise.all(promises);
      return;
    }

    if (koqA.relativeError !== koqB.relativeError) {
      promises.push(this._reporter.reportKoqDelta(koqA, "relativeError", koqA.relativeError, koqB.relativeError, this._compareDirection));
    }

    if (koqA.persistenceUnit || koqB.persistenceUnit) {
      const unitNameA = koqA.persistenceUnit?.fullName;
      const unitNameB = koqB.persistenceUnit?.fullName;
      if (unitNameA !== unitNameB) {
        const eqByName = this.areItemsSameByName(koqA.persistenceUnit, koqB.persistenceUnit, koqA.schema.name, koqB.schema.name);
        if (!eqByName)
          promises.push(this._reporter.reportKoqDelta(koqA, "persistenceUnit", unitNameA, unitNameB, this._compareDirection));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Compares two PropertyCategory objects to identify differences between property values.
   * @param categoryA
   * @param categoryB
   */
  public async comparePropertyCategories(categoryA: PropertyCategory, categoryB: PropertyCategory | undefined): Promise<void> {
    if (this._compareDirection === SchemaCompareDirection.Backward || !categoryB)
      return;

    if (categoryA.priority !== categoryB.priority)
      await this._reporter.reportPropertyCategoryDelta(categoryA, "priority", categoryA.priority, categoryB.priority, this._compareDirection);
  }

  /**
   * Compares two Format objects to identify differences between property values.
   * @param formatA
   * @param formatB
   */
  public async compareFormats(formatA: Format, formatB: Format | undefined): Promise<void> {
    const promises: Array<Promise<void>> = [];

    promises.push(this.compareFormatUnits(formatA, formatB));

    if (this._compareDirection === SchemaCompareDirection.Backward || !formatB) {
      await Promise.all(promises);
      return;
    }

    if (formatA.roundFactor !== formatB.roundFactor)
      promises.push(this._reporter.reportFormatDelta(formatA, "roundFactor", formatA.roundFactor, formatB.roundFactor, this._compareDirection));

    if (formatA.type !== formatB.type) {
      const typeAString = formatTypeToString(formatA.type);
      const typeBString = formatTypeToString(formatB.type);
      promises.push(this._reporter.reportFormatDelta(formatA, "type", typeAString, typeBString, this._compareDirection));
    }

    if (formatA.precision !== formatB.precision)
      promises.push(this._reporter.reportFormatDelta(formatA, "precision", formatA.precision, formatB.precision, this._compareDirection));

    if (formatA.minWidth !== formatB.minWidth)
      promises.push(this._reporter.reportFormatDelta(formatA, "minWidth", formatA.minWidth, formatB.minWidth, this._compareDirection));

    if (formatA.scientificType !== formatB.scientificType) {
      const typeAString = formatA.scientificType !== undefined ? scientificTypeToString(formatA.scientificType) : undefined;
      const typeBString = formatB.scientificType !== undefined ? scientificTypeToString(formatB.scientificType) : undefined;
      promises.push(this._reporter.reportFormatDelta(formatA, "scientificType", typeAString, typeBString, this._compareDirection));
    }

    if (formatA.showSignOption !== formatB.showSignOption) {
      const optionA = showSignOptionToString(formatA.showSignOption);
      const optionB = showSignOptionToString(formatB.showSignOption);
      promises.push(this._reporter.reportFormatDelta(formatA, "showSignOption", optionA, optionB, this._compareDirection));
    }

    if (formatA.decimalSeparator !== formatB.decimalSeparator)
      promises.push(this._reporter.reportFormatDelta(formatA, "decimalSeparator", formatA.decimalSeparator, formatB.decimalSeparator, this._compareDirection));

    if (formatA.thousandSeparator !== formatB.thousandSeparator)
      promises.push(this._reporter.reportFormatDelta(formatA, "thousandSeparator", formatA.thousandSeparator, formatB.thousandSeparator, this._compareDirection));

    if (formatA.uomSeparator !== formatB.uomSeparator)
      promises.push(this._reporter.reportFormatDelta(formatA, "uomSeparator", formatA.uomSeparator, formatB.uomSeparator, this._compareDirection));

    if (formatA.stationSeparator !== formatB.stationSeparator)
      promises.push(this._reporter.reportFormatDelta(formatA, "stationSeparator", formatA.stationSeparator, formatB.stationSeparator, this._compareDirection));

    if (formatA.stationOffsetSize !== formatB.stationOffsetSize)
      promises.push(this._reporter.reportFormatDelta(formatA, "stationOffsetSize", formatA.stationOffsetSize, formatB.stationOffsetSize, this._compareDirection));

    if (formatA.formatTraits !== formatB.formatTraits) {
      const traitsA = formatTraitsToArray(formatA.formatTraits);
      const traitsB = formatTraitsToArray(formatB.formatTraits);
      promises.push(this._reporter.reportFormatDelta(formatA, "formatTraits", traitsA.toString(), traitsB.toString(), this._compareDirection));
    }

    if (formatA.spacer !== formatB.spacer)
      promises.push(this._reporter.reportFormatDelta(formatA, "spacer", formatA.spacer, formatB.spacer, this._compareDirection));

    if (formatA.includeZero !== formatB.includeZero)
      promises.push(this._reporter.reportFormatDelta(formatA, "includeZero", formatA.includeZero, formatB.includeZero, this._compareDirection));

    await Promise.all(promises);
  }

  /**
   * Compares two Unit objects to identify differences between property values.
   * @param unitA
   * @param unitB
   */
  public async compareUnits(unitA: Unit, unitB: Unit | undefined): Promise<void> {
    if (this._compareDirection === SchemaCompareDirection.Backward || !unitB)
      return;

    const promises: Array<Promise<void>> = [];

    if (unitA.phenomenon || unitB.phenomenon) {
      const fullNameA = unitA.phenomenon?.fullName;
      const fullNameB = unitB.phenomenon?.fullName;
      if (fullNameA !== fullNameB) {
        const eqByName = this.areItemsSameByName(unitA.phenomenon, unitB.phenomenon, unitA.schema.name, unitB.schema.name);
        if (!eqByName)
          promises.push(this._reporter.reportUnitDelta(unitA, "phenomenon", fullNameA, fullNameB, this._compareDirection));
      }
    }

    if (unitA.unitSystem || unitB.unitSystem) {
      const fullNameA = unitA.unitSystem?.fullName;
      const fullNameB = unitB.unitSystem?.fullName;
      if (fullNameA !== fullNameB) {
        const eqByName = this.areItemsSameByName(unitA.unitSystem, unitB.unitSystem, unitA.schema.name, unitB.schema.name);
        if (!eqByName)
          promises.push(this._reporter.reportUnitDelta(unitA, "unitSystem", fullNameA, fullNameB, this._compareDirection));
      }
    }

    if (unitA.definition !== unitB.definition)
      promises.push(this._reporter.reportUnitDelta(unitA, "definition", unitA.definition, unitB.definition, this._compareDirection));

    if (unitA.numerator !== unitB.numerator)
      promises.push(this._reporter.reportUnitDelta(unitA, "numerator", unitA.numerator, unitB.numerator, this._compareDirection));

    if (unitA.denominator !== unitB.denominator)
      promises.push(this._reporter.reportUnitDelta(unitA, "denominator", unitA.denominator, unitB.denominator, this._compareDirection));

    if (unitA.offset !== unitB.offset)
      promises.push(this._reporter.reportUnitDelta(unitA, "offset", unitA.offset, unitB.offset, this._compareDirection));

    await Promise.all(promises);
  }

  /**
   * Compares two InvertedUnit objects to identify differences between property values.
   * @param invertedUnitA
   * @param invertedUnitB
   */
  public async compareInvertedUnits(invertedUnitA: InvertedUnit, invertedUnitB: InvertedUnit | undefined): Promise<void> {
    if (this._compareDirection === SchemaCompareDirection.Backward || !invertedUnitB)
      return;

    const promises: Array<Promise<void>> = [];

    if (invertedUnitA.invertsUnit || invertedUnitB.invertsUnit) {
      const fullNameA = invertedUnitA.invertsUnit?.fullName;
      const fullNameB = invertedUnitB.invertsUnit?.fullName;
      if (fullNameA !== fullNameB) {
        const eqByName = this.areItemsSameByName(invertedUnitA.invertsUnit, invertedUnitB.invertsUnit, invertedUnitA.schema.name, invertedUnitB.schema.name);
        if (!eqByName)
          promises.push(this._reporter.reportInvertedUnitDelta(invertedUnitA, "invertsUnit", fullNameA, fullNameB, this._compareDirection));
      }
    }

    if (invertedUnitA.unitSystem || invertedUnitB.unitSystem) {
      const fullNameA = invertedUnitA.unitSystem?.fullName;
      const fullNameB = invertedUnitB.unitSystem?.fullName;
      if (fullNameA !== fullNameB) {
        const eqByName = this.areItemsSameByName(invertedUnitA.unitSystem, invertedUnitB.unitSystem, invertedUnitA.schema.name, invertedUnitB.schema.name);
        if (!eqByName)
          promises.push(this._reporter.reportInvertedUnitDelta(invertedUnitA, "unitSystem", fullNameA, fullNameB, this._compareDirection));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Compares two Phenomenon objects to identify differences between property values.
   * @param phenomenonA
   * @param phenomenonB
   */
  public async comparePhenomenons(phenomenonA: Phenomenon, phenomenonB: Phenomenon | undefined): Promise<void> {
    if (this._compareDirection === SchemaCompareDirection.Backward || !phenomenonB)
      return;

    if (phenomenonA.definition !== phenomenonB.definition)
      await this._reporter.reportPhenomenonDelta(phenomenonA, "definition", phenomenonA.definition, phenomenonB.definition, this._compareDirection);
  }

  /**
   * Compares two Constant objects to identify differences between property values.
   * @param constantA
   * @param constantB
   */
  public async compareConstants(constantA: Constant, constantB: Constant | undefined): Promise<void> {
    if (this._compareDirection === SchemaCompareDirection.Backward || !constantB)
      return;

    const promises: Array<Promise<void>> = [];

    if (constantA.phenomenon || constantB.phenomenon) {
      const fullNameA = constantA.phenomenon?.fullName;
      const fullNameB = constantB.phenomenon?.fullName;
      if (fullNameA !== fullNameB) {
        const eqByName = this.areItemsSameByName(constantA.phenomenon, constantB.phenomenon, constantA.schema.name, constantB.schema.name);
        if (!eqByName)
          promises.push(this._reporter.reportConstantDelta(constantA, "phenomenon", fullNameA, fullNameB, this._compareDirection));
      }
    }

    if (constantA.definition !== constantB.definition)
      promises.push(this._reporter.reportConstantDelta(constantA, "definition", constantA.definition, constantB.definition, this._compareDirection));

    if (constantA.numerator !== constantB.numerator)
      promises.push(this._reporter.reportConstantDelta(constantA, "numerator", constantA.numerator, constantB.numerator, this._compareDirection));

    if (constantA.denominator !== constantB.denominator)
      promises.push(this._reporter.reportConstantDelta(constantA, "denominator", constantA.denominator, constantB.denominator, this._compareDirection));

    await Promise.all(promises);
  }

  private async comparePropertyType(propertyA: AnyProperty, propertyB: AnyProperty): Promise<void> {
    const promises: Array<Promise<void>> = [];

    const propertyTypeA = propertyTypeToString(propertyA.propertyType);
    const propertyTypeB = propertyTypeToString(propertyB.propertyType);
    if (propertyTypeA !== propertyTypeB) {
      promises.push(this._reporter.reportPropertyDelta(propertyA, "type", propertyTypeA, propertyTypeB, this._compareDirection));
    }

    if (propertyA.isArray()) {
      const minOccursB = propertyB.isArray() ? propertyB.minOccurs : undefined;
      if (propertyA.minOccurs !== minOccursB) {
        promises.push(this._reporter.reportPropertyDelta(propertyA, "minOccurs", propertyA.minOccurs, minOccursB, this._compareDirection));
      }

      const maxOccursB = propertyB.isArray() ? propertyB.maxOccurs : undefined;
      if (propertyA.maxOccurs !== maxOccursB) {
        promises.push(this._reporter.reportPropertyDelta(propertyA, "maxOccurs", propertyA.maxOccurs, maxOccursB, this._compareDirection));
      }
    }

    if (propertyA.isEnumeration()) {
      const enumerationB = propertyB.isEnumeration() ? propertyB.enumeration : undefined;
      if (propertyA.enumeration || enumerationB) {
        const enumA = propertyA.enumeration?.fullName;
        const enumB = enumerationB?.fullName;
        if (enumA !== enumB) {
          const areSameByName = this.areItemsSameByName(propertyA.enumeration, enumerationB, propertyA.schema.name, propertyB.schema.name);
          if (!areSameByName) {
            promises.push(this._reporter.reportPropertyDelta(propertyA, "enumeration", enumA, enumB, this._compareDirection));
          }
        }
      }
    }

    if (propertyA.isNavigation()) {
      const strengthDirectionB = propertyB.isNavigation() ? propertyB.direction : undefined;
      if (propertyA.direction !== strengthDirectionB) {
        const dirA = strengthDirectionToString(propertyA.direction);
        const dirB = strengthDirectionB !== undefined ? strengthDirectionToString(strengthDirectionB) : undefined;
        promises.push(this._reporter.reportPropertyDelta(propertyA, "direction", dirA, dirB, this._compareDirection));
      }

      if (propertyA.relationshipClass) { // eslint-disable-line @typescript-eslint/no-misused-promises
        const relationshipClassB = propertyB.isNavigation() ? propertyB.relationshipClass : undefined;
        const relA = propertyA.relationshipClass.fullName;
        const relB = relationshipClassB ? relationshipClassB.fullName : undefined;
        if (relA !== relB){
          const areSameByName = this.areItemsSameByName(propertyA.relationshipClass, relationshipClassB, propertyA.schema.name, propertyB.schema.name);
          if(!areSameByName)
            promises.push(this._reporter.reportPropertyDelta(propertyA, "relationshipClass", relA, relB, this._compareDirection));
        }
      }
    }

    if (propertyA.isPrimitive()) {
      const primitiveTypeB = propertyB.isPrimitive() ? propertyB.primitiveType : undefined;
      if (propertyA.primitiveType !== primitiveTypeB) {
        const aType = primitiveTypeToString(propertyA.primitiveType);
        const bType = primitiveTypeB !== undefined ? primitiveTypeToString(primitiveTypeB) : undefined;
        promises.push(this._reporter.reportPropertyDelta(propertyA, "primitiveType", aType, bType, this._compareDirection));
      }

      const minLengthB = propertyB.isPrimitive() ? propertyB.minLength : undefined;
      if (propertyA.minLength !== minLengthB) {
        promises.push(this._reporter.reportPropertyDelta(propertyA, "minLength", propertyA.minLength, minLengthB, this._compareDirection));
      }

      // valid for primitive and enumeration properties
      const maxLengthB = propertyB.isPrimitive() ? propertyB.maxLength : undefined;
      if (propertyA.maxLength !== maxLengthB) {
        promises.push(this._reporter.reportPropertyDelta(propertyA, "maxLength", propertyA.maxLength, maxLengthB, this._compareDirection));
      }

      const minValueB = propertyB.isPrimitive() ? propertyB.minValue : undefined;
      if (propertyA.minValue !== minValueB) {
        promises.push(this._reporter.reportPropertyDelta(propertyA, "minValue", propertyA.minValue, minValueB, this._compareDirection));
      }

      const maxValueB = propertyB.isPrimitive() ? propertyB.maxValue : undefined;
      if (propertyA.maxValue !== maxValueB) {
        promises.push(this._reporter.reportPropertyDelta(propertyA, "maxValue", propertyA.maxValue, maxValueB, this._compareDirection));
      }

      const extendedTypeNameB = propertyB.isPrimitive() ? propertyB.extendedTypeName : undefined;
      if (propertyA.extendedTypeName !== extendedTypeNameB) {
        promises.push(this._reporter.reportPropertyDelta(propertyA, "extendedTypeName", propertyA.extendedTypeName, extendedTypeNameB, this._compareDirection));
      }
    }

    if (propertyA.isStruct()) {
      const structA = propertyA.structClass;
      const structB = propertyB.isStruct() ? propertyB.structClass : undefined;
      if (structA || structB) {
        const structNameA = structA.fullName;
        const structNameB = structB?.fullName;
        if (structNameA !== structNameB) {
          const areSameByName = this.areItemsSameByName(structA.key, structB?.key, propertyA.schema.name, propertyB.schema.name);
          if (!areSameByName) {
            promises.push(this._reporter.reportPropertyDelta(propertyA, "structClass", structNameA, structNameB, this._compareDirection));
          }
        }
      }
    }

    await Promise.all(promises);
  }

  private async compareEnumerators(enumeratorA: AnyEnumerator, enumeratorB: AnyEnumerator, enumA: Enumeration, enumB: Enumeration): Promise<void> {
    const promises: Array<Promise<void>> = [];

    if (enumeratorA.description !== enumeratorB.description)
      promises.push(this._reporter.reportEnumeratorDelta(enumA, enumeratorA, "description", enumeratorA.description, enumeratorB.description, this._compareDirection));

    if (!labelsMatch(enumeratorA.label, enumeratorB.label))
      promises.push(this._reporter.reportEnumeratorDelta(enumA, enumeratorA, "label", enumeratorA.label, enumeratorB.label, this._compareDirection));

    // No need to compare values if the type is different (which will be reported separately)
    if (enumA.type === enumB.type && enumeratorA.value !== enumeratorB.value)
      promises.push(this._reporter.reportEnumeratorDelta(enumA, enumeratorA, "value", enumeratorA.value, enumeratorB.value, this._compareDirection));

    await Promise.all(promises);
  }

  private async compareFormatUnits(formatA: Format, formatB: Format | undefined): Promise<void> {
    if (!formatA.units || !formatB)
      return;

    const promises: Array<Promise<void>> = [];

    for (const unitA of formatA.units) {
      const unitB = formatB.units ? formatB.units.find((u) => this.areItemsSameByName(unitA[0], u[0], formatA.schema.name, formatB.schema.name)) : undefined;
      if (!unitB) {
        promises.push(this._reporter.reportFormatUnitMissing(formatA, unitA[0], this._compareDirection));
        continue;
      }

      if (this._compareDirection === SchemaCompareDirection.Backward)
        continue;

      if (unitA[1] !== unitB[1]) {
        const labelA = unitA[1];
        const labelB = unitB[1];
        promises.push(this._reporter.reportUnitLabelOverrideDelta(formatA, unitB[0], labelA, labelB, this._compareDirection));
      }
    }

    await Promise.all(promises);
  }

  private areOverrideFormatsSameByName(
    itemKeyA: Format | OverrideFormat,
    itemKeyB: Format | OverrideFormat,
    topLevelSchemaNameA: string,
    topLevelSchemaNameB: string | undefined ): boolean {

    if (itemKeyA.units) {
      for (const unitA of itemKeyA.units) {
        if (!itemKeyB.units
          || -1 === itemKeyB.units.findIndex((unitB) => this.areItemsSameByName(unitA[0], unitB[0], topLevelSchemaNameA, topLevelSchemaNameB)
            && unitA[1] === unitB[1]))
          return false;
      }
    }

    const itemA = OverrideFormat.isOverrideFormat(itemKeyA) ? itemKeyA.parent : itemKeyA;
    const itemB = OverrideFormat.isOverrideFormat(itemKeyB) ? itemKeyB.parent : itemKeyB;

    return itemKeyA.precision === itemKeyB.precision && this.areItemsSameByName(itemA, itemB, topLevelSchemaNameA, topLevelSchemaNameB);
  }

  /**
   * Compares two item keys.
   * @param itemKeyA item key A to compare to.
   * @param itemKeyB item key B to compare to.
   * @param topLevelSchemaNameA top level schema name in which the item A exists.
   * @param topLevelSchemaNameB top level schema name in which the item B exists.
   * @returns true if both names are the same and they come from their respective top level schema.
   */
  private areItemsSameByName(
    itemKeyA: Readonly<SchemaItemKey> | SchemaItem | undefined,
    itemKeyB: Readonly<SchemaItemKey> | SchemaItem | undefined,
    topLevelSchemaNameA: string,
    topLevelSchemaNameB: string | undefined ): boolean {

    const nameA = itemKeyA ? itemKeyA.name : undefined;
    const nameB = itemKeyB ? itemKeyB.name : undefined;

    const schemaNameA = itemKeyA
      ? SchemaItem.isSchemaItem(itemKeyA)
        ? itemKeyA.schema.name
        : itemKeyA.schemaName
      : undefined;

    const schemaNameB = itemKeyB
      ? SchemaItem.isSchemaItem(itemKeyB)
        ? itemKeyB.schema.name
        : itemKeyB.schemaName
      : undefined;

    return (nameA === nameB && schemaNameA === topLevelSchemaNameA && schemaNameB === topLevelSchemaNameB) || (nameA === nameB && schemaNameA === schemaNameB);
  }

  /**
   * Looks for same classA in containerB using key.
   * @param classNameA name of the class to look for in containerB.
   * @param containerA container which classNameA belongs to.
   * @param containerB container in which to look for classNameA.
   * @returns true if a same classA is in containerB, otherwise false.
   */
  private containerHasClass(attributeA: CustomAttribute, containerA: CustomAttributeContainerProps, containerB: CustomAttributeContainerProps): boolean {
    if (containerB && containerB.customAttributes) {
      for (const caB of containerB.customAttributes) {
        const attributeB = caB[1];
        const classItemKeyA = containerA.schema.getSchemaItemKey(attributeA.className);
        const classItemKeyB = containerB.schema.getSchemaItemKey(attributeB.className);
        if (this.areItemsSameByName(classItemKeyA, classItemKeyB, containerA.schema.name, containerB.schema.name)) {
          return Object.keys(attributeA).every((property: any) => {
            const propertyName = property.toString();
            const valueA = attributeA[propertyName];
            const valueB = attributeB[propertyName];
            return propertyName === "className"
              || valueA === valueB
              || Array.isArray(valueA) &&  Array.isArray(valueB) && valueA.length === valueB.length
                && valueA.every((val: any, idx: number) => val === valueB[idx]);
          });
        }
      }
    }
    return false;
  }
}
