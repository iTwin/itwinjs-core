/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ByteStream } from "@itwin/core-bentley";
import { GltfV2ChunkTypes, GltfVersions, TileFormat } from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { GltfGraphicsReader, GltfReaderProps } from "../../tile/GltfReader";
import { createBlankConnection } from "../createBlankConnection";

const minimalJson = { asset: { version: "02.00" }, meshes: [] };
const minimalBin = new Uint8Array(4);

function setHeader(data: Uint8Array | DataView, length: number, format = TileFormat.Gltf, version = GltfVersions.Version2): void {
  if (data instanceof Uint8Array)
    data = new DataView(data.buffer);

  data.setUint32(0, format, true);
  data.setUint32(4, version, true);
  data.setUint32(8, length, true);
}

interface Chunk {
  len: number;
  type: number;
  data: Uint8Array;
}

interface Header {
  len?: number;
  format: number;
  version: number;
}

describe("GltfReader", () => {
  let iModel: IModelConnection;

  function glbFromChunks(header: Header, chunks: Chunk[]): Uint8Array {
    let numBytes = 12;
    for (const chunk of chunks)
      numBytes += 8 + chunk.len;

    const glb = new Uint8Array(numBytes);
    const view = new DataView(glb.buffer);
    setHeader(view, header.len ?? numBytes, header.format, header.version);

    let chunkStart = 12;
    for (const chunk of chunks) {
      view.setUint32(chunkStart + 0, chunk.len, true);
      view.setUint32(chunkStart + 4, chunk.type, true);
      glb.set(chunk.data, chunkStart + 8);
      chunkStart += chunk.data.length + 8;
    }

    return glb;
  }

  function makeGlb(json: Object | undefined, binary?: Uint8Array, header?: Header): Uint8Array {
    header = header ?? { format: TileFormat.Gltf, version: GltfVersions.Version2 };
    const chunks = [];
    if (json) {
      let jsonStr = JSON.stringify(json);
      while (jsonStr.length %  4 !== 0)
        jsonStr += " ";

      const jsonBytes = new TextEncoder().encode(jsonStr);
      expect(jsonBytes.length).to.equal(jsonStr.length); // we're using pure ASCII.
      chunks.push({ len: jsonBytes.length, type: GltfV2ChunkTypes.JSON, data: jsonBytes });
    }

    if (binary)
      chunks.push({ len: binary.length, type: GltfV2ChunkTypes.Binary, data: binary });

    return glbFromChunks(header, chunks);
  }

  before(async () => {
    await IModelApp.startup();
    iModel = createBlankConnection();
  });

  after(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  function createReader(gltf: Uint8Array): GltfGraphicsReader | undefined {
    const stream = new ByteStream(gltf.buffer);
    const props = GltfReaderProps.create(stream, true);
    return props ? new GltfGraphicsReader(props, { gltf, iModel }) : undefined;
  }

  it("accepts minimal glb", () => {
    const glb = makeGlb(minimalJson, minimalBin);
    expect(createReader(glb)).not.to.be.undefined;
  });

  it("rejects glb with invalid header", () => {
    function test(version: number, format: number, length?: number, expectValid = false) {
      const glb = makeGlb(minimalJson, minimalBin);
      setHeader(glb, length ?? glb.length, format, version);
      const reader = createReader(glb);
      expect(reader !== undefined).to.equal(expectValid);
    }

    test(2, TileFormat.Gltf, 76, true);
    test(3, TileFormat.Gltf);
    test(-1, TileFormat.Gltf);
    test(2, 0xbaadf00d);
    test(2, TileFormat.Gltf, -1);
    test(2, TileFormat.Gltf, 11);
  });

  it("accepts glb with no binary chunk", () => {
  });

  it("rejects glb with no JSON chunk", () => {
  });

  it("ignores unrecognized chunks", () => {
  });

  it("rejects glb with out-of-order chunks", () => {
  });

  it("rejects glb with misaligned chunks", () => {
  });

  it("rejects glb with incorrect chunk lengths", () => {
  });

  it("identifies the scene nodes", () => {
  });

  it("loads only (and all of) the textures referenced by the scene exactly once", async () => {
  });
});
