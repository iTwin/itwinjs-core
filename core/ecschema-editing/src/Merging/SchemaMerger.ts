/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editing/Editor";
import { SchemaChanges, SchemaItemChanges } from "../Validation/SchemaChanges";
import { SchemaComparer } from "../Validation/SchemaComparer";

import mergeClasses from "./ClassMerger";
import mergeEnumeration from "./EnumerationMerger";
import mergeSchemaItems from "./SchemaItemMerger";

/**
 * Defines the context of a Schema merging run.
 * @alpha
 */
export interface SchemaMergeContext {
  readonly targetSchema: Schema;
  readonly sourceSchema: Schema;
  readonly editor: SchemaContextEditor;
}

/**
 * TBD
 * @alpha
 */
export class SchemaMerger {
  /**
   * Gets the @see SchemaChanges between the two given Schemas from perspective of the source
   * to the target schema. For example if source contains a class which does not exists in the
   * target one, it would be listed as missing.
   * @param targetSchema  The schema the differences gets merged into.
   * @param sourceSchema  The schema to compare.
   * @returns             An instance of @see SchemaChanges between the two schemas.
   */
  private async getSchemaChanges(targetSchema: Schema, sourceSchema: Schema): Promise<SchemaChanges> {
    const changesList: SchemaChanges[] = [];
    const schemaComparer = new SchemaComparer({ report: changesList.push.bind(changesList) });

    // It is important to compare the schema items by name, not full name as otherwise
    // we'd often see differences when comparing two different schemas.
    await schemaComparer.compareSchemas(sourceSchema, targetSchema, {
      compareItemFullName: false,
    });

    return changesList[0];
  }

  /**
   * Copy the SchemaItems of the source schemas to the target schema.
   * @param targetSchema  The schema the SchemaItems gets merged to.
   * @param sourceSchema  The schema the SchemaItems gets copied from.
   * @returns             The merged target schema.
   */
  public async merge(targetSchema: Schema, sourceSchema: Schema): Promise<Schema> {
    const schemaChanges = await this.getSchemaChanges(targetSchema, sourceSchema);
    const mergeContext: SchemaMergeContext = {
      targetSchema,
      sourceSchema,
      editor: new SchemaContextEditor(targetSchema.context),
    };

    await mergeSchemaItems(mergeContext, schemaChanges.enumerationChanges.values(), mergeEnumeration);
    await mergeSchemaItems(mergeContext, filterChangesByItemType(schemaChanges, SchemaItemType.PropertyCategory));

    // TODO: For now we just do simple copy and merging of properties and classes. For more complex types
    //       with bases classes or relationships, this might need to get extended.
    await mergeSchemaItems(mergeContext, schemaChanges.classChanges.values(), mergeClasses);

    // TODO: For now we directly manipulate the target schema. For error handing purposes, we should first
    //       merge into a temporary schema and eventually swap that with the given instance.
    return targetSchema;
  }

}

function filterChangesByItemType(changes: SchemaChanges, type: SchemaItemType): Iterable<SchemaItemChanges> {
  const result: SchemaItemChanges[] = [];
  for(const change of changes.schemaItemChanges.values()) {
    if(change.schemaItemType === type) {
      result.push(change);
    }
  }
  return result;
}
