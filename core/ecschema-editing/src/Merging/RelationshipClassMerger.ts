/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { type RelationshipClassDifference, type RelationshipConstraintClassDifference, type RelationshipConstraintDifference, SchemaDifference } from "../Differencing/SchemaDifference";
import { type MutableRelationshipClass } from "../Editing/Mutable/MutableRelationshipClass";
import { type SchemaItemMergerHandler, updateSchemaItemKey } from "./SchemaItemMerger";
import { modifyClass } from "./ClassMerger";
import { SchemaMergeContext } from "./SchemaMerger";
import { EntityClass, Mixin, parseStrength, parseStrengthDirection, RelationshipClass, RelationshipMultiplicity, SchemaItemKey } from "@itwin/ecschema-metadata";

type RelationshipDifferences =
  RelationshipClassDifference |
  RelationshipConstraintDifference |
  RelationshipConstraintClassDifference;

type ConstraintClassTypes = EntityClass | Mixin | RelationshipClass;

/**
 * Defines a merge handler to merge RelationshipClass schema items.
 * @internal
 */
export const relationshipClassMerger: SchemaItemMergerHandler<RelationshipDifferences> = {
  async add(context, change) {
    if(SchemaDifference.isRelationshipConstraintDifference(change) || SchemaDifference.isRelationshipConstraintClassDifference(change)) {
      return { errorMessage: "RelationshipConstraints cannot be added." };
    }

    if (change.difference.strength === undefined) {
      return { errorMessage: "RelationshipClass must define strength" };
    }
    if (change.difference.strengthDirection === undefined) {
      return { errorMessage: "RelationshipClass must define strengthDirection" };
    }
    if (change.difference.source === undefined) {
      return { errorMessage: "RelationshipClass must define a source constraint" };
    }
    if (change.difference.target === undefined) {
      return { errorMessage: "RelationshipClass must define a target constraint" };
    }

    return context.editor.relationships.createFromProps(context.targetSchemaKey, {
      ...change.difference,
      name: change.itemName,
      schemaItemType: change.schemaType,
      strength: change.difference.strength,
      strengthDirection: change.difference.strengthDirection,
      source: change.difference.source,
      target: change.difference.target,
    });
  },
  async modify(context, change, itemKey, item: MutableRelationshipClass) {
    if(SchemaDifference.isRelationshipConstraintDifference(change)) {
      return modifyRelationshipConstraint(context, change, item);
    }
    if(SchemaDifference.isRelationshipConstraintClassDifference(change)) {
      return modifyRelationshipClassConstraint(context, change, item);
    }
    return modifyRelationshipClass(context, change, itemKey, item);
  },
};

async function modifyRelationshipClass(context: SchemaMergeContext, change: RelationshipClassDifference, itemKey: SchemaItemKey, item: MutableRelationshipClass) {
  // The following modifications will only be applied if the items gets modified
  // and not the 2nd pass when adding a RelationshipClass.
  if(change.changeType === "modify") {
    if(change.difference.strength !== undefined) {
      if (item.strength === undefined) {
        const strength = parseStrength(change.difference.strength);
        if (strength === undefined) {
          return { itemKey, errorMessage: `An invalid relationship class strength value '${change.difference.strength}' has been provided.` };
        }
        item.setStrength(strength);
        return { itemKey };
      }
      return { itemKey, errorMessage: `Changing the relationship '${itemKey.name}' strength is not supported.` };
    }
    if(change.difference.strengthDirection !== undefined) {
      if (item.strengthDirection === undefined) {
        const strengthDirection = parseStrengthDirection(change.difference.strengthDirection);
        if (strengthDirection === undefined) {
          return { itemKey, errorMessage: `An invalid relationship class strengthDirection value '${change.difference.strengthDirection}' has been provided.` };
        }
        item.setStrengthDirection(strengthDirection);
        return { itemKey };
      }
      return { itemKey, errorMessage: `Changing the relationship '${itemKey.name}' strengthDirection is not supported.` };
    }
  }
  return modifyClass(context, change, itemKey, item);
}

async function modifyRelationshipConstraint(context: SchemaMergeContext, change: RelationshipConstraintDifference, item: MutableRelationshipClass) {
  const constraint = item[parseConstraint(change.path)];
  if(change.difference.roleLabel !== undefined) {
    constraint.roleLabel = change.difference.roleLabel;
  }
  if(change.difference.polymorphic !== undefined) {
    const result = await context.editor.relationships.setConstraintPolymorphic(constraint, change.difference.polymorphic);
    if(result.errorMessage) {
      return result;
    }
  }
  if(change.difference.multiplicity !== undefined) {
    if (constraint.multiplicity === undefined) {
      const multiplicity = RelationshipMultiplicity.fromString(change.difference.multiplicity);
      if (multiplicity === undefined) {
        return { errorMessage: `An invalid relationship constraint multiplicity value '${change.difference.multiplicity}' has been provided.` };
      }
      const result = await context.editor.relationships.setConstraintMultiplicity(constraint, multiplicity);
      if(result.errorMessage) {
        return result;
      }
    }
    return { errorMessage: `Changing the relationship constraint '${constraint.fullName}' multiplicity is not supported.` };
  }
  if(change.difference.abstractConstraint !== undefined) {
    const itemKey = await updateSchemaItemKey(context, change.difference.abstractConstraint);
    const abstractConstraint = await context.editor.schemaContext.getSchemaItem<ConstraintClassTypes>(itemKey);
    if (abstractConstraint === undefined) {
      return { itemKey: constraint.relationshipClass.key, errorMessage: `Unable to locate the abstract constraint class ${change.difference.abstractConstraint} in the context schema.`};
    }
    return context.editor.relationships.setAbstractConstraint(constraint, abstractConstraint);
  }
  return { itemKey: constraint.relationshipClass.key };
}

async function modifyRelationshipClassConstraint(context: SchemaMergeContext, change: RelationshipConstraintClassDifference, item: MutableRelationshipClass) {
  const constraint = item[parseConstraint(change.path)];
  for(const constraintName of change.difference) {
    const constraintClassKey = await updateSchemaItemKey(context, constraintName);
    const constraintClass = await context.editor.schemaContext.getSchemaItem<ConstraintClassTypes>(constraintClassKey);
    if(constraintClass === undefined) {
      return { errorMessage: `Could not locate relationship constraint class ${constraintClassKey.name}` };
    }
    const result = await context.editor.relationships.addConstraintClass(constraint, constraintClass);
    if(result.errorMessage) {
      return result;
    }
  }
  return { itemKey: constraint.relationshipClass.key };
}

function parseConstraint(path: string): "source" | "target" {
  return path.startsWith("$source")
    ? "source"
    : "target";
}
