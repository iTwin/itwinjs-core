/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { BeDuration, BeTimePoint, dispose, Id64String } from "@bentley/bentleyjs-core";
import { Matrix4d, Range3d, Transform } from "@bentley/geometry-core";
import { ElementAlignedBox3d, FrustumPlanes, ViewFlagOverrides } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { RenderMemory } from "../render/RenderMemory";
import { Tile, TileDrawArgs, TileLoadPriority, TileTreeParams } from "./internal";

/** Describes the current state of a [[TileTree]]. TileTrees are loaded asynchronously and may be unloaded after a period of disuse.
 * @beta
 */
export enum TileTreeLoadStatus {
  /** No attempt to load the tile tree has yet been made. */
  NotLoaded,
  /** The tile tree is in the process of being loaded. */
  Loading,
  /** The tile tree has been successfully loaded. */
  Loaded,
  /** An attempt to load the tile tree failed. */
  NotFound,
}

/** A hierarchical level-of-detail tree of [3d Tiles](https://github.com/CesiumGS/3d-tiles) to be rendered in a [[Viewport]].
 * Tile trees originate from a variety of sources:
 *  - Each [[GeometricModelState]] can supply its graphics as a tile tree;
 *  - A [[DisplayStyleState]]'s map settings or reality models;
 *  - [ViewAttachment]($backend)s in a [[SheetModelState]];
 *  - [[TiledGraphicsProvider]]s associated with a viewport.
 * The same TileTree can be displayed in any number of viewports using multiple [[TileTreeReference]]s.
 * A TileTree's lifetime is managed by a [[TileTreeOwner]].
 * @beta
 */
export abstract class TileTree {
  private _isDisposed = false;
  /** @internal */
  protected _lastSelected = BeTimePoint.now();
  /** @internal */
  protected _clipVolume?: RenderClipVolume;
  public readonly iModel: IModelConnection;
  /** Transform from this tile tree's coordinate space to the iModel's coordinate space. */
  public readonly iModelTransform: Transform;
  /** Uniquely identifies this tree among all other tile trees associated with the iModel. */
  public readonly id: string;
  /** @internal */
  public readonly modelId: Id64String;
  /** The length of time after which tiles belonging to this tree are considered elegible for disposal if they are no longer in use. */
  public readonly expirationTime: BeDuration;
  /** @internal */
  public get loadPriority(): TileLoadPriority { return this._loadPriority; }
  private readonly _loadPriority: TileLoadPriority;
  /** Optional tight bounding box around the entire contents of all of this tree's tiles. */
  public readonly contentRange?: ElementAlignedBox3d;

  /** The lowest-resolution tile in this tree. */
  public abstract get rootTile(): Tile;
  /** True if this tile tree contains 3d graphics. */
  public abstract get is3d(): boolean;
  /** Returns the maximum depth of this tree, if any. */
  public abstract get maxDepth(): number | undefined;
  /** The overrides that should be applied to the view's [ViewFlags]($common) when this tile tree is drawn. Can be overridden by individual [[TileTreeReference]]s. */
  public abstract get viewFlagOverrides(): ViewFlagOverrides;
  /** True if this tile tree has no bounds - e.g., a tile tree representing a globe is unbounded. */
  public abstract get isContentUnbounded(): boolean;

  /** Implement this method to select tiles of appropriate resolution. */
  protected abstract _selectTiles(args: TileDrawArgs): Tile[];

  /** Produce graphics of appropriate resolution to be drawn in a [[Viewport]]. */
  public abstract draw(args: TileDrawArgs): void;

  /** Discard tiles and/or tile contents, presumably based on a least-recently-used and/or least-likely-to-be-needed criterion. */
  public abstract prune(): void;

  /** True if this tile tree contains 2d graphics. */
  public get is2d(): boolean { return !this.is3d; }
  /** @internal */
  public get isPointCloud(): boolean { return false; }
  /** @internal */
  public get clipVolume(): RenderClipVolume | undefined { return this._clipVolume; }

  /** The volume of space occupied by this tile tree. */
  public get range(): ElementAlignedBox3d { return this.rootTile.range; }
  /** @internal */
  public get lastSelectedTime(): BeTimePoint { return this._lastSelected; }
  /** @internal */
  public get parentsAndChildrenExclusive(): boolean { return true; }

  /** This function will forcibly prune any unused tiles associated with the tree, ignoring any expiration times.
   * An unused tile is a tile that is not currently in use by any viewport.
   * @alpha
   **/
  public abstract forcePrune(): void;

  /** Constructor */
  protected constructor(params: TileTreeParams) {
    this._lastSelected = BeTimePoint.now();
    this.iModel = params.iModel;
    this.iModelTransform = params.location;
    this._clipVolume = params.clipVolume;
    this.modelId = params.modelId;
    this.id = params.id;
    this.contentRange = params.contentRange;

    const admin = IModelApp.tileAdmin;
    this._loadPriority = params.priority;
    this.expirationTime = params.expirationTime ?? admin.tileExpirationTime;
  }

  /** Selects tiles of appropriate resolution for some purpose like drawing to the screen, producing a shadow map, etc.
   * @note Do **not** override this method. Implement [[_selectTiles]].
   */
  public selectTiles(args: TileDrawArgs): Tile[] {
    this._lastSelected = BeTimePoint.now();
    const tiles = this._selectTiles(args);
    IModelApp.tileAdmin.addTilesForViewport(args.context.viewport, tiles, args.readyTiles);
    args.processSelectedTiles(tiles);
    return tiles;
  }

  /** True if [[dispose]] has been called on this tile tree. */
  public get isDisposed(): boolean { return this._isDisposed; }

  /** Dispose of this tree and any resources owned by it. This is typically invoked by a [[TileTreeOwner]]. */
  public dispose(): void {
    if (this.isDisposed)
      return;

    this._isDisposed = true;
    dispose(this.rootTile);
    dispose(this.clipVolume);
  }

  /** @internal */
  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.rootTile.collectStatistics(stats);
    if (undefined !== this.clipVolume)
      this.clipVolume.collectStatistics(stats);
  }

  /** Returns the number of [[Tile]]s currently in memory belonging to this tree. */
  public countTiles(): number {
    return 1 + this.rootTile.countDescendants();
  }

  /** @internal */
  public accumulateTransformedRange(range: Range3d, matrix: Matrix4d, location: Transform, frustumPlanes?: FrustumPlanes): void {
    this.rootTile.extendRangeForContent(range, matrix, location, frustumPlanes);
  }
}

/** Interface adopted by an object that contains references to [[TileTree]]s, to expose those trees.
 * @beta
 */
export interface TileTreeDiscloser {
  /** Add all [[TileTree]]s referenced by this object to the set. */
  discloseTileTrees: (trees: TileTreeSet) => void;
}

/** A set of TileTrees, populated by a call to a `discloseTileTrees` function on an object like a [[Viewport]], [[ViewState]], or [[TileTreeReference]].
 * @beta
 */
export class TileTreeSet {
  private readonly _processed = new Set<TileTreeDiscloser>();
  /** The set of tile trees. */
  public readonly trees = new Set<TileTree>();

  /** Add a tile tree to the set. */
  public add(tree: TileTree): void {
    this.trees.add(tree);
  }

  /** Add all tile trees referenced by `discloser` to the set. */
  public disclose(discloser: TileTreeDiscloser): void {
    if (!this._processed.has(discloser)) {
      this._processed.add(discloser);
      discloser.discloseTileTrees(this);
    }
  }

  /** The number of tile trees in the set. */
  public get size(): number { return this.trees.size; }
}
