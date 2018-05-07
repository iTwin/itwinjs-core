/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Material, QPoint3dList, FillFlags } from "@bentley/imodeljs-common";
import { MeshArgs } from "../primitives/Mesh";
import { CachedGeometry } from "./CachedGeometry";
import { MeshPrimitive, MeshGraphic } from "./Mesh";
import { RenderOrder } from "./RenderFlags";

export class SurfaceParams {
  public texture: WebGLTexture;
  public material: Material;
  public vertexIndices: QPoint3dList; // 3 bytes per index => attribute vec3 a_pos
  public get vertexIndicesCount(): number { return this.vertexIndices.length; }

  public constructor(args: MeshArgs) {
    // In shader we have less than 32 bits precision...
    this.texture = args.texture as WebGLTexture;
    this.material = args.material;
    this.vertexIndices = args.points; // keeping this as a QPoint3dList for now
  }
}
export class SurfacePrimitive extends MeshPrimitive<SurfaceParams> {
  public constructor(cachedGeom: CachedGeometry, args: MeshArgs, mesh: MeshGraphic) {
    super(cachedGeom, mesh, new SurfaceParams(args));
  }

  public get renderOrder(): RenderOrder {
    if (FillFlags.Behind === (this.meshInfo.fillFlags & FillFlags.Behind))
      return RenderOrder.BlankingRegion;
    else
      return this.meshInfo.isPlanar ? RenderOrder.PlanarSurface : RenderOrder.Surface;
  }
}
