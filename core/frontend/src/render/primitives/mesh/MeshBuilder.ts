/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, Dictionary } from "@itwin/core-bentley";
import type { IndexedPolyface, Point2d, Polyface, PolyfaceVisitor, Range3d} from "@itwin/core-geometry";
import { Angle, Point3d, Vector3d } from "@itwin/core-geometry";
import type { TextureMapping } from "@itwin/core-common";
import { MeshEdge, MeshEdges, MeshPolyline, OctEncodedNormal, OctEncodedNormalPair, QPoint3d, QPoint3dList } from "@itwin/core-common";
import type { DisplayParams } from "../DisplayParams";
import type { TriangleKey} from "../Primitives";
import { Triangle, TriangleSet } from "../Primitives";
import type { StrokesPrimitivePointLists } from "../Strokes";
import type { VertexKey, VertexKeyProps} from "../VertexKey";
import { VertexMap } from "../VertexKey";
import { Mesh } from "./MeshPrimitives";

// Describes a vertex along with the index of the source vertex in the source PolyfaceVisitor.
type VertexKeyPropsWithIndex = VertexKeyProps & { sourceIndex: number };

/** @internal */
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
      if (isDisjoint)
        this.addPointString(strokePoints.points, fillColor);
      else
        this.addPolyline(strokePoints.points, fillColor);
    }
  }

  /**
   * add data from polyface into mesh builder
   * @param polyface the indexed polyface to iterate the facets of to load each facet's triangles' vertices
   * @param props the properties required for this operation
   */
  public addFromPolyface(polyface: IndexedPolyface, props: MeshBuilder.PolyfaceOptions): void {
    this.beginPolyface(polyface, props.edgeOptions);
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

    // The face represented by this visitor should be convex (we request that in facet options) - so we do a simple fan triangulation.
    const polyfaceVisitorOptions = { ...options, triangleCount, haveParam };
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
      const triangle = this.createTriangle(triangleIndex, visitor, polyfaceVisitorOptions);
      if (undefined !== triangle)
        this.addTriangle(triangle);
    }
  }

  public createTriangleVertices(triangleIndex: number, visitor: PolyfaceVisitor, options: MeshBuilder.PolyfaceVisitorOptions): VertexKeyPropsWithIndex[] | undefined {
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
      const position = QPoint3d.create(point.getPoint3dAtUncheckedPointIndex(vertexIndex), qPointParams);
      const normal = requireNormals ? OctEncodedNormal.fromVector(visitor.getNormal(vertexIndex)!) : undefined;
      const uvParam: Point2d | undefined = params ? params[vertexIndex] : undefined;
      vertices[i] = { position, fillColor, normal, uvParam, sourceIndex: vertexIndex };
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
    vertices.forEach((vertexProps, i: number) => {
      let vertexKeyIndex;
      if (visitor.auxData) {
        // No deduplication with auxData (for now...)
        vertexKeyIndex = this.mesh.addVertex(vertexProps);
        this.mesh.addAuxChannels(visitor.auxData.channels, vertexProps.sourceIndex);
      } else {
        vertexKeyIndex = this.addVertex(vertexProps);
      }

      triangle.indices[i] = vertexKeyIndex;

      // if the current polyface exists, map the vertex key index to the visitor's client point index
      if (this.currentPolyface !== undefined)
        this.currentPolyface.vertexIndexMap.set(vertexKeyIndex, visitor.clientPointIndex(vertexProps.sourceIndex));
    });

    return triangle;
  }

  /** removed Feature for now */
  public addPolyline(pts: QPoint3dList | Point3d[], fillColor: number): void {
    const { mesh } = this;

    const poly = new MeshPolyline();
    const points = pts instanceof QPoint3dList ? pts : QPoint3dList.createFrom(pts, mesh.points.params);

    for (const position of points)
      poly.addIndex(this.addVertex({ position, fillColor }));

    mesh.addPolyline(poly);
  }

  /** removed Feature for now */
  public addPointString(pts: Point3d[], fillColor: number): void {
    const { mesh } = this;
    const poly = new MeshPolyline();
    const points = QPoint3dList.createFrom(pts, mesh.points.params);

    for (const position of points)
      poly.addIndex(this.addVertex({ position, fillColor }));

    mesh.addPolyline(poly);
  }

  public beginPolyface(polyface: Polyface, options: MeshEdgeCreationOptions): void {
    if (!options.generateNoEdges) {
      const triangles = this.mesh.triangles;
      this._currentPolyface = new MeshBuilderPolyface(polyface, options, triangles === undefined ? 0 : triangles.length);
    }
  }

  public endPolyface(): void {
    const { currentPolyface, mesh } = this;
    if (undefined === currentPolyface)
      return;

    this._currentPolyface = undefined;
    buildMeshEdges(mesh, currentPolyface);
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

/** @internal */
export namespace MeshBuilder { // eslint-disable-line no-redeclare
  export interface Props extends Mesh.Props {
    tolerance: number;
    areaTolerance: number;
  }
  export interface PolyfaceOptions {
    includeParams: boolean;
    fillColor: number;
    mappedTexture?: TextureMapping;
    edgeOptions: MeshEdgeCreationOptions;
  }

  export interface PolyfaceVisitorOptions extends PolyfaceOptions {
    triangleCount: number;
    haveParam: boolean;
  }
}

/** @internal */
export class MeshEdgeCreationOptions {
  public readonly type: MeshEdgeCreationOptions.Type;
  public readonly minCreaseAngle = 20.0 * Angle.radiansPerDegree;
  public get generateAllEdges(): boolean { return this.type === MeshEdgeCreationOptions.Type.AllEdges; }
  public get generateNoEdges(): boolean { return this.type === MeshEdgeCreationOptions.Type.NoEdges; }
  public get generateCreaseEdges(): boolean { return 0 !== (this.type & MeshEdgeCreationOptions.Type.CreaseEdges); }
  /** Create edge chains for polyfaces that do not already have them. */
  public get createEdgeChains(): boolean { return 0 !== (this.type & MeshEdgeCreationOptions.Type.CreateChains); }
  constructor(type = MeshEdgeCreationOptions.Type.NoEdges) { this.type = type; }
}

/** @internal */
export namespace MeshEdgeCreationOptions { // eslint-disable-line no-redeclare
  export enum Type {
    NoEdges = 0x0000,
    CreaseEdges = 0x0001 << 1,
    SmoothEdges = 0x0001 << 2,
    CreateChains = 0x0001 << 3,
    DefaultEdges = CreaseEdges,
    AllEdges = CreaseEdges | SmoothEdges,
  }
}

/** @internal */
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

class EdgeInfo {
  public faceIndex1?: number;

  public constructor(
    public visible: boolean,
    public faceIndex0: number,
    public edge: MeshEdge,
    public point0: Point3d,
    public point1: Point3d) {
  }

  public addFace(visible: boolean, faceIndex: number) {
    if (undefined === this.faceIndex1) {
      this.visible ||= visible;
      this.faceIndex1 = faceIndex;
    }
  }
}

function buildMeshEdges(mesh: Mesh, polyface: MeshBuilderPolyface): void {
  if (!mesh.triangles)
    return;

  const edgeMap = new Dictionary<MeshEdge, EdgeInfo>((lhs, rhs) => lhs.compareTo(rhs));
  const triangleNormals: Vector3d[] = [];

  // We need to detect the edge pairs -- Can't do that from the Mesh indices as these are not shared - so we'll
  // assume that the polyface indices are properly shared, this should be true as a seperate index array is used
  // for Polyfaces.
  const triangle = new Triangle();
  const polyfacePoints = [new Point3d(), new Point3d(), new Point3d()];
  const polyfaceIndices = [0, 0, 0];

  for (let triangleIndex = polyface.baseTriangleIndex; triangleIndex < mesh.triangles.length; triangleIndex++) {
    let indexNotFound = false;
    mesh.triangles.getTriangle(triangleIndex, triangle);
    for (let j = 0; j < 3; j++) {
      const foundPolyfaceIndex = polyface.vertexIndexMap.get(triangle.indices[j]);
      assert(undefined !== foundPolyfaceIndex);
      if (undefined === foundPolyfaceIndex) {
        indexNotFound = true;
        continue;
      }

      polyfaceIndices[j] = foundPolyfaceIndex;
      polyface.polyface.data.getPoint(foundPolyfaceIndex, polyfacePoints[j]);
    }

    if (indexNotFound)
      continue;

    for (let j = 0; j < 3; j++) {
      const jNext = (j + 1) % 3;
      const triangleNormalIndex = triangleNormals.length;
      const meshEdge = new MeshEdge(triangle.indices[j], triangle.indices[jNext]);
      const polyfaceEdge = new MeshEdge(polyfaceIndices[j], polyfaceIndices[jNext]);
      const edgeInfo = new EdgeInfo(triangle.isEdgeVisible(j), triangleNormalIndex, meshEdge, polyfacePoints[j], polyfacePoints[jNext]);

      const findOrInsert = edgeMap.findOrInsert(polyfaceEdge, edgeInfo);
      if (!findOrInsert.inserted)
        findOrInsert.value.addFace(edgeInfo.visible, triangleNormalIndex);
    }

    const normal = Vector3d.createCrossProductToPoints(polyfacePoints[0], polyfacePoints[1], polyfacePoints[2]);
    normal.normalizeInPlace();
    triangleNormals.push(normal);
  }

  // If there is no visibility indication in the mesh, infer from the mesh geometry.
  if (!polyface.edgeOptions.generateAllEdges) {
    const minEdgeDot = Math.cos(polyface.edgeOptions.minCreaseAngle);
    for (const edgeInfo of edgeMap.values()) {
      if (undefined !== edgeInfo.faceIndex1) {
        const normal0 = triangleNormals[edgeInfo.faceIndex0];
        const normal1 = triangleNormals[edgeInfo.faceIndex1];
        if (Math.abs(normal0.dotProduct(normal1)) > minEdgeDot)
          edgeInfo.visible = false;
      }
    }
  }

  // Now populate the MeshEdges.
  // ###TODO edge chains?
  if (undefined === mesh.edges)
    mesh.edges = new MeshEdges();

  const maxPlanarDot = 0.999999;
  for (const edgeInfo of edgeMap.values()) {
    if (edgeInfo.visible) {
      mesh.edges.visible.push(edgeInfo.edge);
    } else if (undefined !== edgeInfo.faceIndex1) {
      const normal0 = triangleNormals[edgeInfo.faceIndex0];
      const normal1 = triangleNormals[edgeInfo.faceIndex1];
      if (Math.abs(normal0.dotProduct(normal1)) < maxPlanarDot) {
        mesh.edges.silhouette.push(edgeInfo.edge);
        mesh.edges.silhouetteNormals.push(new OctEncodedNormalPair(OctEncodedNormal.fromVector(normal0), OctEncodedNormal.fromVector(normal1)));
      }
    }
  }
}
