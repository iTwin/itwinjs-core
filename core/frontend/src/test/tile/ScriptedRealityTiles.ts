/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d, Transform } from "@itwin/core-geometry";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { RenderMemory } from "../../render/RenderMemory";
import {
  RealityTile, RealityTileLoader, RealityTileTree, Tile, TileDrawArgs, TileLoadPriority, TileRequest, TileRequestChannel, TraversalSelectionContext,
} from "../../tile/internal";

export class ScriptedLoader extends RealityTileLoader {
  public get priority() { return TileLoadPriority.Context; }
  public get clipLowResolutionTiles() { return true; }
  public get maxDepth() { return 100; }
  public get minDepth() { return 0; }
  public async loadChildren(): Promise<Tile[] | undefined> { return undefined; }
  public getRequestChannel(): TileRequestChannel { return IModelApp.tileAdmin.channels.getForHttp("test-scripted-reality-tile"); }
  public async requestTileContent(): Promise<TileRequest.Response> { return undefined; }
}

export interface ScriptedTileOptions {
  /** Screen-space error in pixels; the tolerance is 16. */
  sse: number;
  /** False for a tile whose content is not loaded. */
  ready?: boolean;
  culled?: boolean;
  notFound?: boolean;
  /** True for a tile selected by its size on screen rather than its geometric error, which memory pressure does not coarsen. */
  selectedBySize?: boolean;
}

/** A reality tile with a scripted screen-space error, visibility and children. */
export class ScriptedTile extends RealityTile {
  public readonly kids: ScriptedTile[] = [];
  public readonly sse: number;
  public readonly culled: boolean;
  /** Bytes reported to the tile cache. */
  public bytes = 0;

  public constructor(tree: RealityTileTree, id: string, options: ScriptedTileOptions, parent?: ScriptedTile, isLeaf = false) {
    super({
      contentId: id,
      range: new Range3d(0, 0, 0, 1, 1, 1),
      maximumSize: 1,
      parent,
      isLeaf,
      geometricError: options.selectedBySize ? undefined : 1,
    }, tree);
    this.sse = options.sse;
    this.culled = true === options.culled;
    if (options.notFound)
      this.setNotFound();
    else if (false !== options.ready)
      this.setIsReady();
  }

  public add(id: string, options: ScriptedTileOptions, isLeaf = true): ScriptedTile {
    const child = new ScriptedTile(this.tree, id, options, this, isLeaf);
    this.kids.push(child);
    return child;
  }

  public loadScriptedChildren(): void {
    this.loadChildren();
  }

  public override collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addTexture(this.bytes);
  }

  protected override isBoundingVolumeCulled(): boolean {
    return this.culled;
  }

  protected override computeScreenSpaceError(): number {
    return this.sse;
  }

  protected override _loadChildren(resolve: (children: Tile[] | undefined) => void): void {
    resolve(this.kids);
  }
}

/** A tree that refines a tile only once its children are ready, as a tree of Gaussian splats does. */
export class ScriptedTree extends RealityTileTree {
  /** The root the traversal starts from, replacing the one the tree creates. */
  public scriptedRoot?: ScriptedTile;

  public constructor(iModel: IModelConnection) {
    super({
      loader: new ScriptedLoader(),
      rootTile: { contentId: "", range: new Range3d(0, 0, 0, 1, 1, 1), maximumSize: 1 },
      id: "scripted-reality-tree",
      modelId: "0",
      location: Transform.createIdentity(),
      priority: TileLoadPriority.Context,
      iModel,
      gcsConverterAvailable: false,
      rootToEcef: undefined,
    });
  }

  public override get rootTile(): RealityTile { return this.scriptedRoot ?? super.rootTile; }
  public override get refinesWhenChildrenReady(): boolean { return true; }

  public root(options: ScriptedTileOptions, id = "r"): ScriptedTile {
    return this.scriptedRoot = new ScriptedTile(this, id, options);
  }
}

export interface ScriptedSelection {
  selected: string[];
  missing: string[];
  /** Whether ready content covers the visible region. */
  complete: boolean;
  context: TraversalSelectionContext;
  args: TileDrawArgs;
}

/** Select the tiles of `root`'s tree to draw, as the tree does. Scripted tiles need no view. */
export function selectScripted(root: ScriptedTile): ScriptedSelection {
  const args = {
    tree: root.tree,
    maximumScreenSpaceError: 16,
    location: Transform.createIdentity(),
    context: {},
    touchedTiles: new Set<Tile>(),
    markUsed: () => undefined,
    markReady: () => undefined,
    markChildrenLoading: () => undefined,
  } as unknown as TileDrawArgs;
  const context = new TraversalSelectionContext([], []);

  const complete = root.selectRefiningWhenChildrenReady(context, args);

  const ids = (tiles: Iterable<Tile>) => [...tiles].map((tile) => tile.contentId).sort();
  return { selected: ids(context.selected), missing: ids(new Set(context.missing)), complete, context, args };
}
