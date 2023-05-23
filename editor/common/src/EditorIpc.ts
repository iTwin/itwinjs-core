/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

/** @internal */
export const editorIpcStrings = {
  channel: "itwinjs-core/editor",
  commandBusy: "EditCommandBusy",
} as const;

/**
 * Interface called from frontend `EditTool`s to start and drive the active `EditCommand` on the backend.
 * @beta
 */
export interface EditorIpc {

  /** Start a new instance of an `EditCommand` on the backend, and then call its `onStart` method.
   * @param commandId the Id of a registered `EditCommand` on the backend. If commandId === "", the current command is
   * requested to finish but no new EditCommand is started.
   * @param iModelKey the key that identifies the iModel that the EditCommand modifies.
   * @param args arguments passed to the constructor of the new `EditCommand`
   * @return the value returned by the new `EditCommand`'s `onStart` method.
   * @note The current `EditCommand` (if one is active) is asked to  finish and clean up its operation via `EditCommand.requestFinish`
   * before the new `EditCommand` is constructed. If it cannot finish immediately, it may return a string that identifies
   * the work it is performing for `EditTools.busyHandler` to retry and/or display.
   */
  startCommand: (commandId: string, iModelKey: string, ...args: any[]) => Promise<any>;

  /** Call a method on the currently active `EditCommand` and return its value.
   * @param name the name of the method to invoke.
   * @param args arguments passed to the method.
   * @note throws an exception if there is no active `EditCommand`, or if the active EditCommand does not implement the supplied method. */
  callMethod: (name: string, ...args: any[]) => Promise<any>;
}

/**
 * Interface implemented by all backend `EditCommands`.
 * @beta
 */
export interface EditCommandIpc {
  /** Identify the current `EditCommand`'s name and version, optionally returning additional properties that describe its state. */
  ping: () => Promise<{ commandId: string, version: string, [propName: string]: any }>;
}
