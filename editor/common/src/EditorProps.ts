/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

/** @internal */
export const editCommandApi = {
  start: "imodeljs.editcmd.start",
  call: "imodeljs.editcmd.call",
};

/** @internal */
export type CommandError =
  "CommandNotFound" |
  "Exception" |
  "MethodNotFound" |
  "NoActiveCommand";

/** @internal */
export interface CommandResult<T> {
  error?: CommandError;
  result?: T;
}

/** @internal */
export interface PingResult {
  commandId?: string;
  version?: string;
  [propName: string]: any;
}

/** @beta */
export interface CommandMethodProps<T> {
  name: string;
  args?: T;
}

/** @beta */
export interface StartCommandProps<T> {
  commandId: string;
  args?: T;
}
