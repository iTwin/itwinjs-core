/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";

describe("test", () => {
  async function withFetch(mockFetch: typeof window.fetch, fn: () => Promise<void>): Promise<void> {
    const windowFetch = window.fetch;
    window.fetch = mockFetch;
    try {
      fn();
    } finally {
      window.fetch = windowFetch;
    }
  }

  it("tests", async () => {
    let fetched = false;
    await withFetch(async () => { fetched = true; return { } as any; }, async () => { await fetch("sldfkjs"); });
    expect(fetched).to.be.true;
  });
});
