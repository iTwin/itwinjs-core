/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import type { RenamePropertyChange, RenameSchemaItemChange } from "./SchemaChanges";
import { AnySchemaItemDifference, ClassItemDifference, ClassPropertyDifference, RelationshipClassDifference, RelationshipConstraintClassDifference, SchemaDifferenceResult, SchemaOtherTypes, SchemaType } from "../../Differencing/SchemaDifference";
import { NavigationPropertyProps, PrimitiveArrayPropertyProps, PrimitivePropertyProps, RelationshipConstraintProps, SchemaItemKey, SchemaItemType, SchemaKey, StructArrayPropertyProps, StructPropertyProps } from "@itwin/ecschema-metadata";
import * as Utils from "../../Differencing/Utils";

type Editable<T extends object> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * @internal
 */
export function applyRenamePropertyChange(result: SchemaDifferenceResult, change: RenamePropertyChange) {
  const [itemName, path] = change.key.split(".") as [string, string];

  let entryIndex = result.differences.findIndex((entry) => {
    return Utils.isClassPropertyDifference(entry) && entry.changeType === "add" && entry.itemName === itemName && entry.path === path;
  });

  if (entryIndex === -1 && result.conflicts) {
    const conflictIndex = result.conflicts.findIndex((entry) => {
      return entry.itemName === itemName && entry.path === path;
    });

    if (conflictIndex > -1) {
      const conflictEntry = result.conflicts[conflictIndex];
      entryIndex = result.differences.push({
        changeType: "add",
        schemaType: SchemaOtherTypes.Property,
        itemName,
        path,
        difference: conflictEntry.difference,
      } as ClassPropertyDifference) - 1;

      result.conflicts.splice(conflictIndex, 1);
    }
  }

  const propertyEntry = result.differences[entryIndex] as Editable<ClassPropertyDifference>;
  if (propertyEntry) {
    propertyEntry.path = change.value;
  }
}

/**
 * @internal
 */
export function applyRenameSchemaItemChange(result: SchemaDifferenceResult, change: RenameSchemaItemChange, postProcessing: (cb: () => void) => void) {
  let difference = result.differences.find((entry) => {
    return Utils.isSchemaItemDifference(entry) && entry.changeType === "add" && entry.itemName === change.key;
  });

  if (difference === undefined && result.conflicts) {
    const conflictIndex = result.conflicts.findIndex((entry) => entry.itemName === change.key && entry.path === undefined);
    if (conflictIndex > -1) {
      const conflictEntry = result.conflicts[conflictIndex];
      result.differences.push(difference = {
        changeType: "add",
        schemaType: conflictEntry.schemaType,
        itemName: change.value,
        difference: conflictEntry.difference,
      } as AnySchemaItemDifference) - 1;

      result.conflicts.splice(conflictIndex, 1);

      // If item gets added, remove the modify references to this item
      const relatedModifications: number[] = [];
      result.differences.forEach((entry, index) => {
        if (Utils.isSchemaItemDifference(entry) && entry.itemName === change.key) {
          relatedModifications.push(index);
        }
      });

      for (const index of relatedModifications.reverse()) {
        result.differences.splice(index, 1);
      }
    }
  }

  const itemDifference = difference as AnySchemaItemDifference;
  if (itemDifference === undefined) {
    return;
  }

  renameName(itemDifference, change.key, change.value);

  postProcessing(() => {
    renameSchemaItem(result, change, itemDifference.schemaType);
  });
}

function renameSchemaItem(result: SchemaDifferenceResult, change: RenameSchemaItemChange, schemaType: SchemaType) {
  const schemaKey = SchemaKey.parseString(result.sourceSchemaName);
  const oldKey = new SchemaItemKey(change.key, schemaKey);
  const newKey = new SchemaItemKey(change.value, schemaKey);

  switch (schemaType) {
    case SchemaItemType.CustomAttributeClass:
      renameCustomAttributeClassName(result, oldKey, newKey);
      break;
    case SchemaItemType.EntityClass:
      renameEntityClassName(result, oldKey, newKey);
      break;
    case SchemaItemType.Enumeration:
      renameEnumerationName(result, oldKey, newKey);
      break;
    case SchemaItemType.Format:
      break;
    case SchemaItemType.InvertedUnit:
      break;
    case SchemaItemType.KindOfQuantity:
      renameKindOfQuantityName(result, oldKey, newKey);
      break;
    case SchemaItemType.Mixin:
      renameMixinName(result, oldKey, newKey);
      break;
    case SchemaItemType.Phenomenon:
      renamePhenomenonName(result, oldKey, newKey);
      break;
    case SchemaItemType.PropertyCategory:
      renamePropertyCategoryName(result, oldKey, newKey);
      break;
    case SchemaItemType.RelationshipClass:
      renameRelationshipClassName(result, oldKey, newKey);
      break;
    case SchemaItemType.StructClass:
      renameStructClassName(result, oldKey, newKey);
      break;
    case SchemaItemType.Unit:
      break;
    case SchemaItemType.UnitSystem:
      break;
  }
}

function renameBaseClass(difference: ClassItemDifference["difference"], oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  if (difference.baseClass && oldKey.matchesFullName(difference.baseClass)) {
    difference.baseClass = newKey.fullName;
  }
}

function renameName(change: AnySchemaItemDifference, oldName: string, newName: string) {
  if (change.itemName === oldName) {
    const schemaItemDifference = change as Editable<AnySchemaItemDifference>;
    schemaItemDifference.itemName = newName;
  }
}

function renameRelationshipConstraint(change: RelationshipClassDifference | RelationshipConstraintClassDifference, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  if (change.schemaType === SchemaItemType.RelationshipClass) {
    const constraintProps = [change.difference.source, change.difference.target] as Editable<RelationshipConstraintProps>[];
    for (const props of constraintProps) {
      if (props) {
        if (props.abstractConstraint && oldKey.matchesFullName(props.abstractConstraint)) {
          props.abstractConstraint = newKey.fullName;
        }
        if (props.constraintClasses !== undefined) {
          for (let i = 0; i < props.constraintClasses.length; i++) {
            if (oldKey.matchesFullName(props.constraintClasses[i]))
              props.constraintClasses[i] = newKey.fullName;
          }
        }
      }
    }
  } else {
    for (let i = 0; i < change.difference.length; i++) {
      if (oldKey.matchesFullName(change.difference[i]))
        change.difference[i] = newKey.fullName;
    }
  }
}

function renamePropertyCategoryName({ differences }: SchemaDifferenceResult, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  for (const entry of differences) {
    if (entry.schemaType === SchemaItemType.PropertyCategory) {
      renameName(entry, oldKey.name, newKey.name);
    }

    if (Utils.isClassDifference(entry) && entry.difference.properties) {
      for (const property of entry.difference.properties) {
        if (property.category && oldKey.matchesFullName(property.category)) {
          const props = property as Editable<typeof property>;
          props.category = newKey.fullName;
        }
      }
    }

    if (entry.schemaType === SchemaOtherTypes.Property) {
      if (entry.difference.category && oldKey.matchesFullName(entry.difference.category)) {
        entry.difference.category = newKey.fullName;
      }
    }
  }
}

function renameKindOfQuantityName({ differences }: SchemaDifferenceResult, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  for (const entry of differences) {
    if (Utils.isClassDifference(entry) && entry.difference.properties) {
      for (const property of entry.difference.properties) {
        if (property.kindOfQuantity && oldKey.matchesFullName(property.kindOfQuantity)) {
          const props = property as Editable<typeof property>;
          props.kindOfQuantity = newKey.fullName;
        }
      }
    }

    if (entry.schemaType === SchemaOtherTypes.Property) {
      if (entry.difference.kindOfQuantity && oldKey.matchesFullName(entry.difference.kindOfQuantity)) {
        entry.difference.kindOfQuantity = newKey.fullName;
      }
    }
  }
}

function renameEnumerationName({ differences }: SchemaDifferenceResult, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  for (const change of differences) {
    if (Utils.isClassDifference(change) && change.difference.properties) {
      for (const property of change.difference.properties) {
        if (property.type === "PrimitiveProperty" || property.type === "PrimitiveArrayProperty") {
          const props = property as Editable<PrimitivePropertyProps | PrimitiveArrayPropertyProps>;
          if (props.typeName && oldKey.matchesFullName(props.typeName))
            props.typeName = newKey.fullName;
        }
      }
    }

    if (change.schemaType === SchemaOtherTypes.Property && (
      change.difference.type === "PrimitiveProperty" || change.difference.type === "PrimitiveArrayProperty"
    )) {
      const props = change.difference as Editable<PrimitivePropertyProps | PrimitiveArrayPropertyProps>;
      if (props.typeName && oldKey.matchesFullName(props.typeName))
        props.typeName = newKey.fullName;
    }
  }
}

function renamePhenomenonName({ differences }: SchemaDifferenceResult, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  for (const entry of differences) {
    if (entry.schemaType === SchemaItemType.Constant || entry.schemaType === SchemaItemType.Unit) {
      if (entry.difference.phenomenon && oldKey.matchesFullName(entry.difference.phenomenon))
        entry.difference.phenomenon = newKey.fullName;
    }
  }
}

function renameStructClassName({ differences }: SchemaDifferenceResult, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  for (const change of differences) {
    if (change.schemaType === SchemaItemType.StructClass) {
      renameBaseClass(change.difference, oldKey, newKey);
    }

    if (Utils.isClassDifference(change) && change.difference.properties) {
      for (const property of change.difference.properties) {
        if (property.type === "StructProperty" || property.type === "StructArrayProperty") {
          const props = property as Editable<StructPropertyProps | StructArrayPropertyProps>;;
          if (props.typeName && oldKey.matchesFullName(props.typeName))
            props.typeName = newKey.fullName;
        }
      }
    }

    if (change.schemaType === SchemaOtherTypes.Property && (
      change.difference.type === "StructProperty" || change.difference.type === "StructArrayProperty"
    )) {
      const props = change.difference as Editable<StructPropertyProps | StructArrayPropertyProps>;
      if (props.typeName && oldKey.matchesFullName(props.typeName))
        props.typeName = newKey.fullName;
    }
  }
}

function renameCustomAttributeClassName({ differences }: SchemaDifferenceResult, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  for (const change of differences) {
    if (change.schemaType === SchemaItemType.CustomAttributeClass) {
      renameBaseClass(change.difference, oldKey, newKey);
    }

    if (change.schemaType === SchemaOtherTypes.CustomAttributeInstance) {
      if (change.difference.className && oldKey.matchesFullName(change.difference.className)) {
        change.difference.className = newKey.fullName;
      }
    }

    if (change.schemaType === SchemaOtherTypes.Property || Utils.isClassDifference(change)) {
      if (change.difference.customAttributes) {
        for (const customAttribute of change.difference.customAttributes) {
          if (oldKey.matchesFullName(customAttribute.className))
            customAttribute.className = newKey.fullName;
        }
      }
    }

    if (Utils.isClassDifference(change) && change.difference.properties) {
      for (const property of change.difference.properties) {
        if (property.customAttributes) {
          for (const customAttribute of property.customAttributes) {
            if (oldKey.matchesFullName(customAttribute.className))
              customAttribute.className = newKey.fullName;
          }
        }
      }
    }
    if (change.schemaType === SchemaItemType.RelationshipClass) {
      const constraintProps = [change.difference.source, change.difference.target] as Editable<RelationshipConstraintProps>[];
      for (const props of constraintProps) {
        if (props.customAttributes !== undefined) {
          for (const customAttribute of props.customAttributes) {
            if (oldKey.matchesFullName(customAttribute.className))
              customAttribute.className = newKey.fullName;
          }
        }
      }
    }
  }
}

function renameRelationshipClassName({ differences }: SchemaDifferenceResult, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  for (const change of differences) {
    if (change.schemaType === SchemaItemType.RelationshipClass) {
      renameBaseClass(change.difference, oldKey, newKey);
    }

    if (change.schemaType === SchemaOtherTypes.Property && change.difference.type === "NavigationProperty") {
      const props = change.difference as Editable<NavigationPropertyProps>;
      if (props.relationshipName && oldKey.matchesFullName(props.relationshipName))
        props.relationshipName = newKey.fullName;
    }

    if (Utils.isClassDifference(change) && change.difference.properties) {
      for (const property of change.difference.properties) {
        if (property.type === "NavigationProperty") {
          const props = property as Editable<NavigationPropertyProps>;
          if (props.relationshipName && oldKey.matchesFullName(props.relationshipName))
            props.relationshipName = newKey.fullName;
        }
      }
    }

    if (change.schemaType === SchemaItemType.RelationshipClass || change.schemaType === SchemaOtherTypes.RelationshipConstraintClass) {
      renameRelationshipConstraint(change, oldKey, newKey);
    }
  }
}

function renameEntityClassName({ differences }: SchemaDifferenceResult, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  for (const entry of differences) {
    if (entry.schemaType === SchemaItemType.EntityClass) {
      renameName(entry, oldKey.name, newKey.name);
      renameBaseClass(entry.difference, oldKey, newKey);
    }

    if (entry.schemaType === SchemaItemType.Mixin) {
      if (entry.difference.appliesTo && oldKey.matchesFullName(entry.difference.appliesTo))
        entry.difference.appliesTo = newKey.fullName;
    }

    if (Utils.isRelationshipClassDifference(entry) || Utils.isRelationshipConstraintClassDifference(entry)) {
      renameRelationshipConstraint(entry, oldKey, newKey);
    }
  }
}

function renameMixinName({ differences }: SchemaDifferenceResult, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
  for (const entry of differences) {
    if (entry.schemaType === SchemaItemType.Mixin) {
      renameBaseClass(entry.difference, oldKey, newKey);
    }

    if (entry.schemaType === SchemaOtherTypes.EntityClassMixin) {
      for (let i = 0; i < entry.difference.length; i++) {
        if (oldKey.matchesFullName(entry.difference[i])) {
          entry.difference[i] = newKey.fullName;
        }
      }
    }

    if (Utils.isRelationshipClassDifference(entry) || Utils.isRelationshipConstraintClassDifference(entry)) {
      renameRelationshipConstraint(entry, oldKey, newKey);
    }
  }
}
