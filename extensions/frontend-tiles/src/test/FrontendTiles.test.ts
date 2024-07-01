/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { FrontendTilesOptions, initializeFrontendTiles } from "../FrontendTiles";
import { frontendTilesOptions } from "../graphics-provider/tileset-creators/IModelTileset";

describe("FrontendTiles", () => {
  it("should initialize frontend tiles with default values", () => {
    initializeFrontendTiles({});
    expect(frontendTilesOptions.maxLevelsToSkip).to.equal(4);
    expect(frontendTilesOptions.enableEdges).to.equal(false);
    expect(frontendTilesOptions.useIndexedDBCache).to.equal(false);
  });

  it("should initialize frontend tiles with custom values", () => {
    const options: FrontendTilesOptions = {
      maxLevelsToSkip: 1,
      enableEdges: true,
      useIndexedDBCache: true,
    };

    initializeFrontendTiles(options);
    expect(frontendTilesOptions.maxLevelsToSkip).to.equal(1);
    expect(frontendTilesOptions.enableEdges).to.equal(true);
    expect(frontendTilesOptions.useIndexedDBCache).to.equal(true);
  });
});
