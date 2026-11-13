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

/** A cache of information about the subcategories contained within an [[IModelConnection]]. It is populated on demand.
 * @internal
 */
export class SubCategoriesCache {
  private readonly _byCategoryId = new Map<string, Id64Set>();
  private readonly _appearances = new Map<string, SubCategoryAppearance>();
  private readonly _staleCategoryIds = new Set<string>();
  private readonly _imodel: IModelConnection;
  private _invalidationGeneration = 0;

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
      if (completed)
        this.processResults(result, missing);

      // On failure (result undefined due to query error), do NOT cache empty sets for uncached categories.
      // Leave them absent so getMissing() will include them in subsequent load() retries.
      return completed;
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
        for (const row of results)
          this.add(row.parentId, row.id, SubCategoriesCache.createSubCategoryAppearance(row.appearance), staleCategories.has(row.parentId));

        if (staleCategories.size > 0)
          this.markCategoriesStale(staleCategories);
      }
    } catch {
      // In case of a truncated response, gracefully handle the error and exit.
    }

  }
  /** Given categoryIds, return which of these are not cached. */
  private getMissing(categoryIds: Id64Arg): Id64Set | undefined {
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

  private static createSubCategoryAppearance(json?: any) {
    let props: SubCategoryAppearance.Props | undefined;
    if ("string" === typeof json && 0 < json.length)
      props = JSON.parse(json);

    return new SubCategoryAppearance(props);
  }

  private processResults(result: SubCategoriesCache.Result, refreshedCategoryIds: Id64Set, override: boolean = true): void {
    const previousSubCategoryIds = new Map<Id64String, Id64Set>();
    for (const id of refreshedCategoryIds) {
      const previous = this._byCategoryId.get(id);
      if (undefined !== previous)
        previousSubCategoryIds.set(id, previous);

      this._byCategoryId.set(id, new Set<string>());
      this.markCategoryFresh(id);
    }

    for (const row of result) {
      this.add(row.parentId, row.id, SubCategoriesCache.createSubCategoryAppearance(row.appearance), override);
    }

    for (const [categoryId, previous] of previousSubCategoryIds) {
      const current = this._byCategoryId.get(categoryId);
      for (const subCategoryId of previous) {
        if (!current?.has(subCategoryId))
          this._appearances.delete(subCategoryId);
      }
    }
  }

  /** Exposed strictly for tests.
   * @internal
   */
  public add(categoryId: string, subCategoryId: string, appearance: SubCategoryAppearance, override: boolean) {
    let set = this._byCategoryId.get(categoryId);
    if (undefined === set)
      this._byCategoryId.set(categoryId, set = new Set<string>());

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

  export class QueueEntry {
    public readonly cache: SubCategoriesCache;
    public readonly categoryIds: Id64Set;
    public readonly funcs: QueueFunc[];

    public constructor(cache: SubCategoriesCache, categoryIds: Id64Set, func: QueueFunc) {
      this.cache = cache;
      this.categoryIds = categoryIds;
      this.funcs = [func];
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
    /** True while processNext is invoking an already-satisfied entry's callbacks. A nested push must then always wait in
     * [[_next]] - even if the queue momentarily looks idle - because the drain loop owns [[_request]]/[[_current]] and
     * would clobber a request that became current mid-loop.
     */
    protected _draining = false;

    /** Push a request onto the queue. The requested categories will be loaded through the supplied cache if necessary, and then
     * the supplied function will be invoked. Any previously-pushed requests are guaranteed to be processed before this one.
     */
    public push(cache: SubCategoriesCache, categoryIds: Id64Arg, func: QueueFunc): void {
      if (this._disposed)
        return;
      else if (undefined === this._current && 0 === this._next.length && !this._draining)
        this.pushCurrent(cache, categoryIds, func);
      else
        this.pushNext(cache, categoryIds, func);
    }

    /** Cancel all queued and in-flight work for one cache, allowing other caches to proceed.
     * @internal
     */
    public cancel(cache: SubCategoriesCache): void {
      this._next = this._next.filter((entry) => entry.cache !== cache);
      if (this._current?.cache !== cache)
        return;

      this._request?.cancel();
      // A canceled RPC may never settle; its promise must not retain the discarded reference's callbacks.
      this._current.funcs.length = 0;
      this._request = undefined;
      this._current = undefined;
      this.processNext();
    }

    /** Cancel all requests and empty the queue. */
    public [Symbol.dispose](): void {
      if (undefined !== this._request) {
        assert(undefined !== this._current);
        this._request.cancel();
        this._request = undefined;
      }

      this._current = undefined;
      this._next.length = 0;
      this._disposed = true;
    }

    public get isEmpty(): boolean {
      return undefined === this._current && 0 === this._next.length;
    }

    private pushCurrent(cache: SubCategoriesCache, categoryIds: Id64Arg, func: QueueFunc): void {
      assert(0 === this._next.length);
      assert(undefined === this._current);
      assert(undefined === this._request);

      this._request = cache.load(categoryIds);
      if (undefined === this._request) {
        // All requested categories are already loaded.
        func(false);
        return;
      } else {
        // We need to load the requested categories before invoking the function.
        this.processCurrent(new QueueEntry(cache, Id64.toIdSet(categoryIds, true), func));
      }
    }

    private processCurrent(entry: QueueEntry): void {
      assert(undefined !== this._request);
      assert(undefined === this._current);

      this._current = entry;
      this._request.promise.then((completed: boolean) => { // eslint-disable-line @typescript-eslint/no-floating-promises
        if (this._disposed || this._current !== entry)
          return;

        // Invoke all the functions which were awaiting this set of IModelConnection.Categories.
        if (completed)
          for (const func of entry.funcs) {
            func(true);
            if (this._current !== entry)
              return; // A callback canceled this entry and may have started another request.
          }

        this._request = undefined;
        this._current = undefined;

        // If we have more requests, process them.
        this.processNext();
      });
    }

    private processNext(): void {
      let next;
      while (undefined !== (next = this._next.shift())) {
        this._request = next.cache.load(next.categoryIds);
        if (undefined === this._request) {
          // All categories loaded. Nested pushes from these callbacks must wait in the queue (see push) - after the
          // final shift the queue looks idle, and a push that became current mid-loop would be clobbered by the next
          // iteration overwriting _request and re-entering processCurrent.
          this._draining = true;
          try {
            for (const func of next.funcs)
              func(true);
          } finally {
            this._draining = false;
          }
        } else {
          // We need to load the requested categories before invoking the pending functions.
          this.processCurrent(next);
          return;
        }
      }
    }

    private pushNext(cache: SubCategoriesCache, categoryIds: Id64Arg, func: QueueFunc): void {
      // Either a request is in flight, or a completion callback is pushing while processNext is draining
      // already-satisfied pending entries - in both cases this request must wait its turn behind the existing work.
      assert(undefined !== this._current || 0 < this._next.length || this._draining);

      const last = this._next[this._next.length - 1];
      if (undefined === last || last.cache !== cache) {
        // We have a request currently in process and no pending request on the same cache to batch with.
        // We could potentially determine that this request doesn't require any categories that are not already loaded or being loaded by the current request.
        // But we will find that out (synchronously) when current request completes, unless more requests come in. Probably not worth it.
        this._next.push(new QueueEntry(cache, Id64.toIdSet(categoryIds, true), func));
      } else {
        // We have a request currently in process, and the most recently pended request targets the same cache. Append this one to it.
        last.funcs.push(func);
        for (const categoryId of Id64.iterable(categoryIds))
          last.categoryIds.add(categoryId);
      }
    }
  }
}
