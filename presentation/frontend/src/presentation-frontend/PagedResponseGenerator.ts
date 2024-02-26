import { concat, from, mergeAll, mergeMap, Observable, of, range } from "rxjs";
import { eachValueFrom } from "rxjs-for-await";
import { PagedResponse, PageOptions } from "@itwin/presentation-common";

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
   * This value should be updated after calling [[PagedResponseGenerator.fetchFirstPage]],
   * or after polling a value from [[PagedResponseGenerator.iterator]] or [[PagedResponseGenerator.observable]].
   */
  public get total(): number {
    return this._total;
  }

  /**
   * Fetches and caches the first page.
   * This function can be called in order to retrieve the total items count.
   * @returns response for the first page.
   */
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
    return eachValueFrom(this.pages);
  }

  /** Async iterator of all items. */
  public get itemsIterator(): AsyncIterableIterator<TPagedResponseItem> {
    return eachValueFrom(this.items);
  }

  /** Fetches all items and collects to an array. */
  public async getAllItems(): Promise<TPagedResponseItem[]> {
    const result: TPagedResponseItem[] = [];
    for await (const value of this.itemsIterator) {
      result.push(value);
    }
    return result;
  }

  /** RXJS observable of all items. */
  public get items(): Observable<TPagedResponseItem> {
    return this.pages.pipe(mergeAll());
  }

  /** RXJS Observable of pages. */
  public get pages(): Observable<TPagedResponseItem[]> {
    const pageStart = this._props.pageOptions?.start ?? 0;
    const parallelism = this._props.parallelism;
    const originalPageSize = this._props.pageOptions?.size;

    return from(this.fetchFirstPage()).pipe(
      mergeMap((response) => {
        // If there are no items, return a single empty page.
        if (this._total === 0) {
          return of([]);
        }

        // If the response is empty, something went wrong.
        const receivedItemsLength = response.items.length;
        if (!receivedItemsLength) {
          this.handleEmptyPageResult(pageStart);
        }

        // If page size is not defined, use the result of the first request as a page size.
        // We must have a constant positive page size in order to parallelize the requests.
        let pageSize = originalPageSize ?? 0;
        if (!pageSize || receivedItemsLength < pageSize) {
          pageSize = receivedItemsLength;
        }

        if (pageSize === this._total) {
          return of(response.items);
        }

        const itemsToFetch = this._total - pageStart - receivedItemsLength;
        const remainingPages = Math.ceil(itemsToFetch / pageSize);

        // Return the first page and then stream the remaining ones.
        return concat(
          of(response.items),
          range(1, remainingPages).pipe(
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
