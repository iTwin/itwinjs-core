/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../../IModelApp";
import { EmptyLocalization, Feature, FeatureTable, FillFlags, GraphicParams, PackedFeatureTable } from "@itwin/core-common";
import { RenderGraphic } from "../../../render/RenderGraphic";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { GraphicBuilder } from "../../../render/GraphicBuilder";
import { GraphicBranch } from "../../../render/GraphicBranch";
import { GraphicType } from "../../../common/render/GraphicType";
import { Graphic, GraphicOwner } from "../../../internal/webgl";

describe("Graphic", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  function computeRange(graphic: RenderGraphic): Range3d {
    const range = new Range3d();
    graphic.unionRange(range);
    return range;
  }

  function expectRange(graphic: RenderGraphic, expected: Range3d): Range3d {
    const range = computeRange(graphic);
    expect(range.isAlmostEqual(expected)).toBe(true);
    return range;
  }

  function createGraphic(populate: (builder: GraphicBuilder) => void): Graphic {
    const builder = IModelApp.renderSystem.createGraphic({
      type: GraphicType.Scene,
      computeChordTolerance: () => 0.001,
    });

    populate(builder);
    const graphic = builder.finish();
    expect(graphic).instanceof(Graphic);
    return graphic as Graphic;
  }

  function unionRange(ranges: Range3d[]): Range3d {
    const range = new Range3d();
    for (const r of ranges) {
      range.extendRange(r);
    }

    return range;
  }

  function createBranch(graphics: RenderGraphic[], transform: Transform): Graphic {
    const branch = new GraphicBranch();
    for (const graphic of graphics) {
      branch.add(graphic);
    }

    const graphic = IModelApp.renderSystem.createBranch(branch, transform);
    expect(graphic).instanceof(Graphic);
    return graphic as Graphic;
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
    expectRange(list, primitivesRange);

    const innerTf = Transform.createTranslationXYZ(100, -50, 20);
    const innerBranch = createBranch([box, point], innerTf);
    const innerRange = unionRange([boxRange, pointRange]);
    innerTf.multiplyRange(innerRange, innerRange);
    expectRange(innerBranch, innerRange);

    const outerTf = Transform.createTranslationXYZ(-900, 4, 123);
    const outerBranch = createBranch([innerBranch, line, pointString], outerTf);
    const outerRange = unionRange([innerRange, lineRange, pointStringRange]);
    outerTf.multiplyRange(outerRange, outerRange);
    expectRange(outerBranch, outerRange);

    // Batch just returns its range, doesn't ask children
    const featureTable = PackedFeatureTable.pack(new FeatureTable(10));
    const batchRange = new Range3d(0, 0, 0, 1, 2, 3);
    const batch = IModelApp.renderSystem.createBatch(outerBranch, featureTable, batchRange);
    expectRange(batch, batchRange);

    const batchBranch = createBranch([batch], Transform.createTranslationXYZ(-10, 20, 0));
    expectRange(batchBranch, new Range3d(-10, 20, 0, -9, 22, 3));
  });

  it("determines whether or not it has blanking fill", () => {
    const point = createGraphic((b) => b.addPointString([new Point3d()]));
    const line = createGraphic((b) => b.addLineString([new Point3d(0, 0, 0), new Point3d(1, 1, 1)]));
    const shape = createGraphic((b) => b.addShape([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(1, 1, 0), new Point3d(0, 0, 0)]));
    const blankingShape = createGraphic((b) => {
      const params = new GraphicParams();
      params.fillFlags = FillFlags.Blanking;
      b.activateGraphicParams(params);
      b.addShape([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(1, 1, 0), new Point3d(0, 0, 0)]);
    });

    expect(point.hasBlankingFill).to.be.false;
    expect(line.hasBlankingFill).to.be.false;
    expect(shape.hasBlankingFill).to.be.false;
    expect(blankingShape.hasBlankingFill).to.be.true;

    const shapeOwner = IModelApp.renderSystem.createGraphicOwner(shape) as GraphicOwner;
    expect(shapeOwner.hasBlankingFill).to.be.false;
    const blankingOwner = IModelApp.renderSystem.createGraphicOwner(blankingShape) as GraphicOwner;
    expect(blankingOwner.hasBlankingFill).to.be.true;

    const list = IModelApp.renderSystem.createGraphicList([blankingOwner, shapeOwner]) as Graphic;
    expect(list.hasBlankingFill).to.be.true;

    const features = new FeatureTable(100);
    features.insert(new Feature("0x123"));
    const batch = IModelApp.renderSystem.createBatch(list, features.pack(), new Range3d(0, 0, 0, 1, 1, 1)) as Graphic;
    expect(batch.hasBlankingFill).to.be.true;

    const branch = createBranch([batch], Transform.createIdentity());
    expect(branch.hasBlankingFill).to.be.true;
  });
});
