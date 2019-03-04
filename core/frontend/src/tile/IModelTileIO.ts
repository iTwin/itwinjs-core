/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { DisplayParams } from "../render/primitives/DisplayParams";
import {
  VertexTable,
  VertexIndices,
  PointStringParams,
  TesselatedPolyline,
  PolylineParams,
  SurfaceParams,
  SurfaceType,
  isValidSurfaceType,
  MeshParams,
  SegmentEdgeParams,
  SilhouetteParams,
  EdgeParams,
} from "../render/primitives/VertexTable";
import {
  AuxChannelTable,
  AuxChannelTableProps,
} from "../render/primitives/AuxChannelTable";
import { Id64String, JsonUtils, assert } from "@bentley/bentleyjs-core";
import { InstancedGraphicParams, RenderSystem, RenderGraphic, PackedFeatureTable, GraphicBranch } from "../render/System";
import { imageElementFromImageSource } from "../ImageUtil";
import {
  ElementAlignedBox3d,
  FillFlags,
  ColorDef,
  LinePixels,
  TextureMapping,
  ImageSource,
  ImageSourceFormat,
  RenderTexture,
  RenderMaterial,
  Gradient,
  QParams2d,
  QParams3d,
  PolylineTypeFlags,
  BatchType,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { Range2d, Point3d, Range3d, Transform } from "@bentley/geometry-core";

/** Provides facilities for deserializing tiles in 'imodel' format. These tiles contain element geometry encoded into a format optimized for the imodeljs webgl renderer.
 * @hidden
 */
export namespace IModelTileIO {
  /** Flags describing the geometry contained within a tile.
   * @hidden
   */
  export const enum Flags {
    /** No special flags */
    None = 0,
    /** The tile contains some curved geometry */
    ContainsCurves = 1 << 0,
    /** Some geometry within the tile range was omitted based on its size */
    Incomplete = 1 << 2,
  }

  /** Describes the maximum major and minor version of the tile format supported by this front-end package. */
  export const enum CurrentVersion {
    /** The unsigned 16-bit major version number. If the major version specified in the tile header is greater than this value, then this
     * front-end is not capable of reading the tile content. Otherwise, this front-end can read the tile content even if the header specifies a
     * greater minor version than CurrentVersion.Minor, although some data may be skipped.
     */
    Major = 2,
    /** The unsigned 16-bit minor version number. If the major version in the tile header is equal to CurrentVersion.Major, then this front-end can
     * read the tile content even if the minor version in the tile header is greater than this value, although some data may be skipped.
     */
    Minor = 0,
    /** The unsigned 32-bit version number derived from the 16-bit major and minor version numbers. */
    Combined = (Major << 0x10) | Minor,
  }

  /** Header embedded at the beginning of the binary tile data describing its contents.
   * @hidden
   */
  export class Header extends TileIO.Header {
    /** The size of this header in bytes. */
    public readonly headerLength: number;
    /** Flags describing the geometry contained within the tile */
    public readonly flags: Flags;
    /** A bounding box no larger than the tile's range, tightly enclosing the tile's geometry; or a null range if the tile is emtpy */
    public readonly contentRange: ElementAlignedBox3d;
    /** The chord tolerance in meters at which the tile's geometry was faceted */
    public readonly tolerance: number;
    /** The number of elements which contributed at least some geometry to the tile content */
    public readonly numElementsIncluded: number;
    /** The number of elements within the tile range which contributed no geometry to the tile content */
    public readonly numElementsExcluded: number;
    /** The total number of bytes in the binary tile data, including this header */
    public readonly tileLength: number;
    /** A bitfield wherein each set bit indicates an empty sub-volume. */
    public readonly emptySubRanges: number;

    public get versionMajor(): number { return this.version >>> 0x10; }
    public get versionMinor(): number { return (this.version & 0xffff) >>> 0; }

    public get isValid(): boolean { return TileIO.Format.IModel === this.format; }
    public get isReadableVersion(): boolean { return this.versionMajor <= IModelTileIO.CurrentVersion.Major; }

    /** Deserialize a header from the binary data at the stream's current position.
     * If the binary data does not contain a valid header, the Header will be marked 'invalid'.
     */
    public constructor(stream: TileIO.StreamBuffer) {
      super(stream);
      this.headerLength = stream.nextUint32;
      this.flags = stream.nextUint32;

      // NB: Cannot use any of the static create*() functions because they all want to compute a range to contain the supplied points.
      // (If contentRange is null, this will produce maximum range).
      this.contentRange = new Range3d();
      this.contentRange.low = stream.nextPoint3d64;
      this.contentRange.high = stream.nextPoint3d64;

      this.tolerance = stream.nextFloat64;
      this.numElementsIncluded = stream.nextUint32;
      this.numElementsExcluded = stream.nextUint32;
      this.tileLength = stream.nextUint32;

      // empty sub-volume bit field introduced in format v02.00
      this.emptySubRanges = this.versionMajor >= 2 ? stream.nextUint32 : 0;

      // Skip any unprocessed bytes in header
      const remainingHeaderBytes = this.headerLength - stream.curPos;
      assert(remainingHeaderBytes >= 0);
      stream.advance(remainingHeaderBytes);

      if (stream.isPastTheEnd)
        this.invalidate();
    }
  }

  /** @hidden */
  class FeatureTableHeader {
    public static readFrom(stream: TileIO.StreamBuffer) {
      const length = stream.nextUint32;
      const maxFeatures = stream.nextUint32;
      const count = stream.nextUint32;
      return stream.isPastTheEnd ? undefined : new FeatureTableHeader(length, maxFeatures, count);
    }

    public static sizeInBytes = 12;

    private constructor(public readonly length: number,
      public readonly maxFeatures: number,
      public readonly count: number) { }
  }

  const maxLeafTolerance = 1.0;
  const minElementsPerTile = 100;

  /** Deserializes an iModel tile.
   * @hidden
   */
  export class Reader extends GltfTileIO.Reader {
    private readonly _sizeMultiplier?: number;
    private readonly _loadEdges: boolean;

    /** Attempt to initialize a Reader to deserialize iModel tile data beginning at the stream's current position. */
    public static create(stream: TileIO.StreamBuffer, iModel: IModelConnection, modelId: Id64String, is3d: boolean, system: RenderSystem, type: BatchType = BatchType.Primary, loadEdges: boolean = true, isCanceled?: GltfTileIO.IsCanceled, sizeMultiplier?: number): Reader | undefined {
      const header = new Header(stream);
      if (!header.isValid || !header.isReadableVersion)
        return undefined;

      // The feature table follows the iMdl header
      if (!this.skipFeatureTable(stream))
        return undefined;

      // A glTF header follows the feature table
      const props = GltfTileIO.ReaderProps.create(stream, false);
      return undefined !== props ? new Reader(props, iModel, modelId, is3d, system, type, loadEdges, isCanceled, sizeMultiplier) : undefined;
    }

    /** Attempt to deserialize the tile data */
    public async read(): Promise<GltfTileIO.ReaderResult> {
      this._buffer.reset();
      const header = new Header(this._buffer);
      let isLeaf = true;
      if (!header.isValid)
        return { readStatus: TileIO.ReadStatus.InvalidHeader, isLeaf };
      else if (!header.isReadableVersion)
        return { readStatus: TileIO.ReadStatus.NewerMajorVersion, isLeaf };

      const featureTable = this.readFeatureTable();
      if (undefined === featureTable)
        return { readStatus: TileIO.ReadStatus.InvalidFeatureTable, isLeaf };

      // Textures must be loaded asynchronously first...
      await this.loadNamedTextures();
      if (this._isCanceled)
        return Promise.resolve({ readStatus: TileIO.ReadStatus.Canceled, isLeaf });

      // Determine subdivision based on header data
      isLeaf = false;
      let sizeMultiplier = this._sizeMultiplier;
      const completeTile = 0 === (header.flags & IModelTileIO.Flags.Incomplete);
      const emptyTile = completeTile && 0 === header.numElementsIncluded && 0 === header.numElementsExcluded;
      if (emptyTile || this._isClassifier) {    // Classifier algorithm currently supports only a single tile.
        isLeaf = true;
      } else {
        // Non-spatial (2d) models are of arbitrary scale and contain geometry like line work and especially text which
        // can be adversely affected by quantization issues when zooming in closely.
        const canSkipSubdivision = this._is3d && header.tolerance <= maxLeafTolerance;
        if (canSkipSubdivision) {
          if (completeTile && 0 === header.numElementsExcluded && header.numElementsIncluded <= minElementsPerTile) {
            const containsCurves = 0 !== (header.flags & IModelTileIO.Flags.ContainsCurves);
            if (!containsCurves)
              isLeaf = true;
            else if (undefined === sizeMultiplier)
              sizeMultiplier = 1.0;
          } else if (undefined === sizeMultiplier && header.numElementsIncluded + header.numElementsExcluded <= minElementsPerTile) {
            sizeMultiplier = 1.0;
          }
        }
      }

      return Promise.resolve(this.finishRead(isLeaf, featureTable, header.contentRange, header.emptySubRanges, sizeMultiplier));
    }

    /** @hidden */
    protected extractReturnToCenter(_extensions: any): number[] | undefined { return undefined; }

    /** @hidden */
    protected createDisplayParams(json: any): DisplayParams | undefined {
      const type = JsonUtils.asInt(json.type, DisplayParams.Type.Mesh);
      const lineColor = new ColorDef(JsonUtils.asInt(json.lineColor));
      const fillColor = new ColorDef(JsonUtils.asInt(json.fillColor));
      const width = JsonUtils.asInt(json.lineWidth);
      const linePixels = JsonUtils.asInt(json.linePixels, LinePixels.Solid);
      const fillFlags = JsonUtils.asInt(json.fillFlags, FillFlags.None);
      const ignoreLighting = JsonUtils.asBool(json.ignoreLighting);

      // Material will always contain its own texture if it has one
      const materialKey = json.materialId;
      const material = undefined !== materialKey ? this.materialFromJson(materialKey) : undefined;

      // We will only attempt to include the texture if material is undefined
      let textureMapping;
      if (!material) {
        const textureJson = json.texture;
        textureMapping = undefined !== textureJson ? this.textureMappingFromJson(textureJson) : undefined;

        if (undefined === textureMapping) {
          // Look for a gradient. If defined, create a texture mapping. No reason to pass the Gradient.Symb to the DisplayParams once we have the texture.
          const gradientProps = json.gradient as Gradient.SymbProps;
          const gradient = undefined !== gradientProps ? Gradient.Symb.fromJSON(gradientProps) : undefined;
          if (undefined !== gradient) {
            const texture = this._system.getGradientTexture(gradient, this._iModel);
            if (undefined !== texture) {
              // ###TODO: would be better if DisplayParams created the TextureMapping - but that requires an IModelConnection and a RenderSystem...
              textureMapping = new TextureMapping(texture, new TextureMapping.Params({ textureMat2x3: new TextureMapping.Trans2x3(0, 1, 0, 1, 0, 0) }));
            }
          }
        }
      }

      return new DisplayParams(type, lineColor, fillColor, width, linePixels, fillFlags, material, undefined, ignoreLighting, textureMapping);
    }

    /** @hidden */
    protected colorDefFromMaterialJson(json: any): ColorDef | undefined {
      return undefined !== json ? ColorDef.from(json[0] * 255 + 0.5, json[1] * 255 + 0.5, json[2] * 255 + 0.5) : undefined;
    }

    /** @hidden */
    protected materialFromJson(key: string): RenderMaterial | undefined {
      if (this._renderMaterials === undefined || this._renderMaterials[key] === undefined)
        return undefined;

      let material = this._system.findMaterial(key, this._iModel);
      if (!material) {
        const materialJson = this._renderMaterials[key];

        const materialParams = new RenderMaterial.Params(key);
        materialParams.diffuseColor = this.colorDefFromMaterialJson(materialJson.diffuseColor);
        if (materialJson.diffuse !== undefined)
          materialParams.diffuse = JsonUtils.asDouble(materialJson.diffuse);
        materialParams.specularColor = this.colorDefFromMaterialJson(materialJson.specularColor);
        if (materialJson.specular !== undefined)
          materialParams.specular = JsonUtils.asDouble(materialJson.specular);
        materialParams.reflectColor = this.colorDefFromMaterialJson(materialJson.reflectColor);
        if (materialJson.reflect !== undefined)
          materialParams.reflect = JsonUtils.asDouble(materialJson.reflect);

        if (materialJson.specularExponent !== undefined)
          materialParams.specularExponent = materialJson.specularExponent;
        if (materialJson.transparency !== undefined)
          materialParams.transparency = materialJson.transparency;
        materialParams.refract = JsonUtils.asDouble(materialJson.refract);
        materialParams.shadows = JsonUtils.asBool(materialJson.shadows);
        materialParams.ambient = JsonUtils.asDouble(materialJson.ambient);

        if (undefined !== materialJson.textureMapping)
          materialParams.textureMapping = this.textureMappingFromJson(materialJson.textureMapping.texture);

        material = this._system.createMaterial(materialParams, this._iModel);
      }

      return material;
    }

    private textureMappingFromJson(json: any): TextureMapping | undefined {
      if (undefined === json)
        return undefined;

      const name = JsonUtils.asString(json.name);
      const namedTex = 0 !== name.length ? this._namedTextures[name] : undefined;
      const texture = undefined !== namedTex ? namedTex.renderTexture as RenderTexture : undefined;
      if (undefined === texture) {
        assert(false, "bad texture mapping json");
        return undefined;
      }

      const paramsJson = json.params;
      const tf = paramsJson.transform;
      const paramProps: TextureMapping.ParamProps = {
        textureMat2x3: new TextureMapping.Trans2x3(tf[0][0], tf[0][1], tf[0][2], tf[1][0], tf[1][1], tf[1][2]),
        textureWeight: JsonUtils.asDouble(paramsJson.weight, 1.0),
        mapMode: JsonUtils.asInt(paramsJson.mode),
        worldMapping: JsonUtils.asBool(paramsJson.worldMapping),
      };

      return new TextureMapping(texture, new TextureMapping.Params(paramProps));
    }

    private async loadNamedTextures(): Promise<void> {
      if (undefined === this._namedTextures)
        return Promise.resolve();

      const promises = new Array<Promise<void>>();
      for (const name of Object.keys(this._namedTextures))
        promises.push(this.loadNamedTexture(name));

      return promises.length > 0 ? Promise.all(promises).then((_) => undefined) : Promise.resolve();
    }

    private async loadNamedTexture(name: string): Promise<void> {
      if (this._isCanceled)
        return Promise.resolve();

      const namedTex = this._namedTextures[name];
      assert(undefined !== namedTex); // we got here by iterating the keys of this.namedTextures...
      if (undefined === namedTex)
        return Promise.resolve();

      const texture = this._system.findTexture(name, this._iModel);
      if (undefined !== texture) {
        namedTex.renderTexture = texture;
        return Promise.resolve();
      }

      return this.readNamedTexture(namedTex, name).then((result) => { namedTex.renderTexture = result; });
    }

    private async readNamedTexture(namedTex: any, name: string): Promise<RenderTexture | undefined> {
      const bufferViewId = JsonUtils.asString(namedTex.bufferView);
      const bufferViewJson = 0 !== bufferViewId.length ? this._bufferViews[bufferViewId] : undefined;
      if (undefined === bufferViewJson)
        return Promise.resolve(undefined);

      const byteOffset = JsonUtils.asInt(bufferViewJson.byteOffset);
      const byteLength = JsonUtils.asInt(bufferViewJson.byteLength);
      if (0 === byteLength)
        return Promise.resolve(undefined);

      const bytes = this._binaryData.subarray(byteOffset, byteOffset + byteLength);
      const format = namedTex.format;
      const imageSource = new ImageSource(bytes, format);

      return imageElementFromImageSource(imageSource).then((image) => {
        if (this._isCanceled)
          return undefined;

        let textureType = RenderTexture.Type.Normal;
        if (JsonUtils.asBool(namedTex.isGlyph))
          textureType = RenderTexture.Type.Glyph;
        else if (JsonUtils.asBool(namedTex.isTileSection))
          textureType = RenderTexture.Type.TileSection;

        const params = new RenderTexture.Params(namedTex.isGlyph ? undefined : name, textureType);
        return this._system.createTextureFromImage(image, ImageSourceFormat.Png === format, this._iModel, params);
      });
    }

    /** @hidden */
    protected readFeatureTable(): PackedFeatureTable | undefined {
      const startPos = this._buffer.curPos;
      const header = FeatureTableHeader.readFrom(this._buffer);
      if (undefined === header || 0 !== header.length % 4)
        return undefined;

      // NB: We make a copy of the sub-array because we don't want to pin the entire data array in memory.
      const numUint32s = (header.length - FeatureTableHeader.sizeInBytes) / 4;
      const packedFeatureArray = new Uint32Array(this._buffer.nextUint32s(numUint32s));
      if (this._buffer.isPastTheEnd)
        return undefined;

      let animNodesArray: Uint8Array | Uint16Array | Uint32Array | undefined;
      const animationNodes = JsonUtils.asObject(this._scene.animationNodes);
      if (undefined !== animationNodes) {
        const bytesPerId = JsonUtils.asInt(animationNodes.bytesPerId);
        const bufferViewId = JsonUtils.asString(animationNodes.bufferView);
        const bufferViewJson = this._bufferViews[bufferViewId];
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

      this._buffer.curPos = startPos + header.length;

      return new PackedFeatureTable(packedFeatureArray, this._modelId, header.count, header.maxFeatures, this._type, animNodesArray);
    }

    private constructor(props: GltfTileIO.ReaderProps, iModel: IModelConnection, modelId: Id64String, is3d: boolean, system: RenderSystem, type: BatchType, loadEdges: boolean, isCanceled?: GltfTileIO.IsCanceled, sizeMultiplier?: number) {
      super(props, iModel, modelId, is3d, system, type, isCanceled);
      this._sizeMultiplier = sizeMultiplier;
      this._loadEdges = loadEdges;
    }

    private static skipFeatureTable(stream: TileIO.StreamBuffer): boolean {
      const startPos = stream.curPos;
      const header = FeatureTableHeader.readFrom(stream);
      if (undefined !== header)
        stream.curPos = startPos + header.length;

      return undefined !== header;
    }

    private readMeshGraphic(primitive: any): RenderGraphic | undefined {
      const materialName = JsonUtils.asString(primitive.material);
      const materialValue = 0 < materialName.length ? JsonUtils.asObject(this._materialValues[materialName]) : undefined;
      const displayParams = undefined !== materialValue ? this.createDisplayParams(materialValue) : undefined;
      if (undefined === displayParams)
        return undefined;

      const vertices = this.readVertexTable(primitive);
      if (undefined === vertices) {
        assert(false, "bad vertex table in tile data.");
        return undefined;
      }

      const isPlanar = JsonUtils.asBool(primitive.isPlanar);
      const primitiveType = JsonUtils.asInt(primitive.type, Mesh.PrimitiveType.Mesh);
      const instances = this.readInstances(primitive);
      switch (primitiveType) {
        case Mesh.PrimitiveType.Mesh:
          return this.createMeshGraphic(primitive, displayParams, vertices, isPlanar, this.readAuxChannelTable(primitive), instances);
        case Mesh.PrimitiveType.Polyline:
          return this.createPolylineGraphic(primitive, displayParams, vertices, isPlanar, instances);
        case Mesh.PrimitiveType.Point:
          return this.createPointStringGraphic(primitive, displayParams, vertices, instances);
      }

      assert(false, "unhandled primitive type");
      return undefined;
    }

    private findBuffer(bufferViewId: string): Uint8Array | undefined {
      if (typeof bufferViewId !== "string" || 0 === bufferViewId.length)
        return undefined;

      const bufferViewJson = this._bufferViews[bufferViewId];
      if (undefined === bufferViewJson)
        return undefined;

      const byteOffset = JsonUtils.asInt(bufferViewJson.byteOffset);
      const byteLength = JsonUtils.asInt(bufferViewJson.byteLength);
      if (0 === byteLength)
        return undefined;

      return this._binaryData.subarray(byteOffset, byteOffset + byteLength);
    }

    private readVertexTable(primitive: any): VertexTable | undefined {
      const json = primitive.vertices;
      if (undefined === json)
        return undefined;

      const bytes = this.findBuffer(JsonUtils.asString(json.bufferView));
      if (undefined === bytes)
        return undefined;

      const uniformFeatureID = undefined !== json.featureID ? JsonUtils.asInt(json.featureID) : undefined;

      const rangeMin = JsonUtils.asArray(json.params.decodedMin);
      const rangeMax = JsonUtils.asArray(json.params.decodedMax);
      if (undefined === rangeMin || undefined === rangeMax)
        return undefined;

      const qparams = QParams3d.fromRange(Range3d.create(Point3d.create(rangeMin[0], rangeMin[1], rangeMin[2]), Point3d.create(rangeMax[0], rangeMax[1], rangeMax[2])));

      const uniformColor = undefined !== json.uniformColor ? ColorDef.fromJSON(json.uniformColor) : undefined;
      let uvParams: QParams2d | undefined;
      if (undefined !== primitive.surface && undefined !== primitive.surface.uvParams) {
        const uvMin = JsonUtils.asArray(primitive.surface.uvParams.decodedMin);
        const uvMax = JsonUtils.asArray(primitive.surface.uvParams.decodedMax);
        if (undefined === uvMin || undefined === uvMax)
          return undefined;

        const uvRange = new Range2d(uvMin[0], uvMin[1], uvMax[0], uvMax[1]);
        uvParams = QParams2d.fromRange(uvRange);
      }

      return new VertexTable({
        data: bytes,
        qparams,
        width: json.width,
        height: json.height,
        hasTranslucency: json.hasTranslucency,
        uniformColor,
        featureIndexType: json.featureIndexType,
        uniformFeatureID,
        numVertices: json.count,
        numRgbaPerVertex: json.numRgbaPerVertex,
        uvParams,
      });
    }

    private readAuxChannelTable(primitive: any): AuxChannelTable | undefined {
      const json = primitive.auxChannels;
      if (undefined === json)
        return undefined;

      const bytes = this.findBuffer(JsonUtils.asString(json.bufferView));
      if (undefined === bytes)
        return undefined;

      const props: AuxChannelTableProps = {
        data: bytes,
        width: json.width,
        height: json.height,
        count: json.count,
        numBytesPerVertex: json.numBytesPerVertex,
        displacements: json.displacements,
        normals: json.normals,
        params: json.params,
      };

      return AuxChannelTable.fromJSON(props);
    }

    // ###TODO_INSTANCING: Remove me once feature complete...
    private static _forceInstancing = false;
    private static _fakeInstanceParams = {
      transforms: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]),
      featureIds: new Uint8Array([0, 0, 0]),
      count: 1,
    };
    private readInstances(primitive: any): InstancedGraphicParams | undefined {
      if (Reader._forceInstancing)
        return Reader._fakeInstanceParams;

      const json = primitive.instances;
      if (undefined === json)
        return undefined;

      const count = JsonUtils.asInt(json.count, 0);
      if (count <= 0)
        return undefined;

      const featureIds = this.findBuffer(JsonUtils.asString(json.featureIds));
      if (undefined === featureIds)
        return undefined;

      const transformBytes = this.findBuffer(JsonUtils.asString(json.transforms));
      if (undefined === transformBytes)
        return undefined;

      // 1 transform = 3 rows of 4 floats = 12 floats per instance
      const numFloats = transformBytes.byteLength / 4;
      assert(Math.floor(numFloats) === numFloats);
      assert(0 === numFloats % 12);

      const transforms = new Float32Array(transformBytes.buffer, transformBytes.byteOffset, numFloats);

      let symbologyOverrides: Uint8Array | undefined;
      if (undefined !== json.symbologyOverrides)
        symbologyOverrides = this.findBuffer(JsonUtils.asString(json.symbologyOverrides));

      return { count, transforms, featureIds, symbologyOverrides };
    }

    private readVertexIndices(json: any): VertexIndices | undefined {
      const bytes = this.findBuffer(json as string);
      return undefined !== bytes ? new VertexIndices(bytes) : undefined;
    }

    private createPointStringGraphic(primitive: any, displayParams: DisplayParams, vertices: VertexTable, instances: InstancedGraphicParams | undefined): RenderGraphic | undefined {
      const indices = this.readVertexIndices(primitive.indices);
      if (undefined === indices)
        return undefined;

      const params = new PointStringParams(vertices, indices, displayParams.width);
      return this._system.createPointString(params, instances);
    }

    private readTesselatedPolyline(json: any): TesselatedPolyline | undefined {
      const indices = this.readVertexIndices(json.indices);
      const prevIndices = this.readVertexIndices(json.prevIndices);
      const nextIndicesAndParams = this.findBuffer(json.nextIndicesAndParams);

      if (undefined === indices || undefined === prevIndices || undefined === nextIndicesAndParams)
        return undefined;

      return {
        indices,
        prevIndices,
        nextIndicesAndParams,
      };
    }

    private createPolylineGraphic(primitive: any, displayParams: DisplayParams, vertices: VertexTable, isPlanar: boolean, instances: InstancedGraphicParams | undefined): RenderGraphic | undefined {
      const polyline = this.readTesselatedPolyline(primitive);
      if (undefined === polyline)
        return undefined;

      let flags = PolylineTypeFlags.Normal;
      if (DisplayParams.RegionEdgeType.Outline === displayParams.regionEdgeType)
        flags = (undefined === displayParams.gradient || displayParams.gradient.isOutlined) ? PolylineTypeFlags.Edge : PolylineTypeFlags.Outline;

      const params = new PolylineParams(vertices, polyline, displayParams.width, displayParams.linePixels, isPlanar, flags);
      return this._system.createPolyline(params, instances);
    }

    private readSurface(mesh: any, displayParams: DisplayParams): SurfaceParams | undefined {
      const surf = mesh.surface;
      if (undefined === surf)
        return undefined;

      const indices = this.readVertexIndices(surf.indices);
      if (undefined === indices)
        return undefined;

      const type = JsonUtils.asInt(surf.type, -1);
      if (!isValidSurfaceType(type))
        return undefined;

      const texture = undefined !== displayParams.textureMapping ? displayParams.textureMapping.texture : undefined;

      return {
        type,
        indices,
        fillFlags: displayParams.fillFlags,
        hasBakedLighting: false,
        material: displayParams.material,
        texture,
      };
    }

    private readSegmentEdges(json: any): SegmentEdgeParams | undefined {
      const indices = this.readVertexIndices(json.indices);
      const endPointAndQuadIndices = this.findBuffer(json.endPointAndQuadIndices);
      return undefined !== indices && undefined !== endPointAndQuadIndices ? { indices, endPointAndQuadIndices } : undefined;
    }

    private readSilhouettes(json: any): SilhouetteParams | undefined {
      const segments = this.readSegmentEdges(json);
      const normalPairs = this.findBuffer(json.normalPairs);
      return undefined !== segments && undefined !== normalPairs ? { normalPairs, indices: segments.indices, endPointAndQuadIndices: segments.endPointAndQuadIndices } : undefined;
    }

    private readEdges(json: any, displayParams: DisplayParams): { succeeded: boolean, params?: EdgeParams } {
      let segments: SegmentEdgeParams | undefined;
      let silhouettes: SilhouetteParams | undefined;
      let polylines: TesselatedPolyline | undefined;

      let succeeded = false;
      if (undefined !== json.segments && undefined === (segments = this.readSegmentEdges(json.segments)))
        return { succeeded };

      if (undefined !== json.silhouettes && undefined === (silhouettes = this.readSilhouettes(json.silhouettes)))
        return { succeeded };

      if (undefined !== json.polylines && undefined === (polylines = this.readTesselatedPolyline(json.polylines)))
        return { succeeded };

      succeeded = true;
      let params: EdgeParams | undefined;
      if (undefined !== segments || undefined !== silhouettes || undefined !== polylines) {
        params = {
          segments,
          silhouettes,
          polylines,
          weight: displayParams.width,
          linePixels: displayParams.linePixels,
        };
      }

      return { succeeded, params };
    }

    private createMeshGraphic(primitive: any, displayParams: DisplayParams, vertices: VertexTable, isPlanar: boolean, auxChannels: AuxChannelTable | undefined, instances: InstancedGraphicParams | undefined): RenderGraphic | undefined {
      const surface = this.readSurface(primitive, displayParams);
      if (undefined === surface)
        return undefined;

      // ###TODO: Tile generator shouldn't bother producing edges for classification meshes in the first place...
      let edgeParams: EdgeParams | undefined;
      if (this._loadEdges && undefined !== primitive.edges && SurfaceType.Classifier !== surface.type) {
        const edgeResult = this.readEdges(primitive.edges, displayParams);
        if (!edgeResult.succeeded)
          return undefined;
        else
          edgeParams = edgeResult.params;
      }

      const params = new MeshParams(vertices, surface, edgeParams, isPlanar, auxChannels);
      return this._system.createMesh(params, instances);
    }

    private finishRead(isLeaf: boolean, featureTable: PackedFeatureTable, contentRange: ElementAlignedBox3d, emptySubRangeMask: number, sizeMultiplier?: number): GltfTileIO.ReaderResult {
      const graphics: RenderGraphic[] = [];

      if (undefined === this._nodes.Node_Root) {
        // Unstructured -- prior to animation support....
        for (const meshKey of Object.keys(this._meshes)) {
          const meshValue = this._meshes[meshKey];
          const primitives = JsonUtils.asArray(meshValue.primitives);
          if (undefined === primitives)
            continue;
          for (const primitive of primitives) {
            const graphic = this.readMeshGraphic(primitive);
            if (undefined !== graphic)
              graphics.push(graphic);
          }
        }
      } else {
        for (const nodeKey of Object.keys(this._nodes)) {
          const meshValue = this._meshes[this._nodes[nodeKey]];
          const primitives = JsonUtils.asArray(meshValue.primitives);
          if (undefined === primitives)
            continue;

          if ("Node_Root" === nodeKey) {
            for (const primitive of primitives) {
              const graphic = this.readMeshGraphic(primitive);
              if (undefined !== graphic)
                graphics.push(graphic);
            }
          } else {
            const branch = new GraphicBranch(true);
            branch.animationId = this._modelId + "_" + nodeKey;
            for (const primitive of primitives) {
              const graphic = this.readMeshGraphic(primitive);
              if (undefined !== graphic)
                branch.add(graphic);
            }
            if (!branch.isEmpty)
              graphics.push(this._system.createBranch(branch, Transform.createIdentity()));
          }
        }
      }

      let tileGraphic: RenderGraphic | undefined;
      switch (graphics.length) {
        case 0:
          break;
        case 1:
          tileGraphic = graphics[0];
          break;
        default:
          tileGraphic = this._system.createGraphicList(graphics);
          break;
      }

      if (undefined !== tileGraphic)
        tileGraphic = this._system.createBatch(tileGraphic, featureTable, contentRange);

      return {
        readStatus: TileIO.ReadStatus.Success,
        isLeaf,
        sizeMultiplier,
        contentRange: contentRange.isNull ? undefined : contentRange,
        graphic: tileGraphic,
        emptySubRangeMask,
      };
    }
  }
}
