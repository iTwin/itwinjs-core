/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

// All of the following are exported strictly for core-full-stack-tests.
// Most if not all of those tests really should be moved to core-frontend and these exports removed.
export { PerformanceMetrics } from "./render/webgl/PerformanceMetrics";
export { OffScreenTarget, OnScreenTarget, Target } from "./render/webgl/Target";
export { Batch, Branch, Graphic, GraphicOwner, GraphicsArray, WorldDecorations } from "./render/webgl/Graphic";
export { Primitive } from "./render/webgl/Primitive";
export { MeshGraphic } from "./render/webgl/Mesh";
export { PolylineGeometry } from "./render/webgl/Polyline";
export { RenderOrder } from "./render/webgl/RenderFlags";
export { FrameBuffer } from "./render/webgl/FrameBuffer";
export { ExternalTextureLoader, ExternalTextureRequest, Texture2DHandle, TextureHandle } from "./render/webgl/Texture";
export { FeatureOverrides } from "./render/webgl/FeatureOverrides";
export { GL } from "./render/webgl/GL";
