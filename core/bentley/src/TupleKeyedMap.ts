/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

/** A map similar to the standard JavaScript Map collection except that the keys must be a tuple
 * (javascript array), and value comparison is used on these tuple keys.
 * This means you can use array literals to store complicated data
 * It has not been benchmarked against
 * ```js
 * const map = new TupleKeyedMap([[1,"y"], "value"]);
 * const value = map.get()
 * ```
 * It is implemented by each index of the tuple key being used as a singular key
 */
export class TupleKeyedMap<K extends readonly [any], V> implements Map<K, V> {
  private _map = new Map<K[0], V>();

  public clear(): void {
    return this._map.clear();
  }

  public delete(key: K): boolean {
  }

  public forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
    throw new Error("Method not implemented.");
  }

  public get(key: K): V | undefined {
    throw new Error("Method not implemented.");
  }

  public has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  public set(key: K, value: V): this {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let cursor: Map<any, any> = this;
    for (let i = 0; i < key.length - 1; ++i) {
      const subkey = key[i];
      const prevCursor = cursor;
      cursor = new TupleKeyedMap();
      if (!(prevCursor.has(subkey)))
        prevCursor.set(subkey, cursor);
    }
    const finalSubkey = key[key.length - 1];
    cursor.set(finalSubkey, value);
  }

  public get size(): number {
    // if needed this can be implemented by incrementing in set/delete
    throw new Error("Method not implemented.");
  }

  public entries(): IterableIterator<[K, V]> {
    throw new Error("Method not implemented.");
  }
  public keys(): IterableIterator<K> {
    throw new Error("Method not implemented.");
  }
  public values(): IterableIterator<V> {
    throw new Error("Method not implemented.");
  }
  public [Symbol.iterator](): IterableIterator<[K, V]> {
    throw new Error("Method not implemented.");
  }

  public get [Symbol.toStringTag](): string { return this.constructor.name; }
}
