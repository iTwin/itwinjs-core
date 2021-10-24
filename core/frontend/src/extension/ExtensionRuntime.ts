/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  IModelApp, InteractiveTool,
  PrimitiveTool, Tool, ViewTool,

  ToolAssistance, BeButtonEvent, ViewRect, Pixel, LocateResponse,

  // FIXME
  IModelApp as IModelExtension,

  // ALL enums:
  ACSDisplayOptions, ACSType, ActivityMessageEndReason, BeButton, BeModifierKeys, ClipEventType, ContextRotationId, CoordinateLockOverrides,
  CoordSource, CoordSystem, DepthPointSource, EventHandled, FlashMode, FrontendLoggerCategory, GraphicType, HitDetailType, HitGeomType,
  HitParentGeomType, HitPriority, HitSource, InputSource, KeyinParseError, LocateAction, LocateFilterStatus, ManipulatorToolEvent,
  MessageBoxIconType, MessageBoxType, MessageBoxValue, OutputMessageAlert, OutputMessagePriority, OutputMessageType, ParseAndRunResult,
  SelectionMethod, SelectionMode, SelectionProcessing, SelectionSetEventType, SnapHeat, SnapMode, SnapStatus, StandardViewId, StartOrResume,
  TextureTransparency, TileBoundingBoxes, TileGraphicType, TileLoadPriority, TileLoadStatus, TileTreeLoadStatus, TileVisibility,
  ToolAssistanceImage, ToolAssistanceInputMethod, UniformType, VaryingType, ViewStatus, ViewUndoEvent, ToolType
} from "../core-frontend";

import { ColorDef } from "@itwin/core-common";
import { ExtensionImpl } from "./ExtensionImpl";

const globalSymbol = Symbol.for("itwin.core.frontend.globals");
if ((globalThis as any)[globalSymbol])
  throw new Error("Multiple @itwin/core-frontend imports detected!");

const getExtensionApi = (id: string) => {
  return {
    exports: {
      InteractiveTool, PrimitiveTool, ViewTool, Tool,

      ToolAssistance, BeButtonEvent, ViewRect, Pixel, LocateResponse,

      ColorDef,

      // FIXME:
      IModelExtension,

      ACSDisplayOptions, ACSType, ActivityMessageEndReason, BeButton, BeModifierKeys, ClipEventType, ContextRotationId, CoordinateLockOverrides,
      CoordSource, CoordSystem, DepthPointSource, EventHandled, FlashMode, FrontendLoggerCategory, GraphicType, HitDetailType, HitGeomType,
      HitParentGeomType, HitPriority, HitSource, InputSource, KeyinParseError, LocateAction, LocateFilterStatus, ManipulatorToolEvent,
      MessageBoxIconType, MessageBoxType, MessageBoxValue, OutputMessageAlert, OutputMessagePriority, OutputMessageType, ParseAndRunResult,
      SelectionMethod, SelectionMode, SelectionProcessing, SelectionSetEventType, SnapHeat, SnapMode, SnapStatus, StandardViewId, StartOrResume,
      TextureTransparency, TileBoundingBoxes, TileGraphicType, TileLoadPriority, TileLoadStatus, TileTreeLoadStatus, TileVisibility,
      ToolAssistanceImage, ToolAssistanceInputMethod, UniformType, VaryingType, ViewStatus, ViewUndoEvent
    },
    api: new ExtensionImpl(id),
  }
}

(globalThis as any)[globalSymbol] = {
  getExtensionApi,
};