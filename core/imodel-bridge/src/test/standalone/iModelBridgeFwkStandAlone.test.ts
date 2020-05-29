/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// import { expect } from "chai";

import { BridgeTestUtils } from "../BridgeTestUtils";
// import { IModelBridgeFwk } from "../../IModelBridgeFwk";

describe("IModelBridgeFwkStandAlone", () => {

  before(async () => {
    BridgeTestUtils.setupLogging();

  });

  it("Parse response file", async () => {
    // const fileName = "@lib/test/assets/bridgeCommandLineParams.txt";
    /* This test can't work because the staging directory is hard-coded to M:\ and iModelBridgeFwk's constructor calls BriefcaseManager.Initialize with that path */
    // const fwk = IModelBridgeFwk.fromArgs([fileName]);
    // expect(undefined !== fwk);
  });
});
