/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */

import { DbQueryRequest, DbQueryResponse, DbResponseStatus, QueryPropertyMetaData } from "@itwin/core-common";

/**
 * Caches the column metadata returned by concurrent query requests so that new [ECSqlReader]($common) instances for an
 * already-seen ECSQL can skip asking native to build and marshal it again.
 *
 * Column metadata only depends on the prepared statement (i.e. the schema) and the options that influence property naming.
 * The owning database clears the cache on every event that can change the schema seen by the primary or worker connections
 * (commit, abandon, undo/redo, changeset application, external txn replay, clearCaches, attach/detach, close).
 * A schema change made by another process to a file opened without change watching is not detected; the primary
 * connection's own schema cache has the same limitation.
 * @internal
 */
export class QueryMetadataCache {
  public static readonly defaultCapacity = 200;
  private readonly _entries = new Map<string, QueryPropertyMetaData[]>();
  private _generation = 0;

  public constructor(private readonly _capacity = QueryMetadataCache.defaultCapacity) { }

  /** Number of cached entries. */
  public get size(): number { return this._entries.size; }

  /** Drop all cached metadata. Requests already in flight will not populate the cache. */
  public clear(): void {
    this._entries.clear();
    ++this._generation;
  }

  private static makeKey(request: DbQueryRequest): string {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return `${request.usePrimaryConn ? 1 : 0}|${request.valueFormat ?? 0}|${request.abbreviateBlobs ? 1 : 0}|${request.convertClassIdsToClassNames ? 1 : 0}|${request.query}`;
  }

  private static copy(properties: QueryPropertyMetaData[]): QueryPropertyMetaData[] {
    return properties.map((property) => ({ ...property }));
  }

  private get(key: string): QueryPropertyMetaData[] | undefined {
    const properties = this._entries.get(key);
    if (properties && this._entries.size > 1) {
      // Move to the most-recently-used position.
      this._entries.delete(key);
      this._entries.set(key, properties);
    }
    return properties;
  }

  private set(key: string, properties: QueryPropertyMetaData[]): void {
    this._entries.delete(key);
    this._entries.set(key, properties);
    while (this._entries.size > this._capacity) {
      const oldest = this._entries.keys().next().value as string;
      this._entries.delete(oldest);
    }
  }

  /**
   * Execute a query request, serving column metadata from the cache when possible.
   * @param request The request to execute. It is not modified.
   * @param execute Sends a request to native.
   */
  public async execute(request: DbQueryRequest, execute: (request: DbQueryRequest) => Promise<DbQueryResponse>): Promise<DbQueryResponse> {
    if (!request.includeMetaData)
      return execute(request);

    const key = QueryMetadataCache.makeKey(request);
    const cached = this.get(key);
    if (cached) {
      const hitGeneration = this._generation;
      const hitResponse = await execute({ ...request, includeMetaData: false });
      if (hitGeneration !== this._generation) {
        // Invalidated while in flight: the cached metadata may not match the statement that produced the rows.
        return execute(request);
      }
      if (QueryMetadataCache.hasResult(hitResponse) && (hitResponse.meta === undefined || hitResponse.meta.length === 0))
        hitResponse.meta = QueryMetadataCache.copy(cached);
      return hitResponse;
    }

    const generation = this._generation;
    const response = await execute(request);
    if (generation === this._generation && QueryMetadataCache.hasResult(response) && response.meta !== undefined && response.meta.length > 0)
      this.set(key, QueryMetadataCache.copy(response.meta));
    return response;
  }

  private static hasResult(response: DbQueryResponse): boolean {
    return response.status === DbResponseStatus.Done || response.status === DbResponseStatus.Partial;
  }
}
