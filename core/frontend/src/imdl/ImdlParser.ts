/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ByteStream, JsonUtils, utf8ToString } from "@itwin/core-bentley";
import {
  FeatureTableHeader, GltfV2ChunkTypes, GltfVersions, ImdlFlags, ImdlHeader, RenderSchedule, TileFormat, TileHeader, TileReadStatus,
} from "@itwin/core-common";
import { ImdlModel as Imdl } from "./ImdlModel";
import { ImdlDocument } from "./ImdlSchema";

export type ImdlTimeline = RenderSchedule.ModelTimeline | RenderSchedule.Script;

export interface ImdlParserOptions {
  stream: ByteStream;
  omitEdges?: boolean;
  createUntransformedRootNode?: boolean;
  timeline?: ImdlTimeline;
  isLeaf?: boolean;
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

class ImdlParser {
  private readonly _document: Document;
  private readonly _binaryData: Uint8Array;
  private readonly _options: ImdlParserOptions;
  private readonly _featureTable: Imdl.FeatureTable;

  public constructor(doc: Document, binaryData: Uint8Array, options: ImdlParserOptions, featureTable: Imdl.FeatureTable) {
    this._document = doc;
    this._binaryData = binaryData;
    this._options = options;
    this._featureTable = featureTable;
  }

  public parse(): Imdl.Document | ImdlParseError {
    // ###TODO caller is responsible for decodeTileContentDescription, leafness, etc.
    return TileReadStatus.InvalidTileData; // ###TODO
  }
}

function readFeatureTable(stream: ByteStream): Imdl.FeatureTable | undefined {
  return undefined; // ###TODO
}

export function parseImdlDocument(options: ImdlParserOptions): Imdl.Document | ImdlParseError {
  const stream = options.stream;
  const imdlHeader = new ImdlHeader(stream);
  if (!imdlHeader.isValid)
    return TileReadStatus.InvalidHeader;
  else if (!imdlHeader.isReadableVersion)
    return TileReadStatus.NewerMajorVersion;

  // Read the feature table
  const featureTable = readFeatureTable(stream);
  if (!featureTable)
    return TileReadStatus.InvalidFeatureTable;

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
    const parser = new ImdlParser(imdlDoc, binaryData, options, featureTable);
    return parser.parse();
  } catch (_) {
    return TileReadStatus.InvalidTileData;
  }
}
