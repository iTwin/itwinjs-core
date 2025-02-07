/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

export { _callIpcChannel, _scheduleScriptReference } from "../common/internal/Symbols";
export { AnimationNodeId } from "../common/internal/render/AnimationNodeId";
export { GltfDataType, type GltfMeshPrimitive } from "../common/gltf/GltfSchema";
export { OnScreenTarget, Target } from "./render/webgl/Target";
export { PerformanceMetrics } from "./render/webgl/PerformanceMetrics";
export { type GLTimerResult, RenderDiagnostics, type RenderSystemDebugControl } from "./render/RenderSystemDebugControl";
export { formatAnimationBranchId } from "./render/AnimationBranchState";
export { PrimitiveVisibility, type RenderTargetDebugControl } from "./render/RenderTargetDebugControl";

// Used by frontend-tiles, map-layers-formats, frontend-dev-tools
export {
 acquireImdlDecoder,
 appendQueryParams,
 ArcGisErrorCode,
 ArcGisGeometryReaderJSON,
 ArcGisGetServiceJsonArgs,
 ArcGISImageryProvider,
 ArcGISServiceMetadata,
 ArcGisUtilities,
 ArcGisValidateSourceArgs,
 createSpatialTileTreeReferences,
 deflateCoordinates,
 FeatureAttributeDrivenSymbology,
 FeatureGeometryBaseRenderer,
 FeatureGeometryRenderer,
 FeatureGraphicsRenderer,
 FeatureSymbolizedRenderer,
 FeatureSymbologyRenderer,
 GltfReader,
 GltfReaderArgs,
 GltfReaderResult,
 GraphicsGeometryRenderer,
 ImageryMapTileTree,
 ImdlDecoder,
 MapLayerInfoFromTileTree,
 MapTileTreeReference,
 RealityModelTileUtils,
 RealityTileLoader,
 SpatialTileTreeReferences,
 WGS84Extent,
 WmsUtilities,
} from "../tile/internal";
