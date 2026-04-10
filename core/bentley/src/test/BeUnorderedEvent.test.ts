/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { BeUnorderedEvent, BeUnorderedUiEvent } from "../core-bentley";

describe("BeUnorderedEvent", () => {

  it("add/remove/emit", () => {
    const event = new BeUnorderedEvent<(x: number) => void>();
    const results: number[] = [];
    const listener = (x: number) => results.push(x);

    const remove = event.addListener(listener);
    event.raiseEvent(42);
    expect(results).toEqual([42]);

    remove();
    event.raiseEvent(99);
    expect(results).toEqual([42]);
  });

  it("concurrent modification during emit — add listener", () => {
    const event = new BeUnorderedEvent<() => void>();
    const calls: string[] = [];

    // Listener added during emit should not fire in the same emit cycle
    // (Set iteration snapshot behavior: added entries ARE visited by ongoing iteration)
    // We just verify no crash and the new listener is callable afterward.
    event.addListener(() => {
      calls.push("first");
      event.addListener(() => calls.push("added-during-emit"));
    });

    event.raiseEvent();
    // "added-during-emit" may or may not appear depending on Set iteration; we just ensure no throw
    expect(calls).toContain("first");

    // The dynamically added listener should fire on next emit
    calls.length = 0;
    event.raiseEvent();
    expect(calls).toContain("added-during-emit");
  });

  it("concurrent modification during emit — remove listener via closure", () => {
    const event = new BeUnorderedEvent<() => void>();
    const calls: string[] = [];

    const removeListener2 = event.addListener(() => calls.push("second"));
    event.addListener(() => {
      calls.push("first");
      removeListener2();
    });

    event.raiseEvent();
    // First listener should always fire; second may or may not depending on iteration order.
    // The key guarantee: no crash, and deferred removal works.
    expect(calls).toContain("first");

    // After emit, listener2 should be gone
    expect(event.numberOfListeners).toBe(1);
  });

  it("listener removes itself during emit — others still fire", () => {
    const event = new BeUnorderedEvent<() => void>();
    const calls: string[] = [];

    const removeSelf = event.addListener(() => {
      calls.push("self-remover");
      removeSelf();
    });
    event.addListener(() => calls.push("other"));

    event.raiseEvent();
    expect(calls).toContain("self-remover");
    expect(calls).toContain("other");

    // self-remover should be gone
    expect(event.numberOfListeners).toBe(1);
  });

  it("1000-listener scale", () => {
    const event = new BeUnorderedEvent<(x: number) => void>();
    let count = 0;
    for (let i = 0; i < 1000; i++)
      event.addListener(() => count++);

    event.raiseEvent(1);
    expect(count).toBe(1000);
  });

  it("exception isolation — one listener throws, others still run", () => {
    const event = new BeUnorderedEvent<() => void>();
    const calls: string[] = [];

    event.addListener(() => calls.push("before"));
    event.addListener(() => { throw new Error("boom"); });
    event.addListener(() => calls.push("after"));

    // Should not throw
    event.raiseEvent();
    expect(calls).toContain("before");
    expect(calls).toContain("after");
  });

  it("duplicate listener semantics — same function creates two entries", () => {
    const event = new BeUnorderedEvent<() => void>();
    let count = 0;
    const fn = () => count++;

    const r1 = event.addListener(fn);
    const r2 = event.addListener(fn);

    // Two separate context objects in the Set, so both fire
    event.raiseEvent();
    expect(count).toBe(2);
    expect(event.numberOfListeners).toBe(2);

    // Removing via first closure should leave one
    r1();
    expect(event.numberOfListeners).toBe(1);

    count = 0;
    event.raiseEvent();
    expect(count).toBe(1);

    r2();
    expect(event.numberOfListeners).toBe(0);
  });

  it("addOnce — listener fires exactly once", () => {
    const event = new BeUnorderedEvent<(x: number) => void>();
    const results: number[] = [];

    event.addOnce((x) => results.push(x));
    event.raiseEvent(1);
    event.raiseEvent(2);

    expect(results).toEqual([1]);
    expect(event.numberOfListeners).toBe(0);
  });

  it("closure removes only its own registration", () => {
    const event = new BeUnorderedEvent<() => void>();
    const fn = () => {};

    const r1 = event.addListener(fn);
    const r2 = event.addListener(fn);
    expect(event.numberOfListeners).toBe(2);

    r1();
    expect(event.numberOfListeners).toBe(1);

    r2();
    expect(event.numberOfListeners).toBe(0);
  });

  it("scope — listeners with different scopes are independent", () => {
    const event = new BeUnorderedEvent<() => void>();
    const fn = () => {};
    const scope = {};

    const r1 = event.addListener(fn);
    const r2 = event.addListener(fn, scope);
    expect(event.numberOfListeners).toBe(2);

    r1();
    expect(event.numberOfListeners).toBe(1);

    r2();
    expect(event.numberOfListeners).toBe(0);
  });

  it("clear() — removes all listeners", () => {
    const event = new BeUnorderedEvent<() => void>();
    event.addListener(() => {});
    event.addListener(() => {});
    expect(event.numberOfListeners).toBe(2);

    event.clear();
    expect(event.numberOfListeners).toBe(0);
  });

  it("numberOfListeners — returns correct count", () => {
    const event = new BeUnorderedEvent<() => void>();
    expect(event.numberOfListeners).toBe(0);

    const r1 = event.addListener(() => {});
    expect(event.numberOfListeners).toBe(1);

    const r2 = event.addListener(() => {});
    expect(event.numberOfListeners).toBe(2);

    r1();
    expect(event.numberOfListeners).toBe(1);

    r2();
    expect(event.numberOfListeners).toBe(0);
  });
  it("re-entrant emit preserves deferred removal", () => {
    const event = new BeUnorderedEvent<() => void>();
    let nestOnce = true;
    const removeA = event.addListener(() => {
      if (nestOnce) {
        nestOnce = false;
        event.raiseEvent(); // Only nest once to avoid infinite recursion
      }
    });

    event.addListener(() => {
      removeA(); // Remove A during emit — deferred while depth > 0
    });

    event.addListener(() => {}); // C — passive listener

    event.raiseEvent();

    // A was tombstoned during nested emit, cleaned up when outermost emit finishes
    expect(event.numberOfListeners).toEqual(2); // B and C remain
  });
});

describe("BeUnorderedUiEvent", () => {
  it("emit(args) works with typed argument", () => {
    const event = new BeUnorderedUiEvent<{ name: string }>();
    let received: { name: string } | undefined;

    event.addListener((args) => { received = args; });
    event.emit({ name: "hello" });

    expect(received).toEqual({ name: "hello" });
  });
});
