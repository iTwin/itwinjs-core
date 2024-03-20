/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelApp } from "../../../IModelApp";
import { EmptyLocalization } from "@itwin/core-common";
import { RenderGraphic } from "../../../render/RenderGraphic";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { GraphicBuilder, GraphicType } from "../../../render/GraphicBuilder";
import { GraphicBranch } from "../../../render/GraphicBranch";

describe.only("Graphic", () => {
  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  after(async () => IModelApp.shutdown());

  function computeRange(graphic: RenderGraphic): Range3d {
    const range = new Range3d();
    graphic.unionRange(range);
    return range;
  }

  function expectRange(graphic: RenderGraphic, expected: Range3d): Range3d {
    const range = computeRange(graphic);
    if (!range.isAlmostEqual(expected)) {
      console.log(`expected: ${JSON.stringify(expected)} actual: ${JSON.stringify(range)}`);
    }

    expect(range.isAlmostEqual(expected)).to.be.true;
    return range;
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
    const lineRange = expectRange(line, new Range3d(-5, 2, -1, 1, 2, 5));

    const point = createGraphic((builder) => builder.addPointString([new Point3d(6, 1, 0)]));
    const pointRange = expectRange(point, new Range3d(6, 1, 0, 6, 1, 0));

    const pointString = createGraphic((builder) => builder.addPointString([new Point3d(0, 0, -1), new Point3d(-4, 12, 0)]));
    const pointStringRange = expectRange(pointString, new Range3d(-4, 0, -1, 0, 12, 0));
    
    const owner = IModelApp.renderSystem.createGraphicOwner(box);
    expectRange(owner, boxRange);

    const primitivesRange = new Range3d();
    for (const primitiveRange of [boxRange, lineRange, pointRange, pointStringRange]) {
      primitivesRange.extendRange(primitiveRange);
    }

    const list = IModelApp.renderSystem.createGraphicList([box, line, point, pointString]);
    const listRange = expectRange(list, primitivesRange);

    
    // Batch just returns its range, doesn't ask children

    // GraphicBranch with and without transform

    
  });
});
