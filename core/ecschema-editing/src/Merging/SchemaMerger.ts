/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editing/Editor";
import { SchemaChanges } from "../Validation/SchemaChanges";
import { SchemaComparer } from "../Validation/SchemaComparer";
import { ClassMerger } from "./ClassMerger";
import { EnumerationMerger } from "./EnumerationMerger";

/**
 * Defines the context of a SchemaChange.
 * @alpha
 */
export interface SchemaChangeContext {
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
    const changeContext: SchemaChangeContext = {
      targetSchema,
      sourceSchema,
      editor: new SchemaContextEditor(targetSchema.context),
    };

    for(const changes of schemaChanges.enumerationChanges.values()) {
      await EnumerationMerger.merge(changeContext, changes);
    }

    for(const changes of schemaChanges.classChanges.values()) {
      await ClassMerger.merge(changeContext, changes);
    }

    return targetSchema;
  }
}
