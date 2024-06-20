/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import { Schema, type SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editing/Editor";
import { SchemaEditingError } from "../Editing/Exception";
import { SchemaConflictsError } from "../Differencing/Errors";
import { getSchemaDifferences, type SchemaDifference, type SchemaDifferenceResult } from "../Differencing/SchemaDifference";
import { mergeCustomAttribute } from "./CustomAttributeMerger";
import { filterSchemaItems } from "./SchemaItemMerger";
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

interface EditingErrorReporter {
  report(error: SchemaEditingError): void;
}

/**
 * @internal
 */
export type MergeFn = (context: SchemaMergeContext) => Promise<void>;

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
   * @alpha
   */
  public async mergeSchemas(targetSchema: Schema, sourceSchema: Schema): Promise<Schema> {
    return this.merge(await getSchemaDifferences(targetSchema, sourceSchema));
  }

  /**
   * Merges the schema differences into the target schema context.
   * @param differenceResult The differences that shall be applied to the target schema.
   * @alpha
   */
  public async merge(differenceResult: SchemaDifferenceResult): Promise<Schema> {
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

    const errors: SchemaEditingError[] = [];
    await this.mergeSchema(context, differenceResult, {
      report: (error) => errors.push(error),
    });

    if (errors.length > 0) {
      throw new SchemaMergeError("Schemas couldn't be merged successfully.", errors);
    }

    return schema;
  }

  /**
   * Merges the differences into the target schema.
   */
  private async mergeSchema(context: SchemaMergeContext, { differences }: SchemaDifferenceResult, errorReporter: EditingErrorReporter) {
    const errorHandler = (error: unknown) => {
      if (error instanceof SchemaEditingError) {
        return errorReporter.report(error);
      }
      throw error;
    };

    for (const referenceChange of differences.filter(Utils.isSchemaReferenceDifference)) {
      await mergeSchemaReferences(context, referenceChange).catch(errorHandler);
    }

    for (const schemaDifference of differences.filter(Utils.isSchemaDifference)) {
      await mergeSchemaProperties(context, schemaDifference).catch(errorHandler);
    }

    // Filter a list of possible schema item changes. This list gets filtered and ordered in dependency
    // order to avoid conflicts when merging items that refer to others.
    for await (const itemMerger of filterSchemaItems(differences)) {
      await itemMerger(context).catch(errorHandler);
    }

    // At last the custom attributes gets merged because it could be that the CustomAttributes
    // depend on classes that has to get merged in as items before.
    for (const customAttributeChange of differences.filter(Utils.isCustomAttributeDifference)) {
      await mergeCustomAttribute(context, customAttributeChange).catch(errorHandler);
    }
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

/**
 *
 */
export class SchemaMergeError extends Error {
  public readonly errors: ReadonlyArray<SchemaEditingError>;
  /**
   *
   */
  constructor(message: string, errors: ReadonlyArray<SchemaEditingError>) {
    super(message);
    this.errors = errors;
  }
}