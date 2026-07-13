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
 type ArcGisGetServiceJsonArgs,
 ArcGISImageryProvider,
 type ArcGISServiceMetadata,
 ArcGisUtilities,
 type ArcGisValidateSourceArgs,
 collectMaskRefs,
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
 LayerTileTreeHandler, type MapLayerTreeSetting, LayerTileTreeReferenceHandler
} from "../tile/internal";
export { GoogleMapsDecorator, LogoDecoration } from "./GoogleMapsDecorator";

// Used by display-test-app which currently builds using both ESModules and CommonJS.
// Remove once CommonJS is dropped.
export { DebugShaderFile } from "./render/RenderSystemDebugControl";
export { IModelTileTree } from "./tile/IModelTileTree";

// Used by cesium-renderer
export { type RenderPlan } from "./render/RenderPlan";
export { type RenderAreaPattern } from "./render/RenderAreaPattern";
export { type RenderGeometry } from "./render/RenderGeometry";
export { _implementationProhibited } from "../common/internal/Symbols";
