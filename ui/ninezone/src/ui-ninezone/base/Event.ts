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

  public add(handler: T) {
    this._handlers.push(handler);
  }

  public remove(handler: T) {
    const index = this._handlers.indexOf(handler);
    this._handlers.splice(index, 1);
  }

  public emit(...args: Parameters<T>) {
    for (const handler of this._handlers) {
      handler(...args);
    }
  }
}

/** @internal */
export interface Event<T extends EventHandler> {
  add(handler: T): void;
  remove(handler: T): void;
}
