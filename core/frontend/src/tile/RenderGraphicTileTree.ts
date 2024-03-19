/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Guid, GuidString, Id64String, compareStrings } from "@itwin/core-bentley";
import { ViewFlagOverrides } from "@itwin/core-common";
import { Tile, TileDrawArgs, TileLoadPriority, TileTree, TileTreeOwner, TileTreeReference, TileTreeSupplier } from "./internal";
import { RenderGraphic } from "../render/RenderGraphic";
import { IModelConnection } from "../IModelConnection";
import { Range3d, Transform } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";

export interface RenderGraphicTileTreeArgs {
  graphic: RenderGraphic;
  iModel: IModelConnection;
  modelId: Id64String;
  viewFlags?: ViewFlagOverrides;
  is2d?: boolean;
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
  private readonly _is3d: boolean;
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
    this._is3d = true !== args.is2d;
    this._viewFlagOverrides = args.viewFlags ?? { };
  }

  public override get rootTile() { return this._rootTile; }
  public override get is3d() { return this._is3d; }
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

  public constructor(args: TreeId) {
    super();
    this._owner = args.iModel.tiles.getTileTreeOwner(args, supplier);
  }

  public override get treeOwner() { return this._owner; }
}

export function tileTreeReferenceFromRenderGraphic(args: RenderGraphicTileTreeArgs): TileTreeReference {
  return new GraphicRef({ ...args, id: Guid.createValue() });
}
