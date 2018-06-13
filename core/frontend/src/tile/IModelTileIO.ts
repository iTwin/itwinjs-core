/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { MeshList, MeshGraphicArgs } from "../render/primitives/mesh/MeshPrimitives";
import { ColorMap } from "../render/primitives/ColorMap";
import { Feature, FeatureTable, ElementAlignedBox3d, GeometryClass, FillFlags, ColorDef, LinePixels, TextureMapping, ImageSource, RenderTexture } from "@bentley/imodeljs-common";
import { JsonUtils } from "@bentley/bentleyjs-core";
import { RenderGraphic } from "../render/System";
import { RenderSystem } from "../render/System";
import { GeometricModelState } from "../ModelState";

/** Provides facilities for deserializing iModel tiles. iModel tiles contain element geometry. */
export namespace IModelTileIO {
  export const enum Flags {
    None = 0,
    ContainsCurves = 1 << 0,
    Incomplete = 1 << 1,
    IsLeaf = 1 << 2,
  }

  export class Header extends TileIO.Header {
    public readonly flags: Flags;
    public readonly contentRange: ElementAlignedBox3d;
    public readonly length: number;

    public constructor(stream: TileIO.StreamBuffer) {
      super(stream);
      this.flags = stream.nextUint32;
      this.contentRange = ElementAlignedBox3d.createFromPoints(stream.nextPoint3d64, stream.nextPoint3d64);
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

    private constructor(public readonly length: number,
      public readonly maxFeatures: number,
      public readonly count: number) { }
  }

  /** The result of Reader.read(). */
  export interface Result {
    readStatus: TileIO.ReadStatus;
    isLeaf: boolean;
    contentRange?: ElementAlignedBox3d;
    geometry?: TileIO.GeometryCollection;
    renderGraphic?: RenderGraphic;
  }

  /** Deserializes an iModel tile. */
  export class Reader extends GltfTileIO.Reader {
    public static create(stream: TileIO.StreamBuffer, model: GeometricModelState, system: RenderSystem): Reader | undefined {
      const header = new Header(stream);
      if (!header.isValid)
        return undefined;

      // The feature table follows the dgnT header
      if (!this.skipFeatureTable(stream))
        return undefined;

      // A glTF header follows the feature table
      const props = GltfTileIO.ReaderProps.create(stream);
      return undefined !== props ? new Reader(props, model, system) : undefined;
    }

    private static skipFeatureTable(stream: TileIO.StreamBuffer): boolean {
      const startPos = stream.curPos;
      const header = FeatureTableHeader.readFrom(stream);
      if (undefined !== header)
        stream.curPos = startPos + header.length;

      return undefined !== header;
    }

    public read(): Result {
      // ###TODO don't re-read the headers...
      this.buffer.reset();
      const header = new Header(this.buffer);
      let isLeaf = true;
      if (!header.isValid)
        return { readStatus: TileIO.ReadStatus.InvalidHeader, isLeaf };

      isLeaf = Flags.None !== (header.flags & Flags.IsLeaf);
      const featureTable = this.readFeatureTable();
      if (undefined === featureTable)
        return { readStatus: TileIO.ReadStatus.InvalidFeatureTable, isLeaf };

      const isComplete = Flags.None === (header.flags & Flags.Incomplete);
      const isCurved = Flags.None !== (header.flags & Flags.ContainsCurves);
      const geometry = new TileIO.GeometryCollection(new MeshList(featureTable), isComplete, isCurved);
      const readStatus = this.readGltf(geometry);
      let renderGraphic: RenderGraphic | undefined;
      if (!geometry.isEmpty) {
        const meshGraphicArgs = new MeshGraphicArgs();
        if (1 === geometry.meshes.length) {
          renderGraphic = geometry.meshes[0].getGraphics(meshGraphicArgs, this.system, this.model.iModel);
        } else {
          const renderGraphicList: RenderGraphic[] = [];
          for (const mesh of geometry.meshes) {
            renderGraphic = mesh.getGraphics(meshGraphicArgs, this.system, this.model.iModel);
            if (undefined !== renderGraphic)
              renderGraphicList.push(renderGraphic);
          }
          renderGraphic = this.system.createGraphicList(renderGraphicList, this.model.iModel);
        }
        if (undefined !== renderGraphic)
          renderGraphic = this.system.createBatch(renderGraphic, featureTable);
      }
      return {
        readStatus,
        isLeaf,
        contentRange: header.contentRange,
        geometry,
        renderGraphic,
      };
    }

    private constructor(props: GltfTileIO.ReaderProps, model: GeometricModelState, system: RenderSystem) {
      super(props, model, system);
    }

    protected readFeatureTable(): FeatureTable | undefined {
      const startPos = this.buffer.curPos;
      const header = FeatureTableHeader.readFrom(this.buffer);
      if (undefined === header)
        return undefined;

      const featureTable = new FeatureTable(header.maxFeatures, this.modelId);
      for (let i = 0; i < header.count; i++) {
        const elementId = this.buffer.nextId64;
        const subCategoryId = this.buffer.nextId64;
        const geometryClass = this.buffer.nextUint32 as GeometryClass;
        const index = this.buffer.nextUint32;

        if (this.buffer.isPastTheEnd)
          return undefined;

        featureTable.insertWithIndex(new Feature(elementId, subCategoryId, geometryClass), index);
      }

      this.buffer.curPos = startPos + header.length;
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
      // ###TODO: material from material ID
      // NB: We don't need to deserialize the gradient if present - will have a ready-to-use TextureMapping.
      const type = JsonUtils.asInt(json.type, DisplayParams.Type.Mesh);
      const lineColor = new ColorDef(JsonUtils.asInt(json.lineColor));
      const fillColor = new ColorDef(JsonUtils.asInt(json.fillColor));
      const width = JsonUtils.asInt(json.lineWidth);
      const linePixels = JsonUtils.asInt(json.linePixels, LinePixels.Solid);
      const fillFlags = JsonUtils.asInt(json.fillFlags, FillFlags.None);
      const ignoreLighting = JsonUtils.asBool(json.ignoreLighting);

      const textureJson = json.texture;
      const textureMapping = undefined !== textureJson ? this.textureMappingFromJson(textureJson) : undefined;

      return new DisplayParams(type, lineColor, fillColor, width, linePixels, fillFlags, undefined, undefined, ignoreLighting, textureMapping);
    }

    private textureMappingFromJson(json: any): TextureMapping | undefined {
      const name = JsonUtils.asString(json.name);
      const namedTex = 0 !== name.length ? this.namedTextures[name] : undefined;
      if (undefined === namedTex)
        return undefined;

      // If we've already seen this texture name before, it will be in the RenderSystem's cache.
      const imodel = this.model.iModel;
      let texture = this.system.findTexture(name, imodel);
      if (undefined === texture) {
        // First time encountering this texture name - create it.
        // ###TODO: We are currently not writing the width and height to json!
        const width = JsonUtils.asInt(json.width);
        const height = JsonUtils.asInt(json.height);
        if (0 <= width || 0 <= height)
          return undefined;

        const bufferViewId = JsonUtils.asString(json.bufferView);
        const bufferViewJson = 0 !== bufferViewId.length ? this.bufferViews[bufferViewId] : undefined;
        if (undefined === bufferViewJson)
          return undefined;

        const byteOffset = JsonUtils.asInt(bufferViewJson.byteOffset);
        const byteLength = JsonUtils.asInt(bufferViewJson.byteLength);
        if (0 === byteLength)
          return undefined;

        const bytes = this.binaryData.subarray(byteOffset, byteOffset + byteLength);
        const format = json.format;
        const imageSource = new ImageSource(bytes, format);

        const params = new RenderTexture.Params(name, JsonUtils.asBool(json.isTileSection), JsonUtils.asBool(json.isGlyph), false);
        texture = this.system.createTextureFromImageSrc(imageSource, width, height, imodel, params);

        if (undefined === texture)
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
  }
}
