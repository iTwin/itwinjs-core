/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { PlanarClipMaskState } from "../../PlanarClipMaskState";
import { SpatialClassifierTileTreeReference, Tile } from "../../tile/internal";
import { SceneContext } from "../../ViewContext";

/**  @internal */
export interface PlanarClassifierTarget { modelId: Id64String, tiles: Tile[], location: Transform, isPointCloud: boolean }
/** An opaque representation of a planar classifier applied to geometry within a [[Viewport]].
 * @internal
 */
export abstract class RenderPlanarClassifier implements Disposable {
  public abstract [Symbol.dispose](): void;
  public abstract collectGraphics(context: SceneContext, target: PlanarClassifierTarget): void;
  public abstract setSource(classifierTreeRef?: SpatialClassifierTileTreeReference, planarClipMask?: PlanarClipMaskState): void;
}

/** @internal */
export type PlanarClassifierMap = Map<string, RenderPlanarClassifier>;
