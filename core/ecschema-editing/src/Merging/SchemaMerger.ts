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
import { AnySchemaDifference, getSchemaDifferences, type SchemaDifferenceResult } from "../Differencing/SchemaDifference";
import { SchemaMergingVisitor } from "./SchemaMergingVisitor";
import { SchemaMergingWalker } from "./SchemaMergingWalker";
import type { SchemaEdits } from "./Edits/SchemaEdits";
import { ECEditingStatus, SchemaEditingError } from "../Editing/Exception";

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

    const mergedDifferences: AnySchemaDifference[] = [];

    try {
      const schema = await this._editor.getSchema(targetSchemaKey).catch((error: Error) => {
        if (error instanceof SchemaEditingError && error.errorNumber === ECEditingStatus.SchemaNotFound) {
          throw new Error(`The target schema '${targetSchemaKey.name}' could not be found in the editing context.`);
        }
        throw error;
      });

      if (!schema.customAttributes || !schema.customAttributes.has("CoreCustomAttributes.DynamicSchema")) {
        throw new Error(`The target schema '${targetSchemaKey.name}' is not dynamic. Only dynamic schemas are supported for merging.`);
      }

      const visitor = new SchemaMergingVisitor({
        editor: this._editor,
        targetSchema: schema,
        targetSchemaKey,
        sourceSchemaKey,
      });

      const walker = new SchemaMergingWalker(visitor);
      walker.on("mergedDifference", (difference) => mergedDifferences.push(difference));

      await walker.traverse(differenceResult.differences, "add");
      await walker.traverse(differenceResult.differences, "modify");

      return schema;
    } catch(error: any) {
      throw new SchemaMergingError("An error occurred while merging the schemas.", error, mergedDifferences);
    }
  }
}

/**
 * Error class that provides additional information why a schema merge failed.
 * @beta
 */
export class SchemaMergingError extends Error {

  /** The differences that have been already merged into the target schema. */
  public readonly mergedDifferences: ReadonlyArray<AnySchemaDifference>;

  /** The error that occurred while merging the schemas. */
  public readonly mergeError: Error;

  /**
   * Initializes a new instance of the SchemaMergingError class.
   * @param message           The error message.
   * @param mergeError        The error that occurred while merging the schemas.
   * @param mergedDifferences The differences that have been already merged into the target schema.
   */
  constructor(message: string, mergeError: Error, mergedDifferences: ReadonlyArray<AnySchemaDifference>) {
    super(message);
    this.mergedDifferences = mergedDifferences;
    this.mergeError = mergeError;
  }
}
