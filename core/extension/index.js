/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
const globalSymbol = Symbol.for("itwin.core.frontend.globals");
const ext = globalThis[globalSymbol].getExtensionApi("import.meta.url");

// re-export tool
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
  EditManipulator,
  AccuDrawHintBuilder,
  EmphasizeElements,
  FeatureSymbology,
  GraphicBranch,
  NotifyMessageDetails,

  ExtensionHost,
} = ext.exports;

// re-export frontend items
export const {
  BingElevationProvider,
  BingLocationProvider,
  InputCollector,
  FrustumAnimator,
  GlobeAnimator,
  MarginPercent,
  Marker,
  Cluster
} = ext.exports;

// re-export functions
export const {
  getCompressedJpegFromCanvas,
  getImageSourceFormatForMimeType,
  getImageSourceMimeType,
  imageBufferToBase64EncodedPng,
  imageBufferToCanvas,
  imageBufferToPngDataUrl,
  imageElementFromImageSource,
  imageElementFromUrl,
  queryTerrainElevationOffset,
  readElementGraphics,
  canvasToImageBuffer,
  canvasToResizedCanvasWithBars,
  extractImageSourceDimensions
} = ext.exports;

// re-export enums
export const {
  // core-frontend:
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
  // core-common:
  BackgroundFill,
  BackgroundMapType,
  BatchType,
  BisCodeSpec,
  BriefcaseIdValue,
  ChangedValueState,
  ChangeOpCode,
  ChangesetType,
  ColorByName,
  CommonLoggerCategory,
  ECSqlSystemProperty,
  ECSqlValueType,
  ElementGeometryOpcode,
  FeatureOverrideType,
  FillDisplay,
  FillFlags,
  FontType,
  GeoCoordStatus,
  GeometryClass,
  GeometryStreamFlags,
  GeometrySummaryVerbosity,
  GlobeMode,
  GridOrientationType,
  HSVConstants,
  ImageBufferFormat,
  ImageSourceFormat,
  LinePixels,
  MassPropertiesOperation,
  MonochromeMode,
  Npc,
  PlanarClipMaskMode,
  PlanarClipMaskPriority,
  QueryRowFormat,
  Rank,
  RenderMode,
  SectionType,
  SpatialClassifierInsideDisplay,
  SpatialClassifierOutsideDisplay,
  SyncMode,
  TerrainHeightOriginMode,
  TextureMapUnits,
  ThematicDisplayMode,
  ThematicGradientColorScheme,
  ThematicGradientMode,
  TxnAction,
  TypeOfChange,
} = ext.exports;

// re-export commmon
export const { ColorDef } = ext.exports;

// export extension stuff
export const { registerTool } = ext.api;
