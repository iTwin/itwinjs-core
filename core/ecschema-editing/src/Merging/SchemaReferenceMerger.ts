/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaMatchType } from "@itwin/ecschema-metadata";
import { SchemaChanges } from "../Validation/SchemaChanges";
import { SchemaMergeContext } from "./SchemaMerger";

/**
 * Merges the schema references of two schemas.
 * @param mergeContext  current merge context
 * @param changes       schema changes.
 * @internal
 */
export default async function mergeSchemaReferences(mergeContext: SchemaMergeContext, changes: SchemaChanges) {
  const targetSchema = mergeContext.targetSchema;

  // If the target schema does not have a reference to a schema yet, it can be added
  // but should be checked if it's schema references have collisions with existing references.
  for(const missingSchemaReference of changes.missingSchemaReferences) {
    const [referencedSchema] = missingSchemaReference.diagnostic.messageArgs! as [Schema];
    await mergeContext.editor.addSchemaReference(targetSchema.schemaKey, referencedSchema);
  }

  // If the source schema referenced a schema that is also referenced by the target
  // schema but in a different version, it is marked as delta. Here we need to check if
  // the source schema is compatible to the existing one. This is not be checked by the
  // schema instance when added.
  for(const differentSchemaReference of changes.schemaReferenceDeltas) {
    const [referencedSchema] = differentSchemaReference.diagnostic.messageArgs! as [Schema];
    const existingSchema = (await targetSchema.getReference(referencedSchema.name))!;

    const [older, latest] = compareSchemas(existingSchema, referencedSchema);
    if(!latest.schemaKey.matches(older.schemaKey, SchemaMatchType.LatestWriteCompatible)) {
      throw new Error(`Schemas references of ${referencedSchema.name} have incompatible versions: ${older.schemaKey.version} and ${latest.schemaKey.version}`);
    }
    if(latest === existingSchema) {
      continue;
    }

    const index = targetSchema.references.findIndex((reference) => reference === existingSchema);
    targetSchema.references.splice(index, 1);

    await mergeContext.editor.addSchemaReference(targetSchema.schemaKey, referencedSchema);
  }
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
