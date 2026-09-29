/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64 } from "@itwin/core-bentley";
import { SchemaManifest, SchemaManifestReferenceRow, SchemaManifestSchemaRow } from "@itwin/ecschema-metadata";

/** Runs a query and yields its rows. `IModelDb.createQueryReader` satisfies this, and taking the
 * function rather than the iModel is what keeps this module free of an import cycle with `IModelDb`.
 * @internal
 */
export type SchemaMetaQuery = (ecsql: string) => AsyncIterableIterator<any>;

const schemaSql = "SELECT ECInstanceId, Name, VersionMajor, VersionWrite, VersionMinor, Alias FROM meta.ECSchemaDef";
const referenceSql = "SELECT SourceECInstanceId, TargetECInstanceId FROM meta.SchemaHasSchemaReferences";

/** Reads the schema reference graph of an iModel out of ECDbMeta: every schema's name, version and
 * alias, plus the edges between them, and no schema content.
 *
 * Two ECDbMeta queries, shared by everything that needs to know what schemas an iModel holds -
 * SchemaView's fragment loading and authoring schema discovery both build on this.
 * @internal
 */
export async function querySchemaManifest(query: SchemaMetaQuery): Promise<SchemaManifest> {
  const schemaRows: SchemaManifestSchemaRow[] = [];
  for await (const row of query(schemaSql)) {
    // ECInstanceId arrives as a hex Id64String. `ec_` metadata rowids carry no briefcase prefix,
    // so the local id is the full value.
    schemaRows.push({ ecInstanceId: Id64.getLocalId(row[0]), name: row[1], versionMajor: row[2], versionWrite: row[3], versionMinor: row[4], alias: row[5] });
  }

  const referenceRows: SchemaManifestReferenceRow[] = [];
  for await (const row of query(referenceSql))
    referenceRows.push({ sourceECInstanceId: Id64.getLocalId(row[0]), targetECInstanceId: Id64.getLocalId(row[1]) });

  return SchemaManifest.fromRows(schemaRows, referenceRows);
}
