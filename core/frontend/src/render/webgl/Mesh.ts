/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { Point2d, Range2d } from "@bentley/geometry-core";
import { MaterialData } from "./CachedGeometry";
import { MeshArgs } from "../primitives/Mesh";
import { IModelConnection } from "../../IModelConnection";
import { LineCode } from "./EdgeOverrides";
import { ColorInfo } from "./ColorInfo";
import { SurfaceType } from "./RenderFlags";
import { Graphic, wantJointTriangles/*, Batch*/ } from "./Graphic";
import { FeaturesInfo } from "./FeaturesInfo";
import { VertexLUT } from "./VertexLUT";
import { TextureHandle } from "./Texture";
import { Primitive } from "./Primitive";
// import { RenderCommands, DrawCommands } from "./DrawCommand";
import {
  QParams3d,
  QParams2d,
  Material,
  FillFlags,
} from "@bentley/imodeljs-common";

export class MeshInfo {
  public vertexParams?: QParams3d;
  public uvParams: QParams2d;
  public edgeWidth = 0;
  public features?: FeaturesInfo;
  public texture = new WebGLTexture();
  public type: SurfaceType;
  public fillFlags = FillFlags.None;
  public edgeLineCode = 0; // Must call LineCode.valueFromLinePixels(val: LinePixels) and set the output to edgeLineCode
  public isPlanar = false;

  public constructor(args?: MeshArgs | MeshInfo) {
    if (args instanceof MeshArgs) {
      this.vertexParams = args.pointParams;
      this.edgeWidth = args.edges.width;
      this.features = FeaturesInfo.create(args.features);
      this.texture = args.texture as WebGLTexture;
      this.fillFlags = args.fillFlags;
      this.edgeLineCode = LineCode.valueFromLinePixels(args.edges.linePixels);
      this.isPlanar = args.isPlanar;
      const textured = args.texture !== undefined;
      const normals = args.normals !== undefined;
      if (textured) {
        this.type = normals ? SurfaceType.TexturedLit : SurfaceType.Textured;
      } else {
        this.type = normals ? SurfaceType.Lit : SurfaceType.Unlit;
      }
    } else {
      this.type = SurfaceType.Unlit;
    }
    const range: Range2d = Range2d.createNull();
    this.uvParams = QParams2d.fromRange(range);
  }
}

export class MeshData extends MeshInfo {
  public readonly vertices: TextureHandle;
  public readonly colorInfo: ColorInfo;
  public readonly material: MaterialData;
  public readonly animation: any; // should be a AnimationLookupTexture;

  public static create(params: MeshParams): MeshData | undefined {
    const verts = params.lutParams.toTexture();
    return undefined !== verts ? new MeshData(verts, params) : undefined;
  }

  private constructor(vertices: TextureHandle, params: MeshParams) {
    super(params);
    this.vertices = vertices;
    this.colorInfo = params.lutParams.colorInfo;
    this.material = params.material;
    this.animation = undefined;
  }
}

export class MeshParams extends MeshInfo {
  public lutParams: VertexLUT.Params;
  public material: Material;
  public animationLUTParams: any; // TODO: should be a AnimationLUTParams;

  public constructor(args: MeshArgs) {
    super(args);
    this.material = args.material;
    switch (this.type) {
      case SurfaceType.Lit:
        this.initUVParams(args);
        this.lutParams = new VertexLUT.Params(new VertexLUT.LitMeshBuilder(args), args.colors);
        break;
      case SurfaceType.Textured:
        this.initUVParams(args);
        this.lutParams = new VertexLUT.Params(new VertexLUT.TexturedMeshBuilder(args, this.uvParams), args.colors);
        break;
      case SurfaceType.TexturedLit:
        this.initUVParams(args);
        this.lutParams = new VertexLUT.Params(new VertexLUT.TexturedLitMeshBuilder(args, this.uvParams), args.colors);
        break;
      case SurfaceType.Unlit:
      default:
        this.initUVParams(args);
        this.lutParams = new VertexLUT.Params(new VertexLUT.MeshBuilder(args), args.colors);
        break;
    }
    // if (args.auxData.isAnimatable()) { this.animationLUTParams = new AnimationLUTParams(args); }
  }

  public initUVParams(args: MeshArgs): void {
    // ###TODO: MeshArgs should quantize texture UV for us...
    const range: Range2d = Range2d.createNull();
    const fpts = args.textureUv;
    if (fpts.length !== 0 && undefined !== args.points) {
      for (let i = 0; i < args.points.length; i++) {
        range.extendPoint(Point2d.createFrom({ x: fpts[i].x, y: fpts[i].y }));
      }
    }
    this.uvParams = QParams2d.fromRange(range);
  }
}

export class MeshGraphic extends Graphic {
  public readonly meshData: MeshData;
  private readonly _primitives: Primitive[] = [];

  public static create(args: MeshArgs, iModel: IModelConnection) {
    const data = MeshData.create(new MeshParams(args));
    return undefined !== data ? new MeshGraphic(data, args, iModel) : undefined;
  }

  private constructor(data: MeshData, args: MeshArgs, iModel: IModelConnection) {
    super(iModel);
    this.meshData = data;

    assert(undefined !== this._primitives); // silence unused variable warnings...

    // if (args.edges.silhouettes.isValid()) { this.primitives[MeshGraphicType.kSilhouette] = new SilhouettePrimitive(args.edges.silhouettes, this); }
    const convertPolylineEdges = args.edges.polylines.isValid() && !wantJointTriangles(args.edges.width, args.is2d);
    if (convertPolylineEdges) {
      // const simpleEdges = new SimplePolylineEdgeArgs(args.edges.polylines, args.edges.edges);
      // this.primitives[MeshGraphicType.kEdge] = new EdgePrimitive(simpleEdges, this);
    } else {
      // if (args.edges.edges.isValid()) { this.primitives[MeshGraphicType.kEdge] = new EdgePrimitive(args.edges.edges, this); }
      // if (args.edges.polylines.isValid()) { this.primitives[MeshGraphicType.kPolyline] = new PolylineEdgePrimitive.create(args, this); }
    }
  }

  // public addCommands(cmds: RenderCommands): void {
  //   this.primitives.forEach((prim) => {
  //     if (true /*prim.isValid()*/) { prim.addCommands(cmds); }
  //   });
  // }
  // public addHiliteCommands(cmds: DrawCommands, batch: Batch): void {
  //   this.primitives.forEach((prim) => {
  //     if (true /*prim.isValid()*/) { prim.addHiliteCommands(cmds, batch); }
  //   });
  // }
  public setUniformFeatureIndices(id: number): void {
    this.meshData.features = FeaturesInfo.createUniform(id);
  }
  public setIsPixelMode(): void {
    // this.primitives.forEach((prim) => {
    //   if (true /*prim.isValid()*/) { prim.setIsPixelMode(); } // TODO: setIsPixelMode() has not been implemented yet
    // });
  }
  public get meshInfo(): MeshInfo { return this.meshData; }
  public get surfaceType(): SurfaceType { return this.meshInfo.type; }
}
