/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { CurrentImdlVersion, IModelTileRpcInterface } from "@itwin/core-common";

describe("iMdl format version", () => {
  it("should match between frontend and backend", async () => {
    const intfc = IModelTileRpcInterface.getClient();
    const info = await intfc.queryVersionInfo();
    assert(info.formatVersion === CurrentImdlVersion.Combined, "CurrentImdlVersion must match IModelTileIO::Version::Current()");
  });
});
