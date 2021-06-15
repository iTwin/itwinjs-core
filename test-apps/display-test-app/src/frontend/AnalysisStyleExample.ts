/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { compareStrings } from "@bentley/bentleyjs-core";
import { IndexedPolyface, Range3d, Transform } from "@bentley/geometry-core";
import { AnalysisStyle, Cartographic, ViewFlagOverrides } from "@bentley/imodeljs-common";
import {
  IModelConnection, Tile, TileTree, TileTreeReference, TileTreeSupplier, Viewport,
} from "@bentley/imodeljs-frontend";
import { Viewer } from "./Viewer";

/*
type ContentType = "Cantilever" | "Flat";

interface Content {
  type: ContentType,
  readonly mesh: IndexedPolyface;
  readonly range: Range3d;
  readonly styles: AnalysisStyle[];
}

async function createContent(_type: ContentType): Promise<Content> {
  throw new Error("###TODO");
}

const supplier: TileTreeSupplier = {
  compareTileTreeIds: (lhs: ContentType, rhs: ContentType) => compareStrings(lhs, rhs),
  createTileTree: async (id: ContentType, iModel: IModelConnection) => {
    const content = await createContent(id);
    return new Tree(content, iModel);
  },
}

class Reference extends TileTreeReference {
  public constructor(
    private readonly _type: ContentType,
    private readonly _iModel: IModelConnection
  ) { }

  public get treeOwner() {
    return this._iModel.tiles.getTileTreeOwner(this._type, supplier);
  }
}

class Tree extends TileTree {
  private readonly _rootTile: RootTile;
  private readonly _viewFlagOverrides = new ViewFlagOverrides();
  public readonly styles: AnalysisStyle[];

  public constructor(content: Content, iModel: IModelConnection) {
    super({
      id: content.type,
      modelId: iModel.transientIds.next,
      iModel,
      location: Transform.createIdentity(),
      priority: TileLoadPriority.Primary,
    });

    this._rootTile = new RootTile(content, this);
  }

  public get rootTile(): RootTile { return this._rootTile; }
  public get is3d() { return true; }
  public get maxDepth() { return undefined; }
  public get viewFlagOverrides() { return this._viewFlagOverrides; }

  protected _selectTiles(_args: TileDrawArgs): Tile[] {
    // ###TODO
    return [this.rootTile];
  }

  public draw(_args: TileDrawArgs): void {
    // ###TODO
  }

  public prune(): void {
    // ###TODO
  }
}

class RootTile extends Tile {

  public constructor(mesh: IndexedPolyface, tree: Tree) {
    super({
      isLeaf: true,
      contentId: tree.id,
      range: content.range,
      maximumSize: 512,
    });

    const builder = IModelApp.renderSystem.createGraphicBuilder(
  }
}
*/
export function openAnalysisStyleExample(_viewer: Viewer): void {
}
