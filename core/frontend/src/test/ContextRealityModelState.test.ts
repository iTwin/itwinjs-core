/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import {
  Code, ContextRealityModelProps, EmptyLocalization, PlanarClipMaskMode, PlanarClipMaskProps, PlanarClipMaskSettings,
} from "@itwin/core-common";
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

  const planarClipMask: PlanarClipMaskProps = {
    mode: PlanarClipMaskMode.Models,
    modelIds: "+123",
  };

  it("has a unique tree within a view", () => {
    const style = new Style();
    style.expectTrees([]);

    const a = imodel.transientIds.peekNext();
    style.attachRealityModel({ tilesetUrl: "a" });
    style.expectTrees([a]);

    const b = imodel.transientIds.peekNext();
    style.attachRealityModel({ tilesetUrl: "b" });
    style.expectTrees([a, b]);

    const bMask = imodel.transientIds.peekNext();
    style.attachRealityModel({ tilesetUrl: "b", planarClipMask });
    style.expectTrees([a, b, bMask]);
  });

  it("shares compatible trees between views", () => {
    const s1 = new Style();
    const s2 = new Style();

    const a = imodel.transientIds.peekNext();
    s1.attachRealityModel({ tilesetUrl: "a" });
    s1.expectTrees([a]);

    const b = imodel.transientIds.peekNext();
    s1.attachRealityModel({ tilesetUrl: "b" });
    s2.attachRealityModel({ tilesetUrl: "b" });
    s2.expectTrees([b]);
    s1.expectTrees([a, b]);

    const bMask = imodel.transientIds.peekNext();
    s2.attachRealityModel({ tilesetUrl: "b", planarClipMask });
    s2.expectTrees([b, bMask]);

    s1.attachRealityModel({ tilesetUrl: "b", planarClipMask });
    s1.expectTrees([a, b, bMask]);

    s2.attachRealityModel({ tilesetUrl: "a" });
    s2.expectTrees([b, bMask, a]);
  });

  it("does not share trees with persistent reality models", () => {
    // ###TODO need a way to test this...
  });

  it("keeps same modelId but gets new TileTreeOwner when settings change", () => {
    const style = new Style();
    const id = imodel.transientIds.peekNext();
    style.attachRealityModel({ tilesetUrl: "a" });
    style.expectTrees([id]);
    const a = style.trees[0].owner;

    style.forEachRealityModel((model) => model.planarClipMaskSettings = PlanarClipMaskSettings.fromJSON(planarClipMask));
    style.expectTrees([id]);
    const b = style.trees[0].owner;
    expect(b).not.to.equal(a);

    style.forEachRealityModel((model) => model.planarClipMaskSettings = undefined);
    style.expectTrees([id]);
    expect(style.trees[0].owner).to.equal(a);
  });
});
