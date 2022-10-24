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

export function makeEditorIpcProxy<K extends EditCommandIpc>(): PickAsyncMethods<K> {
  return new Proxy({} as PickAsyncMethods<K>, {
    get(_target, methodName: string) {
      return async (...args: any[]) =>
        IpcApp.callIpcChannel(editorChannel, "callMethod", methodName, ...args);
    },
  });
}

export const solidModelingIpc = makeEditorIpcProxy<SolidModelingCommandIpc>();
export const basicManipulationIpc = makeEditorIpcProxy<BasicManipulationCommandIpc>();
