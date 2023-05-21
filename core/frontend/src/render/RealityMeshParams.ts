/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, Uint16ArrayBuilder, UintArray, UintArrayBuilder } from "@itwin/core-bentley";
import {
  IndexedPolyface, Point2d, Point3d, Polyface, Range2d, Range3d, Transform, Vector3d, XAndY, XYAndZ,
} from "@itwin/core-geometry";
import {
  OctEncodedNormal, QPoint2d, QPoint2dBuffer, QPoint2dBufferBuilder, QPoint3d, QPoint3dBuffer, QPoint3dBufferBuilder, RenderTexture,
} from "@itwin/core-common";
import { GltfMeshData } from "../tile/internal";
import { MeshPrimitiveType } from "../common/render/primitives/MeshPrimitive";

function precondition(condition: boolean, message: string | (() => string)): asserts condition {
  if (condition)
    return;

  if ("string" !== typeof message)
    message = message();

  throw new Error(`Logic Error: ${message}`);
}

/** Geometry for a reality mesh to be submitted to the [[RenderSystem]] for conversion to a [[RenderGraphic]].
 * A reality mesh is a simple triangle mesh to which a [RenderTexture]($common) image can be mapped. Sources of reality meshes
 * include [[TerrainMeshProvider]]s to which background map imagery is applied, and [ContextRealityModel]($common)s captured using
 * [photogrammetry](https://en.wikipedia.org/wiki/Photogrammetry).
 * @see [[RealityMeshParamsBuilder]] to incrementally construct a `RealityMeshParams`.
 * @public
 */
export interface RealityMeshParams {
  /** The 3d position of each vertex in the mesh, indexed by [[indices]]. */
  positions: QPoint3dBuffer;
  /** The 2d texture coordinates of each vertex in the mesh, indexed by [[indices]]. */
  uvs: QPoint2dBuffer;
  /** The optional normal vector for each vertex in the mesh, indexed by [[indices]], stored as [OctEncodedNormal]($common)s. */
  normals?: Uint16Array;
  /** The integer indices of each triangle in the mesh. The array's length must be a multiple of 3. */
  indices: UintArray;
  /** @alpha unused by terrain meshes */
  featureID?: number; // default 0
  /** @alpha unused by terrain meshes */
  texture?: RenderTexture;
}

/** @public */
export namespace RealityMeshParams {
  /** @internal */
  export function fromGltfMesh(mesh: GltfMeshData): RealityMeshParams | undefined {
    // The specialized reality mesh shaders expect a mesh with uvs and no edges.
    if (mesh.primitive.type !== MeshPrimitiveType.Mesh || mesh.primitive.edges || !mesh.pointQParams || !mesh.uvQParams || !mesh.points || !mesh.uvs || !mesh.indices)
      return undefined;

    return {
      indices: mesh.indices,
      positions: {
        params: mesh.pointQParams,
        points: mesh.points,
      },
      uvs: {
        params: mesh.uvQParams,
        points: mesh.uvs,
      },
      normals: mesh.normals,
      // featureID: 0,
      texture: mesh.primitive.displayParams.textureMapping?.texture,
    };
  }

  /** @alpha */
  export function toPolyface(params: RealityMeshParams, options?: { transform?: Transform, wantNormals?: boolean, wantParams?: boolean }): Polyface | undefined {
    const { positions, normals, uvs, indices } = params;
    const includeNormals = options?.wantNormals && undefined !== normals;
    const includeParams = options?.wantParams;

    const polyface = IndexedPolyface.create(includeNormals, includeParams);
    const points = positions.points;
    const point = new Point3d();
    const transform = options?.transform;
    for (let i = 0; i < positions.points.length; i += 3) {
      positions.params.unquantize(points[i], points[i + 1], points[i + 2], point);
      transform?.multiplyPoint3d(point, point);
      polyface.addPoint(point);
    }

    if (includeNormals) {
      const normal = new Vector3d();
      for (const oen of normals)
        polyface.addNormal(OctEncodedNormal.decodeValue(oen, normal));
    }

    if (includeParams) {
      const uv = new Point2d();
      for (let i = 0; i < uvs.points.length; i += 2)
        polyface.addParam(uvs.params.unquantize(uvs.points[i], uvs.points[i + 1], uv));
    }

    let j = 0;
    indices.forEach((index: number) => {
      polyface.addPointIndex(index);
      if (includeNormals)
        polyface.addNormalIndex(index);

      if (includeParams)
        polyface.addParamIndex(index);

      if (0 === (++j % 3))
        polyface.terminateFacet();
    });

    return polyface;
  }
}

/** Options used to construct a [[RealityMeshParamsBuilder]].
 * @beta
 */
export interface RealityMeshParamsBuilderOptions {
  /** A bounding box fully containing the positions of all vertices to be included in the mesh.
   * This range is used to quantize [[RealityMeshParams.positions]].
   */
  positionRange: Range3d;
  /** A range fully containing the texture coordinates of all vertices to be included in the mesh.
   * This range is used to quantize [[RealityMeshParams.uvs]].
   * Default: [0.0, 1.0].
   */
  uvRange?: Range2d;
  /** If true, [[RealityMeshParams.normals]] will be populated.
   * If you set this to true, you must supply a normal for every vertex when calling [[RealityMeshParamsBuilder.addQuantizedVertex]] or [[RealityMeshParamsBuilder.addUnquantizedVertex]].
   */
  wantNormals?: boolean;
  /** If defined, memory for this number of vertices will be allocated up-front. Set this if you know the minimum number of vertices in the mesh, to
   * avoid unnecessary reallocations when adding vertices.
   */
  initialVertexCapacity?: number;
  /** If defined, memory for this number of indices will be allocated up-front. Set this if you know the minimum number of triangles in the mesh, to avoid
   * unnecessary reallocations when adding triangles. The number of indices is equal to three times the number of triangles.
   */
  initialIndexCapacity?: number;
}

/** Incrementally constructs a [[RealityMeshParams]].
 * The following simple example produces a rectangular mesh containing two triangles.
 * ```ts
 * [[include:Build_Reality_Mesh_Params]]
 * ```
 * @beta
 */
export class RealityMeshParamsBuilder {
  /** The indices of the vertices in each triangle of the mesh.
   * @see [[addTriangle]] to add 3 indices describing a single triangle.
   * @see [[addQuad]] to add 4 indices describing two triangles sharing an edge.
   * @see [[addIndices]] to add any number of indices.
   */
  public readonly indices: UintArrayBuilder;
  /** The 3d position of each vertex in the mesh.
   * @see [[addQuantizedVertex]] and [[addUnquantizedVertex]] to add a vertex.
   */
  public readonly positions: QPoint3dBufferBuilder;
  /** The 2d texture coordinates of each vertex in the mesh.
   * @see [[addQuantizedVertex]] and [[addUnquantizedVertex]] to add a vertex.
   */
  public readonly uvs: QPoint2dBufferBuilder;
  /** The normal vector of each vertex in the mesh, or `undefined` if [[RealityMeshParamsBuilderOptions.wantNormals]] was not `true` when constructing the builder.
   * A normal vector must be supplied to [[addQuantizedVertex]] and [[addUnquantizedVertex]] if and only if [[RealityMeshParamsBuilderOptions.wantNormals]] was
   * specified as `true`.
   * The vectors are stored as [OctEncodedNormal]($common)s.
   */
  public normals?: Uint16ArrayBuilder;

  // Scratch variables
  private readonly _q3d = new QPoint3d();
  private readonly _q2d = new QPoint2d();

  /** Construct a builder from the specified options. */
  public constructor(options: RealityMeshParamsBuilderOptions) {
    let initialType;
    if (undefined !== options.initialVertexCapacity && options.initialVertexCapacity > 0xff)
      initialType = options.initialVertexCapacity > 0xffff ? Uint32Array : Uint16Array;

    this.indices = new UintArrayBuilder({
      initialCapacity: options.initialIndexCapacity,
      initialType,
    });

    if (options.wantNormals)
      this.normals = new Uint16ArrayBuilder({ initialCapacity: options.initialVertexCapacity });

    this.positions = new QPoint3dBufferBuilder({
      range: options.positionRange,
      initialCapacity: options.initialVertexCapacity,
    });

    this.uvs = new QPoint2dBufferBuilder({
      range: options.uvRange ?? new Range2d(0, 0, 1, 1),
      initialCapacity: options.initialVertexCapacity,
    });
  }

  /** Add a vertex to the mesh and return its index in [[positions]].
   * @param position The 3d position, which will be quantized to the [[RealityMeshParamsBuilderOptions.positionRange]] supplied to the builder's constructor.
   * @param uv The texture coordinates, which will be quantized to the [[RealityMeshParamsBuilderOptions.uvRange]] supplied to the builder's constructor.
   * @param the normal vector, to be supplied if and only if [[RealityMeshParamsBuilderOptions.wantNormals]] was `true` when the builder was constructed.
   * @see [[addQuantizedVertex]] if your vertex data is already quantized.
   * @returns the index of the new vertex in [[positions]].
   */
  public addUnquantizedVertex(position: XYAndZ, uv: XAndY, normal?: XYAndZ): number {
    this._q3d.init(position, this.positions.params);
    this._q2d.init(uv, this.uvs.params);
    const oen = normal ? OctEncodedNormal.encode(normal) : undefined;
    return this.addQuantizedVertex(this._q3d, this._q2d, oen);
  }

  /** Original API had weird mix of quantized and unquantized, used by CesiumTerrainProvider.
   * @internal
   */
  public addVertex(position: XYAndZ, uv: XAndY, normal?: number): void {
    this._q3d.init(position, this.positions.params);
    this.addQuantizedVertex(this._q3d, uv, normal);
  }

  /** Add a vertex to the mesh and return its index in [[positions]].
   * @param position The 3d position, quantized to the [[RealityMeshParamsBuilderOptions.positionRange]] supplied to the builder's constructor.
   * @param uv The texture coordinates, quantized to the [[RealityMeshParamsBuilderOptions.uvRange]] supplied to the builder's constructor.
   * @param normal The unsigned 16-bit [OctEncodedNormal]($common) integer representation of the normal vector, to be supplied if and only if
   * [[RealityMeshParamsBuilderOptions.wantNormals]] was `true` when the builder was constructed.
   * @see [[addUnquantizedVertex]] if your vertex data is not already quantized.
   * @returns the index of the new vertex in [[positions]].
   * @throws Error if `normal` is `undefined` but `wantNormals` was specified at construction of the builder, or vice-versa.
   */
  public addQuantizedVertex(position: XYAndZ, uv: XAndY, normal?: number): number {
    precondition((undefined === normal) === (undefined === this.normals), "RealityMeshParams requires all vertices to have normals, or none.");

    this.positions.push(position);
    this.uvs.push(uv);
    if (undefined !== normal) {
      assert(undefined !== this.normals);
      this.normals.push(normal);
    }

    return this.positions.length - 1;
  }

  /** Add a triangle corresponding to the three specified vertices. */
  public addTriangle(i0: number, i1: number, i2: number): void {
    this.addIndex(i0);
    this.addIndex(i1);
    this.addIndex(i2);
  }

  /** Add two triangles sharing an edge. This is equivalent to calling `addTriangle(i0, i1, i2); addTriangle(i1, i3, i2);`. */
  public addQuad(i0: number, i1: number, i2: number, i3: number): void {
    this.addTriangle(i0, i1, i2);
    this.addTriangle(i1, i3, i2);
  }

  /** Add all of the indices in `indices` to the index buffer. */
  public addIndices(indices: Iterable<number>): void {
    for (const index of indices)
      this.addIndex(index);
  }

  private addIndex(index: number): void {
    this.indices.push(index);
  }

  /** Extract the finished [[RealityMeshParams]].
   * @throws Error if the mesh contains no triangles.
   */
  public finish(): RealityMeshParams {
    precondition(this.positions.length >= 3 && this.indices.length >= 3, "RealityMeshParams requires at least one triangle");
    return {
      positions: this.positions.finish(),
      uvs: this.uvs.finish(),
      normals: this.normals?.toTypedArray(),
      indices: this.indices.toTypedArray(),
    };
  }
}
