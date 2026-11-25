/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, BeEvent, CompressedId64Set, Id64, Id64Arg, Id64Set, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { SubCategoryAppearance, SubCategoryResultRow } from "@itwin/core-common";
import type { IModelConnection } from "./IModelConnection";

/** A cancelable paginated request for subcategory information.
 * @see SubCategoriesCache
 * @internal
 */
export interface SubCategoriesRequest {
  /** The Ids of any categories which were requested but were not yet loaded. */
  readonly missingCategoryIds: Id64Set;
  /** A promise which resolves to true when all of the requested categories have been loaded, or to false if not all categories were loaded.
   * Categories may fail to load if the request is explicitly canceled, if the IModelConnection is closed before all categories are loaded, or if the query fails.
   */
  readonly promise: Promise<boolean>;
  /** Cancels the request. */
  cancel(): void;
}

class LoadedSubCategories extends Set<Id64String> {
  public version = 0;
}

/** A cache of information about the subcategories contained within an [[IModelConnection]]. It is populated on demand.
 * @internal
 */
export class SubCategoriesCache {
  private readonly _byCategoryId = new Map<string, LoadedSubCategories>();
  private readonly _appearances = new Map<string, SubCategoryAppearance>();
  private readonly _staleCategoryIds = new Set<string>();
  private readonly _imodel: IModelConnection;
  private _invalidationGeneration = 0;
  private _loadVersion = 0;
  /** Changes when a load publishes new category data. @internal */
  public get loadVersion(): number { return this._loadVersion; }

  /** Whether any of these categories were actually published after the caller began waiting. @internal */
  public loadedSince(ids: Iterable<Id64String>, version: number): boolean {
    if (version !== this._loadVersion)
      for (const id of ids)
        if ((this._byCategoryId.get(id)?.version ?? 0) > version)
          return true;
    return false;
  }

  private readonly _onChanged = new BeEvent<() => void>();

  public constructor(imodel: IModelConnection) {
    this._imodel = imodel;
  }

  public attachToBriefcase(imodel: IModelConnection): void {
    // We want to do this in the constructor but can't, because IModelConnection.subcategories is initialized before
    // BriefcaseConnection.txns.
    assert(imodel === this._imodel);
    assert(imodel.isBriefcaseConnection());
    imodel.txns.onElementsChanged.addListener((changes) => {
      const affectedSubCategories = new Set<string>();
      const affectedCategories = new Set<string>();
      let invalidateAllCategories = false;
      let changed = false;
      for (const change of changes) {
        if (change.metadata.is("BisCore:Category")) {
          if (change.type === "deleted") {
            this.deleteCategory(change.id);
            changed = true;
          }
        } else if (change.metadata.is("BisCore:SubCategory")) {
          if (change.type === "inserted") {
            // We don't know to which category the subcategory belongs, so every cached category may be stale.
            invalidateAllCategories = true;
            changed = true;
            continue;
          }

          affectedSubCategories.add(change.id);
        }
      }

      if (invalidateAllCategories) {
        this.markAllCategoriesStale();
      } else if (affectedSubCategories.size > 0) {
        for (const [catId, subCatIds] of this._byCategoryId) {
          for (const subCatId of affectedSubCategories) {
            if (subCatIds.has(subCatId)) {
              affectedCategories.add(catId);
              changed = true;
              affectedSubCategories.delete(subCatId);
              break;
            }
          }
        }

        if (affectedCategories.size > 0)
          this.markCategoriesStale(affectedCategories);

        // If any affected subcategories were NOT found in cache and categories are currently stale,
        // bump generation to invalidate in-flight reload queries that may return stale data.
        if (affectedSubCategories.size > 0 && this.hasStaleCategories()) {
          changed = true;
        }
      }

      if (changed) {
        this._invalidationGeneration++;
        this._onChanged.raiseEvent();
      }
    });
  }
  /** Register a listener to be notified when transaction changes invalidate cached subcategory information.
   * @internal
   */
  public addChangedListener(listener: () => void): () => void { return this._onChanged.addListener(listener); }

  /** Get the Ids of all subcategories belonging to the category with the specified Id, or undefined if no such information is present. */
  public getSubCategories(categoryId: string): Id64Set | undefined { return this._byCategoryId.get(categoryId); }

  /** Get the base appearance of the subcategory with the specified Id, or undefined if no such information is present. */
  public getSubCategoryAppearance(subCategoryId: Id64String): SubCategoryAppearance | undefined { return this._appearances.get(subCategoryId.toString()); }

  /** Request that the subcategory information for all of the specified categories is loaded.
   * If all such information has already been loaded, returns undefined.
   * Otherwise, dispatches an asynchronous request to load those categories which are not already loaded and returns a cancellable request object
   * containing the corresponding promise and the set of categories still to be loaded.
   */
  public load(categoryIds: Id64Arg): SubCategoriesRequest | undefined {
    const missing = this.getMissing(categoryIds);
    if (undefined === missing)
      return undefined;

    const request = new SubCategoriesCache.Request(missing, this._imodel);
    const generation = this._invalidationGeneration;
    const promise = request.dispatch().then((result?: SubCategoriesCache.Result) => {
      const completed = undefined !== result && !request.wasCanceled && generation === this._invalidationGeneration;
      return completed && this.processResults(result, missing); // Never mark failed or malformed categories fresh.
    });
    return {
      missingCategoryIds: missing,
      promise,
      cancel: () => request.cancel(),
    };
  }

  /** Load all subcategories that come from used spatial categories of the iModel into the cache. */
  public async loadAllUsedSpatialSubCategories(): Promise<void> {
    try {
      const generation = this._invalidationGeneration;
      const results = await this._imodel.queryAllUsedSpatialSubCategories();
      if (generation === this._invalidationGeneration && undefined !== results) {
        const staleCategories = new Set(this._staleCategoryIds);
        // This preload can return partial results on very large iModels, so keep stale categories additive and
        // preserve their stale state until a targeted reload can fully reconcile them.
        const { appearances, invalid } = SubCategoriesCache.decode(results);
        ++this._loadVersion;
        for (const [i, row] of results.entries())
          if (!invalid?.has(row.parentId))
            this.add(row.parentId, row.id, appearances[i], staleCategories.has(row.parentId));

        if (staleCategories.size > 0)
          this.markCategoriesStale(staleCategories);
      }
    } catch {
      // In case of a truncated response, gracefully handle the error and exit.
    }

  }
  /** IDs requiring a load, including stale categories. @internal */
  public getMissing(categoryIds: Id64Arg): Id64Set | undefined {
    let missing: Id64Set | undefined;
    for (const catId of Id64.iterable(categoryIds)) {
      if (undefined === this._byCategoryId.get(catId) || this.isCategoryStale(catId)) {
        if (undefined === missing)
          missing = new Set<string>();

        missing.add(catId);
      }
    }

    return missing;
  }

  public clear(): void {
    this._byCategoryId.clear();
    this._appearances.clear();
    this._staleCategoryIds.clear();
    this._invalidationGeneration++;
  }

  public onIModelConnectionClose(): void {
    this.clear();
  }

  private static decode(rows: SubCategoriesCache.Result) {
    const appearances: SubCategoryAppearance[] = [];
    let invalid: Set<Id64String> | undefined;
    for (const [i, row] of rows.entries()) {
      try {
        const value = row.appearance; // ECSQL returns JSON text; other connections can return decoded properties.
        appearances[i] = new SubCategoryAppearance(typeof value === "string" ? (value ? JSON.parse(value) : undefined) : value);
      } catch {
        (invalid ??= new Set()).add(row.parentId);
      }
    }
    return { appearances, invalid };
  }

  private processResults(result: SubCategoriesCache.Result, refreshedCategoryIds: Id64Set, override: boolean = true): boolean {
    const { appearances, invalid } = SubCategoriesCache.decode(result);
    ++this._loadVersion;
    const previousSubCategoryIds = new Map<Id64String, Id64Set>();
    for (const id of refreshedCategoryIds) {
      if (invalid?.has(id))
        continue;
      const previous = this._byCategoryId.get(id);
      if (undefined !== previous)
        previousSubCategoryIds.set(id, previous);

      const fresh = new LoadedSubCategories();
      fresh.version = this._loadVersion;
      this._byCategoryId.set(id, fresh);
      this.markCategoryFresh(id);
    }

    for (const [i, row] of result.entries())
      if (!invalid?.has(row.parentId))
        this.add(row.parentId, row.id, appearances[i], override);

    for (const [categoryId, previous] of previousSubCategoryIds) {
      const current = this._byCategoryId.get(categoryId);
      for (const subCategoryId of previous) {
        if (!current?.has(subCategoryId))
          this._appearances.delete(subCategoryId);
      }
    }
    return !invalid;
  }

  /** Exposed strictly for tests.
   * @internal
   */
  public add(categoryId: string, subCategoryId: string, appearance: SubCategoryAppearance, override: boolean) {
    let set = this._byCategoryId.get(categoryId);
    if (undefined === set)
      this._byCategoryId.set(categoryId, set = new LoadedSubCategories());

    set.version = this._loadVersion;
    set.add(subCategoryId);
    this.markCategoryFresh(categoryId);
    if (override || !this._appearances.has(subCategoryId))
      this._appearances.set(subCategoryId, appearance);
  }

  private isCategoryStale(categoryId: Id64String): boolean {
    return this._staleCategoryIds.has(categoryId);
  }

  private markCategoryFresh(categoryId: Id64String): void {
    this._staleCategoryIds.delete(categoryId);
  }

  private markAllCategoriesStale(): void {
    // We don't know which cached category the inserted subcategory belongs to, so every currently-cached
    // category may now be missing a subcategory. Mark them all stale so they are re-requested on next load.
    // Categories cached after this point are loaded fresh and are intentionally left out.
    for (const categoryId of this._byCategoryId.keys())
      this._staleCategoryIds.add(categoryId);
  }

  private markCategoriesStale(categoryIds: Iterable<Id64String>): void {
    for (const categoryId of categoryIds)
      this._staleCategoryIds.add(categoryId);
  }

  private hasStaleCategories(): boolean {
    return this._staleCategoryIds.size > 0;
  }

  private deleteCategory(categoryId: Id64String): void {
    const subCategoryIds = this._byCategoryId.get(categoryId);
    if (undefined !== subCategoryIds)
      for (const subCategoryId of subCategoryIds)
        this._appearances.delete(subCategoryId);

    this._byCategoryId.delete(categoryId);
    this._staleCategoryIds.delete(categoryId);
  }

  public async getCategoryInfo(inputCategoryIds: Id64String | Iterable<Id64String>): Promise<Map<Id64String, IModelConnection.Categories.CategoryInfo>> {
    // Eliminate duplicates...
    const categoryIds = new Set<string>(typeof inputCategoryIds === "string" ? [inputCategoryIds] : inputCategoryIds);
    const req = this.load(categoryIds);
    if (req)
      await req.promise;

    const map = new Map<Id64String, IModelConnection.Categories.CategoryInfo>();
    for (const categoryId of categoryIds) {
      const subCategoryIds = this._byCategoryId.get(categoryId);
      const subCategories = undefined !== subCategoryIds ? this.mapSubCategoryInfos(categoryId, subCategoryIds) : new Map<Id64String, IModelConnection.Categories.SubCategoryInfo>();
      map.set(categoryId, { id: categoryId, subCategories });
    }

    return map;
  }

  public async getSubCategoryInfo(categoryId: Id64String, inputSubCategoryIds: Id64String | Iterable<Id64String>): Promise<Map<Id64String, IModelConnection.Categories.SubCategoryInfo>> {
    // Eliminate duplicates...
    const subCategoryIds = new Set<string>(typeof inputSubCategoryIds === "string" ? [inputSubCategoryIds] : inputSubCategoryIds);
    const req = this.load(categoryId);
    if (req)
      await req.promise;

    return this.mapSubCategoryInfos(categoryId, subCategoryIds);
  }

  private mapSubCategoryInfos(categoryId: Id64String, subCategoryIds: Set<Id64String>): Map<Id64String, IModelConnection.Categories.SubCategoryInfo> {
    const map = new Map<Id64String, IModelConnection.Categories.SubCategoryInfo>();
    for (const id of subCategoryIds) {
      const appearance = this._appearances.get(id);
      if (appearance)
        map.set(id, { id, categoryId, appearance });
    }

    return map;
  }
}

/** This namespace and the types within it are exported strictly for use in tests.
 * @internal
 */
export namespace SubCategoriesCache {
  export type Result = SubCategoryResultRow[];

  export class Request {
    private readonly _imodel: IModelConnection;
    private readonly _categoryIds: CompressedId64Set[] = [];
    private readonly _result: Result = [];
    private _canceled = false;
    private _curCategoryIdsIndex = 0;

    public get wasCanceled() { return this._canceled || this._imodel.isClosed; }

    public constructor(categoryIds: Set<string>, imodel: IModelConnection, maxCategoriesPerQuery = 2500) {
      this._imodel = imodel;

      const catIds = [...categoryIds];
      OrderedId64Iterable.sortArray(catIds); // sort categories, so that given the same set of categoryIds we will always create the same batches.
      while (catIds.length !== 0) {
        const end = (catIds.length > maxCategoriesPerQuery) ? maxCategoriesPerQuery : catIds.length;
        const compressedIds = CompressedId64Set.compressArray(catIds.splice(0, end));
        this._categoryIds.push(compressedIds);
      }
    }

    public cancel() { this._canceled = true; }

    public async dispatch(): Promise<Result | undefined> {
      if (this.wasCanceled || this._curCategoryIdsIndex >= this._categoryIds.length) // handle case of empty category Id set...
        return undefined;

      try {
        const catIds = this._categoryIds[this._curCategoryIdsIndex];
        const result = await this._imodel.querySubCategories(catIds);
        this._result.push(...result);
        if (this.wasCanceled)
          return undefined;
      } catch {
        return undefined;
      }

      // Finished with current batch of categoryIds. Dispatch the next batch if one exists.
      if (++this._curCategoryIdsIndex < this._categoryIds.length) {
        if (this.wasCanceled)
          return undefined;
        else
          return this.dispatch();
      }

      // Even if we were canceled, we've retrieved all the rows. Might as well process them to prevent another request for some of the same rows from being enqueued.
      return this._result;
    }
  }

  export type QueueFunc = (anySubCategoriesLoaded: boolean) => void;
  /** Identity used to cancel related loads independently of the cache used for fetching. @internal */
  export type Owner = SubCategoriesCache | string;

  export class QueueEntry {
    public readonly cache: SubCategoriesCache;
    public readonly categoryIds: Id64Set;
    public funcs: Array<{ notify: QueueFunc, ids: Id64Set, version: number, retry?: "once" | "queued" }> = [];

    public constructor(cache: SubCategoriesCache, categoryIds: Iterable<Id64String>, public readonly owner: Owner = cache) {
      this.cache = cache;
      this.categoryIds = new Set(categoryIds);
    }
  }

  /** A "queue" of SubCategoriesRequests. Each entry specifies the cache through which to load a set of category IDs and a list of functions to be executed
   * when loading is completed. This is used to enforce ordering of operations upon subcategories despite the need to asynchronously load them. It incidentally also provides an
   * opportunity to reduce the number of backend requests by batching consecutive requests on the same cache.
   * Chiefly used by [[Viewport]], whose display references may load subcategories from more than one [[IModelConnection]]'s cache.
   * @internal
   */
  export class Queue {
    /* NB: Members marked protected for use in tests only. */
    protected _current?: QueueEntry;
    protected _next: QueueEntry[] = [];
    protected _request?: SubCategoriesRequest;
    protected _disposed = false;
    private readonly _selectors = new Map<SubCategoriesCache, Queue>();
    /** All previously pending category requests have settled, including failed requests. @internal */
    public readonly onDrained = new BeEvent<() => void>();

    /** Whether work for this connection is queued or in flight. @internal */
    public hasPending(owner: Owner): boolean {
      return this._current?.owner === owner || this._next.some((entry) => entry.owner === owner) || undefined !== this.selectorForOwner(owner);
    }

    private selectorForOwner(owner: Owner): Queue | undefined {
      for (const queue of this._selectors.values())
        if (queue.hasPending(owner))
          return queue;
      return undefined;
    }

    /** Load a selector's metadata independently unless an earlier ordered operation uses its cache or owner. @internal */
    public pushSelector(cache: SubCategoriesCache, categoryIds: Id64Arg, func: QueueFunc, owner: Owner): void {
      if (this._disposed)
        return;
      const conflicts = (entry: QueueEntry) => entry.cache === cache || entry.owner === owner;
      const existing = this._selectors.get(cache);
      const ownerQueue = this.selectorForOwner(owner);
      if ((ownerQueue && ownerQueue !== existing) || (this._current && conflicts(this._current)) || this._next.some(conflicts)) {
        this.push(cache, categoryIds, func, { owner });
        return;
      }

      if (existing) {
        existing.push(cache, categoryIds, func, { owner });
        return;
      }

      const queue = new Queue();
      const release = (notifyDrained: boolean) => {
        if (this._selectors.get(cache) !== queue)
          return;
        this._selectors.delete(cache);
        if (!this._current && (notifyDrained || this._next.length))
          this.processNext();
      };
      this._selectors.set(cache, queue);
      queue.onDrained.addOnce(() => release(true));
      try {
        queue.push(cache, categoryIds, func, { owner });
      } finally {
        if (queue.isEmpty)
          release(false); // A synchronous hit raises no drain event, but its callback can queue ordered work.
      }
    }

    /** Push a request onto the queue. The requested categories will be loaded through the supplied cache if necessary, and then
     * the supplied function will be invoked. `owner` defaults to the destination cache. An operation marked `retainOnRetry`
     * runs on a covering retry, scheduling one retry if necessary. Ordinary load notifications are not replayed.
     */
    public push(cache: SubCategoriesCache, categoryIds: Id64Arg, func: QueueFunc, options?: { owner?: Owner, retainOnRetry?: boolean }): void {
      if (this._disposed)
        return;
      const owner = options?.owner ?? cache;
      const version = cache.loadVersion;
      const start = !this._current && !this._next.length && !this._selectors.has(cache) && !this.selectorForOwner(owner);
      if (start) {
        this._request = cache.load(categoryIds);
        if (!this._request) {
          func(false);
          return;
        }
      }
      const ids = Id64.toIdSet(categoryIds, true);
      let entry = this._next.at(-1);
      if (start || !entry || entry.owner !== owner || entry.cache !== cache) {
        entry = new QueueEntry(cache, ids, owner);
        if (!start)
          this._next.push(entry);
      } else {
        for (const id of ids)
          entry.categoryIds.add(id);
      }
      entry.funcs.push({ notify: func, ids, version, retry: options?.retainOnRetry ? "once" : undefined });
      if (start)
        this.processCurrent(entry);
    }

    /** Cancel all queued and in-flight work of one owner, including requests through another connection's cache.
     * @internal
     */
    public cancel(owner: Owner): void {
      this._next = this._next.filter((entry) => entry.owner !== owner);
      this.selectorForOwner(owner)?.cancel(owner);
      if (this._current?.owner !== owner) {
        if (!this._current && this._next.length)
          this.processNext();
        return;
      }

      this._current.funcs.length = 0;
      if (!this._request)
        return; // The synchronous drain loop advances after the current callback returns.

      this._request.cancel();
      this._request = undefined;
      this._current = undefined;
      this.processNext();
    }

    /** Cancel all requests and empty the queue. */
    public [Symbol.dispose](): void {
      for (const queue of this._selectors.values()) {
        queue.onDrained.clear();
        queue[Symbol.dispose]();
      }
      this._selectors.clear();
      if (this._current)
        this._current.funcs.length = 0;
      if (undefined !== this._request) {
        this._request.cancel();
        this._request = undefined;
      }

      this._current = undefined;
      this._next.length = 0;
      this._disposed = true;
    }

    public get isEmpty(): boolean {
      return !this._current && !this._next.length && !this._selectors.size;
    }

    private processCurrent(entry: QueueEntry): void {
      assert(undefined !== this._request);
      assert(undefined === this._current);

      this._current = entry;
      const finish = (completed: boolean) => {
        if (this._disposed || this._current !== entry)
          return;

        try {
          const replays = new Map<QueueEntry, typeof entry.funcs>();
          let fallback: QueueEntry | undefined;
          for (const operation of entry.funcs) {
            const loaded = entry.cache.loadedSince(operation.ids, operation.version);
            const missing = !completed && operation.retry ? entry.cache.getMissing(operation.ids) : undefined;
            if (completed || loaded || (operation.retry && !missing)) {
              operation.notify(loaded);
              if (this._current !== entry)
                return; // A callback canceled this entry and may have started another request.
            }
            if (!missing)
              continue;
            const ids = [...missing];
            let retry = this._next.find((next) => next.owner === entry.owner && next.cache === entry.cache && ids.every((id) => next.categoryIds.has(id)));
            if (!retry) {
              if (operation.retry !== "once")
                continue;
              // Coalesced operations share one replacement request, even if the backend remains unavailable.
              if (!fallback)
                this._next.push(fallback = new QueueEntry(entry.cache, [], entry.owner));
              for (const id of ids)
                fallback.categoryIds.add(id);
              retry = fallback;
            }
            operation.retry = "queued"; // May follow existing work, but cannot generate another retry.
            operation.version = entry.cache.loadVersion;
            const earlier = replays.get(retry);
            if (earlier)
              earlier.push(operation);
            else
              replays.set(retry, [operation]);
          }
          for (const [retry, operations] of replays)
            retry.funcs = operations.concat(retry.funcs);
        } finally {
          if (this._current === entry) {
            this._request = undefined;
            this._current = undefined;
            this.processNext();
          }
        }
      };
      void this._request.promise.then(finish, () => finish(false));
    }

    private processNext(): void {
      let next;
      while (undefined !== (next = this._next[0])) {
        if (this._selectors.has(next.cache) || this.selectorForOwner(next.owner))
          return;
        this._next.shift();
        this._request = next.cache.load(next.categoryIds);
        if (undefined === this._request) {
          // Keep the entry visible to nested pushes and cancellation until its callbacks finish.
          this._current = next;
          try {
            for (const { notify, ids, version } of next.funcs)
              notify(next.cache.loadedSince(ids, version));
          } finally {
            this._current = undefined;
          }
        } else {
          // We need to load the requested categories before invoking the pending functions.
          this.processCurrent(next);
          return;
        }
      }
      if (!this._disposed && this.isEmpty)
        this.onDrained.raiseEvent();
    }
  }
}
