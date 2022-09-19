/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { Point2d, Point3d, Range1d } from "@itwin/core-geometry";
import {
  BingElevationProvider, GeographicTilingScheme, IModelApp, MapTilingScheme, QuadId, ReadMeshArgs, RealityMeshParams,
  RealityMeshParamsBuilder, RequestMeshDataArgs, TerrainMeshProvider, TerrainMeshProviderOptions, TerrainProvider,
} from "@itwin/core-frontend";

export class BingTerrainMeshProvider extends TerrainMeshProvider {
  private readonly _provider: BingElevationProvider;
  private readonly _exaggeration: number;
  private readonly _wantNormals: boolean;
  public readonly tilingScheme = new GeographicTilingScheme();

  public constructor(options: TerrainMeshProviderOptions) {
    super();
    this._provider = new BingElevationProvider();
    this._exaggeration = options.exaggeration;
    this._wantNormals = options.wantNormals;
  }

  public override async requestMeshData(args: RequestMeshDataArgs): Promise<number[] | undefined> {
    const latLongRange = args.tile.quadId.getLatLongRange(this.tilingScheme);
    const heights = await this._provider.getHeights(latLongRange);
    return heights?.length === 16 * 16 ? heights : undefined;
  }

  public override async readMesh(args: ReadMeshArgs): Promise<RealityMeshParams | undefined> {
    // ###TODO normals, exaggeration, skirts.
    const heights = args.data as number[];
    const size = 16;
    assert(heights.length === size * size);

    const heightRange = Range1d.createArray(heights);
    const projection = args.tile.getProjection(heightRange);
    const sizeM1 = size - 1;
    const builder = new RealityMeshParamsBuilder({
      positionRange: projection.localRange,
      initialVertexCapacity: size * size,
      initialIndexCapacity: size * sizeM1 * 3 * 2,
    });

    const uv = new Point2d();
    const position = new Point3d();
    const delta = 1 / sizeM1;
    for (let row = 0, v = 0; row < size; row++, v += delta) {
      for (let col = 0, u = 0; col < size; col++, u += delta) {
        const height = heights[(sizeM1 - row) * size + col];
        projection.getPoint(u, 1 - v, height, position);
        uv.set(u, 1 - v);
        builder.addUnquantizedVertex(position, uv);
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

    return builder.finish();
  }

  public override get maxDepth(): number {
    return 22;
  }
}
