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

const gaussianDetail = new WeakMap<RenderTarget, WeakMap<object, number>>();

/** Internal memory feedback affects only trees that supplied Gaussian content. @internal */
export function gaussianTileDetailModifier(target: RenderTarget, tree: object): number {
  return gaussianDetail.get(target)?.get(tree) ?? 1;
}

/** Request coarser native traversal while retaining the completed display. @internal */
export function reduceGaussianTileDetail(target: RenderTarget, trees: Iterable<object>): boolean {
  let modifiers = gaussianDetail.get(target);
  if (!modifiers) { modifiers = new WeakMap(); gaussianDetail.set(target, modifiers); }
  let changed = false;
  for (const tree of trees) {
    const previous = modifiers.get(tree) ?? 1;
    const next = Math.min(64, previous * 2);
    changed ||= next !== previous;
    modifiers.set(tree, next);
  }
  return changed;
}

/** Restore requested detail gradually after sustained spare capacity. The step divides the
 * tolerance; the caller chooses it from the headroom it measured.
 * @internal
 */
export function recoverGaussianTileDetail(target: RenderTarget, trees: Iterable<object>, step = 2): boolean {
  const modifiers = gaussianDetail.get(target);
  let changed = false;
  for (const tree of trees) {
    const previous = modifiers?.get(tree) ?? 1;
    if (previous > 1) {
      const next = previous / step;
      modifiers?.set(tree, next < 1.001 ? 1 : next);
      changed = true;
    }
  }
  return changed;
}
