/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { SurfaceType, RenderPass } from "./RenderFlags";
import { Point2d, Range2d } from "@bentley/geometry-core";
import { MaterialData, LUTGeometry } from "./CachedGeometry";
import { MeshArgs } from "../primitives/mesh/MeshPrimitives";
import { IModelConnection } from "../../IModelConnection";
import { LineCode } from "./EdgeOverrides";
import { ColorInfo } from "./ColorInfo";
import { Graphic, wantJointTriangles, Batch } from "./Graphic";
import { FeaturesInfo } from "./FeaturesInfo";
import { VertexLUT } from "./VertexLUT";
import { Primitive } from "./Primitive";
import { FloatPreMulRgba } from "./FloatRGBA";
import { ShaderProgramParams } from "./DrawCommand";
import { Target } from "./Target";
import { SurfacePrimitive } from "./Surface";
import { RenderCommands, DrawCommands } from "./DrawCommand";
import {
  QParams3d,
  QParams2d,
  FillFlags,
  RenderTexture,
  RenderMode,
  RenderMaterial,
} from "@bentley/imodeljs-common";

export class MeshInfo {
  public readonly edgeWidth: number;
  public features?: FeaturesInfo;
  public readonly texture?: RenderTexture; // ###TODO...
  public readonly type: SurfaceType;
  public readonly fillFlags: FillFlags;
  public readonly edgeLineCode: number; // Must call LineCode.valueFromLinePixels(val: LinePixels) and set the output to edgeLineCode
  public readonly isPlanar: boolean;

  protected constructor(type: SurfaceType, edgeWidth: number, lineCode: number, fillFlags: FillFlags, isPlanar: boolean, features?: FeaturesInfo, texture?: RenderTexture) {
    this.edgeWidth = edgeWidth;
    this.features = features;
    this.texture = texture;
    this.type = type;
    this.fillFlags = fillFlags;
    this.edgeLineCode = lineCode;
    this.isPlanar = isPlanar;
  }
}

export class MeshData extends MeshInfo {
  public readonly lut: VertexLUT.Data;
  public readonly material?: MaterialData | RenderMaterial; // ###TODO implement MaterialData, remove RenderMaterial as option
  public readonly animation: any; // should be a AnimationLookupTexture;

  public static create(params: MeshParams): MeshData | undefined {
    const lut = params.lutParams.toData(params.vertexParams, params.uvParams);
    return undefined !== lut ? new MeshData(lut, params) : undefined;
  }

  private constructor(lut: VertexLUT.Data, params: MeshParams) {
    super(params.type, params.edgeWidth, params.edgeLineCode, params.fillFlags, params.isPlanar, params.features, params.texture);
    this.lut = lut;
    this.material = params.material;
    this.animation = undefined;
  }
}

export class MeshParams extends MeshInfo {
  public readonly vertexParams: QParams3d;
  public readonly uvParams?: QParams2d;
  public readonly lutParams: VertexLUT.Params;
  public readonly material?: RenderMaterial;
  public readonly animationLUTParams: any; // TODO: should be a AnimationLUTParams;

  public constructor(args: MeshArgs) {
    // ###TODO: MeshArgs.normals should be undefined unless it is non-empty
    const isLit = undefined !== args.normals && 0 < args.normals.length;
    const isTextured = undefined !== args.texture;
    const surfaceType = isTextured ? (isLit ? SurfaceType.TexturedLit : SurfaceType.Textured) : isLit ? SurfaceType.Lit : SurfaceType.Unlit;

    super(surfaceType, args.edges.width, LineCode.valueFromLinePixels(args.edges.linePixels), args.fillFlags, args.isPlanar, FeaturesInfo.create(args.features), args.texture);

    // ###TODO: MeshArgs should quantize texture UV for us...
    // ###TODO: MeshArgs.textureUV should be undefined unless it is non-empty
    const uvRange = Range2d.createNull();
    const fpts = args.textureUv;
    if (undefined !== fpts && fpts.length !== 0) {
      for (let i = 0; i < args.points!.length; i++) {
        uvRange.extendPoint(Point2d.createFrom({ x: fpts[i].x, y: fpts[i].y }));
      }
    }

    this.uvParams = uvRange.isNull() ? undefined : QParams2d.fromRange(uvRange);
    this.vertexParams = args.points!.params;
    this.material = args.material;
    switch (this.type) {
      case SurfaceType.Lit:
        this.lutParams = new VertexLUT.Params(new VertexLUT.LitMeshBuilder(args), args.colors);
        break;
      case SurfaceType.Textured:
        this.lutParams = new VertexLUT.Params(new VertexLUT.TexturedMeshBuilder(args, this.uvParams!), args.colors);
        break;
      case SurfaceType.TexturedLit:
        this.lutParams = new VertexLUT.Params(new VertexLUT.TexturedLitMeshBuilder(args, this.uvParams!), args.colors);
        break;
      case SurfaceType.Unlit:
      default:
        this.lutParams = new VertexLUT.Params(new VertexLUT.MeshBuilder(args), args.colors);
        break;
    }
    // if (args.auxData.isAnimatable()) { this.animationLUTParams = new AnimationLUTParams(args); }
  }
}

export class MeshGraphic extends Graphic {
  public readonly meshData: MeshData;
  private readonly _primitives: MeshPrimitive[] = [];

  public static create(args: MeshArgs, iModel: IModelConnection) {
    const data = MeshData.create(new MeshParams(args));
    return undefined !== data ? new MeshGraphic(data, args, iModel) : undefined;
  }

  private constructor(data: MeshData, args: MeshArgs, iModel: IModelConnection) {
    super(iModel);
    this.meshData = data;

    const surface = SurfacePrimitive.create(args, this);
    if (undefined !== surface)
      this._primitives.push(surface);

    // ###TODO edges
    // if (args.edges.silhouettes.isValid()) { this.primitives[MeshGraphicType.kSilhouette] = new SilhouettePrimitive(args.edges.silhouettes, this); }
    const convertPolylineEdges = args.edges.polylines.isValid && !wantJointTriangles(args.edges.width, args.is2d);
    if (convertPolylineEdges) {
      // const simpleEdges = new SimplePolylineEdgeArgs(args.edges.polylines, args.edges.edges);
      // this.primitives[MeshGraphicType.kEdge] = new EdgePrimitive(simpleEdges, this);
    } else {
      // if (args.edges.edges.isValid()) { this.primitives[MeshGraphicType.kEdge] = new EdgePrimitive(args.edges.edges, this); }
      // if (args.edges.polylines.isValid()) { this.primitives[MeshGraphicType.kPolyline] = new PolylineEdgePrimitive.create(args, this); }
    }
  }

  public addCommands(cmds: RenderCommands): void { this._primitives.forEach((prim) => prim.addCommands(cmds)); }
  public addHiliteCommands(cmds: DrawCommands, batch: Batch): void { this._primitives.forEach((prim) => prim.addHiliteCommands(cmds, batch)); }

  public setUniformFeatureIndices(id: number): void {
    this.meshData.features = FeaturesInfo.createUniform(id);
  }
  public setIsPixelMode(): void {
    // this.primitives.forEach((prim) => {
    //   if (true /*prim.isValid()*/) { prim.setIsPixelMode(); } // TODO: setIsPixelMode() has not been implemented yet
    // });
  }
  public get surfaceType(): SurfaceType { return this.meshData.type; }
}

// Defines one aspect of the geometry of a mesh (surface or edges)
export abstract class MeshGeometry extends LUTGeometry {
  protected readonly mesh: MeshData;
  protected readonly numIndices: number;

  // Convenience accessors...
  public get edgeWidth() { return this.mesh.edgeWidth; }
  public get edgeLineCode() { return this.mesh.edgeLineCode; }
  public get features() { return this.mesh.features; }
  public get surfaceType() { return this.mesh.type; }
  public get fillFlags() { return this.mesh.fillFlags; }
  public get isPlanar() { return this.mesh.isPlanar; }
  public get colorInfo(): ColorInfo { return this.mesh.lut.colorInfo; }
  public get uniformColor(): FloatPreMulRgba | undefined { return this.colorInfo.isUniform ? this.colorInfo.uniform : undefined; }
  public get materialData() { return this.mesh.material; }
  public get texture() { return this.mesh.texture; }

  public get lut() { return this.mesh.lut; }

  protected constructor(mesh: MeshData, numIndices: number) {
    super();
    this.numIndices = numIndices;
    this.mesh = mesh;
  }

  protected computeEdgeWeight(params: ShaderProgramParams): number { return params.target.getEdgeWeight(params, this.edgeWidth); }
  protected computeEdgeLineCode(params: ShaderProgramParams): number { return params.target.getEdgeLineCode(params, this.edgeLineCode); }
  protected computeEdgeColor(target: Target): ColorInfo { return target.isEdgeColorOverridden ? target.edgeColor : this.colorInfo; }
  protected computeEdgePass(target: Target): RenderPass {
    const vf = target.currentViewFlags;
    if (RenderMode.SmoothShade === vf.renderMode && !vf.showVisibleEdges()) {
      return RenderPass.None;
    }

    // Only want translucent edges in wireframe mode.
    const isTranslucent = RenderMode.Wireframe === vf.renderMode && vf.showTransparency() && this.colorInfo.hasTranslucency;
    return isTranslucent ? RenderPass.Translucent : RenderPass.OpaqueLinear;
  }
}

export abstract class MeshPrimitive extends Primitive {
  public readonly mesh: MeshGraphic;

  public get meshData(): MeshData { return this.mesh.meshData; }

  protected constructor(cachedGeom: MeshGeometry, mesh: MeshGraphic) {
    super(cachedGeom, mesh.iModel);
    this.mesh = mesh;
  }

  public assignUniformFeatureIndices(_index: number) { assert(false); } // handled by MeshGraphic...
}
