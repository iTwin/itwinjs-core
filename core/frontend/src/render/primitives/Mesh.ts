/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import {
  assert,
  Comparable,
  compareNumbers,
  compareBooleans,
  Dictionary,
  // SortedArray,
} from "@bentley/bentleyjs-core";
import {
  Point2d,
  Point3d,
  Range3d,
  Polyface,
  Angle,
  PolyfaceVisitor,
} from "@bentley/geometry-core";
import { VertexMap, VertexKey } from "./VertexKey";
import {
  PolylineData,
  QPoint3d,
  QPoint3dList,
  MeshPolyline,
  MeshEdges,
  QParams3d,
  EdgeArgs,
  SilhouetteEdgeArgs,
  PolylineEdgeArgs,
  FillFlags,
  Feature,
  FeatureTable,
  FeatureIndex,
  FeatureIndexType,
  ColorIndex,
  PolylineFlags,
  LinePixels,
  OctEncodedNormal,
  RenderTexture,
  RenderMaterial,
  TextureMapping,
} from "@bentley/imodeljs-common";
import { DisplayParams } from "./DisplayParams";
// import { IModelConnection } from "../../IModelConnection";
import { ColorMap } from "./ColorMap";
// import { System } from "../webgl/System";
import { Triangle, TriangleList, TriangleKey, TriangleSet, ToleranceRatio } from "./Primitives";
import { Graphic } from "../webgl/Graphic";
// import { IModelConnection } from "../../IModelConnection";

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
    if (undefined === mesh.polylines)
      return;

    this.width = mesh.displayParams.width;
    this.linePixels = mesh.displayParams.linePixels;
    this.flags.is2d = mesh.is2d;
    this.flags.isPlanar = mesh.isPlanar;
    this.flags.isDisjoint = Mesh.PrimitiveType.Point === mesh.type;
    if (DisplayParams.RegionEdgeType.Outline === mesh.displayParams.regionEdgeType) {
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
    // mesh.toFeatureIndex(this.features);
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
    this.edges.clear();
    this.silhouettes.clear();
    this.polylines.clear();
    this.width = 0;
    this.linePixels = LinePixels.Solid;
  }
  public get isValid(): boolean { return this.edges.isValid || this.silhouettes.isValid || this.polylines.isValid; }
}

/* A carrier of information needed to describe a triangle mesh and its edges. */
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
    this.isPlanar = this.is2d = false;
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
    // mesh.toFeatureIndex(this.features);

    // ###TODO this.texture = mesh.displayParams.GetTextureMapping().GetTexture());
    this.material = mesh.displayParams.material;
    this.fillFlags = mesh.displayParams.fillFlags;
    this.isPlanar = mesh.isPlanar;
    this.is2d = mesh.is2d;

    this.edges.width = mesh.displayParams.width;
    this.edges.linePixels = mesh.displayParams.linePixels;

    const meshEdges = mesh.edges;
    if (undefined === meshEdges)
      return true;

    const polylines: PolylineData[] = [];
    meshEdges.polylines.forEach((meshPolyline: MeshPolyline) => {
      const polyline = new PolylineData();
      if (polyline.init(meshPolyline)) { polylines.push(polyline); }
    });

    this.edges.polylines.init(polylines);

    return true;
  }
}

export class MeshGraphicArgs {
  public polylineArgs = new PolylineArgs();
  public meshArgs: MeshArgs = new MeshArgs();
}

export type PolylineList = MeshPolyline[];

export class Mesh {
  private readonly _data: TriangleList | PolylineList;
  public readonly points: QPoint3dList;
  public readonly normals: OctEncodedNormal[] = [];
  public readonly uvParams: Point2d[] = [];
  public readonly colorMap: ColorMap = new ColorMap(); // used to be called ColorTable
  public readonly colors: Uint16Array = new Uint16Array();
  public edges?: MeshEdges;
  public readonly features?: Mesh.Features;
  public readonly type: Mesh.PrimitiveType;
  public readonly is2d: boolean;
  public readonly isPlanar: boolean;
  public displayParams: DisplayParams;

  private constructor(props: Mesh.Props) {
    const { displayParams, features, type, range, is2d, isPlanar } = props;
    if (Mesh.PrimitiveType.Mesh === type)
      this._data = new TriangleList();
    else
      this._data = new Array<MeshPolyline>();

    this.displayParams = displayParams;
    this.features = features;
    this.type = type;
    this.is2d = is2d;
    this.isPlanar = isPlanar;
    this.points = new QPoint3dList(QParams3d.fromRange(range));
  }

  public get triangles(): TriangleList | undefined { return Mesh.PrimitiveType.Mesh === this.type ? this._data as TriangleList : undefined; }
  public get polylines(): PolylineList | undefined { return Mesh.PrimitiveType.Mesh !== this.type ? this._data as PolylineList : undefined; }

  // public toFeatureIndex(index: FeatureIndex): void { this.features.toFeatureIndex(index); }
  public getGraphics(args: MeshGraphicArgs/*, system: System, iModel: IModelConnection*/): Graphic | undefined {
    const graphic = undefined;
    if (undefined !== this.triangles && this.triangles.length !== 0) {
      // if (args.meshArgs.init(this)) { graphic = system.createTriMesh(args.meshArgs, iModel); }
    } else if (undefined !== this.polylines && this.polylines.length !== 0 && args.polylineArgs.init(this)) {
      // graphic = system.createIndexedPolylines(args.polylineArgs, iModel);
    }
    return graphic;
  }

  public addPolyline(poly: MeshPolyline): void {
    const { type, polylines } = this;
    assert(Mesh.PrimitiveType.Polyline === type || Mesh.PrimitiveType.Point === type);
    assert(undefined !== polylines);
    if (Mesh.PrimitiveType.Polyline === type && poly.indices.length < 2)
      return;
    if (undefined !== polylines) polylines.push(poly);
  }

  public addTriangle(triangle: Triangle): void {
    const { triangles, type } = this;
    assert(Mesh.PrimitiveType.Mesh === type);
    assert(undefined !== triangles);
    if (undefined !== triangles) triangles.addTriangle(triangle);
  }

  public static create(props: Mesh.Props): Mesh { return new Mesh(props); }
}

export namespace Mesh {
  export const enum PrimitiveType {
    Mesh,
    Polyline,
    Point,
  }

  export class Features {
    public readonly table: FeatureTable;
    public readonly _indices: number[] = [];
    public uniform = 0;
    public initialized = false;

    public constructor(table: FeatureTable) { this.table = table; }

    public get indices(): number[] { return this._indices; }

    public add(feat: Feature, numVerts: number): void {
      const index = this.table.getIndex(feat);
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

    /*
    public setIndices(indices: number[]) {
      this._indices.length = 0;
      this.uniform = 0;
      this.initialized = 0 < indices.length;

      assert(0 < indices.length);
      if (1 == indices.length)
        this.uniform = indices[0];
      else if (1 < indices.length)
        this._indices = indices;
    } */

    public toFeatureIndex(index: FeatureIndex): void {
      if (!this.initialized) {
        index.type = FeatureIndexType.Empty;
      } else if (this.indices.length === 0) {
        index.type = FeatureIndexType.Uniform;
        index.featureID = this.uniform;
      } else {
        index.type = FeatureIndexType.NonUniform;
        index.featureIDs = new Uint32Array(this._indices);
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
  }
}

export class MeshBuilder {
  private _vertexMap?: VertexMap;
  private _triangleSet?: TriangleSet;
  private _currentPolyface?: MeshBuilderPolyface;
  public readonly mesh: Mesh;
  public readonly tolerance: number;
  public readonly areaTolerance: number;
  public readonly tileRange: Range3d;
  public get currentPolyface(): MeshBuilderPolyface | undefined { return this._currentPolyface; }
  public set displayParams(params: DisplayParams) { this.mesh.displayParams = params; }

  /** create reference for vertexMap on demand */
  public get vertexMap(): VertexMap {
    if (undefined === this._vertexMap) this._vertexMap = new VertexMap();
    return this._vertexMap;
  }

  /** create reference for triangleSet on demand */
  public get triangleSet(): TriangleSet {
    if (undefined === this._triangleSet) this._triangleSet = new TriangleSet();
    return this._triangleSet;
  }

  private constructor(mesh: Mesh, tolerance: number, areaTolerance: number, tileRange: Range3d) {
    this.mesh = mesh;
    this.tolerance = tolerance;
    this.areaTolerance = areaTolerance;
    this.tileRange = tileRange;
  }

  public static create(props: MeshBuilder.Props): MeshBuilder {
    const mesh = Mesh.create(props);
    const { tolerance, areaTolerance, range } = props;
    return new MeshBuilder(mesh, tolerance, areaTolerance, range);
  }

  public addFromPolyfaceVisitor(params: MeshBuilder.PolyfaceVisitorParams): void {
    const { visitor, mappedTexture, /** iModel, feature, */ includeParams, fillColor, requireNormals /** , auxData */ } = params;
    if (visitor.pointCount < 3)
      return;

    const points = visitor.point;
    const visitorVisibility = visitor.edgeVisible;
    const nTriangles = points.length - 2;
    const normal = visitor.normal;

    if (requireNormals && (normal === undefined || normal.length < points.length))
      return; // TFS#790263: Degenerate triangle - no normals.

    // The face represented by this visitor should be convex (we request that in facet options) - so we do a simple fan triangulation.
    for (let iTriangle = 0; iTriangle < nTriangles; iTriangle++) {
      const triangle = new Triangle();
      const param = visitor.param;
      const visibility = [
        (0 === iTriangle) ? visitorVisibility[0] : false,
        visitorVisibility[iTriangle + 1],
        (iTriangle === nTriangles - 1) ? visitorVisibility[iTriangle + 2] : false,
      ];

      assert(!includeParams || (param !== undefined && param.length > 0));
      const haveParam = includeParams && (param !== undefined && param.length > 0);
      assert(!haveParam || undefined !== mappedTexture);
      triangle.setEdgeVisibility(visibility[0], visibility[1], visibility[2]);

      if (haveParam && undefined !== mappedTexture) {
        // const textureMapParams = mappedTexture.params;
        // const computedParams = [];

        assert(this.mesh.points.length === 0 || this.mesh.uvParams.length !== 0);
        // ###TODO finish computeUVParams on TextureMapping
        // if (SUCCESS == textureMapParams.ComputeUVParams (computedParams, visitor))
        //     params = computedParams;
        // else
        //     BeAssert(false && "ComputeUVParams() failed");
      }

      const computeIndex = (i: number): number => 0 === i ? 0 : iTriangle + i;
      const makeQPoint = (index: number): QPoint3d => QPoint3d.create(points.getPoint3dAt(index), this.mesh.points.params);
      const makeOctEncodedNormal = (index: number): OctEncodedNormal | undefined => requireNormals ? new OctEncodedNormal(visitor.getNormal(index)) : undefined;
      const makeVertexKey = (index: number) => new VertexKey(makeQPoint(index), fillColor, makeOctEncodedNormal(index), haveParam ? param![index] : undefined);
      const indices = [computeIndex(0), computeIndex(1), computeIndex(2)];
      const vertices = [makeVertexKey(indices[0]), makeVertexKey(indices[1]), makeVertexKey(indices[2])];

      // Previously we would add all 3 vertices to our map, then detect degenerate triangles in AddTriangle().
      // This led to unused vertex data, and caused mismatch in # of vertices when recreating the MeshBuilder from the data in the tile cache.
      // Detect beforehand instead.
      if (vertices[0].position === vertices[1].position || vertices[0].position === vertices[2].position || vertices[1].position === vertices[2].position)
        continue;

      for (let i = 0; i < 3; i++) {
        // const index = indices[i];
        const vertex = vertices[i];
        // ###TODO implement MeshAuxData
        // if (nullptr != auxData && visitor.GetAuxDataCP().IsValid())
        //     {
        //     // No deduplication with auxData (for now...)
        //     newTriangle[i] = m_mesh->AddVertex(vertex.GetPosition(), vertex.GetNormal(), vertex.GetParam(), vertex.GetFillColor(), vertex.GetFeature());
        //     m_mesh->AddAuxChannel(*auxData, visitor.GetAuxDataCP()->GetIndices().at(index));
        //     }
        // else
        //     {
        //     newTriangle[i] = AddVertex(vertex);
        //     }
        triangle.indices[i] = this.vertexMap.insert(vertex);
        if (this.currentPolyface !== undefined)
          this.currentPolyface.vertexIndexMap.set(triangle.indices[i], visitor.clientPointIndex(i));
      }
      this.addTriangle(triangle);
    }
  }

  /** removed Feature for now */
  public addPolyline(pts: QPoint3dList | Point3d[], fillColor: number, startDistance: number): void {
    const { mesh, addVertex } = this;
    const points = pts instanceof QPoint3dList ? pts : QPoint3dList.createFrom(pts, mesh.points.params);
    const poly = new MeshPolyline(startDistance);
    for (const point of points) poly.addIndex(addVertex(point, fillColor));
    mesh.addPolyline(poly);
  }

  private createQPoint(point: Point3d): QPoint3d {
    const params = this.mesh.points.params;
    return QPoint3d.create(point, params);
  }

  /** removed Feature for now */
  public addPointString(points: Point3d[], fillColor: number, startDistance: number): void {
    const { addVertex, createQPoint, mesh } = this;
    // Assume no duplicate points in point strings (or, too few to matter).
    // Why? Because drawGridDots() potentially sends us tens of thousands of points (up to 83000 on my large monitor in top view), and wants to do so every frame.
    // The resultant map lookups/inserts/rebalancing kill performance in non-optimized builds.
    // NB: startDistance currently unused - Ray claims they will be used in future for non-cosmetic line styles? If not let's jettison them...
    const poly = new MeshPolyline(startDistance);
    for (const point of points) poly.addIndex(addVertex(createQPoint(point), fillColor));
    mesh.addPolyline(poly);
  }

  public beginPolyface(polyface: Polyface, options: MeshEdgeCreationOptions): void {
    // ###TODO generateNoEdges no edges case
    // maybe this --> (options.generateNoEdges && 0 === polyface.data.edgeVisible.length)
    const triangles = this.mesh.triangles;
    this._currentPolyface = new MeshBuilderPolyface(polyface, options, triangles === undefined ? 0 : triangles.length);
  }

  public endPolyface(): void {
    const { currentPolyface, mesh } = this;
    if (undefined === currentPolyface)
      return;

    if (mesh.edges === undefined)
      mesh.edges = new MeshEdges();

    // ###TODO
    // MeshEdgesBuilder(m_tileRange, *m_mesh, *m_currentPolyface).BuildEdges(*m_mesh->m_edges, m_currentPolyface.get());
  }

  // ###TODO: empty method declaration?
  // public addMesh(triangle: Triangle): void;

  public addVertex(qpoint: QPoint3d, fillColor: number): number {
    return this.vertexMap.insert(new VertexKey(qpoint, fillColor));
  }
  public addTriangle(triangle: Triangle): void {
    const { triangleSet, mesh } = this;
    // Prefer to avoid adding vertices originating from degenerate triangles before we get here...
    assert(!triangle.isDegenerate);
    const key = new TriangleKey(triangle);
    if (triangleSet.findEqual(key) === undefined) {
      triangleSet.insert(key);
      mesh.addTriangle(triangle);
    }
  }
}

export namespace MeshBuilder {
  export interface Props extends Mesh.Props {
    tolerance: number;
    areaTolerance: number;
  }
  export interface PolyfaceVisitorParams {
    visitor: PolyfaceVisitor;
    mappedTexture?: TextureMapping;
    // iModel: IModelConnection;
    // feature: Feature;
    includeParams: boolean;
    fillColor: number;
    requireNormals: boolean;
    // auxData: MeshAuxData;
  }
}

export class MeshEdgeCreationOptions {
  public readonly type: MeshEdgeCreationOptions.Type;
  public readonly minCreaseAngle = 20.0 * Angle.radiansPerDegree;
  public get generateAllEdges(): boolean { return this.type === MeshEdgeCreationOptions.Type.AllEdges; }
  public get generateNoEdges(): boolean { return this.type === MeshEdgeCreationOptions.Type.NoEdges; }
  public get generateSheetEdges(): boolean { return 0 !== (this.type & MeshEdgeCreationOptions.Type.SheetEdges); }
  public get generateCreaseEdges(): boolean { return 0 !== (this.type & MeshEdgeCreationOptions.Type.CreaseEdges); }
  /** Create edge chains for polyfaces that do not already have them. */
  public get createEdgeChains(): boolean { return 0 !== (this.type & MeshEdgeCreationOptions.Type.CreateChains); }
  constructor(type = MeshEdgeCreationOptions.Type.NoEdges) { this.type = type; }
}

export namespace MeshEdgeCreationOptions {
  export const enum Type {
    NoEdges = 0x0000,
    SheetEdges = 0x0001 << 0,
    CreaseEdges = 0x0001 << 1,
    SmoothEdges = 0x0001 << 2,
    CreateChains = 0x0001 << 3,
    DefaultEdges = CreaseEdges | SheetEdges,
    AllEdges = CreaseEdges | SheetEdges | SmoothEdges,
  }
}

export class MeshBuilderPolyface {
  public readonly polyface: Polyface;
  public readonly edgeOptions: MeshEdgeCreationOptions;
  public readonly vertexIndexMap: Map<number, number> = new Map<number, number>();
  public readonly baseTriangleIndex: number;
  constructor(polyface: Polyface, edgeOptions: MeshEdgeCreationOptions, baseTriangleIndex: number) {
    this.polyface = polyface;
    this.edgeOptions = edgeOptions;
    this.baseTriangleIndex = baseTriangleIndex;
  }
}

export class MeshList extends Array<Mesh> {
  public readonly features?: FeatureTable;
  constructor(features?: FeatureTable, ...args: Mesh[]) {
    super(...args);
    if (undefined !== features)
      this.features = features;
  }
}

export class MeshBuilderMap extends Dictionary<MeshBuilderMap.Key, MeshBuilder> {
  public readonly range: Range3d;
  public readonly vertexTolerance: number;
  public readonly facetAreaTolerance: number;
  public readonly is2d: boolean;
  constructor(tolerance: number, range: Range3d, is2d: boolean) {
    super((lhs: MeshBuilderMap.Key, rhs: MeshBuilderMap.Key) => lhs.compare(rhs));
    this.vertexTolerance = tolerance * ToleranceRatio.vertex;
    this.facetAreaTolerance = tolerance * ToleranceRatio.facetArea;
    this.range = range;
    this.is2d = is2d;
  }
}

export namespace MeshBuilderMap {
  export class Key implements Comparable<Key> {
    public order: number = 0;
    public readonly params: DisplayParams;
    public readonly type: Mesh.PrimitiveType;
    public readonly hasNormals: boolean;
    public readonly isPlanar: boolean;

    constructor(params: DisplayParams, type: Mesh.PrimitiveType, hasNormals: boolean, isPlanar: boolean) {
      this.params = params;
      this.type = type;
      this.hasNormals = hasNormals;
      this.isPlanar = isPlanar;
    }

    public static createFromMesh(mesh: Mesh): Key {
      return new Key(mesh.displayParams, mesh.type, mesh.normals.length !== 0, mesh.isPlanar);
    }

    public compare(rhs: Key): number {
      let diff = compareNumbers(this.order, rhs.order);
      if (0 === diff) {
        diff = compareNumbers(this.type, rhs.type);
        if (0 === diff) {
          diff = compareBooleans(this.isPlanar, rhs.isPlanar);
          if (0 === diff) {
            diff = compareBooleans(this.hasNormals, rhs.hasNormals);
            if (0 === diff) {
              diff = this.params.compareForMerge(rhs.params);
            }
          }
        }
      }

      return diff;
    }

    public equals(rhs: Key): boolean { return 0 === this.compare(rhs); }
  }
}
