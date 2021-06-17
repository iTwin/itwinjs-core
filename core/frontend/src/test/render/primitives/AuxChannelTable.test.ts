/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { AuxChannel, AuxChannelData, AuxChannelDataType } from "@bentley/geometry-core";
import { MockRender } from "../../../render/MockRender";
import { AuxChannelTable } from "../../../render/primitives/AuxChannelTable";

describe("AuxChannelTable", () => {
  class System extends MockRender.System {
    public static maxTextureSize = 1024;

    public get maxTextureSize() {
      return System.maxTextureSize;
    }
  }

  before(async () => {
    MockRender.App.systemFactory = () => new System();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
  });

  it("lays out a single channel", () => {
    const data = new AuxChannelData(3, [0, 1000, 100, 0x7fff]);
    const channel = new AuxChannel([data], AuxChannelDataType.Scalar, "s");

    const table = AuxChannelTable.fromChannels([channel], 4)!;
    expect(table).not.to.be.undefined;
    expect(table.data.length).to.equal(8);
    expect(Array.from(new Uint16Array(table.data.buffer))).to.deep.equal([0, 2000, 200, 0xffff]);

    expect(table.width).to.equal(2);
    expect(table.height).to.equal(1);
    expect(table.numVertices).to.equal(4);
    expect(table.numBytesPerVertex).to.equal(2);
    expect(table.displacements).to.be.undefined;
    expect(table.normals).to.be.undefined;
    expect(table.params).not.to.be.undefined;

    expect(table.params!.length).to.equal(1);
    const params = table.params![0];
    expect(params.name).to.equal(channel.name);
    expect(params.inputs).to.deep.equal([data.input]);
    expect(params.indices).to.deep.equal([0]);
    expect(params.qOrigin).to.equal(0);
    expect(params.qScale).to.equal(0xffff / 0x7fff);
  });

  it("interleaves multiple channels", () => {
  });

  it("tightly packs to avoid unused bytes", () => {
  });

  it("produces square table", () => {
  });
});
