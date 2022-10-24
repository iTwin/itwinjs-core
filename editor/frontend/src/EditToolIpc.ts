/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { PickAsyncMethods } from "@itwin/core-bentley";
import { IpcApp } from "@itwin/core-frontend";
import { BasicManipulationCommandIpc, EditCommandIpc, editorChannel, SolidModelingCommandIpc } from "@itwin/editor-common";

/** Create a type safe Proxy object to make IPC calls to methods of the current `EditCommand`
 * @alpha
 */
export function makeEditToolIpc<K extends EditCommandIpc>(): PickAsyncMethods<K> {
  return new Proxy({} as PickAsyncMethods<K>, {
    get(_target, methodName: string) {
      return async (...args: any[]) =>
        IpcApp.callIpcChannel(editorChannel, "callMethod", methodName, ...args);
    },
  });
}

/** Proxy for calling methods in `BasicManipulationCommandIpc`
 * @alpha
 */
export const basicManipulationIpc = makeEditToolIpc<BasicManipulationCommandIpc>();
/** Proxy for calling methods in `SolidModelingCommandIpc`
* @alpha
*/
export const solidModelingIpc = makeEditToolIpc<SolidModelingCommandIpc>();
