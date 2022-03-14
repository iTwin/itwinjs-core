/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ColorDef, ColorIndex, Feature, FeatureIndex, FeatureTable, LinePixels, PackedFeatureTable, PolylineData, PolylineFlags, QParams3d, QPoint3d, QPoint3dList,
} from "@itwin/core-common";
import {
  IModelApp,
} from "../../../core-frontend";
import {
  PointStringParams, PolylineArgs, VertexIndices, VertexTable, splitPointStringParams,
} from "../../../render-primitives";

interface Point {
  qpos: number; // quantized position - x y and z all have same coordinate.
  color: number; // color index
  feature: number; // feature index
}

function makePointStringParams(points: Point[], colors: ColorDef | ColorDef[]): PointStringParams {
  const colorIndex = new ColorIndex();
  if (colors instanceof ColorDef) {
    colorIndex.initUniform(colors);
  } else {
    const tbgr = new Uint32Array(colors.map((x) => x.tbgr));
    colorIndex.initNonUniform(tbgr, points.map((x) => x.color), false);
  }

  const featureIds = new Set<number>(points.map((x) => x.feature));
  const featureIndex = new FeatureIndex();
  expect(featureIds.size).least(1);
  switch (featureIds.size) {
    case 1:
      featureIndex.featureID = points[0].feature;
      break;
    default:
      featureIndex.featureIDs = new Uint32Array(points.map((x) => x.feature));
      break;
  }

  const qpoints = new QPoint3dList();
  for (const point of points)
    qpoints.push(QPoint3d.fromScalars(point.qpos, point.qpos, point.qpos));

  const args: PolylineArgs = {
    colors: colorIndex,
    features: featureIndex,
    width: 1,
    linePixels: LinePixels.Solid,
    flags: new PolylineFlags(false, true, true),
    points: qpoints,
    polylines: [ new PolylineData([...new Array<number>(points.length).keys()], points.length) ],
  };

  const params = PointStringParams.create(args)!;
  expect(params).not.to.be.undefined;
  return params;
}

function setMaxTextureSize(max: number): void {
  Object.defineProperty(IModelApp.renderSystem, "maxTextureSize", {
    value: max,
    writable: false,
  });
}

function expectPointStrings(params: PointStringParams, _expectedPts: Point[], _expectedColors: ColorDef[]): void {
  expect(params.vertices.numRgbaPerVertex).to.equal(3);
}

describe.only("VertexTableSplitter", () => {
  before(() => IModelApp.startup());
  after(() => IModelApp.shutdown());
  beforeEach(() => setMaxTextureSize(2048));

  it("splits point string params based on node Id", () => {
    const points: Point[] = [
      { qpos: 1, color: 0, feature: 0 },
      { qpos: 0, color: 0, feature: 1 },
      { qpos: 5, color: 0, feature: 2 },
      { qpos: 4, color: 0, feature: 1 },
      { qpos: 2, color: 0, feature: 2 },
    ];

    const featureTable = new FeatureTable(100);
    featureTable.insert(new Feature("0x1"));
    featureTable.insert(new Feature("0x2"));
    featureTable.insert(new Feature("0x10000000002"));

    const params = makePointStringParams(points, ColorDef.red);
    const split = splitPointStringParams(params, PackedFeatureTable.pack(featureTable), IModelApp.renderSystem.maxTextureSize, (id) => id.upper > 0 ? 1 : 0);
    expect(split.size).to.equal(2);
  });

  it("produces uniform color for nodes containing only a single color and sets color indices to zero", () => {
  });

  it("produces color tables containing only colors used by each node and remaps color indices", () => {
  });

  it("produces rectangular vertex tables", () => {
  });
});
