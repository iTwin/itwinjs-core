/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ColorDef, EmptyLocalization } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";
import { BlankConnection } from "../IModelConnection";
import { ScreenViewport } from "../Viewport";
import { GraphicType, RenderGraphic } from "../core-frontend";
import { createBlankConnection } from "./createBlankConnection";
import { openBlankViewport } from "./openBlankViewport";
import { TestDecorator } from "./TestDecorators";

describe("Dynamics performance", () => {
  let imodel: BlankConnection;
  let viewport: ScreenViewport;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    imodel = createBlankConnection("dynamics-perf");
  });

  afterAll(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  afterEach(() => {
    TestDecorator.dropAll();
    viewport?.[Symbol.dispose]();
  });

  function createTestGraphic(vp: ScreenViewport): RenderGraphic {
    const builder = IModelApp.renderSystem.createGraphic({
      type: GraphicType.Scene,
      viewport: vp,
    });
    builder.setSymbology(ColorDef.red, ColorDef.red, 1);
    builder.addShape([
      new Point3d(0, 0, 0),
      new Point3d(0.5, 0, 0),
      new Point3d(0.5, 0.5, 0),
      new Point3d(0, 0.5, 0),
      new Point3d(0, 0, 0),
    ]);
    return builder.finish();
  }

  it("changeDynamics should not regenerate decorations", () => {
    viewport = openBlankViewport({ width: 100, height: 100, iModel: imodel });

    // Add a decorator that tracks how many times decorate() is called.
    let decorateCallCount = 0;
    const decorator = {
      decorate(_context: any): void {
        decorateCallCount++;
      },
    };
    IModelApp.viewManager.addDecorator(decorator);

    // Initial render to establish baseline - decorations should be generated.
    viewport.renderFrame();
    const initialCount = decorateCallCount;
    expect(initialCount).toBeGreaterThan(0);

    // Render again without changes - decorations should be cached (no new decorate calls).
    viewport.renderFrame();
    expect(decorateCallCount).toBe(initialCount);

    // Now simulate dynamics changing (like a move/copy drag operation).
    const graphic = createTestGraphic(viewport);
    viewport.changeDynamics([graphic], undefined);
    viewport.renderFrame();

    // Key assertion: changeDynamics should NOT cause decoration regeneration.
    // Before the fix, this would increment decorateCallCount because changeDynamics
    // called invalidateDecorations(). After the fix, it calls requestRedraw() instead.
    expect(decorateCallCount).toBe(initialCount);

    // Clean up dynamics.
    viewport.changeDynamics(undefined, undefined);
    IModelApp.viewManager.dropDecorator(decorator);
  });

  it("repeated changeDynamics calls should not repeatedly regenerate decorations", () => {
    viewport = openBlankViewport({ width: 100, height: 100, iModel: imodel });

    let decorateCallCount = 0;
    const decorator = {
      decorate(_context: any): void {
        decorateCallCount++;
      },
    };
    IModelApp.viewManager.addDecorator(decorator);

    // Initial render.
    viewport.renderFrame();
    const baselineCount = decorateCallCount;

    // Simulate 50 rapid dynamics updates (like mouse moves during a drag).
    const numUpdates = 50;
    for (let i = 0; i < numUpdates; i++) {
      const graphic = createTestGraphic(viewport);
      viewport.changeDynamics([graphic], undefined);
      viewport.renderFrame();
    }

    // After the fix, decorate should NOT have been called again.
    // Before the fix, it would have been called numUpdates additional times.
    expect(decorateCallCount).toBe(baselineCount);

    viewport.changeDynamics(undefined, undefined);
    IModelApp.viewManager.dropDecorator(decorator);
  });

  it("renderFrame is faster when changeDynamics does not regenerate decorations", () => {
    viewport = openBlankViewport({ width: 200, height: 200, iModel: imodel });

    // Register multiple decorators to amplify the cost of regeneration.
    const numDecorators = 20;
    const decorators: { decorate: (ctx: any) => void }[] = [];
    for (let d = 0; d < numDecorators; d++) {
      const decorator = {
        decorate(_context: any): void {
          // Simulate real decorator work — build a small graphic each call.
          const builder = IModelApp.renderSystem.createGraphic({ type: GraphicType.Scene, viewport });
          builder.setSymbology(ColorDef.blue, ColorDef.blue, 1);
          for (let s = 0; s < 10; s++) {
            builder.addShape([
              new Point3d(s * 0.01, 0, 0), new Point3d(s * 0.01 + 0.01, 0, 0),
              new Point3d(s * 0.01 + 0.01, 0.01, 0), new Point3d(s * 0.01, 0.01, 0),
              new Point3d(s * 0.01, 0, 0),
            ]);
          }
          builder.finish();
        },
      };
      decorators.push(decorator);
      IModelApp.viewManager.addDecorator(decorator);
    }

    // Warm up — first render generates and caches decorations.
    viewport.renderFrame();

    const numFrames = 100;

    // Measure: render frames while updating dynamics each frame.
    const start = performance.now();
    for (let i = 0; i < numFrames; i++) {
      const graphic = createTestGraphic(viewport);
      viewport.changeDynamics([graphic], undefined);
      viewport.renderFrame();
    }
    const dynamicsMs = performance.now() - start;

    viewport.changeDynamics(undefined, undefined);

    // Measure: render frames while invalidating decorations each frame (the old behavior).
    // This simulates what the code did before the fix.
    viewport.renderFrame(); // reset state
    const startOld = performance.now();
    for (let i = 0; i < numFrames; i++) {
      const graphic = createTestGraphic(viewport);
      viewport.target.changeDynamics([graphic], undefined);
      viewport.invalidateDecorations(); // the old code path
      viewport.renderFrame();
    }
    const invalidateMs = performance.now() - startOld;

    viewport.changeDynamics(undefined, undefined);

    // Log timing results.
    const speedup = invalidateMs / dynamicsMs;
    console.log(`--- Dynamics changeDynamics perf (${numFrames} frames, ${numDecorators} decorators) ---`);
    console.log(`  With fix (requestRedraw):        ${dynamicsMs.toFixed(1)} ms  (${(dynamicsMs / numFrames).toFixed(2)} ms/frame)`);
    console.log(`  Without fix (invalidateDecorations): ${invalidateMs.toFixed(1)} ms  (${(invalidateMs / numFrames).toFixed(2)} ms/frame)`);
    console.log(`  Speedup: ${speedup.toFixed(1)}x`);

    // The fix should be meaningfully faster — at least 1.5x with 20 decorators.
    expect(speedup).toBeGreaterThan(1.5);

    for (const dec of decorators)
      IModelApp.viewManager.dropDecorator(dec);
  });

  it("changeDynamics should still trigger a redraw", () => {
    viewport = openBlankViewport({ width: 100, height: 100, iModel: imodel });

    // Render a clean frame.
    viewport.renderFrame();

    let renderCount = 0;
    const removeListener = viewport.onRender.addListener(() => {
      renderCount++;
    });

    // changeDynamics should trigger a redraw (via requestRedraw).
    const graphic = createTestGraphic(viewport);
    viewport.changeDynamics([graphic], undefined);
    viewport.renderFrame();
    expect(renderCount).toBe(1);

    viewport.changeDynamics(undefined, undefined);
    removeListener();
  });
});
