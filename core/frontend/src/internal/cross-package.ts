/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

export { _callIpcChannel, _scheduleScriptReference } from "../common/internal/Symbols.js";
export { AnimationNodeId } from "../common/internal/render/AnimationNodeId.js";
export { GltfDataType, type GltfMeshPrimitive } from "../common/gltf/GltfSchema.js";
export { OnScreenTarget, Target } from "./render/webgl/Target.js";
export { PerformanceMetrics } from "./render/webgl/PerformanceMetrics.js";
export { type GLTimerResult, RenderDiagnostics, type RenderSystemDebugControl } from "./render/RenderSystemDebugControl.js";
export { formatAnimationBranchId } from "./render/AnimationBranchState.js";
export { PrimitiveVisibility, type RenderTargetDebugControl } from "./render/RenderTargetDebugControl.js";

// Used by frontend-tiles, map-layers-formats, frontend-dev-tools
export {
 acquireImdlDecoder,
 appendQueryParams,
 ArcGisErrorCode,
 ArcGisGeometryReaderJSON,
 type ArcGisGetServiceJsonArgs,
 ArcGISImageryProvider,
 type ArcGISServiceMetadata,
 ArcGisUtilities,
 type ArcGisValidateSourceArgs,
 createSpatialTileTreeReferences,
 deflateCoordinates,
 type FeatureAttributeDrivenSymbology,
 FeatureGeometryBaseRenderer,
 type FeatureGeometryRenderer,
 FeatureGraphicsRenderer,
 type FeatureSymbolizedRenderer,
 type FeatureSymbologyRenderer,
 GltfReader,
 type GltfReaderArgs,
 type GltfReaderResult,
 type GraphicsGeometryRenderer,
 ImageryMapTileTree,
 type ImdlDecoder,
 ImdlReader,
 type MapLayerInfoFromTileTree,
 MapTileTreeReference,
 RealityModelTileUtils,
 RealityTileLoader,
 SpatialTileTreeReferences,
 type WGS84Extent,
 WmsUtilities,
} from "../tile/internal.js";

// Used by display-test-app which currently builds using both ESModules and CommonJS.
// Remove once CommonJS is dropped.
export { DebugShaderFile } from "./render/RenderSystemDebugControl.js";
export { IModelTileTree } from "./tile/IModelTileTree.js";
