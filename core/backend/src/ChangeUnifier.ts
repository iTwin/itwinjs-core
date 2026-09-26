/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { ChangesetReader } from "./ChangesetReader";
import { ChangeInstance, ChangeMeta, PropertyFilter, RowFormatOptions } from "./ChangesetReaderTypes";
import { IModelNative } from "./internal/NativePlatform";
import { _appendToNativeUnifier, _readerOptions } from "./internal/Symbols";

/**
 * Arguments for [[ChangeUnifier.fromReader]] and [[ChangeUnifier.fromReaders]].
 * @beta
 */
export interface ChangeUnifierArgs {
  /** Names of the properties to keep, e.g. `["FederationGuid", "Model", "Source", "Target"]`. `ECInstanceId` and `ECClassId` are always kept.
   * All other properties are dropped before the merged instances are stored, which reduces memory use.
   * `undefined` or empty keeps all properties returned by the readers.
   */
  propNames?: string[];
  /** Number of bytes of merged instance data held in memory before sorted runs are spilled to temporary files.
   * Must be a non-negative integer. `0` means never spill. Defaults to 64 MiB.
   */
  memoryBudgetBytes?: number;
  /** Number of instances fetched from the native layer at a time while iterating [[ChangeUnifier.instances]].
   * Must be a positive integer. Defaults to 1000.
   */
  batchSize?: number;
}

/**
 * Merges the partial (per-table) change rows of one or more [ChangesetReader]($backend)s into complete EC instances, natively.
 *
 * Rows from every table an EC instance maps to (the main table of its class family, joined tables and overflow tables) are
 * merged by ECInstanceId, root ECClassId of the class family and stage. An insert produces a `"New"` instance, a delete an
 * `"Old"` instance and an update one of each. Rows of non-EC tables are skipped. The filters and strict mode configured on a
 * reader are honored.
 *
 * All rows are read and merged when the unifier is created. Merged data is held in memory up to [[ChangeUnifierArgs.memoryBudgetBytes]]
 * and spilled to temporary files beyond that, so peak memory stays bounded for large changesets. Use [[ChangeUnifierArgs.propNames]]
 * to keep only the properties you need.
 *
 * Differences from [PartialChangeUnifier]($backend):
 * - [[instances]] are sorted numerically by (root ECClassId, ECInstanceId, stage), with `"Old"` before `"New"`.
 * - `$meta.op` and `$meta.isIndirectChange` come from the row of the class family's main (non-overflow) table. If only overflow
 *   tables contributed, `$meta.op` is `"Updated"` and `$meta.isIndirectChange` comes from the first row.
 *   [PartialChangeUnifier]($backend) takes both from the first row appended.
 * - Rows of one instance are merged even if they report different ECClassIds within the class family; the most-derived
 *   ECClassId is kept.
 * - Readers are consumed: each reader is drained completely when the unifier is created. It must not have been stepped before,
 *   and [ChangesetReader.step]($backend) returns `false` afterward. The reader can be disposed as soon as the unifier is created.
 *
 * **Usage:**
 * ```ts
 * using reader = ChangesetReader.openFile({ db, fileName, propFilter: PropertyFilter.BisCoreElement });
 * using unifier = ChangeUnifier.fromReader(reader, { propNames: ["FederationGuid", "Model", "Source", "Target"] });
 * for (const instance of unifier.instances()) { ... }
 * ```
 * @beta
 */
export class ChangeUnifier implements Disposable {
  private static readonly defaultBatchSize = 1000;
  private readonly _nativeUnifier: IModelJsNative.ChangeUnifier;
  private readonly _batchSize: number;
  private _hasReader = false;
  private _propFilter = PropertyFilter.All;
  private _rowOptions?: RowFormatOptions;
  /** Instances fetched by the most recent native `step()` call. */
  private _batch: IModelJsNative.UnifiedChangeInstance[] = [];
  /** Index of the next instance to return from `_batch`. */
  private _batchIndex = 0;
  private _exhausted = false;
  private _disposed = false;

  // Private — callers use static factory methods.
  private constructor(args: ChangeUnifierArgs) {
    const batchSize = args.batchSize ?? ChangeUnifier.defaultBatchSize;
    if (!Number.isInteger(batchSize) || batchSize <= 0)
      throw new IModelError(IModelStatus.BadArg, "ChangeUnifier: batchSize must be a positive integer.");
    if (args.memoryBudgetBytes !== undefined && (!Number.isSafeInteger(args.memoryBudgetBytes) || args.memoryBudgetBytes < 0))
      throw new IModelError(IModelStatus.BadArg, "ChangeUnifier: memoryBudgetBytes must be a non-negative integer.");

    this._batchSize = batchSize;
    const options: IModelJsNative.ChangeUnifierOptions = {};
    if (args.propNames !== undefined)
      options.propNames = [...args.propNames];
    if (args.memoryBudgetBytes !== undefined)
      options.memoryBudgetBytes = args.memoryBudgetBytes;
    this._nativeUnifier = new IModelNative.platform.ChangeUnifier(options);
  }

  /**
   * Create a unifier that merges all rows of `reader`.
   * The reader is drained completely by this call: it must not have been stepped before, and [ChangesetReader.step]($backend)
   * returns `false` afterward. The reader remains owned by the caller and can be disposed as soon as this returns.
   * @param reader A reader that has not been stepped yet.
   * @param args Options controlling projection, memory use and batching.
   * @throws [[IModelError]] if `args` are invalid, if `reader` has already been stepped or consumed, or if the native layer fails.
   * @beta
   */
  public static fromReader(reader: ChangesetReader, args?: ChangeUnifierArgs): ChangeUnifier {
    return ChangeUnifier.fromReaders([reader], args);
  }

  /**
   * Create a unifier that merges all rows of several readers - e.g. one per changeset - into one set of instances.
   * Where property values conflict, rows of later readers win.
   *
   * Readers are requested from `readers` one at a time and each is drained completely before the next one is requested,
   * so `readers` can be a generator that opens each reader when requested and disposes it afterward.
   * All readers must be opened with the same `propFilter` and equivalent `rowOptions`.
   * @param readers Readers that have not been stepped yet. Each is consumed as described for [[fromReader]].
   * @param args Options controlling projection, memory use and batching.
   * @throws [[IModelError]] if `args` are invalid, if a reader has already been stepped or consumed, if the readers' `propFilter`
   * or `rowOptions` differ, or if the native layer fails. Readers drained before the error remain consumed.
   * @beta
   */
  public static fromReaders(readers: Iterable<ChangesetReader>, args?: ChangeUnifierArgs): ChangeUnifier {
    const unifier = new ChangeUnifier(args ?? {});
    try {
      for (const reader of readers)
        unifier.appendReader(reader);
    } catch (e) {
      unifier.closeAfterError();
      throw e;
    }
    return unifier;
  }

  /**
   * Iterate over the merged EC change instances, sorted by (root ECClassId, ECInstanceId, stage).
   * Instances are fetched from the native layer lazily, [[ChangeUnifierArgs.batchSize]] at a time.
   * Each instance is returned only once: iterating again, or calling `instances()` again, continues after the last instance returned.
   * @throws [[IModelError]] if the unifier has been disposed, or if the native layer fails.
   * @beta
   */
  public *instances(): IterableIterator<ChangeInstance> {
    for (let instance = this.nextInstance(); instance !== undefined; instance = this.nextInstance())
      yield instance;
  }

  /**
   * Release native resources, including any temporary spill files.
   * @beta
   */
  public [Symbol.dispose](): void {
    if (this._disposed)
      return;
    this._disposed = true;
    this._batch = [];
    this._batchIndex = 0;
    this._nativeUnifier.close();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private appendReader(reader: ChangesetReader): void {
    const { propFilter, rowOptions } = reader[_readerOptions];
    if (!this._hasReader) {
      this._propFilter = propFilter;
      this._rowOptions = rowOptions;
      this._hasReader = true;
    } else if (propFilter !== this._propFilter || !areEquivalentRowOptions(rowOptions, this._rowOptions)) {
      throw new IModelError(IModelStatus.BadArg, "ChangeUnifier: all readers must be opened with the same propFilter and rowOptions.");
    }
    reader[_appendToNativeUnifier](this._nativeUnifier);
  }

  private closeAfterError(): void {
    this._disposed = true;
    try {
      this._nativeUnifier.close();
    } catch {
      // The error that caused the unifier to be closed is more relevant to the caller than a failure to close it.
    }
  }

  private nextInstance(): ChangeInstance | undefined {
    if (this._disposed)
      throw new IModelError(IModelStatus.BadRequest, "ChangeUnifier: cannot iterate instances after the unifier has been disposed.");
    if (this._batchIndex >= this._batch.length) {
      if (this._exhausted)
        return undefined;
      this._batch = this._nativeUnifier.step(this._batchSize);
      this._batchIndex = 0;
      if (this._batch.length === 0) {
        this._exhausted = true;
        return undefined;
      }
    }
    return this.toChangeInstance(this._batch[this._batchIndex++]);
  }

  /** Complete the native metadata with the options of the readers, in place, so the instance satisfies [[ChangeMeta]]. */
  private toChangeInstance(instance: IModelJsNative.UnifiedChangeInstance): ChangeInstance {
    const meta = instance.$meta as ChangeMeta;
    meta.propFilter = this._propFilter;
    if (this._rowOptions !== undefined)
      meta.rowOptions = this._rowOptions;
    return instance as ChangeInstance;
  }
}

/** `true` if both options format rows identically, taking the defaults of omitted options into account. */
function areEquivalentRowOptions(lhs: RowFormatOptions | undefined, rhs: RowFormatOptions | undefined): boolean {
  return (lhs?.abbreviateBlobs ?? true) === (rhs?.abbreviateBlobs ?? true)
    && (lhs?.classIdsToClassNames ?? false) === (rhs?.classIdsToClassNames ?? false)
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    && (lhs?.useJsName ?? false) === (rhs?.useJsName ?? false);
}
