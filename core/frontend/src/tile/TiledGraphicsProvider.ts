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
 * @see [[Viewport.addTiledGraphicsProvider]] to register a provider to be drawn in a viewport.
 * @see [Exploded View Sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=explode-sample&imodel=House+Sample) for an interactive
 * demonstration of a custom provider.
 * @public
 */
export interface TiledGraphicsProvider {
  /** For each [[TileTreeReference]] belonging to this provider that should be drawn in the specified [[Viewport]], apply the provided function. */
  forEachTileTreeRef(viewport: Viewport, func: (ref: TileTreeReference) => void): void;

  /** If defined, overrides the logic for adding this provider's graphics into the scene. Otherwise, [[TileTreeReference.addToScene]] is invoked for each reference. */
  addToScene?: (context: SceneContext) => void;
}
