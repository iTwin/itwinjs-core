/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { RenderTarget } from "../../render/RenderTarget";
import type { Scene } from "../../render/Scene";
import type { TileDrawArgs } from "../../tile/TileDrawArgs";
import type { TileTree } from "../../tile/TileTree";
const pending = new WeakMap<TileDrawArgs, boolean>();
const scenes = new WeakMap<Scene, WeakMap<TileTree, boolean>>();
const selections = new WeakMap<RenderTarget, WeakMap<TileTree, boolean>>();

/** Record required visible coverage before speculative preloading. Multiple references to a tree
 * in one scene must all have ready coverage. A ready parent fallback counts as complete.
 * @internal
 */
export function recordRealityTileSelection(args: TileDrawArgs, complete: boolean): void {
  if (args.context.renderSystem.options.enableGaussianSplats)
    pending.set(args, complete);
}

/** Associate coverage only with graphics output into the native scene. Shadow/drape collectors
 * override TileDrawArgs.drawGraphics and do not publish their selections here.
 * @internal
 */
export function outputRealityTileSelection(args: TileDrawArgs): void {
  const complete = pending.get(args);
  if (complete === undefined)
    return;
  pending.delete(args);
  let trees = scenes.get(args.context.scene);
  if (!trees) {
    trees = new WeakMap();
    scenes.set(args.context.scene, trees);
  }
  trees.set(args.tree, complete && trees.get(args.tree) !== false);
}

/** Bind the selection belonging to the scene actually accepted by the native target. @internal */
export function changeRealityTileSelection(target: RenderTarget, scene: Scene): void {
  const trees = scenes.get(scene);
  if (trees)
    selections.set(target, trees);
  else
    selections.delete(target);
}

/** Missing required visible coverage for this target's latest native selection of a tree. @internal */
export function hasIncompleteRealityTileSelection(target: RenderTarget, tree: object): boolean {
  return selections.get(target)?.get(tree as TileTree) === false;
}
