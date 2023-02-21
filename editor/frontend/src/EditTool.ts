/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { BeDuration } from "@itwin/core-bentley";
import { IModelApp, IpcApp } from "@itwin/core-frontend";
import { editorIpcStrings } from "@itwin/editor-common";

import * as UndoRedoTools from "./UndoRedoTool";
import * as DeleteElementsTool from "./DeleteElementsTool";
import * as ModifyCurveTools from "./ModifyCurveTools";
import * as ProjectLocation from "./ProjectLocation/ProjectExtentsDecoration";
import * as ProjectGeoLocation from "./ProjectLocation/ProjectGeolocation";
import * as SketchTools from "./SketchTools";
import * as SolidModelingTools from "./SolidModelingTools";
import * as SolidPrimitiveTools from "./SolidPrimitiveTools";
import * as TransformTools from "./TransformElementsTool";

/** @beta */
export namespace EditTools {
  export interface StartArgs {
    commandId: string;
    iModelKey: string;
  }
  /** handler for retries when an EditTool attempts to start but a backend command is busy and can't finish its work.
   * @param attempt the number of times this handler was previously called for this EditTool
   * @param msg the message about what's happening from the currently busy EditCommand.
   * @returns the delay (in milliseconds) before attempting again. If `undefined` use default (usually 1 second)
   */
  export type BusyRetry = (attempt: number, msg: string) => Promise<number | undefined>;
}

/**
 * Supports PrimitiveTool and InputCollector sub-classes.
 * @beta
 */
export class EditTools {
  public static readonly namespace = "Editor";
  public static readonly tools = "Editor:tools.";
  public static busyRetry?: EditTools.BusyRetry;
  private static _initialized = false;

  public static async startCommand<T>(startArg: EditTools.StartArgs, ...cmdArgs: any[]): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await (IpcApp.callIpcChannel(editorIpcStrings.channel, "startCommand", startArg.commandId, startArg.iModelKey, ...cmdArgs) as Promise<T>);
      } catch (e: any) {
        if (e.name !== editorIpcStrings.commandBusy)
          throw e; // unknown backend error
        const delay = await this.busyRetry?.(attempt++, e.message) ?? 1000;
        await BeDuration.fromMilliseconds(delay).wait();
      }
    }
  }

  /** @internal */
  public static translate(prompt: string) {
    return IModelApp.localization.getLocalizedString(this.tools + prompt);
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

    // clean up if we're being shut down
    IModelApp.onBeforeShutdown.addListener(() => this.shutdown());

    const namespacePromise = IModelApp.localization.registerNamespace(this.namespace);

    const tools = IModelApp.tools;
    tools.registerModule(UndoRedoTools, this.namespace);

    // TODO: TEMPORARY - Register tools for testing. To be moved into apps.
    tools.registerModule(ProjectLocation, this.namespace);
    tools.registerModule(ProjectGeoLocation, this.namespace);
    tools.registerModule(SketchTools, this.namespace);
    tools.registerModule(SolidModelingTools, this.namespace);
    tools.registerModule(SolidPrimitiveTools, this.namespace);
    tools.registerModule(TransformTools, this.namespace);
    tools.registerModule(DeleteElementsTool, this.namespace);
    tools.registerModule(ModifyCurveTools, this.namespace);

    return namespacePromise;
  }

  private static shutdown() {
    this._initialized = false;
  }
}
