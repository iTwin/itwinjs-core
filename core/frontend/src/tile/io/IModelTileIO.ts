/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { ModelState } from "../../ModelState";
import { RenderSystem } from "../../render/System";
import { DisplayParams } from "../../render/primitives/DisplayParams";
import { MeshList } from "../../render/primitives/Mesh";
import { ColorMap } from "../../render/primitives/ColorMap";
import { Feature, FeatureTable, ElementAlignedBox3d, GeometryClass } from "@bentley/imodeljs-common";

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

  export interface Result {
    readStatus: TileIO.ReadStatus;
    isLeaf: boolean;
    contentRange?: ElementAlignedBox3d;
    geometry?: TileIO.GeometryCollection;
  }

  export class Reader extends GltfTileIO.Reader {
    public static create(stream: TileIO.StreamBuffer, model: ModelState, system: RenderSystem): Reader | undefined {
      const props = GltfTileIO.ReaderProps.create(stream);
      return undefined !== props ? new Reader(props, model, system) : undefined;
    }

    public read(): Result {
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

    private constructor(props: GltfTileIO.ReaderProps, model: ModelState, system: RenderSystem) {
      super(props, model, system);
    }

    protected readFeatureTable(): FeatureTable | undefined {
      const startPos = this.buffer.curPos;
      const header = FeatureTableHeader.readFrom(this.buffer);
      if (undefined === header)
        return undefined;

      const featureTable = new FeatureTable(header.maxFeatures, this.model.id);
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

    protected readFeatures(_json: any): Uint32Array | undefined {
      return undefined; // ###TODO
    }

    protected readColorTable(_json: any): ColorMap | undefined {
      return undefined; // ###TODO
    }

    protected createDisplayParams(_json: any): DisplayParams | undefined {
      return undefined; // ###TODO
    }
  }
}
