/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuxChannel, AuxChannelData, AuxChannelDataType, Geometry, Vector3d } from "@itwin/core-geometry";
import { OctEncodedNormal } from "@itwin/core-common";
import { MockRender } from "../../../render/MockRender";
import { AuxChannelTable } from "../../../common/internal/render/AuxChannelTable";

describe("AuxChannelTable", () => {
  class System extends MockRender.System {
    public static maxTextureSize = 1024;

    public override get maxTextureSize() {
      return System.maxTextureSize;
    }
  }

  beforeAll(async () => {
    MockRender.App.systemFactory = () => new System();
    await MockRender.App.startup();
  });

  afterAll(async () => {
    await MockRender.App.shutdown();
  });

  afterEach(() => (System.maxTextureSize = 1024));

  it("lays out a single scalar channel", () => {
    const data = new AuxChannelData(3, [0, 1000, 100, 0x7fff]);
    const channel = new AuxChannel([data], AuxChannelDataType.Scalar, "s");

    const table = AuxChannelTable.fromChannels([channel], 4, System.maxTextureSize)!;
    expect(table).toBeDefined();
    expect(table.data.length).toEqual(8);
    expect(Array.from(new Uint16Array(table.data.buffer))).toEqual([0, 2000, 200, 0xffff]);

    expect(table.width).toEqual(2);
    expect(table.height).toEqual(1);
    expect(table.numVertices).toEqual(4);
    expect(table.numBytesPerVertex).toEqual(2);
    expect(table.displacements).toBeUndefined();
    expect(table.normals).toBeUndefined();
    expect(table.params).toBeDefined();

    expect(table.params!.length).toEqual(1);
    const params = table.params![0];
    expect(params.name).toEqual(channel.name);
    expect(params.inputs).toEqual([data.input]);
    expect(params.indices).toEqual([0]);
    expect(params.qOrigin).toEqual(0);
    expect(params.qScale).toEqual(0x7fff / 0xffff);
  });

  it("lays out a single vector channel tightly packed", () => {
    const data = new AuxChannelData(1, [0, 0, 0x8000, 0x7fff, 0, 0xffff]);
    const channel = new AuxChannel([data], AuxChannelDataType.Vector, "v");

    const table = AuxChannelTable.fromChannels([channel], 2, System.maxTextureSize)!;
    expect(table).toBeDefined();

    expect(table.data.length).toEqual(12);
    expect(Array.from(new Uint16Array(table.data.buffer))).toEqual([0, 0, 0, 0xffff, 0, 0xffff]);

    expect(table.width).toEqual(3);
    expect(table.height).toEqual(1);
    expect(table.numVertices).toEqual(2);
    expect(table.numBytesPerVertex).toEqual(6);
    expect(table.normals).toBeUndefined();
    expect(table.params).toBeUndefined();

    expect(table.displacements!.length).toEqual(1);
    const disp = table.displacements![0];
    expect(disp.name).toEqual(channel.name);
    expect(disp.inputs).toEqual([data.input]);
    expect(disp.indices).toEqual([0]);
    expect(Array.from(disp.qOrigin)).toEqual([0, 0, 0x8000]);
    // Loss of precision when storing in Float32Array...
    const qScale = Array.from(disp.qScale);
    expect(Geometry.isSameCoordinate(qScale[0], 0x7fff / 0xffff, 1 / 0.00001)).toBe(true);
    expect(qScale[1]).toEqual(0);
    expect(Geometry.isSameCoordinate(qScale[2], 0x7fff / 0xffff, 1 / 0.00001)).toBe(true);
  });

  it("lays out a single channel containing multiple data lists", () => {
    const data1 = new AuxChannelData(1, [0, 1, 0, 0, 0, 1]);
    const data2 = new AuxChannelData(2, [1, 0, 0, 0, 0, 1]);
    const channel = new AuxChannel([data1, data2], AuxChannelDataType.Normal, "n");

    const table = AuxChannelTable.fromChannels([channel], 2, System.maxTextureSize)!;
    expect(table).toBeDefined();

    const nx = OctEncodedNormal.encode(Vector3d.unitX());
    const ny = OctEncodedNormal.encode(Vector3d.unitY());
    const nz = OctEncodedNormal.encode(Vector3d.unitZ());
    expect(Array.from(new Uint16Array(table.data.buffer))).toEqual([ny, nx, nz, nz]);

    expect(table.width).toEqual(2);
    expect(table.height).toEqual(1);
    expect(table.numVertices).toEqual(2);

    expect(table.normals!.length).toEqual(1);
    const normals = table.normals![0];
    expect(normals.indices).toEqual([0, 1]);
  });

  it("interleaves multiple channels", () => {
    const data1 = new AuxChannelData(1, [0, 1, 10, 0x7fff]);
    const data2 = new AuxChannelData(2, [0xffff, 0x8000 + 100, 0x8000 + 1000, 0x8000]);
    const channels = [new AuxChannel([data1], AuxChannelDataType.Distance, "d"), new AuxChannel([data2], AuxChannelDataType.Scalar, "s")];

    const table = AuxChannelTable.fromChannels(channels, 4, System.maxTextureSize)!;
    expect(table).toBeDefined();
    const tableData = Array.from(new Uint16Array(table.data.buffer));
    expect(tableData).toEqual([0, 0xffff, 2, 200, 20, 2000, 0xffff, 0]);

    expect(table.width).toEqual(4);
    expect(table.height).toEqual(1);
    expect(table.numVertices).toEqual(4);
    expect(table.displacements).toBeUndefined();
    expect(table.normals).toBeUndefined();
    expect(table.params!.length).toEqual(2);
    expect(table.params![0].name).toEqual("d");
    expect(table.params![0].indices).toEqual([0]);
    expect(table.params![1].name).toEqual("s");
    expect(table.params![1].indices).toEqual([1]);
  });

  it("produces roughly square table", () => {
    const data = new AuxChannelData(42, [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8]);
    const channel = new AuxChannel([data], AuxChannelDataType.Scalar, "s");
    function test(maxSize: number, expectedWidth: number, expectedHeight: number): void {
      System.maxTextureSize = maxSize;
      const table = AuxChannelTable.fromChannels([channel], data.values.length, System.maxTextureSize)!;
      expect(table.width).toEqual(expectedWidth);
      expect(table.height).toEqual(expectedHeight);
    }

    test(3, 3, 3);
    test(4, 3, 3);
    test(5, 3, 3);
    test(6, 3, 3);
    test(7, 3, 3);
    test(8, 3, 3);
    test(9, 8, 1);
    test(10, 8, 1);
    test(11, 8, 1);
    test(4096, 8, 1);
  });
});
