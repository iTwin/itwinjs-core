import { concat, from, mergeMap, Observable, of, range } from "rxjs";
import { PageOptions } from "@itwin/presentation-common/src/presentation-common/PresentationManagerOptions";
import { eachValueFrom } from "rxjs-for-await";

/** @internal */
export interface PageData<TItem> {
  total: number;
  items: TItem[];
}

/** @internal */
export interface PagedResponseGeneratorProps<TItem> {
  parallelism?: number;
  pageOptions: Required<PageOptions>;
  getPage(page: Required<PageOptions>): Promise<PageData<TItem>>;
}

/**
 * This class allows to stream paged content.
 * Pages are prefetched in advanced according to the `parallelism` argument.
 * @internal
 */
export class PagedResponseGenerator<TPagedResponseItem> {
  // private _total?: number;
  constructor(private readonly _props: PagedResponseGeneratorProps<TPagedResponseItem>) {}

  // /**
  //  * Get total number of pages.
  //  * This value should be available when either [[PagedResponseGenerator.iterator]] or [[PagedResponseGenerator.observable]] are retrieved.
  //  */
  // public get total(): number | undefined {
  //   return this._total;
  // }

  /** Async iterator of pages. */
  public get iterator(): AsyncIterableIterator<TPagedResponseItem[]> {
    return eachValueFrom(this.observable);
  }

  /** RXJS Observable of pages. */
  public get observable(): Observable<TPagedResponseItem[]> {
    const pageSize = this._props.pageOptions.size;
    const parallelism = this._props.parallelism;

    // const setTotal = (x: number) => {
    //   this._total = x;
    // };

    return from(this._props.getPage(this._props.pageOptions)).pipe(
      mergeMap((response) => {
        const total = response.total;
        // setTotal(total);

        if (total === 0 || pageSize === 0) {
          return of([]);
        }

        const numPages = Math.ceil(total / pageSize);
        if (numPages === 1) {
          return of(response.items);
        }

        return concat(
          of(response.items),
          range(1, numPages - 1).pipe(
            mergeMap(async (idx) => {
              const start = pageSize * idx;
              const page = await this._props.getPage({ start, size: pageSize });
              return page.items;
            }, parallelism),
          ),
        );
      }),
    );
  }
}
