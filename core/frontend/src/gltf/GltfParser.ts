/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ByteStream, JsonUtils, Logger, utf8ToString } from "@itwin/core-bentley";
import { GlbHeader, TileFormat } from "@itwin/core-common";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";
import * as schema from "./GltfSchema";
import { Gltf } from "./GltfModel";

export interface ParseGltfLogger {
  log(message: string, type: "error" | "warning" | "info"): void;
}

export interface ParseGltfArgs {
  logger?: ParseGltfLogger;
  gltf: Uint8Array | schema.GltfDocument;
  baseUrl?: string;
  isCanceled?: boolean;
  upAxis?: "y" | "z"; // default "y"
}

export async function parseGltf(args: ParseGltfArgs): Promise<Gltf.Model | undefined> {
  const source = args.gltf;
  let version: number;
  let json: schema.GltfDocument;
  let binary: Uint8Array | undefined;

  if (source instanceof Uint8Array) {
    // It may be JSON - check for magic indicating glb.
    const buffer = ByteStream.fromUint8Array(source);
    if (TileFormat.Gltf !== buffer.readUint32()) {
      try {
        const utf8Json = utf8ToString(source);
        if (!utf8Json)
          return undefined;

        json = JSON.parse(utf8Json);
        version = 2;
      } catch (_) {
        return undefined;
      }
    } else {
      buffer.reset();
      const header = new GlbHeader(buffer);
      if (!header.isValid)
        return undefined;

      version = header.version;
      if (header.binaryChunk)
        binary = new Uint8Array(source.buffer, source.byteOffset + header.binaryChunk.offset, header.binaryChunk.length);

      try {
        const jsonBytes = new Uint8Array(source.buffer, source.byteOffset + header.jsonChunk.offset, header.jsonChunk.length);
        const jsonStr = utf8ToString(jsonBytes);
        if (undefined === jsonStr)
          return undefined;

        json = JSON.parse(jsonStr);
      } catch (_) {
        return undefined;
      }
    }
  } else {
    version = 2; // ###TODO verify against source.asset?.version
    json = source;
  }

  // asset is required in glTF 2, optional in glTF 1
  const asset = JsonUtils.asObject(json.asset);
  if (version === 2 && !asset)
    return undefined;

  const document: schema.GltfDocument = {
    asset,
    scene: JsonUtils.asString(json.scene),
    extensions: JsonUtils.asObject(json.extensions),
    extensionsUsed: JsonUtils.asArray(json.extensionsUsed),
    extensionsRequired: JsonUtils.asArray(json.extensionsRequired),
    accessors: JsonUtils.asObject(json.accessors),
    buffers: JsonUtils.asObject(json.buffers),
    bufferViews: JsonUtils.asObject(json.bufferViews),
    images: JsonUtils.asObject(json.images),
    materials: JsonUtils.asObject(json.materials),
    meshes: JsonUtils.asObject(json.meshes),
    nodes: JsonUtils.asObject(json.nodes),
    samplers: JsonUtils.asObject(json.samplers),
    scenes: JsonUtils.asObject(json.scenes),
    textures: JsonUtils.asObject(json.textures),
    techniques: JsonUtils.asObject(json.techniques),
  };

  if (!document.meshes)
    return undefined;

  const logger = args.logger ?? {
    log: (message: string, type: "error" | "warning" | "info") => {
      const category = `${FrontendLoggerCategory.Package}.gltf`;
      const fn = type === "error" ? "logError" : (type === "warning" ? "logWarning" : "logInfo");
      Logger[fn](category, message);
    },
  };

  const parser = new GltfParser({
    document,
    version,
    upAxis: args.upAxis ?? "y",
    binary,
    baseUrl: args.baseUrl,
    logger,
    isCanceled: () => args.isCanceled ?? false,
  });

  return parser.parse();
}

interface GltfParserOptions {
  document: schema.GltfDocument;
  version: number;
  upAxis: "y" | "z";
  binary?: Uint8Array;
  baseUrl?: string;
  logger: ParseGltfLogger;
  isCanceled: () => boolean;
}

type ParserBuffer = schema.GltfBuffer & { resolvedBuffer?: Uint8Array };

class GltfParser {
  private readonly _version: number;
  private readonly _upAxis: "y" | "z";
  private readonly _baseUrl?: string
  private readonly _logger: ParseGltfLogger;
  private readonly _isCanceled: () => boolean;
  private readonly _buffers: schema.GltfDictionary<ParserBuffer>;
  private readonly _nodes: schema.GltfDictionary<schema.GltfNode>;
  private readonly _sceneNodes: schema.GltfId[];

  public constructor(options: GltfParserOptions) {
    this._version = options.version;
    this._upAxis = options.upAxis;
    this._baseUrl = options.baseUrl;
    this._logger = options.logger;
    this._isCanceled = options.isCanceled;

    const emptyDict = { };
    const doc = options.document;
    this._buffers = doc.buffers ?? emptyDict;
    this._nodes = doc.nodes ?? emptyDict;

    if (options.binary) {
      const buffer = this._buffers[this._version === 2 ? 0 : "binary_glTF"];
      if (buffer && undefined === buffer.uri)
        buffer.resolvedBuffer = options.binary;
    }

    let sceneNodes;
    if (doc.scenes && undefined !== doc.scene)
      sceneNodes = doc.scenes[doc.scene]?.nodes;

    this._sceneNodes = sceneNodes ?? Object.keys(this._nodes);
  }

  public async parse(): Promise<Gltf.Model | undefined> {
    // ###TODO_GLTF RTC_CENTER
    // ###TODO_GLTF pseudo-rtc bias (apply translation to each point at read time, for scalable mesh...)
    return undefined;
  }
}
