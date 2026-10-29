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
/** Number of distinct row-flag combinations; metadata keys pack the statement id and the row flags into one number. */
const rowFlagCombinations = 16;
const metadataCache = new WeakMap<IModelDb | ECDb, Map<number, PropertyMetaDataMap>>();
/** Receives the first batch and statement id from `prepareECSqlBatchReader`. Read immediately after each call. */
const prepareOut: any[] = [];

/** Row rendering flags passed to `prepareECSqlBatchReader`.
 * @internal
 */
export enum SyncReaderRowFlags {
  None = 0,
  AbbreviateBlobs = 1,
  ClassIdsToClassNames = 2,
  UseJsName = 4,
  DoNotConvertClassIdsToClassNamesWhenAliased = 8,
}

function getCachedMetadata(db: IModelDb | ECDb, key: number, fetch: () => PropertyMetaDataMap): PropertyMetaDataMap {
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
      entries.delete(entries.keys().next().value as number);
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
  private _reader?: IModelJsNative.ECSqlBatchReader;
  /** Key of this statement's metadata in `metadataCache`, or undefined when its metadata must not be cached. */
  private _metadataKey: number | undefined;
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

  /** Prepare the statement and bind parameters in one step. On a read-only db the first batch of rows is read by the
   * same native call.
   * @param query - The ECSql text to prepare.
   * @param args - Optional bind parameters as flat `[key, type, value, ...]` triples.
   * @param rowFlags - [[SyncReaderRowFlags]] used for every row and for metadata.
   * @throws IModelError on preparation or binding failure.
   * @internal
   */
  public prepareAndBind(query: string, args: any[] | undefined, rowFlags: SyncReaderRowFlags): void {
    this.releaseReader();
    try {
      this._reader = this._db[_nativeDb].prepareECSqlBatchReader(query, args, rowFlags, this._batchSize, prepareOut);
    } catch (error) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, BentleyError.getErrorMessage(error));
    }
    const firstBatch = prepareOut[0];
    // Metadata of a dynamic column (e.g. $->prop) changes as the statement is stepped, so it is never cached.
    this._metadataKey = prepareOut[2] ? undefined : prepareOut[1] * rowFlagCombinations + rowFlags;
    prepareOut.length = 0;
    if (firstBatch !== undefined)
      this.acceptBatch(firstBatch);
  }

  /** Store a batch returned by native code: a JSON array string, an array of rows, or the final DbResult. */
  private acceptBatch(batch: string | any[] | DbResult): void {
    this._batchSize = Math.min(this._batchSize * batchGrowthFactor, maxBatchSize);
    this._rowIndex = 0;
    if (typeof batch === "number") {
      this._rows = [];
      this._batchStatus = batch;
    } else {
      this._rows = typeof batch === "string" ? JSON.parse(batch) : batch;
    }
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
      this.acceptBatch(reader.stepBatch(this._batchSize));
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
    const fetch = () => new PropertyMetaDataMap(reader.getMetadata());
    return this._metadataKey === undefined ? fetch() : getCachedMetadata(this._db, this._metadataKey, fetch);
  }
}
