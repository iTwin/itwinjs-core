/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  Id64Set,
  Id64String,
} from "@bentley/bentleyjs-core";
import { SubCategoryAppearance } from "@bentley/imodeljs-common";
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
  public load(categoryIds: Id64Set): SubCategoriesRequest | undefined {
    let missing: Id64Set | undefined;
    for (const catId of categoryIds) {
      if (undefined === this._byCategoryId.get(catId)) {
        if (undefined === missing)
          missing = new Set<string>();

        missing.add(catId);
      }
    }

    if (undefined === missing)
      return undefined;

    const request = new SubCategoriesCache.Request(missing, this._imodel);
    const promise = request.dispatch().then((pages?: SubCategoriesCache.Result) => {
      if (undefined !== pages)
        this.processResults(pages, missing!);

      return !request.wasCanceled;
    });

    return {
      missingCategoryIds: missing,
      promise,
      cancel: () => request.cancel(),
    };
  }

  public onIModelConnectionClose(): void {
    this._byCategoryId.clear();
    this._appearances.clear();
  }

  private static createSubCategoryAppearance(json?: any) {
    let props: SubCategoryAppearance | undefined;
    if ("string" === typeof json && 0 < json.length)
      props = JSON.parse(json);

    return new SubCategoryAppearance(props);
  }

  private processResults(pages: SubCategoriesCache.Result, missing: Id64Set): void {
    for (const rows of pages)
      for (const row of rows)
        this.add(row.parentId as string, row.id as string, SubCategoriesCache.createSubCategoryAppearance(row.appearance));

    // Ensure that any category Ids which returned no results (e.g., non-existent category, invalid Id, etc) are still recorded so they are not repeatedly re-requested
    for (const id of missing)
      if (undefined === this._byCategoryId.get(id))
        this._byCategoryId.set(id, invalidCategoryIdEntry);
  }

  private add(categoryId: string, subCategoryId: string, appearance: SubCategoryAppearance) {
    let set = this._byCategoryId.get(categoryId);
    if (undefined === set)
      this._byCategoryId.set(categoryId, set = new Set<string>());

    set.add(subCategoryId);
    this._appearances.set(subCategoryId, appearance);
  }
}

/** This namespace and the types within it are exported strictly for use in tests.
 * @internal
 */
export namespace SubCategoriesCache {
  export interface ResultRow {
    parentId: Id64String;
    id: Id64String;
    appearance: SubCategoryAppearance.Props;
  }

  export type ResultPage = ResultRow[];
  export type Result = ResultPage[];

  export class Request {
    private readonly _imodel: IModelConnection;
    private readonly _ecsql: string[] = [];
    private readonly _pages: Result = [];
    private readonly _pageSize: number;
    private _canceled = false;
    private _curECSqlIndex = 0;
    private _curPageIndex = 0;

    public get wasCanceled() { return this._canceled || this._imodel.isClosed; }

    public constructor(categoryIds: Set<string>, imodel: IModelConnection, maxCategoriesPerQuery = 200, maxSubCategoriesPerPage = 1000) {
      this._imodel = imodel;
      this._pageSize = maxSubCategoriesPerPage;

      const catIds = [...categoryIds];
      while (catIds.length !== 0) {
        const end = (catIds.length > maxCategoriesPerQuery) ? maxCategoriesPerQuery : catIds.length;
        const where = catIds.splice(0, end).join(",");
        this._ecsql.push("SELECT ECInstanceId as id, Parent.Id as parentId, Properties as appearance FROM BisCore.SubCategory WHERE Parent.Id IN (" + where + ")");
      }
    }

    public cancel() { this._canceled = true; }

    public async dispatch(): Promise<Result | undefined> {
      if (this.wasCanceled || this._curECSqlIndex >= this._ecsql.length) // handle case of empty category Id set...
        return undefined;

      let rows: ResultRow[] | undefined;
      try {
        const ecsql = this._ecsql[this._curECSqlIndex];
        rows = Array.from(await this._imodel.queryPage(ecsql, undefined, { start: this._curPageIndex, size: this._pageSize }));
      } catch (_) {
        // ###TODO: detect cases in which retry is warranted
        // Note that currently, if we succeed in obtaining some pages of results and fail to retrieve another page, we will end up processing the
        // incomplete results. Since we're not retrying, that's the best we can do.
        rows = undefined;
      }

      // NB: from hereafter, we only check the cancellation flag if more results need to be obtained.
      if (undefined !== rows && rows.length > 0) {
        this._pages.push(rows);
        if (rows.length >= this._pageSize) {
          // More rows (may) exist for current ecsql query. If canceled, abort.
          if (this.wasCanceled)
            return undefined;

          // Obtain the next page of results for current ECSql query.
          ++this._curPageIndex;
          return this.dispatch();
        }
      }

      // Finished with current ECSql query. Dispatch the next if one exists.
      this._curPageIndex = 0;
      if (++this._curECSqlIndex < this._ecsql.length) {
        if (this.wasCanceled)
          return undefined;
        else
          return this.dispatch();
      }

      // Even if we were canceled, we've retrieved all the rows. Might as well process them to prevent another request for some of the same rows from being enqueued.
      return this._pages;
    }
  }
}
