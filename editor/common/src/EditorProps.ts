/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

export const editCommandApi = {
  start: "imodeljs.editcmd.start",
  call: "imodeljs.editcmd.call",
};

export type CommandError =
  "CommandNotFound" |
  "Exception" |
  "MethodNotFound" |
  "NoActiveCommand";

export interface CommandResult<T> {
  error?: CommandError;
  result?: T;
}

export interface PingResult {
  commandId?: string;
  version?: string;
  [propName: string]: any;
}

export interface CommandMethodProps<T> {
  name: string;
  args?: T;
}

export interface StartCommandProps<T> {
  commandId: string;
  args?: T;
}
