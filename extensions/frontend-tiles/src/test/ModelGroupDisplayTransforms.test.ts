/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ModelDisplayTransform, ModelDisplayTransformProvider } from "@itwin/core-frontend";
import { ModelGroupDisplayTransforms } from "../ModelGroupDisplayTransforms";
import { Transform } from "@itwin/core-geometry";

describe("ModelGroupDisplayTransforms", () => {
  it("detects whether groupings have changed", () => {
    function createProvider(transforms: Array<ModelDisplayTransform & { modelId: string }>): ModelDisplayTransformProvider {
      return {
        getModelDisplayTransform: (modelId: string) => transforms.find((x) => x.modelId === modelId),
      };
    }

    function createTransform(modelId: string, ox: number, premultiply?: boolean): ModelDisplayTransform & { modelId: string } {
      return { modelId, transform: Transform.createTranslationXYZ(ox, 0, 0), premultiply };
    }

    const viewedModels = new Set(["0x1", "0x2", "0x3", "0x4", "0x5", "0x6"]);
    const tfs = new ModelGroupDisplayTransforms(viewedModels);

    function update(prov: ModelDisplayTransformProvider | undefined): boolean {
      const prevGuid = tfs.guid;
      const updated = tfs.update(prov);
      const newGuid = tfs.guid;
      expect(prevGuid !== newGuid).to.equal(updated);
      return updated;
    }

    expect(update(undefined)).to.be.false;
    expect(update(createProvider([]))).to.be.false;

    let provider = createProvider([ createTransform("0x1", 1) ]);
    expect(update(provider)).to.be.true;
    expect(update(provider)).to.be.false;
    expect(update(undefined)).to.be.true;

    // Non-existent model not grouped.
    expect(update(createProvider([createTransform("0xabcdef", 1)]))).to.be.false;

    const list = [createTransform("0x1", 1)];
    provider = createProvider(list);
    expect(update(provider)).to.be.true;
    list[0].transform = Transform.createTranslationXYZ(2, 3, 4);
    expect(update(provider)).to.be.false;
    list[0].premultiply = true;
    expect(update(provider)).to.be.false;
    list.push(createTransform("0x2", 2));
    expect(update(provider)).to.be.true;
    list[0].transform = list[1].transform.clone();
    expect(update(provider)).to.be.false; // premultiply values differ, so grouping remains unchanged.
    list[0].premultiply = list[1].premultiply;
    expect(update(provider)).to.be.true; // both transforms are now equivalent, so the two models get grouped.

    provider = createProvider(list);
    expect(update(provider)).to.be.false; // different provider, same grouping.

    list.push(createTransform("0x5", 5));
    expect(update(provider)).to.be.true;
    list.splice(0, 1);
    expect(update(provider)).to.be.true;
    list.splice(1, 1);
    expect(update(provider)).to.be.true;
  });
});
