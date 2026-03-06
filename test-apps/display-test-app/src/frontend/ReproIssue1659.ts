/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Reproduction for iTwin/itwinjs-backlog#1659:
 *   Move/copy operations on complex symbols became slow after upgrading 4.11 → 5.2.
 *
 * ROOT CAUSE:
 *   Viewport.changeDynamics() called invalidateDecorations() on every mouse motion event,
 *   forcing a full decoration rebuild each frame. PR #7617 (TileTreeReference iterables)
 *   made those rebuilds significantly more expensive by iterating ALL tile tree refs inside
 *   addDecorations() instead of just the provider refs.
 *
 * HOW TO USE:
 *   dta repro 1659               — toggle the reproduction on/off (starts in "fixed" mode)
 *   dta repro 1659 start         — start in "fixed" mode (the current code behavior)
 *   dta repro 1659 regress       — start in "regressed" mode (simulates the old bug)
 *   dta repro 1659 stop          — stop the reproduction
 *
 * Once the tool is active, LEFT-CLICK to start dynamics, then MOVE THE MOUSE to drive
 * the dynamics pipeline. RIGHT-CLICK or enter the key-in with "stop" to exit.
 *
 * This uses a real PrimitiveTool with onDynamicFrame — the same pipeline that
 * MoveElementsTool3d / TransformElementsTool uses:
 *   ToolAdmin.onMotion → updateDynamics → DynamicsContext → tool.onDynamicFrame
 *   → context.changeDynamics() → Viewport.changeDynamics()
 *
 * Works best with an iModel that has many displayed tiles/reality models — the more tile
 * tree references in the scene, the more expensive each decoration rebuild becomes. Also
 * works with the empty example, though the difference will be less dramatic.
 *
 * WHAT TO OBSERVE in the HUD overlay (top-left of viewport):
 *
 *   mode:              "FIXED" or "REGRESSED (old bug)"
 *   dynamics/sec:      how many times onDynamicFrame fires (mouse-motion driven)
 *   decorate calls:    how many times decorate() is invoked per second
 *
 *   In FIXED mode:     decorate calls ≈ 0 (decorations cached between mouse moves)
 *   In REGRESSED mode: decorate calls ≈ N × dynamics/sec (full rebuild every frame)
 *
 * You can switch between modes while running by entering the key-in again with a different
 * action — the HUD updates immediately so you can compare side-by-side.
 */

import { ColorDef } from "@itwin/core-common";
import {
  BeButtonEvent, DecorateContext, Decorator, DynamicsContext, EventHandled,
  GraphicType, IModelApp, NotifyMessageDetails, OutputMessagePriority,
  PrimitiveTool, ScreenViewport, Tool,
} from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";

// ---------------------------------------------------------------------------
// Stats tracker + HUD
// ---------------------------------------------------------------------------

class Repro1659Stats {
  public mode: "fixed" | "regressed" = "fixed";

  private _decorateCalls = 0;
  private _decorateWindowStart = performance.now();
  public decoratePerSec = 0;

  private _dynamicsCalls = 0;
  private _dynamicsWindowStart = performance.now();
  public dynamicsPerSec = 0;

  public countDecorate(): void {
    this._decorateCalls++;
    const now = performance.now();
    const elapsed = now - this._decorateWindowStart;
    if (elapsed >= 500) {
      this.decoratePerSec = (this._decorateCalls * 1000) / elapsed;
      this._decorateCalls = 0;
      this._decorateWindowStart = now;
    }
  }

  public countDynamics(): void {
    this._dynamicsCalls++;
    const now = performance.now();
    const elapsed = now - this._dynamicsWindowStart;
    if (elapsed >= 500) {
      this.dynamicsPerSec = (this._dynamicsCalls * 1000) / elapsed;
      this._dynamicsCalls = 0;
      this._dynamicsWindowStart = now;
    }
  }

  public reset(): void {
    this._decorateCalls = 0;
    this._decorateWindowStart = performance.now();
    this.decoratePerSec = 0;
    this._dynamicsCalls = 0;
    this._dynamicsWindowStart = performance.now();
    this.dynamicsPerSec = 0;
  }

  public drawHud(ctx: CanvasRenderingContext2D): void {
    const x = 10;
    let y = 24;
    const lineH = 20;
    const isRegressed = this.mode === "regressed";
    ctx.save();
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(x - 4, y - 18, 360, lineH * 5 + 4);

    ctx.fillStyle = "#00ff88";
    ctx.fillText("Issue #1659 repro (dynamics perf)", x, y); y += lineH;

    ctx.fillStyle = isRegressed ? "#ff4444" : "#44ff44";
    ctx.fillText(`mode: ${isRegressed ? "REGRESSED (old bug)" : "FIXED"}`, x, y); y += lineH;

    ctx.fillStyle = "#ffffff";
    ctx.fillText(`dynamics/sec: ${this.dynamicsPerSec.toFixed(0)}  (move mouse after click)`, x, y); y += lineH;

    ctx.fillStyle = "#ffff44";
    ctx.fillText(`decorate calls/sec: ${this.decoratePerSec.toFixed(0)}`, x, y); y += lineH;

    ctx.fillStyle = "#888888";
    ctx.fillText(`(${NUM_DECORATORS} decorators × ${SHAPES_PER_DECORATOR} shapes)`, x, y);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Heavy decorator — each builds significant geometry to amplify rebuild cost
// ---------------------------------------------------------------------------

const NUM_DECORATORS = 30;
const SHAPES_PER_DECORATOR = 20;

class HeavyDecorator implements Decorator {
  constructor(
    private readonly _index: number,
    private readonly _stats: Repro1659Stats,
  ) {}

  public decorate(context: DecorateContext): void {
    this._stats.countDecorate();

    // Build substantial geometry — this is the work that gets repeated on every
    // frame when invalidateDecorations() is called unnecessarily.
    const builder = context.createGraphic({ type: GraphicType.WorldDecoration });
    const baseOffset = this._index * 0.12;
    const color = ColorDef.from(50 + this._index * 6, 100 + (this._index % 5) * 20, Math.max(0, 220 - this._index * 4));
    builder.setSymbology(color, ColorDef.black, 1);

    for (let s = 0; s < SHAPES_PER_DECORATOR; s++) {
      const ox = baseOffset + s * 0.005;
      const oy = s * 0.005;
      builder.addShape([
        new Point3d(ox, oy, 0),
        new Point3d(ox + 0.004, oy, 0),
        new Point3d(ox + 0.004, oy + 0.004, 0),
        new Point3d(ox, oy + 0.004, 0),
        new Point3d(ox, oy, 0),
      ]);
    }
    context.addDecoration(GraphicType.WorldDecoration, builder.finish());
  }
}

// ---------------------------------------------------------------------------
// PrimitiveTool — uses the real dynamics pipeline (onDynamicFrame)
//
// This mirrors the TransformElementsTool / MoveElementsTool3d flow:
//   1. Tool installs, user clicks to start dynamics (like picking an anchor point)
//   2. Mouse motion → ToolAdmin.updateDynamics → onDynamicFrame(ev, context)
//   3. Tool adds dynamic graphics to DynamicsContext
//   4. DynamicsContext.changeDynamics() → Viewport.changeDynamics()
//   5. In the old code, changeDynamics called invalidateDecorations() (the bug)
//   6. In the fix, it calls requestRedraw() instead
// ---------------------------------------------------------------------------

class Repro1659MoveTool extends PrimitiveTool {
  public static override toolId = "Repro1659Move";

  private _stats: Repro1659Stats;
  private _simulateRegression: boolean;

  constructor(stats: Repro1659Stats, simulateRegression: boolean) {
    super();
    this._stats = stats;
    this._simulateRegression = simulateRegression;
  }

  public override requireWriteableTarget(): boolean { return false; }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();
    IModelApp.accuSnap.enableSnap(true);
  }

  /** First click starts dynamics — analogous to setting the anchor point in MoveElementsTool3d. */
  public override async onDataButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    if (!this.isDynamicsStarted)
      this.beginDynamics();
    return EventHandled.No;
  }

  /**
   * Called by ToolAdmin.updateDynamics on every mouse motion while dynamics are active.
   * This is the exact same code path that TransformElementsTool.onDynamicFrame uses:
   *   ToolAdmin creates a DynamicsContext → calls this → then context.changeDynamics()
   *   → Viewport.changeDynamics() → requestRedraw() [fixed] or invalidateDecorations() [old bug]
   */
  public override onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    this._stats.countDynamics();

    // Build a dynamic graphic following the cursor — simulates the transformed
    // element preview that TransformGraphicsProvider creates during a real move.
    const builder = context.createSceneGraphicBuilder();
    builder.setSymbology(ColorDef.red, ColorDef.red, 3);
    const p = ev.point;
    const size = 0.1;
    builder.addShape([
      Point3d.create(p.x - size, p.y - size, p.z),
      Point3d.create(p.x + size, p.y - size, p.z),
      Point3d.create(p.x + size, p.y + size, p.z),
      Point3d.create(p.x - size, p.y + size, p.z),
      Point3d.create(p.x - size, p.y - size, p.z),
    ]);
    context.addGraphic(builder.finish());

    // In "regressed" mode, simulate the old bug: Viewport.changeDynamics() used to
    // call invalidateDecorations() as part of its implementation. We call it here
    // (just before context.changeDynamics() is called by ToolAdmin) to reproduce
    // the same effect — all decorators are forced to rebuild on every mouse move.
    if (this._simulateRegression)
      ev.viewport?.invalidateDecorations();
  }

  /** Right-click exits the tool. */
  public override async onResetButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    _manager.stop();
    return EventHandled.Yes;
  }

  public override async onRestartTool(): Promise<void> {
    return this.exitTool();
  }
}

// ---------------------------------------------------------------------------
// Reproduction manager
// ---------------------------------------------------------------------------

class Repro1659Manager {
  private readonly _stats = new Repro1659Stats();
  private readonly _registeredDecorators: Decorator[] = [];
  private _vp?: ScreenViewport;
  private _removeCloseListener?: () => void;

  /** Start the reproduction.
   * @param regress If true, call invalidateDecorations() in onDynamicFrame
   *   to simulate the pre-fix behavior — no core code changes needed.
   */
  public start(vp: ScreenViewport, regress: boolean): void {
    if (this._vp)
      this.stop();
    this._vp = vp;
    this._stats.mode = regress ? "regressed" : "fixed";
    this._stats.reset();

    // HUD overlay decorator
    const stats = this._stats;
    const hudDec: Decorator = {
      decorate(ctx: DecorateContext) {
        ctx.addCanvasDecoration({ drawDecoration: (c) => stats.drawHud(c) });
      },
    };
    IModelApp.viewManager.addDecorator(hudDec);
    this._registeredDecorators.push(hudDec);

    // Register N heavy decorators — these are the "victims" whose decorate() gets
    // called unnecessarily when invalidateDecorations() fires.
    for (let i = 0; i < NUM_DECORATORS; i++) {
      const dec = new HeavyDecorator(i, stats);
      IModelApp.viewManager.addDecorator(dec);
      this._registeredDecorators.push(dec);
    }

    // Install the PrimitiveTool — this uses the real dynamics pipeline
    const tool = new Repro1659MoveTool(stats, regress);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    tool.run();

    this._removeCloseListener = vp.iModel.onClose.addOnce(() => this.stop());

    const modeStr = regress ? "REGRESSED (simulating old bug)" : "FIXED";
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info,
      `[#1659] Started — mode: ${modeStr}. Click to begin dynamics, then move mouse. Right-click to stop.`,
    ));
  }

  public stop(): void {
    if (this._vp) {
      this._vp.changeDynamics(undefined, undefined);
      this._vp = undefined;
    }

    for (const dec of this._registeredDecorators)
      IModelApp.viewManager.dropDecorator(dec);
    this._registeredDecorators.length = 0;

    this._removeCloseListener?.();
    this._removeCloseListener = undefined;

    // Return to the default tool
    void IModelApp.toolAdmin.startDefaultTool();

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info, "[#1659] Stopped."));
  }

  public get isRunning(): boolean { return this._vp !== undefined; }
}

const _manager = new Repro1659Manager();

// ---------------------------------------------------------------------------
// Tool — key-in: "dta repro 1659 [start|regress|stop]"
// ---------------------------------------------------------------------------

export class ReproIssue1659Tool extends Tool {
  public static override toolId = "ReproIssue1659";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(action = "toggle"): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(
        OutputMessagePriority.Warning, "No active viewport — open an iModel or the empty example first."));
      return false;
    }
    switch (action) {
      case "start":   _manager.start(vp, false); break;
      case "regress": _manager.start(vp, true); break;
      case "stop":    _manager.stop(); break;
      default:        _manager.isRunning ? _manager.stop() : _manager.start(vp, false); break;
    }
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }
}
