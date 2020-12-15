/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

/** @alpha */
export const editCommandApi = {
  start: "imodeljs.editcmd.start",
  call: "imodeljs.editcmd.call",
};

/** @alpha */
export type CommandError =
  "CommandNotFound" |
  "Exception" |
  "MethodNotFound" |
  "NoActiveCommand";

/** @alpha */
export interface CommandResult<T> {
  error?: CommandError;
  result?: T;
}

/** @alpha */
export interface PingResult {
  commandId?: string;
  version?: string;
  [propName: string]: any;
}

/** @alpha */
export interface CommandMethodProps<T> {
  name: string;
  args?: T;
}

/** @alpha */
export interface StartCommandProps<T> {
  commandId: string;
  args?: T;
}
