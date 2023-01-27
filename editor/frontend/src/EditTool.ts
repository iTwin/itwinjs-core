/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { BeDuration } from "@itwin/core-bentley";
import { IModelApp, IpcApp } from "@itwin/core-frontend";
import { EditCommandBusy, editorChannel } from "@itwin/editor-common";
import { DeleteElementsTool } from "./DeleteElementsTool";
import { BreakCurveTool, ExtendCurveTool, OffsetCurveTool, RegionBooleanTool } from "./ModifyCurveTools";
import {
  ProjectLocationCancelTool, ProjectLocationHideTool, ProjectLocationSaveTool, ProjectLocationShowTool,
} from "./ProjectLocation/ProjectExtentsDecoration";
import { ProjectGeolocationMoveTool, ProjectGeolocationNorthTool, ProjectGeolocationPointTool } from "./ProjectLocation/ProjectGeolocation";
import { CreateArcTool, CreateBCurveTool, CreateCircleTool, CreateEllipseTool, CreateLineStringTool, CreateRectangleTool } from "./SketchTools";
import {
  ChamferEdgesTool, CutSolidElementsTool, DeleteSubEntitiesTool, EmbossSolidElementsTool, HollowFacesTool, ImprintSolidElementsTool,
  IntersectSolidElementsTool, LoftProfilesTool, OffsetFacesTool, RoundEdgesTool, SewSheetElementsTool, SpinFacesTool, SubtractSolidElementsTool,
  SweepAlongPathTool, SweepFacesTool, ThickenSheetElementsTool, UniteSolidElementsTool,
} from "./SolidModelingTools";
import { CreateBoxTool, CreateConeTool, CreateCylinderTool, CreateSphereTool, CreateTorusTool, ExtrudeCurveTool, RevolveCurveTool } from "./SolidPrimitiveTools";
import { CopyElementsTool, MoveElementsTool, RotateElementsTool } from "./TransformElementsTool";
import { RedoTool, UndoAllTool, UndoTool } from "./UndoRedoTool";

/** Options for [[EditTools.initialize]].
 * @beta
 */
export interface EditorOptions {
  /** If true, all tools will be registered. */
  registerAllTools?: true | undefined;
  /** If true, tools for undo/redo will be registered. */
  registerUndoRedoTools?: true | undefined;
  /** If true, tools for updating the project extents and geolocation will be registered. */
  registerProjectLocationTools?: true | undefined;
  /** If true, tools for basic manipulation will be registered. */
  registerBasicManipulationTools?: true | undefined;
  /** If true, tools for sketching will be registered. */
  registerSketchTools?: true | undefined;
  /** If true, tools for solid modeling will be registered. */
  registerSolidModelingTools?: true | undefined;
}

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
        return await (IpcApp.callIpcChannel(editorChannel, "startCommand", startArg.commandId, startArg.iModelKey, ...cmdArgs) as Promise<T>);
      } catch (e: any) {
        if (e.name !== "EditCommandBusy")
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
  public static async initialize(options?: EditorOptions): Promise<void> {
    if (this._initialized)
      return;

    // NOTE: We should clear the active command whenever a new PrimitiveTool is installed.
    //       As tool run/install isn't currently async ToolAdmin.activeToolChanged can't be used at this time.
    //       The active command will be cleared whenever another edit tool calls startCommand.
    this._initialized = true;

    // clean up if we're being shut down
    IModelApp.onBeforeShutdown.addListener(() => this.shutdown());

    const namespacePromise = IModelApp.localization.registerNamespace(this.namespace);
    const registerAllTools = options?.registerAllTools;

    // Register requested tools...
    if (registerAllTools || options?.registerUndoRedoTools) {
      const tools = [
        UndoAllTool,
        UndoTool,
        RedoTool,
      ];

      for (const tool of tools)
        tool.register(this.namespace);
    }

    if (registerAllTools || options?.registerProjectLocationTools) {
      const tools = [
        ProjectLocationShowTool,
        ProjectLocationHideTool,
        ProjectLocationCancelTool,
        ProjectLocationSaveTool,
        ProjectGeolocationMoveTool,
        ProjectGeolocationPointTool,
        ProjectGeolocationNorthTool,
      ];

      for (const tool of tools)
        tool.register(this.namespace);
    }

    if (registerAllTools || options?.registerBasicManipulationTools) {
      const tools = [
        DeleteElementsTool,
        MoveElementsTool,
        CopyElementsTool,
        RotateElementsTool,
      ];

      for (const tool of tools)
        tool.register(this.namespace);
    }

    if (registerAllTools || options?.registerSketchTools) {
      const tools = [
        CreateArcTool,
        CreateBCurveTool,
        CreateCircleTool,
        CreateEllipseTool,
        CreateLineStringTool,
        CreateRectangleTool,
        BreakCurveTool,
        ExtendCurveTool,
        OffsetCurveTool,
      ];

      for (const tool of tools)
        tool.register(this.namespace);
    }

    if (registerAllTools || options?.registerSolidModelingTools) {
      const tools = [
        CreateSphereTool,
        CreateCylinderTool,
        CreateConeTool,
        CreateBoxTool,
        CreateTorusTool,
        ExtrudeCurveTool,
        RevolveCurveTool,
        RegionBooleanTool,
        UniteSolidElementsTool,
        SubtractSolidElementsTool,
        IntersectSolidElementsTool,
        SewSheetElementsTool,
        ThickenSheetElementsTool,
        CutSolidElementsTool,
        EmbossSolidElementsTool,
        ImprintSolidElementsTool,
        SweepAlongPathTool,
        LoftProfilesTool,
        OffsetFacesTool,
        HollowFacesTool,
        SweepFacesTool,
        SpinFacesTool,
        RoundEdgesTool,
        ChamferEdgesTool,
        DeleteSubEntitiesTool,
      ];

      for (const tool of tools)
        tool.register(this.namespace);
    }

    return namespacePromise;
  }

  private static shutdown() {
    this._initialized = false;
  }
}
