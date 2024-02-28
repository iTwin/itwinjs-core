import { concat, from, mergeAll, mergeMap, Observable, of, range } from "rxjs";
import { eachValueFrom } from "rxjs-for-await";
import { Paged, PagedResponse, PageOptions } from "@itwin/presentation-common";

/**
 * Options for requests that send smaller requests in batches.
 */
export interface StreamingOptions {
  /** Number of parallel requests. Default: unlimited. */
  parallelism?: number;
}

/**
 * Properties for streaming the results.
 * @internal
 */
export type StreamedResponseGeneratorProps<TItem> = Paged<
  StreamingOptions & {
    getBatch(page: Required<PageOptions>, requestIdx: number): Promise<PagedResponse<TItem>>;
  }
>;

/**
 * This class allows loading values in multiple parallel batches and return them either as an array or an async iterator.
 * Pages are prefetched in advanced according to the `parallelism` argument.
 * @internal
 */
export class StreamedResponseGenerator<TPagedResponseItem> {
  private _total: number = 0;
  private _firstBatch?: PagedResponse<TPagedResponseItem>;
  constructor(private readonly _props: StreamedResponseGeneratorProps<TPagedResponseItem>) {}

  /**
   * Get total number of items.
   * This value should be updated after calling [[PagedResponseGenerator.fetchFirstBatch]],
   * or after iterating the first value from any of the provided iterators.
   */
  public get total(): number {
    return this._total;
  }

  /**
   * Fetches and caches the first batch.
   * This function can be called in order to retrieve the total items count.
   * @returns response for the first page.
   */
  public async fetchFirstBatch(): Promise<PagedResponse<TPagedResponseItem>> {
    if (this._firstBatch) {
      return this._firstBatch;
    }

    const start = this._props.paging?.start ?? 0;
    const batchSize = this._props.paging?.size ?? 0;
    this._firstBatch = await this._props.getBatch({ start, size: batchSize }, 0);
    this._total = this._firstBatch.total;
    return this._firstBatch;
  }

  /**
   * Fetches items and collects to an array.
   * If page size is specified in the properties, then it will return only the
   */
  public async getItems(): Promise<TPagedResponseItem[]> {
    const result = new Array<TPagedResponseItem>();
    for await (const value of this.itemsIterator) {
      result.push(value);
    }
    return result;
  }

  /** Async iterator of all items. */
  public get itemsIterator(): AsyncIterableIterator<TPagedResponseItem> {
    return eachValueFrom(this.items);
  }

  /**
   * RXJS observable of items.
   * Items count will be limited to the page size, if one is specified in the configuration.
   */
  public get items(): Observable<TPagedResponseItem> {
    return this._batches.pipe(mergeAll());
  }

  private get _batches(): Observable<TPagedResponseItem[]> {
    const pageStart = this._props.paging?.start ?? 0;
    const parallelism = this._props.parallelism;
    const pageSize = this._props.paging?.size;

    return from(this.fetchFirstBatch()).pipe(
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

        const totalItemsToFetch = this._total - pageStart;
        if (receivedItemsLength === totalItemsToFetch) {
          return of(response.items);
        }

        let itemsToFetch: number;
        let batchSize: number;
        if (pageSize) {
          itemsToFetch = Math.min(totalItemsToFetch, pageSize) - receivedItemsLength;
          batchSize = Math.min(pageSize, receivedItemsLength);
        } else {
          itemsToFetch = totalItemsToFetch - receivedItemsLength;
          batchSize = receivedItemsLength;
        }

        const remainingBatches = Math.ceil(itemsToFetch / batchSize);

        // Return the first page and then stream the remaining ones.
        return concat(
          of(response.items),
          range(1, remainingBatches).pipe(
            mergeMap(async (idx) => {
              const start = pageStart + idx * batchSize;
              const size = Math.min(this._total - start, batchSize);
              const page = await this._props.getBatch({ start, size }, idx);
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
