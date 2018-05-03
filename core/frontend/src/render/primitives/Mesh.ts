/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Range3d } from "@bentley/geometry-core";
import {
  PolylineData, OctEncodedNormalList, QPoint3dList, MeshPolyline, MeshEdges, QParams3d, /*QPoint3d,*/ EdgeArgs, SilhouetteEdgeArgs, PolylineEdgeArgs, FillFlags,
  FeatureTable, FeatureIndex, FeatureIndexType, ColorIndex, PolylineFlags, LinePixels, OctEncodedNormal, Texture, Material,
} from "@bentley/imodeljs-common";
import { DisplayParams, DisplayParamsRegionEdgeType } from "./DisplayParams";
// import { IModelConnection } from "../../IModelConnection";
import { ColorMap } from "./ColorMap";
// import { System } from "../webgl/System";
import { TriangleList } from "./Primitives";
import { Graphic } from "../webgl/Graphic";

/* Information needed to draw a set of indexed polylines using a shared vertex buffer. */
export class PolylineArgs {
  public colors = new ColorIndex();
  public features = new FeatureIndex();
  public width = 0;
  public linePixels = LinePixels.Solid;
  public flags: PolylineFlags;
  public points: QPoint3dList;
  public polylines: PolylineData[];
  public pointParams: QParams3d;

  public constructor(points: QPoint3dList = new QPoint3dList(QParams3d.fromRange(Range3d.createNull())),
    polylines: PolylineData[] = [], pointParams?: QParams3d, is2d = false, isPlanar = false) {
    this.points = points;
    this.polylines = polylines;
    if (undefined === pointParams) {
      this.pointParams = QParams3d.fromRange(Range3d.createNull());
    } else {
      this.pointParams = pointParams;
    }
    this.flags = new PolylineFlags(is2d, isPlanar);
  }

  public get isValid(): boolean { return this.polylines.length !== 0; }
  public reset(): void {
    this.flags.initDefaults();
    this.points = new QPoint3dList(QParams3d.fromRange(Range3d.createNull()));
    this.polylines = [];
    this.colors.reset();
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

    mesh.polylines.forEach((polyline) => {
      const indexedPolyline = new PolylineData();
      if (indexedPolyline.init(polyline)) { this.polylines.push(indexedPolyline); }
    });
    if (!this.isValid) { return false; }
    this.finishInit(mesh);
    return true;
  }
  public finishInit(mesh: Mesh) {
    this.pointParams = mesh.points.params;
    this.points = mesh.points;
    mesh.colorMap.toColorIndex(this.colors, mesh.colors);
    mesh.toFeatureIndex(this.features);
  }
}

// The vertices of the edges are shared with those of the surface
export class MeshArgsEdges {
  public edges = new EdgeArgs();
  public silhouettes = new SilhouetteEdgeArgs();
  public polylines = new PolylineEdgeArgs();
  public width = 0;
  public linePixels = LinePixels.Solid;

  public clear(): void {
    this.edges = new EdgeArgs();
    this.silhouettes = new SilhouetteEdgeArgs();
    this.polylines = new PolylineEdgeArgs();
    this.width = 0;
    this.linePixels = LinePixels.Solid;
  }
  public isValid(): boolean { return this.edges.isValid() || this.silhouettes.isValid() || this.polylines.isValid(); }
}

/* Information needed to draw a triangle mesh and its edges. */
export class MeshArgs {
  public edges = new MeshArgsEdges();
  public vertIndices: number[] = [];
  public points = new QPoint3dList(QParams3d.fromRange(Range3d.createNull()));
  public normals: OctEncodedNormal[] = [];
  public textureUv: Point2d[] = [];
  public texture?: Texture;
  public colors = new ColorIndex();
  public features = new FeatureIndex();
  public pointParams?: QParams3d;
  public material = new Material();
  public fillFlags = FillFlags.None;
  public isPlanar = false;
  public is2d = false;
  public polylineEdges: PolylineData[] = [];

  // TODO
  // public toPolyface(): IndexedPolyface {
  //   let polyFace = IndexedPolyface.create(); // PolyfaceHeaderPtr polyFace = PolyfaceHeader::CreateFixedBlockIndexed(3);
  //   let pointIndex = polyFace.pointCount;
  //   pointIndex. // In Progress!!
  // }

  public clear() {
    this.vertIndices = [];
    this.points = new QPoint3dList(QParams3d.fromRange(Range3d.createNull()));
    this.normals = [];
    this.textureUv = [];
    this.texture = undefined;
    this.isPlanar = false;
    this.is2d = false;
    this.colors.reset();
    this.features.reset();
    this.polylineEdges = [];
    this.edges.clear();
  }
  public init(mesh: Mesh): boolean {
    this.clear();
    if (mesh.triangles.empty) { return false; }
    this.pointParams = mesh.points.params;
    this.vertIndices = mesh.triangles.indices;
    this.points = mesh.points;
    this.textureUv = mesh.uvParams;
    if (!mesh.displayParams.ignoreLighting) { this.normals = mesh.normals.slice(); }

    // TODO
    // this.texture = mesh.displayParams.GetTextureMapping().GetTexture());
    // this.material = mesh.displayParams.material;
    this.fillFlags = mesh.displayParams.fillFlags;
    this.isPlanar = mesh.isPlanar;
    this.is2d = mesh.is2d;

    mesh.colorMap.toColorIndex(this.colors, mesh.colors);
    mesh.toFeatureIndex(this.features);

    this.edges.width = mesh.displayParams.width;
    this.edges.linePixels = mesh.displayParams.linePixels;

    const meshEdges: MeshEdges = mesh.edges;
    if (!meshEdges) { return true; }

    meshEdges.polylines.forEach((meshPolyline: MeshPolyline) => {
      const polyline = new PolylineData();
      if (polyline.init(meshPolyline)) { this.polylineEdges.push(polyline); }
    });

    this.edges.polylines.init(this.polylineEdges);
    // TODO
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

  // TODO
  // public add(feat: Feature, numVerts: number) { /*unfinished*/ }
  public toFeatureIndex(index: FeatureIndex): void {
    if (!this.initialized) {
      index.type = FeatureIndexType.Empty;
    } else if (this.indices.length === 0) {
      index.type = FeatureIndexType.Uniform;
      index.featureID = this.uniform;
    } else {
      index.type = FeatureIndexType.NonUniform;
      index.featureIDs = new Uint32Array(this.indices);
    }
  }
  // TODO
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
  public getGraphics(args: MeshGraphicArgs/*, system: System, iModel: IModelConnection*/): Graphic | undefined {
    const graphic = undefined;
    if (this.triangles.count() !== 0) {
      // if (args.meshArgs.init(this)) { graphic = system.createTriMesh(args.meshArgs, iModel); }
    } else if (this.polylines.length !== 0 && args.polylineArgs.init(this)) {
      // graphic = system.createIndexedPolylines(args.polylineArgs, iModel);
    }
    return graphic;
  }
}
