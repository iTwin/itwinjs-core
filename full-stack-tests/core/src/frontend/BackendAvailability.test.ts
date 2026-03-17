/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Smoke test verifying the backend RPC server is accessible (Chrome/web mode only).
// Extracted from _Setup.test.ts — the setup logic now lives in vitest.setup.ts.

import { assert } from "chai";
import { ProcessDetector } from "@itwin/core-bentley";

const backendPort = Number(process.env.FULL_STACK_BACKEND_PORT || 5010);

if (!ProcessDetector.isElectronAppFrontend) {
  describe("Web Test Fixture", () => {
    it("Backend server should be accessible", async () => {
      const req = new XMLHttpRequest();
      req.open("GET", `http://localhost:${backendPort}/v3/swagger.json`);
      const loaded = new Promise((resolve) => req.addEventListener("load", resolve));
      req.send();
      await loaded;
      assert.equal(200, req.status);
      const desc = JSON.parse(req.responseText);
      assert.equal(desc.info.title, "full-stack-test");
      assert.equal(desc.info.version, "v1.0");
    });
  });
}
