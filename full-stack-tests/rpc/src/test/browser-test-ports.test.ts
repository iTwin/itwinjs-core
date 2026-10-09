/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { mobileBackendPortFor } from "../common/BrowserTestPorts";

describe("RPC browser test ports", () => {
  it("puts the mock mobile backend one hop past the RPC backend", () => {
    expect(mobileBackendPortFor(3020)).toBe(7020);
  });
});
