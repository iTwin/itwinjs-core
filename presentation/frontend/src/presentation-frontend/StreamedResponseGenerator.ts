import { concat, from, mergeAll, mergeMap, Observable, of, range, take } from "rxjs";
import { eachValueFrom } from "rxjs-for-await";
import { PagedResponse, PageOptions } from "@itwin/presentation-common";
import { collectObservable } from "./AsyncGenerators";

/**
 * Options for batches that will be sent in parallel.
 */
export type BatchOptions = PageOptions;

/**
 * Properties for streaming the results.
 */
export interface StreamedResponseGeneratorProps<TItem> {
  batch?: BatchOptions;
  parallelism?: number;
  getBatch(page: Required<BatchOptions>, requestIdx: number): Promise<PagedResponse<TItem>>;
}

/**
 * This class allows to stream paged content.
 * Pages are prefetched in advanced according to the `parallelism` argument.
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

    const start = this._props.batch?.start ?? 0;
    const batchSize = this._props.batch?.size ?? 0;
    this._firstBatch = await this._props.getBatch({ start, size: batchSize }, 0);
    this._total = this._firstBatch.total;
    return this._firstBatch;
  }

  /** Creates an stream of items with a certain limit. */
  public getLimitedItemsIterator(limit: number): AsyncIterableIterator<TPagedResponseItem> {
    return eachValueFrom(this.getLimitedItemsObservable(limit));
  }

  /** Creates an stream of items with a certain limit. */
  public getLimitedItemsObservable(limit: number): Observable<TPagedResponseItem> {
    return this.items.pipe(take(limit));
  }

  /** Fetches items and collects to an array. */
  public async getItems(limit?: number): Promise<TPagedResponseItem[]> {
    return collectObservable(limit ? this.getLimitedItemsObservable(limit) : this.items);
  }

  /** Async iterator of all items. */
  public get itemsIterator(): AsyncIterableIterator<TPagedResponseItem> {
    return eachValueFrom(this.items);
  }

  /** Async iterator of all item batches. */
  public get batchesIterator(): AsyncIterableIterator<TPagedResponseItem[]> {
    return eachValueFrom(this.batches);
  }

  /** RXJS observable of all items. */
  public get items(): Observable<TPagedResponseItem> {
    return this.batches.pipe(mergeAll());
  }

  public get batches(): Observable<TPagedResponseItem[]> {
    const batchStart = this._props.batch?.start ?? 0;
    const parallelism = this._props.parallelism;
    const originalBatchSize = this._props.batch?.size;

    return from(this.fetchFirstBatch()).pipe(
      mergeMap((response) => {
        // If there are no items, return a single empty page.
        if (this._total === 0) {
          return of([]);
        }

        // If the response is empty, something went wrong.
        const receivedItemsLength = response.items.length;
        if (!receivedItemsLength) {
          this.handleEmptyPageResult(batchStart);
        }

        // If page size is not defined, use the result of the first request as a page size.
        // We must have a constant positive page size in order to parallelize the requests.
        let batchSize = originalBatchSize ?? 0;
        if (!batchSize || receivedItemsLength < batchSize) {
          batchSize = receivedItemsLength;
        }

        if (batchSize === this._total) {
          return of(response.items);
        }

        const itemsToFetch = this._total - batchStart - receivedItemsLength;
        const remainingBatches = Math.ceil(itemsToFetch / batchSize);

        // Return the first page and then stream the remaining ones.
        return concat(
          of(response.items),
          range(1, remainingBatches).pipe(
            mergeMap(async (idx) => {
              const start = batchStart + idx * batchSize;
              const page = await this._props.getBatch({ start, size: batchSize }, idx);
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
