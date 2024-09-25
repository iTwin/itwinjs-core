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
  AnyEnumerator, AnyPropertyProps, AnySchemaItem, CustomAttribute, ECClass,
  Enumeration, Mixin, Property, PropertyProps,
  RelationshipConstraint, RelationshipConstraintProps, Schema, SchemaItem,
} from "@itwin/ecschema-metadata";
import {
  type AnyClassItemDifference,
  type AnySchemaItemDifference,
  type AnySchemaItemPathDifference,
  type ClassPropertyDifference,
  type CustomAttributeDifference,
  type DifferenceType,
  type EntityClassMixinDifference,
  type EnumeratorDifference,
  type RelationshipConstraintClassDifference,
  type RelationshipConstraintDifference,
  type SchemaDifference,
  SchemaOtherTypes,
  type SchemaReferenceDifference,
} from "./SchemaDifference";

/**
 * The SchemaDiagnosticVisitor is a visitor implementation for diagnostic entries
 * from the schema comparer api. Depending on the diagnostic code, the difference
 * result is build together.
 * @internal
 */
export class SchemaDiagnosticVisitor {

  public readonly schemaDifferences: Array<SchemaDifference | SchemaReferenceDifference>;
  public readonly schemaItemDifferences: Array<AnySchemaItemDifference>;
  public readonly schemaItemPathDifferences: Array<AnySchemaItemPathDifference>;
  public readonly customAttributeDifferences: Array<CustomAttributeDifference>;

  constructor() {
    this.schemaDifferences = [];
    this.schemaItemDifferences = [];
    this.schemaItemPathDifferences = [];
    this.customAttributeDifferences = [];
  }

  /**
   * Visitor function to process the schema change diagnostic object.
   * @internal
   */
  public visit(diagnostic: AnyDiagnostic) {
    switch (diagnostic.code) {
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
    let modifyEntry = this.schemaDifferences.find((entry): entry is SchemaDifference => {
      return entry.changeType === "modify" && entry.schemaType === SchemaOtherTypes.Schema;
    });

    let hasChanges = false;
    let addEntry = false;
    if (modifyEntry === undefined) {
      addEntry = true;
      modifyEntry = {
        changeType: "modify",
        schemaType: SchemaOtherTypes.Schema,
        difference: {},
      };
    }

    // Only label and description are taken from the source schema. If the schema name or alias
    // differs, those are ignored for now.
    const [propertyName, propertyValue] = diagnostic.messageArgs as [string, any];
    if (propertyName === "label") {
      modifyEntry.difference.label = propertyValue;
      hasChanges = true;
    }
    if (propertyName === "description") {
      modifyEntry.difference.description = propertyValue;
      hasChanges = true;
    }

    if (addEntry && hasChanges) {
      this.schemaDifferences.push(modifyEntry);
    }
  }

  private visitMissingSchemaItem(diagnostic: AnyDiagnostic) {
    const schemaItem = diagnostic.ecDefinition as AnySchemaItem;

    this.schemaItemDifferences.push({
      changeType: "add",
      schemaType: schemaItem.schemaItemType,
      itemName: schemaItem.name,
      difference: schemaItem.toJSON(),
    });
  }

  private visitChangedSchemaItem(diagnostic: AnyDiagnostic) {
    const schemaItem = diagnostic.ecDefinition as AnySchemaItem;
    const [propertyName, sourceValue, _targetValue] = diagnostic.messageArgs as [string, unknown, unknown];
    if (propertyName === "schemaItemType") {
      // If the schema item type is different, the whole item is added as "new" item. The
      // difference validator will then figure whether there is a conflict with items of
      // of the same name.
      return this.visitMissingSchemaItem(diagnostic);
    }

    if (sourceValue === undefined) {
      return;
    }

    let modifyEntry = this.schemaItemDifferences.find((entry): entry is AnySchemaItemDifference => {
      return entry.changeType === "modify" && entry.itemName === schemaItem.name;
    });

    if (modifyEntry === undefined) {
      modifyEntry = {
        changeType: "modify",
        schemaType: schemaItem.schemaItemType,
        itemName: schemaItem.name,
        difference: {},
      } as AnySchemaItemDifference;
      this.schemaItemDifferences.push(modifyEntry);
    }

    // TODO: Since propertyName is type of string, the compiler complains about accepting
    // an unspecific string as property indexer. Casted to any as short term fix but that
    // needs to be handled better in future.
    (modifyEntry.difference as any)[propertyName] = sourceValue;
  }

  private visitChangedEnumeration(diagnostic: AnyDiagnostic) {
    const enumeration = diagnostic.ecDefinition as Enumeration;
    if (this.schemaItemPathDifferences.find((entry) => entry.changeType === "add" && entry.itemName === enumeration.name)) {
      return;
    }

    return this.visitChangedSchemaItem(diagnostic);
  }

  private visitMissingEnumerator(diagnostic: AnyDiagnostic) {
    const enumeration = diagnostic.ecDefinition as Enumeration;
    const [enumerator] = diagnostic.messageArgs as [AnyEnumerator];
    this.schemaItemPathDifferences.push({
      changeType: "add",
      schemaType: SchemaOtherTypes.Enumerator,
      itemName: enumeration.name,
      path: "$enumerators",
      difference: enumerator,
    });
  }

  private lookupEnumeratorEntry(changeType: DifferenceType, item: string, enumeratorName: string) {
    return this.schemaItemPathDifferences.find((change) => {
      return change.changeType === changeType
        && change.schemaType === SchemaOtherTypes.Enumerator
        && change.itemName === item
        && change.path === "$enumerators"
        && change.difference.name === enumeratorName;
    });
  }

  private visitChangedEnumerator(diagnostic: AnyDiagnostic) {
    const enumeration = diagnostic.ecDefinition as Enumeration;
    const [enumerator, propertyName, sourceValue] = diagnostic.messageArgs as [AnyEnumerator, keyof AnyEnumerator, any];
    if (this.lookupEnumeratorEntry("add", enumeration.name, enumerator.name)) {
      return;
    }

    let modifyEntry = this.schemaItemPathDifferences.find((entry): entry is EnumeratorDifference => {
      return entry.changeType === "modify" && entry.schemaType === SchemaOtherTypes.Enumerator && entry.itemName === enumeration.name && entry.path === enumerator.name;
    });

    if (modifyEntry === undefined) {
      modifyEntry = {
        changeType: "modify",
        schemaType: SchemaOtherTypes.Enumerator,
        itemName: enumeration.name,
        path: enumerator.name,
        difference: {},
      };
      this.schemaItemPathDifferences.push(modifyEntry);
    }

    if (sourceValue !== undefined) {
      modifyEntry.difference[propertyName] = sourceValue;
    }
  }

  private visitMissingProperty(diagnostic: AnyDiagnostic) {
    const property = diagnostic.ecDefinition as Property;
    this.schemaItemPathDifferences.push({
      changeType: "add",
      schemaType: SchemaOtherTypes.Property,
      itemName: property.class.name,
      path: property.name,
      difference: property.toJSON() as AnyPropertyProps,
    });
  }

  private visitChangedProperty(diagnostic: AnyDiagnostic) {
    const property = diagnostic.ecDefinition as Property;
    const [propertyName, sourceValue] = diagnostic.messageArgs as [keyof PropertyProps, any, any];

    if (isPropertyTypeName(property, propertyName)) {
      return this.visitMissingProperty(diagnostic);
    }

    let modifyEntry = this.schemaItemPathDifferences.find((entry): entry is ClassPropertyDifference => {
      return entry.changeType === "modify" && entry.schemaType === SchemaOtherTypes.Property && entry.itemName === property.class.name && entry.path === property.name;
    });

    if (modifyEntry === undefined) {
      modifyEntry = {
        changeType: "modify",
        schemaType: SchemaOtherTypes.Property,
        itemName: property.class.name,
        path: property.name,
        difference: {},
      };
      this.schemaItemPathDifferences.push(modifyEntry);
    }

    if (propertyName !== "name") {
      modifyEntry.difference[propertyName] = sourceValue;
    }
  }

  private visitMissingBaseClass(diagnostic: AnyDiagnostic) {
    const ecClass = diagnostic.ecDefinition as ECClass;
    const [sourceBaseClass] = diagnostic.messageArgs as [ECClass, ECClass];

    let modifyEntry = this.schemaItemDifferences.find((entry): entry is AnyClassItemDifference => {
      return entry.changeType === "modify" && entry.schemaType === ecClass.schemaItemType && entry.itemName === ecClass.name;
    });

    if (modifyEntry === undefined) {
      modifyEntry = {
        changeType: "modify",
        schemaType: ecClass.schemaItemType,
        itemName: ecClass.name,
        difference: {},
      } as AnyClassItemDifference;
      this.schemaItemDifferences.push(modifyEntry);
    }

    modifyEntry.difference.baseClass = sourceBaseClass !== undefined ? sourceBaseClass.fullName : undefined;
  }

  private visitMissingMixinOnClass(diagnostic: AnyDiagnostic) {
    const ecClass = diagnostic.ecDefinition as ECClass;
    const [mixin] = diagnostic.messageArgs as [Mixin];

    let modifyEntry = this.schemaItemDifferences.find((entry): entry is EntityClassMixinDifference => {
      return entry.changeType === "add" && entry.schemaType === SchemaOtherTypes.EntityClassMixin && entry.itemName === ecClass.name;
    });

    if (modifyEntry === undefined) {
      modifyEntry = {
        changeType: "add",
        schemaType: SchemaOtherTypes.EntityClassMixin,
        itemName: ecClass.name,
        difference: [],
      };
      this.schemaItemDifferences.push(modifyEntry);
    }
    modifyEntry.difference.push(mixin.fullName);
  }

  private visitMissingRelationshipConstraintClass(diagnostic: AnyDiagnostic) {
    const constraint = diagnostic.ecDefinition as RelationshipConstraint;
    const className = constraint.relationshipClass.name;
    const constraintPath = constraint.isSource ? "$source" : "$target";

    let modifyEntry = this.schemaItemPathDifferences.find((entry): entry is RelationshipConstraintClassDifference => {
      return entry.changeType === "add" && entry.schemaType === SchemaOtherTypes.RelationshipConstraintClass, entry.itemName === className && entry.path === constraintPath;
    });

    if (!modifyEntry) {
      modifyEntry = {
        changeType: "add",
        schemaType: SchemaOtherTypes.RelationshipConstraintClass,
        itemName: className,
        path: constraintPath,
        difference: [],
      };
      this.schemaItemPathDifferences.push(modifyEntry);
    }

    const [constraintClass] = diagnostic.messageArgs as [ECClass];
    modifyEntry.difference.push(constraintClass.fullName);
  }

  private visitChangedRelationshipConstraint(diagnostic: AnyDiagnostic) {
    const constraint = diagnostic.ecDefinition as RelationshipConstraint;
    const className = constraint.relationshipClass.name;
    const constraintPath = constraint.isSource ? "$source" : "$target";
    if (this.schemaItemDifferences.find((entry) => entry.changeType === "add" && entry.itemName === className)) {
      return;
    }

    let modifyEntry = this.schemaItemPathDifferences.find((entry): entry is RelationshipConstraintDifference => {
      return entry.changeType === "modify" && entry.schemaType === SchemaOtherTypes.RelationshipConstraint && entry.itemName === className && entry.path === constraintPath;
    });

    if (modifyEntry === undefined) {
      modifyEntry = {
        changeType: "modify",
        schemaType: SchemaOtherTypes.RelationshipConstraint,
        itemName: className,
        path: constraintPath,
        difference: {},
      };
      this.schemaItemPathDifferences.push(modifyEntry);
    }

    const [propertyName, propertyValue] = diagnostic.messageArgs as [keyof RelationshipConstraintProps, any];
    if (propertyName === "abstractConstraint" && propertyValue !== undefined) {
      modifyEntry.difference.abstractConstraint = propertyValue;
    }
    if (propertyName === "multiplicity" && propertyValue !== undefined) {
      modifyEntry.difference.multiplicity = propertyValue;
    }
    if (propertyName === "polymorphic" && propertyValue !== undefined) {
      modifyEntry.difference.polymorphic = propertyValue;
    }
    if (propertyName === "roleLabel" && propertyValue !== undefined) {
      modifyEntry.difference.roleLabel = propertyValue;
    }
  }

  private visitSchemaReference(diagnostic: AnyDiagnostic, changeType: DifferenceType) {
    const [referencedSchema] = diagnostic.messageArgs as [Schema];
    this.schemaDifferences.push({
      changeType,
      schemaType: SchemaOtherTypes.SchemaReference,
      difference: {
        name: referencedSchema.name,
        version: referencedSchema.schemaKey.version.toString(),
      },
    });
  }

  private visitMissingCustomAttributeInstance(diagnostic: AnyDiagnostic) {
    const [customAttribute] = diagnostic.messageArgs as [CustomAttribute];
    const ecType = diagnostic.ecDefinition;
    if (Schema.isSchema(ecType)) {
      return this.customAttributeDifferences.push({
        changeType: "add",
        schemaType: SchemaOtherTypes.CustomAttributeInstance,
        appliedTo: "Schema",
        difference: customAttribute,
      });
    }

    if (SchemaItem.isSchemaItem(ecType)) {
      return this.customAttributeDifferences.push({
        changeType: "add",
        schemaType: SchemaOtherTypes.CustomAttributeInstance,
        appliedTo: "SchemaItem",
        itemName: ecType.name,
        difference: customAttribute,
      });
    }

    if (Property.isProperty(ecType)) {
      return this.customAttributeDifferences.push({
        changeType: "add",
        schemaType: SchemaOtherTypes.CustomAttributeInstance,
        appliedTo: "Property",
        itemName: ecType.class.name,
        path: ecType.name,
        difference: customAttribute,
      });
    }

    if (RelationshipConstraint.isRelationshipConstraint(ecType)) {
      return this.customAttributeDifferences.push({
        changeType: "add",
        schemaType: SchemaOtherTypes.CustomAttributeInstance,
        appliedTo: "RelationshipConstraint",
        itemName: ecType.relationshipClass.name,
        path: ecType.isSource ? "$source" : "$target",
        difference: customAttribute,
      });
    }
    return;
  }
}

function isPropertyTypeName(property: Property, propertyName: string) {
  return (propertyName === "type") ||
    (property.isEnumeration() && propertyName === "enumeration") ||
    (property.isPrimitive() && propertyName === "primitiveType") ||
    (property.isStruct() && propertyName === "structClass") ||
    (property.isNavigation() && propertyName === "relationshipClass");
}
