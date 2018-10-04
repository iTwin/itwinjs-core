/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { StandaloneIModelRpcInterface } from "@bentley/imodeljs-common";
import { OpenMode } from "@bentley/bentleyjs-core";
import { assert } from "chai";

describe("StandaloneIModelRpcInterface", () => {
  it("openStandalone should handle a blank filename", async () => {
    try {
      await StandaloneIModelRpcInterface.getClient().openStandalone("", OpenMode.Readonly);
      assert(false);
    } catch (e) {
      assert(true);
    }
  });
});
