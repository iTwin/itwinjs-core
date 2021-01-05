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

/**
 * The result from an EditCommand passed from the backend to the frontend, where exceptions can't be used.
 * There can either be a result member or an error value, but never both.
 * @alpha
 */
export type CommandResult<T> = { result?: T, error?: never } | { error: CommandError, details?: any, result?: never };

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
  iModelKey: string;
  args?: T;
}
