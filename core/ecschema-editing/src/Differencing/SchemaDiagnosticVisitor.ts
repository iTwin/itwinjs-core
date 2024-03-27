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
  AnyEnumerator, AnyPropertyProps, AnySchemaItem, CustomAttribute, ECClass, ECClassModifier,
  Enumeration, Mixin, Property, PropertyProps,
  RelationshipConstraint, RelationshipConstraintProps, Schema, SchemaItem, SchemaItemType, schemaItemTypeToString,
} from "@itwin/ecschema-metadata";
import type {
  AnySchemaDifference,
  CustomAttributeDifference,
  DifferenceType,
  SchemaDifference,
  SchemaReferenceDifference,
} from "./SchemaDifference";
import { ConflictCode, SchemaDifferenceConflict } from "./SchemaConflicts";

type AnySchemaItemDifference     = Extract<AnySchemaDifference, { itemName: string }>;
type AnySchemaItemPathDifference = Extract<AnySchemaDifference, { itemName: string, path: string }>;

/**
 * Recursive synchronous function to figure whether a given class derived from
 * a class with the given baseClassName.
 */
function derivedFrom(ecClass: ECClass|undefined, baseClassName: string): boolean {
  if(ecClass === undefined) {
    return false;
  }
  if(ecClass && ecClass.name === baseClassName) {
    return true;
  }
  return derivedFrom(ecClass.getBaseClassSync(), baseClassName);
}

type LookupAdd<T extends AnySchemaDifference, S extends T["schemaType"] = T["schemaType"]> = Extract<T, { changeType: "add", schemaType: S }>;
type LookupModify<T extends AnySchemaDifference, S extends T["schemaType"] = T["schemaType"]> = Extract<T, { changeType: "modify", schemaType: S }>;

/**
 * The SchemaDiagnosticVisitor is a visitor implementation for diagnostic entries
 * from the schema comparer api. Depending on the diagnostic code, the difference
 * result is build together.
 * @internal
 */
export class SchemaDiagnosticVisitor {

  public readonly schemaChanges: Array<SchemaDifference>;
  public readonly schemaPathChanges: Array<SchemaReferenceDifference>;
  public readonly schemaItemChanges: Array<AnySchemaItemDifference>;
  public readonly schemaItemPathChanges: Array<AnySchemaItemPathDifference>;
  public readonly customAttributeChanges: Array<CustomAttributeDifference>;
  public readonly conflicts: Array<SchemaDifferenceConflict>;

  constructor() {
    this.schemaChanges = [];
    this.schemaPathChanges = [];
    this.schemaItemChanges = [];
    this.schemaItemPathChanges = [];
    this.customAttributeChanges = [];
    this.conflicts = [];
  }

  private addConflict(conflict: SchemaDifferenceConflict) {
    this.conflicts.push(conflict);
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
    let modifyEntry = this.schemaChanges.find((entry) => entry.changeType === "modify" && entry.schemaType === "Schema");
    let hasChanges = false;
    let addEntry = false;
    if(modifyEntry === undefined) {
      addEntry = true;
      modifyEntry = {
        changeType: "modify",
        schemaType: "Schema",
        difference: {},
      };
    }

    // Only label and description are taken from the source schema. If the schema name or alias
    // differs, those are ignored for now.
    const [propertyName, propertyValue] = diagnostic.messageArgs as [string, any];
    if(propertyName === "label") {
      modifyEntry.difference.label = propertyValue;
      hasChanges = true;
    }
    if(propertyName === "description") {
      modifyEntry.difference.description = propertyValue;
      hasChanges = true;
    }

    if(addEntry && hasChanges) {
      this.schemaChanges.push(modifyEntry);
    }
  }

  private visitMissingSchemaItem(diagnostic: AnyDiagnostic) {
    const schemaItem = diagnostic.ecDefinition as AnySchemaItem;
    if(schemaItem.schemaItemType === SchemaItemType.Constant) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "Constant",
        itemName:   schemaItem.name,
        // TODO: Inconsistency of toJSON method, all other implementation have default parameters.
        difference: schemaItem.toJSON(false, false),
      });
    }
    if(schemaItem.schemaItemType === SchemaItemType.CustomAttributeClass) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "CustomAttributeClass",
        itemName:   schemaItem.name,
        difference: schemaItem.toJSON(),
      });
    }
    if(schemaItem.schemaItemType === SchemaItemType.EntityClass) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "EntityClass",
        itemName:   schemaItem.name,
        difference: schemaItem.toJSON(),
      });
    }
    if(schemaItem.schemaItemType === SchemaItemType.Enumeration) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "Enumeration",
        itemName:   schemaItem.name,
        difference: schemaItem.toJSON(),
      });
    }
    if(schemaItem.schemaItemType === SchemaItemType.KindOfQuantity) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "KindOfQuantity",
        itemName:   schemaItem.name,
        difference: schemaItem.toJSON(),
      });
    }
    if(schemaItem.schemaItemType === SchemaItemType.Mixin) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "Mixin",
        itemName:   schemaItem.name,
        difference: schemaItem.toJSON(),
      });
    }
    if(schemaItem.schemaItemType === SchemaItemType.Phenomenon) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "Phenomenon",
        itemName:   schemaItem.name,
        difference: schemaItem.toJSON(),
      });
    }
    if(schemaItem.schemaItemType === SchemaItemType.PropertyCategory) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "PropertyCategory",
        itemName:   schemaItem.name,
        difference: schemaItem.toJSON(),
      });
    }
    if(schemaItem.schemaItemType === SchemaItemType.RelationshipClass) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "RelationshipClass",
        itemName:   schemaItem.name,
        difference: schemaItem.toJSON(),
      });
    }
    if(schemaItem.schemaItemType === SchemaItemType.StructClass) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "StructClass",
        itemName:   schemaItem.name,
        difference: schemaItem.toJSON(),
      });
    }
    if(schemaItem.schemaItemType === SchemaItemType.UnitSystem) {
      this.schemaItemChanges.push({
        changeType: "add",
        schemaType: "UnitSystem",
        itemName:   schemaItem.name,
        difference: schemaItem.toJSON(),
      });
    }
  }

  private visitChangedSchemaItem(diagnostic: AnyDiagnostic) {
    const schemaItem = diagnostic.ecDefinition as SchemaItem;

    // TODO: Remove after fix #6560 has been merged into master.
    if(this.schemaItemChanges.find((entry) => entry.changeType === "add" && entry.itemName === schemaItem.name)) {
      return;
    }

    const [propertyName, sourceValue, targetValue] = diagnostic.messageArgs as [string, unknown, unknown];
    if(propertyName === "schemaItemType") {
      return this.addConflict({
        code:        ConflictCode.ConflictingItemName,
        schemaType:  getSchemaItemName(schemaItem.schemaItemType),
        itemName:    schemaItem.name,
        source:      sourceValue,
        target:      targetValue,
        description: "Target schema already contains a schema item with the name but different type.",
      });
    }

    if(sourceValue === undefined) {
      return;
    }

    let modifyEntry = this.schemaItemChanges.find((entry): entry is LookupModify<AnySchemaItemDifference> => {
      return entry.changeType === "modify" && entry.itemName === schemaItem.name;
    });

    if(modifyEntry === undefined) {
      modifyEntry = {
        changeType: "modify",
        schemaType: getSchemaItemName(schemaItem.schemaItemType) as any,
        itemName:   schemaItem.name,
        difference: {},
      };
      this.schemaItemChanges.push(modifyEntry);
    }

    // TODO: Since propertyName is type of string, the compiler complains about accepting
    // an unspecific string as property indexer. Casted to any as short term fix but that
    // needs to be handled better in future.
    (modifyEntry.difference as any)[propertyName] = sourceValue;
  }

  private visitChangedEnumeration(diagnostic: AnyDiagnostic) {
    const enumeration = diagnostic.ecDefinition as Enumeration;
    if(this.schemaItemPathChanges.find((entry) => entry.changeType === "add" && entry.itemName === enumeration.name )) {
      return;
    }

    const [propertyName, sourceValue, targetValue] = diagnostic.messageArgs as [string, string, string];
    if(propertyName === "type") {
      return this.addConflict({
        code:        ConflictCode.ConflictingEnumerationType,
        schemaType:  "Enumeration",
        itemName:    enumeration.name,
        source:      sourceValue,
        target:      targetValue,
        description: "Enumeration has a different primitive type.",
      });
    }

    return this.visitChangedSchemaItem(diagnostic);
  }

  private visitMissingEnumerator(diagnostic: AnyDiagnostic) {
    const enumeration = diagnostic.ecDefinition as Enumeration;

    // TODO: Remove after fix #6560 has been merged into master.
    if(this.schemaItemPathChanges.find((entry) => entry.changeType === "add" && entry.itemName === enumeration.name )) {
      return;
    }

    const [enumerator] = diagnostic.messageArgs as [AnyEnumerator];
    this.schemaItemPathChanges.push({
      changeType: "add",
      schemaType: "Enumeration",
      itemName:   enumeration.name,
      path:       "$enumerators",
      difference: enumerator,
    });
  }

  private lookupEnumeratorEntry(changeType: DifferenceType, item: string, enumeratorName: string) {
    return this.schemaItemPathChanges.find((change) => {
      return change.changeType === changeType
      && change.schemaType === "Enumeration"
      && change.itemName   === item
      && change.path       === "$enumerators"
      && change.difference.name === enumeratorName;
    });
  }

  private visitChangedEnumerator(diagnostic: AnyDiagnostic) {
    const enumeration = diagnostic.ecDefinition as Enumeration;

    // TODO: Remove after fix #6560 has been merged into master.
    if(this.schemaItemPathChanges.find((entry) => entry.changeType === "add" && entry.itemName === enumeration.name )) {
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
    let modifyEntry = this.schemaItemPathChanges.find((entry): entry is LookupModify<AnySchemaItemPathDifference, "Enumeration"> => {
      return entry.changeType === "modify" && entry.schemaType === "Enumeration" && entry.itemName === enumeration.name && entry.path === enumeratorPath;
    });

    if(modifyEntry === undefined) {
      modifyEntry = {
        changeType: "modify",
        schemaType: "Enumeration",
        itemName: enumeration.name,
        path: enumeratorPath,
        difference: {},
      };
      this.schemaItemPathChanges.push(modifyEntry);
    }

    if(sourceValue !== undefined) {
      modifyEntry.difference[propertyName] = sourceValue;
    }
  }

  private validateEnumerator(enumeration: Enumeration, enumerator: AnyEnumerator, propertyName: string, sourceValue: unknown, targetValue: unknown) {
    if(propertyName === "value") {
      this.addConflict({
        code:        ConflictCode.ConflictingEnumeratorValue,
        schemaType:  "Enumeration",
        itemName:    enumeration.name,
        path:        enumerator.name,
        source:      sourceValue,
        target:      targetValue,
        description: "Enumerator values must not differ.",
      });
      return false;
    }

    return true;
  }

  private visitMissingProperty(diagnostic: AnyDiagnostic) {
    const property = diagnostic.ecDefinition as Property;
    if(this.schemaItemChanges.find((entry) => entry.changeType === "add" && entry.itemName === property.class.name)) {
      return;
    }

    this.schemaItemPathChanges.push({
      changeType: "add",
      schemaType: "Property",
      itemName:   property.class.name,
      path:       property.name,
      difference: property.toJSON() as AnyPropertyProps,
    });
  }

  private visitChangedProperty(diagnostic: AnyDiagnostic) {
    const property = diagnostic.ecDefinition as Property;

    // TODO: Remove after fix #6560 has been merged into master.
    if(this.schemaItemChanges.find((entry) => entry.changeType === "add" && entry.itemName === property.class.name)) {
      return;
    }
    // TODO: Remove after fix #6560 has been merged into master.
    if(this.schemaItemPathChanges.find((entry) => entry.changeType === "add" && entry.itemName === property.class.name && entry.path === property.name)) {
      return;
    }

    const [propertyName, sourceValue, targetValue] = diagnostic.messageArgs as [keyof PropertyProps, any, any];
    if(!this.validatePropertyChange(property, propertyName, sourceValue, targetValue)) {
      return;
    }

    let modifyEntry = this.schemaItemPathChanges.find((entry): entry is LookupModify<AnySchemaItemPathDifference, "Property"> => {
      return entry.changeType === "modify" && entry.schemaType === "Property" && entry.itemName === property.class.name && entry.path === property.name;
    });

    if(modifyEntry === undefined) {
      modifyEntry = {
        changeType: "modify",
        schemaType: "Property",
        itemName: property.class.name,
        path: property.name,
        difference: {},
      };
      this.schemaItemPathChanges.push(modifyEntry);
    }

    if(propertyName !== "name" && sourceValue !== undefined) {
      modifyEntry.difference[propertyName] = sourceValue;
    }
  }

  private validatePropertyChange(ecProperty: Property, propertyName: string, sourceValue: unknown, targetValue: unknown): boolean {
    if(propertyName === "primitiveType") {
      this.addConflict({
        code:        ConflictCode.ConflictingPropertyName,
        schemaType:  getSchemaItemName(ecProperty.class.schemaItemType),
        itemName:    ecProperty.class.name,
        path:        ecProperty.name,
        source:      sourceValue,
        target:      targetValue,
        description: "Target class already contains a property with a different type.",
      });
      return false;
    }
    return true;
  }

  private visitMissingBaseClass(diagnostic: AnyDiagnostic) {
    const ecClass = diagnostic.ecDefinition as ECClass;

    // TODO: Remove after fix #6560 has been merged into master.
    if(this.schemaItemChanges.find((entry) => entry.changeType === "add" && entry.itemName === ecClass.name)) {
      return;
    }

    const [sourceBaseClass, targetBaseClass] = diagnostic.messageArgs as [ECClass, ECClass];
    if(!this.validateBaseClassChange(ecClass, sourceBaseClass, targetBaseClass)) {
      return;
    }

    if(ecClass.schemaItemType === SchemaItemType.CustomAttributeClass) {
      let modifyEntry = this.schemaItemChanges.find((entry): entry is LookupModify<AnySchemaItemDifference, "CustomAttributeClass"> => {
        return entry.changeType === "modify" && entry.schemaType === "CustomAttributeClass" && entry.itemName === ecClass.name;
      });

      if(modifyEntry === undefined) {
        modifyEntry = {
          changeType: "modify",
          schemaType: "CustomAttributeClass",
          itemName: ecClass.name,
          difference: {},
        };
        this.schemaItemChanges.push(modifyEntry);
      }
      modifyEntry.difference.baseClass = sourceBaseClass.fullName;
    }

    if(ecClass.schemaItemType === SchemaItemType.EntityClass) {
      let modifyEntry = this.schemaItemChanges.find((entry): entry is LookupModify<AnySchemaItemDifference, "EntityClass"> => {
        return entry.changeType === "modify" && entry.schemaType === "EntityClass" && entry.itemName === ecClass.name;
      });

      if(modifyEntry === undefined) {
        modifyEntry = {
          changeType: "modify",
          schemaType: "EntityClass",
          itemName: ecClass.name,
          difference: {},
        };
        this.schemaItemChanges.push(modifyEntry);
      }
      modifyEntry.difference.baseClass = sourceBaseClass.fullName;
    }

    if(ecClass.schemaItemType === SchemaItemType.Mixin) {
      let modifyEntry = this.schemaItemChanges.find((entry): entry is LookupModify<AnySchemaItemDifference, "Mixin"> => {
        return entry.changeType === "modify" && entry.schemaType === "Mixin" && entry.itemName === ecClass.name;
      });

      if(modifyEntry === undefined) {
        modifyEntry = {
          changeType: "modify",
          schemaType: "Mixin",
          itemName: ecClass.name,
          difference: {},
        };
        this.schemaItemChanges.push(modifyEntry);
      }
      modifyEntry.difference.baseClass = sourceBaseClass.fullName;
    }

    if(ecClass.schemaItemType === SchemaItemType.StructClass) {
      let modifyEntry = this.schemaItemChanges.find((entry): entry is LookupModify<AnySchemaItemDifference, "StructClass"> => {
        return entry.changeType === "modify" && entry.schemaType === "StructClass" && entry.itemName === ecClass.name;
      });

      if(modifyEntry === undefined) {
        modifyEntry = {
          changeType: "modify",
          schemaType: "StructClass",
          itemName:   ecClass.name,
          difference: {},
        };
        this.schemaItemChanges.push(modifyEntry);
      }
      modifyEntry.difference.baseClass = sourceBaseClass.fullName;
    }
  }

  private validateBaseClassChange(targetClass: ECClass, sourceBaseClass?: ECClass, targetBaseClass?: ECClass): boolean {
    if(sourceBaseClass === undefined) {
      this.addConflict({
        code:        ConflictCode.RemovingBaseClass,
        schemaType:  getSchemaItemName(targetClass.schemaItemType),
        itemName:    targetClass.name,
        path:        "$baseClass",
        source:      undefined,
        target:      targetBaseClass?.fullName,
        description: "BaseClass cannot be set unset if there has been a baseClass before.",
      });
      return false;
    }

    if(sourceBaseClass.modifier === ECClassModifier.Sealed) {
      this.addConflict({
        code:        ConflictCode.SealedBaseClass,
        schemaType:  getSchemaItemName(targetClass.schemaItemType),
        itemName:    targetClass.name,
        path:        "$baseClass",
        source:      sourceBaseClass.fullName,
        target:      targetBaseClass?.fullName,
        description: "BaseClass is sealed.",
      });
      return false;
    }

    if(targetBaseClass && !derivedFrom(sourceBaseClass, targetBaseClass.name)) {
      this.addConflict({
        code:         ConflictCode.ConflictingBaseClass,
        schemaType:   getSchemaItemName(targetClass.schemaItemType),
        itemName:     targetClass.name,
        path:         "$baseClass",
        source:       sourceBaseClass.fullName,
        target:       targetBaseClass.fullName,
        description: "BaseClass is not valid, source class must derive from target.",
      });
      return false;
    }
    return true;
  }

  private visitMissingMixinOnClass(diagnostic: AnyDiagnostic) {
    const ecClass = diagnostic.ecDefinition as ECClass;

    // TODO: Remove after fix #6560 has been merged into master.
    if(this.schemaItemChanges.find((entry) => entry.changeType === "add" && entry.itemName === ecClass.name)) {
      return;
    }

    const [mixin] = diagnostic.messageArgs as [Mixin];
    if(!this.validateMixin(ecClass, mixin)) {
      return;
    }

    let modifyEntry = this.schemaItemPathChanges.find((entry): entry is LookupAdd<AnySchemaItemPathDifference, "EntityClass"> => {
      return entry.changeType === "add" && entry.schemaType === "EntityClass" && entry.itemName === ecClass.name && entry.path === "$mixins";
    });

    if(modifyEntry === undefined) {
      modifyEntry = {
        changeType: "add",
        schemaType: "EntityClass",
        itemName:   ecClass.name,
        path:       "$mixins",
        difference: [],
      };
      this.schemaItemPathChanges.push(modifyEntry);
    }
    modifyEntry.difference.push(mixin.fullName);
  }

  private validateMixin(targetClass: ECClass, mixin: Mixin): boolean {
    if(mixin.appliesTo && !derivedFrom(targetClass, mixin.appliesTo.name)) {
      this.addConflict({
        code:         ConflictCode.MixinAppliedMustDeriveFromConstraint,
        schemaType:   getSchemaItemName(targetClass.schemaItemType),
        itemName:     targetClass.name,
        path:         "$mixins",
        source:       mixin.fullName,
        target:       undefined,
        description: "Mixin cannot applied to this class.",
      });
      return false;
    }

    return true;
  }

  private visitMissingRelationshipConstraintClass(diagnostic: AnyDiagnostic) {
    const constraint = diagnostic.ecDefinition as RelationshipConstraint;
    const className = constraint.relationshipClass.name;
    const constraintPath = constraint.isSource ? "$source.constraintClasses" : "$target.constraintClasses";

    // TODO: Remove after fix #6560 has been merged into master.
    if(this.schemaItemChanges.find((entry) => entry.changeType === "add" && entry.itemName === className)) {
      return;
    }

    let modifyEntry = this.schemaItemPathChanges.find((entry): entry is LookupAdd<AnySchemaItemPathDifference, "RelationshipClass"> => {
      return entry.changeType === "add" && entry.schemaType === "RelationshipClass", entry.itemName === className && entry.path === constraintPath;
    });

    if(!modifyEntry) {
      this.schemaItemPathChanges.push(modifyEntry = {
        changeType: "add",
        schemaType: "RelationshipClass",
        itemName:   className,
        path:       constraintPath,
        difference: [],
      });
    }

    const [constraintClass] = diagnostic.messageArgs as [ECClass];
    modifyEntry.difference.push(constraintClass.fullName);
  }

  private visitChangedRelationshipConstraint(diagnostic: AnyDiagnostic) {
    const constraint = diagnostic.ecDefinition as RelationshipConstraint;
    const className = constraint.relationshipClass.name;
    const constraintPath = constraint.isSource ? "$source" : "$target";
    if(this.schemaItemChanges.find((entry) => entry.changeType === "add" && entry.itemName === className)) {
      return;
    }

    let modifyEntry = this.schemaItemPathChanges.find((entry): entry is LookupModify<AnySchemaItemPathDifference, "RelationshipClass"> => {
      return entry.changeType === "modify" && entry.schemaType === "RelationshipClass", entry.itemName === className && entry.path === constraintPath;
    });

    if(modifyEntry === undefined) {
      modifyEntry = {
        changeType: "modify",
        schemaType: "RelationshipClass",
        itemName:   className,
        path:       constraintPath,
        difference: {
        },
      };
      this.schemaItemPathChanges.push(modifyEntry);
    }

    const [propertyName, propertyValue] = diagnostic.messageArgs as [keyof RelationshipConstraintProps, any];
    if(propertyName === "abstractConstraint" && propertyValue !== undefined) {
      modifyEntry.difference.abstractConstraint = propertyValue;
    }
    if(propertyName === "multiplicity" && propertyValue !== undefined) {
      modifyEntry.difference.multiplicity = propertyValue;
    }
    if(propertyName === "polymorphic" && propertyValue !== undefined) {
      modifyEntry.difference.polymorphic = propertyValue;
    }
    if(propertyName === "roleLabel" && propertyValue !== undefined) {
      modifyEntry.difference.roleLabel = propertyValue;
    }
  }

  private visitSchemaReference(diagnostic: AnyDiagnostic, changeType: DifferenceType) {
    const [referencedSchema] = diagnostic.messageArgs as [Schema];
    this.schemaPathChanges.push({
      changeType,
      schemaType: "Schema",
      path:       "$references",
      difference: {
        name:     referencedSchema.name,
        version:  referencedSchema.schemaKey.version.toString(),
      },
    });
  }

  private visitMissingCustomAttributeInstance(diagnostic: AnyDiagnostic) {
    const [customAttribute] = diagnostic.messageArgs as [CustomAttribute];
    const ecType = diagnostic.ecDefinition;
    if(Schema.isSchema(ecType)) {
      return this.customAttributeChanges.push({
        changeType: "add",
        schemaType: "CustomAttribute",
        appliesTo: "Schema",
        difference: customAttribute,
      });
    }

    if(SchemaItem.isSchemaItem(ecType)) {
      // TODO: Remove after fix #6560 has been merged into master.
      if(this.schemaItemChanges.find((entry) => entry.changeType === "add" && entry.itemName === ecType.name)) {
        return;
      }
      return this.customAttributeChanges.push({
        changeType: "add",
        schemaType: "CustomAttribute",
        appliesTo:  "SchemaItem",
        itemName:   ecType.name,
        difference: customAttribute,
      });
    }

    if(ecType instanceof Property) {
      // TODO: Remove after fix #6560 has been merged into master.
      if(this.schemaItemChanges.find((entry) => entry.changeType === "add" && entry.itemName === ecType.name)) {
        return;
      }
      // TODO: Remove after fix #6560 has been merged into master.
      if(this.schemaItemPathChanges.find((entry) => entry.changeType === "add" && entry.itemName === ecType.name && entry.path === ecType.name)) {
        return;
      }

      return this.customAttributeChanges.push({
        changeType: "add",
        schemaType: "CustomAttribute",
        appliesTo:  "Property",
        itemName:   ecType.class.name,
        path:       ecType.name,
        difference: customAttribute,
      });
    }

    if(ecType instanceof RelationshipConstraint) {
      // TODO: Remove after fix #6560 has been merged into master.
      if(this.schemaItemChanges.find((entry) => entry.changeType === "add" && entry.itemName === ecType.relationshipClass.name)) {
        return;
      }

      return this.customAttributeChanges.push({
        changeType: "add",
        schemaType: "CustomAttribute",
        appliesTo:  "RelationshipConstraint",
        itemName:   ecType.relationshipClass.name,
        path:       ecType.isSource ? "$source" : "$target",
        difference: customAttribute,
      });
    }
    return;
  }
}

function getSchemaItemName<T extends AnySchemaItemDifference=AnySchemaItemDifference>(schemaItemType: SchemaItemType): T["schemaType"] {
  return schemaItemTypeToString(schemaItemType) as T["schemaType"];
}
