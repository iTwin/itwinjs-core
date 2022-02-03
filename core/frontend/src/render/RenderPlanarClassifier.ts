/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { Id64String, IDisposable } from "@itwin/core-bentley";
import type { Transform } from "@itwin/core-geometry";
import type { PlanarClipMaskState } from "../PlanarClipMaskState";
import type { SpatialClassifierTileTreeReference, Tile } from "../tile/internal";
import type { SceneContext } from "../ViewContext";

/**  @internal */
export interface PlanarClassifierTarget { modelId: Id64String, tiles: Tile[], location: Transform, isPointCloud: boolean }
/** An opaque representation of a planar classifier applied to geometry within a [[Viewport]].
 * @internal
 */
export abstract class RenderPlanarClassifier implements IDisposable {
  public abstract dispose(): void;
  public abstract collectGraphics(context: SceneContext, target: PlanarClassifierTarget): void;
  public abstract setSource(classifierTreeRef?: SpatialClassifierTileTreeReference, planarClipMask?: PlanarClipMaskState): void;
}

/** @internal */
export type PlanarClassifierMap = Map<Id64String, RenderPlanarClassifier>;
