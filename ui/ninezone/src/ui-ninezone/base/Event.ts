/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

/** Event handler.
 * @internal
 */
export type EventHandler = (...args: any[]) => void;

/** @internal */
export class EventEmitter<T extends EventHandler> implements Event<T> {
  private _handlers = new Array<T>();
  private _removedHandlers = new Map<T, true>();
  private _emitting = false;

  public add(handler: T) {
    this._handlers.push(handler);
  }

  public remove(handler: T) {
    if (this._emitting) {
      this._removedHandlers.set(handler, true);
      return;
    }
    const index = this._handlers.indexOf(handler);
    this._handlers.splice(index, 1);
  }

  public emit(...args: Parameters<T>) {
    this._emitting = true;

    for (const handler of this._handlers) {
      const removed = !!this._removedHandlers.get(handler);
      !removed && handler(...args);
    }

    this._handlers = this._handlers.filter((handler) => {
      const removed = !!this._removedHandlers.get(handler);
      return !removed;
    });
    this._removedHandlers.clear();
    this._emitting = false;
  }
}

/** @internal */
export interface Event<T extends EventHandler> {
  add(handler: T): void;
  remove(handler: T): void;
}
