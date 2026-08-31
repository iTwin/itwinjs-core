
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

import { BeEvent } from "./BeEvent";

/** A standard [Map<K,V>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) that emits an event when its contents change.
 * @public
 */
export class ObservableMap<K, V> extends Map<K, V> {
  /** @internal */
  public override get [Symbol.toStringTag]() { return "ObservableMap"; }

  /** Emitted after any change to the contents of this map. */
  public readonly onChanged = new BeEvent<() => void>();

  /** Construct a new ObservableMap.
   * @param elements Optional elements with which to populate the new map.
   */
  public constructor(elements?: Iterable<readonly [K, V]> | undefined) {
    // IMPORTANT: do not pass `elements` to `super()`. It will invoke `set` which is overridden to invoke `onChanged.raiseEvent`, but
    // `onChanged` is not initialized until `super()` returns.
    super();

    if (elements)
      this.setAll(elements);
  }

  /** Invokes [Map.set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/set), raising
   * the [[onChanged]] event unless `key` is already present with the same `value`.
   */
  public override set(key: K, value: V): this {
    const valueChanged = !this.has(key) || !Object.is(this.get(key), value);
    if (valueChanged)
      super.set(key, value);

    if (valueChanged) {
      this.onChanged.raiseEvent();
    }

    return this;
  }

  /** Invokes [Map.delete](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/delete), raising
   * the [[onChanged]] event if the key was removed from the map.
   */
  public override delete(key: K): boolean {
    const ret = super.delete(key);
    if (ret) {
      this.onChanged.raiseEvent();
    }

    return ret;
  }

  /** If this map is not already empty, invokes [Map.clear](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/clear)
   * and raises the [[onChanged]] event.
   */
  public override clear(): void {
    if (0 !== this.size) {
      super.clear();
      this.onChanged.raiseEvent();
    }
  }

  /** Add or update multiple entries in the map, raising [[onChanged]] only once after all items are set, if the contents of
   * the map changed as a result.
   * This is more efficient than calling [[set]] in a loop when listeners need not be notified of each individual change.
   * @param items The entries to add or update.
   */
  public setAll(items: Iterable<readonly [K, V]>): void {
    let changed = false;
    try {
      for (const [key, value] of items) {
        if (!this.has(key) || !Object.is(this.get(key), value)) {
          super.set(key, value);
          changed = true;
        }
      }
    } finally {
      if (changed) {
        this.onChanged.raiseEvent();
      }
    }
  }

  /** Delete multiple keys from the map, raising [[onChanged]] only once after all keys are deleted.
   * This is more efficient than calling [[delete]] in a loop when listeners need not be notified of each individual deletion.
   * @param keys The keys to delete.
   * @returns The number of keys that were actually deleted (i.e., were present in the map).
   */
  public deleteAll(keys: Iterable<K>): number {
    const prevSize = this.size;
    let deletedAny = false;
    try {
      for (const key of keys) {
        if (super.delete(key))
          deletedAny = true;
      }
    } finally {
      if (deletedAny) {
        this.onChanged.raiseEvent();
      }
    }

    return prevSize - this.size;
  }

}
