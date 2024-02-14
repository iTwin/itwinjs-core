/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { assert, IDisposable } from "@itwin/core-bentley";
import { PresentationError, PresentationStatus } from "@itwin/presentation-common";

/**
 * Configuration properties for [[TemporaryStorage]].
 * @internal
 */
export interface TemporaryStorageProps<T> {
  /** A method that's called for every value before it's removed from storage */
  cleanupHandler?: (id: string, value: T, reason: "timeout" | "dispose" | "request") => void;

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
   * unused before it's cleaned up.
   *
   * `undefined` means the values may be kept unused in the storage indefinitely.
   * `0` means the values are removed from the storage on every cleanup (either manual
   * call to [[TemporaryStorage.disposeOutdatedValues]] or scheduled (controlled
   * by [[cleanupInterval]])).
   */
  unusedValueLifetime?: number;

  /**
   * The maximum period of time which the value should be kept in storage
   * before it's cleaned up. The time is measured from the moment the value is added
   * to the storage.
   *
   * `undefined` means the values may be kept indefinitely. `0` means they're removed
   * up on every cleanup (either manual call to [[TemporaryStorage.disposeOutdatedValues]]
   * or scheduled (controlled by [[cleanupInterval]])).
   */
  maxValueLifetime?: number;
}

/** Value with know last used time */
interface TemporaryValue<T> {
  created: Date;
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
  private _timer?: NodeJS.Timeout;
  protected _values: Map<string, TemporaryValue<T>>;
  public readonly props: TemporaryStorageProps<T>;

  /**
   * Constructor. Creates the storage using supplied params.
   */
  constructor(props: TemporaryStorageProps<T>) {
    this.props = props;
    this._values = new Map<string, TemporaryValue<T>>();
    if (this.props.cleanupInterval) {
      this._timer = setInterval(this.disposeOutdatedValues, this.props.cleanupInterval);
    }
  }

  /**
   * Destructor. Must be called to clean up the stored values
   * and other resources
   */
  public dispose() {
    if (this._timer) {
      clearInterval(this._timer);
    }

    if (this.props.cleanupHandler) {
      this._values.forEach((v, id) => {
        this.props.cleanupHandler!(id, v.value, "dispose");
      });
    }
    this._values.clear();
    this.props.onDisposedAll && this.props.onDisposedAll();
  }

  /**
   * Cleans up values that are currently outdated (based
   * on their max and unused value lifetimes specified through [[Props]]).
   */
  public disposeOutdatedValues = () => {
    const now = new Date().getTime();
    const valuesToDispose: string[] = [];
    for (const [key, entry] of this._values.entries()) {
      if (this.props.maxValueLifetime !== undefined) {
        if (this.props.maxValueLifetime === 0 || now - entry.created.getTime() > this.props.maxValueLifetime) {
          valuesToDispose.push(key);
          continue;
        }
      }
      if (this.props.unusedValueLifetime !== undefined) {
        if (this.props.unusedValueLifetime === 0 || now - entry.lastUsed.getTime() > this.props.unusedValueLifetime) {
          valuesToDispose.push(key);
          continue;
        }
      }
    }
    for (const id of valuesToDispose) {
      this.deleteExistingEntry(id, true);
    }
  };

  private deleteExistingEntry(id: string, isTimeout: boolean) {
    assert(this._values.has(id));
    this.props.cleanupHandler && this.props.cleanupHandler(id, this._values.get(id)!.value, isTimeout ? "timeout" : "request");
    this._values.delete(id);
    this.props.onDisposedSingle && this.props.onDisposedSingle(id);
  }

  /**
   * Get a value from the storage.
   *
   * **Note:** requesting a value with this method updates it's last used time.
   */
  public getValue(id: string): T | undefined {
    if (this._values.has(id)) {
      const v = this._values.get(id)!;
      v.lastUsed = new Date();
      return v.value;
    }
    return undefined;
  }

  public notifyValueUsed(id: string) {
    const entry = this._values.get(id);
    // istanbul ignore else
    if (entry) {
      entry.lastUsed = new Date();
    }
  }

  /**
   * Adds a value into the storage.
   * @throws An error when trying to add a value with ID that's already stored in the storage.
   */
  public addValue(id: string, value: T) {
    if (this._values.has(id)) {
      throw new PresentationError(PresentationStatus.InvalidArgument, `A value with given ID "${id}" already exists in this storage.`);
    }
    this._values.set(id, { value, created: new Date(), lastUsed: new Date() });
  }

  /** Deletes a value with given id. */
  public deleteValue(id: string) {
    // istanbul ignore else
    if (this._values.has(id)) {
      this.deleteExistingEntry(id, false);
    }
  }

  /**
   * Get all values currently in this storage.
   *
   * **Note:** requesting values with this method **doesn't**
   * update their last used times.
   */
  public get values(): T[] {
    const values = new Array<T>();
    for (const v of this._values.values()) {
      values.push(v.value);
    }
    return values;
  }
}

/**
 * Configuration properties for [[FactoryBasedTemporaryStorage]].
 * @internal
 */
export interface FactoryBasedTemporaryStorageProps<T> extends TemporaryStorageProps<T> {
  /** A factory method that creates a stored value given it's identifier */
  factory: (id: string, onValueUsed: () => void) => T;
}

/**
 * Storage for values that get removed from it after being unused (not-requested
 * for a specified amount of time).
 *
 * @internal
 */
export class FactoryBasedTemporaryStorage<T> extends TemporaryStorage<T> {
  public override readonly props: FactoryBasedTemporaryStorageProps<T>;

  /**
   * Constructor. Creates the storage using supplied params.
   */
  constructor(props: FactoryBasedTemporaryStorageProps<T>) {
    super(props);
    this.props = props;
  }

  /**
   * Get a value from the storage. If the value with the specified id
   * doesn't exist, it gets created.
   *
   * **Note:** requesting a value with this method updates it's last used time.
   */
  public override getValue(id: string): T {
    const existingValue = super.getValue(id);
    if (existingValue) {
      return existingValue;
    }

    const value = this.props.factory(id, () => this.notifyValueUsed(id));
    this.addValue(id, value);
    return value;
  }
}
