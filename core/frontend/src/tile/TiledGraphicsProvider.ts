/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Viewport } from "../Viewport";
import { SceneContext } from "../ViewContext";
import { TileTreeReference } from "./internal";

/** Provides a way for applications to inject additional non-decorative graphics into a [[Viewport]] by supplying one or more [[TileTreeReference]]s capable of loading and drawing the graphics.
 * @see [[Viewport.addTiledGraphicsProvider]]
 * @beta
 */
export interface TiledGraphicsProvider {
  /** Apply the supplied function to each [[TileTreeReference]] to be drawn in the specified [[Viewport]]. */
  forEachTileTreeRef(viewport: Viewport, func: (ref: TileTreeReference) => void): void;
  /** If defined, overrides the logic for adding this provider's graphics into the scene. Otherwise, [[TileTreeReference.addToScene]] is invoked for each reference. */
  addToScene?: (context: SceneContext) => void;
}
