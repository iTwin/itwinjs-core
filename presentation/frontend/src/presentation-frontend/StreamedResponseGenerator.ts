/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { concat, concatAll, from, map, mergeMap, Observable, of, range, scan } from "rxjs";
import { eachValueFrom } from "rxjs-for-await";
import { PagedResponse, PageOptions } from "@itwin/presentation-common";
import { SortedArray } from "@itwin/core-bentley";
import { MultipleValuesRequestOptions } from "./PresentationManager";

/**
 * Properties for streaming the results.
 * @internal
 */
export type StreamedResponseGeneratorProps<TItem> = MultipleValuesRequestOptions & {
  getBatch(page: Required<PageOptions>, requestIdx: number): Promise<PagedResponse<TItem>>;
};

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
    return this._batches.pipe(concatAll());
  }

  private get _batches(): Observable<TPagedResponseItem[]> {
    const pageStart = this._props.paging?.start ?? 0;
    const maxParallelRequests = this._props.maxParallelRequests;
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

              // Pass along the index, so that the items could be sorted.
              return { idx, items: page.items };
            }, maxParallelRequests),
            scan(
              // Collect the emitted pages an emit them in the correct order.
              (acc, value) => {
                let { lastEmitted } = acc;
                const { accumulatedBatches } = acc;
                const { idx } = value;

                // If current batch is not in order, put it in the accumulator
                if (idx - 1 !== lastEmitted) {
                  accumulatedBatches.insert(value);
                  return { lastEmitted, accumulatedBatches, itemsToEmit: [] };
                }

                // Collect all batches to emit in order.
                lastEmitted = idx;
                const batchesToEmit = [value];
                for (const batch of accumulatedBatches) {
                  if (batch.idx - 1 === lastEmitted) {
                    lastEmitted = batch.idx;
                    batchesToEmit.push(batch);
                  }
                }

                // Remove batches to emit from the accumulator.
                for (const batch of batchesToEmit) {
                  accumulatedBatches.remove(batch);
                }

                const itemsToEmit = batchesToEmit.flatMap((x) => x.items);
                return { lastEmitted, accumulatedBatches, itemsToEmit };
              },
              {
                lastEmitted: 0,
                accumulatedBatches: new SortedArray<{ idx: number; items: TPagedResponseItem[] }>((a, b) => a.idx - b.idx),
                itemsToEmit: new Array<TPagedResponseItem>(),
              },
            ),
            map(({ itemsToEmit }) => itemsToEmit),
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
