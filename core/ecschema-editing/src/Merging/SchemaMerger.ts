/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import { MutableSchema } from "../Editing/Mutable/MutableSchema";
import { Schema, type SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editing/Editor";
import { SchemaConflictsError } from "../Differencing/Errors";
import { SchemaDifference, SchemaDifferenceResult, SchemaDifferences } from "../Differencing/SchemaDifference";
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
 * @see [[merge]] to merge the schemas.
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
   * @returns             The merged target schema.
   */
  public async mergeSchemas(targetSchema: Schema, sourceSchema: Schema): Promise<Schema> {
    return this.merge(await SchemaDifferences.fromSchemas(targetSchema, sourceSchema));
  }

  /**
   * Merges the schema differences into the target schema context.
   * @param differenceResult The differences that shall be applied to the target schema.
   * @alpha
   */
  public async merge(differenceResult: SchemaDifferenceResult): Promise<Schema> {
    return this.mergeDifferences(differenceResult);
  }


  /**
   * Merges the schema differences in the target schema. The target schema is defined
   * in the given differences object.
   * @param differenceResult   The differences between a source schema and the target schema.
   * @returns                  The modified Schema.
   */
  private async mergeDifferences(differenceResult: SchemaDifferenceResult): Promise<Schema> {
    const targetSchemaKey = SchemaKey.parseString(differenceResult.targetSchemaName);
    const sourceSchemaKey = SchemaKey.parseString(differenceResult.sourceSchemaName);

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

    const { differences } = differenceResult;
    if (differences === undefined || differences.length === 0) {
      return schema;
    }

    const context: SchemaMergeContext = {
      editor: this._editor,
      targetSchema: schema,
      targetSchemaKey,
      sourceSchemaKey,
    };

    for (const referenceChange of differences.filter(Utils.isSchemaReferenceDifference)) {
      await mergeSchemaReferences(context, referenceChange);
    }

    const schemaDifference = differences.find(Utils.isSchemaDifference);
    if (schemaDifference !== undefined) {
      await mergeSchemaProperties(schema, schemaDifference);
    }

    // Filter a list of possible schema item changes. This list gets filtered and order in the
    // mergeSchemaItems method.
    for await (const _mergeResult of mergeSchemaItems(context, differences)) {
    }

    // At last the custom attributes gets merged because it could be that the CustomAttributes
    // depend on classes that has to get merged in as items before.
    for (const customAttributeChange of differences.filter(Utils.isCustomAttributeDifference)) {
      await mergeCustomAttribute(context, customAttributeChange);
    }

    return schema;
  }
}

/**
 * Sets the editable properties of a Schema.
 * @internal
 */
async function mergeSchemaProperties(schema: MutableSchema, { difference }: SchemaDifference) {
  if (difference.label !== undefined) {
    schema.setDisplayLabel(difference.label);
  }
  if (difference.description !== undefined) {
    schema.setDescription(difference.description);
  }
}
