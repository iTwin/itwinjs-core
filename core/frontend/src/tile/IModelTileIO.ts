/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
  AuxDisplacement,
  AuxNormal,
  AuxParam,
} from "../render/primitives/VertexTable";
import { ColorMap } from "../render/primitives/ColorMap";
import { Id64, JsonUtils, assert } from "@bentley/bentleyjs-core";
import { RenderSystem, RenderGraphic, PackedFeatureTable } from "../render/System";
import { ImageUtil } from "../ImageUtil";
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
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { Range2d, Point3d, Range3d } from "@bentley/geometry-core";

/** Provides facilities for deserializing tiles in 'imodel' format. These tiles contain element geometry encoded into a format optimized for the imodeljs webgl renderer. */
export namespace IModelTileIO {
  export const enum Flags {
    None = 0,
    ContainsCurves = 1 << 0,
    Incomplete = 1 << 2,
  }

  export class Header extends TileIO.Header {
    public readonly flags: Flags;
    public readonly contentRange: ElementAlignedBox3d;
    public readonly tolerance: number;
    public readonly numElementsIncluded: number;
    public readonly numElementsExcluded: number;
    public readonly length: number;

    public get isValid(): boolean { return TileIO.Format.IModel === this.format; }

    public constructor(stream: TileIO.StreamBuffer) {
      super(stream);
      this.flags = stream.nextUint32;
      this.contentRange = ElementAlignedBox3d.createFromPoints(stream.nextPoint3d64, stream.nextPoint3d64);
      this.tolerance = stream.nextFloat64;
      this.numElementsIncluded = stream.nextUint32;
      this.numElementsExcluded = stream.nextUint32;
      this.length = stream.nextUint32;

      if (stream.isPastTheEnd)
        this.invalidate();
    }
  }

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

  /** Deserializes an iModel tile. */
  export class Reader extends GltfTileIO.Reader {
    private readonly _sizeMultiplier?: number;

    public static create(stream: TileIO.StreamBuffer, iModel: IModelConnection, modelId: Id64, is3d: boolean, system: RenderSystem, asClassifier: boolean = false, isCanceled?: GltfTileIO.IsCanceled, sizeMultiplier?: number): Reader | undefined {
      const header = new Header(stream);
      if (!header.isValid)
        return undefined;

      // The feature table follows the iMdl header
      if (!this.skipFeatureTable(stream))
        return undefined;

      // A glTF header follows the feature table
      const props = GltfTileIO.ReaderProps.create(stream, false);
      return undefined !== props ? new Reader(props, iModel, modelId, is3d, system, asClassifier, isCanceled, sizeMultiplier) : undefined;
    }

    public async read(): Promise<GltfTileIO.ReaderResult> {
      this._buffer.reset();
      const header = new Header(this._buffer);
      let isLeaf = true;
      if (!header.isValid)
        return { readStatus: TileIO.ReadStatus.InvalidHeader, isLeaf };

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
      if (emptyTile) {
        isLeaf = true;
      } else {
        const canSkipSubdivision = header.tolerance <= maxLeafTolerance;
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

      return Promise.resolve(this.finishRead(isLeaf, featureTable, header.contentRange, sizeMultiplier));
    }

    protected extractReturnToCenter(_extensions: any): number[] | undefined { return undefined; }
    protected readColorTable(_colorTable: ColorMap, _json: any): boolean | undefined { assert(false); return false; }

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

    protected colorDefFromMaterialJson(json: any): ColorDef | undefined {
      return undefined !== json ? ColorDef.from(json[0] * 255 + 0.5, json[1] * 255 + 0.5, json[2] * 255 + 0.5) : undefined;
    }

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

      return ImageUtil.extractImage(imageSource).then((image) => {
        if (this._isCanceled)
          return undefined;

        let textureType = RenderTexture.Type.Normal;
        if (JsonUtils.asBool(namedTex.isGlyph))
          textureType = RenderTexture.Type.Glyph;
        else if (JsonUtils.asBool(namedTex.isTileSection))
          textureType = RenderTexture.Type.TileSection;

        const params = new RenderTexture.Params(name, textureType);
        return this._system.createTextureFromImage(image, ImageSourceFormat.Png === format, this._iModel, params);
      });
    }

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

      this._buffer.curPos = startPos + header.length;

      return new PackedFeatureTable(packedFeatureArray, this._modelId, header.count, header.maxFeatures);
    }

    private constructor(props: GltfTileIO.ReaderProps, iModel: IModelConnection, modelId: Id64, is3d: boolean, system: RenderSystem, asClassifier: boolean, isCanceled?: GltfTileIO.IsCanceled, sizeMultiplier?: number) {
      super(props, iModel, modelId, is3d, system, asClassifier, isCanceled);
      this._sizeMultiplier = sizeMultiplier;
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
      switch (primitiveType) {
        case Mesh.PrimitiveType.Mesh:
          return this.createMeshGraphic(primitive, displayParams, vertices, isPlanar);
        case Mesh.PrimitiveType.Polyline:
          return this.createPolylineGraphic(primitive, displayParams, vertices, isPlanar);
        case Mesh.PrimitiveType.Point:
          return this.createPointStringGraphic(primitive, displayParams, vertices);
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
      let auxDisplacements: undefined | AuxDisplacement[];
      if (undefined !== json.auxDisplacements) {
        auxDisplacements = [];
        for (const displacementJson of json.auxDisplacements) {
          auxDisplacements.push(new AuxDisplacement({
            index: displacementJson.index,
            name: displacementJson.name,
            qOrigin: displacementJson.qOrigin,
            qScale: displacementJson.qScale,
            inputs: displacementJson.inputs,
          }));
        }
      }
      let auxNormals: undefined | AuxNormal[];
      if (undefined !== json.auxNormals) {
        auxNormals = [];
        for (const normalJson of json.auxNormals) {
          auxNormals.push(new AuxNormal({
            index: normalJson.index,
            name: normalJson.name,
            inputs: normalJson.inputs,
          }));
        }
      }
      let auxParams: undefined | AuxParam[];
      if (undefined !== json.auxParams) {
        auxParams = [];
        for (const paramJson of json.auxParams) {
          auxParams.push(new AuxParam({
            index: paramJson.index,
            name: paramJson.name,
            qOrigin: paramJson.qOrigin,
            qScale: paramJson.qScale,
            inputs: paramJson.inputs,
          }));
        }
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
        auxDisplacements,
        auxNormals,
        auxParams,
      });
    }

    private readVertexIndices(json: any): VertexIndices | undefined {
      const bytes = this.findBuffer(json as string);
      return undefined !== bytes ? new VertexIndices(bytes) : undefined;
    }

    private createPointStringGraphic(primitive: any, displayParams: DisplayParams, vertices: VertexTable): RenderGraphic | undefined {
      const indices = this.readVertexIndices(primitive.indices);
      if (undefined === indices)
        return undefined;

      const params = new PointStringParams(vertices, indices, displayParams.width);
      return this._system.createPointString(params);
    }

    private readTesselatedPolyline(json: any): TesselatedPolyline | undefined {
      const indices = this.readVertexIndices(json.indices);
      const prevIndices = this.readVertexIndices(json.prevIndices);
      const nextIndicesAndParams = this.findBuffer(json.nextIndicesAndParams);
      const distanceBytes = this.findBuffer(json.distances);

      if (undefined === indices || undefined === prevIndices || undefined === nextIndicesAndParams || undefined === distanceBytes)
        return undefined;

      return {
        indices,
        prevIndices,
        nextIndicesAndParams,
        distances: new Float32Array(distanceBytes.buffer),
      };
    }

    private createPolylineGraphic(primitive: any, displayParams: DisplayParams, vertices: VertexTable, isPlanar: boolean): RenderGraphic | undefined {
      const polyline = this.readTesselatedPolyline(primitive);
      if (undefined === polyline)
        return undefined;

      let flags = PolylineTypeFlags.Normal;
      if (DisplayParams.RegionEdgeType.Outline === displayParams.regionEdgeType)
        flags = (undefined === displayParams.gradient || displayParams.gradient.isOutlined) ? PolylineTypeFlags.Edge : PolylineTypeFlags.Outline;

      const params = new PolylineParams(vertices, polyline, displayParams.width, displayParams.linePixels, isPlanar, flags);
      return this._system.createPolyline(params);
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
        hasBakedLighting: this._hasBakedLighting,
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

    private createMeshGraphic(primitive: any, displayParams: DisplayParams, vertices: VertexTable, isPlanar: boolean): RenderGraphic | undefined {
      const surface = this.readSurface(primitive, displayParams);
      if (undefined === surface)
        return undefined;

      // ###TODO: Tile generator shouldn't bother producing edges for classification meshes in the first place...
      let edgeParams: EdgeParams | undefined;
      if (undefined !== primitive.edges && SurfaceType.Classifier !== surface.type) {
        const edgeResult = this.readEdges(primitive.edges, displayParams);
        if (!edgeResult.succeeded)
          return undefined;
        else
          edgeParams = edgeResult.params;
      }

      const params = new MeshParams(vertices, surface, edgeParams, isPlanar);
      return this._system.createMesh(params);
    }

    private finishRead(isLeaf: boolean, featureTable: PackedFeatureTable, contentRange: ElementAlignedBox3d, sizeMultiplier?: number): GltfTileIO.ReaderResult {
      const graphics: RenderGraphic[] = [];

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
        renderGraphic: tileGraphic,
      };
    }
  }
}
