/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import {
  Point3d,
  Range3d,
  Polyface,
  PolyfaceVisitor,
  Angle,
} from "@bentley/geometry-core";
import { VertexMap, VertexKey } from "../VertexKey";
import {
  QPoint3d,
  QPoint3dList,
  MeshPolyline,
  MeshEdges,
  OctEncodedNormal,
  TextureMapping,
} from "@bentley/imodeljs-common";
import { DisplayParams } from "../DisplayParams";
import { Triangle, TriangleKey, TriangleSet } from "../Primitives";
import { Mesh } from "./MeshPrimitives";

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
        const vertex = vertices[i];
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
