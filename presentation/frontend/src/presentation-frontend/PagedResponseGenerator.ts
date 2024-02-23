import { concat, from, mergeMap, Observable, of, range } from "rxjs";
import { PageOptions } from "@itwin/presentation-common/src/presentation-common/PresentationManagerOptions";
import { eachValueFrom } from "rxjs-for-await";
import { PagedResponse } from "@itwin/presentation-common";

/** @internal */
export interface PagedResponseGeneratorProps<TItem> {
  parallelism?: number;
  pageOptions?: PageOptions;
  getPage(page: Required<PageOptions>, requestIdx: number): Promise<PagedResponse<TItem>>;
}

/**
 * This class allows to stream paged content.
 * Pages are prefetched in advanced according to the `parallelism` argument.
 * @internal
 */
export class PagedResponseGenerator<TPagedResponseItem> {
  private _total: number = 0;
  private _firstPage?: PagedResponse<TPagedResponseItem>;
  constructor(private readonly _props: PagedResponseGeneratorProps<TPagedResponseItem>) {}

  /**
   * Get total number of pages.
   * This value should be available when either [[PagedResponseGenerator.iterator]] or [[PagedResponseGenerator.observable]] are retrieved.
   */
  public get total(): number {
    return this._total;
  }

  public async fetchFirstPage(): Promise<PagedResponse<TPagedResponseItem>> {
    if (this._firstPage) {
      return this._firstPage;
    }

    const pageStart = this._props.pageOptions?.start ?? 0;
    const pageSize = this._props.pageOptions?.size ?? 0;
    this._firstPage = await this._props.getPage({ start: pageStart, size: pageSize }, 0);
    this._total = this._firstPage.total;
    return this._firstPage;
  }

  /** Async iterator of pages. */
  public get iterator(): AsyncIterableIterator<TPagedResponseItem[]> {
    return eachValueFrom(this.observable);
  }

  /** Async iterator of all items. */
  public get itemsIterator(): AsyncIterableIterator<TPagedResponseItem> {
    return eachValueFrom(this.itemsObservable);
  }

  /** Fetches all items and collects to an array. */
  public async getAllItems(): Promise<TPagedResponseItem[]> {
    const result: TPagedResponseItem[] = [];
    for await (const value of this.itemsIterator) {
      result.push(value);
    }
    return result;
  }

  public get itemsObservable(): Observable<TPagedResponseItem> {
    return this.observable.pipe(mergeMap((x) => from(x)));
  }

  /** RXJS Observable of pages. */
  public get observable(): Observable<TPagedResponseItem[]> {
    const pageStart = this._props.pageOptions?.start ?? 0;
    const parallelism = this._props.parallelism;
    let pageSize = this._props.pageOptions?.size ?? 0;

    return from(this.fetchFirstPage()).pipe(
      mergeMap((response) => {
        // If there are no items, return a single empty page.
        if (this._total === 0) {
          return of([]);
        }

        // If the response is empty, something went wrong.
        if (!response.items.length) {
          this.handleEmptyPageResult(pageStart);
        }

        // If page size is not defined, use the result of the first request as a page size.
        // We must have a constant positive page size in order to parallelize the requests.
        pageSize = pageSize || response.items.length;

        if (pageSize === this._total) {
          return of(response.items);
        }

        const itemsToFetch = this._total - pageStart - 1;
        const numPages = Math.ceil(itemsToFetch / pageSize);
        // Return the first page and then stream the remaining ones.
        // If at some point the pages become empty, this shouldn't be an issue.
        return concat(
          of(response.items),
          range(1, numPages - 1).pipe(
            mergeMap(async (idx) => {
              const start = pageStart + idx * pageSize;
              const page = await this._props.getPage({ start, size: pageSize }, idx);
              if (!page.items.length) {
                this.handleEmptyPageResult(start);
              }
              return page.items;
            }, parallelism),
          ),
        );
      }),
    );
  }

  private handleEmptyPageResult(pageStart: number) {
    if (pageStart >= this._total) {
      throw new Error(`Requested page with start index ${pageStart} is out of bounds. Total number of items: ${this._total}`);
    }
    throw new Error("Paged request returned non zero total count but no items");
  }
}
