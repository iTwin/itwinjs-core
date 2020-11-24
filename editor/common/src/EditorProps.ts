/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

export const editIpcPrefix = "imodeljs.edit.";

export type CommandStatus =
  "Success" |
  "CommandNotFound" |
  "NoActiveCommand" |
  "MethodNotFound";

export interface CommandResult<T> {
  status: CommandStatus;
  result?: T;
}

export interface PingResult {
  status: CommandStatus;
  commandId?: string;
  version?: string;
  [propName: string]: any;
}

export interface CallMethodProps {
  name: string;
  args?: any;
}

export interface StartCommandProps {
  commandId: string;
  args?: any;
}
