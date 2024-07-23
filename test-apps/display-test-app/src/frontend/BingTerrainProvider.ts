/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Uint16ArrayBuilder } from "@itwin/core-bentley";
import { Point2d, Point3d, Range1d, Vector3d } from "@itwin/core-geometry";
import { OctEncodedNormal } from "@itwin/core-common";
import {
  BingElevationProvider, GeographicTilingScheme, IModelApp, MapTileProjection, ReadMeshArgs, RealityMeshParams, RealityMeshParamsBuilder,
  RealityMeshParamsBuilderOptions, RequestMeshDataArgs, TerrainMeshProvider, TerrainMeshProviderOptions, TerrainProvider,
} from "@itwin/core-frontend";

// The number of elevation values per row/column within each tile.
const size = 16;
// The number of quads per row/column within each tile.
const sizeM1 = size - 1;

/** An example TerrainMeshProvider that obtains elevation data from [Bing](https://docs.microsoft.com/en-us/bingmaps/rest-services/elevations/get-elevations).
 * This example is not intended for production use. Its primary purpose is to present a clear example of how to implement a custom TerrainMeshProvider.
 * The code is written to favor readability over efficiency.
 * The 3d terrain produced is less accurate than that available from services like [Cesium World Terrain](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/).
 * This provider requires a valid Bing Maps API key to be supplied via `IModelAppOptions.mapLayerOptions.BingMaps` to `IModelApp.startup`.
 *
 * For each tile, the provider obtains a 16x16 equally-spaced grid of elevation values. Each group of four adjacent elevations is converted into pair
 * of triangles (a quad).
 */
export class BingTerrainMeshProvider extends TerrainMeshProvider {
  /** Provides elevation data. */
  private readonly _provider: BingElevationProvider; // eslint-disable-line deprecation/deprecation
  /** Scale factor applied to elevations, from `TerrainSettings.exaggeration`. */
  private readonly _exaggeration: number;
  /** If true, generate per-vertex normal vectors. */
  private readonly _wantNormals: boolean;
  /** If true, generate skirts around the edges of each tile. */
  private readonly _wantSkirts: boolean;
  public readonly tilingScheme = new GeographicTilingScheme(1, 1);

  public constructor(options: TerrainMeshProviderOptions) {
    super();
    this._provider = new BingElevationProvider(); // eslint-disable-line deprecation/deprecation
    this._exaggeration = options.exaggeration;
    this._wantNormals = options.wantNormals;
    this._wantSkirts = options.wantSkirts;
  }

  /** Return elevation values in a 16x16 grid. */
  public override async requestMeshData(args: RequestMeshDataArgs): Promise<number[] | undefined> {
    const latLongRange = args.tile.quadId.getLatLongRangeDegrees(this.tilingScheme);

    // Latitudes outside the range [-85, 85] produce HTTP 400 per the Bing API docs - clamp to that range.
    latLongRange.low.y = Math.max(-85, latLongRange.low.y);
    latLongRange.high.y = Math.min(85, latLongRange.high.y);

    // Longitudes outside the range [0, 180) produce HTTP 500. Bing API docs don't mention this, but it seems like
    // it would be a client error (400), not server error (500).
    // Wrap them.
    if (latLongRange.high.x >= 180)
      latLongRange.high.x = latLongRange.high.x - 360;

    const heights = await this._provider.getHeights(latLongRange);
    return heights?.length === 16 * 16 ? heights : undefined;
  }

  /** Produce a 3d terrain mesh from the elevation values obtained by `requestMeshData`. */
  public override async readMesh(args: ReadMeshArgs): Promise<RealityMeshParams | undefined> {
    const heights = args.data as number[];
    assert(heights.length === size * size);

    // Make skirts 1/20th the width of the tile.
    const skirtHeight = this._wantSkirts ? args.tile.range.xLength() / 20 : 0;

    // Determine the minimum and maximum height values, scaled by the terrain exaggeration factor.
    const heightRange = Range1d.createArray(heights);
    heightRange.low -= skirtHeight;
    heightRange.low *= this._exaggeration;
    heightRange.high *= this._exaggeration;

    // Update the height range stored on the MapTile.
    args.tile.adjustHeights(heightRange.low, heightRange.high);

    // Skirts add 16 new vertices along each edge.
    const numSkirtVertices = this._wantSkirts ? size * 4 : 0;
    // Skirts add 15 new quads along each edge.
    const numSkirtIndices = this._wantSkirts ? sizeM1 * sizeM1 * 4 * 3 * 2 : 0;

    // Given a 2d point in tile coordinates and an elevation, the projection can produce a 3d point in space.
    const projection = args.tile.getProjection(heightRange);

    // Options for creating the terrain mesh.
    const initialVertexCapacity = size * size + numSkirtVertices;
    const options: RealityMeshParamsBuilderOptions = {
      // A range encompassing all possible 3d points in the mesh.
      positionRange: projection.localRange,
      // The exact number of vertices we will need - preallocated to avoid reallocating as we populate the array.
      initialVertexCapacity,
      // The exact number of vertex indices we will need - preallocated to avoid reallocating as we populate the array.
      initialIndexCapacity: sizeM1 * sizeM1 * 3 * 2 + numSkirtIndices,
      // We will compute the normals after computing the positions, if needed.
      wantNormals: false,
    };

    const builder = new RealityMeshParamsBuilder(options);

    // Holds the texture coordinates for the current vertex.
    const uv = new Point2d();
    // Holds the 3d position of the current vertex.
    const position = new Point3d();

    // For each elevation in the grid, add a vertex to the builder.
    const delta = 1 / sizeM1;
    for (let row = 0, v = 0; row < size; row++, v += delta) {
      for (let col = 0, u = 0; col < size; col++, u += delta) {
        const height = heights[(sizeM1 - row) * size + col];
        projection.getPoint(u, 1 - v, height * this._exaggeration, position);
        uv.set(u, 1 - v);
        builder.addUnquantizedVertex(position, uv);
      }
    }

    if (this._wantNormals)
      this.addNormals(builder, initialVertexCapacity);

    // Define the triangles for each quad.
    for (let row = 0; row < sizeM1; row++) {
      const rowIndex = row * size;
      const nextRowIndex = rowIndex + size;
      for (let col = 0; col < sizeM1; col++) {
        const q0 = rowIndex + col;
        const q1 = q0 + 1;
        const q3 = nextRowIndex + col;
        const q2 = q3 + 1;

        builder.addTriangle(q0, q1, q2);
        builder.addTriangle(q0, q2, q3);
      }
    }

    if (this._wantSkirts)
      this.addSkirts(builder, heights, skirtHeight, projection);

    assert(builder.positions.length === options.initialVertexCapacity);
    assert(builder.uvs.length === options.initialVertexCapacity);
    assert(undefined === builder.normals || builder.normals.capacity === options.initialVertexCapacity);
    assert(builder.positions.length === builder.uvs.length);
    assert(undefined === builder.normals || builder.normals.length === builder.positions.length);
    assert(builder.indices.capacity === options.initialIndexCapacity);

    // Extract the completed 3d mesh.
    return builder.finish();
  }

  // Compute a normal vector for each vertex.
  private addNormals(builder: RealityMeshParamsBuilder, numVertices: number): void {
    const scratchP0 = new Point3d();
    const scratchP1 = new Point3d();
    const scratchP2 = new Point3d();
    const scratchFaceNormal = new Vector3d();

    // Compute the vector perpendicular to one triangle, and add it to the accumulated vertex normal.
    // sum: The accumulated vertex normal thus far.
    // p0: The position of the vertex whose normal vector is being computed.
    // r1, c1: The (x, y) offset of the second triangle vertex, relative to p0 - either 0, -1, or 1.
    // r2, c2: The (x, y) offset of the third triangle vertex, relative to p0 - either 0, -1, or 1.
    const addNormal = (sum: Vector3d, p0: Point3d, r1: number, c1: number, r2: number, c2: number): void => {
      if (r1 < 0 || c1 < 0 || r2 < 0 || c2 < 0 || r1 >= size || c1 >= size || r2 >= size || c2 >= size) {
        // At least one of the adjacent points is outside the boundaries of the tile. We have no elevation data for points outside the tile.
        // Note: to properly compute normals for vertices on the edges of the tile, requestMeshData would need to request additional elevations
        // for points adjacent to the tile. For simplicity, we simply ignore their contribution to the vertex normal.
        return;
      }

      // Look up the positions of the other two triangle vertices.
      const p1 = builder.positions.unquantize(r1 * size + c1, scratchP1);
      const p2 = builder.positions.unquantize(r2 * size + c2, scratchP2);

      // Compute the normalized vector perpendicular to the triangle.
      const faceNormal = Vector3d.createCrossProductToPoints(p0, p1, p2, scratchFaceNormal);
      faceNormal.normalizeInPlace();

      // Add this triangle's normal vector to the vertex normal.
      sum.plus(faceNormal, sum);
      sum.normalizeInPlace();
    };

    // Allocate all of the normal vectors we need.
    builder.normals = new Uint16ArrayBuilder({ initialCapacity: numVertices });

    // Compute the normal vector for each vertex in the mesh.
    const vertexNormal = Vector3d.createZero();
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        Vector3d.createZero(vertexNormal);
        const p0 = builder.positions.unquantize(row * size + col, scratchP0);
        // This could be made more efficient with a loop that retains the output of the previous iteration,
        // but less readable.
        addNormal(vertexNormal, p0, row+0, col+1, row+1, col+1);
        addNormal(vertexNormal, p0, row+1, col+1, row+1, col+0);
        addNormal(vertexNormal, p0, row+1, col+0, row+1, col-1);
        addNormal(vertexNormal, p0, row+1, col-1, row+0, col-1);
        addNormal(vertexNormal, p0, row+0, col-1, row-1, col-1);
        addNormal(vertexNormal, p0, row-1, col-1, row-1, col+0);
        addNormal(vertexNormal, p0, row-1, col+0, row-1, col+1);
        addNormal(vertexNormal, p0, row-1, col+1, row+0, col+1);

        vertexNormal.normalizeInPlace();
        builder.normals.push(OctEncodedNormal.encode(vertexNormal));
      }
    }
  }

  // Generate "skirts" around the edge of the mesh, hanging straight down from the existing triangles.
  // Note: if we angled the skirts outward slightly, they would do a better job of hiding seams, particularly when
  // looking directly down at the map.
  private addSkirts(builder: RealityMeshParamsBuilder, heights: number[], skirtHeight: number, projection: MapTileProjection): void {
    // The normal vector for the skirt vertices does not matter - use a zero vector.
    const skirtNormal = this._wantNormals ? new Vector3d() : undefined;
    const uv = new Point2d();
    const position = new Point3d();
    const delta = 1 / sizeM1;

    for (let c = 0; c < size; c++) {
      // top row
      let height = heights[sizeM1 * size + c];
      const u = c * delta;
      projection.getPoint(u, 1, (height - skirtHeight) * this._exaggeration, position);
      uv.set(u, 1);
      const topIndex = builder.addUnquantizedVertex(position, uv, skirtNormal);

      // bottom row
      height = heights[c];
      projection.getPoint(u, 0, (height - skirtHeight) * this._exaggeration, position);
      uv.set(u, 0);
      const bottomIndex = builder.addUnquantizedVertex(position, uv, skirtNormal);

      // left side
      height = heights[(sizeM1 - c) * size];
      projection.getPoint(0, 1 - u, (height - skirtHeight) * this._exaggeration, position);
      uv.set(0, 1 - u);
      const leftIndex = builder.addUnquantizedVertex(position, uv, skirtNormal);

      // right side
      height = heights[(sizeM1 - c) * size + sizeM1];
      projection.getPoint(1, 1 - u, (height - skirtHeight) * this._exaggeration, position);
      uv.set(1, 1 - u);
      const rightIndex = builder.addUnquantizedVertex(position, uv, skirtNormal);

      if (c === sizeM1) {
        // We have added all 16 vertices and all 15 quads along each edge
        break;
      }

      // top row
      builder.addTriangle(c, c + 1, topIndex + 4);
      builder.addTriangle(c, topIndex + 4, topIndex);

      // bottom row
      const row = size * sizeM1;
      builder.addTriangle(row + c, row + c + 1, bottomIndex + 4);
      builder.addTriangle(row + c, bottomIndex + 4, bottomIndex);

      // left side
      const left = c * size;
      builder.addTriangle(left, left + size, leftIndex + 4);
      builder.addTriangle(left, leftIndex + 4, leftIndex);

      // right side
      const right = c * size + sizeM1;
      builder.addTriangle(right, right +size, rightIndex + 4);
      builder.addTriangle(right, rightIndex + 4, rightIndex);
    }
  }

  public override get maxDepth(): number {
    return 22;
  }

  // Register the terrain provider, just after calling `IModelApp.startup`
  public static register(): void {
    // The name of our provider. It must be unique! It will be stored in `TerrainSettings.providerName`.
    const providerName = "DtaBingTerrain";

    // Our provider.
    const provider: TerrainProvider = {
      createTerrainMeshProvider: async (options: TerrainMeshProviderOptions) => {
        return Promise.resolve(new BingTerrainMeshProvider(options));
      },
    };

    IModelApp.terrainProviderRegistry.register(providerName, provider);
  }
}
