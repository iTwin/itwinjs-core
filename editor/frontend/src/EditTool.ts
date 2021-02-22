/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { editorChannel } from "@bentley/imodeljs-editor-common";
import { IModelApp, IpcApp } from "@bentley/imodeljs-frontend";
import { DeleteElementsTool } from "./DeleteElementsTool";
import { MoveElementsTool } from "./TransformElementsTool";

/** @alpha functions to support PrimitiveTool and InputCollector sub-classes with using EditCommand. */
export class EditTools {
  private static _initialized = false;

  public static async startCommand<T>(commandId: string, iModelKey: string, ...args: any[]): Promise<T> {
    return IpcApp.callIpcChannel(editorChannel, "startCommand", commandId, iModelKey, ...args) as Promise<T>;
  }

  public static async callCommand(methodName: string, ...args: any[]): Promise<any> {
    return IpcApp.callIpcChannel(editorChannel, "callMethod", methodName, ...args);
  }

  /** Call this before using the package (e.g., before attempting to use any of its tools.)
   * To initialize when starting up your app:
   * ```ts
   *   IModelApp.startup();
   *   await EditorTools.initialize();
   * ```
   */
  public static async initialize(): Promise<void> {
    if (this._initialized)
      return;

    this._initialized = true;

    const i18n = IModelApp.i18n.registerNamespace("Editor");
    const tools = [
      DeleteElementsTool,
      MoveElementsTool,
    ];

    for (const tool of tools)
      tool.register(i18n);

    return i18n.readFinished;
  }
}
