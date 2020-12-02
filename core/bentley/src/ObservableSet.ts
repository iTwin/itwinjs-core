/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

import { BeEvent } from "./BeEvent";

/** A standard Set<T> that emits events when its contents change.
 * @beta
 */
export class ObservableSet<T> extends Set<T> {
  /** Emitted after `item` is added to this set. */
  public readonly onAdded = new BeEvent<(item: T) => void>();
  /** Emitted after `item` is deleted from this set. */
  public readonly onDeleted = new BeEvent<(item: T) => void>();
  /** Emitted after this set's contents are cleared. */
  public readonly onCleared = new BeEvent<() => void>();

  /** Construct a new ObservableSet from the specified elements. */
  public constructor(elements?: Iterable<T> | undefined) {
    // NB: Set constructor will invoke add(). Do not override until initialized.
    super(elements);

    this.add = (item: T) => { // eslint-disable-line @typescript-eslint/unbound-method
      const prevSize = this.size;
      const ret = super.add(item);
      if (this.size !== prevSize)
        this.onAdded.raiseEvent(item);

      return ret;
    };
  }

  /** @internal */
  public delete(item: T): boolean {
    const ret = super.delete(item);
    if (ret)
      this.onDeleted.raiseEvent(item);

    return ret;
  }

  /** @internal */
  public clear(): void {
    if (0 !== this.size) {
      super.clear();
      this.onCleared.raiseEvent();
    }
  }
}
