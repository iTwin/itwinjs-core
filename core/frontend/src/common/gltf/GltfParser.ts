/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ByteStream, JsonUtils, Logger, utf8ToString } from "@itwin/core-bentley";
import { Matrix3d, Point3d, Point4d, Transform } from "@itwin/core-geometry";
import { GlbHeader, ImageSource, TileFormat } from "@itwin/core-common";
import type { DracoLoader, DracoMesh } from "@loaders.gl/draco";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";
import { TextureImageSource } from "../render/TextureParams";
import {
  getImageSourceFormatForMimeType, imageBitmapFromImageSource, imageElementFromImageSource, tryImageElementFromUrl,
} from "../ImageUtil";
import {
  DracoMeshCompression, getGltfNodeMeshIds, GltfAccessor, GltfBuffer, GltfBufferViewProps, GltfDictionary, gltfDictionaryIterator, GltfDocument, GltfId, GltfImage, GltfMesh, GltfMeshMode, GltfMeshPrimitive, GltfNode, traverseGltfNodes,
} from "./GltfSchema";
import { Gltf } from "./GltfModel";

/** @internal */
export interface ParseGltfLogger {
  log(message: string, type: "error" | "warning" | "info"): void;
}

/** Arguments supplied to [[parseGltf]].
 * @internal
 */
export interface ParseGltfArgs {
  logger?: ParseGltfLogger;
  gltf: Uint8Array | GltfDocument;
  noCreateImageBitmap?: boolean;
  baseUrl?: string;
  isCanceled?: boolean;
  upAxis?: "y" | "z"; // default "y"
}

/** Parse a [[GltfDocument]] or binary representation thereof to produce a [[Gltf.Model]].
 * This implementation is incomplete and not currently used.
 * @internal
 */
export async function parseGltf(args: ParseGltfArgs): Promise<Gltf.Model | undefined> {
  const source = args.gltf;
  let version: number;
  let json: GltfDocument;
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

  const document: GltfDocument = {
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
    imageFromImageSource: (args.noCreateImageBitmap ?
      async (imgSrc) => imageElementFromImageSource(imgSrc) :
      async (imgSrc) => imageBitmapFromImageSource(imgSrc)),
  });

  return parser.parse();
}

interface GltfParserOptions {
  document: GltfDocument;
  version: number;
  upAxis: "y" | "z";
  binary?: Uint8Array;
  baseUrl?: string;
  logger: ParseGltfLogger;
  imageFromImageSource: (source: ImageSource) => Promise<TextureImageSource>;
  isCanceled: () => boolean;
}

type ParserBuffer = GltfBuffer & { resolvedBuffer?: Gltf.Buffer };
type ParserImage = GltfImage & { resolvedImage?: TextureImageSource };

class GltfParser {
  private readonly _version: number;
  private readonly _upAxis: "y" | "z";
  private readonly _baseUrl?: string;
  private readonly _logger: ParseGltfLogger;
  private readonly _isCanceled: () => boolean;
  private readonly _buffers: GltfDictionary<ParserBuffer>;
  private readonly _images: GltfDictionary<ParserImage>;
  private readonly _nodes: GltfDictionary<GltfNode>;
  private readonly _meshes: GltfDictionary<GltfMesh>;
  private readonly _accessors: GltfDictionary<GltfAccessor>;
  private readonly _sceneNodes: GltfId[];
  private readonly _bufferViews: GltfDictionary<GltfBufferViewProps>;
  private readonly _imageFromImageSource: (source: ImageSource) => Promise<TextureImageSource>;
  private readonly _dracoMeshes = new Map<DracoMeshCompression, DracoMesh>();

  public constructor(options: GltfParserOptions) {
    this._version = options.version;
    this._upAxis = options.upAxis;
    this._baseUrl = options.baseUrl;
    this._logger = options.logger;
    this._isCanceled = options.isCanceled;
    this._imageFromImageSource = options.imageFromImageSource;

    const emptyDict = { };
    const doc = options.document;
    this._buffers = doc.buffers ?? emptyDict;
    this._images = doc.images ?? emptyDict;
    this._nodes = doc.nodes ?? emptyDict;
    this._meshes = doc.meshes ?? emptyDict;
    this._bufferViews = doc.bufferViews ?? emptyDict;
    this._accessors = doc.accessors ?? emptyDict;

    if (options.binary) {
      const buffer = this._buffers[this._version === 2 ? 0 : "binary_glTF"];
      if (buffer && undefined === buffer.uri)
        buffer.resolvedBuffer = { data: options.binary };
    }

    let sceneNodes;
    if (doc.scenes && undefined !== doc.scene)
      sceneNodes = doc.scenes[doc.scene]?.nodes;

    this._sceneNodes = sceneNodes ?? Object.keys(this._nodes);
  }

  public async parse(): Promise<Gltf.Model | undefined> {
    // ###TODO_GLTF RTC_CENTER
    // ###TODO_GLTF pseudo-rtc bias (apply translation to each point at read time, for scalable mesh...)
    const toWorld = undefined;

    await this.resolveResources();
    if (this._isCanceled())
      return undefined;

    // ###TODO_GLTF compute content range (maybe do so elsewhere?)
    // I think spec says POSITION must specify min and max?

    const nodes: Gltf.Node[] = [];
    for (const nodeKey of this._sceneNodes) {
      const node = this._nodes[nodeKey];
      if (node)
        nodes.push(this.parseNode(node));
    }

    return {
      toWorld,
      nodes,
    };
  }

  private parseNode(node: GltfNode): Gltf.Node {
    const primitives = [];
    for (const meshId of getGltfNodeMeshIds(node)) {
      const mesh = this._meshes[meshId];
      if (!mesh)
        continue;

      const parsedPrimitives = this.parsePrimitives(mesh);
      for (const primitive of parsedPrimitives)
        primitives.push(primitive);
    }

    let toParent;
    if (node.matrix) {
      const origin = Point3d.create(node.matrix[12], node.matrix[13], node.matrix[14]);
      const matrix = Matrix3d.createRowValues(
        node.matrix[0], node.matrix[4], node.matrix[8],
        node.matrix[1], node.matrix[5], node.matrix[9],
        node.matrix[2], node.matrix[6], node.matrix[10],
      );

      toParent = Transform.createOriginAndMatrix(origin, matrix);
    } else if (node.rotation || node.scale || node.translation) {
      // SPEC: To compose the local transformation matrix, TRS properties MUST be converted to matrices and postmultiplied in the T * R * S order;
      // first the scale is applied to the vertices, then the rotation, and then the translation.
      const scale = Transform.createRefs(undefined, node.scale ? Matrix3d.createScale(node.scale[0], node.scale[1], node.scale[2]) : Matrix3d.identity);
      const rot = Transform.createRefs(undefined, node.rotation ? Matrix3d.createFromQuaternion(Point4d.create(node.rotation[0], node.rotation[1], node.rotation[2], node.rotation[3])) : Matrix3d.identity);
      rot.matrix.transposeInPlace(); // See comment on Matrix3d.createFromQuaternion
      const trans = Transform.createTranslation(node.translation ? new Point3d(node.translation[0], node.translation[1], node.translation[2]) : Point3d.createZero());

      toParent = scale.multiplyTransformTransform(rot);
      trans.multiplyTransformTransform(toParent, toParent);
    }

    return {
      primitives,
      toParent,
    };
  }

  private parsePrimitives(mesh: GltfMesh): Gltf.AnyPrimitive[] {
    const primitives: Gltf.AnyPrimitive[] = [];
    if (!mesh.primitives)
      return primitives;

    for (const primitive of mesh.primitives) {
      const parsedPrimitive = this.parsePrimitive(primitive);
      if (parsedPrimitive)
        primitives.push(parsedPrimitive);
    }

    return primitives;
  }

  private parsePrimitive(primitive: GltfMeshPrimitive): Gltf.AnyPrimitive | undefined {
    const meshMode = JsonUtils.asInt(primitive.mode, GltfMeshMode.Triangles);
    switch (meshMode) {
      case GltfMeshMode.TriangleStrip:
        return this.parseTrianglesPrimitive(primitive);
      default:
        // ###TODO_GLTF Make parser support all primitive types. Consumer can choose to do whatever with them.
        return undefined;
    }
  }

  private parseTrianglesPrimitive(primitive: GltfMeshPrimitive): Gltf.TrianglesPrimitive | undefined {
    const posId = primitive.attributes.POSITION;
    const pos = undefined !== posId ? this._accessors[posId] : undefined;
    if (!pos)
      return undefined;

    return undefined; // ###TODO_GLTF
  }

  private traverseNodes(nodeIds: Iterable<GltfId>): Iterable<GltfNode> {
    return traverseGltfNodes(nodeIds, this._nodes, new Set<GltfId>());
  }

  private async resolveResources(): Promise<void> {
    // Load any external images and buffers.
    await this._resolveResources();

    // If any meshes are draco-compressed, dynamically load the decoder module and then decode the meshes.
    const dracoMeshes: DracoMeshCompression[] = [];

    for (const node of this.traverseNodes(this._sceneNodes)) {
      for (const meshId of getGltfNodeMeshIds(node)) {
        const mesh = this._meshes[meshId];
        if (mesh?.primitives)
          for (const primitive of mesh.primitives)
            if (primitive.extensions?.KHR_draco_mesh_compression)
              dracoMeshes.push(primitive.extensions.KHR_draco_mesh_compression);
      }
    }

    if (dracoMeshes.length === 0)
      return;

    try {
      const dracoLoader = (await import("@loaders.gl/draco")).DracoLoader;
      await Promise.all(dracoMeshes.map(async (x) => this.decodeDracoMesh(x, dracoLoader)));
    } catch (err) {
      Logger.logWarning(FrontendLoggerCategory.Render, "Failed to decode draco-encoded glTF mesh");
      Logger.logException(FrontendLoggerCategory.Render, err);
    }
  }

  private async _resolveResources(): Promise<void> {
    // ###TODO traverse the scene nodes to find resources referenced by them, instead of resolving everything - some resources may not
    // be required for the scene.
    const promises: Array<Promise<void>> = [];
    try {
      for (const buffer of gltfDictionaryIterator(this._buffers))
        if (!buffer.resolvedBuffer)
          promises.push(this.resolveBuffer(buffer));

      await Promise.all(promises);
      if (this._isCanceled())
        return;

      promises.length = 0;
      for (const image of gltfDictionaryIterator(this._images))
        if (!image.resolvedImage)
          promises.push(this.resolveImage(image));

      await Promise.all(promises);
    } catch (_) {
      // ###TODO_GLTF log
    }
  }

  private resolveUrl(uri: string): string | undefined {
    try {
      return new URL(uri, this._baseUrl).toString();
    } catch (_) {
      return undefined;
    }
  }

  private async resolveBuffer(buffer: ParserBuffer): Promise<void> {
    if (buffer.resolvedBuffer || undefined === buffer.uri)
      return;

    try {
      const url = this.resolveUrl(buffer.uri);
      const response = url ? await fetch(url) : undefined;
      if (this._isCanceled())
        return;

      const data = await response?.arrayBuffer();
      if (this._isCanceled())
        return;

      if (data)
        buffer.resolvedBuffer = { data: new Uint8Array(data) };
    } catch (_) {
      //
    }
  }

  private async resolveImage(image: ParserImage): Promise<void> {
    if (image.resolvedImage)
      return;

    interface BufferViewSource { bufferView?: GltfId, mimeType?: string }
    const bvSrc: BufferViewSource | undefined = undefined !== image.bufferView ? image : image.extensions?.KHR_binary_glTF;
    if (undefined !== bvSrc?.bufferView) {
      const format = undefined !== bvSrc.mimeType ? getImageSourceFormatForMimeType(bvSrc.mimeType) : undefined;
      const bufferView = this._bufferViews[bvSrc.bufferView];
      if (undefined === format || !bufferView || !bufferView.byteLength || bufferView.byteLength < 0)
        return;

      const bufferData = this._buffers[bufferView.buffer]?.resolvedBuffer?.data;
      if (!bufferData)
        return;

      const offset = bufferView.byteOffset ?? 0;
      const bytes = bufferData.subarray(offset, offset + bufferView.byteLength);
      try {
        const imageSource = new ImageSource(bytes, format);
        image.resolvedImage = await this._imageFromImageSource(imageSource);
      } catch (_) {
        //
      }

      return;
    }

    const url = undefined !== image.uri ? this.resolveUrl(image.uri) : undefined;
    if (undefined !== url)
      image.resolvedImage = await tryImageElementFromUrl(url);
  }

  private async decodeDracoMesh(ext: DracoMeshCompression, loader: typeof DracoLoader): Promise<void> {
    const bv = this._bufferViews[ext.bufferView];
    if (!bv || !bv.byteLength)
      return;

    let buf = this._buffers[bv.buffer]?.resolvedBuffer?.data;
    if (!buf)
      return;

    const offset = bv.byteOffset ?? 0;
    buf = buf.subarray(offset, offset + bv.byteLength);
    const mesh = await loader.parse(buf, { }); // NB: `options` argument declared optional but will produce exception if not supplied.
    if (mesh)
      this._dracoMeshes.set(ext, mesh);
  }
}
