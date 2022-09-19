/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { Point2d, Point3d, Range1d } from "@itwin/core-geometry";
import {
  BingElevationProvider, IModelApp, MapTilingScheme, QuadId, ReadMeshArgs, RealityMeshParams, RealityMeshParamsBuilder, RequestMeshDataArgs,
  TerrainMeshProvider, TerrainMeshProviderOptions, TerrainProvider, WebMercatorTilingScheme,
} from "@itwin/core-frontend";

export class BingTerrainMeshProvider extends TerrainMeshProvider {
  private readonly _provider: BingElevationProvider;
  private readonly _exaggeration: number;
  private readonly _wantNormals: boolean;
  public readonly tilingScheme = new WebMercatorTilingScheme();

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
    for (let row = 0; row < size; row++, uv.y += delta) {
      uv.x = 0;
      for (let col = 0; col < size; col++, uv.x += delta) {
        projection.getPoint(uv.x, uv.y, heights[(sizeM1 - row) * size + col], position);
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
