/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import type { Viewport } from "../Viewport";
import type { SceneContext } from "../ViewContext";
import type { TileTreeReference } from "./internal";

/** Provides a way for applications to inject additional non-decorative graphics into a [[Viewport]] by supplying one or more [[TileTreeReference]]s capable of loading and drawing the graphics.
 * @see [[Viewport.addTiledGraphicsProvider]] to register a provider to be drawn in a viewport.
 * @see [Exploded View Sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=explode-sample&imodel=House+Sample) for an interactive
 * demonstration of a custom provider.
 * @public
 */
export interface TiledGraphicsProvider {
  /** For each [[TileTreeReference]] belonging to this provider that should be drawn in the specified [[Viewport]], apply the provided function. */
  forEachTileTreeRef(viewport: Viewport, func: (ref: TileTreeReference) => void): void;

  /** If defined, overrides the logic for adding this provider's graphics into the scene.
   * Otherwise, [[TileTreeReference.addToScene]] is invoked for each reference.
   */
  addToScene?: (context: SceneContext) => void;

  /** If defined, returns true if the [[TileTree]]s required for displaying this provider's graphics in the specified [[Viewport]] are loaded and ready to draw.
   * Otherwise, [[TileTreeReference.isLoadingComplete]] is invoked for each reference.
   * A provider might supply this function if it needs to perform some asynchronous work before it can supply its [[TileTreeReference]]s and/or after its
   * [[TileTree]]s are loaded.
   */
  isLoadingComplete?: (viewport: Viewport) => boolean;
}

/** @public */
export namespace TiledGraphicsProvider {
  /** @internal because TypeDoc can't disambiguate with the interface method by same name. */
  export function addToScene(provider: TiledGraphicsProvider, context: SceneContext): void {
    if (provider.addToScene)
      provider.addToScene(context);
    else
      provider.forEachTileTreeRef(context.viewport, (ref) => ref.addToScene(context));
  }

  /** @internal because TypeDoc can't disambiguate with the interface method by same name. */
  export function isLoadingComplete(provider: TiledGraphicsProvider, viewport: Viewport): boolean {
    if (provider.isLoadingComplete && !provider.isLoadingComplete(viewport))
      return false;

    let allLoaded = true;
    provider.forEachTileTreeRef(viewport, (ref) => {
      allLoaded &&= ref.isLoadingComplete;
    });

    return allLoaded;
  }
}
