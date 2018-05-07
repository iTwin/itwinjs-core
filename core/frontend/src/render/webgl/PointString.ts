/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { QParams3d } from "@bentley/imodeljs-common";
import { IModelConnection } from "../../IModelConnection";
import { Primitive } from "./Primitive";
import { Target } from "./Target";
import { CachedGeometry, LUTGeometry } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { TechniqueId } from "./TechniqueId";
import { PolylineArgs } from "../primitives/Mesh";
import { VertexLUT } from "./VertexLUT";
import { FeaturesInfo } from "./FeaturesInfo";
import { AttributeHandle, BufferHandle } from "./Handle";
import { ColorInfo } from "./ColorInfo";

export class PointStringInfo {
  public vertexParams: QParams3d;
  public features: FeaturesInfo | undefined;
  public weight: number;

  public constructor(args: PolylineArgs | PointStringParams) {
    if (args instanceof PolylineArgs) {
      this.vertexParams = args.pointParams;
      this.features = FeaturesInfo.create(args.features);
      this.weight = args.width;
    } else {
      this.vertexParams = args.vertexParams;
      this.features = args.features;
      this.weight = args.weight;
    }
  }
}

export class PointStringGeometry extends LUTGeometry {
  public pointString: PointStringInfo;
  public lut: VertexLUT.Data;
  public indices: BufferHandle;
  public constructor(indices: BufferHandle, numIndices: number, lut: VertexLUT.Data, info: PointStringInfo) {
    super(numIndices);
    this.indices = indices;
    this.lut = lut;
    this.pointString = info;
  }
  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.PointString; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.OpaqueLinear; }
  public get renderOrder(): RenderOrder { return RenderOrder.PlanarLinear; }
  public get qOrigin(): Float32Array { return new Float32Array(1); }
  public get qScale(): Float32Array { return new Float32Array(1); }
  public bindVertexArray(_handle: AttributeHandle): void { }
  public draw(): void { }
  public getColor(_target: Target): ColorInfo { return this.lut.colorInfo; }
  public get numRgbaPerVertex(): number { return this.lut.numRgbaPerVertex; }
}

export class PointStringParams extends PointStringInfo {
  public lutParams: VertexLUT.Params;
  public vertexIndices: Uint8Array;

  public constructor(args: PolylineArgs) {
    super(args);
    this.lutParams = new VertexLUT.Params(new VertexLUT.SimpleBuilder(args), args.colors);

    // NB: We should never get a point string with more than one 'polyline' in it...
    let nVerts = 0;
    for (const polyline of args.polylines) {
      nVerts += polyline.numIndices;
    }

    this.vertexIndices = new Uint8Array(nVerts * 3);
    for (const polyline of args.polylines) {
      let indexByte = 0;
      for (const vIndex of polyline.vertIndices) {
        this.vertexIndices[indexByte++] = vIndex & 0x000000ff;
        this.vertexIndices[indexByte++] = (vIndex & 0x0000ff00) >> 8;
        this.vertexIndices[indexByte++] = (vIndex & 0x00ff0000) >> 16;
      }
    }
  }

  public createGeometry(): CachedGeometry | undefined {
    const indices = BufferHandle.createArrayBuffer(this.vertexIndices);
    if (undefined !== indices) {
      const lut = this.lutParams.toData(this.vertexParams);
      if (undefined !== lut)
        return new PointStringGeometry(indices, this.vertexIndices.length / 3, lut, this);
    }
    return undefined;
  }
}

export class PointStringPrimitive extends Primitive {
  public constructor(cachedGeom: CachedGeometry, iModel: IModelConnection) { super(cachedGeom, iModel); }
  public get renderOrder(): RenderOrder { return RenderOrder.Linear; }
}
