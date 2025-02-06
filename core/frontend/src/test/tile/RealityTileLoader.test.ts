/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization } from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { createBlankConnection } from "../createBlankConnection";
import { RealityDataSource, RealityDataSourceTilesetUrlImpl, RealityModelTileLoader, RealityModelTileTreeProps } from "../../core-frontend";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Transform } from "@itwin/core-geometry";

describe("RealityTileLoader", () => {
  let iModel: IModelConnection;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    iModel = createBlankConnection();
  });

  afterAll(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  async function createLoader(): Promise<RealityModelTileLoader | undefined> {
    const json =
`{
  "asset": {
    "version": "1.1",
    "tilesetVersion": "triangle-mesh.0.1.0"
  },
  "geometricError": 1024.0,
  "root": {
    "boundingVolume": {
      "box": [
        -1638597.0860943792,
        -3669234.9374902933,
        4937950.053559612,
        82.73920249938965,
        0.0,
        0.0,
        0.0,
        57.6266975402832,
        0.0,
        0.0,
        0.0,
        77.02031707763672
      ]
    },
    "geometricError": 512.0,
    "children": [
      {
        "boundingVolume": {
          "box": [
            -1638597.0860943792,
            -3669234.9374902933,
            4937950.053559612,
            82.73920249938965,
            0.0,
            0.0,
            0.0,
            57.6266975402832,
            0.0,
            0.0,
            0.0,
            77.02031707763672
          ]
        },
        "geometricError": 0.0,
        "content": {
          "uri": "tile_0.gltf"
        }
      }
    ]
  }
}`;
    const root = JSON.parse(json);

    const tilesetUrl = "c:\\customserver\\myFile.json";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    const rdSource = await RealityDataSourceTilesetUrlImpl.createFromKey(rdSourceKey, iModel.iTwinId);
    if (undefined === rdSource)
      return undefined;

    const transform = Transform.identity;
    const props = new RealityModelTileTreeProps(root, root, rdSource, transform);

    return new RealityModelTileLoader(props);
  }

  it("test", async () => {
    const loader = await createLoader();
    console.log(loader);

    expect(loader).toBeDefined();
  });
});