/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { PickAsyncMethods } from "@itwin/core-bentley";
import { IpcApp } from "@itwin/core-frontend";
import { BasicManipulationCommandIpc, EditCommandIpc, editorIpcStrings } from "@itwin/editor-common";

/**
 * Create a type safe Proxy object to make IPC calls from [[EditTools]] to methods of an `EditCommandIpc` interface of the current `EditCommand`.
 * @beta
 */
export function makeEditToolIpc<K extends EditCommandIpc>(): PickAsyncMethods<K> {
  return IpcApp.makeIpcFunctionProxy<K>(editorIpcStrings.channel, "callMethod");
}

/** Proxy for calling methods in `BasicManipulationCommandIpc`
 * @internal
 */
export const basicManipulationIpc = makeEditToolIpc<BasicManipulationCommandIpc>();

