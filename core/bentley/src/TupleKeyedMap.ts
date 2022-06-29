/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

/** the set of Map interface functions supported by TupleKeyedMap */
interface PartialMap<K, V> {
  get(k: K): V | undefined;
  set(k: K, v: V): PartialMap<K, V>;
  has(k: K): boolean;
}

/** A map similar to the standard JavaScript Map collection except that the keys must be a tuple
 * (javascript array), and value comparison is used on these tuple keys, without a user-provided hash function.
 * This means you can use array literals to store complicated data.
 * ```js
 * const map = new TupleKeyedMap([[1,"y"], "value"]);
 * const value = map.get([1, "y"]); // a normal map would identify these keys as different because they are independent objects!
 * ```
 * It is implemented by each index of the tuple key being used as a singular key into a submap
 * @note this only implements a subset, [[PartialMap]], of the Map interface
 */
export class TupleKeyedMap<K extends readonly any[], V> implements PartialMap<K, V> {
  private _map = new Map<K[0], V>();

  public clear(): void {
    return this._map.clear();
  }

  public get(key: K): V | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let value: TupleKeyedMap<any, any> | V = this;
    for (const subkey of key) {
      if (!(value instanceof TupleKeyedMap)) throw Error("A Bad key was used, it didn't match the key type of the the map.");
      value = value.get(subkey);
      if (value === undefined) return undefined;
    }
    if (value instanceof TupleKeyedMap) throw Error("A Bad key was used, it didn't match the key type of the the map.");
    return value;
  }

  public has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  public set(key: K, value: V): this {
    // TODO: contribute a fix that this shouldn't apply on mutable bindings (let)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let cursor: TupleKeyedMap<any, any> = this;
    for (let i = 0; i < key.length - 1; ++i) {
      const subkey = key[i];
      let next = cursor.get(subkey);
      if (next === undefined) {
        next = new TupleKeyedMap();
        cursor.set(subkey, next);
      }
      cursor = next;
    }
    const finalSubkey = key[key.length - 1];
    cursor.set(finalSubkey, value);
    this._size++;
    return this;
  }

  private _size: number = 0;
  public get size(): number { return this._size; }

  public get [Symbol.toStringTag](): string { return this.constructor.name; }
}
