/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d } from "@itwin/core-geometry";
import { EmptyLocalization, GltfV2ChunkTypes, GltfVersions, RenderTexture, TileFormat } from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { GltfDocument, GltfId, GltfNode, GltfSampler, GltfWrapMode } from "../../common/gltf/GltfSchema";
import { GltfGraphicsReader, GltfReaderProps } from "../../tile/GltfReader";
import { createBlankConnection } from "../createBlankConnection";
import { BatchedTileIdMap } from "../../core-frontend";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

function expectBinaryData(reader: GltfGraphicsReader, expected: Uint8Array | undefined): void {
  expect(undefined === reader.binaryData).toEqual(undefined === expected);
  if (expected)
    expect(Array.from(reader.binaryData!)).toEqual(Array.from(expected));
}

describe("GltfReader", () => {
  let iModel: IModelConnection;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    iModel = createBlankConnection();
  });

  afterAll(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  function createReader(gltf: Uint8Array | GltfDocument, idMap: BatchedTileIdMap | undefined = undefined): GltfGraphicsReader | undefined {
    const props = GltfReaderProps.create(gltf, true);
    return props ? new GltfGraphicsReader(props, { gltf, iModel, idMap }) : undefined;
  }

  it("accepts minimal glb", () => {
    const glb = makeGlb(minimalJson, minimalBin);
    const reader = createReader(glb)!;
    expect(reader).toBeDefined();
    expectBinaryData(reader, minimalBin);
  });

  it("rejects glb with invalid header", () => {
    function test(version: number, format: number, length?: number, expectValid = false) {
      const glb = makeGlb(minimalJson, minimalBin);
      setHeader(glb, length ?? glb.length, format, version);
      const reader = createReader(glb);
      expect(reader !== undefined).toEqual(expectValid);
    }

    // Valid.
    test(2, TileFormat.Gltf, 76, true);

    // Unrecognized version
    test(3, TileFormat.Gltf);
    test(-1, TileFormat.Gltf);

    // Unrecognized format
    test(2, 0xbaadf00d);
  });

  it("accepts glb with no binary chunk", () => {
    const glb = glbFromChunks([{ data: jsonToBytes(minimalJson), type: GltfV2ChunkTypes.JSON }]);
    const reader = createReader(glb)!;
    expect(reader).toBeDefined();
    expect(reader.binaryData).toBeUndefined();
  });

  it("rejects glb with no JSON chunk", () => {
    const glb = glbFromChunks([{ data: minimalBin, type: GltfV2ChunkTypes.Binary }]);
    expect(createReader(glb)).toBeUndefined();
  });

  it("rejects glb with multiple binary chunks", () => {
    const glb = glbFromChunks([{
      data: jsonToBytes(minimalJson), type: GltfV2ChunkTypes.JSON,
    }, {
      data: minimalBin, type: GltfV2ChunkTypes.Binary,
    }, {
      data: minimalBin, type: GltfV2ChunkTypes.Binary,
    }]);

    expect(createReader(glb)).toBeUndefined();
  });

  it("ignores unrecognized chunks", () => {
    const chunks = [{
      data: jsonToBytes(minimalJson), type: GltfV2ChunkTypes.JSON,
    }, {
      data: minimalBin, type: GltfV2ChunkTypes.Binary,
    }];

    chunks.push({ data: minimalBin, type: 0xdeadbeef as GltfV2ChunkTypes });
    const glb = glbFromChunks(chunks);
    const reader = createReader(glb)!;
    expect(reader).toBeDefined();
    expectBinaryData(reader, minimalBin);
  });

  it("rejects glb with out-of-order chunks", () => {
    const glb = glbFromChunks([{
      data: minimalBin, type: GltfV2ChunkTypes.Binary,
    }, {
      data: jsonToBytes(minimalJson), type: GltfV2ChunkTypes.JSON,
    }]);

    expect(createReader(glb)).toBeUndefined();
  });

  it("identifies the scene nodes", () => {
    const json: GltfDocument = {
      ...minimalJson,
      meshes: [] as any,
      nodes: [
        { }, // 0
        { children: [2] }, // 1
        { children: [4, 5] }, // 2
        { }, // 3
        { }, // 4
        { }, // 5
      ] as any,
      scenes: [
        { }, // 0
        { nodes: [] }, // 1
        { nodes: [0] }, // 2
        { nodes: [2, 3] }, // 3
        { nodes: [3, 4, 5] }, // 4,
        { nodes: [0, 1, 2, 3, 4, 5] }, // 5
        // 6 non-existent
      ] as any,
    };

    function expectSceneNodes(sceneId: GltfId | undefined, expectedSceneNodes: GltfId[]) {
      json.scene = sceneId;
      const reader = createReader(makeGlb(json, minimalBin))!;
      expect(reader).toBeDefined();
      expect(reader.sceneNodes).toEqual(expectedSceneNodes);
    }

    // If scene is not present we fall back to Object.keys, which are strings.
    const allNodes = ["0", "1", "2", "3", "4", "5"];

    // Scene not defined or not present. Fall back to all nodes. NOT SPEC COMPLIANT but was in original implementation and unknown if faulty tiles exist that require it.
    expectSceneNodes(undefined, allNodes);
    expectSceneNodes(0, allNodes);
    expectSceneNodes(6, allNodes);

    expectSceneNodes(2, [0]);
    expectSceneNodes(3, [2, 3]);
    expectSceneNodes(4, [3, 4, 5]);
    expectSceneNodes(5, [0, 1, 2, 3, 4, 5]);
  });

  it("traverses scene nodes", () => {
    const json: GltfDocument = {
      ...minimalJson,
      meshes: [] as any,
      nodes: [
        { }, // 0
        { children: [2] }, // 1
        { children: [4, 5] }, // 2
        { children: [0] }, // 3
        { children: [9, 8, 7, 6] }, // 4
        { }, // 5
        { }, // 6
      ] as any,
      scenes: [
        { }, // 0
        { nodes: [] }, // 1
        { nodes: [0] }, // 2
        { nodes: [1] }, // 3
        { nodes: [2] }, // 4
        { nodes: [3] }, // 5
        { nodes: [4] }, // 6
        { nodes: [5] }, // 7
        { nodes: [4, 0, 9] }, // 8
        { nodes: [2, 3] }, // 9
      ] as any,
    };

    function expectTraversal(sceneId: GltfId, expectedTraversal: GltfId[]) {
      json.scene = sceneId;
      const reader = createReader(makeGlb(json, minimalBin))!;
      expect(reader).toBeDefined();
      expect(reader.sceneNodes).toEqual(reader.scenes[sceneId]?.nodes);

      const actualTraversal = [];
      expect(Array.isArray(reader.nodes)).toBe(true);
      const nodes = reader.nodes as unknown as GltfNode[];
      for (const node of reader.traverseScene()) {
        const nodeId = nodes.indexOf(node);
        expect(nodeId).least(0);
        actualTraversal.push(nodeId);
      }

      expect(actualTraversal).toEqual(expectedTraversal);
    }

    expectTraversal(1, []);
    expectTraversal(2, [0]);
    expectTraversal(3, [1, 2, 4, 6, 5]);
    expectTraversal(4, [2, 4, 6, 5]);
    expectTraversal(5, [3, 0]);
    expectTraversal(6, [4, 6]);
    expectTraversal(7, [5]);
    expectTraversal(8, [4, 6, 0]);
    expectTraversal(9, [2, 4, 6, 5, 3, 0]);
  });

  it("throws during traversal if scene contains cycles", () => {
    const json: GltfDocument = {
      ...minimalJson,
      meshes: [] as any,
      nodes: {
        0: { children: ["0"] },
        1: { children: ["1"] },
        2: { children: ["2"] },
        3: { },
      },
      scenes: {
        0: { nodes: ["0"] },
        1: { nodes: ["1"] },
        2: { nodes: ["2"] },
        3: { nodes: ["3", "3"] },
      },
    };

    function expectCycle(scene: GltfId | undefined) {
      json.scene = scene;
      const reader = createReader(makeGlb(json, minimalBin))!;
      expect(reader).toBeDefined();
      expect(() => {
        for (const _ of reader.traverseScene()) { }
      }).toThrowError("Cycle detected while traversing glTF nodes");
    }

    expectCycle(0);
    expectCycle(1);
    expectCycle(2);
    expectCycle(3);
  });

  // https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/TriangleWithoutIndices/glTF-Embedded/TriangleWithoutIndices.gltf
  const unindexedTriangle: GltfDocument = JSON.parse(`{
    "scene" : 0,
    "scenes" : [
      {
        "nodes" : [ 0 ]
      }
    ],

    "nodes" : [
      {
        "mesh" : 0
      }
    ],

    "meshes" : [
      {
        "primitives" : [ {
          "attributes" : {
            "POSITION" : 0
          }
        } ]
      }
    ],

    "buffers" : [
      {
        "uri" : "data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA",
        "byteLength" : 36
      }
    ],
    "bufferViews" : [
      {
        "buffer" : 0,
        "byteOffset" : 0,
        "byteLength" : 36,
        "target" : 34962
      }
    ],
    "accessors" : [
      {
        "bufferView" : 0,
        "byteOffset" : 0,
        "componentType" : 5126,
        "count" : 3,
        "type" : "VEC3",
        "max" : [ 1.0, 1.0, 0.0 ],
        "min" : [ 0.0, 0.0, 0.0 ]
      }
    ],

    "asset" : {
      "version" : "2.0"
    }
  }`);

  it("computes bounding boxes", async () => {
    const reader = createReader(unindexedTriangle)!;
    expect(reader).toBeDefined();
    const result = await reader.read();
    expect(result.graphic).toBeDefined();

    // Content range is in local coordinates (y-up)
    expect(result.contentRange?.toJSON()).toEqual({
      low: [0, 0, 0],
      high: [1, 1, 0],
    });

    // Range is in world coordinates (z-up). Transform introduces slight floating point fuzz.
    expect(result.range).toBeDefined();
    expect(result.range!.isAlmostEqual(new Range3d(0, 0, -1, 1, 0, 0))).toBe(true);
  });

  describe("textures", () => {
    function expectTextureType(expected: RenderTexture.Type, sampler: GltfSampler | undefined, defaultWrap?: GltfWrapMode): void {
      const reader = createReader(makeGlb(minimalJson, minimalBin))!;
      expect(reader).toBeDefined();
      if (undefined !== defaultWrap)
        reader.defaultWrapMode = defaultWrap;

      expect(reader.getTextureType(sampler)).toEqual(expected);
    }

    // This test includes a current deviation from the glTF spec: we currently do not support mirrored repeat.
    it("produces normal textures unless clamp-to-edge is specified", () => {
      expectTextureType(RenderTexture.Type.Normal, undefined);
      expectTextureType(RenderTexture.Type.Normal, {});
      expectTextureType(RenderTexture.Type.Normal, { magFilter: 9728, minFilter: 9987 });

      expectTextureType(RenderTexture.Type.Normal, { wrapS: GltfWrapMode.Repeat });
      expectTextureType(RenderTexture.Type.Normal, { wrapT: GltfWrapMode.Repeat });
      expectTextureType(RenderTexture.Type.Normal, { wrapS: GltfWrapMode.Repeat, wrapT: GltfWrapMode.Repeat });

      expectTextureType(RenderTexture.Type.Normal, { wrapS: GltfWrapMode.MirroredRepeat });
      expectTextureType(RenderTexture.Type.Normal, { wrapT: GltfWrapMode.MirroredRepeat });
      expectTextureType(RenderTexture.Type.Normal, { wrapS: GltfWrapMode.MirroredRepeat, wrapT: GltfWrapMode.MirroredRepeat });
    });

    // This test includes a current deviation from the glTF spec: we currently do not support different wrapping behavior for S/U and T/V.
    it("produces tile section if either S or T are clamped to edge", () => {
      expectTextureType(RenderTexture.Type.TileSection, { wrapS: GltfWrapMode.ClampToEdge });
      expectTextureType(RenderTexture.Type.TileSection, { wrapT: GltfWrapMode.ClampToEdge });
      expectTextureType(RenderTexture.Type.TileSection, { wrapS: GltfWrapMode.ClampToEdge, wrapT: GltfWrapMode.ClampToEdge });
      expectTextureType(RenderTexture.Type.TileSection, { wrapS: GltfWrapMode.Repeat, wrapT: GltfWrapMode.ClampToEdge });
      expectTextureType(RenderTexture.Type.TileSection, { wrapS: GltfWrapMode.ClampToEdge, wrapT: GltfWrapMode.MirroredRepeat });
    });

    it("overrides default texture type if unspecified by sampler", () => {
      expectTextureType(RenderTexture.Type.TileSection, undefined, GltfWrapMode.ClampToEdge);
      expectTextureType(RenderTexture.Type.TileSection, {}, GltfWrapMode.ClampToEdge);
      expectTextureType(RenderTexture.Type.TileSection, { magFilter: 9728, minFilter: 9987 }, GltfWrapMode.ClampToEdge);

      expectTextureType(RenderTexture.Type.Normal, { wrapS: GltfWrapMode.Repeat }, GltfWrapMode.ClampToEdge);
      expectTextureType(RenderTexture.Type.Normal, { wrapT: GltfWrapMode.Repeat }, GltfWrapMode.ClampToEdge);
      expectTextureType(RenderTexture.Type.Normal, { wrapS: GltfWrapMode.Repeat, wrapT: GltfWrapMode.Repeat }, GltfWrapMode.ClampToEdge);

      expectTextureType(RenderTexture.Type.Normal, { wrapS: GltfWrapMode.MirroredRepeat }, GltfWrapMode.ClampToEdge);
      expectTextureType(RenderTexture.Type.Normal, { wrapT: GltfWrapMode.MirroredRepeat }, GltfWrapMode.ClampToEdge);
      expectTextureType(RenderTexture.Type.Normal, { wrapS: GltfWrapMode.MirroredRepeat, wrapT: GltfWrapMode.MirroredRepeat }, GltfWrapMode.ClampToEdge);

      expectTextureType(RenderTexture.Type.TileSection, { wrapS: GltfWrapMode.ClampToEdge }, GltfWrapMode.ClampToEdge);
      expectTextureType(RenderTexture.Type.TileSection, { wrapT: GltfWrapMode.ClampToEdge }, GltfWrapMode.ClampToEdge);
      expectTextureType(RenderTexture.Type.TileSection, { wrapS: GltfWrapMode.ClampToEdge, wrapT: GltfWrapMode.ClampToEdge }, GltfWrapMode.ClampToEdge);
      expectTextureType(RenderTexture.Type.TileSection, { wrapS: GltfWrapMode.Repeat, wrapT: GltfWrapMode.ClampToEdge }, GltfWrapMode.ClampToEdge);
      expectTextureType(RenderTexture.Type.TileSection, { wrapS: GltfWrapMode.ClampToEdge, wrapT: GltfWrapMode.MirroredRepeat }, GltfWrapMode.ClampToEdge);
    });
  });

  const instanceFeaturesExt: GltfDocument = JSON.parse(`
{
  "asset": {
    "version": "2.0"
  },
  "scene": 0,
  "scenes": [
    {
      "nodes": [
        0
      ]
    }
  ],
  "nodes": [
    {
			"extensions": {
				"EXT_instance_features": {
					"featureIds": [
					  {
								"featureCount": 4,
								"propertyTable": 0
						},
						{
								"attribute": 0,
								"featureCount": 4,
								"propertyTable": 1,
								"nullFeatureId": 3
						}
					]
				},
				"EXT_mesh_gpu_instancing": {
					"attributes": {
						"_FEATURE_ID_0": 1,
            "TRANSLATION": 2
					}
				}
			},
			"mesh": 0
		}
  ],
  "meshes": [
    {
      "primitives": [
        {
          "attributes": {
            "POSITION": 0
          }
        }
      ]
    }
  ],
  "buffers": [
    {
      "uri": "data:application/octet-stream;base64,AQIDBA==",
      "byteLength": 4
    },
    {
      "uri": "data:application/octet-stream;base64,AQACAAMABAA=",
      "byteLength": 8
    },
    {
      "uri": "data:application/octet-stream;base64,AQAAAAIAAAADAAAABAAAAA==",
      "byteLength": 16
    },
    {
      "uri": "data:application/octet-stream;base64,AQAAAAAAAAACAAAAAAAAAAMAAAAAAAAABAAAAAAAAAA=",
      "byteLength": 32
    },
    {
      "uri": "data:application/octet-stream;base64,//79/A==",
      "byteLength": 4
    },
    {
      "uri": "data:application/octet-stream;base64,///+//3//P8=",
      "byteLength": 8
    },
    {
      "uri": "data:application/octet-stream;base64,//////7////9/////P///w==",
      "byteLength": 16
    },
    {
      "uri": "data:application/octet-stream;base64,///////////+//////////3//////////P////////8=",
      "byteLength": 32
    },
    {
      "uri": "data:application/octet-stream;base64,AACAPwAAAEAAAEBAAACAQA==",
      "byteLength": 16
    },
    {
      "uri": "data:application/octet-stream;base64,AAAAAAAA8D8AAAAAAAAAQAAAAAAAAAhAAAAAAAAAEEA=",
      "byteLength": 32
    },
    {
      "uri": "data:application/octet-stream;base64,b25ldHdvdGhyZWVmb3Vy",
      "byteLength": 15
    },
    {
      "uri": "data:application/octet-stream;base64,AAAAAAMAAAAGAAAACwAAABAAAAA=",
      "byteLength": 20
    },
    {
      "uri": "data:application/octet-stream;base64,AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QA==",
      "byteLength": 64
    },
    {
      "uri": "data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA",
      "byteLength": 36
    },
    {
      "uri": "data:application/octet-stream;base64,AgAAAAEAAAADAAAAAAAAAA==",
      "byteLength": 16
    }
  ],
  "bufferViews": [
    {
      "buffer": 0,
      "byteOffset": 0,
      "byteLength": 4
    },
    {
      "buffer": 1,
      "byteOffset": 0,
      "byteLength": 8
    },
    {
      "buffer": 2,
      "byteOffset": 0,
      "byteLength": 16
    },
    {
      "buffer": 3,
      "byteOffset": 0,
      "byteLength": 32
    },
    {
      "buffer": 4,
      "byteOffset": 0,
      "byteLength": 4
    },
    {
      "buffer": 5,
      "byteOffset": 0,
      "byteLength": 8
    },
    {
      "buffer": 6,
      "byteOffset": 0,
      "byteLength": 16
    },
    {
      "buffer": 7,
      "byteOffset": 0,
      "byteLength": 32
    },
    {
      "buffer": 8,
      "byteOffset": 0,
      "byteLength": 16
    },
    {
      "buffer": 9,
      "byteOffset": 0,
      "byteLength": 32
    },
    {
      "buffer": 10,
      "byteOffset": 0,
      "byteLength": 15
    },
    {
      "buffer": 11,
      "byteOffset": 0,
      "byteLength": 20
    },
    {
      "buffer": 12,
      "byteOffset": 0,
      "byteLength": 8
    },
    {
      "buffer": 12,
      "byteOffset": 0,
      "byteLength": 12
    },
    {
      "buffer": 12,
      "byteOffset": 0,
      "byteLength": 16
    },
    {
      "buffer": 12,
      "byteOffset": 0,
      "byteLength": 36
    },
    {
      "buffer": 12,
      "byteOffset": 0,
      "byteLength": 64
    },
    {
      "buffer": 13,
      "byteOffset": 0,
      "byteLength": 36
    },
    {
      "buffer": 14,
      "byteOffset": 0,
      "byteLength": 16
    },
    {
      "buffer": 12,
      "byteOffset": 0,
      "byteLength": 48
    }
  ],
  "accessors": [
    {
      "bufferView": 17,
      "byteOffset": 0,
      "componentType": 5126,
      "count": 3,
      "type": "VEC3",
      "max": [
        1.0,
        1.0,
        0.0
      ],
      "min": [
        0.0,
        0.0,
        0.0
      ]
    },
		{
			"bufferView": 18,
			"componentType": 5125,
			"count": 4,
			"type": "SCALAR"
		},
		{
			"bufferView": 19,
			"componentType": 5126,
			"count": 4,
			"type": "VEC3"
		}
  ],
  "extensions": {
    "EXT_structural_metadata": {
      "propertyTables": [
        {
          "class": "propertySet0",
          "count": 4,
          "name": "propertySet0",
          "properties": {
            "property0": {
              "values": 0
            },
            "property1": {
              "values": 1
            },
            "property2": {
              "values": 2
            },
            "property3": {
              "values": 3
            },
            "property4": {
              "values": 4
            },
            "property5": {
              "values": 5
            },
            "property6": {
              "values": 6
            },
            "property7": {
              "values": 7
            },
            "property8": {
              "values": 8
            },
            "property9": {
              "values": 9
            },
            "property10": {
              "values": 10,
              "stringOffsets": 11
            }
          }
        },
        {
          "class": "propertySet1",
          "count": 4,
          "name": "propertySet1",
          "properties": {
            "property0": {
              "values": 12
            },
            "property1": {
              "values": 13
            },
            "property2": {
              "values": 14
            },
            "property3": {
              "values": 15
            },
            "property4": {
              "values": 15
            },
            "property5": {
              "values": 16
            }
          }
        }
      ],
      "schema": {
        "classes": {
          "propertySet0": {
            "name": "propertySet0",
            "properties": {
              "property0": {
                "componentType": "UINT8",
                "name": "UINT8_VALUES",
                "noData": 4,
                "required": true,
                "type": "SCALAR"
              },
              "property1": {
                "componentType": "UINT16",
                "name": "UINT16_VALUES",
                "noData": 4,
                "required": true,
                "type": "SCALAR"
              },
              "property2": {
                "componentType": "UINT32",
                "name": "UINT32_VALUES",
                "noData": 4,
                "required": true,
                "type": "SCALAR"
              },
              "property3": {
                "componentType": "UINT64",
                "name": "UINT64_VALUES",
                "noData": "4",
                "required": true,
                "type": "SCALAR"
              },
              "property4": {
                "componentType": "INT8",
                "name": "INT8_VALUES",
                "noData": -4,
                "required": true,
                "type": "SCALAR"
              },
              "property5": {
                "componentType": "INT16",
                "name": "INT16_VALUES",
                "noData": -4,
                "required": true,
                "type": "SCALAR"
              },
              "property6": {
                "componentType": "INT32",
                "name": "INT32_VALUES",
                "noData": -4,
                "required": true,
                "type": "SCALAR"
              },
              "property7": {
                "componentType": "INT64",
                "name": "INT64_VALUES",
                "noData": "-4",
                "required": true,
                "type": "SCALAR"
              },
              "property8": {
                "componentType": "FLOAT32",
                "name": "FLOAT32_VALUES",
                "noData": 4,
                "required": true,
                "type": "SCALAR"
              },
              "property9": {
                "componentType": "FLOAT64",
                "name": "FLOAT64_VALUES",
                "noData": 4,
                "required": true,
                "type": "SCALAR"
              },
              "property10": {
                "name": "STRING_VALUES",
                "required": true,
                "noData": "four",
                "type": "STRING"
              }
            }
          },
          "propertySet1": {
            "name": "propertySet1",
            "properties": {
              "property0": {
                "componentType": "UINT8",
                "name": "UINT8_VEC2_VALUES",
                "noData": 0,
                "required": true,
                "type": "VEC2"
              },
              "property1": {
                "componentType": "UINT8",
                "name": "UINT8_VEC3_VALUES",
                "noData": 0,
                "required": true,
                "type": "VEC3"
              },
              "property2": {
                "componentType": "UINT8",
                "name": "UINT8_VEC4_VALUES",
                "noData": 0,
                "required": true,
                "type": "VEC4"
              },
              "property3": {
                "componentType": "UINT8",
                "name": "UINT8_MAT2_VALUES",
                "noData": 0,
                "required": true,
                "type": "MAT2"
              },
              "property4": {
                "componentType": "UINT8",
                "name": "UINT8_MAT3_VALUES",
                "noData": 0,
                "required": true,
                "type": "MAT3"
              },
              "property5": {
                "componentType": "UINT8",
                "name": "UINT8_MAT4_VALUES",
                "noData": 0,
                "required": true,
                "type": "MAT4"
              }
            }
          }
        },
        "id": "testProperties"
      }
    }
  }
}`);

  const compareArrays = (a: any[], b: any[]) => {
    for (let i = 0; i < a.length; i++) {
      if(Array.isArray(a[i])){
        if (!compareArrays(a[i], b[i])){
          return false;
        }
      } else{
        if (a[i] !== b[i]){
          return false;
        }
      }
    }
    return true;
  };

  describe("EXT_structural_metadata", () => {

    const instanceFeatures = [2,1,3,0];
    const expectedValuesUnsigned = [1,2,3,undefined];
    const expectedValuesBigUnsigned = ["1","2","3",undefined];
    const expectedValuesSigned = [-1,-2,-3,undefined];
    const expectedValuesBigSigned = ["-1","-2","-3",undefined];
    const expectedValuesString = ["one","two","three",undefined];

    const expectedValuesVec2 = [[1,2],[3,4],[5,6],[7,8]];
    const expectedValuesVec3 = [[1,2,3],[4,5,6],[7,8,9],[10,11,12]];
    const expectedValuesVec4 = [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16]];
    const expectedValuesMat3 = [[1,2,3,4,5,6,7,8,9],[10,11,12,13,14,15,16,17,18],[19,20,21,22,23,24,25,26,27],[28,29,30,31,32,33,34,35,36]];
    const expectedValuesMat4 = [[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],[17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32], [33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48], [49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]];

    it("parses structural metadata", async () => {
      const reader = createReader(instanceFeaturesExt)!;
      expect(reader).toBeDefined();
      const result = await reader.read();
      expect(result.graphic).toBeDefined();
      expect(reader.structuralMetadata).toBeDefined();
      const structuralMetadata = reader.structuralMetadata!;

      expect(structuralMetadata.tables.length === 2);
      expect(structuralMetadata.tables[0].entries.length === 11);

      for(const entry of structuralMetadata.tables[0].entries ?? []) {
        if(entry.name === "UINT8_VALUES") {
          expect(compareArrays(entry.values, expectedValuesUnsigned)).toBe(true);
        } else if(entry.name === "UINT16_VALUES") {
          expect(compareArrays(entry.values, expectedValuesUnsigned)).toBe(true);
        } else if(entry.name === "UINT32_VALUES") {
          expect(compareArrays(entry.values, expectedValuesUnsigned)).toBe(true);
        } else if(entry.name === "UINT64_VALUES") {
          expect(compareArrays(entry.values, expectedValuesBigUnsigned)).toBe(true);
        } else if(entry.name === "INT8_VALUES") {
          expect(compareArrays(entry.values, expectedValuesSigned)).toBe(true);
        } else if(entry.name === "INT16_VALUES") {
          expect(compareArrays(entry.values, expectedValuesSigned)).toBe(true);
        } else if(entry.name === "INT32_VALUES") {
          expect(compareArrays(entry.values, expectedValuesSigned)).toBe(true);
        } else if(entry.name === "INT64_VALUES") {
          expect(compareArrays(entry.values, expectedValuesBigSigned)).toBe(true);
        }else if(entry.name === "FLOAT32_VALUES") {
          expect(compareArrays(entry.values, expectedValuesUnsigned)).toBe(true);
        } else if(entry.name === "FLOAT64_VALUES") {
          expect(compareArrays(entry.values, expectedValuesUnsigned)).toBe(true);
        } else if(entry.name === "STRING_VALUES") {
          expect(compareArrays(entry.values, expectedValuesString)).toBe(true);
        }
      }

      expect(structuralMetadata.tables[1].entries.length === 6);
      for(const entry of structuralMetadata.tables[1].entries ?? []) {
        if(entry.name === "UINT8_VEC2_VALUES") {
          expect(compareArrays(entry.values, expectedValuesVec2)).toBe(true);
        } else if(entry.name === "UINT8_VEC3_VALUES") {
          expect(compareArrays(entry.values, expectedValuesVec3)).toBe(true);
        } else if(entry.name === "UINT8_VEC4_VALUES") {
          expect(compareArrays(entry.values, expectedValuesVec4)).toBe(true);
        } else if(entry.name === "UINT8_MAT2_VALUES") {
          expect(compareArrays(entry.values, expectedValuesVec4)).toBe(true);
        } else if(entry.name === "UINT8_MAT3_VALUES") {
          expect(compareArrays(entry.values, expectedValuesMat3)).toBe(true);
        } else if(entry.name === "UINT8_MAT4_VALUES") {
          expect(compareArrays(entry.values, expectedValuesMat4)).toBe(true);
        }
      }
    });

    it("parses instance features", async () => {
      const idMap = new BatchedTileIdMap(iModel);

      const reader = createReader(instanceFeaturesExt, idMap)!;
      expect(reader).toBeDefined();

      const result = await reader.read();
      expect(result).toBeDefined();

      let entryCount = 0;
      for(const entry of idMap.entries()) {
        expect(entry).toBeDefined();

        // Expect empty property set for noData = 4 | -4 | "four"
        if(entryCount === 3){
          expect(JSON.stringify(entry.properties.propertySet0) === JSON.stringify({})).toBe(true);
        } else {
          let propertyCount0 = 0;
          for(const [key, value] of Object.entries(entry.properties.propertySet0)){
            if(key === "UINT8_VALUES") {
              expect(value === expectedValuesUnsigned[entryCount]).toBe(true);
              propertyCount0++;
            } else if(key === "UINT16_VALUES") {
              expect(value === expectedValuesUnsigned[entryCount]).toBe(true);
              propertyCount0++;
            } else if(key === "UINT32_VALUES") {
              expect(value === expectedValuesUnsigned[entryCount]).toBe(true);
              propertyCount0++;
            } else if(key === "UINT64_VALUES") {
              expect(value === expectedValuesBigUnsigned[entryCount]).toBe(true);
              propertyCount0++;
            } else if(key === "INT8_VALUES") {
              expect(value === expectedValuesSigned[entryCount]).toBe(true);
              propertyCount0++;
            } else if(key === "INT16_VALUES") {
              expect(value === expectedValuesSigned[entryCount]).toBe(true);
              propertyCount0++;
            } else if(key === "INT32_VALUES") {
              expect(value === expectedValuesSigned[entryCount]).toBe(true);
              propertyCount0++;
            } else if(key === "INT64_VALUES") {
              expect(value === expectedValuesBigSigned[entryCount]).toBe(true);
              propertyCount0++;
            } else if(key === "FLOAT32_VALUES") {
              expect(value === expectedValuesUnsigned[entryCount]).toBe(true);
              propertyCount0++;
            } else if(key === "FLOAT64_VALUES") {
              expect(value === expectedValuesUnsigned[entryCount]).toBe(true);
              propertyCount0++;
            } else if(key === "STRING_VALUES") {
              expect(value === expectedValuesString[entryCount]).toBe(true);
              propertyCount0++;
            }
          }
          expect(propertyCount0 === 11).toBe(true);
        }

        // Expect empty property set for null feature id = 3
        if(instanceFeatures[entryCount] === 3){
          expect(JSON.stringify(entry.properties.propertySet1) === JSON.stringify({})).toBe(true);
        } else {
          let propertyCount1 = 0;
          for(const [key, value] of Object.entries(entry.properties.propertySet1)){
            const array = value as any[];
            if(key === "UINT8_VEC2_VALUES") {
              expect(compareArrays(array, expectedValuesVec2[instanceFeatures[entryCount]])).toBe(true);
              propertyCount1++;
            } else if(key === "UINT8_VEC3_VALUES") {
              expect(compareArrays(array, expectedValuesVec3[instanceFeatures[entryCount]])).toBe(true);
              propertyCount1++;
            } else if(key === "UINT8_VEC4_VALUES") {
              expect(compareArrays(array, expectedValuesVec4[instanceFeatures[entryCount]])).toBe(true);
              propertyCount1++;
            } else if(key === "UINT8_MAT2_VALUES") {
              expect(compareArrays(array, expectedValuesVec4[instanceFeatures[entryCount]])).toBe(true);
              propertyCount1++;
            } else if(key === "UINT8_MAT3_VALUES") {
              expect(compareArrays(array, expectedValuesMat3[instanceFeatures[entryCount]])).toBe(true);
              propertyCount1++;
            }else if(key === "UINT8_MAT4_VALUES") {
              expect(compareArrays(array, expectedValuesMat4[instanceFeatures[entryCount]])).toBe(true);
              propertyCount1++;
            }
          }
          expect(propertyCount1 === 6).toBe(true);
        }

        entryCount ++;
      }
      expect(entryCount === 4).toBe(true);
    });
  });

  const meshFeaturesExt: GltfDocument = JSON.parse(`
{
  "extensions": {
    "EXT_structural_metadata": {
      "schema": {
        "id": "schema",
        "classes": {
          "default": {
            "properties": {
              "color": {
                "type": "STRING"
              },
              "id": {
                "type": "SCALAR",
                "componentType": "INT32"
              },
              "height": {
                "type": "SCALAR",
                "componentType": "FLOAT64"
              }
            }
          }
        }
      },
      "propertyTables": [
        {
          "class": "default",
          "count": 4,
          "properties": {
            "color": {
              "values": 4,
              "stringOffsets": 5
            },
            "id": {
              "values": 6
            },
            "height": {
              "values": 7
            }
          }
        }
      ]
    }
  },
  "extensionsUsed": [
    "EXT_structural_metadata",
    "EXT_mesh_features"
  ],
  "accessors": [
    {
      "bufferView": 0,
      "byteOffset": 0,
      "componentType": 5123,
      "count": 132,
      "type": "SCALAR",
      "max": [
        71
      ],
      "min": [
        0
      ]
    },
    {
      "bufferView": 3,
      "byteOffset": 0,
      "componentType": 5126,
      "count": 72,
      "type": "VEC3",
      "max": [
        1,
        1,
        1
      ],
      "min": [
        -1,
        -1,
        -1
      ]
    },
    {
      "bufferView": 3,
      "byteOffset": 864,
      "componentType": 5126,
      "count": 72,
      "type": "VEC3",
      "max": [
        0.84034216,
        0.97562474,
        0.86005926
      ],
      "min": [
        -0.85006464,
        -0.84470725,
        -0.86005926
      ]
    },
    {
      "bufferView": 1,
      "byteOffset": 0,
      "componentType": 5121,
      "count": 72,
      "type": "SCALAR"
    },
    {
      "bufferView": 2,
      "byteOffset": 0,
      "componentType": 5121,
      "normalized": true,
      "count": 72,
      "type": "VEC4",
      "max": [
        255,
        255,
        0,
        255
      ],
      "min": [
        0,
        0,
        0,
        255
      ]
    }
  ],
  "asset": {
    "copyright": "2023 (c) Bentley Systems Inc.",
    "generator": "A3XtoGltf 1.0",
    "version": "2.0"
  },
  "buffers": [
    {
      "uri": "data:application/octet-stream;base64,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",
      "byteLength": 2448
    }
  ],
  "bufferViews": [
    {
      "buffer": 0,
      "byteOffset": 0,
      "byteLength": 264,
      "target": 34963
    },
    {
      "buffer": 0,
      "byteOffset": 264,
      "byteLength": 72,
      "target": 34962
    },
    {
      "buffer": 0,
      "byteOffset": 336,
      "byteLength": 288,
      "byteStride": 4,
      "target": 34962
    },
    {
      "buffer": 0,
      "byteOffset": 624,
      "byteLength": 1728,
      "byteStride": 12,
      "target": 34962
    },
    {
      "buffer": 0,
      "byteOffset": 2352,
      "byteLength": 28
    },
    {
      "buffer": 0,
      "byteOffset": 2380,
      "byteLength": 20
    },
    {
      "buffer": 0,
      "byteOffset": 2400,
      "byteLength": 16
    },
    {
      "buffer": 0,
      "byteOffset": 2416,
      "byteLength": 32
    }
  ],
  "materials": [
    {
      "pbrMetallicRoughness": {
        "metallicFactor": 0
      }
    }
  ],
  "meshes": [
    {
      "primitives": [
        {
          "attributes": {
            "POSITION": 1,
            "NORMAL": 2,
            "_FEATURE_ID_0": 3,
            "COLOR_0": 4
          },
          "indices": 0,
          "material": 0,
          "mode": 4
        }
      ]
    }
  ],
  "nodes": [
    {
      "extensions": {
        "EXT_mesh_features": {
          "featureIds": [
            {
              "featureCount": 4,
              "attribute": 0,
              "propertyTable": 0
            }
          ]
        }
      },
      "mesh": 0
    }
  ],
  "scene": 0,
  "scenes": [
    {
      "nodes": [
        0
      ]
    }
  ]
}`);

  describe("EXT_mesh_features", () => {
    it.only("test something", async () => {
      const idMap = new BatchedTileIdMap(iModel);

      const reader = createReader(meshFeaturesExt, idMap)!;
      expect(reader).toBeDefined();

      const result = await reader.read();
      expect(result).toBeDefined();

      let count = 0;
      for (const _ of idMap.entries()) {
        count = count + 1;
      }
      expect(idMap).toEqual(50);
    });
  });

});
