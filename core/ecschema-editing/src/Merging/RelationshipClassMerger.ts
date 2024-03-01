/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, Mixin, parseStrength, parseStrengthDirection, RelationshipClass, RelationshipConstraint, RelationshipMultiplicity, SchemaItem, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { ClassMerger } from "./ClassMerger";
import { SchemaItemEditResults } from "../Editing/Editor";
import { ClassChanges, RelationshipConstraintChanges } from "../Validation/SchemaChanges";
import { MutableRelationshipClass } from "@itwin/ecschema-metadata/src/Metadata/RelationshipClass";
import { MutableRelationshipConstraint } from "../Editing/Mutable/MutableRelationshipClass";
import { mergeCustomAttributes } from "./CustomAttributeMerger";

/**
 * @internal
 */
export default class RelationshipClassMerger extends ClassMerger<RelationshipClass> {

  protected override async create(schemaKey: SchemaKey, ecClass: RelationshipClass): Promise<SchemaItemEditResults> {
    return this.context.editor.relationships.create(schemaKey, ecClass.name, ecClass.modifier, ecClass.strength, ecClass.strengthDirection);
  }

  protected override async mergeAttributes(ecClass: RelationshipClass, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<SchemaItemEditResults | boolean> {
    const mutableRelationship = ecClass as unknown as MutableRelationshipClass;
    switch(attributeName) {
      case "strength":
        if (attributeOldValue === undefined) {
          const strength = parseStrength(attributeNewValue);
          if (strength === undefined) {
            return { itemKey: ecClass.key, errorMessage: `An invalid relationship class strength value '${attributeNewValue}' has been provided.` };
          }
          mutableRelationship.setStrength(strength);
          return true;
        }
        return { errorMessage: `Changing the relationship '${ecClass.name}' strength is not supported.` };

      case "strengthDirection":
        if (attributeOldValue === undefined) {
          const strengthDirection = parseStrengthDirection(attributeNewValue);
          if (strengthDirection === undefined) {
            return { itemKey: ecClass.key, errorMessage: `An invalid relationship class strengthDirection value '${attributeNewValue}' has been provided.` };
          }
          mutableRelationship.setStrengthDirection(strengthDirection);
          return true;
        }
        return { errorMessage: `Changing the relationship '${ecClass.name}' strengthDirection is not supported.` };
    }
    return super.mergeAttributes(ecClass, attributeName, attributeNewValue, attributeOldValue);
  }

  private async mergeConstraintAttributes(constraint: RelationshipConstraint, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<SchemaItemEditResults | boolean> {
    switch(attributeName) {
      case "multiplicity":
        if (attributeOldValue === undefined) {
          const multiplicity = RelationshipMultiplicity.fromString(attributeNewValue);
          if (multiplicity === undefined) {
            return { errorMessage: `An invalid relationship constraint multiplicity value '${attributeNewValue}' has been provided.` };
          }
          return this.context.editor.relationships.setConstraintMultiplicity(constraint, multiplicity);
        }
        return { errorMessage: `Changing the relationship constraint '${constraint.fullName}' multiplicity is not supported.` };

      case "polymorphic":
        if (attributeOldValue === undefined || attributeNewValue === true) {
          return this.context.editor.relationships.setConstraintPolymorphic(constraint, attributeNewValue);
        }
        return { errorMessage: `Changing the relationship constraint '${constraint.fullName}' polymorphic is not supported.` };

      case "roleLabel":
        (constraint as MutableRelationshipConstraint).roleLabel = attributeNewValue;
        return true;

      case "abstractConstraint":
        const [schemaName, itemName] = SchemaItem.parseFullName(attributeNewValue);
        const itemKey = new SchemaItemKey(itemName, this.context.sourceSchema.schemaKey.compareByName(schemaName)
          ? this.context.targetSchema.schemaKey
          : new SchemaKey(schemaName));

        const abstractConstraint = await this.context.targetSchema.lookupItem<Mixin | EntityClass | RelationshipClass>(itemKey);
        if (abstractConstraint === undefined) {
          return { itemKey: constraint.relationshipClass.key, errorMessage: `Unable to locate the abstract constraint class ${attributeNewValue} in the context schema.`};
        }
        return this.context.editor.relationships.setAbstractConstraint(constraint, abstractConstraint);
    }
    return false;
  }

  private async mergeConstraintChanges(constraint: RelationshipConstraint, constraintChanges: IterableIterator<RelationshipConstraintChanges>): Promise<SchemaItemEditResults> {
    for (const change of constraintChanges) {

      for (const constraintClassChange of change.constraintClassChanges) {
        const ecClass = constraintClassChange.diagnostic.messageArgs![0];
        const itemKey = new SchemaItemKey(ecClass.name, this.context.sourceSchema.schemaKey.matches(ecClass.schema.schemaKey)
          ? this.context.targetSchema.schemaKey
          : ecClass.schema.schemaKey);

        const constaintClass = await this.context.targetSchema.lookupItem<Mixin | EntityClass | RelationshipClass>(itemKey);
        if (constaintClass === undefined) {
          return { itemKey: constraint.relationshipClass.key, errorMessage: `Unable to locate the constraint class ${itemKey.fullName} in the context schema.` };
        }
        const results = await this.context.editor.relationships.addConstraintClass(constraint, constaintClass);
        if (results.errorMessage !== undefined) {
          return results;
        }
      }

      for (const propertyValueChange of change.propertyValueChanges) {
        const [attributeName, attributeNewValue, attributeOldValue] = propertyValueChange.diagnostic.messageArgs!;
        const results = await this.mergeConstraintAttributes(constraint, attributeName, attributeNewValue, attributeOldValue);
        if (this.isSchemaItemEditResults(results) && results.errorMessage !== undefined) {
          return results;
        }
      }

      if (change.customAttributeChanges.size > 0) {
        const results = await mergeCustomAttributes(this.context, change.customAttributeChanges.values(), async (ca) => {
          return this.context.editor.relationships.addCustomAttributeToConstraint(constraint, ca);
        });
        if (results.errorMessage !== undefined) {
          return results;
        }
      }
    }

    return { itemKey: constraint.relationshipClass.key };
  }

  protected override async merge(itemKey: SchemaItemKey, changes: ClassChanges): Promise<SchemaItemEditResults> {
    if (changes.sourceConstraintChanges.size > 0 || changes.targetConstraintChanges.size > 0) {

      const relationshipClass = await this.context.targetSchema.lookupItem<RelationshipClass>(itemKey);
      if (relationshipClass === undefined) {
        return { itemKey, errorMessage: `Unable to locate the relationship class ${itemKey.name} in the context schema.` };
      }

      if (changes.sourceConstraintChanges.size > 0) {
        const result = await this.mergeConstraintChanges(relationshipClass.source, changes.sourceConstraintChanges.values());
        if (result.errorMessage !== undefined) {
          return result;
        }
      }

      if (changes.targetConstraintChanges.size > 0) {
        const result = await this.mergeConstraintChanges(relationshipClass.target, changes.targetConstraintChanges.values());
        if (result.errorMessage !== undefined) {
          return result;
        }
      }
    }

    return { itemKey };
  }
}
