/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { createReaderPropsWithBaseUrl } from "../../tile/RealityTileLoader";
import { GltfV2ChunkTypes, GltfVersions, TileFormat } from "@itwin/core-common";

const minimalBin = new Uint8Array([12, 34, 0xfe, 0xdc]);
const minimalJson = { asset: { version: "02.00" }, meshes: [] };

function jsonToBytes(json: object, alignment = 4): Uint8Array {
  let str = JSON.stringify(json);
  while (str.length % alignment !== 0)
    str += " ";

  const bytes = new TextEncoder().encode(str);
  expect(bytes.length).toEqual(str.length); // pure ASCII
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

function makeGlb(json: object | undefined, binary?: Uint8Array, header?: Header): Uint8Array {
  const chunks = [];
  if (json)
    chunks.push({ type: GltfV2ChunkTypes.JSON, data: jsonToBytes(json) });

  if (binary)
    chunks.push({ type: GltfV2ChunkTypes.Binary, data: binary });

  return glbFromChunks(chunks, header);
}

describe("createReaderPropsWithBaseUrl", () => {
  const glb = makeGlb(minimalJson, minimalBin);
  it("should add a valid base url to the reader props", {}, () => {
    let props = createReaderPropsWithBaseUrl(glb, false, "http://localhost:8080/tileset.json");
    expect(props?.baseUrl?.toString()).to.equal("http://localhost:8080/tileset.json");

    props = createReaderPropsWithBaseUrl(glb, false, "https://some-blob-storage.com/tileset.json");
    expect(props?.baseUrl?.toString()).to.equal("https://some-blob-storage.com/tileset.json");

    props = createReaderPropsWithBaseUrl(glb, false, "https://some-blob-storage.com/tileset.json?with-some-query-params");
    expect(props?.baseUrl?.toString()).to.equal("https://some-blob-storage.com/tileset.json?with-some-query-params");
  });

  it("should not add an invalid base url to the reader props", {}, () => {
    let props = createReaderPropsWithBaseUrl(glb, false, "");
    expect(props?.baseUrl).to.be.undefined;

    props = createReaderPropsWithBaseUrl(glb, false, "some-invalid-url");
    expect(props?.baseUrl).to.be.undefined;
  });
});

