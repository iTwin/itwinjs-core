/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { BeAsyncEvent, UnexpectedErrors } from "../core-bentley";

describe("BeAsyncEvent", () => {
  describe("basic functionality shared with synchronous events", () => {
    // These tests are copied nearly verbatim from BeUnorderedEvent.test.ts.
    it("add/remove/emit", async () => {
      const event = new BeAsyncEvent<(x: number) => Promise<void>>();
      const results: number[] = [];
      const listener = async (x: number) => {
        results.push(x);
      };

      const remove = event.addListener(listener);
      await event.raiseEvent(42);
      expect(results).toEqual([42]);

      remove();
      await event.raiseEvent(99);
      expect(results).toEqual([42]);
    });

    it("concurrent modification during emit — add listener", async () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      const calls: string[] = [];

      // Listener added during emit should not fire in the same emit cycle
      // (Set iteration snapshot behavior: added entries ARE visited by ongoing iteration)
      // We just verify no crash and the new listener is callable afterward.
      event.addListener(async () => {
        calls.push("first");
        event.addListener(async () => { calls.push("added-during-emit") });
      });

      await event.raiseEvent();
      // "added-during-emit" may or may not appear depending on Set iteration; we just ensure no throw
      expect(calls).toContain("first");

      // The dynamically added listener should fire on next emit
      calls.length = 0;
      await event.raiseEvent();
      expect(calls).toContain("added-during-emit");
    });

    it("concurrent modification during emit — remove listener via closure", async () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      const calls: string[] = [];

      const removeListener2 = event.addListener(async () => { calls.push("second") });
      event.addListener(async () => {
        calls.push("first");
        removeListener2();
      });

      await event.raiseEvent();
      // First listener should always fire; second may or may not depending on iteration order.
      // The key guarantee: no crash, and deferred removal works.
      expect(calls).toContain("first");

      // After emit, listener2 should be gone
      expect(event.numberOfListeners).toBe(1);
    });

    it("listener removes itself during emit — others still fire", async () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      const calls: string[] = [];

      const removeSelf = event.addListener(async () => {
        calls.push("self-remover");
        removeSelf();
      });
      event.addListener(async () => { calls.push("other") });

      await event.raiseEvent();
      expect(calls).toContain("self-remover");
      expect(calls).toContain("other");

      // self-remover should be gone
      expect(event.numberOfListeners).toBe(1);
    });

    it("1000-listener scale", async () => {
      const event = new BeAsyncEvent<(x: number) => Promise<void>>();
      let count = 0;
      for (let i = 0; i < 1000; i++)
        event.addListener(async () => { count++ });

      await event.raiseEvent(1);
      expect(count).toBe(1000);
    });

    it("exception isolation — one listener throws, others still run", async () => {
      const event = new BeAsyncEvent<() => Promise<void>>({
        promiseRejectionIsUnexpected: true
      });
      const calls: string[] = [];

      event.addListener(async () => { calls.push("before") });
      event.addListener(async () => { throw new Error("boom"); });
      event.addListener(async () => { calls.push("after") });

      // Should not throw
      await event.raiseEvent();
      expect(calls).toContain("before");
      expect(calls).toContain("after");
    });

    it("duplicate listener semantics — same function creates two entries", async () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      let count = 0;
      const fn = async () => { count++ };

      const r1 = event.addListener(fn);
      const r2 = event.addListener(fn);

      // Two separate context objects in the Set, so both fire
      await event.raiseEvent();
      expect(count).toBe(2);
      expect(event.numberOfListeners).toBe(2);

      // Removing via first closure should leave one
      r1();
      expect(event.numberOfListeners).toBe(1);

      count = 0;
      await event.raiseEvent();
      expect(count).toBe(1);

      r2();
      expect(event.numberOfListeners).toBe(0);
    });

    it("addOnce — listener fires exactly once", async () => {
      const event = new BeAsyncEvent<(x: number) => Promise<void>>();
      const results: number[] = [];

      event.addOnce(async (x) => { results.push(x) });
      await event.raiseEvent(1);
      await event.raiseEvent(2);

      expect(results).toEqual([1]);
      expect(event.numberOfListeners).toBe(0);
    });

    it("addOnce — listener that re-raises the event is still invoked only once", async () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      let count = 0;

      event.addOnce(async () => {
        count++;
        if (count < 10)
          await event.raiseEvent();
      });

      await event.raiseEvent();

      expect(count).toBe(1);
      expect(event.numberOfListeners).toBe(0);
    });

    it("closure removes only its own registration", async () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      const fn = async () => { };

      const r1 = event.addListener(fn);
      const r2 = event.addListener(fn);
      expect(event.numberOfListeners).toBe(2);

      r1();
      expect(event.numberOfListeners).toBe(1);

      r2();
      expect(event.numberOfListeners).toBe(0);
    });

    it("scope — listeners with different scopes are independent", () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      const fn = async () => { };
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
      const event = new BeAsyncEvent<() => Promise<void>>();
      event.addListener(async () => { });
      event.addListener(async () => { });
      expect(event.numberOfListeners).toBe(2);

      event.clear();
      expect(event.numberOfListeners).toBe(0);
    });

    it("numberOfListeners — returns correct count", () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      expect(event.numberOfListeners).toBe(0);

      const r1 = event.addListener(async () => { });
      expect(event.numberOfListeners).toBe(1);

      const r2 = event.addListener(async () => { });
      expect(event.numberOfListeners).toBe(2);

      r1();
      expect(event.numberOfListeners).toBe(1);

      r2();
      expect(event.numberOfListeners).toBe(0);
    });
    it("re-entrant emit preserves deferred removal", async () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      let nestOnce = true;
      const removeA = event.addListener(async () => {
        if (nestOnce) {
          nestOnce = false;
          await event.raiseEvent(); // Only nest once to avoid infinite recursion
        }
      });

      event.addListener(async () => {
        removeA(); // Remove A during emit — deferred while depth > 0
      });

      event.addListener(async () => { }); // C — passive listener

      await event.raiseEvent();

      // A was tombstoned during nested emit, cleaned up when outermost emit finishes
      expect(event.numberOfListeners).toEqual(2); // B and C remain
    });
  });
  describe("asynchronous behavior", () => {
    it("propagates exceptions by default", async () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      event.addListener(async () => {
        throw new Error("Test error");
      });

      await expect(event.raiseEvent()).rejects.toThrow("Test error");
    });
    it("when there are multiple exceptions, propagates the first one", async () => {
      const event = new BeAsyncEvent<() => Promise<void>>();
      event.addListener(async () => {
        // Delay so the other listener throws first.
        await new Promise((resolve) => setTimeout(resolve, 1));
        throw new Error("Test error 1");
      });
      event.addListener(async () => {
        throw new Error("Test error 2");
      });

      await expect(event.raiseEvent()).rejects.toThrow("Test error 1");
    });
    it("reports UnexpectedErrors if promiseRejectionIsUnexpected", async () => {
      let error: any;
      const oldHandler = UnexpectedErrors.setHandler(e => {
        error = e;
      });

      try {
        const event = new BeAsyncEvent<() => Promise<void>>({ promiseRejectionIsUnexpected: true });

        event.addListener(async () => {
          throw new Error("Unexpected error");
        });

        // This should not throw even though a listener does.
        await event.raiseEvent();

        expect(error).toBeDefined();
        expect(error.message).toBe("Unexpected error");
      } finally {
        UnexpectedErrors.setHandler(oldHandler);
      }
    });
    it("invokes listeners serially", async () => {
      let resolve1;
      let started1 = false;
      const listener1 = async () => {
        started1 = true;
        return new Promise<void>((resolve) => { resolve1 = resolve; });
      };

      let resolve2;
      let started2 = false;
      const listener2 = async () => {
        started2 = true;
        return new Promise<void>((resolve) => { resolve2 = resolve; });
      };

      let resolve3;
      let started3 = false;
      const listener3 = async () => {
        started3 = true;
        return new Promise<void>((resolve) => { resolve3 = resolve; });
      };

      const event = new BeAsyncEvent<() => Promise<void>>({ concurrent: false });
      event.addListener(listener1);
      event.addListener(listener2);
      event.addListener(listener3);

      const raisePromise = event.raiseEvent();

      expect(started1).toBe(true);
      expect(started2).toBe(false);
      expect(started3).toBe(false);

      resolve1!();
      await new Promise(resolve => setTimeout(resolve, 1));

      expect(started2).toBe(true);
      expect(started3).toBe(false);

      resolve2!();
      await new Promise(resolve => setTimeout(resolve, 1));

      expect(started3).toBe(true);

      resolve3!();
      await raisePromise;
    });
    it("invokes listeners concurrently", async () => {
      let resolve1;
      let started1 = false;
      const listener1 = async () => {
        started1 = true;
        return new Promise<void>((resolve) => { resolve1 = resolve; });
      };

      let resolve2;
      let started2 = false;
      const listener2 = async () => {
        started2 = true;
        return new Promise<void>((resolve) => { resolve2 = resolve; });
      };

      let resolve3;
      let started3 = false;
      const listener3 = async () => {
        started3 = true;
        return new Promise<void>((resolve) => { resolve3 = resolve; });
      };

      const event = new BeAsyncEvent<() => Promise<void>>({ concurrent: true });
      event.addListener(listener1);
      event.addListener(listener2);
      event.addListener(listener3);

      const raisePromise = event.raiseEvent();

      expect(started1).toBe(true);
      expect(started2).toBe(true);
      expect(started3).toBe(true);

      resolve3!();
      resolve2!();
      resolve1!();
      await raisePromise;
    });
    it("runs concurrent listeners to completion even if one rejects", async () => {
      let started1 = false;
      let ended1 = false;
      const listener1 = async () => {
        started1 = true;
        return new Promise<void>(resolve => setTimeout(resolve, 1)).then(() => { ended1 = true; });
      };

      let started2 = false;
      const listener2 = async () => {
        started2 = true;
        throw new Error("Unexpected error");
      };

      let started3 = false;
      let ended3 = false;
      const listener3 = async () => {
        started3 = true;
        return new Promise<void>(resolve => setTimeout(resolve, 1)).then(() => { ended3 = true; });
      };

      const event = new BeAsyncEvent<() => Promise<void>>({ concurrent: true });
      event.addListener(listener1);
      event.addListener(listener2);
      event.addListener(listener3);

      const raisePromise = event.raiseEvent();

      expect(started1).toBe(true);
      expect(started2).toBe(true);
      expect(started3).toBe(true);
      expect(ended1).toBe(false);
      expect(ended3).toBe(false);

      await expect(raisePromise).rejects.toThrow("Unexpected error");

      expect(ended1).toBe(true);
      expect(ended3).toBe(true);
    });
    it("stops after the first serial listener that rejects", async () => {
      let started1 = false;
      let ended1 = false;
      const listener1 = async () => {
        started1 = true;
        return new Promise<void>(resolve => setTimeout(resolve, 1)).then(() => { ended1 = true; });
      };

      let started2 = false;
      const listener2 = async () => {
        started2 = true;
        throw new Error("Unexpected error");
      };

      let started3 = false;
      let ended3 = false;
      const listener3 = async () => {
        started3 = true;
        return new Promise<void>(resolve => setTimeout(resolve, 1)).then(() => { ended3 = true; });
      };

      const event = new BeAsyncEvent<() => Promise<void>>({ concurrent: false });
      event.addListener(listener1);
      event.addListener(listener2);
      event.addListener(listener3);

      const raisePromise = event.raiseEvent();

      expect(started1).toBe(true);
      expect(started2).toBe(false);
      expect(started3).toBe(false);
      expect(ended1).toBe(false);
      expect(ended3).toBe(false);

      await expect(raisePromise).rejects.toThrow("Unexpected error");

      expect(ended1).toBe(true);
      expect(started3).toBe(false);
      expect(ended3).toBe(false);
    });
  });
});
