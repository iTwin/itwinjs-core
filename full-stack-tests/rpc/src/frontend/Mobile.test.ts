/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import { assert } from "chai";
import { MobileTestInterface } from "../common/TestRpcInterface";
import { currentEnvironment } from "./_Setup.test";

if (!ProcessDetector.isElectronAppFrontend) {
  describe("Mobile", () => {
    it("handle multipart", async () => {
      if (currentEnvironment === "websocket") {
        return;
      }

      const sum = await MobileTestInterface.getClient().multipart(1, new Uint8Array([2, 3, 4]));
      assert.equal(sum, 10);
    });
  });
}
