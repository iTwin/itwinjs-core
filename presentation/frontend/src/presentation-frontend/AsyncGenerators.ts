import { Observable } from "rxjs";
import { eachValueFrom } from "rxjs-for-await";

/** @internal */
export async function collectAsyncIterable<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const result = new Array<T>();
  for await (const item of iter) {
    result.push(item);
  }
  return result;
}

/** @internal */
export async function collectObservable<T>(observable: Observable<T>): Promise<T[]> {
  return collectAsyncIterable(eachValueFrom(observable));
}
