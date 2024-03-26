/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { compareStrings, Guid, GuidString, Id64String } from "@itwin/core-bentley";
import { ViewFlagOverrides } from "@itwin/core-common";
import { Tile, TileDrawArgs, TileLoadPriority, TileTree, TileTreeOwner, TileTreeReference, TileTreeSupplier } from "./internal";
import { RenderGraphic } from "../render/RenderGraphic";
import { IModelConnection } from "../IModelConnection";
import { Range3d, Transform } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";
import { HitDetail } from "../HitDetail";

/** Arguments supplied to [[TileTreeReference.createFromRenderGraphic]].
 * @beta
 */
export interface RenderGraphicTileTreeArgs {
  /** The graphics that will be drawn by the [[TileTreeReference]]. */
  graphic: RenderGraphic;
  /** The iModel with which to associate the [[TileTreeReference]]. */
  iModel: IModelConnection;
  /** A transient Id to serve as the [[TileTree.modelId]], obtained from the [[iModel]]'s [TransientIdSequence]($bentley).
   * This model Id will be associated with any pickable [Feature]($common)s contained in your [[graphic]].
   */
  modelId: Id64String;
  /** Optional overrides for a subset of the [[Viewport]]'s [ViewFlags]($common) when drawing your [[graphic]].
   * If, for example, you always want your graphic to be drawn as illuminated 3d surfaces, specify the following:
   * ```ts
   * { renderMode: RenderMode.SmoothShade, lighting: true }
   * ```
   */
  viewFlags?: ViewFlagOverrides;
  /** A function that returns a tooltip describing a pickable [Feature]($common) inside your [[graphic]] when the user hovers the mouse over it. */
  getToolTip?: (hit: HitDetail) => Promise<HTMLElement | string | undefined>;
}

interface TreeId extends RenderGraphicTileTreeArgs {
  id: GuidString;
}

class GraphicTile extends Tile {
  constructor(tree: TileTree, graphic: RenderGraphic) {
    const range = new Range3d();
    graphic.unionRange(range);

    super({
      contentId: tree.id,
      range,
      maximumSize: 1,
    }, tree);

    this.setGraphic(graphic);
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void): void {
    resolve(undefined);
  }

  public async requestContent() {
    return Promise.resolve(this.tree.id);
  }

  public async readContent() {
    return {};
  }

  public get channel() {
    return IModelApp.tileAdmin.channels.getForHttp("render-graphic-tile");
  }
}

class GraphicTree extends TileTree {
  private readonly _rootTile: GraphicTile;
  private readonly _viewFlagOverrides: ViewFlagOverrides;

  public constructor(args: TreeId) {
    super({
      iModel: args.iModel,
      id: args.id,
      modelId: args.modelId,
      location: Transform.createIdentity(),
      priority: TileLoadPriority.Primary,
    });

    this._rootTile = new GraphicTile(this, args.graphic);
    this._viewFlagOverrides = args.viewFlags ?? { };
  }

  public override get rootTile() { return this._rootTile; }

  // ###TODO rm TileTree.is3d - only iModel tiles care about it.
  public override get is3d() { return true; }
  public override get maxDepth() { return undefined; }
  public override get viewFlagOverrides() { return this._viewFlagOverrides; }

  protected override _selectTiles(args: TileDrawArgs) {
    args.markUsed(this.rootTile);
    return [this.rootTile];
  }

  public override prune() { }

  public override draw(args: TileDrawArgs) {
    const tiles = this.selectTiles(args);
    for (const tile of tiles)
      tile.drawGraphics(args);

    args.drawGraphics();
  }
}

class Supplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: TreeId, rhs: TreeId): number {
    return compareStrings(lhs.id, rhs.id);
  }

  public async createTileTree(id: TreeId): Promise<TileTree | undefined> {
    return Promise.resolve(new GraphicTree(id));
  }
}

const supplier = new Supplier();

class GraphicRef extends TileTreeReference {
  private readonly _owner: TileTreeOwner;
  private readonly _modelId: Id64String;
  private readonly _getToolTip?: (hit: HitDetail) => Promise<string | HTMLElement | undefined>;

  public constructor(args: TreeId) {
    super();
    this._owner = args.iModel.tiles.getTileTreeOwner(args, supplier);
    this._modelId = args.modelId;
    this._getToolTip = args.getToolTip;
  }

  public override get treeOwner() { return this._owner; }

  public override canSupplyToolTip(hit: HitDetail): boolean {
    return undefined !== this._getToolTip && this._modelId === hit.modelId;
  }

  public override async getToolTip(hit: HitDetail): Promise<string | HTMLElement | undefined> {
    if (this._getToolTip && this._modelId === hit.modelId) {
      return this._getToolTip(hit);
    }

    return undefined;
  }
}

/** @internal */
export function tileTreeReferenceFromRenderGraphic(args: RenderGraphicTileTreeArgs): TileTreeReference {
  return new GraphicRef({ ...args, id: Guid.createValue() });
}
