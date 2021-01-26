/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@bentley/bentleyjs-core";
import { Point2d, Range3d } from "@bentley/geometry-core";
import {
  ColorIndex, EdgeArgs, Feature, FeatureIndex, FeatureIndexType, FeatureTable, FillFlags, LinePixels, MeshEdges, MeshPolyline, MeshPolylineList,
  OctEncodedNormal, PolylineData, PolylineEdgeArgs, PolylineFlags, QParams3d, QPoint3dList, RenderMaterial, RenderTexture, SilhouetteEdgeArgs,
} from "@bentley/imodeljs-common";
import { InstancedGraphicParams } from "../../InstancedGraphicParams";
import { RenderGraphic } from "../../RenderGraphic";
import { RenderSystem } from "../../RenderSystem";
import { ColorMap } from "../ColorMap";
import { DisplayParams } from "../DisplayParams";
import { Triangle, TriangleList } from "../Primitives";
import { VertexKeyProps } from "../VertexKey";

/* Information needed to draw a set of indexed polylines using a shared vertex buffer.
 * @internal
 */
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
    if (undefined === mesh.polylines)
      return;

    this.width = mesh.displayParams.width;
    this.linePixels = mesh.displayParams.linePixels;
    this.flags.is2d = mesh.is2d;
    this.flags.isPlanar = mesh.isPlanar;
    this.flags.isDisjoint = Mesh.PrimitiveType.Point === mesh.type;
    if (DisplayParams.RegionEdgeType.Outline === mesh.displayParams.regionEdgeType) {
      // This polyline is behaving as the edges of a region surface.
      if (undefined === mesh.displayParams.gradient || mesh.displayParams.gradient.isOutlined)
        this.flags.setIsNormalEdge();
      else
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

/** The vertices of the edges are shared with those of the surface
 * @internal
 */
export class MeshArgsEdges {
  public edges = new EdgeArgs();
  public silhouettes = new SilhouetteEdgeArgs();
  public polylines = new PolylineEdgeArgs();
  public width = 0;
  public linePixels = LinePixels.Solid;

  public clear(): void {
    this.edges.clear();
    this.silhouettes.clear();
    this.polylines.clear();
    this.width = 0;
    this.linePixels = LinePixels.Solid;
  }
  public get isValid(): boolean { return this.edges.isValid || this.silhouettes.isValid || this.polylines.isValid; }
}

/* A carrier of information needed to describe a triangle mesh and its edges.
 * @internal
 */
export class MeshArgs {
  public edges = new MeshArgsEdges();
  public vertIndices?: number[];
  public points?: QPoint3dList;
  public normals?: OctEncodedNormal[];
  public textureUv?: Point2d[];
  public texture?: RenderTexture;
  public colors = new ColorIndex();
  public features = new FeatureIndex();
  public material?: RenderMaterial;
  public fillFlags = FillFlags.None;
  public isPlanar = false;
  public is2d = false;
  public hasBakedLighting = false;
  public isVolumeClassifier = false;
  public hasFixedNormals = false;

  public clear() {
    this.edges.clear();
    this.vertIndices = undefined;
    this.points = undefined;
    this.normals = undefined;
    this.textureUv = undefined;
    this.texture = undefined;
    this.colors.reset();
    this.features.reset();
    this.material = undefined;
    this.fillFlags = FillFlags.None;
    this.isPlanar = this.is2d = this.hasBakedLighting = this.isVolumeClassifier = this.hasFixedNormals = false;
  }
  public init(mesh: Mesh): boolean {
    this.clear();
    if (undefined === mesh.triangles || mesh.triangles.isEmpty)
      return false;

    assert(0 < mesh.points.length);

    this.vertIndices = mesh.triangles.indices;
    this.points = mesh.points;

    if (!mesh.displayParams.ignoreLighting && 0 < mesh.normals.length)
      this.normals = mesh.normals;

    if (0 < mesh.uvParams.length)
      this.textureUv = mesh.uvParams;

    mesh.colorMap.toColorIndex(this.colors, mesh.colors);
    mesh.toFeatureIndex(this.features);

    this.material = mesh.displayParams.material;
    if (undefined !== mesh.displayParams.textureMapping)
      this.texture = mesh.displayParams.textureMapping.texture;

    this.fillFlags = mesh.displayParams.fillFlags;
    this.isPlanar = mesh.isPlanar;
    this.is2d = mesh.is2d;
    this.hasBakedLighting = (true === mesh.hasBakedLighting);
    this.isVolumeClassifier = (true === mesh.isVolumeClassifier);

    this.edges.width = mesh.displayParams.width;
    this.edges.linePixels = mesh.displayParams.linePixels;

    const meshEdges = mesh.edges;
    if (undefined === meshEdges)
      return true;

    this.edges.edges.init(mesh.edges);
    this.edges.silhouettes.init(mesh.edges);

    const polylines: PolylineData[] = [];
    meshEdges.polylines.forEach((meshPolyline: MeshPolyline) => {
      const polyline = new PolylineData();
      if (polyline.init(meshPolyline)) { polylines.push(polyline); }
    });

    this.edges.polylines.init(polylines);

    return true;
  }
}

/** @internal */
export class MeshGraphicArgs {
  public polylineArgs = new PolylineArgs();
  public meshArgs: MeshArgs = new MeshArgs();
}

/** @internal */
export class Mesh {
  private readonly _data: TriangleList | MeshPolylineList;
  public readonly points: QPoint3dList;
  public readonly normals: OctEncodedNormal[] = [];
  public readonly uvParams: Point2d[] = [];
  public readonly colorMap: ColorMap = new ColorMap(); // used to be called ColorTable
  public colors: number[] = [];
  public edges?: MeshEdges;
  public readonly features?: Mesh.Features;
  public readonly type: Mesh.PrimitiveType;
  public readonly is2d: boolean;
  public readonly isPlanar: boolean;
  public readonly hasBakedLighting: boolean;
  public readonly isVolumeClassifier: boolean;
  public displayParams: DisplayParams;

  private constructor(props: Mesh.Props) {
    const { displayParams, features, type, range, is2d, isPlanar } = props;
    this._data = Mesh.PrimitiveType.Mesh === type ? new TriangleList() : new MeshPolylineList();
    this.displayParams = displayParams;
    this.features = features;
    this.type = type;
    this.is2d = is2d;
    this.isPlanar = isPlanar;
    this.hasBakedLighting = (true === props.hasBakedLighting);
    this.isVolumeClassifier = (true === props.isVolumeClassifier);
    this.points = new QPoint3dList(QParams3d.fromRange(range));
  }

  public static create(props: Mesh.Props): Mesh { return new Mesh(props); }

  public get triangles(): TriangleList | undefined { return Mesh.PrimitiveType.Mesh === this.type ? this._data as TriangleList : undefined; }
  public get polylines(): MeshPolylineList | undefined { return Mesh.PrimitiveType.Mesh !== this.type ? this._data as MeshPolylineList : undefined; }

  public toFeatureIndex(index: FeatureIndex): void {
    if (undefined !== this.features)
      this.features.toFeatureIndex(index);
  }

  public getGraphics(args: MeshGraphicArgs, system: RenderSystem, instances?: InstancedGraphicParams): RenderGraphic | undefined {
    if (undefined !== this.triangles && this.triangles.length !== 0) {
      if (args.meshArgs.init(this))
        return system.createTriMesh(args.meshArgs, instances);
    } else if (undefined !== this.polylines && this.polylines.length !== 0 && args.polylineArgs.init(this)) {
      return system.createIndexedPolylines(args.polylineArgs, instances);
    }

    return undefined;
  }

  public addPolyline(poly: MeshPolyline): void {
    const { type, polylines } = this;

    assert(Mesh.PrimitiveType.Polyline === type || Mesh.PrimitiveType.Point === type);
    assert(undefined !== polylines);

    if (Mesh.PrimitiveType.Polyline === type && poly.indices.length < 2)
      return;

    if (undefined !== polylines)
      polylines.push(poly);
  }

  public addTriangle(triangle: Triangle): void {
    const { triangles, type } = this;

    assert(Mesh.PrimitiveType.Mesh === type);
    assert(undefined !== triangles);

    if (undefined !== triangles)
      triangles.addTriangle(triangle);
  }

  public addVertex(props: VertexKeyProps): number {
    const { position, normal, uvParam, fillColor } = props;

    this.points.push(position);

    if (undefined !== normal)
      this.normals.push(normal);

    if (undefined !== uvParam)
      this.uvParams.push(uvParam);

    // Don't allocate color indices until we have non-uniform colors
    if (0 === this.colorMap.length) {
      this.colorMap.insert(fillColor);
      assert(this.colorMap.isUniform);
      assert(0 === this.colorMap.indexOf(fillColor));
    } else if (!this.colorMap.isUniform || !this.colorMap.hasColor(fillColor)) {
      // Back-fill uniform value (index=0) for existing vertices if previously uniform
      if (0 === this.colors.length)
        this.colors.length = this.points.length - 1;

      this.colors.push(this.colorMap.insert(fillColor));
      assert(!this.colorMap.isUniform);
    }

    return this.points.length - 1;
  }
}

/** @internal */
export namespace Mesh { // eslint-disable-line no-redeclare
  export enum PrimitiveType {
    Mesh, // eslint-disable-line @typescript-eslint/no-shadow
    Polyline,
    Point,
  }

  export class Features {
    public readonly table: FeatureTable;
    public indices: number[] = [];
    public uniform = 0;
    public initialized = false;

    public constructor(table: FeatureTable) { this.table = table; }

    public add(feat: Feature, numVerts: number): void {
      const index = this.table.insert(feat);
      if (!this.initialized) {
        // First feature - uniform.
        this.uniform = index;
        this.initialized = true;
      } else if (0 < this.indices.length) {
        // Already non-uniform
        this.indices.push(index);
      } else {
        // Second feature - back-fill uniform for existing verts
        while (this.indices.length < numVerts - 1)
          this.indices.push(this.uniform);

        this.indices.push(index);
      }
    }

    public setIndices(indices: number[]) {
      this.indices.length = 0;
      this.uniform = 0;
      this.initialized = 0 < indices.length;

      assert(0 < indices.length);
      if (1 === indices.length)
        this.uniform = indices[0];
      else if (1 < indices.length)
        this.indices = indices;
    }

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
  }

  export interface Props {
    displayParams: DisplayParams;
    features?: Mesh.Features;
    type: Mesh.PrimitiveType;
    range: Range3d;
    is2d: boolean;
    isPlanar: boolean;
    hasBakedLighting?: boolean;
    isVolumeClassifier?: boolean;
  }
}

/** @internal */
export class MeshList extends Array<Mesh> {
  public readonly features?: FeatureTable;
  public readonly range?: Range3d;
  constructor(features?: FeatureTable, range?: Range3d) {
    super();
    this.features = features;
    this.range = range;
  }
}
