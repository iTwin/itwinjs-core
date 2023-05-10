/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ByteStream, Id64String, JsonUtils, utf8ToString } from "@itwin/core-bentley";
import {
  FeatureTableHeader, GltfV2ChunkTypes, GltfVersions, ImdlFlags, ImdlHeader, RenderSchedule, TileFormat, TileHeader, TileReadStatus,
} from "@itwin/core-common";
import { ImdlModel as Imdl } from "./ImdlModel";
import { AnyImdlPrimitive, ImdlAreaPattern, ImdlDocument, ImdlMesh } from "./ImdlSchema";
import { AnimationNodeId } from "../render/GraphicBranch";

export type ImdlTimeline = RenderSchedule.ModelTimeline | RenderSchedule.Script;

export interface ImdlParserOptions {
  stream: ByteStream;
  batchModelId: Id64String;
  omitEdges?: boolean;
  createUntransformedRootNode?: boolean;
  timeline?: ImdlTimeline;
}

/** Header preceding "glTF" data in iMdl tile. */
class GltfHeader extends TileHeader {
  public readonly gltfLength: number;
  public readonly scenePosition: number = 0;
  public readonly sceneStrLength: number = 0;
  public readonly binaryPosition: number = 0;
  public get isValid(): boolean { return TileFormat.Gltf === this.format; }

  public constructor(stream: ByteStream) {
    super(stream);
    this.gltfLength = stream.readUint32();

    this.sceneStrLength = stream.readUint32();
    const value5 = stream.readUint32();

    // Early versions of the reality data tile publisher incorrectly put version 2 into header - handle these old tiles
    // validating the chunk type.
    if (this.version === GltfVersions.Version2 && value5 === GltfVersions.Gltf1SceneFormat)
      this.version = GltfVersions.Version1;

    if (this.version === GltfVersions.Version1) {
      const gltfSceneFormat = value5;
      if (GltfVersions.Gltf1SceneFormat !== gltfSceneFormat) {
        this.invalidate();
        return;
      }

      this.scenePosition = stream.curPos;
      this.binaryPosition = stream.curPos + this.sceneStrLength;
    } else if (this.version === GltfVersions.Version2) {
      const sceneChunkType = value5;
      this.scenePosition = stream.curPos;
      stream.curPos = stream.curPos + this.sceneStrLength;
      const binaryLength = stream.readUint32();
      const binaryChunkType = stream.readUint32();
      if (GltfV2ChunkTypes.JSON !== sceneChunkType || GltfV2ChunkTypes.Binary !== binaryChunkType || 0 === binaryLength) {
        this.invalidate();
        return;
      }

      this.binaryPosition = stream.curPos;
    } else {
      this.invalidate();
    }
  }
}

type OptionalDocumentProperties = "rtcCenter" | "animationNodes";
type Document = Required<Omit<ImdlDocument, OptionalDocumentProperties>> & Pick<ImdlDocument, OptionalDocumentProperties>;

export type ImdlParseError = Exclude<TileReadStatus, TileReadStatus.Success>;

interface FeatureTableInfo {
  startPos: number;
  multiModel: boolean;
}

const nodeIdRegex = /Node_(.*)/;
function extractNodeId(nodeName: string): number {
  const match = nodeName.match(nodeIdRegex);
  assert(!!match && match.length === 2);
  if (!match || match.length !== 2)
    return 0;

  const nodeId = Number.parseInt(match[1], 10);
  assert(!Number.isNaN(nodeId));
  return Number.isNaN(nodeId) ? 0 : nodeId;
}

class ImdlParser {
  private readonly _document: Document;
  private readonly _binaryData: Uint8Array;
  private readonly _options: ImdlParserOptions;
  private readonly _featureTableInfo: FeatureTableInfo;

  private get stream(): ByteStream {
    return this._options.stream;
  }

  public constructor(doc: Document, binaryData: Uint8Array, options: ImdlParserOptions, featureTableInfo: FeatureTableInfo) {
    this._document = doc;
    this._binaryData = binaryData;
    this._options = options;
    this._featureTableInfo = featureTableInfo;
  }

  public parse(): Imdl.Document | ImdlParseError {
    // ###TODO caller is responsible for decodeTileContentDescription, leafness, etc.
    const featureTable = this.parseFeatureTable();
    if (!featureTable)
      return TileReadStatus.InvalidFeatureTable;

    const rtcCenter = this._document.rtcCenter ? {
      x: this._document.rtcCenter[0] ?? 0,
      y: this._document.rtcCenter[1] ?? 0,
      z: this._document.rtcCenter[2] ?? 0,
    } : undefined;

    const nodes = this.parseNodes(featureTable);
    return {
      featureTable,
      nodes,
      rtcCenter,
    };
  }

  private parseFeatureTable(): Imdl.FeatureTable | undefined {
    this.stream.curPos = this._featureTableInfo.startPos;
    const header = FeatureTableHeader.readFrom(this.stream);
    if (!header || 0 !== header.length % 4)
      return undefined;

    // NB: We make a copy of the sub-array because we don't want to pin the entire data array in memory.
    const numUint32s = (header.length - FeatureTableHeader.sizeInBytes) / 4;
    const packedFeatureArray = new Uint32Array(this.stream.nextUint32s(numUint32s));
    if (this.stream.isPastTheEnd)
      return undefined;

    let featureTable: Imdl.FeatureTable;
    if (this._featureTableInfo.multiModel) {
      featureTable = {
        multiModel: true,
        data: packedFeatureArray,
        numFeatures: header.count,
        numSubCategories: header.numSubCategories,
      };
    } else {
      let animNodesArray: Uint8Array | Uint16Array | Uint32Array | undefined;
      const animationNodes = this._document.animationNodes;
      if (undefined !== animationNodes) {
        const bytesPerId = JsonUtils.asInt(animationNodes.bytesPerId);
        const bufferViewId = JsonUtils.asString(animationNodes.bufferView);
        const bufferViewJson = this._document.bufferViews[bufferViewId];
        if (undefined !== bufferViewJson) {
          const byteOffset = JsonUtils.asInt(bufferViewJson.byteOffset);
          const byteLength = JsonUtils.asInt(bufferViewJson.byteLength);
          const bytes = this._binaryData.subarray(byteOffset, byteOffset + byteLength);
          switch (bytesPerId) {
            case 1:
              animNodesArray = new Uint8Array(bytes);
              break;
            case 2:
              // NB: A *copy* of the subarray.
              animNodesArray = Uint16Array.from(new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2));
              break;
            case 4:
              // NB: A *copy* of the subarray.
              animNodesArray = Uint32Array.from(new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4));
              break;
          }
        }
      }

      featureTable = {
        multiModel: false,
        data: packedFeatureArray,
        numFeatures: header.count,
        animationNodeIds: animNodesArray,
      };
    }

    // ###TODO populateAnimationNodeIds if we have a timeline.
    this.stream.curPos = this._featureTableInfo.startPos + header.length;
    return featureTable;
  }

  private parseNodes(featureTable: Imdl.FeatureTable): Imdl.Node[] {
    const nodes: Imdl.Node[] = [];
    const docNodes = this._document.nodes;
    const docMeshes = this._document.meshes;
    if (undefined === docNodes.Node_Root) {
      // A veeeery early version of the tile format (prior to introduction of schedule animation support) just supplied a flat list of meshes.
      // We shall never encounter such tiles again.
      return nodes;
    }

    for (const nodeKey of Object.keys(docNodes)) {
      const docNode = this._document.nodes[nodeKey];
      assert(undefined !== docNode); // we're iterating the keys...
      const docMesh = docMeshes[docNode];
      const docPrimitives = docMesh?.primitives;
      if (!docPrimitives)
        continue;

      const layerId = docMesh.layer;
      if ("Node_Root" === nodeKey) {
        if (this._options.timeline) {
          // Split up the root node into transform nodes.
          this.parseAnimationBranches(nodes, docMesh, featureTable, this._options.timeline);
        } else if (this._options.createUntransformedRootNode) {
          // If transform nodes exist in the tile tree, then we need to create a branch for the root node so that elements not associated with
          // any node in the schedule script can be grouped together.
          this.parseBranch(nodes, docPrimitives, AnimationNodeId.Untransformed, undefined);
        } else {
          nodes.push({ primitives: this.parsePrimitives(docPrimitives) });
        }
      } else if (undefined === layerId) {
        this.parseBranch(nodes, docPrimitives, extractNodeId(nodeKey), `${this._options.batchModelId}_${nodeKey}`);
      } else {
        nodes.push({ layerId, primitives: this.parsePrimitives(docPrimitives) });
      }
    }

    return nodes;
  }

  private parseAnimationBranches(output: Imdl.Node[], docMesh: ImdlMesh, featureTable: Imdl.FeatureTable, timeline: ImdlTimeline): void {
  }

  private parseBranch(output: Imdl.Node[], docPrimitives: Array<AnyImdlPrimitive | ImdlAreaPattern>, nodeId: number, animationId: string | undefined): void {
  }

  private parsePrimitives(docPrimitives: Array<AnyImdlPrimitive | ImdlAreaPattern>): Imdl.PrimitiveParams[] {
    const primitives = [];
    for (const docPrimitive of docPrimitives) {
      const primitive = this.parsePrimitive(docPrimitive);
      if (primitive)
        primitives.push(primitive);
    }

    return primitives;
  }

  private parsePrimitive(docPrimitive: AnyImdlPrimitive | ImdlAreaPattern): Imdl.PrimitiveParams | undefined{
    return undefined; // ###TODO
  }
}

export function parseImdlDocument(options: ImdlParserOptions): Imdl.Document | ImdlParseError {
  const stream = options.stream;
  const imdlHeader = new ImdlHeader(stream);
  if (!imdlHeader.isValid)
    return TileReadStatus.InvalidHeader;
  else if (!imdlHeader.isReadableVersion)
    return TileReadStatus.NewerMajorVersion;

  // Skip the feature table - we need to parse the JSON segment first to access its animationNodeIds.
  const ftStartPos = stream.curPos;
  const ftHeader = FeatureTableHeader.readFrom(stream);
  if (!ftHeader)
    return TileReadStatus.InvalidFeatureTable;

  stream.curPos = ftStartPos + ftHeader.length;

  // A glTF header follows the feature table
  const gltfHeader = new GltfHeader(stream);
  if (!gltfHeader.isValid)
    return TileReadStatus.InvalidTileData;

  stream.curPos = gltfHeader.scenePosition;
  const sceneStrData = stream.nextBytes(gltfHeader.sceneStrLength);
  const sceneStr = utf8ToString(sceneStrData);
  if (!sceneStr)
    return TileReadStatus.InvalidScene;

  try {
    const sceneValue = JSON.parse(sceneStr);
    const imdlDoc: Document = {
      scene: JsonUtils.asString(sceneValue.scene),
      scenes: JsonUtils.asArray(sceneValue.scenes),
      animationNodes: JsonUtils.asObject(sceneValue.animationNodes),
      bufferViews: JsonUtils.asObject(sceneValue.bufferViews) ?? { },
      meshes: JsonUtils.asObject(sceneValue.meshes),
      nodes: JsonUtils.asObject(sceneValue.nodes) ?? { },
      materials: JsonUtils.asObject(sceneValue.materials) ?? { },
      renderMaterials: JsonUtils.asObject(sceneValue.renderMaterials) ?? { },
      namedTextures: JsonUtils.asObject(sceneValue.namedTextures) ?? { },
      patternSymbols: JsonUtils.asObject(sceneValue.patternSymbols) ?? { },
      rtcCenter: JsonUtils.asArray(sceneValue.rtcCenter),
    };

    if (!imdlDoc.meshes)
      return TileReadStatus.InvalidTileData;

    const binaryData = new Uint8Array(stream.arrayBuffer, gltfHeader.binaryPosition);
    const featureTable = {
      startPos: ftStartPos,
      multiModel: 0 !== (imdlHeader.flags & ImdlFlags.MultiModelFeatureTable),
    };

    const parser = new ImdlParser(imdlDoc, binaryData, options, featureTable);
    return parser.parse();
  } catch (_) {
    return TileReadStatus.InvalidTileData;
  }
}
