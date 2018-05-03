/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { QParams3d } from "@bentley/imodeljs-common";
import { IModelConnection } from "../../IModelConnection";
import { Primitive } from "./Primitive";
import { Target } from "./Target";
import { CachedGeometry } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
// import { LUTDimension } from "./FeatureDimensions";
import { TechniqueId } from "./TechniqueId";
import { PolylineArgs } from "../primitives/Mesh";
import { VertexLUT } from "./VertexLUT";
import { FeaturesInfo } from "./FeaturesInfo";
import { AttributeHandle } from "./Handle";

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

class PointStringGeometry extends CachedGeometry {
  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.PointString; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.OpaqueLinear; }
  public get renderOrder(): RenderOrder { return RenderOrder.PlanarLinear; }
  public get qOrigin(): Float32Array { return new Float32Array(1); }
  public get qScale(): Float32Array { return new Float32Array(1); }
  public bindVertexArray(_handle: AttributeHandle): void { }
  public draw(): void { }
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

    this.vertexIndices = new Uint8Array(nVerts);
    for (const polyline of args.polylines) {
      let indexByte = 0;
      for (const vIndex of polyline.vertIndices) {
        this.vertexIndices[indexByte++] = vIndex && 0x000000ff;
        this.vertexIndices[indexByte++] = (vIndex && 0x0000ff00) >> 8;
        this.vertexIndices[indexByte++] = (vIndex && 0x00ff0000) >> 16;
      }
    }
  }

  public createGeometry(): CachedGeometry { return new PointStringGeometry(); }
}

export class PointStringPrimitive extends Primitive {
  public constructor(cachedGeom: CachedGeometry, iModel: IModelConnection) { super(cachedGeom, iModel); }
  public get renderOrder(): RenderOrder { return RenderOrder.Linear; }
}
