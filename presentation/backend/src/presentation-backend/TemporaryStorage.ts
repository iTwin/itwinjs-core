/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { IDisposable } from "@itwin/core-bentley";

/**
 * Configuration properties for [[TemporaryStorage]].
 * @internal
 */
export interface TemporaryStorageProps<T> {
  /** A factory method that creates a stored value given it's identifier */
  factory: (id: string) => T;

  /** A method that's called for every value before it's removed from storage */
  cleanupHandler?: (value: T) => void;

  onCreated?: (id: string) => void;
  onDisposedSingle?: (id: string) => void;
  onDisposedAll?: () => void;

  /**
   * An interval at which the storage attempts to clean up its values.
   * When `0` or `undefined` is specified, values are not cleaned up
   * automatically and cleanup has to be initiated manually by calling
   * [[TemporaryStorage.disposeOutdatedValues]].
   */
  cleanupInterval?: number;

  /**
   * Shortest period of time which the value should be kept in storage
   * unused before it's cleaned up. `0` or `undefined` means values
   * are removed from the storage on every cleanup (either manual call to
   * [[TemporaryStorage.disposeOutdatedValues]] or scheduled (controlled
   * by [[cleanupInterval]]))
   */
  valueLifetime?: number;
}

/** Value with know last used time */
interface TemporaryValue<T> {
  lastUsed: Date;
  value: T;
}

/**
 * Storage for values that get removed from it after being unused (not-requested
 * for a specified amount of time).
 *
 * @internal
 */
export class TemporaryStorage<T> implements IDisposable {

  private _values: Map<string, TemporaryValue<T>>;
  private _timer?: NodeJS.Timer;
  public readonly props: TemporaryStorageProps<T>;

  /**
   * Constructor. Creates the storage using supplied params.
   */
  constructor(props: TemporaryStorageProps<T>) {
    this.props = props;
    this._values = new Map<string, TemporaryValue<T>>();
    if (this.props.cleanupInterval)
      this._timer = setInterval(this.disposeOutdatedValues, this.props.cleanupInterval);
  }

  /**
   * Destructor. Must be called to clean up the stored values
   * and other resources
   */
  public dispose() {
    if (this._timer)
      clearInterval(this._timer);

    if (this.props.cleanupHandler) {
      this._values.forEach((v) => {
        this.props.cleanupHandler!(v.value);
      });
    }
    this._values.clear();
    this.props.onDisposedAll && this.props.onDisposedAll();
  }

  /**
   * Cleans up values that are currently outdated (based
   * on their lifetime specified through [[Props]]).
   */
  public disposeOutdatedValues = () => {
    const now = (new Date()).getTime();
    const valuesToDispose: string[] = [];
    for (const entry of this._values.entries()) {
      if (!this.props.valueLifetime || ((now - entry["1"].lastUsed.getTime()) > this.props.valueLifetime))
        valuesToDispose.push(entry["0"]);
    }
    for (const id of valuesToDispose) {
      if (this.props.cleanupHandler)
        this.props.cleanupHandler(this._values.get(id)!.value);
      this._values.delete(id);
      this.props.onDisposedSingle && this.props.onDisposedSingle(id);
    }
  };

  /**
   * Get a value from the storage. If the value with the
   * specified id doesn't exist, it gets created.
   *
   * **Note:** requesting a value with this method updates
   * it's last used time.
   */
  public getValue(id: string): T {
    if (this._values.has(id)) {
      const v = this._values.get(id)!;
      v.lastUsed = new Date();
      return v.value;
    }

    const value = this.props.factory(id);
    this._values.set(id, { value, lastUsed: new Date() });
    this.props.onCreated && this.props.onCreated(id);
    return value;
  }

  /**
   * Get all values currently in this storage.
   *
   * **Note:** requesting values with this method **doesn't**
   * update their last used times.
   */
  public get values(): T[] {
    const values = new Array<T>();
    for (const v of this._values.values())
      values.push(v.value);
    return values;
  }

}
