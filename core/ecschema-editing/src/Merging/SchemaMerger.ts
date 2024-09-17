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
import { getSchemaDifferences, type SchemaDifferenceResult } from "../Differencing/SchemaDifference";
import { SchemaMergingVisitor } from "./SchemaMergingVisitor";
import { SchemaMergingWalker } from "./SchemaMergingWalker";
import type { SchemaEdits } from "./Edits/SchemaEdits";

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

    const schema = await this._editor.getSchema(targetSchemaKey);
    if (schema === undefined) {
      throw new Error(`The target schema '${targetSchemaKey.name}' could not be found in the editing context.`);
    }

    const visitor = new SchemaMergingVisitor({
      editor: this._editor,
      targetSchema: schema,
      targetSchemaKey,
      sourceSchemaKey,
    });

    const walker = new SchemaMergingWalker(visitor);
    await walker.traverse(differenceResult.differences, "add");
    await walker.traverse(differenceResult.differences, "modify");

    return schema;
  }
}
