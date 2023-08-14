/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

/** A map similar to the standard JavaScript Map collection except that the keys must be a tuple
 * (javascript array), and two keys are considered equal if their elements in order are strict-equal,
 * and the tuples have the same amount of elements
 *
 * This means you can use array literals to key data in Maps that would otherwise be reference-compared
 * if using JavaScript's built in Map
 *
 * Note that JavaScript's Map type, unlike this one that uses strict equality, uses instead
 * SameValueZero equality comparison
 * @see https://262.ecma-international.org/6.0/#sec-samevaluezero
 *
 * ```js
 * const map = new TupleKeyedMap([[1,"y"], "value"]);
 * const value = map.get([1, "y"]); // a normal map would identify these keys as different because they are independent objects
 * ```
 *
 * It is implemented by each index of the tuple key being used as a singular key into a submap
 * @note this only implements a subset of the Map interface
 * @public
 */
export class TupleKeyedMap<K extends readonly any[], V> {
  private _map = new Map<K[0], Map<any, V> | V>();

  // argument types match those of Map
  public constructor(entries?: readonly (readonly [K, V])[] | null) {
    if (entries)
      for (const [k, v] of entries) {
        this.set(k, v);
      }
  }

  public clear(): void {
    return this._map.clear();
  }

  private makeKeyError() {
    return Error(
      "A Bad key was used, it didn't match the key type of the the map.",
    );
  }

  public get(key: K): V | undefined {
    let cursor: Map<any, any> | V = this._map;
    for (const subkey of key) {
      if (!(cursor instanceof Map))
        throw this.makeKeyError();
      cursor = cursor.get(subkey);
      if (cursor === undefined)
        return undefined;
    }
    if (cursor instanceof Map)
      throw this.makeKeyError();
    return cursor;
  }

  public has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  public set(key: K, value: V): this {
    let cursor: Map<any, any> = this._map;
    for (let i = 0; i < key.length - 1; ++i) {
      const subkey = key[i];
      let next = cursor.get(subkey);
      if (next === undefined) {
        next = new Map();
        cursor.set(subkey, next);
      }
      cursor = next;
    }
    const finalSubkey = key[key.length - 1];
    if (!(cursor instanceof Map))
      throw this.makeKeyError();
    cursor.set(finalSubkey, value);
    this._size++;
    return this;
  }

  public *[Symbol.iterator](): IterableIterator<[K, V]> {
    function *impl(map: Map<any, any>, keyPrefix: readonly any[]): IterableIterator<[K, V]> {
      for (const [k, v] of map) {
        const nextKey = [...keyPrefix, k];
        if (v instanceof Map) {
          yield* impl(v, nextKey);
        } else {
          yield [nextKey as any as K, v];
        }
      }
    }
    yield* impl(this._map, []);
  }

  private _size: number = 0;
  public get size(): number {
    return this._size;
  }

  public get [Symbol.toStringTag](): string {
    return this.constructor.name;
  }
}
