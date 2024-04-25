/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import { Schema, type SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editing/Editor";
import { MutableSchema } from "../Editing/Mutable/MutableSchema";
import { SchemaDifference, SchemaDifferences } from "../Differencing/SchemaDifference";
import { mergeCustomAttribute } from "./CustomAttributeMerger";
import { mergeSchemaItems } from "./SchemaItemMerger";
import { mergeSchemaReferences } from "./SchemaReferenceMerger";
import { SchemaConflictsError } from "../Differencing/SchemaConflicts";

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
  public merge(targetSchema: Schema, sourceSchema: Schema): Promise<Schema>;

  /**
   * Merges the schema differences into the target schema context.
   * @param differences   The changes that shall be applied to the target schema.
   * @alpha
   */
  public merge(differences: SchemaDifferences): Promise<Schema>;

  /**
   * Merges the source and the target. If the target is a SchemaDifference, the
   * source parameter must not be set. If it's a schema, it'll internally call
   * the Differencing api and recall itself with the difference argument overload.
   * @param input   The methods input either a schema or a SchemaDifferences
   * @param source  A source schema.
   * @returns       The merged schema.
   * @alpha
   */
  public async merge(input: SchemaDifferences | Schema, source?: Schema): Promise<Schema> {
    if(Schema.isSchema(input)) {
      if(source === undefined) {
        throw new Error("When merging two schemas, source must not be undefined.");
      }
      return this.merge(await SchemaDifference.fromSchemas(input, source));
    }

    return this.mergeSchemas(input);
  }

  /**
   * Merges the schema differences in the target schema. The target schema is defined
   * in the given differences object.
   * @param differences   The differences between a source schema and the target schema.
   * @returns             The modified Schema.
   */
  private async mergeSchemas(differences: SchemaDifferences): Promise<Schema> {
    const targetSchemaKey = SchemaKey.parseString(differences.targetSchemaName);
    const sourceSchemaKey = SchemaKey.parseString(differences.sourceSchemaName);

    if(differences.conflicts && differences.conflicts.length > 0) {
      throw new SchemaConflictsError(
        "Schema's can't be merged if there are unresolved conflicts.",
        differences.conflicts,
        sourceSchemaKey,
        targetSchemaKey,
      );
    }

    const schema = await this._editor.getSchema(targetSchemaKey);
    if (schema === undefined) {
      throw new Error(`The target schema '${targetSchemaKey.name}' could not be found in the editing context.`);
    }

    if(differences.changes === undefined || differences.changes.length === 0) {
      return schema;
    }

    const context: SchemaMergeContext = {
      editor: this._editor,
      targetSchema: schema,
      targetSchemaKey,
      sourceSchemaKey,
    };

    for (const referenceChange of differences.changes.filter(SchemaDifference.isSchemaReferenceDifference)) {
      await mergeSchemaReferences(context, referenceChange);
    }

    const schemaDifference = differences.changes.find(SchemaDifference.isSchemaDifference);
    if(schemaDifference !== undefined) {
      await mergeSchemaProperties(schema, schemaDifference);
    }

    // Filter a list of possible schema item changes. This list gets filtered and order in the
    // mergeSchemaItems method.
    for await (const mergeResult of mergeSchemaItems(context, differences.changes)) {
      if(mergeResult.errorMessage) {
        throw new Error(mergeResult.errorMessage);
      }
    }

    // At last the custom attributes gets merged because it could be that the CustomAttributes
    // depend on classes that has to get merged in as items before.
    for (const customAttributeChange of differences.changes.filter(SchemaDifference.isCustomAttributeDifference)) {
      const mergeResult = await mergeCustomAttribute(context, customAttributeChange);
      if(mergeResult.errorMessage) {
        throw new Error(mergeResult.errorMessage);
      }
    }

    return schema;
  }
}

/**
 * Sets the editable properties of a Schema.
 * @internal
 */
async function mergeSchemaProperties(schema: MutableSchema, changes: SchemaDifference) {
  if(changes.difference.label !== undefined) {
    schema.setDisplayLabel(changes.difference.label);
  }
  if(changes.difference.description !== undefined) {
    schema.setDescription(changes.difference.description);
  }
}
