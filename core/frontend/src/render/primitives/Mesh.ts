/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Range3d } from "@bentley/geometry-core";
import { TriMeshArgs, IndexedPolylineArgs, PolylineData, OctEncodedNormalList, QPoint3dList, MeshPolyline, MeshEdges, QParams3d,
         FeatureTable, FeatureIndex, FeatureIndexType } from "@bentley/imodeljs-common";
import { DisplayParams, DisplayParamsRegionEdgeType } from "./DisplayParams";
// import { IModelConnection } from "../../IModelConnection";
import { ColorMap } from "./ColorMap";
// import { RenderSystem } from "../System";
import { TriangleList } from "./Primitives";
import { Graphic } from "../webgl/Graphic";

export class PolylineArgs extends IndexedPolylineArgs {
  public polylines: PolylineData[] = [];
  public colorTable: Uint32Array = new Uint32Array();
  public constructor() { super(); }

  public isValid(): boolean { return this.polylines.length !== 0; }
  public reset(): void {
    this.flags.initDefaults();
    this.numPoints = this.numLines = 0;
    this.points = new Uint16Array();
    this.lines = [];
    this.polylines = [];
    this.colors.reset();
    this.colorTable = new Uint32Array();
    this.features.reset();
  }
  public init(mesh: Mesh) {
    this.reset();
    this.width = mesh.displayParams.width;
    this.linePixels = mesh.displayParams.linePixels;

    this.flags.is2d = mesh.is2d;
    this.flags.isPlanar = mesh.isPlanar;
    this.flags.isDisjoint = MeshPrimitiveType.Point === mesh.type;
    if (DisplayParamsRegionEdgeType.Outline === mesh.displayParams.regionEdgeType) {
      // This polyline is behaving as the edges of a region surface.
      // TODO: GradientSymb not implemented yet!  Uncomment following lines when it is implemented.
      // if (mesh.displayParams.gradient || mesh.displayParams.gradient.isOutlined())
      //   this.flags.setIsNormalEdge();
      // else
        this.flags.setIsOutlineEdge(); // edges only displayed if fill undisplayed...
    }

    this.polylines.reverse();
    mesh.polylines.forEach((polyline) => {
      const indexedPolyline = new PolylineData();
      if (indexedPolyline.init(polyline)) { this.polylines.push(indexedPolyline); }
    });
    if (!this.isValid()) { return false; }
    this.finishInit(mesh);
    return true;
  }
  public finishInit(mesh: Mesh) {
    this.pointParams = mesh.points.params;
    this.numPoints = mesh.points.length;
    this.points = mesh.points.toTypedArray();
    mesh.colorMap.toColorIndex(this.colors, this.colorTable, mesh.colors);
    mesh.toFeatureIndex(this.features);
    this.numLines = this.polylines.length;
    this.lines = this.polylines.splice(0);
  }
}

export class MeshArgs extends TriMeshArgs {
  public colorTable: number[] = [];
  public polylineEdges: PolylineData[] = [];

  public clear() {
    this.numIndices = 0;
    this.vertIndex = [];
    this.numPoints = 0;
    this.points = undefined;
    this.normals = [];
    this.textureUv = [];
    this.texture = undefined;
    this.isPlanar = false;
    this.is2d = false;
    this.colors.reset();
    this.colorTable = [];
    this.features.reset();
    this.polylineEdges = [];
    this.edges.clear();
  }
  public init(mesh: Mesh): boolean {
    this.clear();
    if (mesh.triangles.empty) { return false; }
    this.pointParams = mesh.points.params;
    this.vertIndex = mesh.triangles.indices;
    this.numIndices = this.vertIndex.length;
    this.points = mesh.points.toTypedArray();
    this.numPoints = mesh.points.length;
    this.textureUv = mesh.uvParams;
    if (!mesh.displayParams.ignoreLighting) { this.normals = mesh.normals.slice(); }

    // this.texture = <TextureP>(mesh.displayParams.GetTextureMapping().GetTexture());
    // this.material = mesh.displayParams.material;
    this.fillFlags = mesh.displayParams.fillFlags;
    this.isPlanar = mesh.isPlanar;
    this.is2d = mesh.is2d;

    mesh.colorMap.toColorIndex(this.colors, new Uint32Array(this.colorTable), mesh.colors);
    mesh.toFeatureIndex(this.features);

    this.edges.width = mesh.displayParams.width;
    this.edges.linePixels = mesh.displayParams.linePixels;

    const meshEdges: MeshEdges = mesh.edges;
    if (!meshEdges) { return true; }

    this.polylineEdges.reverse();
    meshEdges.polylines.forEach((meshPolyline: MeshPolyline) => {
      const polyline = new PolylineData();
      if (polyline.init(meshPolyline)) { this.polylineEdges.push(polyline); }
    });

    this.edges.polylines.init(this.polylineEdges);
    // this.auxData = mesh.auxData();

    return true;
  }
}

export class MeshGraphicArgs {
  public polylineArgs = new PolylineArgs();
  public meshArgs: MeshArgs = new MeshArgs();
}

export class MeshFeatures {
  public table: FeatureTable;
  public indices: number[] = [];
  public uniform = 0;
  public initialized = false;

  public constructor(table: FeatureTable) { this.table = table; }

  // public add(feat: Feature, numVerts: number) { /*unfinished*/ }
  public toFeatureIndex(index: FeatureIndex): void {
    if (!this.initialized) {
      index.type = FeatureIndexType.kEmpty;
    } else if (this.indices.length === 0) {
      index.type = FeatureIndexType.kUniform;
      index.featureID = this.uniform;
    } else {
      index.type = FeatureIndexType.kNonUniform;
      index.featureIDs = new Uint32Array(this.indices);
    }
  }
  // public setIndices(indices: number[]): void { /*unfinished*/ }
}

export const enum MeshPrimitiveType {
  Mesh,
  Polyline,
  Point,
}

export type PolylineList = MeshPolyline[];

export class Mesh {
  public triangles: TriangleList = new TriangleList();
  public polylines: PolylineList = [];
  public readonly verts: QPoint3dList;
  public readonly normals = new OctEncodedNormalList();
  public uvParams: Point2d[] = [];
  public colorMap: ColorMap = new ColorMap(); // used to be called ColorTable
  public colors: Uint16Array = new Uint16Array();
  public edges = new MeshEdges();
  // public auxData: MeshAuxData;

  public constructor(public displayParams: DisplayParams, public features: MeshFeatures, public type: MeshPrimitiveType, range: Range3d, public is2d: boolean, public isPlanar: boolean) {
    this.verts = new QPoint3dList(QParams3d.fromRange(range));
  }

  public get points(): QPoint3dList { return this.verts; }
  public toFeatureIndex(index: FeatureIndex): void { this.features.toFeatureIndex(index); }
  public getGraphics(args: MeshGraphicArgs/*, system: RenderSystem, iModel: IModelConnection*/ ): Graphic | undefined {
    const graphic = undefined;
    if (this.triangles.count() !== 0) {
      // if (args.meshArgs.init(this)) { graphic = system.createTriMesh(args.meshArgs, iModel); }
    } else if (this.polylines.length !== 0 && args.polylineArgs.init(this)) {
      // graphic = system.createIndexedPolylines(args.polylineArgs, iModel);
    }
    return graphic;
  }
}
