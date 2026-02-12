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
 * @extensions
 */
export interface TiledGraphicsProvider {
  /** For each [[TileTreeReference]] belonging to this provider that should be drawn in the specified [[Viewport]], apply the provided function.
   * This method is inefficient because it does not permit the caller to prematurely halt iteration; and awkward because `func` cannot be `async` nor
   * return any value.
   * Implementations should implement [[getReferences]], and callers should prefer to call {@link TiledGraphicsProvider.getTileTreeRefs}.
   */
  forEachTileTreeRef(viewport: Viewport, func: (ref: TileTreeReference) => void): void;

  /** If defined, iterates over the [[TileTreeReference]]s belonging to this provider that should be drawn in the specified [[Viewport]].
   * {@link TiledGraphicsProvider.getTileTreeRefs} will call this more efficient method if defined, and fall back to the less efficient [[forEachTileTreeRef]] otherwise.
   */
  getReferences?: (viewport: Viewport) => Iterable<TileTreeReference>;

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

  /** Obtain an iterator over all of the [[TileTreeReference]]s belonging to this provider that should be drawn in the specified [[Viewport]].
   * This function invokes [[TiledGraphicsProvider.getReferences]] if implemented by `provider`; otherwise, it populates an iterable from the references
   * provided by [[TiledGraphicsProvider.forEachTileTreeRef]], which is less efficient.
   */
  export function getTileTreeRefs(provider: TiledGraphicsProvider, viewport: Viewport): Iterable<TileTreeReference> {
    if (provider.getReferences) {
      return provider.getReferences(viewport);
    }

    const refs: TileTreeReference[] = [];
    provider.forEachTileTreeRef(viewport, (ref) => {
      refs.push(ref);
    });

    return refs;
  }
}
