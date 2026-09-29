/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { backendOriginFor, backendPortFor, parseFrontendPort } from "../common/BrowserTestPorts";

describe("core browser test ports", () => {
  it("derives the backend from the page port", () => {
    expect(backendPortFor(3010)).toBe(5010);
    expect(backendOriginFor({ protocol: "http:", hostname: "127.0.0.1", port: "4000" })).toBe("http://127.0.0.1:6000");
  });

  it("rejects missing or invalid page ports instead of guessing", () => {
    expect(parseFrontendPort("3010", "port")).toBe(3010);
    for (const value of [undefined, "", "abc", "0", "70000", "3010.5"])
      expect(() => parseFrontendPort(value, "VITEST_FRONTEND_PORT")).toThrow(`VITEST_FRONTEND_PORT must be a TCP port, got "${String(value)}".`);
  });
});
