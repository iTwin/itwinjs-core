/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { concat, concatAll, map, mergeMap, Observable, of, range, scan } from "rxjs";
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
  constructor(private readonly _props: StreamedResponseGeneratorProps<TPagedResponseItem>) {}

  /** Creates a response with the total item count and an async iterator. */
  public async createAsyncIteratorResponse(): Promise<{ total: number; items: AsyncIterableIterator<TPagedResponseItem> }> {
    const firstPage = await this.fetchFirstPage();
    return {
      total: firstPage.total,
      items: eachValueFrom(this.getRemainingPages(firstPage).pipe(concatAll())),
    };
  }

  /**
   * Fetches the first page.
   * This function has to be called in order to retrieve the total items count.
   */
  private async fetchFirstPage(): Promise<PagedResponse<TPagedResponseItem>> {
    const start = this._props.paging?.start ?? 0;
    const batchSize = this._props.paging?.size ?? 0;
    return this._props.getBatch({ start, size: batchSize }, 0);
  }

  private getRemainingPages(firstPage: PagedResponse<TPagedResponseItem>): Observable<TPagedResponseItem[]> {
    const pageStart = this._props.paging?.start ?? 0;
    const maxParallelRequests = this._props.maxParallelRequests;
    const pageSize = this._props.paging?.size;
    const { total, items: firstPageItems } = firstPage;

    // If there are no items, return a single empty page.
    if (total === 0) {
      return of([]);
    }

    // If the response is empty, something went wrong.
    const receivedItemsLength = firstPage.items.length;
    if (!receivedItemsLength) {
      handleEmptyPageResult(pageStart, total);
    }

    const totalItemsToFetch = total - pageStart;
    if (receivedItemsLength === totalItemsToFetch) {
      return of(firstPageItems);
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
      of(firstPage.items),
      range(1, remainingBatches).pipe(
        mergeMap(async (idx) => {
          const start = pageStart + idx * batchSize;
          const size = Math.min(total - start, batchSize);
          const page = await this._props.getBatch({ start, size }, idx);
          if (!page.items.length) {
            handleEmptyPageResult(start, total);
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
              if (batch.idx - 1 !== lastEmitted) {
                break;
              }
              lastEmitted = batch.idx;
              batchesToEmit.push(batch);
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
  }
}

function handleEmptyPageResult(pageStart: number, total: number) {
  if (pageStart >= total) {
    throw new Error(`Requested page with start index ${pageStart} is out of bounds. Total number of items: ${total}`);
  }
  throw new Error("Paged request returned non zero total count but no items");
}
