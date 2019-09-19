/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Collections */

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

  /** @internal */
  public add(item: T): this {
    const prevSize = this.size;
    const ret = super.add(item);
    if (this.size !== prevSize)
      this.onAdded.raiseEvent(item);

    return ret;
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
