/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ByteStream } from "@itwin/core-bentley";
import { GltfV2ChunkTypes, GltfVersions, TileFormat } from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { Gltf, GltfGraphicsReader, GltfId, GltfReaderProps } from "../../tile/GltfReader";
import { createBlankConnection } from "../createBlankConnection";

const minimalBin = new Uint8Array([12, 34, 0xfe, 0xdc]);
const minimalJson = { asset: { version: "02.00" }, meshes: [] };

function jsonToBytes(json: Object, alignment = 4): Uint8Array {
  let str = JSON.stringify(json);
  while (str.length % alignment !== 0)
    str += " ";

  const bytes = new TextEncoder().encode(str);
  expect(bytes.length).to.equal(str.length); // pure ASCII
  return bytes;
}

function setHeader(data: Uint8Array | DataView, length: number, format = TileFormat.Gltf, version = GltfVersions.Version2): void {
  if (data instanceof Uint8Array)
    data = new DataView(data.buffer);

  data.setUint32(0, format, true);
  data.setUint32(4, version, true);
  data.setUint32(8, length, true);
}

interface Chunk {
  len?: number;
  type: number;
  data: Uint8Array;
}

interface Header {
  len?: number;
  format: number;
  version: number;
}

function glbFromChunks(chunks: Chunk[], header?: Header): Uint8Array {
  let numBytes = 12;
  for (const chunk of chunks)
    numBytes += 8 + (chunk.len ?? chunk.data.length);

  const glb = new Uint8Array(numBytes);
  const view = new DataView(glb.buffer);

  header = header ?? { format: TileFormat.Gltf, version: GltfVersions.Version2 };
  setHeader(view, header.len ?? numBytes, header.format, header.version);

  let chunkStart = 12;
  for (const chunk of chunks) {
    view.setUint32(chunkStart + 0, chunk.len ?? chunk.data.length, true);
    view.setUint32(chunkStart + 4, chunk.type, true);
    glb.set(chunk.data, chunkStart + 8);
    chunkStart += chunk.data.length + 8;
  }

  return glb;
}

function makeGlb(json: Object | undefined, binary?: Uint8Array, header?: Header): Uint8Array {
  const chunks = [];
  if (json)
    chunks.push({ type: GltfV2ChunkTypes.JSON, data: jsonToBytes(json) });

  if (binary)
    chunks.push({ type: GltfV2ChunkTypes.Binary, data: binary });

  return glbFromChunks(chunks, header);
}

function expectBinaryData(reader: GltfGraphicsReader, expected: Uint8Array): void {
  expect(Array.from(reader.binaryData)).to.deep.equal(Array.from(expected));
}

describe.only("GltfReader", () => {
  let iModel: IModelConnection;

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
    const reader = createReader(glb)!;
    expect(reader).not.to.be.undefined;
    expectBinaryData(reader, minimalBin);
  });

  it("rejects glb with invalid header", () => {
    function test(version: number, format: number, length?: number, expectValid = false) {
      const glb = makeGlb(minimalJson, minimalBin);
      setHeader(glb, length ?? glb.length, format, version);
      const reader = createReader(glb);
      expect(reader !== undefined).to.equal(expectValid);
    }

    // Valid.
    test(2, TileFormat.Gltf, 76, true);

    // Unrecognized version
    test(3, TileFormat.Gltf);
    test(-1, TileFormat.Gltf);

    // Unrecognized format
    test(2, 0xbaadf00d);

    // Invalid length
    test(2, TileFormat.Gltf, -1);

    // Length smaller than header
    test(2, TileFormat.Gltf, 11);

    // Inaccurate length
    test(2, TileFormat.Gltf, 75);
    test(2, TileFormat.Gltf, 77);
  });

  it("accepts glb with no binary chunk", () => {
    const glb = glbFromChunks([{ data: jsonToBytes(minimalJson), type: GltfV2ChunkTypes.JSON }]);
    const reader = createReader(glb)!;
    expect(reader).not.to.be.undefined;
    expect(reader.binaryData).to.be.undefined;
  });

  it("rejects glb with no JSON chunk", () => {
    const glb = glbFromChunks([{ data: minimalBin, type: GltfV2ChunkTypes.Binary }]);
    expect(createReader(glb)).to.be.undefined;
  });

  it("rejects glb with multiple binary chunks", () => {
    const glb = glbFromChunks([{
      data: jsonToBytes(minimalJson), type: GltfV2ChunkTypes.JSON,
    }, {
      data: minimalBin, type: GltfV2ChunkTypes.Binary,
    }, {
      data: minimalBin, type: GltfV2ChunkTypes.Binary,
    }]);

    expect(createReader(glb)).to.be.undefined;
  });

  it("ignores unrecognized chunks", () => {
    const chunks = [{
      data: jsonToBytes(minimalJson), type: GltfV2ChunkTypes.JSON,
    }, {
      data: minimalBin, type: GltfV2ChunkTypes.Binary,
    }];

    chunks.push({ data: minimalBin, type: 0xdeadbeef });
    const glb = glbFromChunks(chunks);
    const reader = createReader(glb)!;
    expect(reader).not.to.be.undefined;
    expectBinaryData(reader, minimalBin);
  });

  it("rejects glb with out-of-order chunks", () => {
    const glb = glbFromChunks([{
      data: minimalBin, type: GltfV2ChunkTypes.Binary,
    }, {
      data: jsonToBytes(minimalJson), type: GltfV2ChunkTypes.JSON,
    }]);

    expect(createReader(glb)).to.be.undefined;
  });

  it("rejects glb with misaligned chunks", () => {
    expect(createReader(glbFromChunks([{
      data: jsonToBytes(minimalJson, 7), type: GltfV2ChunkTypes.JSON,
    }, {
      data: minimalBin, type: GltfV2ChunkTypes.Binary,
    }]))).to.be.undefined;

    expect(createReader(glbFromChunks([{
      data: jsonToBytes(minimalJson), type: GltfV2ChunkTypes.JSON,
    }, {
      data: new Uint8Array([1, 2, 3, 4, 5]), type: GltfV2ChunkTypes.Binary,
    }]))).to.be.undefined;
  });

  it("identifies the scene nodes", () => {
    const json: Gltf = {
      ...minimalJson,
      nodes: [
        { }, // 0
        { children: [2] }, // 1
        { children: [4, 5] }, // 2
        { }, // 3
        { }, // 4
        { }, // 5
      ],
      scenes: [
        { }, // 0
        { nodes: [] }, // 1
        { nodes: [0] }, // 2
        { nodes: [2, 3] }, // 3
        { nodes: [3, 4, 5] }, // 4,
        { nodes: [0, 1, 2, 3, 4, 5] }, // 5
        // 6 non-existent
      ],
    }

    function expectSceneNodes(sceneId: GltfId | undefined, expectedSceneNodes: GltfId[]) {
      json.scene = sceneId;
      const reader = createReader(makeGlb(json, minimalBin))!;
      expect(reader).not.to.be.undefined;
      expect(reader.sceneNodes).to.deep.equal(expectedSceneNodes);
    }

    const allNodes = [0, 1, 2, 3, 4, 5];

    // Scene not defined or not present. Fall back to all nodes. NOT SPEC COMPLIANT but was in original implementation and unknown if faulty tiles exist that require it.
    expectSceneNodes(undefined, allNodes);
    expectSceneNodes(0, allNodes);
    expectSceneNodes(6, allNodes);

    expectSceneNodes(2, [0]);
    expectSceneNodes(3, [2, 3]);
    expectSceneNodes(4, [3, 4, 5]);
    expectSceneNodes(5, allNodes);
  });

  it("throws if scene contains cycles", () => {
    const json: Gltf = {
      ...minimalJson,
      nodes: [
        { children: [0] },
        { children: [1] },
        { children: [2] },
        { },
      ],
      scenes: [
        { nodes: [0] },
        { nodes: [1], },
        { nodes: [2], },
        { nodes: [3, 3] },
      ],
    };

    function expectCycle(scene: GltfId | undefined) {
      json.scene = scene;
      expect(() => createReader(makeGlb(json, minimalBin))).to.throw("Cycle detected while traversing glTF nodes");
    }

    expectCycle(0);
    expectCycle(1);
    expectCycle(2);
    expectCycle(3);
  });

  it("loads only (and all of) the textures referenced by the scene exactly once", async () => {
  });
});
