/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { StandaloneIModelGateway } from "@bentley/imodeljs-common";
import { OpenMode } from "@bentley/bentleyjs-core";
import { assert } from "chai";

describe("StandaloneIModelGateway", () => {
  it("openStandalone should handle a blank filename", async () => {
    try {
      await StandaloneIModelGateway.getProxy().openStandalone("", OpenMode.Readonly);
      assert(false);
    } catch (e) {
      assert(true);
    }
  });
});
