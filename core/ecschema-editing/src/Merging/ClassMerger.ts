/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, SchemaItemType } from "@itwin/ecschema-metadata";
import { ChangeType, ClassChanges } from "../Validation/SchemaChanges";
import { SchemaChangeContext } from "./SchemaMerger";

export class ClassMerger {

  public static async merge(context: SchemaChangeContext, changes: ClassChanges) {
    if (changes.schemaItemType === SchemaItemType.EntityClass) {
      return ClassMerger.mergeEntities(context, changes); 
    }

    if (changes.schemaItemType === SchemaItemType.RelationshipClass) {
      return ClassMerger.mergeRelationships(context, changes);
    }
  }

  public static async mergeEntities(context: SchemaChangeContext, changes: ClassChanges) {
    const sourceEntity = await changes.schema.getItem<EntityClass>(changes.ecTypeName);
    if (sourceEntity === undefined) {
      throw Error(`Entity class '${changes.ecTypeName}' not found in source schema`);
    }

    if (changes.schemaItemMissing?.changeType === ChangeType.Missing) {
      const entityProps = {...sourceEntity.toJSON(), name: sourceEntity.name };
      const result = await context.editor.entities.createFromProps(context.targetSchema.schemaKey, entityProps);
      if (result.errorMessage !== undefined) {
        throw Error(`Failed to merge '${changes.ecTypeName}' entity: ${result.errorMessage}`);
      }
    }

    for (const propertyChange of changes.propertyChanges.values()) {
      if (propertyChange.propertyMissing?.changeType === ChangeType.Missing) {

        const property = await sourceEntity.getProperty(propertyChange.ecTypeName);
        if (property === undefined) {
          throw Error(`Property '${propertyChange.ecTypeName}' not found in class ${changes.ecTypeName}`);  
        }

        if (property.isPrimitive()) {
          const targetEntity = await context.targetSchema.getItem<EntityClass>(changes.ecTypeName);
          if (targetEntity === undefined) {
            throw Error(`Entity class '${changes.ecTypeName}' not found in target schema`);  
          }

          const primitiveProps =  property.toJSON();
          const result = property.isArray() 
            ? await context.editor.entities.createPrimitiveArrayPropertyFromProps(targetEntity.key, propertyChange.ecTypeName, property.primitiveType, primitiveProps)
            : await context.editor.entities.createPrimitivePropertyFromProps(targetEntity.key, propertyChange.ecTypeName, property.primitiveType, primitiveProps);
            
          if (result.errorMessage !== undefined) {
            throw Error(`Failed to merge '${propertyChange.ecTypeName}' property: ${result.errorMessage}`);
          }            
        }
        else {
          throw Error(`Failed to merge '${propertyChange.ecTypeName}' property: not supported type`);
        }
      }  
    }
  }

  public static async mergeRelationships(_context: SchemaChangeContext, _changes: ClassChanges) {
  }
}
