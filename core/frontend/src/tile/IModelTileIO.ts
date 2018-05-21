/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { MeshList } from "../render/primitives/mesh/MeshPrimitives";
import { ColorMap } from "../render/primitives/ColorMap";
import { Feature, FeatureTable, ElementAlignedBox3d, GeometryClass, FillFlags, ColorDef, LinePixels } from "@bentley/imodeljs-common";
import { JsonUtils } from "@bentley/bentleyjs-core";

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
  }

  /** Deserializes an iModel tile. */
  export class Reader extends GltfTileIO.Reader {
    public static create(stream: TileIO.StreamBuffer, model: GltfTileIO.Model, system: GltfTileIO.System): Reader | undefined {
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
      return {
        readStatus: this.readGltf(geometry),
        isLeaf,
        contentRange: header.contentRange,
        geometry,
      };
    }

    private constructor(props: GltfTileIO.ReaderProps, model: GltfTileIO.Model, system: GltfTileIO.System) {
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

        featureTable.insert(new Feature(elementId, subCategoryId, geometryClass), index);
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
          colorTable.getIndex(color as number);
      }

      return 0 < colorTable.length;
    }

    protected createDisplayParams(json: any): DisplayParams | undefined {
      // ###TODO: gradient, material from material ID, texture mapping
      const type = JsonUtils.asInt(json.type, DisplayParams.Type.Mesh);
      const lineColor = new ColorDef(JsonUtils.asInt(json.lineColor));
      const fillColor = new ColorDef(JsonUtils.asInt(json.fillColor));
      const width = JsonUtils.asInt(json.lineWidth);
      const linePixels = JsonUtils.asInt(json.linePixels, LinePixels.Solid);
      const fillFlags = JsonUtils.asInt(json.fillFlags, FillFlags.None);
      const ignoreLighting = JsonUtils.asBool(json.ignoreLighting);

      return new DisplayParams(type, lineColor, fillColor, width, linePixels, fillFlags, undefined, undefined, undefined, ignoreLighting);
    }
  }
}
