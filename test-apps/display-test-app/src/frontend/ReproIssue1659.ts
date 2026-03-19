/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Reproduction for iTwin/itwinjs-backlog#1659:
 *   Move/copy operations on substation+ symbols became slow after upgrading 4.11 → 5.2.
 *
 * This reproduction closely mirrors the Substation+ workflow:
 *   - ConnectorPortDecorator: Matches S+'s ConnectorDecorator pattern
 *     (useCachedDecorations=false, WorldOverlay, line+arc geometry per connector port)
 *   - AnnotationDecorator: Cached ViewOverlay labels (common in engineering apps)
 *   - StatusBadgeDecorator: Canvas decorations for equipment status
 *   - Programmatic iModel: Many physical models → many tile tree references
 *   - Simulated clash detection: Per-mousemove CPU work matching ClashDetectionManager
 *
 * ROOT CAUSE:
 *   Commit ce418d16d8 (GoogleMaps support #7604) changed ScreenViewport.addDecorations()
 *   to iterate getTileTreeRefs() instead of tiledGraphicsProviderRefs(). This iterates ALL
 *   tile tree refs (view model + map + provider) on every decoration rebuild, instead of
 *   just the external providers. Combined with multiple sources of invalidateDecorations()
 *   firing on every mouse motion (AccuSnap, ToolAdmin locate circle, ToolAdmin.updateDynamics),
 *   this makes decoration rebuilds during move/copy drag significantly more expensive.
 *
 * HOW TO USE (A/B test with real interactive move):
 *   dta repro 1659 create [numModels] [elementsPerModel]
 *       Create a test iModel. Defaults: 30 models, 50 elements each.
 *
 *   dta repro 1659 decorate     — add decorators only (use with dta interactive move)
 *   dta repro 1659 start        — start with custom dynamics tool in "fixed" mode
 *   dta repro 1659 regress      — start with custom dynamics tool in "regressed" mode
 *   dta repro 1659 stop         — stop and remove all decorators
 *
 * RECOMMENDED A/B WORKFLOW:
 *   1. dta repro 1659 create 30 50
 *   2. Open the .bim file
 *   3. dta edit                    (start editing session)
 *   4. dta repro 1659 decorate     (add S+-like decorators + HUD)
 *   5. Select some elements
 *   6. dta interactive move        (real TransformElementsTool)
 *   7. Click anchor → drag mouse → observe responsiveness
 *   Compare between 4.11 worktree and current branch.
 *
 * WHAT TO OBSERVE in the HUD overlay (top-left of viewport):
 *   mode:                "FIXED", "REGRESSED (old bug)", or "decorators-only"
 *   dynamics/sec:        how many times onDynamicFrame fires
 *   connector dec/sec:   ConnectorPortDecorator.decorate() calls per second
 *   annotation dec/sec:  AnnotationDecorator.decorate() calls per second
 *   tile tree refs:      number of tile tree references being iterated
 */

import { ColorDef } from "@itwin/core-common";
import {
  BeButtonEvent, DecorateContext, Decorator, DynamicsContext, EventHandled,
  GraphicType, IModelApp, IpcApp, NotifyMessageDetails, OutputMessagePriority,
  PrimitiveTool, ScreenViewport, Tool,
} from "@itwin/core-frontend";
import { Arc3d, LineString3d, Point3d, Vector3d } from "@itwin/core-geometry";
import { dtaChannel } from "../common/DtaIpcInterface";
import type { CreateReproIModelResult } from "../common/DtaIpcInterface";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface ReproConfig {
  /** Number of connector ports to simulate. Each port has spokes + circle arc. */
  numConnectorPorts: number;
  /** Number of annotation labels (ViewOverlay). */
  numAnnotations: number;
  /** Whether to simulate clash detection CPU overhead per mousemove. */
  clashSimEnabled: boolean;
  /** Approximate ms of CPU work to burn per mousemove for clash simulation. */
  clashSimWorkMs: number;
}

const defaultConfig: ReproConfig = {
  numConnectorPorts: 300,
  numAnnotations: 50,
  clashSimEnabled: true,
  clashSimWorkMs: 2,
};

// ---------------------------------------------------------------------------
// Rate tracker — calculates calls/sec with a sliding window
// ---------------------------------------------------------------------------

class RateTracker {
  private _calls = 0;
  private _windowStart = performance.now();
  public rate = 0;

  public count(): void {
    this._calls++;
    const now = performance.now();
    const elapsed = now - this._windowStart;
    if (elapsed >= 500) {
      this.rate = (this._calls * 1000) / elapsed;
      this._calls = 0;
      this._windowStart = now;
    }
  }

  public reset(): void {
    this._calls = 0;
    this._windowStart = performance.now();
    this.rate = 0;
  }
}

// ---------------------------------------------------------------------------
// Stats tracker + HUD
// ---------------------------------------------------------------------------

class ReproStats {
  public mode: "fixed" | "regressed" | "decorators-only" = "fixed";
  public config: ReproConfig = { ...defaultConfig };

  public readonly connectorDecorate = new RateTracker();
  public readonly annotationDecorate = new RateTracker();
  public readonly dynamics = new RateTracker();
  public tileTreeRefCount = 0;

  public reset(): void {
    this.connectorDecorate.reset();
    this.annotationDecorate.reset();
    this.dynamics.reset();
    this.tileTreeRefCount = 0;
  }

  public drawHud(ctx: CanvasRenderingContext2D): void {
    const x = 10;
    let y = 24;
    const lineH = 18;
    const isRegressed = this.mode === "regressed";

    ctx.save();
    ctx.font = "bold 12px monospace";

    // Background
    const numLines = 9;
    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.fillRect(x - 6, y - 16, 440, lineH * numLines + 8);

    // Title
    ctx.fillStyle = "#00ff88";
    ctx.fillText("Issue #1659 repro — Substation+ simulation", x, y); y += lineH;

    // Mode
    ctx.fillStyle = isRegressed ? "#ff4444" : "#44ff44";
    ctx.fillText(`mode: ${isRegressed ? "REGRESSED (old bug — invalidateDecorations)" : "FIXED (requestRedraw)"}`, x, y); y += lineH;

    // Dynamics rate
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`dynamics/sec: ${this.dynamics.rate.toFixed(0)}  (move mouse after click)`, x, y); y += lineH;

    // Connector decorator rate
    ctx.fillStyle = isRegressed ? "#ff8844" : "#88ff88";
    ctx.fillText(`connector decorate/sec: ${this.connectorDecorate.rate.toFixed(0)}  (${this.config.numConnectorPorts} ports, uncached)`, x, y); y += lineH;

    // Annotation decorator rate
    ctx.fillStyle = "#aaaaff";
    ctx.fillText(`annotation decorate/sec: ${this.annotationDecorate.rate.toFixed(0)}  (${this.config.numAnnotations} labels, cached)`, x, y); y += lineH;

    // Tile tree refs
    ctx.fillStyle = "#ffff88";
    ctx.fillText(`tile tree refs: ${this.tileTreeRefCount}`, x, y); y += lineH;

    // Clash sim
    ctx.fillStyle = "#bbbbbb";
    ctx.fillText(`clash sim: ${this.config.clashSimEnabled ? `${this.config.clashSimWorkMs}ms/move` : "off"}`, x, y); y += lineH;

    // Expected behavior
    y += 4;
    ctx.fillStyle = "#888888";
    if (isRegressed)
      ctx.fillText("⚠ Connector decorate/sec should be HIGH (forced rebuilds)", x, y);
    else
      ctx.fillText("✓ Connector decorate/sec should be ~0 (cached between moves)", x, y);

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// ConnectorPortDecorator — simulates Substation+'s ConnectorDecorator
//
// Key: useCachedDecorations = false (matching S+ exactly)
// This means decorate() is called on EVERY frame when invalidateDecorations()
// fires, rebuilding all port graphics from scratch.
// ---------------------------------------------------------------------------

interface ConnectorPort {
  center: Point3d;
  radius: number;
}

class ConnectorPortDecorator implements Decorator {
  /** Matches S+'s ConnectorDecorator: NO caching — omit useCachedDecorations
   * so decorate() is called every frame when decorations are invalidated. */

  private _ports: ConnectorPort[] = [];
  private readonly _stats: ReproStats;

  constructor(stats: ReproStats, numPorts: number) {
    this._stats = stats;
    this._generatePorts(numPorts);
  }

  private _generatePorts(numPorts: number): void {
    this._ports = [];
    const gridSize = Math.ceil(Math.sqrt(numPorts));
    const spacing = 5.0;

    for (let i = 0; i < numPorts; i++) {
      const col = i % gridSize;
      const row = Math.floor(i / gridSize);
      this._ports.push({
        center: Point3d.create(col * spacing, row * spacing, 0),
        radius: 0.3 + (i % 3) * 0.1,
      });
    }
  }

  public decorate(context: DecorateContext): void {
    this._stats.connectorDecorate.count();

    const builder = context.createGraphic({ type: GraphicType.WorldOverlay });

    for (const port of this._ports) {
      const c = port.center;
      const r = port.radius;

      // 4 spoke lines radiating from center (matching S+ ConnectorDecorator pattern)
      const spokeColor = ColorDef.from(80, 220, 80);
      builder.setSymbology(spokeColor, ColorDef.black, 2);

      builder.addLineString([
        Point3d.create(c.x - r, c.y, c.z),
        Point3d.create(c.x + r, c.y, c.z),
      ]);
      builder.addLineString([
        Point3d.create(c.x, c.y - r, c.z),
        Point3d.create(c.x, c.y + r, c.z),
      ]);
      // Diagonal spokes
      const d = r * 0.707;
      builder.addLineString([
        Point3d.create(c.x - d, c.y - d, c.z),
        Point3d.create(c.x + d, c.y + d, c.z),
      ]);
      builder.addLineString([
        Point3d.create(c.x + d, c.y - d, c.z),
        Point3d.create(c.x - d, c.y + d, c.z),
      ]);

      // Circle arc around the port
      const circleColor = ColorDef.from(60, 200, 255);
      builder.setSymbology(circleColor, ColorDef.black, 1);
      const numSegments = 16;
      const circlePts: Point3d[] = [];
      for (let s = 0; s <= numSegments; s++) {
        const angle = (s / numSegments) * Math.PI * 2;
        circlePts.push(Point3d.create(
          c.x + r * Math.cos(angle),
          c.y + r * Math.sin(angle),
          c.z,
        ));
      }
      builder.addLineString(circlePts);
    }

    context.addDecoration(GraphicType.WorldOverlay, builder.finish());
  }
}

// ---------------------------------------------------------------------------
// AnnotationDecorator — cached ViewOverlay (simulates annotation labels)
//
// Key: useCachedDecorations = true — these survive invalidateDecorations()
// until cache is explicitly cleared. Rebuilds are cheap comparatively.
// ---------------------------------------------------------------------------

interface AnnotationLabel {
  worldPos: Point3d;
  text: string;
}

class AnnotationDecorator implements Decorator {
  public readonly useCachedDecorations = true;
  private _labels: AnnotationLabel[] = [];
  private readonly _stats: ReproStats;

  constructor(stats: ReproStats, numLabels: number) {
    this._stats = stats;
    this._generateLabels(numLabels);
  }

  private _generateLabels(numLabels: number): void {
    this._labels = [];
    for (let i = 0; i < numLabels; i++) {
      this._labels.push({
        worldPos: Point3d.create((i % 10) * 8, Math.floor(i / 10) * 8, 0),
        text: `EQ-${i.toString().padStart(3, "0")}`,
      });
    }
  }

  public decorate(context: DecorateContext): void {
    this._stats.annotationDecorate.count();

    // Build label underlines and tick marks in view overlay
    const builder = context.createGraphic({ type: GraphicType.ViewOverlay });
    builder.setSymbology(ColorDef.from(255, 255, 200), ColorDef.black, 1);

    for (const label of this._labels) {
      // Project world position to view coordinates for the overlay
      const viewPt = context.viewport.worldToView(label.worldPos);
      const x = viewPt.x;
      const y = viewPt.y;

      // Label underline
      builder.addLineString([
        Point3d.create(x, y, 0),
        Point3d.create(x + 40, y, 0),
      ]);
      // Tick mark
      builder.addLineString([
        Point3d.create(x, y - 3, 0),
        Point3d.create(x, y + 3, 0),
      ]);
    }

    context.addDecoration(GraphicType.ViewOverlay, builder.finish());
  }
}

// ---------------------------------------------------------------------------
// StatusBadgeDecorator — canvas decorations for equipment status indicators
// ---------------------------------------------------------------------------

class StatusBadgeDecorator implements Decorator {
  private readonly _badgeCount: number;

  constructor(badgeCount: number) {
    this._badgeCount = badgeCount;
  }

  public decorate(context: DecorateContext): void {
    const count = this._badgeCount;
    context.addCanvasDecoration({
      drawDecoration: (ctx: CanvasRenderingContext2D) => {
        ctx.save();
        ctx.font = "9px monospace";
        for (let i = 0; i < count; i++) {
          const x = 460 + (i % 4) * 14;
          const y = 20 + Math.floor(i / 4) * 14;
          ctx.fillStyle = i % 3 === 0 ? "#44ff44" : i % 3 === 1 ? "#ffff44" : "#ff4444";
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Simulated clash detection — burns CPU on each mousemove
// ---------------------------------------------------------------------------

function simulateClashDetection(config: ReproConfig): void {
  if (!config.clashSimEnabled)
    return;

  // Burn CPU for approximately config.clashSimWorkMs milliseconds.
  // This simulates S+'s ClashDetectionManager.checkForClashes() which runs
  // backend spatial queries on every mouse motion during move/copy.
  const start = performance.now();
  const target = start + config.clashSimWorkMs;
  let accumulator = 0;
  while (performance.now() < target) {
    accumulator += Math.sin(accumulator + 1);
  }
  // Prevent dead code elimination
  if (accumulator === Infinity) throw new Error("impossible");
}

// ---------------------------------------------------------------------------
// PrimitiveTool — uses the real dynamics pipeline (onDynamicFrame)
//
// Mirrors the TransformElementsTool / MoveElementsTool3d flow:
//   1. Tool installs, user clicks to start dynamics (like picking anchor point)
//   2. Mouse motion → ToolAdmin.updateDynamics → onDynamicFrame(ev, context)
//   3. Tool adds dynamic graphics to DynamicsContext
//   4. DynamicsContext.changeDynamics() → Viewport.changeDynamics()
//   5. In old code, changeDynamics called invalidateDecorations() (the bug)
//   6. In fix, it calls requestRedraw() instead
//
// The dynamic graphic simulates what TransformGraphicsProvider would build:
// multiple shapes representing equipment being moved.
// ---------------------------------------------------------------------------

class Repro1659DynamicsTool extends PrimitiveTool {
  public static override toolId = "Repro1659Dynamics";

  private _stats: ReproStats;
  private _simulateRegression: boolean;

  constructor(stats: ReproStats, simulateRegression: boolean) {
    super();
    this._stats = stats;
    this._simulateRegression = simulateRegression;
  }

  public override requireWriteableTarget(): boolean { return false; }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();
    IModelApp.accuSnap.enableSnap(true);
  }

  /** First click starts dynamics (analogous to setting anchor point in MoveElementsTool3d). */
  public override async onDataButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    if (!this.isDynamicsStarted)
      this.beginDynamics();
    return EventHandled.No;
  }

  /**
   * Called by ToolAdmin.updateDynamics on every mouse motion while dynamics are active.
   * Builds a multi-shape dynamic graphic simulating TransformGraphicsProvider's output
   * for a complex equipment symbol being moved.
   */
  public override onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    this._stats.dynamics.count();

    // Simulate clash detection overhead (S+ does this on every mousemove)
    simulateClashDetection(this._stats.config);

    // Build dynamic graphics simulating a complex equipment preview.
    // TransformGraphicsProvider builds a GraphicBranch with all selected
    // elements' graphics transformed to the new position.
    const builder = context.createSceneGraphicBuilder();
    const p = ev.point;

    // Main equipment body outline
    builder.setSymbology(ColorDef.from(255, 100, 100), ColorDef.from(255, 100, 100), 2);
    const size = 0.5;
    builder.addShape([
      Point3d.create(p.x - size, p.y - size, p.z),
      Point3d.create(p.x + size, p.y - size, p.z),
      Point3d.create(p.x + size, p.y + size, p.z),
      Point3d.create(p.x - size, p.y + size, p.z),
      Point3d.create(p.x - size, p.y - size, p.z),
    ]);

    // Connector stubs (like S+ equipment with cable connections)
    builder.setSymbology(ColorDef.from(100, 255, 100), ColorDef.black, 1);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const stubStart = Point3d.create(
        p.x + size * Math.cos(angle),
        p.y + size * Math.sin(angle),
        p.z,
      );
      const stubEnd = Point3d.create(
        p.x + (size + 0.3) * Math.cos(angle),
        p.y + (size + 0.3) * Math.sin(angle),
        p.z,
      );
      builder.addLineString([stubStart, stubEnd]);
    }

    // Inner detail lines (simulating complex symbol)
    builder.setSymbology(ColorDef.from(200, 200, 100), ColorDef.black, 1);
    builder.addLineString([
      Point3d.create(p.x - size * 0.5, p.y, p.z),
      Point3d.create(p.x + size * 0.5, p.y, p.z),
    ]);
    builder.addLineString([
      Point3d.create(p.x, p.y - size * 0.5, p.z),
      Point3d.create(p.x, p.y + size * 0.5, p.z),
    ]);

    context.addGraphic(builder.finish());

    // In "regressed" mode, simulate the old bug: Viewport.changeDynamics()
    // used to call invalidateDecorations() which forces ALL decorators to
    // rebuild on every mouse move.
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
  private readonly _stats = new ReproStats();
  private readonly _registeredDecorators: Decorator[] = [];
  private _vp?: ScreenViewport;
  private _removeCloseListener?: () => void;

  /** Add decorators only (no dynamics tool) — use with `dta interactive move` for realistic repro. */
  public addDecoratorsOnly(vp: ScreenViewport): void {
    if (this._vp)
      this.stop();

    this._vp = vp;
    this._stats.mode = "decorators-only";
    this._stats.reset();

    let refCount = 0;
    for (const _ref of vp.getTileTreeRefs())
      refCount++;
    this._stats.tileTreeRefCount = refCount;

    // --- HUD overlay decorator ---
    const stats = this._stats;
    const hudDec: Decorator = {
      decorate(ctx: DecorateContext) {
        ctx.addCanvasDecoration({ drawDecoration: (c) => stats.drawHud(c) });
      },
    };
    IModelApp.viewManager.addDecorator(hudDec);
    this._registeredDecorators.push(hudDec);

    // --- ConnectorPortDecorator (matches S+ ConnectorDecorator) ---
    const connectorDec = new ConnectorPortDecorator(stats, stats.config.numConnectorPorts);
    IModelApp.viewManager.addDecorator(connectorDec);
    this._registeredDecorators.push(connectorDec);

    // --- AnnotationDecorator (cached ViewOverlay) ---
    const annotationDec = new AnnotationDecorator(stats, stats.config.numAnnotations);
    IModelApp.viewManager.addDecorator(annotationDec);
    this._registeredDecorators.push(annotationDec);

    // --- StatusBadgeDecorator (canvas decorations) ---
    const statusDec = new StatusBadgeDecorator(20);
    IModelApp.viewManager.addDecorator(statusDec);
    this._registeredDecorators.push(statusDec);

    this._removeCloseListener = vp.iModel.onClose.addOnce(() => this.stop());

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info,
      `[#1659] Decorators added (${refCount} tile tree refs, ${stats.config.numConnectorPorts} ports). Now use "dta interactive move" to test.`,
    ));
  }

  public start(vp: ScreenViewport, regress: boolean): void {
    if (this._vp)
      this.stop();

    this._vp = vp;
    this._stats.mode = regress ? "regressed" : "fixed";
    this._stats.reset();

    // Count tile tree refs for the HUD
    let refCount = 0;
    for (const _ref of vp.getTileTreeRefs())
      refCount++;
    this._stats.tileTreeRefCount = refCount;

    // --- HUD overlay decorator ---
    const stats = this._stats;
    const hudDec: Decorator = {
      decorate(ctx: DecorateContext) {
        ctx.addCanvasDecoration({ drawDecoration: (c) => stats.drawHud(c) });
      },
    };
    IModelApp.viewManager.addDecorator(hudDec);
    this._registeredDecorators.push(hudDec);

    // --- ConnectorPortDecorator (matches S+ ConnectorDecorator) ---
    // useCachedDecorations = false — decorate() called on every invalidation
    const connectorDec = new ConnectorPortDecorator(stats, stats.config.numConnectorPorts);
    IModelApp.viewManager.addDecorator(connectorDec);
    this._registeredDecorators.push(connectorDec);

    // --- AnnotationDecorator (cached ViewOverlay) ---
    const annotationDec = new AnnotationDecorator(stats, stats.config.numAnnotations);
    IModelApp.viewManager.addDecorator(annotationDec);
    this._registeredDecorators.push(annotationDec);

    // --- StatusBadgeDecorator (canvas decorations) ---
    const statusDec = new StatusBadgeDecorator(20);
    IModelApp.viewManager.addDecorator(statusDec);
    this._registeredDecorators.push(statusDec);

    // --- Install the dynamics tool ---
    const tool = new Repro1659DynamicsTool(stats, regress);
    void tool.run();

    this._removeCloseListener = vp.iModel.onClose.addOnce(() => this.stop());

    const modeStr = regress ? "REGRESSED (simulating old bug)" : "FIXED";
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info,
      `[#1659] Started — mode: ${modeStr}. ${refCount} tile tree refs. Click to begin dynamics, then move mouse. Right-click to stop.`,
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

    void IModelApp.toolAdmin.startDefaultTool();

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info, "[#1659] Stopped."));
  }

  public get isRunning(): boolean { return this._vp !== undefined; }
  public get config(): ReproConfig { return this._stats.config; }
}

const _manager = new Repro1659Manager();

// ---------------------------------------------------------------------------
// Tool — key-in: "dta repro 1659 [create|start|regress|stop]"
// ---------------------------------------------------------------------------

export class ReproIssue1659Tool extends Tool {
  public static override toolId = "ReproIssue1659";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 3; }

  public override async run(action = "toggle", ...rest: string[]): Promise<boolean> {
    if (action === "create")
      return this._handleCreate(rest);

    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(
        OutputMessagePriority.Warning, "No active viewport — open an iModel or the empty example first."));
      return false;
    }

    switch (action) {
      case "start":    _manager.start(vp, false); break;
      case "regress":  _manager.start(vp, true); break;
      case "decorate": _manager.addDecoratorsOnly(vp); break;
      case "stop":     _manager.stop(); break;
      case "config":   this._handleConfig(rest); break;
      default:         _manager.isRunning ? _manager.stop() : _manager.start(vp, false); break;
    }
    return true;
  }

  private async _handleCreate(args: string[]): Promise<boolean> {
    const numModels = args.length > 0 ? parseInt(args[0], 10) : 30;
    const elementsPerModel = args.length > 1 ? parseInt(args[1], 10) : 50;

    if (isNaN(numModels) || isNaN(elementsPerModel) || numModels < 1 || elementsPerModel < 1) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(
        OutputMessagePriority.Warning, "Usage: dta repro 1659 create [numModels] [elementsPerModel]"));
      return false;
    }

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info, `[#1659] Creating iModel: ${numModels} models × ${elementsPerModel} elements...`));

    try {
      const result: CreateReproIModelResult = await IpcApp.callIpcChannel(dtaChannel, "createReproIModel", numModels, elementsPerModel);
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(
        OutputMessagePriority.Info,
        `[#1659] Created: ${result.filePath} (${result.numModels} models, ${result.totalElements} elements). Use "dta file open ${result.filePath}" to open it.`,
      ));
      return true;
    } catch (err: any) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(
        OutputMessagePriority.Error, `[#1659] Failed to create iModel: ${err.message ?? err}`));
      return false;
    }
  }

  private _handleConfig(args: string[]): void {
    if (args.length < 2) {
      const c = _manager.config;
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(
        OutputMessagePriority.Info,
        `[#1659] Config: connectors=${c.numConnectorPorts}, annotations=${c.numAnnotations}, clashSim=${c.clashSimEnabled ? `${c.clashSimWorkMs}ms` : "off"}`));
      return;
    }

    const [param, value] = args;
    const c = _manager.config;
    switch (param) {
      case "connectors":  c.numConnectorPorts = parseInt(value, 10); break;
      case "annotations": c.numAnnotations = parseInt(value, 10); break;
      case "clashSim":    c.clashSimEnabled = value !== "off"; c.clashSimWorkMs = value === "off" ? 0 : parseInt(value, 10) || 2; break;
      default:
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(
          OutputMessagePriority.Warning, `[#1659] Unknown config param: ${param}. Use: connectors, annotations, clashSim`));
        return;
    }

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info, `[#1659] Config updated: ${param}=${value}. Restart repro to apply.`));
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0], ...args.slice(1));
  }
}
