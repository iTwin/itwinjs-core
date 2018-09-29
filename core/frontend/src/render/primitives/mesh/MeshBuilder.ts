/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { assert } from "@bentley/bentleyjs-core";
import {
  Point3d,
  Range3d,
  Polyface,
  PolyfaceVisitor,
  Angle,
  IndexedPolyface,
  Point2d,
} from "@bentley/geometry-core";
import { VertexMap, VertexKey, VertexKeyProps } from "../VertexKey";
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
import { StrokesPrimitivePointLists } from "../Strokes";

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

  /** create a new MeshBuilder */
  public static create(props: MeshBuilder.Props): MeshBuilder {
    const mesh = Mesh.create(props);
    const { tolerance, areaTolerance, range } = props;
    return new MeshBuilder(mesh, tolerance, areaTolerance, range);
  }

  /**
   * iterate through each point list of the strokes primitive and either load the point string or polyline into builder
   * @param strokes lists of stroke primitive point lists to iterate
   * @param isDisjoint if true add point string, else add polyline
   * @param fillColor
   */
  public addStrokePointLists(strokes: StrokesPrimitivePointLists, isDisjoint: boolean, fillColor: number): void {
    for (const strokePoints of strokes) {
      const { startDistance, points } = strokePoints;
      if (isDisjoint)
        this.addPointString(points, fillColor, startDistance);
      else
        this.addPolyline(points, fillColor, startDistance);
    }
  }

  /**
   * add data from polyface into mesh builder
   * @param polyface the indexed polyface to iterate the facets of in order to load each facet's triangles' vertices
   * @param props the properties required for this operation
   */
  public addFromPolyface(polyface: IndexedPolyface, props: MeshBuilder.PolyfaceOptions): void {
    const visitor = polyface.createVisitor();

    while (visitor.moveToNextFacet()) {
      this.addFromPolyfaceVisitor(visitor, props);
    }

    this.endPolyface();
  }

  /**
   * @param visitor the PolyfaceVisitor containing the face data to be added
   * @param props the properties required for this operation:
   */
  public addFromPolyfaceVisitor(visitor: PolyfaceVisitor, options: MeshBuilder.PolyfaceOptions): void {
    const { pointCount, normalCount, paramCount, requireNormals } = visitor;
    const { includeParams, mappedTexture } = options;

    const isDegenerate = requireNormals && normalCount < pointCount; // TFS#790263: Degenerate triangle - no normals.

    // a triangle must have at least 3 points
    if (pointCount < 3 || isDegenerate)
      return;

    const haveParam = includeParams && paramCount > 0;
    const triangleCount = pointCount - 2;

    assert(!includeParams || paramCount > 0);
    assert(!haveParam || undefined !== mappedTexture);

    const polyfaceVisitorOptions = { ...options, triangleCount, haveParam };
    // The face represented by this visitor should be convex (we request that in facet options) - so we do a simple fan triangulation.
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
      const triangle = this.createTriangle(triangleIndex, visitor, polyfaceVisitorOptions);
      if (undefined !== triangle)
        this.addTriangle(triangle);
    }
  }

  public createTriangleVertices(triangleIndex: number, visitor: PolyfaceVisitor, options: MeshBuilder.PolyfaceVisitorOptions): VertexKeyProps[] | undefined {
    const { point, requireNormals } = visitor;
    const { fillColor, haveParam } = options;
    const qPointParams = this.mesh.points.params;

    // If we do not have UVParams stored on the IndexedPolyface, compute them now
    let params: Point2d[] | undefined;
    if (haveParam && options.mappedTexture) {
      assert(this.mesh.points.length === 0 || this.mesh.uvParams.length !== 0);
      const mappedTexture = options.mappedTexture;
      const transformToImodel = mappedTexture.params.textureMatrix.transform;
      if (transformToImodel)
        params = mappedTexture.computeUVParams(visitor, transformToImodel);
      assert(params !== undefined);
    }

    const vertices = [];
    for (let i = 0; i < 3; ++i) {
      const vertexIndex = 0 === i ? 0 : triangleIndex + i;
      const position = QPoint3d.create(point.getPoint3dAt(vertexIndex), qPointParams);
      const normal = requireNormals ? OctEncodedNormal.fromVector(visitor.getNormal(vertexIndex)) : undefined;
      const uvParam: Point2d | undefined = params ? params[vertexIndex] : undefined;
      vertices[i] = { position, fillColor, normal, uvParam };
    }

    // Previously we would add all 3 vertices to our map, then detect degenerate triangles in AddTriangle().
    // This led to unused vertex data, and caused mismatch in # of vertices when recreating the MeshBuilder from the data in the tile cache.
    // Detect beforehand instead.
    if (vertices[0].position.equals(vertices[1].position) || vertices[0].position.equals(vertices[2].position) || vertices[1].position.equals(vertices[2].position))
      return undefined;

    return vertices;
  }

  public createTriangle(triangleIndex: number, visitor: PolyfaceVisitor, options: MeshBuilder.PolyfaceVisitorOptions): Triangle | undefined {
    // generate vertex key properties for each of the three sides of the triangle
    const vertices = this.createTriangleVertices(triangleIndex, visitor, options);

    // avoid creating degenerate triangles
    if (undefined === vertices)
      return undefined;

    const { edgeVisible } = visitor;

    const triangle = new Triangle();

    triangle.setEdgeVisibility(
      0 === triangleIndex ? edgeVisible[0] : false,
      edgeVisible[triangleIndex + 1],
      triangleIndex === options.triangleCount - 1 ? edgeVisible[triangleIndex + 2] : false,
    );

    // set each triangle index to the index associated with the vertex key location in the vertex map
    vertices.forEach((vertexProps: VertexKeyProps, i: number) => {
      const vertexKeyIndex = this.addVertex(vertexProps);

      triangle.indices[i] = vertexKeyIndex;

      // if the current polyface exists, map the vertex key index to the visitor's client point index
      if (this.currentPolyface !== undefined)
        this.currentPolyface.vertexIndexMap.set(vertexKeyIndex, visitor.clientPointIndex(i));
    });

    return triangle;
  }

  /** removed Feature for now */
  public addPolyline(pts: QPoint3dList | Point3d[], fillColor: number, startDistance: number): void {
    const { mesh } = this;

    const poly = new MeshPolyline(startDistance);
    const points = pts instanceof QPoint3dList ? pts : QPoint3dList.createFrom(pts, mesh.points.params);

    for (const position of points)
      poly.addIndex(this.addVertex({ position, fillColor }));

    mesh.addPolyline(poly);
  }

  /** removed Feature for now */
  public addPointString(pts: Point3d[], fillColor: number, startDistance: number): void {
    const { mesh } = this;

    // Assume no duplicate points in point strings (or, too few to matter).
    // Why? Because drawGridDots() potentially sends us tens of thousands of points (up to 83000 on my large monitor in top view), and wants to do so every frame.
    // The resultant map lookups/inserts/rebalancing kill performance in non-optimized builds.
    // NB: startDistance currently unused - Ray claims they will be used in future for non-cosmetic line styles? If not let's jettison them...
    const poly = new MeshPolyline(startDistance);
    const points = QPoint3dList.createFrom(pts, mesh.points.params);

    for (const position of points) {
      mesh.addVertex({ position, fillColor });
      poly.addIndex(this.addVertex({ position, fillColor }, false));
    }

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

  public addVertex(vertex: VertexKeyProps, addToMeshOnInsert = true): number {
    // if vertex key isn't duplicate, then also insert properties into mesh
    const onInsert = (vk: VertexKey) => this.mesh.addVertex(vk);
    return this.vertexMap.insertKey(vertex, addToMeshOnInsert ? onInsert : undefined);
  }

  public addTriangle(triangle: Triangle): void {
    // Prefer to avoid adding vertices originating from degenerate triangles before we get here...
    assert(!triangle.isDegenerate);

    const onInsert = (_vk: TriangleKey) => this.mesh.addTriangle(triangle);
    this.triangleSet.insertKey(triangle, onInsert);
  }
}

export namespace MeshBuilder {
  export interface Props extends Mesh.Props {
    tolerance: number;
    areaTolerance: number;
  }
  export interface PolyfaceOptions {
    includeParams: boolean;
    fillColor: number;
    mappedTexture?: TextureMapping;
  }
  export interface PolyfaceVisitorOptions extends PolyfaceOptions {
    triangleCount: number;
    haveParam: boolean;
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
