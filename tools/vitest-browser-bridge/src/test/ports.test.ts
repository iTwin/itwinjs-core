/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { backendOriginFor, backendPortFor, parseFrontendPort } from "../ports";

describe("browser test ports", () => {
  it("derives the backend from the page port", () => {
    expect(backendPortFor(3020)).toBe(5020);
    expect(backendOriginFor({ protocol: "http:", hostname: "127.0.0.1", port: "4000" })).toBe("http://127.0.0.1:6000");
  });

  it("rejects missing or invalid page ports instead of guessing", () => {
    expect(parseFrontendPort("3020", "port")).toBe(3020);
    expect(parseFrontendPort(3020, "port")).toBe(3020);
    for (const value of [undefined, "", "abc", "0", "70000", "3020.5"])
      expect(() => parseFrontendPort(value, "VITEST_FRONTEND_PORT")).toThrow(`VITEST_FRONTEND_PORT must be a TCP port, got "${String(value)}".`);
    expect(() => backendOriginFor({ protocol: "http:", hostname: "127.0.0.1", port: "" })).toThrow("The Vitest page port must be a TCP port");
  });
});
