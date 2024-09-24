/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Point3d } from "@itwin/core-geometry";
import { GraphicType, IModelApp, RenderGraphic } from "../../../core-frontend";
import { PrimitiveBuilder } from "../../../internal/render/PrimitiveBuilder";
import { Batch, Branch, GraphicsArray, MeshGraphic } from "../../../webgl";
import { EmptyLocalization } from "@itwin/core-common";

describe("PrimitiveBuilder", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  function makeShape(chordTolerance: number, pickableId?: string): RenderGraphic {
    const pickable = pickableId ? { id: pickableId } : undefined;
    const builder = new PrimitiveBuilder(IModelApp.renderSystem, {
      type: GraphicType.Scene,
      computeChordTolerance: () => chordTolerance,
      pickable,
    });

    builder.addShape([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(1, 1, 0), new Point3d(0, 0, 0)]);
    return builder.finish();
  }

  it("omits degenerate facets", () => {
    const branch = makeShape(0.0001) as Branch;
    expect(branch).toBeInstanceOf(Branch);
    expect(branch.branch.entries.length).toEqual(1);
    expect(branch.branch.entries[0]).toBeInstanceOf(MeshGraphic);

    const array = makeShape(10000.0) as GraphicsArray;
    expect(array).toBeInstanceOf(GraphicsArray);
    expect(array.graphics.length).toEqual(0);
  });

  it("omits empty feature table", () => {
    const batch = makeShape(0.0001, "0x123") as Batch;
    expect(batch).toBeInstanceOf(Batch);
    expect(batch.featureTable.numFeatures).toEqual(1);

    // Previously this would have produced a Batch with an empty FeatureTable, which induced an assertion in PackedFeatureTable.initFromMap.
    const array = makeShape(10000.0, "0x123") as GraphicsArray;
    expect(array).toBeInstanceOf(GraphicsArray);
    expect(array.graphics.length).toEqual(0);
  });
});
