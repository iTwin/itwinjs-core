/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Export all types here.
export * from "./common_types";
export * from "./frontend_types";

// Export all real values here.
export {
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
  BingElevationProvider,
  BingLocationProvider,
  InputCollector,
  FrustumAnimator,
  GlobeAnimator,
  MarginPercent,
  Marker,
  Cluster,
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
  extractImageSourceDimensions,
} from "@itwin/core-frontend";

export { ColorDef } from "@itwin/core-common";

export function registerTool(t: typeof import("@itwin/core-frontend").Tool): Promise<void>
