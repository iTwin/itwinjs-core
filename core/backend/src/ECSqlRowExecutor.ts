/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelError, PropertyMetaDataMap } from "@itwin/core-common";
import type { IModelDb } from "./IModelDb";
import { BentleyError, DbResult } from "@itwin/core-bentley";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { _nativeDb } from "./internal/Symbols";
import type { ECDb } from "./ECDb";

const statementNotPreparedMessage = "Statement is not prepared. Likely cause: the db was closed before step is called or the ECSqlSyncReader is used outside the context of the callback passed to withQueryReader.";

/** Column metadata keyed by native statement id and row options. Statement ids change whenever the native cache
 * prepares the ECSql again, so entries never outlive the statement they describe.
 */
const maxCachedMetadataEntries = 100;

/** Rows fetched by the first native batch. Small so single-row and early-exit queries do little extra work. */
const initialBatchSize = 4;
/** Each subsequent batch grows by this factor up to [[maxBatchSize]]. */
const batchGrowthFactor = 4;
/** Upper bound on rows rendered per native call; bounds memory held by the read-ahead buffer. */
const maxBatchSize = 128;
const metadataCache = new WeakMap<IModelDb | ECDb, Map<string, PropertyMetaDataMap>>();

function getCachedMetadata(db: IModelDb | ECDb, key: string, fetch: () => PropertyMetaDataMap): PropertyMetaDataMap {
  let entries = metadataCache.get(db);
  if (!entries) {
    entries = new Map();
    metadataCache.set(db, entries);
  }

  let properties = entries.get(key);
  if (properties) {
    entries.delete(key);
  } else {
    properties = fetch();
    if (entries.size >= maxCachedMetadataEntries)
      entries.delete(entries.keys().next().value as string);
  }
  entries.set(key, properties);
  return properties;
}

// --------------------------------------------------------------------------------------------
// ECSqlRowExecutor
// --------------------------------------------------------------------------------------------

/**
 * Executes an ECSql query on the db's primary connection and hands out rows one at a time. On a read-only db, rows are
 * read from native code in growing batches to reduce JS/native transitions; on a writable db native code returns one row
 * per call so rows are never read ahead of writes made while iterating. The prepared statement is leased from the native
 * concurrent query statement cache and returned to it when the executor is disposed.
 * @internal
 */
export class ECSqlRowExecutor implements Disposable {
  private _removeListener: () => void;
  private _reader?: IModelJsNative.ConcurrentQuerySyncReader;
  private _metadataKey = "";
  private _rows: any[] = [];
  private _rowIndex = 0;
  private _batchSize = initialBatchSize;
  /** Status of the last native batch. Anything other than BE_SQLITE_ROW means no further batch is fetched. */
  private _batchStatus = DbResult.BE_SQLITE_ROW;

  public constructor(private readonly _db: IModelDb | ECDb) {
    this._removeListener = this._db.onBeforeClose.addListener(() => this.releaseReader());
  }

  // --------------------------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------------------------

  /** Returns the leased statement to the native cache. Safe to call more than once. */
  private releaseReader(): void {
    const reader = this._reader;
    this._reader = undefined;
    this.resetBatch();
    reader?.dispose();
  }

  private resetBatch(): void {
    this._rows = [];
    this._rowIndex = 0;
    this._batchSize = initialBatchSize;
    this._batchStatus = DbResult.BE_SQLITE_ROW;
  }

  /** Returns the leased statement and removes the database-close listener owned by this row executor.
   * @internal
   */
  public [Symbol.dispose](): void {
    this._removeListener();
    this.releaseReader();
  }

  // --------------------------------------------------------------------------------------------
  // Core execution
  // --------------------------------------------------------------------------------------------

  /** Prepare the statement and bind parameters in one step.
   * @param query - The ECSql text to prepare.
   * @param args - Optional serialized bind parameters.
   * @param rowOptions - Native row-adaptor options used for every row and for metadata.
   * @throws IModelError on preparation or binding failure.
   * @internal
   */
  public prepareAndBind(query: string, args: object | undefined, rowOptions: IModelJsNative.ECSqlRowAdaptorOptions): void {
    this.releaseReader();
    try {
      this._reader = this._db[_nativeDb].concurrentQuerySyncPrepare(query, args, rowOptions);
    } catch (error) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, BentleyError.getErrorMessage(error));
    }
    this._metadataKey = `${this._reader.getStatementId()}|${rowOptions.abbreviateBlobs}|${rowOptions.classIdsToClassNames}|${rowOptions.useJsName}|${rowOptions.doNotConvertClassIdsToClassNamesWhenAliased}`;
  }

  /** Return the next row data array, or `undefined` when the result set is exhausted. Rows are served from the
   * read-ahead buffer; a new native batch is fetched only when the buffer is empty.
   * @throws IModelError on step failure or when the statement is no longer available. A failure reported by a batch is
   * thrown after the rows stepped before it have been returned.
   * @internal
   */
  public stepNextRow(): any {
    if (this._rowIndex < this._rows.length)
      return this._rows[this._rowIndex++];

    const reader = this._reader;
    if (!reader)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, statementNotPreparedMessage);

    if (this._batchStatus === DbResult.BE_SQLITE_ROW) {
      this._rows.length = 0;
      this._rowIndex = 0;
      this._batchStatus = reader.stepBatch(this._batchSize, this._rows);
      this._batchSize = Math.min(this._batchSize * batchGrowthFactor, maxBatchSize);
      if (this._rows.length > 0)
        return this._rows[this._rowIndex++];
    }

    if (this._batchStatus === DbResult.BE_SQLITE_DONE)
      return undefined;
    throw new IModelError(this._batchStatus, `Step failed with code ${this._batchStatus}`);
  }

  /** Get shared internal column metadata. Readers must copy it before exposing mutable metadata to callers.
   * @internal
   */
  public fetchMetadata(): PropertyMetaDataMap {
    const reader = this._reader;
    if (!reader)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, statementNotPreparedMessage);
    return getCachedMetadata(this._db, this._metadataKey, () => new PropertyMetaDataMap(reader.getMetadata()));
  }
}
