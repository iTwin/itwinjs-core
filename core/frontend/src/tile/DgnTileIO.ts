/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { ColorMap } from "../render/primitives/ColorMap";
import { Id64, JsonUtils, assert } from "@bentley/bentleyjs-core";
import { RenderSystem } from "../render/System";
import { ImageUtil } from "../ImageUtil";
import {
  Feature,
  FeatureTable,
  ElementAlignedBox3d,
  GeometryClass,
  FillFlags,
  ColorDef,
  LinePixels,
  TextureMapping,
  ImageSource,
  ImageSourceFormat,
  RenderTexture,
  RenderMaterial,
  Gradient,
  BatchType,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";

/**
 * Provides facilities for deserializing tiles in 'dgn' format. Such tiles contain element geometry.
 * @hidden
 */
export namespace DgnTileIO {
  export const enum Flags {
    None = 0,
    ContainsCurves = 1 << 0,
    Incomplete = 1 << 1,
    IsLeaf = 1 << 2,
    HasSizeMultiplier = 1 << 3,
  }

  /** @hidden */
  export class Header extends TileIO.Header {
    public readonly flags: Flags;
    public readonly contentRange: ElementAlignedBox3d;
    public readonly sizeMultiplier: number;
    public readonly length: number;

    public get isValid(): boolean { return TileIO.Format.Dgn === this.format; }

    public constructor(stream: TileIO.StreamBuffer) {
      super(stream);
      this.flags = stream.nextUint32;
      this.contentRange = ElementAlignedBox3d.createFromPoints(stream.nextPoint3d64, stream.nextPoint3d64);
      this.sizeMultiplier = stream.nextFloat64;
      this.length = stream.nextUint32;

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

    private constructor(public readonly length: number,
      public readonly maxFeatures: number,
      public readonly count: number) { }
  }

  /**
   * Deserializes a dgn tile.
   * @hidden
   */
  export class Reader extends GltfTileIO.Reader {
    public static create(stream: TileIO.StreamBuffer, iModel: IModelConnection, modelId: Id64, is3d: boolean, system: RenderSystem, type: BatchType = BatchType.Primary, isCanceled?: GltfTileIO.IsCanceled): Reader | undefined {
      const header = new Header(stream);
      if (!header.isValid)
        return undefined;

      // The feature table follows the dgnT header
      if (!this.skipFeatureTable(stream))
        return undefined;

      // A glTF header follows the feature table
      const props = GltfTileIO.ReaderProps.create(stream);
      return undefined !== props ? new Reader(props, iModel, modelId, is3d, system, type, isCanceled) : undefined;
    }

    protected extractReturnToCenter(_extensions: any): number[] | undefined { return undefined; }  // Original IModel Tile creator set RTC unnecessarily and incorrectly.
    private static skipFeatureTable(stream: TileIO.StreamBuffer): boolean {
      const startPos = stream.curPos;
      const header = FeatureTableHeader.readFrom(stream);
      if (undefined !== header)
        stream.curPos = startPos + header.length;

      return undefined !== header;
    }

    public async read(): Promise<GltfTileIO.ReaderResult> {
      // ###TODO don't re-read the headers...
      this._buffer.reset();
      const header = new Header(this._buffer);
      let isLeaf = true;
      if (!header.isValid)
        return { readStatus: TileIO.ReadStatus.InvalidHeader, isLeaf };

      isLeaf = Flags.None !== (header.flags & Flags.IsLeaf);
      const hasSizeMultiplier = Flags.None !== (header.flags & Flags.HasSizeMultiplier);
      const sizeMultiplier = hasSizeMultiplier ? header.sizeMultiplier : undefined;
      const featureTable = this.readFeatureTable();
      if (undefined === featureTable)
        return { readStatus: TileIO.ReadStatus.InvalidFeatureTable, isLeaf, sizeMultiplier };

      const isComplete = Flags.None === (header.flags & Flags.Incomplete);
      const isCurved = Flags.None !== (header.flags & Flags.ContainsCurves);

      // Textures must be loaded asynchronously first...
      await this.loadNamedTextures();
      if (this._isCanceled)
        return Promise.resolve({ readStatus: TileIO.ReadStatus.Canceled, isLeaf, sizeMultiplier });
      else
        return Promise.resolve(this.readGltfAndCreateGraphics(isLeaf, isCurved, isComplete, featureTable, header.contentRange, sizeMultiplier));
    }

    private constructor(props: GltfTileIO.ReaderProps, iModel: IModelConnection, modelId: Id64, is3d: boolean, system: RenderSystem, type: BatchType = BatchType.Primary, isCanceled?: GltfTileIO.IsCanceled) {
      super(props, iModel, modelId, is3d, system, type, isCanceled);
    }

    protected readFeatureTable(): FeatureTable | undefined {
      const startPos = this._buffer.curPos;
      const header = FeatureTableHeader.readFrom(this._buffer);
      if (undefined === header)
        return undefined;

      const featureTable = new FeatureTable(header.maxFeatures, this._modelId, this._type);
      for (let i = 0; i < header.count; i++) {
        const elementId = this._buffer.nextId64;
        const subCategoryId = this._buffer.nextId64;
        const geometryClass = this._buffer.nextUint32 as GeometryClass;
        const index = this._buffer.nextUint32;

        if (this._buffer.isPastTheEnd)
          return undefined;

        featureTable.insertWithIndex(new Feature(elementId, subCategoryId, geometryClass), index);
      }

      this._buffer.curPos = startPos + header.length;
      return featureTable;
    }

    protected readFeatureIndices(json: any): number[] | undefined {
      const featureId = json.featureID;
      if (undefined !== featureId)
        return [featureId as number];
      else
        return this.readIndices(json, "featureIDs");
    }

    protected readColorTable(colorTable: ColorMap, meshJson: any): boolean {
      const json = JsonUtils.asArray(meshJson.colorTable);
      if (undefined !== json) {
        for (const color of json)
          colorTable.insert(color as number);
      }

      return 0 < colorTable.length;
    }

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
      if (undefined === texture)
        return undefined;

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
      if (undefined !== texture)
        return Promise.resolve();

      return this.readNamedTexture(namedTex).then((result) => { namedTex.renderTexture = result; });
    }
    private async readNamedTexture(namedTex: any): Promise<RenderTexture | undefined> {
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
  }
}
