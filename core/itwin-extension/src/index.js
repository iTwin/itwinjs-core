const globalSymbol = Symbol.for("itwin.core.frontend.globals");
const ext = globalThis[globalSymbol].getExtensionApi(import.meta.url);

// re-export tool stuff
export const {
  InteractiveTool,
  PrimitiveTool,
  ViewTool,
  Tool,

  ToolAssistance,
  BeButtonEvent,
  ViewRect,
  Pixel,
  LocateResponse,

  // FIXME
  IModelExtension,
} = ext.exports;

// re-export enums
export const {
  ACSDisplayOptions,
  ACSType,
  ActivityMessageEndReason,
  BeButton,
  BeModifierKeys,
  ClipEventType,
  ContextRotationId,
  CoordinateLockOverrides,
  CoordSource,
  CoordSystem,
  DepthPointSource,
  EventHandled,
  FlashMode,
  FrontendLoggerCategory,
  GraphicType,
  HitDetailType,
  HitGeomType,
  HitParentGeomType,
  HitPriority,
  HitSource,
  InputSource,
  KeyinParseError,
  LocateAction,
  LocateFilterStatus,
  ManipulatorToolEvent,
  MessageBoxIconType,
  MessageBoxType,
  MessageBoxValue,
  OutputMessageAlert,
  OutputMessagePriority,
  OutputMessageType,
  ParseAndRunResult,
  SelectionMethod,
  SelectionMode,
  SelectionProcessing,
  SelectionSetEventType,
  SnapHeat,
  SnapMode,
  SnapStatus,
  StandardViewId,
  StartOrResume,
  TextureTransparency,
  TileBoundingBoxes,
  TileGraphicType,
  TileLoadPriority,
  TileLoadStatus,
  TileTreeLoadStatus,
  TileVisibility,
  ToolAssistanceImage,
  ToolAssistanceInputMethod,
  UniformType,
  VaryingType,
  ViewStatus,
  ViewUndoEvent,
} = ext.exports;

// re-export commmon
export const { ColorDef } = ext.exports;

// export extension stuff
export const { registerTool } = ext.api;
