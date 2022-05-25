/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d } from "@itwin/core-geometry";
import { GraphicType, IModelApp, RenderGraphic } from "../../../core-frontend";
import { PrimitiveBuilder } from "../../../render-primitives";
import { Branch, GraphicsArray, MeshGraphic } from "../../../webgl";

describe("PrimitiveBuilder", () => {
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  function makeShape(chordTolerance: number): RenderGraphic {
    const builder = new PrimitiveBuilder(IModelApp.renderSystem, {
      type: GraphicType.Scene,
      computeChordTolerance: () => chordTolerance,
    });

    builder.addShape([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(1, 1, 0), new Point3d(0, 0, 0)]);
    return builder.finish() as Branch;
  }

  it.only("omits degenerate facets", () => {
    const branch = makeShape(0.0001) as Branch;
    expect(branch).instanceof(Branch);
    expect(branch.branch.entries.length).to.equal(1);
    expect(branch.branch.entries[0]).instanceof(MeshGraphic);

    const array = makeShape(10000.0) as GraphicsArray;
    expect(array).instanceof(GraphicsArray);
    expect(array.graphics.length).to.equal(0);
  });

  it.only("omits empty feature table", () => {
  });
});
