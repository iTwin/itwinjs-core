/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

import { BeEvent } from "./BeEvent";

/** A standard [Set<T>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) that emits events when its contents change.
 * @public
 */
export class ObservableSet<T> extends Set<T> {
  /** Emitted after `item` is added to this set. */
  public readonly onAdded = new BeEvent<(item: T) => void>();
  /** Emitted after `item` is deleted from this set. */
  public readonly onDeleted = new BeEvent<(item: T) => void>();
  /** Emitted after this set's contents are cleared. */
  public readonly onCleared = new BeEvent<() => void>();
  /** Emitted after multiple items are added to this set via [[addAll]]. */
  public readonly onBatchAdded = new BeEvent<() => void>();
  /** Emitted after multiple items are deleted from this set via [[deleteAll]]. */
  public readonly onBatchDeleted = new BeEvent<() => void>();

  /** Construct a new ObservableSet.
   * @param elements Optional elements with which to populate the new set.
   */
  public constructor(elements?: Iterable<T> | undefined) {
    // NB: Set constructor will invoke add(). Do not override until initialized.
    super(elements);

    this.add = (item: T) => {
      const prevSize = this.size;
      const ret = super.add(item);
      if (this.size !== prevSize)
        this.onAdded.raiseEvent(item);

      return ret;
    };
  }

  /** Invokes [Set.delete](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/delete), raising
   * the [[onDeleted]] event if the item was removed from the set.
   */
  public override delete(item: T): boolean {
    const ret = super.delete(item);
    if (ret)
      this.onDeleted.raiseEvent(item);

    return ret;
  }

  /** If this set is not already empty, invokes [Set.clear](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/clear)
   * and raises the [[onCleared]] event.
   */
  public override clear(): void {
    if (0 !== this.size) {
      super.clear();
      this.onCleared.raiseEvent();
    }
  }

  /** Add multiple items to the set, raising [[onBatchAdded]] only once after all items are added.
   * This is more efficient than calling [[add]] in a loop when listeners need not be notified of each individual addition.
   * @param items The items to add.
   * @returns The number of items that were actually added (i.e., were not already present).
   */
  public addAll(items: Iterable<T>): number {
    const prevSize = this.size;
    for (const item of items)
      super.add(item);

    if (this.size !== prevSize)
      this.onBatchAdded.raiseEvent();

    return this.size - prevSize;
  }

  /** Delete multiple items from the set, raising [[onBatchDeleted]] only once after all items are deleted.
   * This is more efficient than calling [[delete]] in a loop when listeners need not be notified of each individual deletion.
   * @param items The items to delete.
   * @returns The number of items that were actually deleted (i.e., were present in the set).
   */
  public deleteAll(items: Iterable<T>): number {
    const prevSize = this.size;
    for (const item of items)
      super.delete(item);

    if (this.size !== prevSize)
      this.onBatchDeleted.raiseEvent();

    return prevSize - this.size;
  }
}
