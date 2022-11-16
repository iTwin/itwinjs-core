/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { CustomViewState3dProps } from "@itwin/core-common";
import { SnapshotDb } from "../../IModelDb";
import { CompressedId64Set, Id64String} from "@itwin/core-bentley";
import { IModelTestUtils } from "../IModelTestUtils";
import { CustomViewState3dCreator } from "../../CustomViewState3dCreator";
import { Range3d } from "@itwin/core-geometry";

describe.only("CustomViewState3dCreator", () => {
  let imodel: SnapshotDb;
  afterEach(() => sinon.restore());
  before(() => {
    imodel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("ElementGraphics", "mirukuru.ibim"), IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
  });
  function setsAreEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    return set1.size === set2.size && [...set1].every((value) => set2.has(value));
  }

  it("should get correct data from customviewstate3dcreator", async () => {
    const expectedCatIds = new Set<Id64String>().add("0x17");
    const expectedModelIds = new Set<Id64String>().add("0x1c").add("0x28");
    const expectedModelExtents: Range3d = new Range3d(288874.09375, 3803760.75, -0.0005000000237487257, 289160.84375, 3803959.5, 0.0005000000237487257);

    const customViewStateCreator = new CustomViewState3dCreator(imodel);
    const result: CustomViewState3dProps = await customViewStateCreator.getCustomViewState3dData({});
    const catIds = CompressedId64Set.decompressSet(result.categoryIds);
    const modelIds = CompressedId64Set.decompressSet(result.modelIds);
    assert.isTrue(setsAreEqual(expectedCatIds, catIds));
    assert.isTrue(setsAreEqual(expectedModelIds, modelIds));
    assert.isTrue(expectedModelExtents.isAlmostEqual(Range3d.fromJSON(result.modelExtents)));
  });
  it("should get correct data from customviewstate3dcreator when passing specific modelId", async () => {
    const expectedCatIds = new Set<Id64String>().add("0x17");
    const expectedModelIds = new Set<Id64String>().add("0x28");
    const expectedModelExtents: Range3d = new Range3d(1e200, 1e200, 1e200, -1e200, -1e200, -1e200);

    const customViewStateCreator = new CustomViewState3dCreator(imodel);
    const result: CustomViewState3dProps = await customViewStateCreator.getCustomViewState3dData({modelIds: CompressedId64Set.compressArray(["0x28"])});
    const catIds = CompressedId64Set.decompressSet(result.categoryIds);
    const modelIds = CompressedId64Set.decompressSet(result.modelIds);
    assert.isTrue(setsAreEqual(expectedCatIds, catIds));
    assert.isTrue(setsAreEqual(expectedModelIds, modelIds));
    assert.isTrue(expectedModelExtents.isAlmostEqual(Range3d.fromJSON(result.modelExtents)));
  });
});
