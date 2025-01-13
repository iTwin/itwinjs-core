/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SchemaMergeContext } from "./SchemaMerger";
import type { SchemaReferenceDifference } from "../Differencing/SchemaDifference";
import type { SchemaContextEditor } from "../Editing/Editor";
import { ECVersion, Schema, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";

/**
 * Merges a new reference to an external schema into the target schema.
 * @internal
 */
export async function addSchemaReferences(context: SchemaMergeContext, change: SchemaReferenceDifference) {
  const referencedSchema = await locateSchema(context.editor, change.difference.name, change.difference.version);
  await context.editor.addSchemaReference(context.targetSchemaKey, referencedSchema);
}

/**
 * Merges differences to an existing schema references in the target schema.
 * @internal
 */
export async function modifySchemaReferences(context: SchemaMergeContext, change: SchemaReferenceDifference) {
  const existingSchema  = await context.targetSchema.getReference(change.difference.name) as Schema;
  const [older, latest] = sortSchemas(existingSchema.schemaKey, new SchemaKey(change.difference.name, ECVersion.fromString(change.difference.version)));
  if(latest === existingSchema.schemaKey) {
    return;
  }

  if(!latest.matches(older, SchemaMatchType.LatestWriteCompatible)) {
    throw new Error(`Schemas references of ${change.difference.name} have incompatible versions: ${older.version} and ${latest.version}`);
  }

  const index = context.targetSchema.references.findIndex((reference) => reference === existingSchema);
  context.targetSchema.references.splice(index, 1);

  const referencedSchema = await locateSchema(context.editor, change.difference.name, change.difference.version);
  await context.editor.addSchemaReference(context.targetSchema.schemaKey, referencedSchema);
}

/**
 * Tries to locate the Schema in the current Context
 * @param editor      Current editor context.
 * @param schemaName  The schema name to be looked up.
 * @param version     The schemas version to beo looked up.
 * @returns           The schema found in the context.
 */
async function locateSchema(editor: SchemaContextEditor, schemaName?: string, version?: string): Promise<Schema> {
  if(schemaName === undefined || version === undefined) {
    throw new Error("Schema name and version must not be undefined.");
  }

  const schemaKey = new SchemaKey(schemaName, ECVersion.fromString(version));
  const schema = await editor.schemaContext.getSchema(schemaKey, SchemaMatchType.LatestWriteCompatible);
  if(schema === undefined) {
    throw new Error(`Referenced schema ${schemaKey.toString()} could not be found in target context`);
  }
  return schema;
}

/**
 * Sorts the schemas and return them in order of their versions [older, latest].
 * @param left    The first schema key to be added.
 * @param right   The second schema key to be added.
 * @returns       The schemas in order.
 */
function sortSchemas(left: SchemaKey, right: SchemaKey): [SchemaKey, SchemaKey] {
  return left.compareByVersion(right) < 0
    ? [left, right]
    : [right, left];
}
