/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  BeDuration,
  BeTimePoint,
  dispose,
  Id64String,
} from "@bentley/bentleyjs-core";
import {
  Matrix4d,
  Range3d,
  Transform,
} from "@bentley/geometry-core";
import {
  ElementAlignedBox3d,
  FrustumPlanes,
  ViewFlag,
} from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { RenderMemory } from "../render/RenderMemory";
import {
  Tile,
  TileDrawArgs,
  TileLoadPriority,
  TileTreeParams,
} from "./internal";

/** @internal */
export enum TileTreeLoadStatus {
  NotLoaded,
  Loading,
  Loaded,
  NotFound,
}

/** A hierarchical level-of-detail tree of 3d [[Tile]]s to be rendered in a [[Viewport]].
 * @internal
 */
export abstract class TileTree {
  protected _lastSelected = BeTimePoint.now();
  protected _clipVolume?: RenderClipVolume;
  public readonly iModel: IModelConnection;
  /** Transform from this tile tree's coordinate space to the iModel's coordinate space. */
  public readonly iModelTransform: Transform;
  /** Uniquely identifies this tree among all other tile trees associated with the iModel. */
  public readonly id: string;
  public readonly modelId: Id64String;
  public readonly expirationTime: BeDuration;
  public readonly loadPriority: TileLoadPriority;
  /** Optional tight bounding box around the entire contents of all of this tree's tiles. */
  public readonly contentRange?: ElementAlignedBox3d;

  public abstract get rootTile(): Tile;
  public abstract get is3d(): boolean;
  public abstract get maxDepth(): number | undefined;
  public abstract get viewFlagOverrides(): ViewFlag.Overrides;
  public abstract get isContentUnbounded(): boolean;

  protected abstract _selectTiles(args: TileDrawArgs): Tile[];
  public abstract draw(args: TileDrawArgs): void;

  public get is2d(): boolean { return !this.is3d; }
  public get isPointCloud(): boolean { return false; }
  public get clipVolume(): RenderClipVolume | undefined { return this._clipVolume; }

  public get range(): ElementAlignedBox3d { return this.rootTile.range; }
  public get lastSelectedTime(): BeTimePoint { return this._lastSelected; }
  public get parentsAndChildrenExclusive(): boolean { return true; }

  protected constructor(params: TileTreeParams) {
    this._lastSelected = BeTimePoint.now();
    this.iModel = params.iModel;
    this.iModelTransform = params.location;
    this._clipVolume = params.clipVolume;
    this.modelId = params.modelId;
    this.id = params.id;
    this.contentRange = params.contentRange;

    const admin = IModelApp.tileAdmin;
    this.loadPriority = params.priority;
    if (undefined !== params.expirationTime)
      this.expirationTime = params.expirationTime;
    else
      this.expirationTime = TileLoadPriority.Context === this.loadPriority ? admin.realityTileExpirationTime : admin.tileExpirationTime;
  }

  /** Don't override this method. Implement [[_selectTiles]]. */
  public selectTiles(args: TileDrawArgs): Tile[] {
    this._lastSelected = BeTimePoint.now();
    return this._selectTiles(args);
  }

  public dispose(): void {
    dispose(this.rootTile);
    dispose(this.clipVolume);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.rootTile.collectStatistics(stats);
    if (undefined !== this.clipVolume)
      this.clipVolume.collectStatistics(stats);
  }

  public countTiles(): number {
    return 1 + this.rootTile.countDescendants();
  }

  public accumulateTransformedRange(range: Range3d, matrix: Matrix4d, location: Transform, frustumPlanes?: FrustumPlanes): void {
    this.rootTile.extendRangeForContent(range, matrix, location, frustumPlanes);
  }
}

/** @internal */
export interface TileTreeDiscloser {
  discloseTileTrees: (trees: TileTreeSet) => void;
}

/** A set of TileTrees, populated by a call to a `discloseTileTrees` function on an object like a [[Viewport]], [[ViewState]], or [[TileTreeReference]].
 * @internal
 */
export class TileTreeSet {
  private readonly _processed = new Set<TileTreeDiscloser>();
  public readonly trees = new Set<TileTree>();

  public add(tree: TileTree): void {
    this.trees.add(tree);
  }

  public disclose(discloser: TileTreeDiscloser): void {
    if (!this._processed.has(discloser)) {
      this._processed.add(discloser);
      discloser.discloseTileTrees(this);
    }
  }

  public get size(): number { return this.trees.size; }
}
