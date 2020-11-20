/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ByteStream, Id64String, JsonUtils, utf8ToString } from "@bentley/bentleyjs-core";
import { Angle, Matrix3d, Point2d, Point3d, Range3d, Transform, Vector3d } from "@bentley/geometry-core";
import {
  BatchType, ColorDef, ElementAlignedBox3d, FeatureTable, FillFlags, GltfBufferData, GltfBufferView, GltfDataType, GltfHeader, GltfMeshMode,
  ImageSource, ImageSourceFormat, LinePixels, MeshEdge, MeshEdges, MeshPolyline, MeshPolylineList, OctEncodedNormal, PackedFeatureTable, QParams3d, QPoint3d, QPoint3dList,
  RenderTexture, TextureMapping, TileReadStatus,
} from "@bentley/imodeljs-common";
import { getImageSourceFormatForMimeType, imageElementFromImageSource } from "../ImageUtil";
import { IModelConnection } from "../IModelConnection";
import { GraphicBranch } from "../render/GraphicBranch";
import { InstancedGraphicParams } from "../render/InstancedGraphicParams";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { Mesh, MeshGraphicArgs, MeshList } from "../render/primitives/mesh/MeshPrimitives";
import { Triangle } from "../render/primitives/Primitives";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderSystem } from "../render/RenderSystem";
import { TileContent } from "./internal";

/* eslint-disable no-restricted-syntax */

/* -----------------------------------
 * To restore the use of web workers to decode jpeg, locate and uncomment the three sections by searching for "webworker".
  import { WorkerOperation, WebWorkerManager } from "../WebWorkerManager";
  ------------------------------------ */

/** The result of [[GltfReader.read]].
 * @internal
 */
export interface GltfReaderResult extends TileContent {
  readStatus: TileReadStatus;
}

/** Data required for creating a [[GltfReader]] capable of deserializing [glTF](https://www.khronos.org/gltf/).
 * @internal
 */
export class GltfReaderProps {
  private constructor(public readonly buffer: ByteStream,
    public readonly binaryData: Uint8Array,
    public readonly accessors: any,
    public readonly bufferViews: any,
    public readonly scene: any,
    public readonly nodes: any,
    public readonly meshes: any,
    public readonly materials: any,
    public readonly extensions: any,
    public readonly samplers: any,
    public readonly techniques: any,
    public readonly yAxisUp: boolean) { }

  /** Attempt to construct a new GltfReaderProps from the binary data beginning at the supplied stream's current read position. */
  public static create(buffer: ByteStream, yAxisUp: boolean = false): GltfReaderProps | undefined {
    const header = new GltfHeader(buffer);
    if (!header.isValid)
      return undefined;

    const binaryData = new Uint8Array(buffer.arrayBuffer, header.binaryPosition);
    buffer.curPos = header.scenePosition;
    const sceneStrData = buffer.nextBytes(header.sceneStrLength);
    const sceneStr = utf8ToString(sceneStrData);
    if (undefined === sceneStr)
      return undefined;

    try {
      const sceneValue = JSON.parse(sceneStr);
      const nodes = JsonUtils.asObject(sceneValue.nodes);
      const meshes = JsonUtils.asObject(sceneValue.meshes);
      const materialValues = JsonUtils.asObject(sceneValue.materials);
      const accessors = JsonUtils.asObject(sceneValue.accessors);
      const bufferViews = JsonUtils.asObject(sceneValue.bufferViews);
      const extensions = JsonUtils.asObject(sceneValue.extensions);
      const samplers = JsonUtils.asObject(sceneValue.samplers);
      const techniques = JsonUtils.asObject(sceneValue.techniques);

      if (undefined === meshes)
        return undefined;

      return new GltfReaderProps(buffer, binaryData, accessors, bufferViews, sceneValue, nodes, meshes, materialValues, extensions, samplers, techniques, yAxisUp);
    } catch (e) {
      return undefined;
    }
  }
}

/** A function that returns true if deserialization of the data supplied by the reader should abort.
 * @internal
 */
export type ShouldAbortReadGltf = (reader: GltfReader) => boolean;

/* -----------------------------------
   This is part of the webworker option.

  // input is Uint8Array, the result is an ImageBitMap.
  class ImageDecodeWorkerOperation extends WorkerOperation {
    constructor(imageBytes: ArrayBuffer, imageMimeType: string) {
      super("imageBytesToImageBitmap", [imageBytes, imageMimeType], [imageBytes]);
    }
  }
-------------------------------------- */

/** Deserializes [glTF](https://www.khronos.org/gltf/).
 * @internal
 */
export abstract class GltfReader {
  protected readonly _buffer: ByteStream;
  protected readonly _scene: any;
  protected readonly _accessors: any;
  protected readonly _bufferViews: any;
  protected readonly _meshes: any;
  protected readonly _nodes: any;
  protected readonly _batchData: any;
  protected readonly _materialValues: any;
  protected readonly _textures: any;
  protected readonly _renderMaterials: any;  // Materials that may be deserialized and created directly
  protected readonly _namedTextures: any;    // Textures that may be deserialized and created directly
  protected readonly _images: any;
  protected readonly _samplers: any;
  protected readonly _techniques: any;
  protected readonly _extensions: any;
  protected readonly _binaryData: Uint8Array;
  protected readonly _iModel: IModelConnection;
  protected readonly _is3d: boolean;
  protected readonly _modelId: Id64String;
  protected readonly _system: RenderSystem;
  protected readonly _returnToCenter: number[] | undefined;
  protected readonly _yAxisUp: boolean;
  protected readonly _type: BatchType;
  private readonly _canceled?: ShouldAbortReadGltf;

  /* -----------------------------------
  private static _webWorkerManager: WebWorkerManager;

  private static get webWorkerManager() {
    if (!GltfReader._webWorkerManager) {
      GltfReader._webWorkerManager = new WebWorkerManager("v" + BUILD_SEMVER + "/frontend-webworker.js", 4);
    }
    return GltfReader._webWorkerManager;
  }
  ------------------------------------- */

  /** Asynchronously deserialize the tile data and return the result. */
  public async abstract read(): Promise<GltfReaderResult>;

  protected get _isCanceled(): boolean { return undefined !== this._canceled && this._canceled(this); }
  protected get _isVolumeClassifier(): boolean { return BatchType.VolumeClassifier === this._type; }

  protected readGltfAndCreateGraphics(isLeaf: boolean, featureTable: FeatureTable, contentRange: ElementAlignedBox3d, transformToRoot?: Transform, pseudoRtcBias?: Vector3d, instances?: InstancedGraphicParams): GltfReaderResult {
    if (this._isCanceled)
      return { readStatus: TileReadStatus.Canceled, isLeaf };

    if (this._returnToCenter !== undefined || this._nodes[0]?.matrix !== undefined || (pseudoRtcBias !== undefined && pseudoRtcBias.magnitude() < 1.0E5))
      pseudoRtcBias = undefined;

    const childNodes = new Set<string>();
    for (const key of Object.keys(this._nodes)) {
      const node = this._nodes[key];
      if (node.children)
        for (const child of node.children)
          childNodes.add(child.toString());
    }

    const renderGraphicList: RenderGraphic[] = [];
    let readStatus: TileReadStatus = TileReadStatus.InvalidTileData;
    for (const nodeKey of Object.keys(this._nodes))
      if (!childNodes.has(nodeKey))
        if (TileReadStatus.Success !== (readStatus = this.readNodeAndCreateGraphics(renderGraphicList, this._nodes[nodeKey], featureTable, undefined, instances, pseudoRtcBias)))
          return { readStatus, isLeaf };

    if (0 === renderGraphicList.length)
      return { readStatus: TileReadStatus.InvalidTileData, isLeaf };

    let renderGraphic: RenderGraphic | undefined;
    if (1 === renderGraphicList.length)
      renderGraphic = renderGraphicList[0];
    else
      renderGraphic = this._system.createGraphicList(renderGraphicList);

    let transform;
    let range = contentRange;
    if (undefined !== this._returnToCenter || undefined !== pseudoRtcBias || this._yAxisUp || undefined !== transformToRoot) {
      if (undefined !== this._returnToCenter)
        transform = Transform.createTranslationXYZ(this._returnToCenter[0], this._returnToCenter[1], this._returnToCenter[2]);
      else if (undefined !== pseudoRtcBias)
        transform = Transform.createTranslationXYZ(pseudoRtcBias.x, pseudoRtcBias.y, pseudoRtcBias.z);
      else
        transform = Transform.createIdentity();

      if (this._yAxisUp)
        transform = transform.multiplyTransformMatrix3d(Matrix3d.createRotationAroundVector(Vector3d.create(1.0, 0.0, 0.0), Angle.createRadians(Angle.piOver2Radians)) as Matrix3d);
      if (undefined !== transformToRoot)
        transform = transformToRoot.multiplyTransformTransform(transform);

      range = transform.inverse()!.multiplyRange(contentRange);
    }
    renderGraphic = this._system.createBatch(renderGraphic, PackedFeatureTable.pack(featureTable), range);
    if (transform) {
      const branch = new GraphicBranch(true);
      branch.add(renderGraphic);
      renderGraphic = this._system.createBranch(branch, transform);
    }

    return {
      readStatus,
      isLeaf,
      contentRange,
      graphic: renderGraphic,
    };
  }

  private readNodeAndCreateGraphics(renderGraphicList: RenderGraphic[], node: any, featureTable: FeatureTable, parentTransform: Transform | undefined, instances?: InstancedGraphicParams, pseudoRtcBias?: Vector3d): TileReadStatus {
    if (undefined === node)
      return TileReadStatus.InvalidTileData;

    let thisTransform = parentTransform;
    let thisBias;
    if (Array.isArray(node.matrix)) {
      const jTrans = node.matrix;
      const nodeTransform = Transform.createOriginAndMatrix(Point3d.create(jTrans[12], jTrans[13], jTrans[14]), Matrix3d.createRowValues(jTrans[0], jTrans[4], jTrans[8], jTrans[1], jTrans[5], jTrans[9], jTrans[2], jTrans[6], jTrans[10]));
      thisTransform = thisTransform ? thisTransform.multiplyTransformTransform(nodeTransform) : nodeTransform;
    }
    /**
     * This is a workaround for tiles generated by
     * context capture which have a large offset from the tileset origin that exceeds the
     * capacity of 32 bit integers. It is essentially an ad hoc RTC applied at read time only if the tile is far from the
     * origin and there is no RTC supplied either with the B3DM of the GLTF.
     * as the vertices are supplied in a quantized format, applying the RTC bias to
     * quantization origin will make these tiles work correctly.
     */
    if (undefined !== pseudoRtcBias) {
      thisBias = (undefined === thisTransform) ? pseudoRtcBias : thisTransform.matrix.multiplyInverse(pseudoRtcBias);
    }
    const meshKey = node.meshes ? node.meshes : node.mesh;
    if (undefined !== meshKey) {
      const nodeMesh = this._meshes[meshKey];
      if (nodeMesh) {
        const meshGraphicArgs = new MeshGraphicArgs();
        const meshes = new MeshList(featureTable);
        for (const primitive of nodeMesh.primitives) {
          const geometry = this.readMeshPrimitive(primitive, featureTable, thisBias);
          if (undefined !== geometry)
            meshes.push(geometry);
        }

        let renderGraphic: RenderGraphic | undefined;
        if (0 !== meshes.length) {
          if (1 === meshes.length) {
            renderGraphic = meshes[0].getGraphics(meshGraphicArgs, this._system, instances);
          } else {
            const thisList: RenderGraphic[] = [];
            for (const mesh of meshes) {
              renderGraphic = mesh.getGraphics(meshGraphicArgs, this._system, instances);
              if (undefined !== renderGraphic)
                thisList.push(renderGraphic);
            }
            if (0 !== thisList.length)
              renderGraphic = this._system.createGraphicList(thisList);
          }
          if (renderGraphic) {
            if (thisTransform && !thisTransform.isIdentity) {
              const branch = new GraphicBranch(true);
              branch.add(renderGraphic);
              renderGraphic = this._system.createBranch(branch, thisTransform);
            }
            renderGraphicList.push(renderGraphic);
          }
        }
      }
    }
    if (node.children) {
      for (const child of node.children)
        this.readNodeAndCreateGraphics(renderGraphicList, this._nodes[child], featureTable, thisTransform, instances);
    }
    return TileReadStatus.Success;
  }

  public getBufferView(json: any, accessorName: string): GltfBufferView | undefined {
    try {
      const accessorValue = JsonUtils.asString(json[accessorName]);
      const accessor = 0 < accessorValue.length ? JsonUtils.asObject(this._accessors[accessorValue]) : undefined;
      const bufferViewAccessorValue = undefined !== accessor ? JsonUtils.asString(accessor.bufferView) : "";
      const bufferView = 0 < bufferViewAccessorValue.length ? JsonUtils.asObject(this._bufferViews[bufferViewAccessorValue]) : undefined;

      if (undefined === accessor)
        return undefined;

      const type = accessor.componentType as GltfDataType;
      let dataSize = 0;
      switch (type) {
        case GltfDataType.UnsignedByte:
          dataSize = 1;
          break;
        case GltfDataType.UnsignedShort:
          dataSize = 2;
          break;
        case GltfDataType.UInt32:
        case GltfDataType.Float:
          dataSize = 4;
          break;
        default:
          return undefined;
      }
      let componentCount = 1;
      switch (accessor.type) {
        case "VEC3":
          componentCount = 3;
          break;
        case "VEC2":
          componentCount = 2;
          break;
      }

      const byteStride = bufferView.byteStride ? bufferView.byteStride : componentCount * dataSize;
      const offset = ((bufferView && bufferView.byteOffset) ? bufferView.byteOffset : 0) + (accessor.byteOffset ? accessor.byteOffset : 0);
      const length = byteStride * accessor.count;
      // If the data is misaligned (Scalable mesh tile publisher) use slice to copy -- else use subarray.
      // assert(0 === offset % dataSize);
      const bytes = (0 === (this._binaryData.byteOffset + offset) % dataSize) ? this._binaryData.subarray(offset, offset + length) : this._binaryData.slice(offset, offset + length);
      return new GltfBufferView(bytes, accessor.count as number, type, accessor, byteStride / dataSize);
    } catch (e) {
      return undefined;
    }
  }

  public readBufferData32(json: any, accessorName: string): GltfBufferData | undefined { return this.readBufferData(json, accessorName, GltfDataType.UInt32); }
  public readBufferData16(json: any, accessorName: string): GltfBufferData | undefined { return this.readBufferData(json, accessorName, GltfDataType.UnsignedShort); }
  public readBufferData8(json: any, accessorName: string): GltfBufferData | undefined { return this.readBufferData(json, accessorName, GltfDataType.UnsignedByte); }
  public readBufferDataFloat(json: any, accessorName: string): GltfBufferData | undefined { return this.readBufferData(json, accessorName, GltfDataType.Float); }

  protected constructor(props: GltfReaderProps, iModel: IModelConnection, modelId: Id64String, is3d: boolean, system: RenderSystem, type: BatchType = BatchType.Primary, isCanceled?: ShouldAbortReadGltf) {
    this._buffer = props.buffer;
    this._scene = props.scene;
    this._binaryData = props.binaryData;
    this._accessors = props.accessors;
    this._bufferViews = props.bufferViews;
    this._meshes = props.meshes;
    this._nodes = props.nodes;
    this._materialValues = props.materials;
    this._samplers = props.samplers;
    this._techniques = props.techniques;
    this._extensions = props.extensions;
    this._yAxisUp = props.yAxisUp;
    this._returnToCenter = this.extractReturnToCenter(props.extensions);
    this._textures = props.scene.textures;
    this._images = props.scene.images;

    this._renderMaterials = props.scene.renderMaterials;
    this._namedTextures = props.scene.namedTextures;

    this._iModel = iModel;
    this._modelId = modelId;
    this._is3d = is3d;
    this._system = system;
    this._type = type;
    this._canceled = isCanceled;
  }

  protected readBufferData(json: any, accessorName: string, type: GltfDataType): GltfBufferData | undefined {
    const view = this.getBufferView(json, accessorName);
    return undefined !== view ? view.toBufferData(type) : undefined;
  }

  protected readFeatureIndices(_json: any): number[] | undefined { return undefined; }

  private colorFromJson(values: number[]): ColorDef { return ColorDef.from(values[0] * 255, values[1] * 255, values[2] * 255, (1.0 - values[3]) * 255); }

  private colorFromMaterial(materialJson: any): ColorDef {
    if (materialJson) {
      if (materialJson.values && Array.isArray(materialJson.values.color))
        return this.colorFromJson(materialJson.values.color);
      else if (materialJson.pbrMetallicRoughness && Array.isArray(materialJson.pbrMetallicRoughness.baseColorFactor))
        return this.colorFromJson(materialJson.pbrMetallicRoughness.baseColorFactor);
      else if (materialJson.extensions && materialJson.extensions.KHR_techniques_webgl && materialJson.extensions.KHR_techniques_webgl.values && materialJson.extensions.KHR_techniques_webgl.values.u_color)
        return this.colorFromJson(materialJson.extensions.KHR_techniques_webgl.values.u_color);
    }

    return ColorDef.white;
  }

  private extractTextureId(materialJson: any): string | undefined {
    if (typeof materialJson !== "object")
      return undefined;

    const extractId = (value: any) => {
      switch (typeof value) {
        case "string":
          return value;
        case "number":
          return value.toString();
        default:
          return undefined;
      }
    };

    // Bimium's shader value...almost certainly obsolete at this point.
    let id = extractId(materialJson.values?.tex);
    if (undefined !== id)
      return id;

    // KHR_techniques_webgl extension
    const techniques = this._extensions?.KHR_techniques_webgl?.techniques;
    const ext = Array.isArray(techniques) ? materialJson.extensions?.KHR_techniques_webgl : undefined;
    if (undefined !== ext && typeof ext.values === "object") {
      const uniforms = typeof ext.technique === "number" ? techniques[ext.technique].uniforms : undefined;
      if (typeof uniforms === "object") {
        for (const uniformName of Object.keys(uniforms)) {
          const uniform = uniforms[uniformName];
          if (typeof uniform === "object" && uniform.type === GltfDataType.Sampler2d)
            return extractId(ext.values[uniformName]?.index);
        }
      }
    }

    id = extractId(materialJson.diffuseTexture?.index);
    id = id ?? extractId(materialJson.emissiveTexture?.index);
    return id ?? extractId(materialJson.pbrMetallicRoughness?.baseColorTexture?.index);
  }

  protected createDisplayParams(materialJson: any, hasBakedLighting: boolean): DisplayParams | undefined {
    const textureId = this.extractTextureId(materialJson);
    const textureMapping = undefined !== textureId ? this.findTextureMapping(textureId) : undefined;
    const color = this.colorFromMaterial(materialJson);
    return new DisplayParams(DisplayParams.Type.Mesh, color, color, 1, LinePixels.Solid, FillFlags.Always, undefined, undefined, hasBakedLighting, textureMapping);
  }
  protected extractReturnToCenter(extensions: any): number[] | undefined {
    if (extensions === undefined) { return undefined; }
    const cesiumRtc = JsonUtils.asObject(extensions.CESIUM_RTC);
    if (cesiumRtc === undefined) return undefined;
    const rtc = JsonUtils.asArray(cesiumRtc.center);
    return (rtc[0] === 0.0 && rtc[1] === 0.0 && rtc[2] === 0.0) ? undefined : rtc;
  }

  protected readMeshPrimitive(primitive: any, featureTable?: FeatureTable, pseudoRtcBias?: Vector3d): Mesh | undefined {
    const materialName = JsonUtils.asString(primitive.material);
    const hasBakedLighting = undefined === primitive.attributes.NORMAL;
    const materialValue = 0 < materialName.length ? JsonUtils.asObject(this._materialValues[materialName]) : undefined;
    const displayParams = this.createDisplayParams(materialValue, hasBakedLighting);
    if (undefined === displayParams)
      return undefined;

    let primitiveType: number = -1;
    const meshMode = JsonUtils.asInt(primitive.mode, GltfMeshMode.Triangles);
    switch (meshMode) {
      case GltfMeshMode.Lines:
        primitiveType = Mesh.PrimitiveType.Polyline;
        break;

      case GltfMeshMode.Points:
        primitiveType = Mesh.PrimitiveType.Point;
        break;

      case GltfMeshMode.Triangles:
        primitiveType = Mesh.PrimitiveType.Mesh;
        break;

      default:
        assert(false);
        return undefined;
    }
    const isPlanar = JsonUtils.asBool(primitive.isPlanar);

    const isVolumeClassifier = this._isVolumeClassifier;
    const mesh = Mesh.create({
      displayParams,
      features: undefined !== featureTable ? new Mesh.Features(featureTable) : undefined,
      type: primitiveType,
      range: Range3d.createNull(),
      is2d: !this._is3d,
      isPlanar,
      hasBakedLighting,
      isVolumeClassifier,
    });
    // We don't have real colormap - just load material color.  This will be used if non-Bentley
    // tile or fit the color table is uniform. For a non-Bentley, non-Uniform, we'll set the
    // uv parameters to pick the colors out of the color map texture.
    mesh.colorMap.insert(displayParams.fillColor.tbgr);   // White...

    const colorIndices = this.readBufferData16(primitive.attributes, "_COLORINDEX");
    if (undefined !== colorIndices) {
      let texStep;
      if (materialValue.values !== undefined && Array.isArray(materialValue.values.texStep))
        texStep = materialValue.values.texStep;
      else if (materialValue.extensions && materialValue.extensions.KHR_techniques_webgl && materialValue.extensions.KHR_techniques_webgl.values && Array.isArray(materialValue.extensions.KHR_techniques_webgl.values.u_texStep))
        texStep = materialValue.extensions.KHR_techniques_webgl.values.u_texStep;

      if (texStep)
        for (let i = 0; i < colorIndices.count; i++)
          mesh.uvParams.push(new Point2d(texStep[1] + texStep[0] * colorIndices.buffer[i], .5));
    }

    if (primitive.extensions?.KHR_draco_mesh_compression) {
      return undefined; // Defer Draco decompression until web workers implementation.
      /*
      const dracoExtension = primitive.extensions.KHR_draco_mesh_compression;
      const bufferView = this._bufferViews[dracoExtension.bufferView];
      if (undefined === bufferView) return undefined;
      const bufferData = this._binaryData.subarray(bufferView.byteOffset, bufferView.byteOffset + bufferView.byteLength);

      return DracoDecoder.readDracoMesh(mesh, primitive, bufferData, dracoExtension.attributes); */
    }

    this.readBatchTable(mesh, primitive);

    if (!this.readVertices(mesh.points, primitive, pseudoRtcBias))
      return undefined;

    switch (primitiveType) {
      case Mesh.PrimitiveType.Mesh: {
        if (!this.readMeshIndices(mesh, primitive))
          return undefined;

        if (!displayParams.ignoreLighting && !this.readNormals(mesh.normals, primitive.attributes, "NORMAL"))
          return undefined;

        if (0 === mesh.uvParams.length)
          this.readUVParams(mesh.uvParams, primitive.attributes, "TEXCOORD_0");
        break;
      }

      case Mesh.PrimitiveType.Polyline:
      case Mesh.PrimitiveType.Point: {
        if (undefined !== mesh.polylines && !this.readPolylines(mesh.polylines, primitive, "indices", Mesh.PrimitiveType.Point === primitiveType))
          return undefined;
        break;
      }
      default: {
        assert(false, "unhandled primitive type");
        return undefined;
      }
    }
    if (displayParams.textureMapping && 0 === mesh.uvParams.length)
      return undefined;

    if (primitive.extensions?.CESIUM_primitive_outline) {
      const data = this.readBufferData32(primitive.extensions.CESIUM_primitive_outline, "indices");
      if (data !== undefined) {
        assert(0 === data.count % 2);
        mesh.edges = new MeshEdges();
        for (let i = 0; i < data.count;)
          mesh.edges.visible.push(new MeshEdge(data.buffer[i++], data.buffer[i++]));
      }
    }

    return mesh;
  }

  /**
   *
   * @param positions quantized points
   * @param primitive input json
   * @param pseudoRtcBias a bias applied to each point - this is a workaround for tiles generated by
   * context capture which have a large offset from the tileset origin that exceeds the
   * capacity of 32 bit integers. This is essentially an ad hoc RTC applied at read time.
   */
  protected readVertices(positions: QPoint3dList, primitive: any, pseudoRtcBias?: Vector3d): boolean {
    const view = this.getBufferView(primitive.attributes, "POSITION");
    if (undefined === view)
      return false;

    if (GltfDataType.Float === view.type) {
      const buffer = view.toBufferData(GltfDataType.Float);
      if (undefined === buffer)
        return false;

      const strideSkip = view.stride - 3;
      const range = Range3d.createNull();
      for (let i = 0; i < buffer.buffer.length; i += strideSkip)
        range.extendXYZ(buffer.buffer[i++], buffer.buffer[i++], buffer.buffer[i++]);

      positions.reset(QParams3d.fromRange(range));
      const scratchPoint = new Point3d();
      for (let i = 0, j = 0; i < buffer.count; i++, j += strideSkip) {
        scratchPoint.set(buffer.buffer[j++], buffer.buffer[j++], buffer.buffer[j++]);
        if (undefined !== pseudoRtcBias)
          scratchPoint.subtractInPlace(pseudoRtcBias);

        positions.add(scratchPoint);
      }
    } else {
      if (GltfDataType.UnsignedShort !== view.type)
        return false;

      const extensions = JsonUtils.asObject(view.accessor.extensions);
      const quantized = undefined !== extensions ? JsonUtils.asObject(extensions.WEB3D_quantized_attributes) : undefined;
      if (undefined === quantized)
        return false;

      const rangeMin = JsonUtils.asArray(quantized.decodedMin);
      const rangeMax = JsonUtils.asArray(quantized.decodedMax);
      if (undefined === rangeMin || undefined === rangeMax)
        return false;

      const buffer = view.toBufferData(GltfDataType.UnsignedShort);
      if (undefined === buffer)
        return false;

      const qpt = QPoint3d.fromScalars(0, 0, 0);
      const qRange = Range3d.create(Point3d.create(rangeMin[0], rangeMin[1], rangeMin[2]), Point3d.create(rangeMax[0], rangeMax[1], rangeMax[2]));
      if (undefined !== pseudoRtcBias) {
        qRange.low.subtractInPlace(pseudoRtcBias);
        qRange.high.subtractInPlace(pseudoRtcBias);
      }
      positions.reset(QParams3d.fromRange(qRange));
      for (let i = 0; i < view.count; i++) {
        const index = i * view.stride;
        qpt.setFromScalars(buffer.buffer[index], buffer.buffer[index + 1], buffer.buffer[index + 2]);
        positions.push(qpt);
      }
    }

    return true;
  }

  protected readIndices(json: any, accessorName: string): number[] | undefined {
    const data = this.readBufferData32(json, accessorName);
    if (undefined === data)
      return undefined;

    const indices = [];
    for (let i = 0; i < data.count; i++)
      indices.push(data.buffer[i]);

    return indices;
  }

  protected readBatchTable(_mesh: Mesh, _json: any) {
  }

  protected readMeshIndices(mesh: Mesh, json: any): boolean {
    const data = this.readBufferData32(json, "indices");
    if (undefined === data)
      return false;

    assert(0 === data.count % 3);

    const triangle = new Triangle(false);

    for (let i = 0; i < data.count; i += 3) {
      triangle.setIndices(data.buffer[i], data.buffer[i + 1], data.buffer[i + 2]);
      mesh.addTriangle(triangle);
    }

    return true;
  }

  protected readNormals(normals: OctEncodedNormal[], json: any, accessorName: string): boolean {
    const view = this.getBufferView(json, accessorName);
    if (undefined === view)
      return false;

    switch (view.type) {
      case GltfDataType.Float: {
        const data = view.toBufferData(GltfDataType.Float);
        if (undefined === data)
          return false;

        const scratchNormal = new Vector3d();
        const strideSkip = view.stride - 3;
        for (let i = 0, j = 0; i < data.count; i++, j += strideSkip) {
          scratchNormal.set(data.buffer[j++], data.buffer[j++], data.buffer[j++]);
          normals.push(OctEncodedNormal.fromVector(scratchNormal));
        }
        return true;
      }

      case GltfDataType.UnsignedByte: {
        const data = view.toBufferData(GltfDataType.UnsignedByte);
        if (undefined === data)
          return false;

        // ###TODO: we shouldn't have to allocate OctEncodedNormal objects...just use uint16s / numbers...
        for (let i = 0; i < data.count; i++) {
          // ###TODO? not clear why ray writes these as pairs of uint8...
          const index = i * view.stride;
          const normal = data.buffer[index] | (data.buffer[index + 1] << 8);
          normals.push(new OctEncodedNormal(normal));
        }
        return true;
      }
      default:
        return false;
    }
  }

  protected readUVParams(params: Point2d[], json: any, accessorName: string): boolean {
    const view = this.getBufferView(json, accessorName);
    let data: any;

    if (view === undefined) { return false; }
    switch (view.type) {
      case GltfDataType.Float: {
        data = this.readBufferDataFloat(json, accessorName);

        for (let i = 0; i < data.count; i++) {
          const index = view.stride * i; // 2 float per param...
          params.push(new Point2d(data.buffer[index], data.buffer[index + 1]));
        }
        break;
      }

      case GltfDataType.UnsignedShort: {
        // TBD.   Support quantized UVParams in shaders rather than expanding here.
        const extensions = JsonUtils.asObject(view.accessor.extensions);
        const quantized = undefined !== extensions ? JsonUtils.asObject(extensions.WEB3D_quantized_attributes) : undefined;
        if (undefined === quantized)
          return false;

        const decodeMatrix = JsonUtils.asArray(quantized.decodeMatrix);
        if (undefined === decodeMatrix) { return false; }

        const qData = view.toBufferData(GltfDataType.UnsignedShort);
        if (undefined === qData) { return false; }

        for (let i = 0; i < view.count; i++) {
          const index = view.stride * i; // 3 uint16 per QPoint3d...
          params.push(new Point2d(qData.buffer[index] * decodeMatrix[0] + decodeMatrix[6], qData.buffer[index + 1] * decodeMatrix[4] + decodeMatrix[7]));
        }
        break;
      }
    }

    return true;
  }

  protected readPolylines(polylines: MeshPolylineList, json: any, accessorName: string, disjoint: boolean): boolean {
    const data = this.readBufferData32(json, accessorName);
    if (undefined === data)
      return false;

    const indices = new Array<number>();
    if (disjoint) {
      for (let i = 0; i < data.count;)
        indices.push(data.buffer[i++]);
    } else {
      for (let i = 0; i < data.count;) {
        const index0 = data.buffer[i++];
        const index1 = data.buffer[i++];
        if (0 === indices.length || index0 !== indices[indices.length - 1]) {
          if (indices.length !== 0) {
            polylines.push(new MeshPolyline(indices));
            indices.length = 0;
          }
          indices.push(index0);
        }
        indices.push(index1);
      }
    }
    if (indices.length !== 0)
      polylines.push(new MeshPolyline(indices));

    return true;
  }

  protected async loadTextures(): Promise<void> {
    if (undefined === this._textures)
      return;

    const transparentTextures: Set<string> = new Set<string>();
    for (const name of Object.keys(this._materialValues)) {
      const materialValue = this._materialValues[name];
      let technique;
      if (undefined !== materialValue.values &&
        undefined !== materialValue.values.tex &&
        undefined !== materialValue.technique &&
        undefined !== (technique = this._techniques[materialValue.technique]) &&
        undefined !== technique.states &&
        Array.isArray(technique.states.enable)) {
        for (const enable of technique.states.enable)
          if (enable === 3042)
            transparentTextures.add(materialValue.values.tex);
      }
    }

    const promises = new Array<Promise<void>>();
    for (const name of Object.keys(this._textures))
      promises.push(this.loadTexture(name, transparentTextures.has(name)));

    if (promises.length > 0)
      await Promise.all(promises);
  }

  protected async loadTextureImage(imageJson: any, samplerJson: any, isTransparent: boolean): Promise<RenderTexture | undefined> {
    try {
      const binaryImageJson = (imageJson.extensions && imageJson.extensions.KHR_binary_glTF) ? JsonUtils.asObject(imageJson.extensions.KHR_binary_glTF) : imageJson;
      const bufferView = this._bufferViews[binaryImageJson.bufferView];
      const mimeType = JsonUtils.asString(binaryImageJson.mimeType);
      const format = getImageSourceFormatForMimeType(mimeType);
      if (undefined === format)
        return undefined;

      let textureType = RenderTexture.Type.Normal;
      if (undefined !== samplerJson &&
        (undefined !== samplerJson.wrapS || undefined !== samplerJson.wrapT))
        textureType = RenderTexture.Type.TileSection;
      const textureParams = new RenderTexture.Params(undefined, textureType);
      const offset = bufferView.byteOffset;

      /* -----------------------------------
          const jpegArray = this._binaryData.slice(offset, offset + bufferView.byteLength);
          const jpegArrayBuffer = jpegArray.buffer;
          const workerOp = new ImageDecodeWorkerOperation(jpegArrayBuffer, mimeType);
          try {
            const imageBitmap = await GltfReader.webWorkerManager.queueOperation(workerOp)
            return this._isCanceled ? undefined : this._system.createTextureFromImage(imageBitmap, isTransparent && ImageSourceFormat.Png === format, this._iModel, textureParams))
          } catch (_) {
            return undefined;
          }
        ------------------------------------- */

      const bytes = this._binaryData.subarray(offset, offset + bufferView.byteLength);
      const imageSource = new ImageSource(bytes, format);
      try {
        const image = await imageElementFromImageSource(imageSource);
        return this._isCanceled ? undefined : this._system.createTextureFromImage(image, isTransparent && ImageSourceFormat.Png === format, this._iModel, textureParams);
      } catch (_) {
        return undefined;
      }
    } catch (e) {
      return undefined;
    }
  }

  protected async loadTexture(textureId: string, isTransparent: boolean): Promise<void> {
    const textureJson = JsonUtils.asObject(this._textures[textureId]);
    if (undefined === textureJson)
      return;

    const texture = await this.loadTextureImage(this._images[textureJson.source], undefined === this._samplers ? undefined : this._samplers[textureJson.sampler], isTransparent);
    textureJson.renderTexture = texture;
  }

  protected findTextureMapping(textureId: string): TextureMapping | undefined {
    const textureJson = JsonUtils.asObject(this._textures[textureId]);
    const texture = undefined !== textureJson ? textureJson.renderTexture as RenderTexture : undefined;
    return undefined !== texture ? new TextureMapping(texture, new TextureMapping.Params()) : undefined;
  }
}
