/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

// All of the following are exported strictly for core-full-stack-tests.
// Most if not all of those tests really should be moved to core-frontend and these exports removed.
export { PerformanceMetrics } from "./render/webgl/PerformanceMetrics.js";
export { OffScreenTarget, OnScreenTarget, Target } from "./render/webgl/Target.js";
export { Batch, Branch, Graphic, GraphicOwner, GraphicsArray, WorldDecorations } from "./render/webgl/Graphic.js";
export { Primitive } from "./render/webgl/Primitive.js";
export { MeshGraphic } from "./render/webgl/Mesh.js";
export { PolylineGeometry } from "./render/webgl/Polyline.js";
export { RenderOrder } from "./render/webgl/RenderFlags.js";
export { FrameBuffer } from "./render/webgl/FrameBuffer.js";
export { ExternalTextureLoader, ExternalTextureRequest, Texture2DHandle, TextureHandle } from "./render/webgl/Texture.js";
export { FeatureOverrides } from "./render/webgl/FeatureOverrides.js";
export { GL } from "./render/webgl/GL.js";
