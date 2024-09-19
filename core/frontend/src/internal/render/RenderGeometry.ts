/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { IDisposable } from "@itwin/core-bentley";
import { RenderMemory } from "../../render/RenderMemory";
import { Range3d } from "@itwin/core-geometry";

/** An opaque representation of geometry allocated by a [[RenderSystem]] to be supplied to [[RenderSystem.createRenderGraphic]]. */
export interface RenderGeometry extends IDisposable, RenderMemory.Consumer {
  readonly renderGeometryType: "mesh" | "polyline" | "point-string" | "point-cloud" | "reality-mesh";
  readonly isInstanceable: boolean;
  readonly isDisposed: boolean;
  /** If true, this geometry is intended for reuse. Its `dispose` method will do nothing. Instead, we will rely on the JS garbage collector
   * to dispose of any WebGL resources it contains.
   * When creating a reusable `GraphicTemplate`, we set this to `true` for all geometry in the template. We never set it to `false`.
   */
  noDispose: boolean;
  /** @internal */
  computeRange(out?: Range3d): Range3d;
}

