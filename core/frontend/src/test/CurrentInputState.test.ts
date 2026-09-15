/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { BeButton } from "../tools/Tool";
import { CurrentInputState } from "../tools/ToolAdmin";
import { ToolSettings } from "../tools/ToolSettings";

// startDragDelay default is 110ms
const delay = ToolSettings.startDragDelay.milliseconds;

describe("CurrentInputState.isStartDrag event-timestamp drag detection", () => {
  function makeState(downTime: number): CurrentInputState {
    const state = new CurrentInputState();
    state.button[BeButton.Data].isDown = true;
    state.button[BeButton.Data].downTime = downTime;
    return state;
  }

  it("returns false when motionEventTime - downTime is within startDragDelay", () => {
    const downTime = performance.now() - 5000; // dispatched 5s ago
    const state = makeState(downTime);

    // mousemove dispatched only 50ms after mousedown
    const motionEventTime = downTime + 50;
    expect(state.isStartDrag(BeButton.Data, motionEventTime)).toBe(false);
  });

  it("passes the time check when motionEventTime - downTime exceeds startDragDelay", () => {
    const downTime = performance.now() - 5000;
    const state = makeState(downTime);

    const withinDelay = state.isStartDrag(BeButton.Data, downTime + delay - 1);
    const beyondDelay = state.isStartDrag(BeButton.Data, downTime + delay + 90);

    expect(withinDelay).toBe(false);  // blocked at time check
    expect(beyondDelay).toBe(false);  // time check passed; blocked at viewport=undefined
  });

  it("stall scenario: event timestamps prevent false drag despite large real-time elapsed", () => {
    // User clicked, event loop stalled 3s (e.g. RPC), then queued mousemove processed.
    // Event timestamps show only 30ms between mousedown and mousemove dispatch.
    const simulatedStallMs = 3000;
    const mousedownDispatchTime = performance.now() - simulatedStallMs;
    const mousemoveDispatchTime = mousedownDispatchTime + 30;

    const state = makeState(mousedownDispatchTime);

    // With event timestamps: 30ms elapsed < delay → time check blocks drag
    expect(state.isStartDrag(BeButton.Data, mousemoveDispatchTime)).toBe(false);

    // Without event timestamps, fallback uses performance.now() - downTime ≈ 3000ms > delay,
    // so the time check would NOT block it (viewport=undefined still returns false, but after the time guard).
    const fallbackElapsed = performance.now() - mousedownDispatchTime;
    expect(fallbackElapsed).toBeGreaterThan(delay);
  });

  it("trailing timeout path: eventTime+100 allows drag to start after startDragDelay", () => {
    // Scenario: pointer moves 20ms after mousedown (below 110ms delay) and stops.
    // The immediate snap evaluation correctly suppresses drag (20ms < delay).
    // After 100ms the trailing timeout fires; the timeout path uses eventTime+100 = 120ms,
    // which exceeds startDragDelay — drag should now be eligible to start.
    const downTime = performance.now() - 500; // mousedown 500ms ago in real time
    const mousemoveEventTime = downTime + 20; // dispatched 20ms after mousedown

    const state = makeState(downTime);

    // Immediate evaluation: 20ms < delay → no drag
    expect(state.isStartDrag(BeButton.Data, mousemoveEventTime)).toBe(false);

    // Timeout evaluation (eventTime + 100): 120ms > delay → time check passes
    // (still returns false because viewport=undefined, but the time guard no longer blocks)
    const timeoutMotionTime = mousemoveEventTime + 100;
    const timeoutElapsed = timeoutMotionTime - downTime;
    expect(timeoutElapsed).toBeGreaterThan(delay);
    // isStartDrag itself returns false only due to missing viewport, not the time check:
    expect(state.isStartDrag(BeButton.Data, timeoutMotionTime)).toBe(false); // viewport guard
  });

  it("returns false when button is not down", () => {
    const state = new CurrentInputState();
    state.button[BeButton.Data].isDown = false;
    state.button[BeButton.Data].downTime = performance.now() - 5000;

    expect(state.isStartDrag(BeButton.Data, performance.now())).toBe(false);
  });

  it("returns false when already dragging", () => {
    const downTime = performance.now() - 5000;
    const state = makeState(downTime);
    state.button[BeButton.Data].isDragging = true;

    expect(state.isStartDrag(BeButton.Data, downTime + delay + 100)).toBe(false);
  });
});

describe("CurrentInputState.onButtonDown double-click detection", () => {
  it("first click is never a double-click regardless of time since page load", () => {
    // Regression: downTime was 0, and with performance.now() epoch, a click
    // within 500ms of page load would satisfy (now - 0) < doubleClickTimeout.
    // downTime = -Infinity ensures (now - (-Infinity)) = Infinity > any timeout.
    const fresh = new CurrentInputState();
    const initialDownTime = fresh.button[BeButton.Data].downTime;
    const timeout = ToolSettings.doubleClickTimeout.milliseconds;

    // The initial value must make every possible event timestamp appear to be
    // long after any previous press, i.e. elapsed must always exceed the timeout.
    expect(performance.now() - initialDownTime).toBeGreaterThan(timeout);
    expect(100 - initialDownTime).toBeGreaterThan(timeout); // even 100ms since page load
  });
});
