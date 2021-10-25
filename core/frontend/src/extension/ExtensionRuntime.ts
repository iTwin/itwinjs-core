/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/naming-convention */

import { ContextRotationId } from "../AccuDraw";
import { ACSDisplayOptions, ACSType } from "../AuxCoordSys";
import { CoordSystem } from "../CoordSystem";
import { LocateAction, LocateFilterStatus, LocateResponse, SnapStatus } from "../ElementLocateManager";
import { FlashMode } from "../FlashSettings";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";
import { HitDetailType, HitGeomType, HitParentGeomType, HitPriority, HitSource, SnapHeat, SnapMode } from "../HitDetail";
import { ActivityMessageEndReason, MessageBoxIconType, MessageBoxType, MessageBoxValue, OutputMessageAlert, OutputMessagePriority, OutputMessageType } from "../NotificationManager";
import { SelectionSetEventType } from "../SelectionSet";
import { StandardViewId } from "../StandardView";
import { ViewRect } from "../ViewRect";
import { ViewStatus } from "../ViewStatus";
import { DepthPointSource, ViewUndoEvent } from "../Viewport";
import { GraphicType } from "../render/GraphicBuilder";
import { Pixel } from "../render/Pixel";
import { TextureTransparency } from "../render/RenderTexture";
import { UniformType, VaryingType } from "../render/ScreenSpaceEffectBuilder";
import { TileBoundingBoxes, TileGraphicType, TileLoadPriority, TileLoadStatus, TileTreeLoadStatus, TileVisibility } from "../tile/internal";
import { ClipEventType } from "../tools/ClipViewTool";
import { PrimitiveTool } from "../tools/PrimitiveTool";
import { SelectionMethod, SelectionMode, SelectionProcessing } from "../tools/SelectTool";
import { BeButton, BeButtonEvent, BeModifierKeys, CoordinateLockOverrides, CoordSource, EventHandled, InputSource, InteractiveTool, KeyinParseError, ParseAndRunResult, Tool } from "../tools/Tool";
import { ManipulatorToolEvent, StartOrResume } from "../tools/ToolAdmin";
import { ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod } from "../tools/ToolAssistance";
import { ViewTool } from "../tools/ViewTool";

import { ColorDef } from "@itwin/core-common";
import { ExtensionImpl } from "./ExtensionImpl";
import { ExtensionHost } from "./ExtensionHost";

const globalSymbol = Symbol.for("itwin.core.frontend.globals");
if ((globalThis as any)[globalSymbol])
  throw new Error("Multiple @itwin/core-frontend imports detected!");

const getExtensionApi = (id: string) => {
  return {
    exports: {
      InteractiveTool, PrimitiveTool, ViewTool, Tool,

      ToolAssistance, BeButtonEvent, ViewRect, Pixel, LocateResponse,

      ColorDef,

      ExtensionHost,

      ACSDisplayOptions, ACSType, ActivityMessageEndReason, BeButton, BeModifierKeys, ClipEventType, ContextRotationId, CoordinateLockOverrides,
      CoordSource, CoordSystem, DepthPointSource, EventHandled, FlashMode, FrontendLoggerCategory, GraphicType, HitDetailType, HitGeomType,
      HitParentGeomType, HitPriority, HitSource, InputSource, KeyinParseError, LocateAction, LocateFilterStatus, ManipulatorToolEvent,
      MessageBoxIconType, MessageBoxType, MessageBoxValue, OutputMessageAlert, OutputMessagePriority, OutputMessageType, ParseAndRunResult,
      SelectionMethod, SelectionMode, SelectionProcessing, SelectionSetEventType, SnapHeat, SnapMode, SnapStatus, StandardViewId, StartOrResume,
      TextureTransparency, TileBoundingBoxes, TileGraphicType, TileLoadPriority, TileLoadStatus, TileTreeLoadStatus, TileVisibility,
      ToolAssistanceImage, ToolAssistanceInputMethod, UniformType, VaryingType, ViewStatus, ViewUndoEvent,
    },
    api: new ExtensionImpl(id),
  };
};

(globalThis as any)[globalSymbol] = {
  getExtensionApi,
};
