/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import type { AnyDiagnostic } from "../Validation/Diagnostic";
import { SchemaCompareCodes } from "../Validation/SchemaCompareDiagnostics";
import {
  AnyECType, AnyEnumerator, AnySchemaItemProps, CustomAttribute, ECClass, ECClassModifier, Enumeration, Mixin, Property, PropertyProps,
  RelationshipConstraint, RelationshipConstraintProps, Schema, SchemaItem,
} from "@itwin/ecschema-metadata";
import {
  AnySchemaDifference,
  DifferenceType,
  SchemaClassMixinDifference,
  SchemaDifference,
  SchemaDifferences,
  SchemaEnumeratorDifference,
  SchemaItemDifference,
  SchemaPropertyDifference,
  SchemaRelationshipConstraintClassDifference,
  SchemaRelationshipConstraintDifference,
} from "./SchemaDifference";
import { ConflictCode, SchemaDifferenceConflict } from "./SchemaConflicts";

function derivedFrom(ecClass: ECClass|undefined, name: string): boolean {
  if(ecClass === undefined) {
    return false;
  }
  if(ecClass && ecClass.name === name) {
    return true;
  }
  return derivedFrom(ecClass.getBaseClassSync(), name);
}

/**
 * @internal
 */
export class SchemaDiagnosticVisitor {

  private readonly _differenceReport: SchemaDifferences;

  constructor(differenceReport: SchemaDifferences) {
    this._differenceReport = differenceReport;
  }

  private addEntry<T extends AnySchemaDifference>(entry: T): T {
    this._differenceReport.changes.push(entry);
    return entry;
  }

  private lookupEntry(changeType: DifferenceType, item: string, path?: string) {
    return this._differenceReport.changes && this._differenceReport.changes.find((change) => {
      return change.changeType === changeType
      && change.item === item
      && change.path === path;
    });
  }

  private addConflict(conflict: SchemaDifferenceConflict) {
    this._differenceReport.conflicts.push(conflict);
  }

  /**
   * Visitor function to process the schema change diagnostic object.
   * @internal
   */
  public visit(diagnostic: AnyDiagnostic) {
    switch(diagnostic.code) {
      case SchemaCompareCodes.SchemaDelta:
        return this.visitChangedSchemaProperties(diagnostic);

      case SchemaCompareCodes.SchemaReferenceMissing:
        return this.visitSchemaReference(diagnostic, "add");
      case SchemaCompareCodes.SchemaReferenceDelta:
        return this.visitSchemaReference(diagnostic, "modify");

      case SchemaCompareCodes.SchemaItemMissing:
        return this.visitMissingSchemaItem(diagnostic);

      case SchemaCompareCodes.SchemaItemDelta:
      case SchemaCompareCodes.ClassDelta:
      case SchemaCompareCodes.ConstantDelta:
      case SchemaCompareCodes.CustomAttributeClassDelta:
      case SchemaCompareCodes.FormatDelta:
      case SchemaCompareCodes.InvertedUnitDelta:
      case SchemaCompareCodes.KoqDelta:
      case SchemaCompareCodes.MixinDelta:
      case SchemaCompareCodes.PhenomenonDelta:
      case SchemaCompareCodes.PropertyCategoryDelta:
      case SchemaCompareCodes.RelationshipDelta:
      case SchemaCompareCodes.UnitDelta:
        return this.visitChangedSchemaItem(diagnostic);

      case SchemaCompareCodes.EnumerationDelta:
        return this.visitChangedEnumeration(diagnostic);

      case SchemaCompareCodes.EnumeratorDelta:
        return this.visitChangedEnumerator(diagnostic);
      case SchemaCompareCodes.EnumeratorMissing:
        return this.visitMissingEnumerator(diagnostic);

      case SchemaCompareCodes.BaseClassDelta:
        return this.visitMissingBaseClass(diagnostic);
      case SchemaCompareCodes.EntityMixinMissing:
        return this.visitMissingMixinOnClass(diagnostic);
      case SchemaCompareCodes.PropertyDelta:
        return this.visitChangedProperty(diagnostic);
      case SchemaCompareCodes.PropertyMissing:
        return this.visitMissingProperty(diagnostic);

      case SchemaCompareCodes.RelationshipConstraintClassMissing:
        return this.visitMissingRelationshipConstraintClass(diagnostic);
      case SchemaCompareCodes.RelationshipConstraintDelta:
        return this.visitChangedRelationshipConstraint(diagnostic);

      case SchemaCompareCodes.CustomAttributeInstanceClassMissing:
        return this.visitMissingCustomAttributeInstance(diagnostic);

      // Currently not handled...
      case SchemaCompareCodes.FormatUnitMissing:
      case SchemaCompareCodes.PresentationUnitMissing:
      case SchemaCompareCodes.UnitLabelOverrideDelta:
        break;
    }
    return;
  }

  private visitChangedSchemaProperties(diagnostic: AnyDiagnostic) {
    let modifyEntry = this.lookupEntry("modify", "schema") as SchemaDifference;
    let hasChanges = false;
    if(!modifyEntry) {
      modifyEntry = {
        changeType: "modify",
        item: "schema",
        json: {},
      };
    }

    // Only label and description are taken from the source schema. If the schema name or alias
    // differs, those are ignored for now.
    const [propertyName, propertyValue] = diagnostic.messageArgs as [string, any];
    switch(propertyName) {
      case "label":
        modifyEntry.json.label = propertyValue;
        hasChanges = true;
        break;
      case "description":
        modifyEntry.json.description = propertyValue;
        hasChanges = true;
        break;
    }

    if(hasChanges) {
      this.addEntry(modifyEntry);
    }
  }

  private visitMissingSchemaItem(diagnostic: AnyDiagnostic) {
    const schemaItem = diagnostic.ecDefinition as SchemaItem;
    this.addEntry({
      changeType: "add",
      item: schemaItem.name,
      json: schemaItem.toJSON(),
    });
  }

  private visitChangedSchemaItem(diagnostic: AnyDiagnostic) {
    const schemaItem = diagnostic.ecDefinition as SchemaItem;
    if(this.lookupEntry("add", schemaItem.name)) {
      return;
    }

    const [propertyName, sourceValue, targetValue] = diagnostic.messageArgs as [keyof AnySchemaItemProps, any, any];
    if(propertyName === "schemaItemType") {
      return this.addConflict({
        code: ConflictCode.ConflictingItemName,
        item: schemaItem.name,
        source: sourceValue,
        target: targetValue,
        description: "Target schema already contains a schema item with the name but different type.",
      });
    }

    let modifyEntry = this.lookupEntry("modify", schemaItem.name) as SchemaItemDifference;
    if(!modifyEntry) {
      modifyEntry = this.addEntry({
        changeType: "modify",
        item: schemaItem.name,
        json: {},
      });
    }

    if(sourceValue === undefined) {
      modifyEntry.json[propertyName] = sourceValue;
    }
  }

  private visitChangedEnumeration(diagnostic: AnyDiagnostic) {
    const enumeration = diagnostic.ecDefinition as Enumeration;
    if(this.lookupEntry("add", enumeration.name)) {
      return;
    }

    const [propertyName, sourceValue, targetValue] = diagnostic.messageArgs as [string, string, string];
    if(propertyName === "type") {
      return this.addConflict({
        code:    ConflictCode.ConflictingEnumerationType,
        item:    enumeration.name,
        source:  sourceValue,
        target:  targetValue,
        description: "Enumeration has a different primitive type.",
      });
    }

    return this.visitChangedSchemaItem(diagnostic);
  }

  private visitMissingEnumerator(diagnostic: AnyDiagnostic) {
    const schemaItem = diagnostic.ecDefinition as SchemaItem;
    if(this.lookupEntry("add", schemaItem.name)) {
      return;
    }

    const [enumerator] = diagnostic.messageArgs as [AnyEnumerator];
    this.addEntry({
      changeType: "add",
      item: schemaItem.name,
      path: "$enumerators",
      json: enumerator,
    });
  }

  private lookupEnumeratorEntry(changeType: DifferenceType, item: string, enumeratorName: string) {
    return this._differenceReport.changes && this._differenceReport.changes.find((change) => {
      return change.changeType === changeType
      && change.item === item
      && change.path === "$enumerators"
      && (change.json as AnyEnumerator).name === enumeratorName;
    });
  }

  private visitChangedEnumerator(diagnostic: AnyDiagnostic) {
    const enumeration = diagnostic.ecDefinition as Enumeration;
    if(this.lookupEntry("add", enumeration.name)) {
      return;
    }

    const [enumerator, propertyName, sourceValue, targetValue] = diagnostic.messageArgs as [AnyEnumerator, keyof AnyEnumerator, any, any];
    if(this.lookupEnumeratorEntry("add", enumeration.name, enumerator.name)) {
      return;
    }

    if(!this.validateEnumerator(enumeration, enumerator, propertyName, sourceValue, targetValue)) {
      return;
    }

    const enumeratorPath = `$enumerators.${enumerator.name}`;
    let modifyEntry = this.lookupEntry("modify", enumeration.name, enumeratorPath) as SchemaEnumeratorDifference;
    if(!modifyEntry) {
      modifyEntry = this.addEntry({
        changeType: "modify",
        item: enumeration.name,
        path: enumeratorPath,
        json: {},
      });
    }

    if(sourceValue !== undefined) {
      modifyEntry.json[propertyName] = sourceValue;
    }
  }

  private validateEnumerator(enumeration: Enumeration, enumerator: AnyEnumerator, propertyName: string, sourceValue: unknown, targetValue: unknown) {
    if(propertyName === "value") {
      this.addConflict({
        code:    ConflictCode.ConflictingEnumeratorValue,
        item:    enumeration.name,
        path:    enumerator.name,
        source:  sourceValue,
        target:  targetValue,
        description: "Enumerator values must not differ.",
      });
      return false;
    }

    return true;
  }

  private visitMissingProperty(diagnostic: AnyDiagnostic) {
    const property = diagnostic.ecDefinition as Property;
    if(this.lookupEntry("add", property.class.name)) {
      return;
    }

    this.addEntry({
      changeType: "add",
      item: property.class.name,
      path: property.name,
      json:  property.toJSON(),
    });
  }

  private visitChangedProperty(diagnostic: AnyDiagnostic) {
    const property = diagnostic.ecDefinition as Property;
    if(this.lookupEntry("add", property.class.name) || this.lookupEntry("add", property.class.name, property.name)) {
      return;
    }
    const [propertyName, sourceValue, targetValue] = diagnostic.messageArgs as [keyof PropertyProps, any, any];
    if(!this.validatePropertyChange(property, propertyName, sourceValue, targetValue)) {
      return;
    }

    let modifyEntry = this.lookupEntry("modify", property.class.name, property.name) as SchemaPropertyDifference;
    if(!modifyEntry) {
      modifyEntry = this.addEntry({
        changeType: "modify",
        item: property.class.name,
        path: property.name,
        json: {},
      });
    }

    if(propertyName !== "name" && sourceValue !== undefined) {
      modifyEntry.json[propertyName] = sourceValue;
    }
  }

  private validatePropertyChange(ecProperty: Property, propertyName: string, sourceValue: unknown, targetValue: unknown): boolean {
    if(propertyName === "primitiveType") {
      this.addConflict({
        code:    ConflictCode.ConflictingPropertyName,
        item:    ecProperty.class.name,
        path:    ecProperty.name,
        source:  sourceValue,
        target:  targetValue,
        description: "Target class already contains a property with a different type.",
      });
      return false;
    }
    return true;
  }

  private visitMissingBaseClass(diagnostic: AnyDiagnostic) {
    const schemaItem = diagnostic.ecDefinition as ECClass;
    if(this.lookupEntry("add", schemaItem.name)) {
      return;
    }

    const [sourceBaseClass, targetBaseClass] = diagnostic.messageArgs as [ECClass, ECClass];
    if(!this.validateBaseClassChange(schemaItem, sourceBaseClass, targetBaseClass)) {
      return;
    }

    let modifyEntry = this.lookupEntry("modify", schemaItem.name) as SchemaItemDifference<{ baseClass: string }>;
    if(!modifyEntry) {
      modifyEntry = this.addEntry({
        changeType: "modify",
        item: schemaItem.name,
        json: {},
      });
    }

    modifyEntry.json.baseClass = sourceBaseClass.fullName;
  }

  private validateBaseClassChange(targetClass: ECClass, sourceBaseClass?: ECClass, targetBaseClass?: ECClass): boolean {
    if(sourceBaseClass === undefined) {
      this.addConflict({
        code:    ConflictCode.RemovingBaseClass,
        item:    targetClass.name,
        path:    "$baseClass",
        source:  undefined,
        target:  targetBaseClass?.fullName,
        description: "BaseClass cannot be set unset if there has been a baseClass before.",
      });
      return false;
    }

    if(sourceBaseClass.modifier === ECClassModifier.Sealed) {
      this.addConflict({
        code:    ConflictCode.SealedBaseClass,
        item:    targetClass.name,
        path:    "$baseClass",
        source:  sourceBaseClass.fullName,
        target:  targetBaseClass?.fullName,
        description: "BaseClass is sealed.",
      });
      return false;
    }

    if(targetBaseClass && !derivedFrom(sourceBaseClass, targetBaseClass.name)) {
      this.addConflict({
        code:    ConflictCode.ConflictingBaseClass,
        item:    targetClass.name,
        path:    "$baseClass",
        source:  sourceBaseClass.fullName,
        target:  targetBaseClass.fullName,
        description: "BaseClass is not valid, source class must derive from target.",
      });
      return false;
    }
    return true;
  }

  private visitMissingMixinOnClass(diagnostic: AnyDiagnostic) {
    const ecClass = diagnostic.ecDefinition as ECClass;
    if(this.lookupEntry("add", ecClass.name)) {
      return;
    }

    const [mixin] = diagnostic.messageArgs as [Mixin];
    if(!this.validateMixin(ecClass, mixin)) {
      return;
    }

    let modifyEntry = this.lookupEntry("modify", ecClass.name, "$mixins") as SchemaClassMixinDifference;
    if(!modifyEntry) {
      modifyEntry = this.addEntry({
        changeType: "modify",
        item: ecClass.name,
        path: "$mixins",
        json: [],
      });
    }

    modifyEntry.json.push(mixin.fullName);
  }

  private validateMixin(targetClass: ECClass, mixin: Mixin): boolean {
    if(mixin.appliesTo && !derivedFrom(targetClass, mixin.appliesTo.name)) {
      this.addConflict({
        code:    ConflictCode.MixinAppliedMustDeriveFromConstraint,
        item:    targetClass.name,
        path:    "$mixins",
        source:  mixin.fullName,
        target:  undefined,
        description: "Mixin cannot applied to this class.",
      });
      return false;
    }

    return true;
  }

  private visitMissingRelationshipConstraintClass(diagnostic: AnyDiagnostic) {
    const constraint = diagnostic.ecDefinition as RelationshipConstraint;
    const className = constraint.relationshipClass.name;
    const constraintPath = `$${constraint.isSource ? "source" : "target"}.constraintClasses`;
    if(this.lookupEntry("add", className)) {
      return;
    }

    let modifyEntry = this.lookupEntry("modify", className, constraintPath) as SchemaRelationshipConstraintClassDifference;
    if(!modifyEntry) {
      modifyEntry = this.addEntry({
        changeType: "modify",
        item: className,
        path: constraintPath,
        json: [],
      });
    }

    const [constraintClass] = diagnostic.messageArgs as [ECClass];
    modifyEntry.json.push(constraintClass.fullName);
  }

  private visitChangedRelationshipConstraint(diagnostic: AnyDiagnostic) {
    const constraint = diagnostic.ecDefinition as RelationshipConstraint;
    const className = constraint.relationshipClass.name;
    const constraintPath = `$${constraint.isSource ? "source" : "target"}`;
    if(this.lookupEntry("add", className)) {
      return;
    }

    let modifyEntry = this.lookupEntry("modify", className, constraintPath) as SchemaRelationshipConstraintDifference;
    if(!modifyEntry) {
      modifyEntry = this.addEntry({
        changeType: "modify",
        item: className,
        path: constraintPath,
        json: {},
      });
    }

    const [propertyName, propertyValue] = diagnostic.messageArgs as [keyof RelationshipConstraintProps, any];
    if(propertyValue !== undefined) {
      modifyEntry.json[propertyName] = propertyValue;
    }
  }

  private visitSchemaReference(diagnostic: AnyDiagnostic, changeType: DifferenceType) {
    const [referencedSchema] = diagnostic.messageArgs as [Schema];
    this.addEntry({
      changeType,
      item: "schema",
      path: "$references",
      json: {
        name:     referencedSchema.name,
        version:  referencedSchema.schemaKey.version.toString(),
      },
    });
  }

  private visitMissingCustomAttributeInstance(diagnostic: AnyDiagnostic) {
    const [customAttibuteContainer, path] = getItemNameAndPath(diagnostic.ecDefinition);
    if(this.lookupEntry("add", customAttibuteContainer) || this.lookupEntry("add", customAttibuteContainer, path)) {
      return;
    }

    const [customAttribute] = diagnostic.messageArgs as [CustomAttribute];
    this.addEntry({
      changeType: "add",
      item: customAttibuteContainer,
      path: `${path ? `${path}.` : ""}$customAttributes`,
      json: customAttribute as any,
    });
  }
}

function getItemNameAndPath(type: AnyECType): [string, string|undefined] {
  if(Schema.isSchema(type))
    return ["schema", undefined];
  if(SchemaItem.isSchemaItem(type))
    return [type.name, undefined];
  if(type instanceof Property)
    return [type.class.name, type.name];
  if(type instanceof RelationshipConstraint)
    return [type.relationshipClass.name, type.isSource ? "$source" : "$target"];
  throw Error("Unhandled Type");
}
