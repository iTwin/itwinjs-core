
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

import { BeEvent } from "./BeEvent";

/** A standard [Map<K,V>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) that emits events when its contents change.
 * @public
 */
export class ObservableMap<K, V> extends Map<K, V> {
  /** Emitted after a key/value pair is added to this map. */
  public readonly onAdded = new BeEvent<(key: K, value: V) => void>();
  /** Emitted after `key` is deleted from this map. */
  public readonly onDeleted = new BeEvent<(key: K) => void>();
  /** Emitted after this map's contents are cleared. */
  public readonly onCleared = new BeEvent<() => void>();
  /** Emitted after multiple entries are added to this map via [[setAll]]. */
  public readonly onBatchAdded = new BeEvent<() => void>();
  /** Emitted after multiple entries are deleted from this map via [[deleteAll]]. */
  public readonly onBatchDeleted = new BeEvent<() => void>();

  /** Construct a new ObservableMap.
   * @param elements Optional elements with which to populate the new map.
   */
  public constructor(elements?: Iterable<readonly [K, V]> | undefined) {
    // NB: Map constructor will invoke set(). Do not override until initialized.
    super(elements);

    this.set = (key: K, value: V) => {
      const had = super.has(key);
      const ret = super.set(key, value);
      if (!had)
        this.onAdded.raiseEvent(key, value);

      return ret;
    };
  }

  /** Invokes [Map.delete](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/delete), raising
   * the [[onDeleted]] event if the key was removed from the map.
   */
  public override delete(key: K): boolean {
    const ret = super.delete(key);
    if (ret)
      this.onDeleted.raiseEvent(key);

    return ret;
  }

  /** If this map is not already empty, invokes [Map.clear](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/clear)
   * and raises the [[onCleared]] event.
   */
  public override clear(): void {
    if (0 !== this.size) {
      super.clear();
      this.onCleared.raiseEvent();
    }
  }

  /** Add multiple entries to the map, raising [[onBatchAdded]] only once after all items are added.
   * This is more efficient than calling [[set]] in a loop when listeners need not be notified of each individual addition.
   * @param items The entries to add.
   * @returns The number of entries that were actually added (i.e., keys that were not already present).
   */
  public setAll(items: Iterable<readonly [K, V]>): number {
    const prevSize = this.size;
    for (const [key, value] of items)
      super.set(key, value);

    if (this.size !== prevSize)
      this.onBatchAdded.raiseEvent();

    return this.size - prevSize;
  }

  /** Delete multiple keys from the map, raising [[onBatchDeleted]] only once after all keys are deleted.
   * This is more efficient than calling [[delete]] in a loop when listeners need not be notified of each individual deletion.
   * @param keys The keys to delete.
   * @returns The number of keys that were actually deleted (i.e., were present in the map).
   */
  public deleteAll(keys: Iterable<K>): number {
    const prevSize = this.size;
    for (const key of keys)
      super.delete(key);

    if (this.size !== prevSize)
      this.onBatchDeleted.raiseEvent();

    return prevSize - this.size;
  }

}
