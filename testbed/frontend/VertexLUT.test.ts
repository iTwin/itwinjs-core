/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { WebGLTestContext } from "./WebGLTestContext";
import { VertexLUT, MeshArgs } from "@bentley/imodeljs-frontend/lib/rendering";
import { QPoint3dList, QParams3d, QPoint3d, ColorIndex } from "@bentley/imodeljs-common";

function expectLUTParams(builder: VertexLUT.Builder, colorIndex: ColorIndex, vertexBytes: number[][]) {
  const params = new VertexLUT.Params(builder, colorIndex);
  const data = params.data;
  let dataIndex = 0;
  for (const bytes of vertexBytes) {
    for (const byte of bytes) {
      expect(data[dataIndex++]).to.equal(byte);
    }
  }

  // ###TODO compare appended color table bytes...
}

function testVertexLUTParams() {
  // Make a mesh consisting of a single triangle.
  const positions = new QPoint3dList(QParams3d.fromZeroToOne());
  positions.push(QPoint3d.fromScalars(0, 1, 2));
  positions.push(QPoint3d.fromScalars(0x7fff, 0xf00d, 0xc001));
  positions.push(QPoint3d.fromScalars(0xbaad, 0, 0xffff));

  const args = new MeshArgs();
  args.points = positions.toTypedArray();
  args.pointParams = positions.params;

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
