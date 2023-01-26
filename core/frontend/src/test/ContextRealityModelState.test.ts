/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { Code, ContextRealityModelProps, EmptyLocalization } from "@itwin/core-common";
import { DisplayStyle3dState } from "../DisplayStyleState";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { TileTreeOwner } from "../tile/internal";
import { createBlankConnection } from "./createBlankConnection";

describe.only("ContextRealityModelState", () => {
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    imodel = createBlankConnection();
  });

  afterEach(() => {
    imodel.tiles.reset();
  });

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  interface Tree {
    id: Id64String;
    owner: TileTreeOwner;
  }

  class Style extends DisplayStyle3dState {
    public constructor() {
      super({
        id: "0",
        code: Code.createEmpty(),
        model: IModelConnection.dictionaryId,
        classFullName: "BisCore:DisplayStyle3d",
      }, imodel);
    }

    public get trees(): Tree[] {
      const trees: Tree[] = [];
      this.forEachRealityModel((model) => {
        expect(model.modelId).not.to.be.undefined;
        expect(Id64.isTransient(model.modelId!)).to.be.true;
        trees.push({
          id: model.modelId!,
          owner: model.treeRef.treeOwner,
        });
      });

      return trees;
    }

    public expectTrees(modelIds: Id64String[]): void {
      const trees = this.trees;
      expect(trees.length).to.equal(modelIds.length);
      for (let i = 0; i < trees.length; i++)
        expect(trees[i].id).to.equal(modelIds[i]);

      // Any context reality models with the same modelId should point to the same TileTreeOwner.
      for (const a of trees)
        for (const b of trees)
          expect(a.id === b.id).to.equal(a.owner === b.owner);
    }
  }

  it("has a unique tree within a view", () => {
    const style = new Style();
    style.expectTrees([]);

    const a = imodel.transientIds.peekNext();
    style.attachRealityModel({ tilesetUrl: "a" });
    style.expectTrees([a]);
  });

  it("shares compatible trees between views", () => {
  });

  it("does not share trees with persistent reality models", () => {
  });

  it("keeps same modelId but gets new TileTreeOwner when settings change", () => {
  });
});
