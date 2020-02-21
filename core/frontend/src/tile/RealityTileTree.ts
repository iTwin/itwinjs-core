/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  assert,
  BeTimePoint,
} from "@bentley/bentleyjs-core";
import {
  Transform,
} from "@bentley/geometry-core";
import {
  ColorDef,
  ViewFlag,
} from "@bentley/imodeljs-common";
import { GraphicBranch } from "../render/GraphicBranch";
import { GraphicBuilder } from "../render/GraphicBuilder";
import {
  RealityTile,
  Tile,
  TileDrawArgs,
  TileParams,
  TileTree,
} from "./internal";
import { SceneContext } from "../ViewContext";

/** @internal */
export class TraversalDetails {
  public queuedChildren = new Array<Tile>();
  public childrenLoading = false;
  public childrenSelected = false;

  public initialize() {
    this.queuedChildren.length = 0;
    this.childrenLoading = false;
    this.childrenSelected = false;
  }
}

/** @internal */
export class TraversalChildrenDetails {
  private _childDetails: TraversalDetails[] = [];

  public initialize() {
    for (const child of this._childDetails)
      child.initialize();
  }
  public getChildDetail(index: number) {
    while (this._childDetails.length <= index)
      this._childDetails.push(new TraversalDetails());

    return this._childDetails[index];
  }

  public combine(parentDetails: TraversalDetails) {
    parentDetails.queuedChildren.length = 0;
    parentDetails.childrenLoading = false;
    parentDetails.childrenSelected = false;
    for (const child of this._childDetails) {
      parentDetails.childrenLoading = parentDetails.childrenLoading || child.childrenLoading;
      parentDetails.childrenSelected = parentDetails.childrenSelected || child.childrenSelected;
      for (const queuedChild of child.queuedChildren)
        parentDetails.queuedChildren.push(queuedChild);
    }
  }
}

/** @internal */
export class TraversalSelectionContext {
  public preloaded = new Set<RealityTile>();
  public missing = new Array<RealityTile>();
  constructor(public selected: Tile[], public displayedDescendants: Tile[][], public preloadBuilder?: GraphicBuilder) { }

  public selectOrQueue(tile: RealityTile, args: TileDrawArgs, traversalDetails: TraversalDetails) {
    tile.selectSecondaryTiles(args, this);
    tile.setLastUsed(args.now);
    if (tile.isReady) {
      this.selected.push(tile);
      this.displayedDescendants.push((traversalDetails.childrenSelected) ? traversalDetails.queuedChildren.slice() : []);
      traversalDetails.queuedChildren.length = 0;
      traversalDetails.childrenLoading = false;
      traversalDetails.childrenSelected = true;
    } else if (!tile.isNotFound) {
      traversalDetails.queuedChildren.push(tile);
      this.missing.push(tile);
    }
  }
  public preload(tile: RealityTile, args: TileDrawArgs): void {
    if (!this.preloaded.has(tile)) {
      if (this.preloadBuilder)
        tile.addBoundingGraphic(this.preloadBuilder, ColorDef.green);
      tile.setLastUsed(args.now);
      tile.selectSecondaryTiles(args, this);
      this.preloaded.add(tile);
      if (!tile.isReady)
        this.missing.push(tile);
    }
  }
  public select(tiles: RealityTile[], args: TileDrawArgs): void {
    for (const tile of tiles) {
      tile.setLastUsed(args.now);
      this.selected.push(tile);
      this.displayedDescendants.push([]);
    }
  }
}

/** @internal */
export class RealityTileTree extends TileTree {
  private get _realityRoot() { return this._rootTile as RealityTile; }
  public createTile(props: TileParams) { return new RealityTile(props); }

  public traversalChildrenByDepth: TraversalChildrenDetails[] = [];
  public selectTilesForScene(args: TileDrawArgs): Tile[] {
    return this.selectRealityTiles(args, []);
  }

  public draw(args: TileDrawArgs): void {
    return this.drawRealityTiles(args);
  }
  public static debugSelectedTiles = false;           // tslint:disable-ldoine: prefer-const
  public static debugMissingTiles = false;            // tslint:disable-line: prefer-const
  public static debugSelectedRanges = false;         // tslint:disable-line: prefer-const
  public static debugPreload = false;
  private drawRealityTiles(args: TileDrawArgs): void {
    const displayedTileDescendants = new Array<RealityTile[]>();
    const selectBuilder = RealityTileTree.debugSelectedRanges ? args.context.createSceneGraphicBuilder() : undefined;
    const preloadBuilder = RealityTileTree.debugPreload ? args.context.createSceneGraphicBuilder() : undefined;

    const selectedTiles = this.selectRealityTiles(args, displayedTileDescendants, preloadBuilder);
    if (!this.loader.parentsAndChildrenExclusive)
      selectedTiles.sort((a, b) => a.depth - b.depth);                    // If parent and child are not exclusive then display parents (low resolution) first.

    assert(selectedTiles.length === displayedTileDescendants.length);
    for (let i = 0; i < selectedTiles.length; i++) {
      const selectedTile = selectedTiles[i];
      const graphics = args.getTileGraphics(selectedTile);
      if (undefined !== graphics) {

        const displayedDescendants = displayedTileDescendants[i];
        if (0 === displayedDescendants.length || !this.loader.parentsAndChildrenExclusive || selectedTile.allChildrenIncluded(displayedDescendants)) {
          args.graphics.add(graphics);
          if (selectBuilder) selectedTile.addBoundingGraphic(selectBuilder, ColorDef.green);
        } else {
          if (selectBuilder) selectedTile.addBoundingGraphic(selectBuilder, ColorDef.red);
          for (const displayedDescendant of displayedDescendants) {
            const clipVector = displayedDescendant.getContentClip();
            if (selectBuilder)
              displayedDescendant.addBoundingGraphic(selectBuilder, ColorDef.blue);
            if (undefined === clipVector) {
              args.graphics.add(graphics);
            } else {
              clipVector.transformInPlace(args.location);

              const branch = new GraphicBranch();
              const doClipOverride = new ViewFlag.Overrides();
              doClipOverride.setShowClipVolume(true);
              branch.add(graphics);
              branch.setViewFlagOverrides(doClipOverride);
              const clipVolume = args.context.target.renderSystem.createClipVolume(clipVector);

              args.graphics.add(args.context.createGraphicBranch(branch, Transform.createIdentity(), { clipVolume }));
            }
          }
        }
        if (preloadBuilder)
          args.graphics.add(preloadBuilder.finish());
        if (selectBuilder)
          args.graphics.add(selectBuilder.finish());

        const rangeGraphic = selectedTile.getRangeGraphic(args.context);
        if (undefined !== rangeGraphic)
          args.graphics.add(rangeGraphic);
      }
    }

    args.drawGraphics();
    args.context.viewport.numSelectedTiles += selectedTiles.length;
    this.purgeRealityTiles(args.purgeOlderThan);        // Purge stale tiles....
  }

  public getTraversalChildren(depth: number) {
    while (this.traversalChildrenByDepth.length <= depth)
      this.traversalChildrenByDepth.push(new TraversalChildrenDetails());

    return this.traversalChildrenByDepth[depth];
  }

  public getBaseRealityDepth(_sceneContext: SceneContext) { return -1; }

  public purgeRealityTiles(purgeOlderThan: BeTimePoint) {
    this._realityRoot.purgeContents(purgeOlderThan);
  }

  public static freezeRealityState = false;
  public selectRealityTiles(args: TileDrawArgs, displayedDescendants: RealityTile[][], preloadBuilder?: GraphicBuilder): RealityTile[] {
    this._lastSelected = BeTimePoint.now();
    const selected: RealityTile[] = [];
    const context = new TraversalSelectionContext(selected, displayedDescendants, preloadBuilder);
    const rootTile = this._realityRoot;
    const baseDepth = this.getBaseRealityDepth(args.context);

    if (baseDepth > 0)        // Maps may force loading of low level globe tiles.
      rootTile.preloadRealityTilesAtDepth(baseDepth, context, args);

    rootTile.selectRealityTiles(context, args, new TraversalDetails());

    if (!RealityTileTree.freezeRealityState)
      for (const tile of context.missing)
        args.insertMissing(tile.loadableTile);

    if (RealityTileTree.debugSelectedTiles) {
      this.logTiles("Selected: ", selected.values());
      const preloaded = [];
      for (const tile of context.preloaded)
        preloaded.push(tile);
      this.logTiles("Preloaded: ", preloaded.values());
    }

    if (RealityTileTree.debugMissingTiles && context.missing.length)
      this.logTiles("Missing: ", context.missing.values());

    return selected;
  }

  protected logTiles(label: string, tiles: IterableIterator<Tile>) {
    let depthString = "";
    let min = 10000, max = -10000;
    let count = 0;
    const depthMap = new Map<number, number>();
    for (const tile of tiles) {
      count++;
      const depth = tile.depth;
      min = Math.min(min, tile.depth);
      max = Math.max(max, tile.depth);
      const found = depthMap.get(depth);
      depthMap.set(depth, found === undefined ? 1 : found + 1);
    }

    depthMap.forEach((key, value) => depthString += key + "-" + value + ", ");
    console.log(label + ": " + count + " Min: " + min + " Max: " + max + " Depths: " + depthString);    // tslint:disable-line
  }
}
