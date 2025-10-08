/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import { EmptyLocalization, Feature, FeatureTable, GeometryClass, RenderFeatureTable } from "@itwin/core-common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createElementIndexLUT } from "../../../internal/render/webgl/Graphic";
import { IModelApp } from "../../../IModelApp";

function makeFeatureTable(features: Array<Feature | Id64String>): RenderFeatureTable {
  const table = new FeatureTable(features.length);
  for (const featureOrElementId of features) {
    const feature = featureOrElementId instanceof Feature ? featureOrElementId : new Feature(featureOrElementId);
    table.insert(feature);
  }

  return table.pack();
}

describe("createElementIndexLUT", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("allocates consecutive indices beginning at 1", () => {
    const ft = makeFeatureTable(["0x1", "0x2", "0x345", "0x4"]);
    const bytes = createElementIndexLUT(ft, 100, true)!.handle.dataBytes!;
    const indices = new Uint32Array(bytes.buffer);
    for (let i = 0; i < 4; i++) {
      expect(indices[i]).to.equal(i + 1);
    }
  });

  it("allocates one index per unique element", () => {
    const ft = makeFeatureTable([
      new Feature("0x1"),
      new Feature("0x1", "0xa"),
      new Feature("0x1", undefined, GeometryClass.Construction),
      new Feature("0x2", "0xa"),
      new Feature("0x345"),
      new Feature("0x2", "0xa", GeometryClass.Construction),
      new Feature("0x1", "0xd"),
      new Feature("0x4"),
      new Feature("0x1", "0xa", GeometryClass.Pattern),
      new Feature("0x345", "0xc"),
    ]);

    const indices = new Uint32Array(createElementIndexLUT(ft, 100, true)!.handle.dataBytes!.buffer);
    const expectedIndices = [ 1, 1, 1, 2, 3, 2, 1, 4, 1, 3 ];
    expect(indices.length).to.equal(expectedIndices.length);
    for (let i = 0; i < indices.length; i++) {
      expect(indices[i]).to.equal(expectedIndices[i]);
    }
  });

  it("produces a square texture", () => {
    const ft = makeFeatureTable(["0x1", "0x2", "0x345", "0x4", "0x5"]);
    const lut = createElementIndexLUT(ft, 3, true)!;
    expect(lut.handle.width).to.equal(3);
    expect(lut.handle.height).to.equal(2);
    expect(lut.handle.dataBytes!.length).to.equal(3 * 2 * 4);
  });
});
