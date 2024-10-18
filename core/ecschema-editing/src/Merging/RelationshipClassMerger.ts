/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { RelationshipClassDifference, RelationshipConstraintClassDifference, RelationshipConstraintDifference } from "../Differencing/SchemaDifference";
import type { MutableRelationshipClass } from "../Editing/Mutable/MutableRelationshipClass";
import { locateSchemaItem, updateSchemaItemFullName, updateSchemaItemKey } from "./Utils";
import { modifyClass } from "./ClassMerger";
import { SchemaMergeContext } from "./SchemaMerger";
import { EntityClass, Mixin, parseStrength, parseStrengthDirection, RelationshipClass, RelationshipConstraintProps, RelationshipMultiplicity, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";

type ConstraintClassTypes = EntityClass | Mixin | RelationshipClass;

/**
 * Merges a new RelationshipClass into the target schema.
 * @internal
 */
export async function addRelationshipClass(context: SchemaMergeContext, change: RelationshipClassDifference) {
  if (change.difference.strength === undefined) {
    throw new Error("RelationshipClass must define strength");
  }
  if (change.difference.strengthDirection === undefined) {
    throw new Error("RelationshipClass must define strengthDirection");
  }
  if (change.difference.source === undefined) {
    throw new Error("RelationshipClass must define a source constraint");
  }
  if (change.difference.target === undefined) {
    throw new Error("RelationshipClass must define a target constraint");
  }

  await context.editor.relationships.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    strength: change.difference.strength,
    strengthDirection: change.difference.strengthDirection,
    source: await updateRelationshipConstraintKey(context, change.difference.source),
    target: await updateRelationshipConstraintKey(context, change.difference.target),
  });
}

/**
 * Merges differences to an existing RelationshipClass in the target schema.
 * @internal
 */
export async function modifyRelationshipClass(context: SchemaMergeContext, change: RelationshipClassDifference, itemKey: SchemaItemKey) {
  const item = await context.targetSchema.lookupItem(itemKey) as MutableRelationshipClass;
  if(change.changeType === "modify") {
    if(change.difference.strength !== undefined) {
      if (item.strength === undefined) {
        const strength = parseStrength(change.difference.strength);
        if (strength === undefined) {
          throw new Error(`An invalid relationship class strength value '${change.difference.strength}' has been provided.`);
        }
        item.setStrength(strength);
      }
      throw new Error(`Changing the relationship '${itemKey.name}' strength is not supported.`);
    }
    if(change.difference.strengthDirection !== undefined) {
      if (item.strengthDirection === undefined) {
        const strengthDirection = parseStrengthDirection(change.difference.strengthDirection);
        if (strengthDirection === undefined) {
          throw new Error(`An invalid relationship class strengthDirection value '${change.difference.strengthDirection}' has been provided.`);
        }
        item.setStrengthDirection(strengthDirection);
      }
      throw new Error(`Changing the relationship '${itemKey.name}' strengthDirection is not supported.`);
    }
  }
  await modifyClass(context, change, itemKey, item);
}

/**
 * Merges differences of a Relationship constraint.
 * This only supports modify as the RelationshipConstraints are always set on the Relationship classes.
 * @internal
 */
export async function mergeRelationshipConstraint(context: SchemaMergeContext, change: RelationshipConstraintDifference) {
  if(change.changeType !== "modify") {
    throw new Error("RelationshipConstraints can only be modified.");
  }

  const item = await locateSchemaItem(context, change.itemName, SchemaItemType.RelationshipClass) as MutableRelationshipClass;
  const constraint = item[parseConstraint(change.path)];
  if(change.difference.roleLabel !== undefined) {
    constraint.roleLabel = change.difference.roleLabel;
  }
  if(change.difference.polymorphic !== undefined) {
    await context.editor.relationships.setConstraintPolymorphic(constraint, change.difference.polymorphic);
  }
  if(change.difference.multiplicity !== undefined) {
    if (constraint.multiplicity === undefined) {
      const multiplicity = RelationshipMultiplicity.fromString(change.difference.multiplicity);
      if (multiplicity === undefined) {
        throw new Error(`An invalid relationship constraint multiplicity value '${change.difference.multiplicity}' has been provided.`);
      }
      await context.editor.relationships.setConstraintMultiplicity(constraint, multiplicity);
    }
    throw new Error(`Changing the relationship constraint '${constraint.fullName}' multiplicity is not supported.`);
  }
  if(change.difference.abstractConstraint !== undefined) {
    const itemKey = await updateSchemaItemKey(context, change.difference.abstractConstraint);
    const abstractConstraint = await context.editor.schemaContext.getSchemaItem<ConstraintClassTypes>(itemKey);
    if (abstractConstraint === undefined) {
      throw new Error(`Unable to locate the abstract constraint class ${change.difference.abstractConstraint} in the context schema.`);
    }
    return context.editor.relationships.setAbstractConstraint(constraint, abstractConstraint);
  }
  return { itemKey: constraint.relationshipClass.key };
}

/**
 * Merges differences of a Relationship constraint classes.
 * @internal
 */
export async function mergeRelationshipClassConstraint(context: SchemaMergeContext, change: RelationshipConstraintClassDifference): Promise<void> {
  if(change.changeType !== "add") {
    throw new Error(`Change type ${change.changeType} is not supported for Relationship constraint classes.`);
  }

  const item = await locateSchemaItem(context, change.itemName, SchemaItemType.RelationshipClass) as MutableRelationshipClass;
  const constraint = item[parseConstraint(change.path)];
  for(const constraintName of change.difference) {
    const constraintClassKey = await updateSchemaItemKey(context, constraintName);
    const constraintClass = await context.editor.schemaContext.getSchemaItem<ConstraintClassTypes>(constraintClassKey);
    if(constraintClass === undefined) {
      throw new Error(`Could not locate relationship constraint class ${constraintClassKey.name}`);
    }

    await context.editor.relationships.addConstraintClass(constraint, constraintClass);
  }
}

function parseConstraint(path: string): "source" | "target" {
  return path.startsWith("$source")
    ? "source"
    : "target";
}

async function updateRelationshipConstraintKey(context: SchemaMergeContext, props: RelationshipConstraintProps): Promise<RelationshipConstraintProps> {
  let abstractConstraint = props.abstractConstraint;
  if (abstractConstraint !== undefined)
    abstractConstraint = await updateSchemaItemFullName(context, abstractConstraint);

  const constraintClasses: string[] = [];
  for (const ecClass of props.constraintClasses) {
    constraintClasses.push(await updateSchemaItemFullName(context, ecClass));
  }

  return {
    ...props,
    abstractConstraint,
    constraintClasses,
  };
}
