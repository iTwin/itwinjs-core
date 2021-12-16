/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { editorChannel } from "@itwin/editor-common";
import { IModelApp, IpcApp } from "@itwin/core-frontend";
import { DeleteElementsTool } from "./DeleteElementsTool";
import { ChamferEdgesTool, CutSolidElementsTool, DeleteSubEntitiesTool, EmbossSolidElementsTool, HollowFacesTool, ImprintSolidElementsTool, IntersectSolidElementsTool, LoftProfilesTool, OffsetFacesTool, RoundEdgesTool, SewSheetElementsTool, SpinFacesTool, SubtractSolidElementsTool, SweepAlongPathTool, SweepFacesTool, ThickenSheetElementsTool, UniteSolidElementsTool } from "./SolidModelingTools";
import { ProjectLocationCancelTool, ProjectLocationHideTool, ProjectLocationSaveTool, ProjectLocationShowTool } from "./ProjectLocation/ProjectExtentsDecoration";
import { ProjectGeolocationMoveTool, ProjectGeolocationNorthTool, ProjectGeolocationPointTool } from "./ProjectLocation/ProjectGeolocation";
import { CreateArcTool, CreateBCurveTool, CreateCircleTool, CreateEllipseTool, CreateLineStringTool, CreateRectangleTool } from "./SketchTools";
import { MoveElementsTool, RotateElementsTool } from "./TransformElementsTool";
import { RedoTool, UndoAllTool, UndoTool } from "./UndoRedoTool";

/** @alpha Options for [[EditTools.initialize]]. */
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

/** @alpha functions to support PrimitiveTool and InputCollector sub-classes with using EditCommand. */
export class EditTools {
  public static namespace = "Editor";
  public static tools = "Editor:tools.";
  private static _initialized = false;

  public static async startCommand<T>(commandId: string, iModelKey: string, ...args: any[]): Promise<T> {
    return IpcApp.callIpcChannel(editorChannel, "startCommand", commandId, iModelKey, ...args) as Promise<T>;
  }

  public static async callCommand(methodName: string, ...args: any[]): Promise<any> {
    return IpcApp.callIpcChannel(editorChannel, "callMethod", methodName, ...args);
  }

  /** @internal */
  public static translate(prompt: string) { return IModelApp.localization.getLocalizedString(this.tools + prompt); }

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
      ];

      for (const tool of tools)
        tool.register(this.namespace);
    }

    if (registerAllTools || options?.registerSolidModelingTools) {
      const tools = [
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
}
