/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import { Schema, type SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editing/Editor";
import { AnySchemaItemDifference, SchemaCustomAttributeDifference, SchemaDifference, SchemaDifferences, SchemaReferenceDifference } from "../Differencing/SchemaDifference";
import mergeSchemaReferences from "./SchemaReferenceMerger";
import { mergeCustomAttribute } from "./CustomAttributeMerger";
import { mergeSchemaItems } from "./SchemaItemMerger";
import { MutableSchema } from "../Editing/Mutable/MutableSchema";

/**
 * Defines the context of a Schema merging run.
 * @beta
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
   */
  public merge(differences: SchemaDifferences): Promise<Schema>;

  /**
   * Merges the source and the target. If the target is a SchemaDifference, the
   * source parameter must not be set. If it's a schema, it'll internally call
   * the Differencing api and recall itself with the difference argument overload.
   * @param input   The methods input either a schema or a SchemaDifferences
   * @param source  A source schema.
   * @returns       The merged schema.
   */
  public async merge(input: SchemaDifferences | Schema, source?: Schema): Promise<Schema> {
    if(Schema.isSchema(input)) {
      if(source === undefined) {
        throw new Error("When merging two schemas, source must not be undefined.");
      }
      return this.merge(await SchemaDifference.fromSchemas(input, source));
    }

    if(input.conflicts && input.conflicts.length > 0) {
      throw new Error("Schema's can't be merged if there are unresolved conflicts.");
    }

    return this.mergeSchemas(input);
  }

  private async mergeSchemas(differences: SchemaDifferences): Promise<Schema> {
    const targetSchemaKey = SchemaKey.parseString(differences.targetSchemaName);
    const sourceSchemaKey = SchemaKey.parseString(differences.sourceSchemaName);

    const schema = await this._editor.getSchema(targetSchemaKey);
    if (schema === undefined) {
      throw new Error();
    }

    const context: SchemaMergeContext = {
      editor: this._editor,
      targetSchema: schema,
      targetSchemaKey,
      sourceSchemaKey,
    };

    if(differences.changes === undefined) {
      return schema;
    }

    const schemaChanges = differences.changes.filter((entry) => entry.schemaType === "Schema");
    for (const referenceChange of schemaChanges.filter((entry) => entry.path === "$references")) {
      await mergeSchemaReferences(context, referenceChange as SchemaReferenceDifference);
    }

    for (const changes of schemaChanges.filter((entry) => entry.path === undefined)) {
      await mergeSchemaProperties(schema, changes as SchemaDifference);
    }

    // Filter a list of possible schema item changes. This list gets filtered and order in the
    // mergeSchemaItems method.
    for await (const _result of mergeSchemaItems(context, differences.changes as AnySchemaItemDifference[])) {
      // TODO: Evaluate editing result
    }

    // At last the custom attributes gets merged because it could be that the CustomAttributes
    // depend on classes that has to get merged in as items before.
    for (const customAttributeChange of differences.changes.filter((entry) => entry.path?.endsWith("$customAttributes"))) {
      await mergeCustomAttribute(context, customAttributeChange as SchemaCustomAttributeDifference);
    }

    return schema;
  }
}

async function mergeSchemaProperties(schema: MutableSchema, changes: SchemaDifference) {
  for (const [name, value] of Object.entries(changes.json)) {
    switch(name) {
      case "label":
        schema.setDisplayLabel(value);
        break;
      case "description":
        schema.setDescription(value);
        break;
    }
  }
}
