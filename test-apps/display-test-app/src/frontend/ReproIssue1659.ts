/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Reproduction for desktop perf issue.
 *   Move/copy operations on desktop app symbols became slow after upgrading 4.11 → 5.2.
 *
 * This reproduction closely mirrors the desktop app workflow:
 *   - ConnectorPortDecorator: Matches the app's ConnectorDecorator pattern
 *     (useCachedDecorations=false, WorldOverlay, line+arc geometry per connector port)
 *   - AnnotationDecorator: Cached ViewOverlay labels (common in engineering apps)
 *   - StatusBadgeDecorator: Canvas decorations for equipment status
 *   - Programmatic iModel: Many physical models → many tile tree references
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
 *   dta repro 1659 start        — add decorators + HUD, then use real tools (e.g. dta interactive move)
 *   dta repro 1659 toggle       — toggle BOTH fixes between fixed/regressed (hits actual code)
 *   dta repro 1659 toggle dynamics    — toggle only the changeDynamics fix
 *   dta repro 1659 toggle decorations — toggle only the addDecorations fix
 *   dta repro 1659 stop         — stop and remove all decorators
 *
 * WORKFLOW:
 *   1. dta repro 1659 create 30 50
 *   2. Open the .bim file
 *   3. dta edit                    (start editing session)
 *   4. dta repro 1659 start        (add desktop-app-like decorators + HUD)
 *   5. Select some elements
 *   6. dta interactive move         (real TransformElementsTool)
 *   7. Click anchor → drag mouse → observe HUD metrics
 *   8. dta repro 1659 toggle        (switch addDecorations to old getTileTreeRefs path)
 *   9. Repeat step 6-7 → compare
 *
 * WHAT TO OBSERVE in the HUD overlay (top-left of viewport):
 *   addDecorations:      "FIXED" or "REGRESSED" — toggles the ACTUAL code path
 *   decorations/frame:   CPU ms spent rebuilding decorations on the latest frame
 *   total frame:         CPU ms spent rendering the latest frame
 *   connector dec/sec:   ConnectorPortDecorator.decorate() calls per second
 *   annotation dec/sec:  AnnotationDecorator.decorate() calls per second
 *   ref breakdown:       view vs map vs tiled-graphics-provider refs
 */

import { ColorDef } from "@itwin/core-common";
import {
  DecorateContext, Decorator,
  type FrameStats,
  GraphicType, IModelApp, NotifyMessageDetails, OutputMessagePriority,
  ScreenViewport, Tool,
} from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { dtaIpc } from "./App";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface ReproConfig {
  /** Number of connector ports to simulate. Each port has spokes + circle arc. */
  numConnectorPorts: number;
  /** Number of annotation labels (ViewOverlay). */
  numAnnotations: number;
}

const defaultConfig: ReproConfig = {
  numConnectorPorts: 300,
  numAnnotations: 50,
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
  public config: ReproConfig = { ...defaultConfig };

  public readonly connectorDecorate = new RateTracker();
  public readonly annotationDecorate = new RateTracker();
  public viewTileTreeRefCount = 0;
  public mapTileTreeRefCount = 0;
  public providerTileTreeRefCount = 0;
  public decorationsTimeMs = 0;
  public totalFrameTimeMs = 0;

  public reset(): void {
    this.connectorDecorate.reset();
    this.annotationDecorate.reset();
    this.viewTileTreeRefCount = 0;
    this.mapTileTreeRefCount = 0;
    this.providerTileTreeRefCount = 0;
    this.decorationsTimeMs = 0;
    this.totalFrameTimeMs = 0;
  }

  public updateFrameStats(stats: Readonly<FrameStats>): void {
    this.decorationsTimeMs = stats.decorationsTime;
    this.totalFrameTimeMs = stats.totalFrameTime;
  }

  public setTileTreeRefCounts(viewCount: number, mapCount: number, providerCount: number): void {
    this.viewTileTreeRefCount = viewCount;
    this.mapTileTreeRefCount = mapCount;
    this.providerTileTreeRefCount = providerCount;
  }

  public drawHud(ctx: CanvasRenderingContext2D): void {
    const x = 10;
    let y = 24;
    const lineH = 18;
    const rm = ScreenViewport.regressMode;
    const fixedRefCount = this.mapTileTreeRefCount + this.providerTileTreeRefCount;
    const regressedRefCount = this.viewTileTreeRefCount + fixedRefCount;

    ctx.save();
    ctx.font = "bold 12px monospace";

    // Background
    const numLines = 10;
    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.fillRect(x - 6, y - 16, 760, lineH * numLines + 8);

    // Title
    ctx.fillStyle = "#00ff88";
    ctx.fillText("Issue #1659 repro — desktop app simulation", x, y); y += lineH;

    // changeDynamics toggle — reads ACTUAL state
    ctx.fillStyle = rm.changeDynamics ? "#ff4444" : "#44ff44";
    ctx.fillText(`changeDynamics: ${rm.changeDynamics ? "REGRESSED (invalidateDecorations)" : "FIXED (requestRedraw)"}`, x, y); y += lineH;

    // addDecorations toggle — reads ACTUAL state
    ctx.fillStyle = rm.addDecorations ? "#ff4444" : "#44ff44";
    ctx.fillText(`addDecorations: ${rm.addDecorations ? "REGRESSED (old getTileTreeRefs iteration)" : "FIXED (map+provider only)"}`, x, y); y += lineH;

    // Timing metrics
    ctx.fillStyle = "#ffaa66";
    ctx.fillText(`decorations/frame: ${this.decorationsTimeMs.toFixed(2)} ms`, x, y); y += lineH;

    ctx.fillStyle = "#ff88cc";
    ctx.fillText(`total frame: ${this.totalFrameTimeMs.toFixed(2)} ms`, x, y); y += lineH;

    // Connector decorator rate
    ctx.fillStyle = "#ffcc44";
    ctx.fillText(`connector decorate/sec: ${this.connectorDecorate.rate.toFixed(0)}  (${this.config.numConnectorPorts} ports, uncached)`, x, y); y += lineH;

    // Annotation decorator rate
    ctx.fillStyle = "#aaaaff";
    ctx.fillText(`annotation decorate/sec: ${this.annotationDecorate.rate.toFixed(0)}  (${this.config.numAnnotations} labels, cached)`, x, y); y += lineH;

    // Tile tree ref breakdown + branch-specific iteration counts
    ctx.fillStyle = "#ffff88";
    ctx.fillText(`ref breakdown: view=${this.viewTileTreeRefCount}, map=${this.mapTileTreeRefCount}, provider=${this.providerTileTreeRefCount}`, x, y); y += lineH;

    ctx.fillStyle = "#88ffff";
    ctx.fillText(`addDecorations iterates: fixed=${fixedRefCount}, regressed=${regressedRefCount}`, x, y); y += lineH;

    // Instructions
    ctx.fillStyle = "#888888";
    ctx.fillText(`Toggle: "dta repro 1659 toggle [dynamics|decorations|both]"`, x, y);

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// ConnectorPortDecorator — simulates the app's ConnectorDecorator
//
// Key: useCachedDecorations = false (matching the app exactly)
// This means decorate() is called on EVERY frame when invalidateDecorations()
// fires, rebuilding all port graphics from scratch.
// ---------------------------------------------------------------------------

interface ConnectorPort {
  center: Point3d;
  radius: number;
}

class ConnectorPortDecorator implements Decorator {
  /** Matches the app's ConnectorDecorator: NO caching — omit useCachedDecorations
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

      // 4 spoke lines radiating from center (matching the app's ConnectorDecorator pattern)
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
// Reproduction manager
// ---------------------------------------------------------------------------

class Repro1659Manager {
  private readonly _stats = new ReproStats();
  private readonly _registeredDecorators: Decorator[] = [];
  private _vp?: ScreenViewport;
  private _removeCloseListener?: () => void;
  private _removeFrameStatsListener?: () => void;

  private _updateTileTreeRefStats(vp: ScreenViewport): void {
    let totalCount = 0;
    for (const _ref of vp.getTileTreeRefs())
      totalCount++;

    let viewCount = 0;
    for (const _ref of vp.view.getTileTreeRefs())
      viewCount++;

    let mapCount = 0;
    for (const _ref of vp.mapTileTreeRefs)
      mapCount++;

    const providerCount = Math.max(0, totalCount - viewCount - mapCount);
    this._stats.setTileTreeRefCounts(viewCount, mapCount, providerCount);
  }

  /** Add decorators + HUD. Then use real tools (dta interactive move) to test. */
  public start(vp: ScreenViewport): void {
    if (this._vp)
      this.stop();

    this._vp = vp;
    this._stats.reset();
    this._updateTileTreeRefStats(vp);
    this._removeFrameStatsListener = vp.onFrameStats.addListener((frameStats) => this._stats.updateFrameStats(frameStats));

    // --- HUD overlay decorator ---
    const stats = this._stats;
    const hudDec: Decorator = {
      decorate(ctx: DecorateContext) {
        ctx.addCanvasDecoration({ drawDecoration: (c) => stats.drawHud(c) });
      },
    };
    IModelApp.viewManager.addDecorator(hudDec);
    this._registeredDecorators.push(hudDec);

    // --- ConnectorPortDecorator (matches the app's ConnectorDecorator) ---
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

    this._removeCloseListener = vp.iModel.onClose.addOnce(() => this.stop());

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info,
      `[#1659] Started (view=${stats.viewTileTreeRefCount}, map=${stats.mapTileTreeRefCount}, provider=${stats.providerTileTreeRefCount}; ${stats.config.numConnectorPorts} ports). Use real tools (dta interactive move) to test. Toggle with "dta repro 1659 toggle".`,
    ));
  }

  public stop(): void {
    ScreenViewport.regressMode.changeDynamics = false;
    ScreenViewport.regressMode.addDecorations = false;

    if (this._vp) {
      this._vp = undefined;
    }

    for (const dec of this._registeredDecorators)
      IModelApp.viewManager.dropDecorator(dec);
    this._registeredDecorators.length = 0;

    this._removeCloseListener?.();
    this._removeCloseListener = undefined;
    this._removeFrameStatsListener?.();
    this._removeFrameStatsListener = undefined;

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info, "[#1659] Stopped."));
  }

  /** Toggle the actual code paths between old and fixed behavior.
   * @param which - "dynamics" toggles changeDynamics, "decorations" toggles addDecorations, "both" toggles both.
   */
  public toggle(which: "dynamics" | "decorations" | "both" = "both"): void {
    if (!this._vp) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(
        OutputMessagePriority.Warning, "[#1659] Not running. Use 'start' first."));
      return;
    }

    const rm = ScreenViewport.regressMode;
    if (which === "dynamics" || which === "both")
      rm.changeDynamics = !rm.changeDynamics;
    if (which === "decorations" || which === "both")
      rm.addDecorations = !rm.addDecorations;

    this._updateTileTreeRefStats(this._vp);
    this._vp.requestRedraw();

    const dynStr = rm.changeDynamics ? "REGRESSED" : "FIXED";
    const decStr = rm.addDecorations ? "REGRESSED" : "FIXED";
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info, `[#1659] changeDynamics: ${dynStr}, addDecorations: ${decStr}`));
  }

  public get isRunning(): boolean { return this._vp !== undefined; }
  public get config(): ReproConfig { return this._stats.config; }
}

const _manager = new Repro1659Manager();

// ---------------------------------------------------------------------------
// Tool — key-in: "dta repro 1659 [create|start|toggle|stop|config]"
// ---------------------------------------------------------------------------

export class ReproIssue1659Tool extends Tool {
  public static override toolId = "ReproIssue1659";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 3; }

  public override async run(action = "start", ...rest: string[]): Promise<boolean> {
    if (action === "create")
      return this._handleCreate(rest);

    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(
        OutputMessagePriority.Warning, "No active viewport — open an iModel or the empty example first."));
      return false;
    }

    switch (action) {
      case "start":    _manager.start(vp); break;
      case "toggle":   _manager.toggle(rest[0] as "dynamics" | "decorations" | "both" ?? "both"); break;
      case "stop":     _manager.stop(); break;
      case "config":   this._handleConfig(rest); break;
      default:         _manager.isRunning ? _manager.stop() : _manager.start(vp); break;
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
      const result = await dtaIpc.createReproIModel(numModels, elementsPerModel);
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
      const currentConfig = _manager.config;
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(
        OutputMessagePriority.Info,
        `[#1659] Config: connectors=${currentConfig.numConnectorPorts}, annotations=${currentConfig.numAnnotations}`));
      return;
    }

    const [param, value] = args;
    const config = _manager.config;
    switch (param) {
      case "connectors":  config.numConnectorPorts = parseInt(value, 10); break;
      case "annotations": config.numAnnotations = parseInt(value, 10); break;
      default:
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(
          OutputMessagePriority.Warning, `[#1659] Unknown config param: ${param}. Use: connectors, annotations`));
        return;
    }

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info, `[#1659] Config updated: ${param}=${value}. Restart repro to apply.`));
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0], ...args.slice(1));
  }
}
