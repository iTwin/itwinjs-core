/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/* ###TODO adjust these tests
import { expect } from "chai";
import { WebGLTestContext } from "./WebGLTestContext";
import { VertexLUT, MeshArgs } from "@bentley/imodeljs-frontend/lib/rendering";
import { QParams2d, QPoint3dList, QParams3d, QPoint3d, ColorIndex, FeatureIndexType } from "@bentley/imodeljs-common";
import { Point2d } from "@bentley/geometry-core";

function expectLUTParams(builder: VertexLUT.Builder, colorIndex: ColorIndex, vertexBytes: number[][], expectedColors?: number[]) {
  const params = new VertexLUT.Params(builder, colorIndex);
  const data = params.data;
  let dataIndex = 0;
  for (const bytes of vertexBytes) {
    for (const byte of bytes) {
      expect(data[dataIndex++]).to.equal(byte);
    }
  }

  // Compare appended color table
  expect(undefined === colorIndex.nonUniform).to.equal(undefined === expectedColors);
  if (undefined !== expectedColors) {
    expect(expectedColors.length).to.equal(colorIndex.nonUniform!.colors.length * 4);

    for (const color of expectedColors) {
      expect(data[dataIndex++]).to.equal(color);
    }
  }
}

function testVertexLUTParams() {
  // Make a mesh consisting of a single triangle.
  const positions = new QPoint3dList(QParams3d.fromZeroToOne());
  positions.push(QPoint3d.fromScalars(0, 1, 2));
  positions.push(QPoint3d.fromScalars(0x7fff, 0xf00d, 0xc001));
  positions.push(QPoint3d.fromScalars(0xbaad, 0, 0xffff));

  // Test simple unlit vertices (no normals or uv params; uniform colors + features)
  const args = new MeshArgs();
  args.points = positions;

  const expected = [
    [
      0x00, 0x00, 0x01, 0x00, // pos.x, pos.y
      0x02, 0x00, 0x00, 0x00, // pos.z, color index
      0x00, 0x00, 0x00, 0x00, // feature index
    ],
    [
      0xff, 0x7f, 0x0d, 0xf0,
      0x01, 0xc0, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ],
    [
      0xad, 0xba, 0x00, 0x00,
      0xff, 0xff, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ],
  ];

  expectLUTParams(new VertexLUT.MeshBuilder(args), args.colors, expected);

  // Add uv params
  args.textureUv = [];
  args.textureUv.push(new Point2d(-1, 1));  // 0, 0xffff
  args.textureUv.push(new Point2d(1, 0));   // 0xffff, 0x8000
  args.textureUv.push(new Point2d(0, -1));  // 0x8000, 0

  expected[0].push(0x00); expected[0].push(0x00); expected[0].push(0xff); expected[0].push(0xff);
  expected[1].push(0xff); expected[1].push(0xff); expected[1].push(0x00); expected[1].push(0x80);
  expected[2].push(0x00); expected[2].push(0x80); expected[2].push(0x00); expected[2].push(0x00);

  const qUVParams = QParams2d.fromNormalizedRange();
  expectLUTParams(new VertexLUT.TexturedMeshBuilder(args, qUVParams), args.colors, expected);

  // Add feature IDs
  args.features.type = FeatureIndexType.NonUniform;
  args.features.featureIDs = new Uint32Array(3);
  args.features.featureIDs[0] = 0xbaadf00d;
  args.features.featureIDs[1] = 0xc001bead;
  args.features.featureIDs[2] = 0;

  expected[0][8] = 0x0d; expected[0][9] = 0xf0; expected[0][10] = 0xad; expected[0][11] = 0xba;
  expected[1][8] = 0xad; expected[1][9] = 0xbe; expected[1][10] = 0x01; expected[1][11] = 0xc0;

  expectLUTParams(new VertexLUT.TexturedMeshBuilder(args, qUVParams), args.colors, expected);

  // Remove uv params
  for (const arr of expected) {
    arr.splice(12);
  }

  // Add non-uniform color.
  const colors = new Uint32Array(3);
  colors[0] = 0xffeeddcc;
  colors[1] = 0x00010203;
  colors[2] = 0x7f00ff00;
  const colorIndices = new Uint16Array(3);
  colorIndices[1] = 0x0001;
  colorIndices[2] = 0xffee;
  args.colors.initNonUniform(colors, colorIndices, true);

  expected[0][6] = 0x00; expected[0][7] = 0x00;
  expected[1][6] = 0x01; expected[1][7] = 0x00;
  expected[2][6] = 0xee; expected[2][7] = 0xff;

  // NB: The color values in VertexLUT.Params have premultiplied alpha, and alpha set to (255 - transparency)
  const expectedColors = [
    0x00, 0x00, 0x00, 0x00,
    0x03, 0x02, 0x01, 0xff,
    0x00, 0x80, 0x00, 0x80,
  ];

  expectLUTParams(new VertexLUT.MeshBuilder(args), args.colors, expected, expectedColors);

  // Confirm we can create a texture from a VertexLUT.Params
  const params = new VertexLUT.Params(new VertexLUT.MeshBuilder(args), args.colors);
  const texture = params.toTexture();
  expect(texture).not.to.be.undefined;
  expect(texture!.width).to.equal(params.dimensions.width);
  expect(texture!.height).to.equal(params.dimensions.height);
}

describe("VertexLUT", () => {
  before(() => WebGLTestContext.startup());
  after(() => WebGLTestContext.shutdown());

  it("should produce correct VertexLUT.Params from MeshArgs", () => {
    if (WebGLTestContext.isInitialized) {
      testVertexLUTParams();
    }
  });
});
###TODO adjust these tests */
