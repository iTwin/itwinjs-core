/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Uint16ArrayBuilder } from "@itwin/core-bentley";
import { Point2d, Point3d, Range1d, Vector3d } from "@itwin/core-geometry";
import { OctEncodedNormal } from "@itwin/core-common";
import {
  BingElevationProvider, GeographicTilingScheme, IModelApp, MapTilingScheme, QuadId, ReadMeshArgs, RealityMeshParams,
  RealityMeshParamsBuilder, RequestMeshDataArgs, TerrainMeshProvider, TerrainMeshProviderOptions, TerrainProvider,
} from "@itwin/core-frontend";

export class BingTerrainMeshProvider extends TerrainMeshProvider {
  private readonly _provider: BingElevationProvider;
  private readonly _exaggeration: number;
  private readonly _wantNormals: boolean;
  private readonly _wantSkirts: boolean;
  public readonly tilingScheme = new GeographicTilingScheme(1, 1);

  public constructor(options: TerrainMeshProviderOptions) {
    super();
    this._provider = new BingElevationProvider();
    this._exaggeration = options.exaggeration;
    this._wantNormals = options.wantNormals;
    this._wantSkirts = options.wantSkirts;
  }

  public override async requestMeshData(args: RequestMeshDataArgs): Promise<number[] | undefined> {
    const latLongRange = args.tile.quadId.getLatLongRange(this.tilingScheme);

    // Latitudes outside the range [-85, 85] produce HTTP 400 as specified by
    // [documentation](https://docs.microsoft.com/en-us/bingmaps/rest-services/elevations/get-elevations)
    latLongRange.low.y = Math.max(-85, latLongRange.low.y);
    latLongRange.high.y = Math.min(85, latLongRange.high.y);

    // Longitudes outside the range [0, 180) produce HTTP 500. Documentation makes no mention of this and if that's
    // a client error I'd expect 400, not 500.
    if (latLongRange.high.x >= 180)
      latLongRange.high.x = latLongRange.high.x - 180;

    const heights = await this._provider.getHeights(latLongRange);
    return heights?.length === 16 * 16 ? heights : undefined;
  }

  public override async readMesh(args: ReadMeshArgs): Promise<RealityMeshParams | undefined> {
    // ###TODO skirts.
    const heights = args.data as number[];
    const size = 16;
    assert(heights.length === size * size);

    const heightRange = Range1d.createArray(heights);
    heightRange.low *= this._exaggeration;
    heightRange.high *= this._exaggeration;
    args.tile.adjustHeights(heightRange.low, heightRange.high);

    const projection = args.tile.getProjection(heightRange);
    const sizeM1 = size - 1;
    const builder = new RealityMeshParamsBuilder({
      positionRange: projection.localRange,
      initialVertexCapacity: size * size,
      initialIndexCapacity: sizeM1 * sizeM1 * 3 * 2,
      // We will compute the normals after computing the positions.
      wantNormals: false,
    });

    const uv = new Point2d();
    const position = new Point3d();
    const delta = 1 / sizeM1;
    for (let row = 0, v = 0; row < size; row++, v += delta) {
      for (let col = 0, u = 0; col < size; col++, u += delta) {
        const height = heights[(sizeM1 - row) * size + col];
        projection.getPoint(u, 1 - v, height * this._exaggeration, position);
        uv.set(u, 1 - v);
        builder.addUnquantizedVertex(position, uv);
      }
    }

    if (this._wantNormals) {
      const scratchP1 = new Point3d();
      const scratchP2 = new Point3d();
      const scratchFaceNormal = new Vector3d();
      const addNormal = (sum: Vector3d, p0: Point3d, r1: number, c1: number, r2: number, c2: number): void => {
        if (r1 < 0 || c1 < 0 || r2 < 0 || c2 < 0 || r1 >= size || c1 >= size || r2 >= size || c2 >= size) {
          // To properly compute normals on the edges of the tile, requestMeshData would need to request additional elevations
          // for points adjacent to the tile. For now, just ignore them
          return;
        }

        const p1 = builder.positions.unquantize(r1 * size + c1, scratchP1);
        const p2 = builder.positions.unquantize(r2 * size + c2, scratchP2);

        const faceNormal = Vector3d.createCrossProductToPoints(p0, p1, p2, scratchFaceNormal);
        faceNormal.normalizeInPlace();

        sum.plus(faceNormal, sum);
        sum.normalizeInPlace();
      };

      builder.normals = new Uint16ArrayBuilder({ initialCapacity: builder.positions.length });
      const scratchP0 = new Point3d();
      const vertexNormal = Vector3d.createZero();
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          Vector3d.createZero(vertexNormal);
          const p0 = builder.positions.unquantize(row * size + col, scratchP0);
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

    assert(builder.positions.buffer.capacity === builder.positions.buffer.length);
    assert(builder.uvs.buffer.capacity === builder.uvs.buffer.length);
    assert(builder.normals?.capacity === builder.normals?.length);
    assert(builder.positions.length === builder.uvs.length);
    assert(undefined === builder.normals || builder.normals.length === builder.positions.length);
    assert(builder.indices.capacity === builder.indices.length);

    if (!this._wantSkirts)
      return builder.finish();

    // const skirtHeight = args.tile.range.xLength() / 20;
    // const skirtBaseIndex = builder.positions.length;
    // for (let u = 0; u < size; u++) {
    //   const h0 = heights[sizeM1 *1
    //   projection.getPoint(u, 1, 
    // }

    return builder.finish();
  }

  public override get maxDepth(): number {
    return 22;
  }
}
