/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert } from "@itwin/core-bentley";
import { RenderGraphicOwner } from "./render/RenderGraphic";
import { GraphicType } from "./render/GraphicBuilder";
import { ViewportDecorator } from "./Viewport";
import { CanvasDecoration } from "./render/CanvasDecoration";

/** @internal */
export type CachedDecoration =
  { type: "graphic", graphicType: GraphicType, graphicOwner: RenderGraphicOwner } |
  { type: "canvas", canvasDecoration: CanvasDecoration, atFront: boolean } |
  { type: "html", htmlElement: HTMLElement };

function disposeCachedDecorations(decorations: CachedDecoration[]): void {
  for (const dec of decorations)
    if ("graphic" === dec.type)
      dec.graphicOwner.disposeGraphic();
}

/** A cache of decorations previously produced by a [[ViewportDecorator]] for which `useCachedDecorations` is `true`.
 * The decorations are preserved until either:
 *  - The associated [[Viewport]]'s scene is invalidated; or
 *  - The decorator explicitly requests them to be discarded.
 * The primary benefit is that cached decorations do not get recreated on every mouse motion.
 * @internal
 */
export class DecorationsCache {
  private readonly _cache = new Map<ViewportDecorator, CachedDecoration[]>();
  /** If true, attempts to remove entries from the cache will silently fail. This is set while a [[ScreenViewport]] is producing decorations
   * to prevent poorly-written decorators from invalidating the cache while it is being populated by, e.g., calling [[Viewport.invalidateScene]].
   */
  public prohibitRemoval = false;

  /** The number of decorators that have entries in the cache. */
  public get size(): number {
    return this._cache.size;
  }

  /** Get the list of cached decorations for the decorator. */
  public get(decorator: ViewportDecorator): CachedDecoration[] | undefined {
    return this._cache.get(decorator);
  }

  /** Add a decoration to the list of cached decorations for the decorator. */
  public add(decorator: ViewportDecorator, decoration: CachedDecoration): void {
    assert(true === decorator.useCachedDecorations);
    if (!decorator.useCachedDecorations)
      return;

    let decorations = this.get(decorator);
    if (!decorations)
      this._cache.set(decorator, decorations = []);

    decorations.push(decoration);
  }

  /** Delete the decorator and all of its decorations, disposing of the decorations' graphics. */
  public delete(decorator: ViewportDecorator): void {
    if (this.prohibitRemoval)
      return;

    assert(true === decorator.useCachedDecorations);
    const decs = this._cache.get(decorator);
    if (decs) {
      disposeCachedDecorations(decs);
      this._cache.delete(decorator);
    }
  }

  /** Remove all decorators and their decorations from the cache, disposing of the decorations' graphics. */
  public clear(): void {
    if (this.prohibitRemoval)
      return;

    for (const decorations of this._cache.values())
      disposeCachedDecorations(decorations);

    this._cache.clear();
  }
}
