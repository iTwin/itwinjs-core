/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { AnyPropertyProps, ClassProps, NavigationPropertyProps, PrimitiveArrayPropertyProps, PrimitivePropertyProps, RelationshipConstraintProps, SchemaItemKey, SchemaItemType, SchemaKey, StructArrayPropertyProps, StructPropertyProps } from "@itwin/ecschema-metadata";
import { AnySchemaItemDifference, ClassItemDifference, ClassPropertyDifference, PartialEditable, RelationshipClassDifference, RelationshipConstraintClassDifference, SchemaDifference, SchemaItemProperties, SchemaOtherTypes, type SchemaDifferences } from "./SchemaDifference";
import { Rename } from "./SchemaFixes";
import { ConflictCode } from "./SchemaConflicts";

export namespace RenameFixes {
  export function add(differences: SchemaDifferences, fix: Rename) {
    if (fix.path === undefined)
      return addSchemaItem(differences, fix);
    return addProperty(differences, fix);
  }

  export function modify(differences: SchemaDifferences, fix: Rename) {
    if (fix.path === undefined)
      return renameSchemaItem(differences, fix);
    return renameProperty(differences, fix);
  }

  function addProperty(differences: SchemaDifferences, fix: Rename) {
    const classPropertyDifference = differences.differences.find((change) => change.changeType === "add" 
      && SchemaDifference.isClassPropertyDifference(change) && change.itemName === fix.itemName 
      && change.path === fix.path);

    if (classPropertyDifference !== undefined) {
      return;
    }

    const classItemDifference = differences.differences.find((change) => change.changeType === "add" 
      && SchemaDifference.isClassItemDifference(change) && change.itemName === fix.itemName) as ClassItemDifference;

    if (classItemDifference && classItemDifference.difference.properties) {
      for (const property of classItemDifference.difference.properties) {
        if (property.name === fix.path) {
          return;
        }
      }
    }

    const conflict = differences.conflicts?.find((conflict) =>  conflict.code === ConflictCode.ConflictingPropertyName
      && conflict.itemName === fix.itemName && conflict.path === fix.path);
    if (conflict === undefined) 
      throw new Error(`Property ${fix.itemName}.${fix.path} couldn't be found in conflicts or differences.`); 

    differences.differences.push({
      changeType: "add",
      schemaType: SchemaOtherTypes.Property,
      itemName: fix.itemName,
      path: fix.value,
      difference: conflict.difference,
    } as ClassPropertyDifference);
  }

  export function addSchemaItem(differences: SchemaDifferences, fix: Rename) {
    const difference = differences.differences.find((change) => change.changeType === "add" 
      && "itemName" in change && change.itemName === fix.itemName) as PartialEditable<AnySchemaItemDifference>;
    if (difference !== undefined) {
      return;
    }
    const conflict = differences.conflicts?.find((conflict) => conflict.code === ConflictCode.ConflictingItemName
      && conflict.itemName === fix.itemName);
    if (conflict === undefined)
      throw new Error(`Entity ${fix.itemName} couldn't be found in conflicts or differences.`); 

    differences.differences.push({
      changeType: "add",
      schemaType: conflict.schemaType,
      itemName: fix.value,
      difference: conflict.difference,
    } as AnySchemaItemDifference);
  }

  function renameProperty (differences: SchemaDifferences, fix: Rename) {
    for (const change of differences.differences) {
      if (change.schemaType === SchemaOtherTypes.Property && change.itemName === fix.itemName && change.path === fix.path) {
        const difference = change as PartialEditable<ClassPropertyDifference>;
        difference.path = fix.value;
      }

      if (SchemaDifference.isClassItemDifference(change) && change.itemName === fix.itemName && change.difference.properties) {
        for (const property of change.difference.properties) {
          if (property.name === fix.path) {
            const props = property as PartialEditable<AnyPropertyProps>;
            props.name = fix.value;
          }
        }
      }
    }
  }

 function getFixChange(differences: SchemaDifferences, fix: Rename) {
    return differences.conflicts?.find((conflict) => conflict.itemName === fix.itemName)
      ?? differences.differences.find((change) => 'itemName' in change && change.itemName === fix.itemName);
  }

 async function renameSchemaItem(differences: SchemaDifferences, fix: Rename) {
    const change = getFixChange(differences, fix);
    if (change === undefined)
      throw new Error(`Entity ${fix.itemName} couldn't be found in conflicts or differences.`); 

    const schemaKey = SchemaKey.parseString(differences.sourceSchemaName);
    const oldKey = new SchemaItemKey(fix.itemName, schemaKey);
    const newKey = new SchemaItemKey(fix.value, schemaKey);

    switch (change.schemaType) {
      case SchemaItemType.CustomAttributeClass:
        renameCustomAttributeClassName(differences, oldKey, newKey);
        break;
      case SchemaItemType.EntityClass:
        renameEntityClassName(differences, oldKey, newKey);
        break;
      case SchemaItemType.Enumeration:
        renameEnumerationName(differences, oldKey, newKey);
        break;
      case SchemaItemType.Format:
        break;
      case SchemaItemType.InvertedUnit:
        break;
      case SchemaItemType.KindOfQuantity:
        renameKindOfQuantityName(differences, oldKey, newKey);
        break;
      case SchemaItemType.Mixin:
        renameMixinName(differences, oldKey, newKey);
        break;
      case SchemaItemType.Phenomenon:
        renamePhenomenonName(differences, oldKey, newKey);
        break;
      case SchemaItemType.PropertyCategory:
        renamePropertyCategoryName(differences, oldKey, newKey);
        break;
      case SchemaItemType.RelationshipClass:
        renameRelationshipClassName(differences, oldKey, newKey);
        break;
      case SchemaItemType.StructClass:
        renameStructClassName(differences, oldKey, newKey);
        break;
      case SchemaItemType.Unit:
        break;
      case SchemaItemType.UnitSystem:
        break;
    }
  }
 
  function renameBaseClass(difference: SchemaItemProperties<ClassProps>, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    if (difference.baseClass && oldKey.matchesFullName(difference.baseClass))
      difference.baseClass = newKey.fullName;
  }

  function renameName(change: AnySchemaItemDifference, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    if (change.itemName === oldKey.name) {
      const schemaItemDifference = change as PartialEditable<AnySchemaItemDifference>;
      schemaItemDifference.itemName = newKey.name;
    }
  }

  function renameRelationshipConstraint(change: RelationshipClassDifference | RelationshipConstraintClassDifference, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    if (change.schemaType === SchemaItemType.RelationshipClass) {
      const constraintProps = [change.difference.source, change.difference.target] as PartialEditable<RelationshipConstraintProps>[];
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

  function renamePropertyCategoryName(differences: SchemaDifferences, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    for (const change of differences.differences) {
      if (change.schemaType === SchemaItemType.PropertyCategory)
        renameName(change, oldKey, newKey);

      if (SchemaDifference.isClassItemDifference(change) && change.difference.properties) {
        for (const property of change.difference.properties) {
          if (property.category && oldKey.matchesFullName(property.category)) {
            const props = property as PartialEditable<AnyPropertyProps>;
            props.category = newKey.fullName;
          }
        }
      }

      if (change.schemaType === SchemaOtherTypes.Property) {
        if (change.difference.category && oldKey.matchesFullName(change.difference.category))
          change.difference.category = newKey.fullName;
      }
    } 
  }

  function renameKindOfQuantityName(differences: SchemaDifferences, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    for (const change of differences.differences) {
      if (SchemaDifference.isClassItemDifference(change) && change.difference.properties) {
        for (const property of change.difference.properties) {
          if (property.kindOfQuantity && oldKey.matchesFullName(property.kindOfQuantity)) {
            const props = property as PartialEditable<AnyPropertyProps>;
            props.kindOfQuantity = newKey.fullName;
          }
        }
      }

      if (change.schemaType === SchemaOtherTypes.Property) {
        if (change.difference.kindOfQuantity && oldKey.matchesFullName(change.difference.kindOfQuantity))
          change.difference.kindOfQuantity = newKey.fullName;
      }
    } 
  }

  function renameEnumerationName(differences: SchemaDifferences, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    for (const change of differences.differences) {
      if (SchemaDifference.isClassItemDifference(change) && change.difference.properties) {
        for (const property of change.difference.properties) {
          if (property.type === "PrimitiveProperty" || property.type === "PrimitiveArrayProperty") {
            const props = property as PartialEditable<PrimitivePropertyProps | PrimitiveArrayPropertyProps>;
            if (props.typeName && oldKey.matchesFullName(props.typeName))
              props.typeName = newKey.fullName;
          }
        }
      }

      if (change.schemaType === SchemaOtherTypes.Property && (
        change.difference.type === "PrimitiveProperty" || change.difference.type === "PrimitiveArrayProperty"
      )) {
        const props = change.difference as PartialEditable<PrimitivePropertyProps | PrimitiveArrayPropertyProps>;
        if (props.typeName && oldKey.matchesFullName(props.typeName))
          props.typeName = newKey.fullName;
      }
    }
  }

  function renamePhenomenonName(differences: SchemaDifferences, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    for (const change of differences.differences) {
      if (change.schemaType === SchemaItemType.Constant || change.schemaType === SchemaItemType.Unit) {
        if (change.difference.phenomenon && oldKey.matchesFullName(change.difference.phenomenon))
          change.difference.phenomenon = newKey.fullName;
      }
    }
  }

  function renameStructClassName(differences: SchemaDifferences, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    for (const change of differences.differences) {
      if (change.schemaType === SchemaItemType.StructClass) {
        renameBaseClass(change.difference, oldKey, newKey);
      } 

      if (SchemaDifference.isClassItemDifference(change) && change.difference.properties) {
        for (const property of change.difference.properties) {
          if (property.type === "StructProperty" || property.type === "StructArrayProperty") {
            const props = property as PartialEditable<StructPropertyProps | StructArrayPropertyProps>;;
            if (props.typeName && oldKey.matchesFullName(props.typeName))
              props.typeName = newKey.fullName;
          }
        }
      }

      if (change.schemaType === SchemaOtherTypes.Property && (
        change.difference.type === "StructProperty" || change.difference.type === "StructArrayProperty"
      )) {
        const props = change.difference as PartialEditable<StructPropertyProps | StructArrayPropertyProps>;
        if (props.typeName && oldKey.matchesFullName(props.typeName))
          props.typeName = newKey.fullName;
      }
    }
  }

  function renameCustomAttributeClassName(differences: SchemaDifferences, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    for (const change of differences.differences) {
      if (change.schemaType === SchemaItemType.CustomAttributeClass) {
        renameBaseClass(change.difference, oldKey, newKey);
      }

      if (change.schemaType === SchemaOtherTypes.CustomAttributeInstance) {
        if (change.difference.className && oldKey.matchesFullName(change.difference.className)) {
          change.difference.className = newKey.fullName;
        }
      }

      if (change.schemaType === SchemaOtherTypes.Property || SchemaDifference.isClassItemDifference(change)) {
        if (change.difference.customAttributes) {
          for (let i = 0; i < change.difference.customAttributes.length; i++) {
            if (oldKey.matchesFullName(change.difference.customAttributes[i].className))
              change.difference.customAttributes[i].className = newKey.fullName;
          }
        }
      }

      if (SchemaDifference.isClassItemDifference(change) && change.difference.properties) {
        for (const property of change.difference.properties) {
          if (property.customAttributes) {
            for (let i = 0; i < property.customAttributes.length; i++) {
              if (oldKey.matchesFullName(property.customAttributes[i].className))
                property.customAttributes[i].className = newKey.fullName;
            }
          }
        }
      }
      if (change.schemaType === SchemaItemType.RelationshipClass) {
        const constraintProps = [change.difference.source, change.difference.target] as PartialEditable<RelationshipConstraintProps>[];
        for (const props of constraintProps) {
          if (props.customAttributes !== undefined) {
            for (let i = 0; i < props.customAttributes.length; i++) {
              if (oldKey.matchesFullName(props.customAttributes[i].className))
                props.customAttributes[i].className = newKey.fullName;
            }
          }
        }
      }
    }
  }

  function renameRelationshipClassName(differences: SchemaDifferences, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    for (const change of differences.differences) {
      if (change.schemaType === SchemaItemType.RelationshipClass) {
        renameBaseClass(change.difference, oldKey, newKey);
      }

      if (change.schemaType === SchemaOtherTypes.Property && change.difference.type === "NavigationProperty") {
        const props = change.difference as PartialEditable<NavigationPropertyProps>;
        if (props.relationshipName && oldKey.matchesFullName(props.relationshipName))
          props.relationshipName = newKey.fullName;
      }

      if (SchemaDifference.isClassItemDifference(change) && change.difference.properties) {
        for (const property of change.difference.properties) {
          if (property.type === "NavigationProperty") {
            const props = property as PartialEditable<NavigationPropertyProps>;
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

  function renameEntityClassName(differences: SchemaDifferences, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    for (const change of differences.differences) {
      if (change.schemaType === SchemaItemType.EntityClass) {
        renameName(change, oldKey, newKey);
        renameBaseClass(change.difference, oldKey, newKey);
      }

      if (change.schemaType === SchemaItemType.Mixin) {
        if (change.difference.appliesTo && oldKey.matchesFullName(change.difference.appliesTo))
          change.difference.appliesTo = newKey.fullName;
      }

      if (change.schemaType === SchemaItemType.RelationshipClass || change.schemaType === SchemaOtherTypes.RelationshipConstraintClass) {
        renameRelationshipConstraint(change, oldKey, newKey);
      }
    }
  }

  function renameMixinName(differences: SchemaDifferences, oldKey: SchemaItemKey, newKey: SchemaItemKey) {
    for (const change of differences.differences) {
      if (change.schemaType === SchemaItemType.Mixin) {
        renameBaseClass(change.difference, oldKey, newKey);
      } 

      if (change.schemaType === SchemaOtherTypes.EntityClassMixin) {
        for (var i = 0; i < change.difference.length; i++) {
          if (oldKey.matchesFullName(change.difference[i]))
            change.difference[i] = newKey.fullName;
        }
      }

      if (change.schemaType === SchemaItemType.RelationshipClass || change.schemaType === SchemaOtherTypes.RelationshipConstraintClass) {
        renameRelationshipConstraint(change, oldKey, newKey);
      }
    }
  }  
}
