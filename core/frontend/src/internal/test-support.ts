/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Test
 */

// These exports are strictly for core-full-stack-tests. They are kept in a separate internal
// entry point so test-only implementation details do not become part of core-frontend's public
// entry point.
import { _accumulator } from "../common/internal/Symbols";
import { DisplayParams } from "../common/internal/render/DisplayParams";
import { Geometry } from "../common/internal/render/GeometryPrimitives";
import { SurfaceType } from "../common/internal/render/SurfaceParams";
import { parseImdlDocument } from "../common/imdl/ParseImdlDocument";
import type { ImdlModel } from "../common/imdl/ImdlModel";
import { MockRender } from "./render/MockRender";
import { PrimitiveBuilder } from "./render/PrimitiveBuilder";
// webgl.ts is the existing test-only export barrel; importing it preserves its deliberate export order.
// eslint-disable-next-line @itwin/no-internal-barrel-imports
import {
  Batch, Branch, ExternalTextureLoader, type ExternalTextureRequest, FeatureOverrides, FrameBuffer, GL, Graphic, GraphicOwner,
  GraphicsArray, MeshGraphic, OffScreenTarget, OnScreenTarget, PerformanceMetrics, PolylineGeometry, Primitive, Target,
  Texture2DHandle, TextureHandle, WorldDecorations,
} from "./webgl";

export {
  _accumulator, Batch, Branch, DisplayParams, ExternalTextureLoader, FeatureOverrides, FrameBuffer, GL, Geometry, Graphic,
  GraphicOwner, GraphicsArray, MeshGraphic, MockRender, OffScreenTarget, OnScreenTarget, parseImdlDocument, PerformanceMetrics,
  PolylineGeometry, Primitive, PrimitiveBuilder, SurfaceType, Target, Texture2DHandle, TextureHandle, WorldDecorations,
};
export type { ExternalTextureRequest, ImdlModel };
