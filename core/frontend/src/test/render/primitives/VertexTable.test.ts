/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point2d, Point3d, Range3d } from "@itwin/core-geometry";
import { ColorIndex, FeatureIndex, FeatureIndexType, FillFlags, QParams2d, QParams3d, QPoint3d, QPoint3dList, RenderTexture } from "@itwin/core-common";
import { MockRender } from "../../../render/MockRender";
import { Point3dList } from "../../../common/render/primitives/MeshPrimitive";
import { MeshArgs } from "../../../render/primitives/mesh/MeshPrimitives";
import { IModelApp } from "../../../IModelApp";
import { createMeshParams } from "../../../render/primitives/VertexTableBuilder";

function expectMeshParams(args: MeshArgs, colorIndex: ColorIndex, vertexBytes: number[][], expectedColors?: number[], quvParams?: QParams2d) {
  const params = createMeshParams(args, IModelApp.renderSystem.maxTextureSize);

  // Compare vertex table bytes
  const data = params.vertices.data;
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

  if (undefined !== quvParams) {
    const compParams = params.vertices.uvParams!;
    expect(compParams).not.to.be.undefined;
    expect(quvParams.origin.x).to.equal(compParams.origin.x);
    expect(quvParams.origin.y).to.equal(compParams.origin.y);
    expect(quvParams.scale.x).to.equal(compParams.scale.x);
    expect(quvParams.scale.y).to.equal(compParams.scale.y);
  }
}

class FakeTexture extends RenderTexture {
  public constructor() { super(RenderTexture.Type.Normal); }
  public dispose() { }
  public get bytesUsed(): number { return 0; }
}

describe("VertexLUT", () => {
  before(async () => MockRender.App.startup());
  after(async () => MockRender.App.shutdown());

  it("should produce correct VertexLUT.Params from quantized MeshArgs", () => {
    // Make a mesh consisting of a single triangle.
    const positions = new QPoint3dList(QParams3d.fromZeroToOne());
    positions.push(QPoint3d.fromScalars(0, 1, 2));
    positions.push(QPoint3d.fromScalars(0x7fff, 0xf00d, 0xc001));
    positions.push(QPoint3d.fromScalars(0xbaad, 0, 0xffff));

    // Test simple unlit vertices (no normals or uv params; uniform colors + features)
    const args: MeshArgs = {
      points: positions,
      vertIndices: [0, 1, 2],
      colors: new ColorIndex(),
      features: new FeatureIndex(),
      fillFlags: FillFlags.None,
    };

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

    expectMeshParams(args, args.colors, expected);

    // Add uv params
    args.textureMapping = {
      texture: new FakeTexture(),
      // quantized: (0, 0xffff),      (0xffff, 0x8000),   (0x8000, 0)
      uvParams: [new Point2d(-1, 1), new Point2d(1, 0), new Point2d(0, -1)],
    };

    expected[0].push(0x00);
    expected[0].push(0x00);
    expected[0].push(0xff);
    expected[0].push(0xff);
    expected[1].push(0xff);
    expected[1].push(0xff);
    expected[1].push(0x00);
    expected[1].push(0x80);
    expected[2].push(0x00);
    expected[2].push(0x80);
    expected[2].push(0x00);
    expected[2].push(0x00);

    const qUVParams = QParams2d.fromNormalizedRange();
    expectMeshParams(args, args.colors, expected, undefined, qUVParams);

    // Add feature IDs
    args.features.type = FeatureIndexType.NonUniform;
    args.features.featureIDs = new Uint32Array(3);
    args.features.featureIDs[0] = 0xbaadf00d;
    args.features.featureIDs[1] = 0xc001bead;
    args.features.featureIDs[2] = 0;

    expected[0][8] = 0x0d;
    expected[0][9] = 0xf0;
    expected[0][10] = 0xad;
    expected[0][11] = 0xba;
    expected[1][8] = 0xad;
    expected[1][9] = 0xbe;
    expected[1][10] = 0x01;
    expected[1][11] = 0xc0;

    expectMeshParams(args, args.colors, expected);

    // Remove uv params
    args.textureMapping = undefined;
    for (const arr of expected) {
      arr.splice(12);
    }

    // Add non-uniform color.
    const colors = new Uint32Array(3);
    colors[0] = 0xffeeddcc;
    colors[1] = 0x00010203;
    colors[2] = 0x7f00ff00;
    const colorIndices = [0, 0x0001, 0xffee];
    args.colors.initNonUniform(colors, colorIndices, true);

    expected[0][6] = 0x00;
    expected[0][7] = 0x00;
    expected[1][6] = 0x01;
    expected[1][7] = 0x00;
    expected[2][6] = 0xee;
    expected[2][7] = 0xff;

    // NB: The color values in VertexLUT.Params have premultiplied alpha, and alpha set to (255 - transparency)
    const expectedColors = [
      0x00, 0x00, 0x00, 0x00,
      0x03, 0x02, 0x01, 0xff,
      0x00, 0x80, 0x00, 0x80,
    ];

    expectMeshParams(args, args.colors, expected, expectedColors);
  });

  it("should produce correct VertexLUT.Params from unquantized MeshArgs", () => {
    // Make a mesh consisting of a single triangle
    const positions = [
      new Point3d(0, 1, 2),
      new Point3d(-1, 0, 1),
      new Point3d(12.34, 99999.9, -98.76),
    ] as Point3dList;

    positions.range = Range3d.createArray(positions);
    const args: MeshArgs = {
      points: positions,
      vertIndices: [0, 1, 2],
      colors: new ColorIndex(),
      features: new FeatureIndex(),
      fillFlags: FillFlags.None,
    };

    const makeExpected = () => [
      [
        0x00, 0x00, 0x00, 0x00, // pos.x
        0x00, 0x00, 0x80, 0x3f, // pos.y
        0x00, 0x00, 0x00, 0x40, // pos.z
        0x00, 0x00, 0x00, 0x00, // feature index
        0x00, 0x00, 0x00, 0x00, // color index; unused
      ],
      [
        0x00, 0x00, 0x80, 0xbf,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x80, 0x3f,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
      ],
      [
        0xa4, 0x70, 0x45, 0x41,
        0xf3, 0x4f, 0xc3, 0x47,
        0x1f, 0x85, 0xc5, 0xc2,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
      ],
    ];

    // We changed the layout of the vertex table to transpose the positions, feature index, and material index.
    // It's easier to read/write the way we have it in these tests though.
    // So perform the transposition last (on a copy of the input).
    const transpose = (inputTable: number[][]): number[][] => {
      const outputTable: number[][] = [];
      for (const input of inputTable) {
        const output = [...input];
        const swap = (i0: number, i1: number) => {
          output[i0] = input[i1];
          output[i1] = input[i0];
        };

        swap(1, 4);
        swap(2, 8);
        swap(3, 12);
        swap(6, 9);
        swap(7, 13);
        swap(11, 14);

        outputTable.push(output);
      }

      return outputTable;
    };

    expectMeshParams(args, args.colors, transpose(makeExpected()));

    // Add uv params
    args.textureMapping = {
      texture: new FakeTexture(),
      // quantized: (0, 0xffff),      (0xffff, 0x8000),   (0x8000, 0)
      uvParams: [new Point2d(-1, 1), new Point2d(1, 0), new Point2d(0, -1)],
    };

    const exp = makeExpected();
    exp[0][16] = 0x00;
    exp[0][17] = 0x00;
    exp[0][18] = 0xff;
    exp[0][19] = 0xff;
    exp[1][16] = 0xff;
    exp[1][17] = 0xff;
    exp[1][18] = 0x00;
    exp[1][19] = 0x80;
    exp[2][16] = 0x00;
    exp[2][17] = 0x80;
    exp[2][18] = 0x00;
    exp[2][19] = 0x00;

    expectMeshParams(args, args.colors, transpose(exp), undefined, QParams2d.fromNormalizedRange());

    // Add feature IDs
    args.features.type = FeatureIndexType.NonUniform;
    args.features.featureIDs = new Uint32Array(3);
    args.features.featureIDs[0] = 0xbaadf00d;
    args.features.featureIDs[1] = 0xc001bead;
    args.features.featureIDs[2] = 0;

    exp[0][12] = 0x0d;
    exp[0][13] = 0xf0;
    exp[0][14] = 0xad;
    exp[0][15] = 0xba;
    exp[1][12] = 0xad;
    exp[1][13] = 0xbe;
    exp[1][14] = 0x01;
    exp[1][15] = 0xc0;

    expectMeshParams(args, args.colors, transpose(exp));

    // Remove texture and add non-uniform color
    args.textureMapping = undefined;
    const colors = new Uint32Array(3);
    colors[0] = 0xffeeddcc;
    colors[1] = 0x00010203;
    colors[2] = 0x7f00ff00;
    const colorIndices = [0, 0x0001, 0xffee];
    args.colors.initNonUniform(colors, colorIndices, true);

    exp[0][18] = exp[0][19] = 0;
    exp[1][16] = 0x01;
    exp[1][17] = 0x00;
    exp[1][18] = exp[1][19] = 0;
    exp[2][16] = 0xee;
    exp[2][17] = 0xff;
    exp[2][18] = exp[2][19] = 0;

    // NB: The color values in VertexLUT.Params have premultiplied alpha, and alpha set to (255 - transparency)
    const expectedColors = [
      0x00, 0x00, 0x00, 0x00,
      0x03, 0x02, 0x01, 0xff,
      0x00, 0x80, 0x00, 0x80,
    ];

    expectMeshParams(args, args.colors, transpose(exp), expectedColors);
  });
});
