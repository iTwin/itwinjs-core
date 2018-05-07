/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
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

  public constructor(args: PolylineArgs) {
    this.vertexParams = args.pointParams;
    this.features = FeaturesInfo.create(args.features);
    this.weight = args.width;
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

  public static createGeometry(args: PolylineArgs): PointStringGeometry | undefined {
    assert(args.polylines.length === 1);
    const vertexIndices = VertexLUT.convertIndicesToTriplets(args.polylines[0].vertIndices);
    const indices = BufferHandle.createArrayBuffer(vertexIndices);
    if (undefined !== indices) {
      const lutParams: VertexLUT.Params = new VertexLUT.Params(new VertexLUT.SimpleBuilder(args), args.colors);
      const info = new PointStringInfo(args);
      const lut = lutParams.toData(info.vertexParams);
      if (undefined !== lut) {
        return new PointStringGeometry(indices, lut.numVertices, lut, info);
      }
    }
    return undefined;
  }
}

export class PointStringPrimitive extends Primitive {
  public constructor(cachedGeom: CachedGeometry, iModel: IModelConnection) { super(cachedGeom, iModel); }
  public get renderOrder(): RenderOrder { return RenderOrder.Linear; }
}
