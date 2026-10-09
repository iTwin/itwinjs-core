/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d, XYZProps } from "@itwin/core-geometry";
import { IModelApp } from "../../IModelApp";
import { ScreenViewport } from "../../Viewport";
import { ViewRect } from "../../common/ViewRect";
import { imageBufferToCanvas } from "../../common/ImageUtil";
import { GaussianSplatFrameState, observeGaussianSplats } from "./GaussianSplatDiagnostics";
import { System } from "./webgl/System";

/** A pixel oracle for an original deterministic fixture, evaluated at the current camera pose. @internal */
export interface GaussianSplatPixelProbe {
  name: string;
  point: XYZProps;
  rgb: number[];
  tolerance: number;
}

/** @internal */
export interface GaussianSplatValidationFrame {
  index: number;
  time: number;
  camera: XYZProps[];
  size: number[];
  selected: Array<{ id: string, depth: number, modelId: string }>;
  readyTiles: number;
  draw?: Readonly<GaussianSplatFrameState>;
  expectedVisible: boolean;
  expectation: string;
  viewFlags: unknown;
  clip: unknown;
  probes: Array<{ name: string, actual?: number[], expected: number[], tolerance: number }>;
  foregroundFraction?: number;
  meanLuminance?: number;
  cpuFrameMs?: number;
}

/** @internal */
export interface GaussianSplatValidationIssue {
  frame: number;
  severity: "failure" | "suspect";
  code: "missing-field" | "pixel-mismatch" | "pick-mismatch" | "readback-missing" | "coverage-drop";
  detail: string;
}

/** @internal */
export interface GaussianSplatValidationTrace {
  version: 1;
  configuration: {
    label: string;
    mode: "visual" | "timing";
    browser: string;
    renderer: string;
    viewportSize: number[];
    framebufferSize: number[];
    devicePixelRatio: number;
    tileSizeModifier: number;
    backgroundRgb: number[];
    viewFlags: unknown;
    backgroundMap: { terrain: boolean, depth: boolean, groundBias: number, terrainSettings: unknown };
    tileMemoryLimit: string | number;
    maxTileContentBytes: number | null;
    longTaskSupported: boolean;
    cacheState: "cold" | "warm" | "unknown";
    contentHashes: Array<{ name: string, sha256: string }>;
    replay?: { seed: number, sortDelayFrames: number, staggeredChildren: boolean };
    route?: "recorded-camera-poses";
  };
  frames: GaussianSplatValidationFrame[];
  issues: GaussianSplatValidationIssue[];
  images: Array<{ frame: number, url: string }>;
  pickEvidence?: Array<{ frame: number, modelId?: string, elementId?: string }>;
  timings: { animationFrameMs: number[], inputToNextFrameMs: number[], longTaskMs: number[], pendingInputs: number, oldestPendingInputMs?: number };
  summary: {
    nativeFrames: number;
    completedSelections: number;
    settledReplacementFrames: number;
    deepestSelectedTile: number;
    pendingCandidateFrames: number;
    peakAtlasBytes: number;
    peakPackedSplatBytes: number;
    frameGapP95Ms?: number;
    frameGapP99Ms?: number;
    inputP95Ms?: number;
    longTaskTotalMs: number;
    submissionContinuity: "pass" | "fail" | "unverified";
    continuity: "pass" | "fail" | "unverified";
    fidelity: "observed-refinement" | "unverified";
  };
}

function percentile(values: number[], fraction: number): number | undefined {
  if (!values.length)
    return undefined;
  return values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
}

// A native contentId can be a signed URL. Store opaque IDs without copying URLs or query credentials.
function tileId(id: string): string {
  if (/^[\w.-]+$/.test(id))
    return id;
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++)
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return `opaque-${(hash >>> 0).toString(16)}`;
}

/** Records native draws, optional framebuffer evidence, and browser timing independently of picking.
 * This is an internal validation utility; the visual mode performs intrusive GPU readbacks.
 * @internal
 */
export class GaussianSplatValidationRecorder implements Disposable {
  public expectedVisible = false;
  public expectation = "Unclassified live scene; coverage changes require inspection";
  public probes: GaussianSplatPixelProbe[] = [];
  public readonly frames: GaussianSplatValidationFrame[] = [];
  public readonly issues: GaussianSplatValidationIssue[] = [];
  private _draw?: Readonly<GaussianSplatFrameState>;
  private readonly _remove: Array<() => void> = [];
  private readonly _images = new Map<number, string>();
  private readonly _milestones = new Map<number, string>();
  private readonly _failureImages = new Map<number, string>();
  private _saveThrough = -1;
  private readonly _limitTimer: number;
  private readonly _animationFrameMs: number[] = [];
  private readonly _inputToNextFrameMs: number[] = [];
  private readonly _longTaskMs: number[] = [];
  private _animationFrame = 0;
  private _lastAnimationTime?: number;
  private readonly _inputs: number[] = [];
  private _performanceObserver?: PerformanceObserver;
  private _stopped = false;
  private _stopTime?: number;
  private readonly _configuration: GaussianSplatValidationTrace["configuration"];

  public constructor(private readonly _viewport: ScreenViewport, label: string, mode: "visual" | "timing", cacheState: "cold" | "warm" | "unknown" = "unknown") {
    const gl = System.instance.context;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const color = _viewport.view.displayStyle.backgroundColor.colors;
    const map = _viewport.displayStyle.settings.backgroundMap;
    this._configuration = {
      label, mode, browser: navigator.userAgent, renderer: String(gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)),
      viewportSize: [_viewport.viewRect.width, _viewport.viewRect.height], framebufferSize: [_viewport.target.viewRect.width, _viewport.target.viewRect.height], devicePixelRatio: _viewport.devicePixelRatio,
      tileSizeModifier: _viewport.tileSizeModifier, backgroundRgb: [color.r,color.g,color.b], viewFlags: _viewport.viewFlags.toJSON(),
      backgroundMap: { terrain: map.applyTerrain, depth: map.useDepthBuffer, groundBias: map.groundBias, terrainSettings: map.terrainSettings.toJSON() },
      tileMemoryLimit: IModelApp.tileAdmin.gpuMemoryLimit, maxTileContentBytes: IModelApp.tileAdmin.maxTotalTileContentBytes ?? null,
      longTaskSupported: typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask"),
      cacheState, contentHashes: [],
    };
    // Bound accidental unattended recordings, including on-demand scenes with no native redraws.
    this._limitTimer = window.setTimeout(() => this.stop(), 180_000);
    this._remove.push(observeGaussianSplats(_viewport.target, (state) => {
      if (state.phase === "draw")
        this._draw = state;
    }));
    this._remove.push(_viewport.onRender.addListener(() => this.record()));
    this._remove.push(_viewport.onDisposed.addListener(() => this.stop()));
    this._remove.push(_viewport.onFrameStats.addListener((stats) => {
      const frame = this.frames[this.frames.length - 1];
      if (frame)
        frame.cpuFrameMs = stats.totalFrameTime + stats.totalSceneTime;
    }));
    if (mode === "timing") {
      const tick = (time: number) => {
        if (this._stopped)
          return;
        if (this._lastAnimationTime !== undefined)
          this._animationFrameMs.push(time - this._lastAnimationTime);
        this._lastAnimationTime = time;
        this._animationFrame = requestAnimationFrame(tick);
      };
      this._animationFrame = requestAnimationFrame(tick);
      const input = () => this._inputs.push(performance.now());
      for (const type of ["wheel", "pointerdown", "pointermove"]) {
        _viewport.parentDiv.addEventListener(type, input, { capture: true, passive: true });
        this._remove.push(() => _viewport.parentDiv.removeEventListener(type, input, true));
      }
      if (this._configuration.longTaskSupported) {
        this._performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            this._longTaskMs.push(entry.duration);
        });
        this._performanceObserver.observe({ type: "longtask", buffered: false });
      }
    }
  }

  private record(): void {
    const vp = this._viewport;
    const tiles = IModelApp.tileAdmin.getTilesForUser(vp);
    const frame: GaussianSplatValidationFrame = {
      index: this.frames.length, time: performance.now(), camera: vp.getWorldFrustum().points.map((point) => point.toJSON()),
      size: [vp.viewRect.width, vp.viewRect.height], readyTiles: vp.numReadyTiles,
      selected: [...(tiles?.selected ?? [])].map((tile) => ({ id: tileId(tile.contentId), depth: tile.depth, modelId: tile.tree.modelId })),
      draw: this._draw, expectedVisible: this.expectedVisible, expectation: this.expectation,
      viewFlags: vp.viewFlags.toJSON(), clip: vp.view.getViewClip()?.toJSON(), probes: [],
    };
    // A missed Gaussian draw must not inherit the previous frame's successful submission.
    this._draw = undefined;
    this.frames.push(frame);
    for (const input of this._inputs)
      this._inputToNextFrameMs.push(frame.time - input);
    this._inputs.length = 0;
    if (this.frames.length >= 3600)
      this.stop();
    if (frame.expectedVisible && !frame.draw?.drawnInstances)
      this.issues.push({ frame: frame.index, severity: "failure", code: "missing-field", detail: "Known-visible Gaussian field submitted no instances" });
    if (this._configuration.mode !== "visual")
      return;
    for (const probe of this.probes) {
      const npc = vp.worldToNpc(Point3d.fromJSON(probe.point));
      const x = Math.floor(npc.x * vp.viewRect.width), y = Math.floor((1 - npc.y) * vp.viewRect.height);
      const pixelBuffer = x >= 0 && y >= 0 && x < vp.viewRect.width && y < vp.viewRect.height ? vp.readImageBuffer({ rect: new ViewRect(x,y,x+1,y+1) }) : undefined;
      const actual = pixelBuffer ? Array.from(pixelBuffer.data.subarray(0,3)) : undefined;
      frame.probes.push({ name: probe.name, actual, expected: probe.rgb.slice(), tolerance: probe.tolerance });
      if (!actual || actual.some((channel, c) => Math.abs(channel - probe.rgb[c]) > probe.tolerance))
        this.issues.push({ frame: frame.index, severity: "failure", code: "pixel-mismatch", detail: `Pixel oracle ${probe.name} differs from its expected blended color` });
    }
    const buffer = vp.readImageBuffer({ size: { x: 160, y: Math.max(1, Math.round(160 * vp.viewRect.height / vp.viewRect.width)) } });
    const canvas = buffer ? imageBufferToCanvas(buffer) : undefined;
    if (!buffer || !canvas) {
      this.issues.push({ frame: frame.index, severity: frame.expectedVisible || frame.probes.length ? "failure" : "suspect", code: "readback-missing", detail: "Native framebuffer readback unavailable (fully transparent empty views can return no image)" });
      this.captureFailureWindow(frame.index);
      return;
    }
    let foreground = 0, luminance = 0;
    const bg = this._configuration.backgroundRgb;
    for (let i = 0; i < buffer.data.length; i += buffer.numBytesPerPixel) {
      if (Math.abs(buffer.data[i]-bg[0]) + Math.abs(buffer.data[i+1]-bg[1]) + Math.abs(buffer.data[i+2]-bg[2]) > 30)
        foreground++;
      luminance += (buffer.data[i] + buffer.data[i+1] + buffer.data[i+2]) / 3;
    }
    const pixels = buffer.width * buffer.height;
    frame.foregroundFraction = foreground / pixels;
    frame.meanLuminance = luminance / pixels;
    const previous = this.frames[frame.index - 1];
    if (previous?.expectedVisible && frame.expectedVisible && previous.foregroundFraction && previous.foregroundFraction > 0.05 && frame.foregroundFraction < previous.foregroundFraction * 0.25)
      this.issues.push({ frame: frame.index, severity: "suspect", code: "coverage-drop", detail: "Foreground coverage fell sharply; inspect camera, clipping, occlusion, and LOD before classifying" });
    const url = canvas.toDataURL("image/png");
    this._images.set(frame.index, url);
    if (this.issues.some((issue) => issue.frame === frame.index))
      this.captureFailureWindow(frame.index);
    if (frame.index <= this._saveThrough)
      this._failureImages.set(frame.index, url);
    while (this._failureImages.size > 24)
      this._failureImages.delete(this._failureImages.keys().next().value as number);
    if (frame.index === 0 || frame.draw?.completedVersion !== previous?.draw?.completedVersion || this.issues.some((issue) => issue.frame === frame.index)) {
      for (const [index, image] of this._images)
        if (index >= frame.index - 2 && this._milestones.size < 12)
          this._milestones.set(index, image);
    }
    if (this._images.size > 16)
      this._images.delete(this._images.keys().next().value as number);
  }

  private captureFailureWindow(frame: number): void {
    this._saveThrough = frame + 2;
    for (const [index, image] of this._images)
      if (index >= frame - 2)
        this._failureImages.set(index, image);
  }

  public stop(): void {
    if (this._stopped)
      return;
    this._stopped = true;
    this._stopTime = performance.now();
    clearTimeout(this._limitTimer);
    cancelAnimationFrame(this._animationFrame);
    if (this._performanceObserver) {
      for (const entry of this._performanceObserver.takeRecords())
        this._longTaskMs.push(entry.duration);
      this._performanceObserver.disconnect();
    }
    for (const remove of this._remove)
      remove();
    this._remove.length = 0;
  }

  public [Symbol.dispose](): void { this.stop(); }

  public trace(): GaussianSplatValidationTrace {
    const draws = this.frames.flatMap((frame) => frame.draw ? [frame.draw] : []);
    const completed = new Set(draws.filter((draw) => draw.completedVersion > 0 && draw.drawnInstances > 0).map((draw) => draw.completedVersion));
    const expected = this.frames.some((frame) => frame.expectedVisible);
    const pixelOracle = this.frames.some((frame) => frame.probes.length);
    const models = new Set(draws.flatMap((draw) => draw.sourceModelIds));
    const depths = this.frames.flatMap((frame) => frame.selected.filter((tile) => models.has(tile.modelId)).map((tile) => tile.depth));
    const settled = this.frames.filter(({ draw }) => draw && draw.drawnInstances > 0 && draw.coverageComplete && !draw.awaitingCandidate && draw.selectedGeometryIds.length === draw.completedGeometryIds.length
      && draw.selectedGeometryIds.every((id) => draw.completedGeometryIds.includes(id)));
    const levels = new Map<number, Set<number>>();
    for (const frame of settled) {
      const selected = frame.selected.filter((tile) => models.has(tile.modelId));
      if (selected.length) {
        const level = selected.reduce((min, tile) => Math.min(min, tile.depth), Number.POSITIVE_INFINITY);
        const versions = levels.get(level) ?? new Set<number>();
        if (frame.draw)
          versions.add(frame.draw.completedVersion);
        levels.set(level, versions);
      }
    }
    const refined = levels.size > 1 && new Set([...levels.values()].flatMap((versions) => [...versions])).size > 1;
    return {
      version: 1, configuration: this._configuration, frames: this.frames, issues: this.issues,
      images: [...new Map([...this._milestones, ...this._images, ...this._failureImages])].sort(([a], [b]) => a-b).map(([frame, url]) => ({ frame, url })),
      timings: { animationFrameMs: this._animationFrameMs, inputToNextFrameMs: this._inputToNextFrameMs, longTaskMs: this._longTaskMs,
        pendingInputs: this._inputs.length, oldestPendingInputMs: this._inputs.length ? (this._stopTime ?? performance.now()) - this._inputs[0] : undefined },
      summary: {
        nativeFrames: this.frames.length, completedSelections: completed.size, settledReplacementFrames: settled.length,
        deepestSelectedTile: depths.reduce((max, depth) => Math.max(max, depth), 0),
        pendingCandidateFrames: draws.filter((draw) => draw.awaitingCandidate).length,
        peakAtlasBytes: draws.reduce((max, draw) => Math.max(max, draw.atlasBytes), 0), peakPackedSplatBytes: draws.reduce((max, draw) => Math.max(max, draw.packedSplatBytes), 0),
        frameGapP95Ms: percentile(this._animationFrameMs, 0.95), frameGapP99Ms: percentile(this._animationFrameMs, 0.99),
        inputP95Ms: percentile(this._inputToNextFrameMs, 0.95), longTaskTotalMs: this._longTaskMs.reduce((sum, ms) => sum+ms, 0),
        submissionContinuity: this.issues.some((issue) => issue.code === "missing-field") ? "fail" : expected ? "pass" : "unverified",
        continuity: this.issues.some((issue) => issue.severity === "failure") ? "fail" : pixelOracle ? "pass" : "unverified",
        fidelity: refined ? "observed-refinement" : "unverified",
      },
    };
  }
}

/** Standalone contact sheet and raw evidence, with no external scripts or asset URLs. @internal */
export function gaussianSplatValidationHtml(trace: GaussianSplatValidationTrace): string {
  const data = JSON.stringify(trace).replace(/</g, "\\u003c");
  return `<!doctype html><meta charset="utf-8"><title>Native Gaussian validation</title>
<style>body{font:15px system-ui;margin:24px;background:#101820;color:#e8edf2}pre{white-space:pre-wrap}#frames{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;width:240px}img{width:240px}figcaption{font-size:12px}button{padding:8px}</style>
<h1>Native iTwin.js Gaussian validation</h1><p id="label"></p><pre id="summary"></pre><pre id="issues"></pre><div id="frames"></div>
<script type="application/json" id="evidence">${data}</script><script>
const trace=JSON.parse(document.getElementById('evidence').textContent);
document.getElementById('label').textContent=trace.configuration.label+' · '+trace.configuration.mode+' · '+trace.configuration.renderer;
document.getElementById('summary').textContent=JSON.stringify(trace.summary,null,2);
document.getElementById('issues').textContent=JSON.stringify(trace.issues,null,2);
for(const image of trace.images){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=image.url;const f=trace.frames[image.frame];caption.textContent='Frame '+f.index+' · instances '+(f.draw?.drawnInstances??0)+' · completed '+(f.draw?.completedVersion??0)+(f.draw?.awaitingCoverage?' · waiting for coverage':'')+' · selected '+f.selected.map(t=>t.id).join(',');figure.append(img,caption);document.getElementById('frames').append(figure);}
</script>`;
}
