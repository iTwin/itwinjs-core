/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, CompressedId64Set, Id64, Id64Arg, Id64Set, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { SubCategoryAppearance, SubCategoryResultRow } from "@itwin/core-common";
import { IModelConnection } from "./IModelConnection";

/** A cancelable paginated request for subcategory information.
 * @see SubCategoriesCache
 * @internal
 */
export interface SubCategoriesRequest {
  /** The Ids of any categories which were requested but were not yet loaded. */
  readonly missingCategoryIds: Id64Set;
  /** A promise which resolves to true when all of the requested categories have been loaded, or to false if not all categories were loaded.
   * Categories may fail to load if the request is explicitly canceled or if the IModelConnection is closed before all categories are loaded.
   */
  readonly promise: Promise<boolean>;
  /** Cancels the request. */
  cancel(): void;
}

const invalidCategoryIdEntry = new Set<string>();

/** A cache of information about the subcategories contained within an [[IModelConnection]]. It is populated on demand.
 * @internal
 */
export class SubCategoriesCache {
  private readonly _byCategoryId = new Map<string, Id64Set>();
  private readonly _appearances = new Map<string, SubCategoryAppearance>();
  private readonly _imodel: IModelConnection;
  private _missingAtTimeOfPreload: Id64Set | undefined;

  public constructor(imodel: IModelConnection) { this._imodel = imodel; }

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
    const promise = request.dispatch().then((result?: SubCategoriesCache.Result) => {
      if (undefined !== result)
        this.processResults(result, missing);

      return !request.wasCanceled;
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
      const results = await this._imodel.queryAllUsedSpatialSubCategories();
      if (undefined !== results){
        this.processResults(results, new Set<string>(), false);
      }
    } catch (e) {
      // In case of a truncated response, gracefully handle the error and exit.
    }

  }
  /** Given categoryIds, return which of these are not cached. */
  private getMissing(categoryIds: Id64Arg): Id64Set | undefined {
    let missing: Id64Set | undefined;
    for (const catId of Id64.iterable(categoryIds)) {
      if (undefined === this._byCategoryId.get(catId)) {
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

  private processResults(result: SubCategoriesCache.Result, missing: Id64Set, override: boolean = true): void {
    for (const row of result){
      this.add(row.parentId, row.id, SubCategoriesCache.createSubCategoryAppearance(row.appearance), override);
    }

    // Ensure that any category Ids which returned no results (e.g., non-existent category, invalid Id, etc) are still recorded so they are not repeatedly re-requested
    for (const id of missing)
      if (undefined === this._byCategoryId.get(id))
        this._byCategoryId.set(id, invalidCategoryIdEntry);
  }

  /** Exposed strictly for tests.
   * @internal
   */
  public add(categoryId: string, subCategoryId: string, appearance: SubCategoryAppearance, override: boolean) {
    let set = this._byCategoryId.get(categoryId);
    if (undefined === set)
      this._byCategoryId.set(categoryId, set = new Set<string>());

    set.add(subCategoryId);
    if (override || !this._appearances.has(subCategoryId))
      this._appearances.set(subCategoryId, appearance);
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
      if (!subCategoryIds)
        continue;

      const subCategories = this.mapSubCategoryInfos(categoryId, subCategoryIds);
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
export namespace SubCategoriesCache { // eslint-disable-line no-redeclare
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
        // ###TODO: detect cases in which retry is warranted
        // Note that currently, if we succeed in obtaining some pages of results and fail to retrieve another page, we will end up processing the
        // incomplete results. Since we're not retrying, that's the best we can do.
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

  export type QueueFunc = () => void;

  export class QueueEntry {
    public readonly categoryIds: Id64Set;
    public readonly funcs: QueueFunc[];

    public constructor(categoryIds: Id64Set, func: QueueFunc) {
      this.categoryIds = categoryIds;
      this.funcs = [func];
    }
  }

  /** A "queue" of SubCategoriesRequests, which consists of between 0 and 2 entries. Each entry specifies the set of category IDs to be loaded and a list of functions to be executed
   * when loading is completed. This is used to enforce ordering of operations upon subcategories despite the need to asynchronously load them. It incidentally also provides an
   * opportunity to reduce the number of backend requests by batching consecutive requests.
   * Chiefly used by [[Viewport]].
   * @internal
   */
  export class Queue {
    /* NB: Members marked protected for use in tests only. */
    protected _current?: QueueEntry;
    protected _next?: QueueEntry;
    protected _request?: SubCategoriesRequest;
    protected _disposed = false;

    /** Push a request onto the queue. The requested categories will be loaded if necessary, and then
     * the supplied function will be invoked. Any previously-pushed requests are guaranteed to be processed before this one.
     */
    public push(cache: SubCategoriesCache, categoryIds: Id64Arg, func: QueueFunc): void {
      if (this._disposed)
        return;
      else if (undefined === this._current)
        this.pushCurrent(cache, categoryIds, func);
      else
        this.pushNext(categoryIds, func);
    }

    /** Cancel all requests and empty the queue. */
    public dispose(): void {
      if (undefined !== this._request) {
        assert(undefined !== this._current);
        this._request.cancel();
        this._request = undefined;
      }

      this._current = this._next = undefined;
      this._disposed = true;
    }

    public get isEmpty(): boolean {
      return undefined === this._current && undefined === this._next;
    }

    private pushCurrent(cache: SubCategoriesCache, categoryIds: Id64Arg, func: QueueFunc): void {
      assert(undefined === this._next);
      assert(undefined === this._current);
      assert(undefined === this._request);

      this._request = cache.load(categoryIds);
      if (undefined === this._request) {
        // All requested categories are already loaded.
        func();
        return;
      } else {
        // We need to load the requested categories before invoking the function.
        this.processCurrent(cache, new QueueEntry(Id64.toIdSet(categoryIds, true), func));
      }
    }

    private processCurrent(cache: SubCategoriesCache, entry: QueueEntry): void {
      assert(undefined !== this._request);
      assert(undefined === this._current);
      assert(undefined === this._next);

      this._current = entry;
      this._request.promise.then((completed: boolean) => { // eslint-disable-line @typescript-eslint/no-floating-promises
        if (this._disposed)
          return;

        // Invoke all the functions which were awaiting this set of IModelConnection.Categories.
        assert(undefined !== this._current);
        if (completed)
          for (const func of this._current.funcs)
            func();

        this._request = undefined;
        this._current = undefined;

        // If we have more requests, process them.
        const next = this._next;
        this._next = undefined;
        if (undefined !== next) {
          this._request = cache.load(next.categoryIds);
          if (undefined === this._request) {
            // All categories loaded.
            for (const func of next.funcs)
              func();
          } else {
            // We need to load the requested categories before invoking the pending functions.
            this.processCurrent(cache, next);
          }
        }
      });
    }

    private pushNext(categoryIds: Id64Arg, func: QueueFunc): void {
      assert(undefined !== this._current);
      assert(undefined !== this._request);

      if (undefined === this._next) {
        // We have a request currently in process and none pending.
        // We could potentially determine that this request doesn't require any categories that are not already loaded or being loaded by the current request.
        // But we will find that out (synchronously) when current request completes, unless more requests come in. Probably not worth it.
        this._next = new QueueEntry(Id64.toIdSet(categoryIds, true), func);
      } else {
        // We have a request currently in process, and one or more pending. Append this one to the pending.
        this._next.funcs.push(func);
        for (const categoryId of Id64.iterable(categoryIds))
          this._next.categoryIds.add(categoryId);
      }
    }
  }
}
