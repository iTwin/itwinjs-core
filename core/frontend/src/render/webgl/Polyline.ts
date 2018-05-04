/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "../../IModelConnection";
import { PolylineArgs } from "../primitives/Mesh";
import { Primitive } from "./Primitive";
import { Target } from "./Target";
import { CachedGeometry } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { TechniqueId } from "./TechniqueId";
import { AttributeHandle } from "./Handle";

class PolylineGeometry extends CachedGeometry { // ###TODO put here as a placeholder until it is implemented for real
  public constructor(_params: PolylineParams) { super(); } // ### TODO
  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.Polyline; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.None; } // ### TODO
  public get renderOrder(): RenderOrder { return RenderOrder.PlanarLinear; }
  public get qOrigin(): Float32Array { return new Float32Array(1); } // ### TODO
  public get qScale(): Float32Array { return new Float32Array(1); } // ### TODO
  public bindVertexArray(_handle: AttributeHandle): void { } // ### TODO
  public draw(): void { } // ### TODO
}

class PolylineParams { // ###TODO put here as a placeholder until it is implemented for real
  public constructor(_args: PolylineArgs) { }
  public static create(args: PolylineArgs): PolylineParams { return new PolylineParams(args); }
}

export class PolylinePrimitive extends Primitive {
  public constructor(cachedGeom: CachedGeometry, iModel: IModelConnection) { super(cachedGeom, iModel); }
  public get renderOrder(): RenderOrder { return RenderOrder.Linear; }
  // public get isPlanar(): boolean { return (this.cachedGeometry as PolylineGeometry).isPlanar; } // ###TODO implement PolylineGeometry.isPlanar
  // public get isEdge(): boolean { return (this.cachedGeometry as PolylineGeometry).isAnyEdge; } // ###TODO implement PolylineGeometry.isAnyEdge
  public static create(args: PolylineArgs, imodel: IModelConnection): PolylinePrimitive {
    const params: PolylineParams = PolylineParams.create(args);
    return new PolylinePrimitive(new PolylineGeometry(params), imodel);
  }
}
