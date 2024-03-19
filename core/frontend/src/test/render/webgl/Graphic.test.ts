/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelApp } from "../../../IModelApp";
import { EmptyLocalization } from "@itwin/core-common";
import { RenderGraphic } from "../../../render/RenderGraphic";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { GraphicBuilder, GraphicType } from "../../../render/GraphicBuilder";

describe.only("Graphic", () => {
  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  after(async () => IModelApp.shutdown());

  function computeRange(graphic: RenderGraphic): Range3d {
    const range = new Range3d();
    graphic.unionRange(range);
    return range;
  }

  function expectRange(graphic: RenderGraphic, expected: Range3d): void {
    const range = computeRange(graphic);
    expect(range.isAlmostEqual(expected)).to.be.true;
    // expect(range.low.x).to.equal(expected.low.x);
    // expect(range.low.y).to.equal(expected.low.y);
    // expect(range.low.z).to.equal(expected.low.z);
    // expect(range.high.x).to.equal(expected.high.x);
    // expect(range.high.y).to.equal(expected.high.y);
    // expect(range.high.z).to.equal(expected.high.z);
  }

  function createGraphic(populate: (builder: GraphicBuilder) => void): RenderGraphic {
    const builder = IModelApp.renderSystem.createGraphic({
      type: GraphicType.Scene,
      computeChordTolerance: () => 0.001,
    });

    populate(builder);
    return builder.finish();
  }

  it("computes range", () => {
    const boxRange = new Range3d(0, -1, -2, 1, 2, 3);
    const box = createGraphic((builder) => builder.addRangeBox(boxRange));
    expectRange(box, boxRange);

    const line = createGraphic((builder) => builder.addLineString([new Point3d(1, 2, -1), new Point3d(-5, 2, 5)]));
    expectRange(line, new Range3d(-5, 2, -1, 1, 2, 5));

    const point = createGraphic((builder) => builder.addPointString([new Point3d(6, 1, 0)]));
    expectRange(point, new Range3d(6, 1, 0, 6, 1, 0));

    const pointString = createGraphic((builder) => builder.addPointString([new Point3d(0, 0, -1), new Point3d(-4, 12, 0)]));
    expectRange(pointString, new Range3d(-4, 0, -1, 0, 12, 0));
    


    
    // Point string
    // Single point
    // Line string
    // Mesh (range box)

    // Instanced versions

    // GraphicOwner
    
    // GraphicList

    // Batch just returns its range, doesn't ask children

    // GraphicBranch with and without transform

    
  });
});
