/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
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
    assert(undefined !== args);
    return undefined;
  }

  public override async readMesh(args: ReadMeshArgs): Promise<RealityMeshParams | undefined> {
    assert(undefined !== args);
    return undefined;
  }

  public override get maxDepth(): number {
    return 22;
  }
}
