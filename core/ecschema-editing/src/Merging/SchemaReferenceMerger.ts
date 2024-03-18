/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECVersion, Schema, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { type SchemaMergeContext } from "./SchemaMerger";
import { type SchemaReferenceDifference } from "../Differencing/SchemaDifference";
import { type SchemaContextEditor } from "../Editing/Editor";

/**
 * Merges the schema references of two schemas.
 * @param context  current merge context
 * @param change       schema changes.
 * @internal
 */
export default async function mergeSchemaReferences(context: SchemaMergeContext, change: SchemaReferenceDifference) {
  // If the target schema does not have a reference to a schema yet, it can be added
  // but should be checked if it's schema references have collisions with existing references.
  if(change.changeType === "add") {
    const referencedSchema = await locateSchema(context.editor, change.difference.name, change.difference.version);
    await context.editor.addSchemaReference(context.targetSchemaKey, referencedSchema);
  }

  // If the source schema referenced a schema that is also referenced by the target
  // schema but in a different version, it is marked as delta. Here we need to check if
  // the source schema is compatible to the existing one. This is not be checked by the
  // schema instance when added.
  if(change.changeType === "modify") {
    const referencedSchema = await locateSchema(context.editor, change.difference.name, change.difference.version);
    const existingSchema  = (await context.targetSchema.getReference(referencedSchema.name))!;

    const [older, latest] = compareSchemas(existingSchema, referencedSchema);
    if(!latest.schemaKey.matches(older.schemaKey, SchemaMatchType.LatestWriteCompatible)) {
      throw new Error(`Schemas references of ${referencedSchema.name} have incompatible versions: ${older.schemaKey.version} and ${latest.schemaKey.version}`);
    }

    if(latest === existingSchema) {
      return;
    }

    const index = context.targetSchema.references.findIndex((reference) => reference === existingSchema);
    context.targetSchema.references.splice(index, 1);

    await context.editor.addSchemaReference(context.targetSchema.schemaKey, referencedSchema);
  }
}

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
 * Compares the schemas and return them in order of their versions [older, latest].
 * @param left    The first schema to be added.
 * @param right   The second schema to be added.
 * @returns       The schemas in order.
 */
function compareSchemas(left: Schema, right: Schema): [Schema, Schema] {
  return left.schemaKey.compareByVersion(right.schemaKey) < 0
    ? [left, right]
    : [right, left];
}
