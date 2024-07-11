/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import { Schema, type SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editing/Editor";
import { SchemaConflictsError } from "../Differencing/Errors";
import { type AnySchemaDifference, getSchemaDifferences, type SchemaDifference, type SchemaDifferenceResult } from "../Differencing/SchemaDifference";
import { type SchemaChangeSet } from "./Changes/SchemaChanges";
import { mergeCustomAttribute } from "./CustomAttributeMerger";
import { mergeSchemaItems } from "./SchemaItemMerger";
import { mergeSchemaReferences } from "./SchemaReferenceMerger";
import * as Utils from "../Differencing/Utils";

/**
 * Defines the context of a Schema merging run.
 * @internal
 */
export interface SchemaMergeContext {
  readonly targetSchema: Schema;
  readonly targetSchemaKey: SchemaKey;
  readonly sourceSchemaKey: SchemaKey;
  readonly editor: SchemaContextEditor;
}

/**
 * Class to merge two schemas together.
 * @see [[merge]] or [[mergeSchemas]] to merge two schemas together.
 * @beta
 */
export class SchemaMerger {

  private readonly _editor: SchemaContextEditor;

  /**
   * Constructs a new instance of the SchemaMerger object.
   * @param editingContext  The schema contexts that holds the schema to be edited.
   */
  constructor(editingContext: SchemaContext) {
    this._editor = new SchemaContextEditor(editingContext);
  }

  /**
   * Copy the SchemaItems of the source schemas to the target schema.
   * @param targetSchema  The schema the SchemaItems gets merged to.
   * @param sourceSchema  The schema the SchemaItems gets copied from.
   * @param changes       An optional instance of schema changes that shall be applied before the schemas get merged.
   * @returns             The merged target schema.
   * @alpha
   */
  public async mergeSchemas(targetSchema: Schema, sourceSchema: Schema, changes?: SchemaChangeSet): Promise<Schema> {
    return this.merge(await getSchemaDifferences(targetSchema, sourceSchema), changes);
  }

  /**
   * Merges the schema differences into the target schema context.
   * @param differenceResult  The differences that shall be applied to the target schema.
   * @param changes           An optional instance of schema changes that shall be applied before the schemas get merged.
   * @alpha
   */
  public async merge(differenceResult: SchemaDifferenceResult, changes?: SchemaChangeSet): Promise<Schema> {
    const targetSchemaKey = SchemaKey.parseString(differenceResult.targetSchemaName);
    const sourceSchemaKey = SchemaKey.parseString(differenceResult.sourceSchemaName);

    // If schema changes were provided, they'll get applied and a new SchemaDifferenceResult is returned
    // to prevent altering the differenceResult the caller passed in.
    if (changes) {
      await changes.applyTo(differenceResult = { ...differenceResult });
    }

    if (differenceResult.conflicts && differenceResult.conflicts.length > 0) {
      throw new SchemaConflictsError(
        "Schema's can't be merged if there are unresolved conflicts.",
        differenceResult.conflicts,
        sourceSchemaKey,
        targetSchemaKey,
      );
    }

    const schema = await this._editor.getSchema(targetSchemaKey);
    if (schema === undefined) {
      throw new Error(`The target schema '${targetSchemaKey.name}' could not be found in the editing context.`);
    }

    const context: SchemaMergeContext = {
      editor: this._editor,
      targetSchema: schema,
      targetSchemaKey,
      sourceSchemaKey,
    };

    await mergeSchemaDifferences(context, differenceResult.differences);

    return schema;
  }
}

/**
 * Merges the schema differences in the target schema.
 * @param context       The current merging context.
 * @param differences   The differences between a source schema and the target schema.
 * @internal
 */
async function mergeSchemaDifferences(context: SchemaMergeContext, differences: AnySchemaDifference[]): Promise<void> {
  for (const referenceDifference of differences.filter(Utils.isSchemaReferenceDifference)) {
    await mergeSchemaReferences(context, referenceDifference);
  }

  for (const schemaDifference of differences.filter(Utils.isSchemaDifference)) {
    await mergeSchemaProperties(context, schemaDifference);
  }

  // Filter a list of possible schema item changes. This list gets filtered and order in the
  // mergeSchemaItems method.
  for await (const _mergeResult of mergeSchemaItems(context, differences)) {
  }

  // At last the custom attributes gets merged because it could be that the CustomAttributes
  // depend on classes that has to get merged in as items before.
  for (const customAttributeDifference of differences.filter(Utils.isCustomAttributeDifference)) {
    await mergeCustomAttribute(context, customAttributeDifference);
  }
}

/**
 * Sets the editable properties of a Schema.
 * @internal
 */
async function mergeSchemaProperties(context: SchemaMergeContext, { difference }: SchemaDifference) {
  if (difference.label !== undefined) {
    context.editor.setDisplayLabel(context.targetSchemaKey, difference.label);
  }
  if (difference.description !== undefined) {
    context.editor.setDescription(context.targetSchemaKey, difference.description);
  }
}
