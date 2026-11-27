/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IModelApp } from "../IModelApp";
import { MockRender } from "../internal/render/MockRender";

describe("ToolAdmin Escape focus handling", () => {
  let button: HTMLButtonElement;

  beforeAll(async () => {
    await MockRender.App.startup();
  });

  afterAll(async () => MockRender.App.shutdown());

  beforeEach(() => {
    button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  afterEach(() => {
    button.remove();
  });

  const makeKeyEvent = (type: "keydown" | "keyup") => new KeyboardEvent(type, { key: "Escape", cancelable: true });
  // Simulate the capture phase listener that always sees the event.
  const capture = async (ev: KeyboardEvent) => (IModelApp.toolAdmin as any).onKeyTransitionCaptured(ev);
  // Simulate the bubble phase processing that only sees unstopped events.
  const bubble = (ev: KeyboardEvent, wentDown: boolean): boolean => (IModelApp.toolAdmin as any).processKeyboardEvent(ev, wentDown);

  it("moves focus Home for an unclaimed Escape press", async () => {
    const down = makeKeyEvent("keydown");
    await capture(down);
    expect(bubble(down, true)).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it("leaves focus alone when a ui element stops propagation of the Escape down", async () => {
    // A menu closing on Escape calls stopPropagation on the down; only capture sees it.
    await capture(makeKeyEvent("keydown"));

    // The up still bubbles; it should be swallowed without stealing focus from the button.
    const up = makeKeyEvent("keyup");
    await capture(up);
    expect(bubble(up, false)).toBe(true);
    expect(document.activeElement).toBe(button);

    // The next unclaimed Escape press still moves focus Home.
    const down = makeKeyEvent("keydown");
    await capture(down);
    expect(bubble(down, true)).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it("treats a defaultPrevented Escape down as claimed by a ui element", async () => {
    const down = makeKeyEvent("keydown");
    await capture(down);
    down.preventDefault();
    expect(bubble(down, true)).toBe(true);
    expect(document.activeElement).toBe(button);

    const up = makeKeyEvent("keyup");
    await capture(up);
    expect(bubble(up, false)).toBe(true);
    expect(document.activeElement).toBe(button);

    // Claim state resets after the press completes.
    const down2 = makeKeyEvent("keydown");
    await capture(down2);
    expect(bubble(down2, true)).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });
});
