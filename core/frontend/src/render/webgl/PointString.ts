/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { dispose } from "@bentley/bentleyjs-core";
import { QParams3d } from "@bentley/imodeljs-common";
import { Primitive } from "./Primitive";
import { Target } from "./Target";
import { CachedGeometry, LUTGeometry } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { TechniqueId } from "./TechniqueId";
import { PolylineArgs } from "../primitives/mesh/MeshPrimitives";
import { VertexLUT } from "./VertexLUT";
import { FeaturesInfo } from "./FeaturesInfo";
import { AttributeHandle, BufferHandle } from "./Handle";
import { GL } from "./GL";
import { System } from "./System";
import { ShaderProgramParams } from "./DrawCommand";

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
  public readonly pointString: PointStringInfo;
  public readonly lut: VertexLUT.Data;
  public readonly indices: BufferHandle;
  public readonly numIndices: number;

  private constructor(indices: BufferHandle, numIndices: number, lut: VertexLUT.Data, info: PointStringInfo) {
    super();
    this.numIndices = numIndices;
    this.indices = indices;
    this.lut = lut;
    this.pointString = info;
  }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.PointString; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.OpaqueLinear; }
  public get featuresInfo(): FeaturesInfo | undefined { return this.pointString.features; }
  public get renderOrder(): RenderOrder { return RenderOrder.PlanarLinear; }
  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this.indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  protected _getLineWeight(_params: ShaderProgramParams): number { return this.pointString.weight; }

  public draw(): void {
    const gl = System.instance.context;
    this.indices.bind(GL.Buffer.Target.ArrayBuffer);
    gl.drawArrays(GL.PrimitiveType.Points, 0, this.numIndices);
  }

  public static create(args: PolylineArgs): PointStringGeometry | undefined {
    if (0 === args.polylines.length)
      return undefined;
    let vertIndices = args.polylines[0].vertIndices;
    if (1 < args.polylines.length) {
      // ###TODO: This shouldn't happen, and similar assertion in C++ is not triggered...
      // assert(args.polylines.length === 1);
      vertIndices = [];
      for (const polyline of args.polylines) {
        for (const vertIndex of polyline.vertIndices) {
          vertIndices.push(vertIndex);
        }
      }
    }
    const vertexIndices = VertexLUT.convertIndicesToTriplets(vertIndices);
    const indices = BufferHandle.createArrayBuffer(vertexIndices);
    if (undefined !== indices) {
      const lutParams: VertexLUT.Params = new VertexLUT.Params(new VertexLUT.SimpleBuilder(args), args.colors);
      const info = new PointStringInfo(args);
      const lut = lutParams.toData(info.vertexParams);
      if (undefined !== lut) {
        return new PointStringGeometry(indices, vertIndices.length, lut, info);
      }
    }
    return undefined;
  }

  public dispose() {
    dispose(this.lut);
    dispose(this.indices);
  }
}

export class PointStringPrimitive extends Primitive {
  public static create(args: PolylineArgs): PointStringPrimitive | undefined {
    const geom = PointStringGeometry.create(args);
    return undefined !== geom ? new PointStringPrimitive(geom) : undefined;
  }
  private constructor(cachedGeom: CachedGeometry) { super(cachedGeom); }
  public get renderOrder(): RenderOrder { return RenderOrder.Linear; }
}
