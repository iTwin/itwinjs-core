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

describe("GltfReader", () => {
  let iModel: IModelConnection;

  function makeGlb(json: Object, binary?: Uint8Array): Uint8Array {
    let jsonStr = JSON.stringify(json);
    while (jsonStr.length %  4 !== 0)
      jsonStr += " ";

    const jsonBytes = new TextEncoder().encode(jsonStr);
    expect(jsonBytes.length).to.equal(jsonStr.length); // we're using pure ASCII.

    const numHeaderBytes = 12;
    const numJsonBytes = jsonStr.length + 8;
    const numBinaryBytes = binary ? Math.floor(binary.length + 8 + binary.length % 4) : 0;

    const glb = new Uint8Array(numHeaderBytes + numJsonBytes + numBinaryBytes);
    const view = new DataView(glb.buffer);
    const setUint32 = (byteOffset: number, value: number) => view.setUint32(byteOffset, value, true);

    // Header
    setUint32(0, TileFormat.Gltf);
    setUint32(4, GltfVersions.Version2);
    setUint32(8, glb.length);

    // JSON chunk
    setUint32(0xC, jsonBytes.length);
    setUint32(0x10, GltfV2ChunkTypes.JSON);
    glb.set(jsonBytes, 0x14);

    // Binary chunk
    if (binary) {
      const offset = numHeaderBytes + numJsonBytes;
      setUint32(offset, numBinaryBytes - 8);
      setUint32(offset + 4, GltfV2ChunkTypes.Binary);
      glb.set(binary, offset + 8);
    }

    return glb;
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
    const glb = makeGlb({ asset: { version: "02.00" }, meshes: [] }, new Uint8Array(4));
    expect(createReader(glb)).not.to.be.undefined;
  });

  it("rejects glb with invalid header", () => {
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

  it("identifies the scene nodes", () => {
  });

  it("loads only (and all of) the textures referenced by the scene exactly once", async () => {
  });
});
