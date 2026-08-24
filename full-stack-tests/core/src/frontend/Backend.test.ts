/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { ProcessDetector } from "@itwin/core-bentley";

if (!ProcessDetector.isElectronAppFrontend) {
  describe("Web Test Fixture", () => {
    it("Backend server should be accessible", async () => {
      const backendUrl = `http://${window.location.hostname}:${Number(window.location.port) + 2000}`;
      const response = await fetch(`${backendUrl}/v3/swagger.json`);
      expect(response.status).toBe(200);
      const description = await response.json() as { info: { title: string, version: string } };
      expect(description.info.title).toBe("full-stack-test");
      expect(description.info.version).toBe("v1.0");
    });
  });
}
