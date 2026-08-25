/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { FormattingReadyCollector } from "../Formatter/FormattingReadyCollector";

describe("FormattingReadyCollector", () => {
  it("resolves immediately when no work is added", async () => {
    const collector = new FormattingReadyCollector();
    await collector.awaitAll();
  });

  it("waits for a single promise", async () => {
    const collector = new FormattingReadyCollector();
    let resolved = false;
    collector.addPendingWork(new Promise<void>((resolve) => {
      setTimeout(() => { resolved = true; resolve(); }, 10);
    }));
    expect(resolved).toBe(false);
    await collector.awaitAll();
    expect(resolved).toBe(true);
  });

  it("waits for multiple promises", async () => {
    const collector = new FormattingReadyCollector();
    const results: number[] = [];
    collector.addPendingWork(new Promise<void>((resolve) => {
      setTimeout(() => { results.push(1); resolve(); }, 10);
    }));
    collector.addPendingWork(new Promise<void>((resolve) => {
      setTimeout(() => { results.push(2); resolve(); }, 20);
    }));
    await collector.awaitAll();
    expect(results).toContain(1);
    expect(results).toContain(2);
  });

  it("does not throw when a provider rejects — logs warning instead", async () => {
    const collector = new FormattingReadyCollector();
    collector.addPendingWork(Promise.reject(new Error("provider failed")));
    collector.addPendingWork(Promise.resolve());
    // Should not throw
    await collector.awaitAll();
  });

  it("resolves after timeout when work exceeds deadline", async () => {
    const collector = new FormattingReadyCollector();
    collector.addPendingWork(new Promise<void>(() => {
      // Never resolves
    }));
    const start = Date.now();
    await collector.awaitAll(100); // 100ms timeout
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // allow small timing slack
    expect(elapsed).toBeLessThan(500);
  });
});
