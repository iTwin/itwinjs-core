/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { compareStrings } from "@bentley/bentleyjs-core";
import {
  Range3d,
  Transform,
} from "@bentley/geometry-core";
import { ViewFlagOverrides } from "@bentley/imodeljs-common";
import {
  IModelApp,
  IModelConnection,
  RenderSystem,
  SnapshotConnection,
  Tile,
  TileContent,
  TileDrawArgs,
  TileLoadPriority,
  TileRequest,
  TileTree,
} from "@bentley/imodeljs-frontend";

class MockTile extends Tile {
  protected _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    resolve([]);
  }

  public async requestContent(_canceled: () => boolean): Promise<TileRequest.Response> {
    return undefined;
  }

  public async readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _canceled?: () => boolean): Promise<TileContent> {
    return Promise.resolve({ });
  }

  public constructor(tree: TileTree) {
    super({
      contentId: "tile",
      range: new Range3d(),
      maximumSize: 512,
    }, tree);
  }
}

class MockTree extends TileTree {
  private _rootTile: Tile;

  public constructor(id: string, iModel: IModelConnection) {
    super({
      id,
      iModel,
      modelId: "0x2a",
      location: Transform.createIdentity(),
      priority: TileLoadPriority.Primary,
    });

    this._rootTile = new MockTile(this);
  }

  public get rootTile() { return this._rootTile; }
  public get is3d() { return true; }
  public get maxDepth() { return 1; }
  public get viewFlagOverrides() { return new ViewFlagOverrides(); }
  public get isContentUnbounded() { return false; }

  protected _selectTiles(_args: TileDrawArgs): Tile[] {
    return [];
  }

  public draw(_args: TileDrawArgs): void { }
  public prune(): void { }
}

describe("TileTreeSupplier", () => {
  let imodel: IModelConnection;

  before(async () => {
    IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    IModelApp.shutdown();
  });

  it("should be discarded when ecef location is modified if tiles are ecef-dependent", async () => {
    class Supplier {
      public readonly isEcefDependent?: true;

      public constructor(isEcefDependent: boolean) {
        if (isEcefDependent)
          this.isEcefDependent = true;
      }

      public compareTileTreeIds(lhs: string, rhs: string): number {
        return compareStrings(lhs, rhs);
      }

      public async createTileTree(id: string, iModel: IModelConnection): Promise<TileTree | undefined> {
        return Promise.resolve(new MockTree(id, iModel));
      }
    }

    const ecefSup = new Supplier(true);
    const nonEcefSup = new Supplier(false);
    const ecefOwner = imodel.tiles.getTileTreeOwner("ecef", ecefSup);
    const nonEcefOwner = imodel.tiles.getTileTreeOwner("nonEcef", nonEcefSup);

    const ecefTree = (await ecefOwner.loadTree())!;
    const nonEcefTree = (await nonEcefOwner.loadTree())!;
    expect(ecefTree).not.to.be.undefined;
    expect(nonEcefTree).not.to.be.undefined;

    expect(ecefTree.isDisposed).to.be.false;
    expect(nonEcefTree.isDisposed).to.be.false;

    imodel.setEcefLocation({
      origin: [0, 0, 0],
      orientation: {
        yaw: 0,
        pitch: 0,
        roll: 0,
      },
    });

    expect(ecefTree.isDisposed).to.be.true;
    expect(nonEcefTree.isDisposed).to.be.false;

    const ecefTree2 = (await ecefOwner.loadTree())!;
    const nonEcefTree2 = (await nonEcefOwner.loadTree())!;
    expect(ecefTree2).not.to.be.undefined;
    expect(nonEcefTree2).not.to.be.undefined;

    expect(ecefTree2.isDisposed).to.be.false;
    expect(nonEcefTree2.isDisposed).to.be.false;

    expect(ecefTree2).not.to.equal(ecefTree);
    expect(nonEcefTree2).to.equal(nonEcefTree);
  });
});
