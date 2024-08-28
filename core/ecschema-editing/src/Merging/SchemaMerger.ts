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
import { type SchemaEdits } from "./Edits/SchemaEdits";
import { mergeCustomAttribute } from "./CustomAttributeMerger";
import { mergeSchemaItems } from "./SchemaItemMerger";
import { mergeSchemaReferences } from "./SchemaReferenceMerger";
import * as Utils from "../Differencing/Utils";
import { ECEditingStatus, SchemaEditingError } from "../ecschema-editing";

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
   * @param edits         An optional instance of schema edits that shall be applied before the schemas get merged.
   * @returns             The merged target schema.
   * @alpha
   */
  public async mergeSchemas(targetSchema: Schema, sourceSchema: Schema, edits?: SchemaEdits): Promise<Schema> {
    return this.merge(await getSchemaDifferences(targetSchema, sourceSchema), edits);
  }

  /**
   * Merges the schema differences into the target schema context.
   * @param differenceResult  The differences that shall be applied to the target schema.
   * @param edits             An optional instance of schema edits that shall be applied before the schemas get merged.
   * @alpha
   */
  public async merge(differenceResult: SchemaDifferenceResult, edits?: SchemaEdits): Promise<Schema> {
    const targetSchemaKey = SchemaKey.parseString(differenceResult.targetSchemaName);
    const sourceSchemaKey = SchemaKey.parseString(differenceResult.sourceSchemaName);

    // If schema changes were provided, they'll get applied and a new SchemaDifferenceResult is returned
    // to prevent altering the differenceResult the caller passed in.
    if (edits) {
      await edits.applyTo(differenceResult = { ...differenceResult });
    }

    if (differenceResult.conflicts && differenceResult.conflicts.length > 0) {
      throw new SchemaConflictsError(
        "Schema's can't be merged if there are unresolved conflicts.",
        differenceResult.conflicts,
        sourceSchemaKey,
        targetSchemaKey,
      );
    }

    const schema = await this._editor.getSchema(targetSchemaKey).catch((error: Error) => {
      if (error instanceof SchemaEditingError && error.errorNumber === ECEditingStatus.SchemaNotFound) {
        throw new Error(`The target schema '${targetSchemaKey.name}' could not be found in the editing context.`);
      }
      throw error;
    });

    if (!schema.customAttributes || !schema.customAttributes.has("CoreCustomAttributes.DynamicSchema")) {
      throw new Error(`The target schema '${targetSchemaKey.name}' is not dynamic. Only dynamic schemas are supported for merging.`);
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
    await context.editor.setDisplayLabel(context.targetSchemaKey, difference.label);
  }
  if (difference.description !== undefined) {
    await context.editor.setDescription(context.targetSchemaKey, difference.description);
  }
}
