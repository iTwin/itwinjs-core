/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

/** @internal */
export class MobileEventLoop {
  private static _activeTasks = 0;
  private static _idleCallback: number | null = null;

  public static addTask() {
    ++this._activeTasks;

    if (this._idleCallback === null) {
      this._idleCallback = setInterval(() => this._idleHandler());
    }
  }

  public static removeTask() {
    --this._activeTasks;

    if (this._activeTasks === 0 && this._idleCallback !== null) {
      clearInterval(this._idleCallback);
      this._idleCallback = null;
    }
  }

  private static _idleHandler() {

  }
}
