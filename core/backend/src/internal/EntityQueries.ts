/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Id64String, IModelStatus } from "@itwin/core-bentley";
import { EntityQueryParams, IModelError, QueryBinder, QueryRowFormat } from "@itwin/core-common";
import type { IModelDb } from "../IModelDb";

/** Build the ECSQL used by [[IModelDb.queryEntityIds]].
 * @internal
 */
export function buildEntityIdsQuery(params: EntityQueryParams): string {
  let sql = "SELECT ECInstanceId FROM ";
  if (params.only)
    sql += "ONLY ";
  sql += params.from;
  if (params.where)
    sql += ` WHERE ${params.where}`;

  if (params.orderBy)
    sql += ` ORDER BY ${params.orderBy}`;

  if (typeof params.limit === "number" && params.limit > 0)
    sql += ` LIMIT ${params.limit}`;

  if (typeof params.offset === "number" && params.offset > 0)
    sql += ` OFFSET ${params.offset}`;

  return sql;
}

/** Add an id to the result set of an entity id query, enforcing [[IModelDb.maxLimit]].
 * @internal
 */
export function addEntityId(ids: Set<Id64String>, id: Id64String | undefined, maxLimit: number): void {
  if (id === undefined)
    return;

  ids.add(id);
  if (ids.size > maxLimit)
    throw new IModelError(IModelStatus.BadRequest, "Max LIMIT exceeded in SELECT statement");
}

/** Same result as [[IModelDb.queryEntityIds]], but executed on the concurrent query worker threads so the
 * JavaScript thread is not blocked while SQLite reads (possibly cold, cloud-backed) pages.
 * Only use this for read-only iModels: concurrent query uses separate connections that cannot see uncommitted changes.
 * @internal
 */
export async function queryEntityIdsAsync(iModel: IModelDb, params: EntityQueryParams, maxLimit: number): Promise<Set<Id64String>> {
  const ids = new Set<Id64String>();
  const reader = iModel.createQueryReader(buildEntityIdsQuery(params), QueryBinder.fromSkippingNullish(params.bindings), { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
  for await (const row of reader)
    addEntityId(ids, row[0], maxLimit);

  return ids;
}

/** Read the rows of the specified entities on the concurrent query worker threads and discard the results.
 * For an iModel backed by a cloud container this downloads the blocks that a subsequent synchronous read of the same
 * entities (e.g. `IModelDb.Elements.getElementProps`) needs, so that the synchronous read does not block the JavaScript
 * thread on block downloads. Failures are ignored - the subsequent synchronous read reports any real error.
 * @internal
 */
export async function preloadEntities(iModel: IModelDb, ids: Id64String[], classFullName: string): Promise<void> {
  if (ids.length === 0)
    return;

  try {
    const reader = iModel.createQueryReader(`SELECT $ FROM ${classFullName} WHERE InVirtualSet(?, ECInstanceId)`, new QueryBinder().bindIdSet(1, ids), { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
    for await (const _row of reader) {
      // only reading the rows matters
    }
  } catch {
    // Ignored: this is only an optimization.
  }
}
