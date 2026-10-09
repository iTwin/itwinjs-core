/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { dispose, Logger } from "@itwin/core-bentley";
import { Frustum, FrustumPlanes, RenderSchedule } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { FrontendLoggerCategory } from "../../../common/FrontendLoggerCategory";
import { OvrFlags } from "../../../common/internal/render/OvrFlags";
import { _scheduleScriptReference } from "../../../common/internal/Symbols";
import { RenderMemory } from "../../../render/RenderMemory";
import { gaussianTileDetailModifier, hasIncompleteRealityTileSelection, recoverGaussianTileDetail, reduceGaussianTileDetail } from "../../tile/RealityTileSelection";
import { GaussianSplatSortRequest, GaussianSplatSortTile, gaussianSplatsPerPage } from "../GaussianSplatSort";
import { InstanceTile, remapSortedInstances } from "../GaussianSplatInstances";
import { GaussianSplatWorker } from "../GaussianSplatWorker";
import { GaussianSplatAtlasUpload, GaussianSplatFrameState, gaussianSplatObservers } from "../GaussianSplatDiagnostics";
import { DrawCommands, PopBatchCommand, PopBranchCommand, PopClipCommand, PushBatchCommand, PushCommand } from "./DrawCommand";
import { FrameBuffer } from "./FrameBuffer";
import { GL } from "./GL";
import { GaussianSplatGeometry } from "./GaussianSplatGeometry";
import { Batch, Graphic, GraphicOwner } from "./Graphic";
import { getGaussianSplatAtlas, withGaussianSplatBindings } from "./GaussianSplatAtlas";
import { gaussianSplatCompositeFragment, gaussianSplatCompositeVertex, gaussianSplatFragment, gaussianSplatVertex } from "./glsl/GaussianSplats";
import { RenderState } from "./RenderState";
import { System } from "./System";
import { Target } from "./Target";
import { TextureHandle } from "./Texture";

interface VisibleTile {
  geometry: GaussianSplatGeometry;
  identity: string;
  transform: number[];
  metadata: number[];
  planes: Float32Array;
  commands: DrawCommands;
  modelKey?: string;
}

interface CompletedTile {
  geometry: GaussianSplatGeometry;
  identity: string;
  commands: DrawCommands;
  batch?: Batch;
  modelKey?: string;
  tree?: object;
  coverageComplete: boolean;
}

interface PendingSort {
  request: GaussianSplatSortRequest;
  content: string;
  key: string;
  rows: InstanceTile[];
}

function program(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const shaders: WebGLShader[] = [];
  const result = gl.createProgram();
  if (!result)
    throw new Error("Gaussian splats: cannot allocate shader program");

  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type);
      if (!shader)
        throw new Error("Gaussian splats: cannot allocate shader");

      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(`Gaussian splats shader: ${gl.getShaderInfoLog(shader)}`);

      gl.attachShader(result, shader);
    }

    gl.linkProgram(result);
    if (!gl.getProgramParameter(result, gl.LINK_STATUS))
      throw new Error(`Gaussian splats shader link: ${gl.getProgramInfoLog(result)}`);

    return result;
  } catch (error) {
    gl.deleteProgram(result);
    throw error;
  } finally {
    for (const shader of shaders)
      gl.deleteShader(shader);
  }
}

/** A per-viewport instance list and sorting worker, referencing the system-wide GPU atlas.
 * Uses native framebuffers, depth, clipping state, feature IDs, and redraw scheduling.
 * @internal
 */
export class GaussianSplatRenderer implements Disposable {
  private readonly _atlas = getGaussianSplatAtlas();
  private _worker = new GaussianSplatWorker();
  private _workerGeneration = 0;
  private _activeSortCount = 0;
  private _detailFeedbackTime = 0;
  private _detailRecoveryTimer?: ReturnType<typeof setTimeout>;
  private _detailRecoveryDelay = 5000;
  private _detailRecoveryPending = false;
  private _memoryLimited = false;
  private _detailTrees = new Set<object>();
  private readonly _registered = new Set<number>();
  private readonly _drawState = new RenderState();
  private readonly _pickState = new RenderState();
  private readonly _compositeState = new RenderState();
  private _program?: WebGLProgram;
  private _pickProgram?: WebGLProgram;
  private _compositeProgram?: WebGLProgram;
  private _vao?: WebGLVertexArrayObject;
  private _buffer?: WebGLBuffer;
  private _metadata?: WebGLTexture;
  private _planes?: WebGLTexture;
  private _field?: TextureHandle;
  private _fieldFbo?: FrameBuffer;
  private _instances = new Uint32Array(0);
  private _instanceTiles: InstanceTile[] = [];
  private _completed: CompletedTile[] = [];
  private _completedContent = "";
  private _scheduleReference?: RenderSchedule.ScriptReference;
  private _scheduleTime?: number;
  private readonly _retained = new Set<GaussianSplatGeometry>();
  private _currentGeometries = new Set<number>();
  private _readySort?: { pending: PendingSort, instances: Uint32Array };
  private _instancesDirty = false;
  private _content = "";
  private _requestedKey = "";
  private _sorting = false;
  private _queued?: PendingSort;
  private _disposed = false;
  private _instanceBytes = 0;
  private _metadataBytes = 0;
  private _lastError = "";
  private _candidateVersion = 0;
  private _completedVersion = 0;
  private _sortStarted = 0;
  private _candidateStarted = 0;
  private _awaitingCoverage = false;
  private _coverageComplete = true;
  private _debugDraw?: { ids: number[], pendingIds: number[], count: number, calls: number, submitted: number };

  public constructor(private readonly _target: Target) {
    this._drawState.flags.depthTest = true;
    this._drawState.flags.depthMask = false;
    this._drawState.flags.blend = true;
    this._drawState.blend.setBlendFunc(GL.BlendFactor.One, GL.BlendFactor.OneMinusSrcAlpha);
    this._pickState.flags.depthTest = true;
    this._pickState.flags.depthMask = true;
    this._compositeState.flags.depthMask = false;
  }

  public get hasDisplayedContent(): boolean { return this._completed.length > 0 && this._instances.length > 0; }

  private gather(commands: DrawCommands, retained = false): VisibleTile[] {
    const target = this._target;
    const tiles: VisibleTile[] = [];
    const frustum = retained ? FrustumPlanes.fromFrustum(target.planFrustum) : undefined;
    const stack: PushCommand[] = [];
    const pop = (command: PushCommand) => command.opcode === "pushBatch" ? PopBatchCommand.instance : command.opcode === "pushClip" ? PopClipCommand.instance : PopBranchCommand.instance;
    for (const command of commands) {
      switch (command.opcode) {
        case "pushBranch": target.pushBranch(command.branch); stack.push(command); break;
        case "popBranch": target.popBranch(); stack.pop(); break;
        case "pushBatch": {
          if (retained && !command.batch.batchId) {
            // Retained batches were absent from native command generation. Assign fresh
            // per-frame IDs so picking resolves through the native feature table.
            target.uniforms.batch.state.push(command.batch, true);
            target.uniforms.batch.state.pop();
          }
          target.pushBatch(command.batch);
          stack.push(command);
          break;
        }
        case "popBatch": target.popBatch(); stack.pop(); break;
        case "pushState": target.pushState(command.state); stack.push(command); break;
        case "pushClip": target.uniforms.branch.clipStack.push(command.clip); stack.push(command); break;
        case "popClip": target.uniforms.branch.clipStack.pop(); stack.pop(); break;
        case "drawPrimitive": {
          const geometry = command.primitive.cachedGeometry;
          if (!(geometry instanceof GaussianSplatGeometry) || geometry.isDisposed || target.is2d || target.isGeometryOutsideActiveVolume(geometry))
            break;
          if (frustum && FrustumPlanes.Containment.Outside === frustum.computeFrustumContainment(Frustum.fromRange(geometry.computeRange()).transformBy(target.currentTransform)))
            break;

          const batch = target.uniforms.batch.state.currentBatch;
          const overrides = batch?.getOverrides(target, target.currentBranch);
          if (overrides?.allHidden)
            break;

          const appearance = [1, -1, -1, -1];
          let featureId = target.uniforms.batch.state.currentBatchId;
          if (overrides?.anyOverridden && overrides.isUniform) {
            const bytes = overrides.getUniformOverrides();
            const flags = bytes[0] | (bytes[1] << 8);
            if (flags & OvrFlags.Alpha)
              appearance[0] = bytes[7] / 255;

            if (flags & OvrFlags.Rgb)
              appearance.splice(1, 3, bytes[4] / 255, bytes[5] / 255, bytes[6] / 255);

            if ((flags & OvrFlags.NonLocatable) && !target.drawNonLocatable)
              featureId = 0;
          }

          const mv = target.uniforms.frustum.viewMatrix.multiplyTransformTransform(target.currentTransform);
          const inverse = mv.matrix.inverse();
          if (!inverse)
            break;

          const origin = mv.multiplyPoint3d(Point3d.create(...geometry.splats.origin));
          const a = mv.matrix.coffs;
          const transform = [a[0], a[1], a[2], origin.x, a[3], a[4], a[5], origin.y, a[6], a[7], a[8], origin.z];
          const clip = target.uniforms.branch.clipStack;
          const planes = clip.getPlaneData();
          const inside = clip.insideColor;
          const outside = clip.outsideColor;
          const inv = inverse.coffs;
          const metadata = [
            ...transform,
            (featureId & 255) / 255, ((featureId >>> 8) & 255) / 255, ((featureId >>> 16) & 255) / 255, (featureId >>> 24) / 255,
            0, planes.length / 4, geometry.splats.shDegree, geometry.splats.colorSpace === "lin_rec709_display" ? 1 : 0,
            ...appearance,
            inside.red, inside.green, inside.blue, inside.alpha,
            outside.red, outside.green, outside.blue, outside.alpha,
            inv[0], inv[1], inv[2], 0, inv[3], inv[4], inv[5], 0, inv[6], inv[7], inv[8], 0,
            geometry.splats.antialiased ? 1 : 0,
          ];
          const identity = JSON.stringify([geometry.id, target.currentTransform.toJSON()]);
          const modelKey = batch ? JSON.stringify([batch.batchIModel?.key, batch.featureTable.batchModelId]) : undefined;
          tiles.push({ geometry, identity, transform, metadata, planes, modelKey, commands: [...stack, command, ...stack.slice().reverse().map(pop)] });
          break;
        }
      }
    }

    return tiles;
  }

  private activeModels(): Map<string, object> {
    const models = new Map<string, object>();
    for (const ref of this._target.screenSpaceEffectContext.viewport.getTileTreeRefs()) {
      const tree = ref.treeOwner.tileTree;
      if (tree && !tree.isDisposed && !tree.rootTile.isEmpty)
        models.set(JSON.stringify([tree.iModel.key, tree.modelId]), tree);
    }
    return models;
  }

  private releaseCompleted(): void {
    for (const tile of this._completed)
      tile.batch?.[Symbol.dispose]();
    this._completed = [];
    this._completedContent = "";
    this._completedVersion = 0;
  }

  private storeCompleted(tiles: VisibleTile[], content: string): void {
    this.releaseCompleted();
    const models = this.activeModels();
    this._completed = tiles.map((tile) => {
      let batch: Batch | undefined;
      const commands = tile.commands.map((command) => {
        if (command.opcode !== "pushBatch")
          return command;
        batch = new Batch(new GraphicOwner(command.batch.graphic as Graphic), command.batch.featureTable, command.batch.range, command.batch.options);
        return new PushBatchCommand(batch);
      });
      const tree = tile.modelKey ? models.get(tile.modelKey) : undefined;
      return { commands, batch, geometry: tile.geometry, identity: tile.identity, modelKey: tree ? tile.modelKey : undefined, tree,
        coverageComplete: !tree || !hasIncompleteRealityTileSelection(this._target, tree) };
    });
    this._completedContent = content;
    this._completedVersion = this._candidateVersion;
    const viewport = this._target.screenSpaceEffectContext.viewport;
    this._scheduleReference = viewport.view[_scheduleScriptReference];
    this._scheduleTime = this._scheduleReference ? viewport.timePoint ?? this._scheduleReference.script.duration.low : undefined;
  }

  private completedTiles(): VisibleTile[] {
    return this.gather(this._completed.flatMap((tile) => tile.commands), true);
  }

  private pruneCompleted(): Map<string, object> {
    const viewport = this._target.screenSpaceEffectContext.viewport;
    const schedule = viewport.view[_scheduleScriptReference];
    const time = schedule ? viewport.timePoint ?? schedule.script.duration.low : undefined;
    if (this._completed.length && (this._scheduleReference !== schedule || this._scheduleTime !== time)) {
      // Schedule omissions and transforms were resolved during native command generation.
      // Native branch objects can be rebuilt at unchanged script/time after scene invalidation.
      this.releaseCompleted();
      this._instances = new Uint32Array(0);
      this._instanceTiles = [];
      this._instancesDirty = true;
      this._content = this._requestedKey = "";
      this._readySort = undefined;
    }
    const models = this.activeModels();
    const previous = this._completed.length;
    this._completed = this._completed.filter((tile) => {
      if (!tile.modelKey || models.get(tile.modelKey) === tile.tree)
        return true;
      tile.batch?.[Symbol.dispose]();
      return false;
    });
    if (previous !== this._completed.length) {
      this._completedContent = this._content = this._requestedKey = "";
      this._readySort = undefined;
    }
    return models;
  }

  private updateResidency(tiles: VisibleTile[]): void {
    const geometries = [...new Map([...this._completed, ...tiles].map((tile) => [tile.geometry.id, tile.geometry])).values()];
    // Commit GPU ownership before leasing CPU data or registering worker positions.
    this._atlas.update(this, [...new Map(this._completed.map((t) => [t.geometry.id, t.geometry])).values()]);
    const retained = new Set(geometries);
    for (const geometry of this._retained)
      if (!retained.has(geometry)) {
        geometry.release(this);
        this._retained.delete(geometry);
      }
    for (const geometry of geometries)
      if (!this._retained.has(geometry)) {
        geometry.retain(this);
        this._retained.add(geometry);
      }

    const visible = new Set(geometries.map((geometry) => geometry.id));
    const released = [...this._registered].filter((id) => !visible.has(id));
    if (released.length) {
      for (const id of released)
        this._registered.delete(id);

      this._worker.release(released).catch((error) => this.onError(error));
    }

    for (const geometry of geometries) {
      if (this._registered.has(geometry.id))
        continue;

      const positions = new Float32Array(geometry.splats.count * 3);
      const floats = new Float32Array(geometry.splats.data.buffer);
      for (let i = 0; i < geometry.splats.count; i++)
        positions.set(floats.subarray(i * 8, i * 8 + 3), i * 3);

      this._registered.add(geometry.id);
      this._worker.register(geometry.id, positions).catch((error) => {
        this._registered.delete(geometry.id);
        this._requestedKey = "";
        this.onError(error);
      });
    }
    this.reserveOwnedMemory();
  }

  private clearDetailRecoveryTimer(): void {
    if (this._detailRecoveryTimer !== undefined) clearTimeout(this._detailRecoveryTimer);
    this._detailRecoveryTimer = undefined;
  }

  /** The largest tolerance step whose expected growth fits the atlas headroom, or undefined.
   * Selected splats grow about with the inverse square of the tolerance, so a step of 2
   * needs roughly 4x the resident bytes while a quarter-octave step needs about 1.4x.
   */
  private detailRecoveryStep(): number | undefined {
    if (![...this._detailTrees].some((tree) => gaussianTileDetailModifier(this._target, tree) > 1))
      return undefined;
    const headroom = this._atlas.growthHeadroom(this) / 1.1;
    for (const step of [2, Math.SQRT2, 2 ** 0.25])
      if (step * step <= headroom)
        return step;
    return undefined;
  }

  private scheduleDetailRecovery(): void {
    if (this._disposed || this._completedContent !== this._content || this.detailRecoveryStep() === undefined)
      return;
    // Wake a settled viewport once, without a continuous redraw loop. A later
    // admitted frame schedules the next gradual recovery step if needed.
    this._detailRecoveryTimer = setTimeout(() => {
      this._detailRecoveryTimer = undefined;
      if (!this._disposed) this._target.screenSpaceEffectContext.viewport.invalidateScene();
    }, Math.max(1, this._detailRecoveryDelay - (performance.now() - this._detailFeedbackTime)));
  }

  private reserveOwnedMemory(): void {
    if (this._disposed) return;
    const geometries = [...this._retained];
    const positions = geometries.reduce((n, g) => n + g.splats.count * 12, 0);
    const bytes = Math.max(positions, this._worker.bytesUsed - this._worker.wasmBytes) + Math.max(this._worker.wasmBytes, this._activeSortCount * 32) + this._activeSortCount * 40 + this._instances.byteLength + (this._readySort?.instances.byteLength ?? 0);
    this._atlas.reserveWorker(this, bytes, geometries);
  }

  private rows(tiles: Array<{ geometry: GaussianSplatGeometry, identity: string }>): InstanceTile[] {
    return tiles.map((tile) => ({ identity: tile.identity, pages: this._atlas.pages(tile.geometry.id).slice() }));
  }

  private remapCompleted(): void {
    // Visibility can change while a replacement is sorting. Preserve the complete
    // committed order and derive a transient visible subset only for the draw.
    const rows = this.rows(this._completed);
    if (rows.length === this._instanceTiles.length && rows.every((row, t) => row.identity === this._instanceTiles[t].identity && row.pages.length === this._instanceTiles[t].pages.length && row.pages.every((page, p) => page === this._instanceTiles[t].pages[p])))
      return;

    this._instances = remapSortedInstances(this._instances, this._instanceTiles, rows);
    this._instanceTiles = rows;
    this._instancesDirty = true;
  }

  private prepare(tiles: VisibleTile[], commands: DrawCommands): VisibleTile[] {
    if (this._worker.isDisposed) {
      this._worker = new GaussianSplatWorker();
      this._workerGeneration++;
      this._activeSortCount = 0;
      this._registered.clear();
      this._requestedKey = "";
      this._sorting = false;
      this._queued = this._readySort = undefined;
    }
    this.clearDetailRecoveryTimer();
    const models = this.pruneCompleted();
    this._detailTrees = new Set([...this._completed, ...tiles].flatMap((tile) => {
      const tree = tile.modelKey ? models.get(tile.modelKey) : undefined;
      return tree ? [tree] : [];
    }));
    this._currentGeometries = new Set(tiles.map((tile) => tile.geometry.id));
    const geometries = [...new Map([...this._completed, ...tiles].map((t) => [t.geometry.id, t.geometry])).values()];
    const sortCount = tiles.reduce((n, t) => n + t.geometry.splats.count, 0);
    const positionsBytes = geometries.reduce((n, g) => n + g.splats.count * 12, 0);
    const scratchCount = Math.max(this._activeSortCount, sortCount);
    const prospective = { bytes: Math.max(positionsBytes, this._worker.bytesUsed - this._worker.wasmBytes) + Math.max(this._worker.wasmBytes, scratchCount * 32) + scratchCount * 40 + this._instances.byteLength + (this._readySort?.instances.byteLength ?? 0), geometries: [...new Map([...this._retained, ...geometries].map((g) => [g.id, g])).values()] };
    this._memoryLimited = !this._atlas.canAdmit(this, tiles.map((t) => t.geometry)) || !this._atlas.canUpdate(this, [...new Map(tiles.map((t) => [t.geometry.id, t.geometry])).values()], prospective);
    if (this._memoryLimited) {
      if (this._detailRecoveryPending) {
        // The last recovery step did not fit. Back off before retrying that level.
        this._detailRecoveryPending = false;
        this._detailRecoveryDelay = Math.min(60000, this._detailRecoveryDelay * 2);
      }
      if (performance.now() - this._detailFeedbackTime >= 250) {
        this._detailFeedbackTime = performance.now();
        if (reduceGaussianTileDetail(this._target, this._detailTrees))
          this._target.screenSpaceEffectContext.viewport.invalidateScene();
      } else {
        this._target.screenSpaceEffectContext.viewport.requestRedraw();
      }
      this._content = this._requestedKey = "";
      this._readySort = this._queued = undefined;
      this.updateResidency([]);
      this.remapCompleted();
      return this.completedTiles();
    }
    if (this._completedContent === this._content) {
      if (this._detailRecoveryPending) {
        // The finer selection was admitted and completed; recover at the normal cadence again.
        this._detailRecoveryPending = false;
        this._detailRecoveryDelay = 5000;
      }
      if (performance.now() - this._detailFeedbackTime >= this._detailRecoveryDelay) {
        const step = this.detailRecoveryStep();
        if (step !== undefined) {
          this._detailFeedbackTime = performance.now();
          if (recoverGaussianTileDetail(this._target, this._detailTrees, step)) {
            this._detailRecoveryPending = true;
            this._target.screenSpaceEffectContext.viewport.invalidateScene();
          }
        }
      }
    }
    this._awaitingCoverage = this._completed.some((tile) => tile.coverageComplete && tile.tree && hasIncompleteRealityTileSelection(this._target, tile.tree));
    if (gaussianSplatObservers(this._target)) {
      this._coverageComplete = this._completed.every((tile) => !tile.tree || !hasIncompleteRealityTileSelection(this._target, tile.tree)) && tiles.every((tile) => {
        const tree = tile.modelKey ? models.get(tile.modelKey) : undefined;
        return !tree || !hasIncompleteRealityTileSelection(this._target, tree);
      });
    }
    this._currentGeometries = new Set(tiles.map((tile) => tile.geometry.id));
    if (!tiles.length) {
      // Traversal can momentarily produce no ready tiles for an active native source.
      // Distinguish removed decorators from primitives hidden by current clipping.
      const selected = new Set(commands.flatMap((command) => command.opcode === "drawPrimitive" && command.primitive.cachedGeometry instanceof GaussianSplatGeometry ? [command.primitive.cachedGeometry.id] : []));
      this._completed = this._completed.filter((tile) => {
        if (tile.tree || selected.has(tile.geometry.id))
          return true;
        tile.batch?.[Symbol.dispose]();
        return false;
      });
      if (this._completed.length) {
        this._completedContent = this._content = this._requestedKey = "";
        this._readySort = this._queued = undefined;
        this.updateResidency([]);
        this.remapCompleted();
        return this.completedTiles();
      }
      this.releaseCompleted();
      this._instances = new Uint32Array(0);
      this._instanceTiles = [];
      this._instancesDirty = true;
    }

    this.updateResidency(tiles);
    // Sorting needs logical slots, not GPU residency. Upload the incoming selection
    // only after its order is ready, while the completed texture remains displayed.
    const logicalPages = new Map<number, number[]>();
    let page = 0;
    for (const tile of tiles)
      if (!logicalPages.has(tile.geometry.id))
        logicalPages.set(tile.geometry.id, Array.from({ length: Math.ceil(tile.geometry.splats.count / gaussianSplatsPerPage) }, () => page++));
    const sortTiles: GaussianSplatSortTile[] = tiles.map((tile) => ({
      id: tile.geometry.id, pages: logicalPages.get(tile.geometry.id) ?? [], count: tile.geometry.splats.count,
      transform: tile.transform, sortingMethod: tile.geometry.splats.sortingMethod,
    }));
    const instanceTiles = tiles.map((tile, t) => ({ identity: tile.identity, pages: sortTiles[t].pages }));
    // Slot addresses can change independently of content when another viewport compacts the atlas.
    const content = JSON.stringify(sortTiles.map((tile, t) => [instanceTiles[t].identity, tile.count]));
    if (content !== this._content) {
      this._candidateVersion++;
      this._candidateStarted = gaussianSplatObservers(this._target) ? performance.now() : 0;
      this._content = content;
      this._requestedKey = "";
      this._readySort = undefined;
    }

    if (!sortTiles.length)
      return tiles;

    const ready = this._readySort;
    const count = sortTiles.reduce((sum, tile) => sum + tile.count, 0);
    // A sorted subset cannot replace a complete field while native source coverage
    // is still loading. Initial loading can be progressive; source removal was pruned above.
    if ((!this._awaitingCoverage || content === this._completedContent) && (ready || (count === 1 && this._completedContent !== content))) {
      this._atlas.update(this, [...new Map(tiles.map((tile) => [tile.geometry.id, tile.geometry])).values()]);
      const committedRows = this.rows(tiles);
      if (this._completedContent !== content)
        this.storeCompleted(tiles, content);
      const t = sortTiles.findIndex((tile) => tile.count === 1);
      this._instances = ready ? remapSortedInstances(ready.instances, ready.pending.rows, committedRows) : new Uint32Array([committedRows[t].pages[0] * gaussianSplatsPerPage, t]);
      this._instanceTiles = committedRows;
      this._instancesDirty = true;
      this._readySort = undefined;
      this.updateResidency(tiles);
    }

    const request = { tiles: sortTiles, perspective: this._target.uniforms.frustum.type === 2 };
    const key = JSON.stringify(request);
    if (key !== this._requestedKey) {
      this._requestedKey = key;
      const pending = { request, content, key, rows: instanceTiles };
      if (this._sorting)
        this._queued = pending;
      else
        this.sort(pending);
    }

    if (this._completedContent === content) {
      // Refresh current native paths and feature semantics without sorting unchanged geometry.
      for (let t = 0; t < tiles.length; t++) {
        const stored = this._completed[t];
        if (!stored)
          continue;
        stored.commands = tiles[t].commands.map((command) => {
          if (command.opcode !== "pushBatch")
            return command;
          const source = command.batch;
          if (!stored.batch || stored.batch.featureTable !== source.featureTable || stored.batch.options !== source.options || stored.batch.range !== source.range) {
            stored.batch?.[Symbol.dispose]();
            stored.batch = new Batch(new GraphicOwner(source.graphic as Graphic), source.featureTable, source.range, source.options);
          }
          return new PushBatchCommand(stored.batch);
        });
        const modelKey = tiles[t].modelKey;
        const tree = modelKey ? models.get(modelKey) : undefined;
        stored.modelKey = tree ? tiles[t].modelKey : undefined;
        stored.tree = tree;
        stored.coverageComplete ||= !tree || !hasIncompleteRealityTileSelection(this._target, tree);
      }
      this.remapCompleted();
      this.scheduleDetailRecovery();
      return tiles;
    }

    const completed = this.completedTiles();
    this.remapCompleted();
    return completed;
  }

  private sort(pending: PendingSort): void {
    const generation = this._workerGeneration;
    this._activeSortCount = pending.request.tiles.reduce((n, t) => n + t.count, 0);
    this.reserveOwnedMemory();
    this._sorting = true;
    this._sortStarted = gaussianSplatObservers(this._target) ? performance.now() : 0;
    this._worker.sort(pending.request).then((instances) => {
      // Accept older camera orders during motion, but commit only the latest candidate content.
      // Page addresses are remapped at the next draw before the atomic selection handoff.
      if (!this._disposed && generation === this._workerGeneration && pending.content === this._content) {
        this._readySort = { pending, instances };
        for (const viewport of IModelApp.viewManager)
          if (viewport.target === this._target)
            viewport.requestRedraw();

        IModelApp.requestNextAnimation();
      }
    }).catch((error) => {
      if (pending.content === this._content)
        this.onError(error);
    }).finally(() => {
      if (generation !== this._workerGeneration) return;
      this._sorting = false;
      this._activeSortCount = 0;
      this.reserveOwnedMemory();
      const queued = this._queued;
      this._queued = undefined;
      if (queued && !this._disposed)
        this.sort(queued);
    });
  }

  private onError(error: unknown): void {
    if (!this._disposed) {
      if (this._worker.isDisposed) {
        this._target.screenSpaceEffectContext.viewport.requestRedraw();
        IModelApp.requestNextAnimation();
      }
      Logger.logError(FrontendLoggerCategory.Render, String(error));
    }
  }

  private initialize(gl: WebGL2RenderingContext): void {
    if (this._program)
      return;

    try {
      this._program = program(gl, gaussianSplatVertex(false), gaussianSplatFragment(false));
      this._pickProgram = program(gl, gaussianSplatVertex(true), gaussianSplatFragment(true));
      this._compositeProgram = program(gl, gaussianSplatCompositeVertex, gaussianSplatCompositeFragment);
      this._vao = gl.createVertexArray() ?? undefined;
      this._buffer = gl.createBuffer() ?? undefined;
      this._metadata = gl.createTexture() ?? undefined;
      this._planes = gl.createTexture() ?? undefined;
      if (!this._vao || !this._buffer || !this._metadata || !this._planes)
        throw new Error("Gaussian splats: failed to allocate draw resources");
    } catch (error) {
      this.deleteDrawResources(gl);
      throw error;
    }

    gl.bindVertexArray(this._vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribIPointer(0, 2, gl.UNSIGNED_INT, 8, 0);
    gl.vertexAttribDivisor(0, 1);
  }

  private upload(gl: WebGL2RenderingContext, tiles: VisibleTile[], temporaryInstances?: Uint32Array): void {
    const metadata = new Float32Array(Math.max(1, tiles.length) * 64);
    const numPlanes = tiles.reduce((sum, tile) => sum + tile.planes.length, 0);
    const planes = new Float32Array(Math.max(4, numPlanes));
    let start = 0;
    for (let t = 0; t < tiles.length; t++) {
      const splats = tiles[t].geometry.splats;
      tiles[t].metadata[45] = this._atlas.auxiliaryOffset(tiles[t].geometry.id);
      tiles[t].metadata[46] = splats.sh.length / splats.count;
      tiles[t].metadata[47] = (splats.covariance ? 1 : 0) | (splats.appearance ? 2 : 0);
      // Auxiliary blocks are contiguous SH, covariance, then appearance arrays.
      tiles[t].metadata[48] = this._atlas.pages(tiles[t].geometry.id)[0] * gaussianSplatsPerPage;
      tiles[t].metadata[49] = tiles[t].metadata[45] + splats.sh.length;
      tiles[t].metadata[50] = tiles[t].metadata[49] + (splats.covariance?.length ?? 0);
      tiles[t].metadata[16] = start / 4;
      metadata.set(tiles[t].metadata, t * 64);
      planes.set(tiles[t].planes, start);
      start += tiles[t].planes.length;
    }

    if (tiles.length > System.instance.maxTextureSize || planes.length / 4 > System.instance.maxTextureSize)
      throw new Error("Gaussian splats: too many visible tile instances or clip planes");

    const texture = (unit: number, handle: WebGLTexture | undefined, width: number, height: number, values: Float32Array) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, handle ?? null);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, values);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    texture(1, this._metadata, 16, Math.max(1, tiles.length), metadata);
    texture(2, this._planes, 1, planes.length / 4, planes);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this._atlas.texture ?? null);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this._atlas.auxiliaryTexture ?? null);
    gl.bindVertexArray(this._vao ?? null);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer ?? null);
    if (temporaryInstances) {
      gl.bufferData(gl.ARRAY_BUFFER, temporaryInstances, gl.DYNAMIC_DRAW);
      this._instancesDirty = true;
    } else if (this._instancesDirty) {
      gl.bufferData(gl.ARRAY_BUFFER, this._instances, gl.DYNAMIC_DRAW);
      this._instancesDirty = false;
    }
    this._instanceBytes = (temporaryInstances ?? this._instances).byteLength;
    this._metadataBytes = metadata.byteLength + planes.byteLength;
  }

  private drawInstances(gl: WebGL2RenderingContext, pick: boolean, space: number, count = this._instances.length / 2): void {
    const shader = (pick ? this._pickProgram : this._program)!;
    gl.useProgram(shader);
    const uniform = (name: string) => gl.getUniformLocation(shader, name);
    gl.uniform1i(uniform("u_splats"), 0);
    gl.uniform1i(uniform("u_auxiliary"), 4);
    gl.uniform1i(uniform("u_tiles"), 1);
    gl.uniform1i(uniform("u_planes"), 2);
    gl.uniformMatrix4fv(uniform("u_projection"), false, this._target.uniforms.frustum.projectionMatrix32.data);
    gl.uniform2f(uniform("u_viewport"), this._target.viewRect.width, this._target.viewRect.height);
    gl.uniform3fv(uniform("u_frustum"), this._target.uniforms.frustum.frustum);
    gl.uniform2fv(uniform("u_logZ"), this._target.uniforms.frustum.logZ);
    gl.uniform1i(uniform("u_useLogZ"), System.instance.supportsLogZBuffer ? 1 : 0);
    gl.uniform1i(uniform("u_space"), space);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    if (!pick && this._debugDraw) {
      this._debugDraw.ids = this._debugDraw.pendingIds;
      this._debugDraw.count = count;
      this._debugDraw.calls++;
      this._debugDraw.submitted += count;
    }
  }

  private drawComposite(gl: WebGL2RenderingContext, texture: TextureHandle, mode: number): void {
    const shader = this._compositeProgram!;
    gl.useProgram(shader);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, texture.getHandle() ?? null);
    gl.uniform1i(gl.getUniformLocation(shader, "u_color"), 3);
    gl.uniform1i(gl.getUniformLocation(shader, "u_mode"), mode);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  public draw(commands: DrawCommands, destination: FrameBuffer, multisampled: boolean, pick: boolean): void {
    // Hover locate reads the pick buffer on every mouse motion event, and each read waits for
    // the GPU. While the cursor is moving, leave splats out of the pick buffer; the tool
    // re-evaluates once the cursor rests, and that pick includes them. First-pass mitigation
    // until pick readback is asynchronous.
    if (pick && IModelApp.toolAdmin.isCursorMoving)
      return;
    const observers = pick ? undefined : gaussianSplatObservers(this._target);
    const atlasUploads: GaussianSplatAtlasUpload[] | undefined = observers ? [] : undefined;
    if (observers)
      this._debugDraw = { ids: [], pendingIds: [], count: 0, calls: 0, submitted: 0 };
    try {
      if (atlasUploads)
        this._atlas.collectUploadStatistics(atlasUploads, () => this.drawContent(commands, destination, multisampled, pick));
      else
        this.drawContent(commands, destination, multisampled, pick);
      this._lastError = "";
    } catch (error) {
      // Failure of opt-in content must not prevent the rest of the iModel from rendering.
      const message = String(error);
      if (message !== this._lastError) {
        this._lastError = message;
        this.onError(error);
      }
    } finally {
      if (observers && this._debugDraw) {
        const state: GaussianSplatFrameState = {
          phase: "draw", time: performance.now(), candidateVersion: this._candidateVersion, completedVersion: this._completedVersion,
          selectedGeometryIds: [...this._currentGeometries], completedGeometryIds: this._completed.map((tile) => tile.geometry.id),
          drawnGeometryIds: this._debugDraw.ids, drawnInstances: this._debugDraw.count,
          sourceModelIds: [...new Set(this._completed.flatMap((tile) => tile.batch ? [tile.batch.featureTable.batchModelId] : []))],
          drawCalls: this._debugDraw.calls, submittedInstances: this._debugDraw.submitted,
          awaitingCandidate: !!this._content && this._content !== this._completedContent, awaitingCoverage: this._awaitingCoverage, coverageComplete: this._coverageComplete, sorting: this._sorting,
          sortAgeMs: this._sorting && this._sortStarted ? performance.now() - this._sortStarted : undefined,
          candidateAgeMs: this._content !== this._completedContent && this._candidateStarted ? performance.now() - this._candidateStarted : undefined,
          atlasPages: this._atlas.numPages, atlasBytes: this._atlas.bytesUsed,
          atlasUploads,
          memoryLimited: this._memoryLimited, workerWasmBytes: this._worker.wasmBytes,
          packedSplatBytes: [...this._retained].reduce((sum, geometry) => sum + (geometry.splats.data.byteLength + geometry.splats.sh.byteLength + (geometry.splats.covariance?.byteLength ?? 0) + (geometry.splats.appearance?.byteLength ?? 0)), 0), failed: !!this._lastError,
        };
        this._debugDraw = undefined;
        for (const observer of observers) {
          try {
            observer(state);
          } catch (error) {
            this.onError(error);
          }
        }
      }
    }
  }

  private drawContent(commands: DrawCommands, destination: FrameBuffer, multisampled: boolean, pick: boolean): void {
    if (this._disposed)
      return;

    let tiles: VisibleTile[];
    let temporaryInstances: Uint32Array | undefined;
    let preparationError: Error | undefined;
    if (pick) {
      // A pending LOD replacement can remove every displayed tile from native pick
      // commands. Replay the completed field with fresh native batch IDs and current
      // camera/clip state, without changing color residency or sort scheduling.
      this.pruneCompleted();
      tiles = this.completedTiles();
    } else {
      try {
        tiles = this.prepare(this.gather(commands), commands);
      } catch (error) {
        // Failed staging must not blank the working field. Report the error after
        // drawing the preserved allocation, while leaving other iModel passes intact.
        preparationError = error instanceof Error ? error : new Error(String(error));
        reduceGaussianTileDetail(this._target, this._detailTrees);
        this._target.screenSpaceEffectContext.viewport.invalidateScene();
        this.updateResidency([]);
        tiles = this.completedTiles();
        this.remapCompleted();
      }
    }
    if (pick || tiles.length !== this._instanceTiles.length || tiles.some((tile, t) => tile.identity !== this._instanceTiles[t].identity)) {
      temporaryInstances = remapSortedInstances(this._instances, this._instanceTiles, this.rows(tiles));
      // An unchanged order (the common pick) reuses the resident buffer instead of
      // uploading it for the pick and again for the next color frame.
      if (temporaryInstances === this._instances)
        temporaryInstances = undefined;
    }
    if (!tiles.length) {
      if (preparationError)
        throw preparationError;
      return;
    }

    withGaussianSplatBindings((gl) => {
      gl.viewport(0, 0, this._target.viewRect.width, this._target.viewRect.height);
      this.initialize(gl);
      this.upload(gl, tiles, temporaryInstances);
      const count = (temporaryInstances ?? this._instances).length / 2;
      const system = System.instance;
      if (pick) {
        system.frameBufferStack.execute(destination, true, false, () => {
          system.applyRenderState(this._pickState);
          this.drawInstances(gl, true, 0, count);
        });
        return;
      }

      const width = this._target.viewRect.width, height = this._target.viewRect.height;
      if (!this._field || this._field.width !== width || this._field.height !== height || this._fieldFbo?.depthBuffer !== destination.depthBuffer) {
        this._fieldFbo = dispose(this._fieldFbo);
        this._field = dispose(this._field);
        // Half float keeps dark linear values without 32-bit float's doubled blend bandwidth;
        // blending into RGBA16F needs only EXT_color_buffer_float, not EXT_float_blend.
        const dataType = gl.getExtension("EXT_color_buffer_float") ? gl.HALF_FLOAT as GL.Texture.DataType : GL.Texture.DataType.UnsignedByte;
        this._field = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, dataType);
        if (this._field)
          this._fieldFbo = FrameBuffer.create([this._field], destination.depthBuffer);

        if (!this._fieldFbo)
          throw new Error("Gaussian splats: failed to create color framebuffer");
      }

      if (multisampled)
        destination.blitMsBuffersToTextures(true);

      for (const space of new Set(tiles.map((tile) => tile.geometry.splats.colorSpace === "lin_rec709_display" ? 1 : 0))) {
        const background = destination.getColor(0);
        system.frameBufferStack.execute(this._fieldFbo!, true, false, () => {
          system.applyRenderState(this._compositeState);
          this.drawComposite(gl, background, space);
          system.applyRenderState(this._drawState);
          if (this._debugDraw)
            this._debugDraw.pendingIds = tiles.map((tile) => tile.geometry.id);
          this.drawInstances(gl, false, space, count);
        });
        system.frameBufferStack.execute(destination, true, multisampled, () => {
          system.applyRenderState(this._compositeState);
          this.drawComposite(gl, this._field!, 2 + space);
          system.frameBufferStack.markTargetsDirty();
        });
      }

      if (multisampled)
        destination.blitMsBuffersToTextures(false, 0);
    });
    if (preparationError)
      throw preparationError;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addInstances(this._instanceBytes);
    stats.addTexture(this._metadataBytes);
    if (this._field)
      stats.addTextureAttachment(this._field.bytesUsed);
    for (const geometry of this._retained)
      if (!this._currentGeometries.has(geometry.id))
        stats.addPointCloud((geometry.splats.data.byteLength + geometry.splats.sh.byteLength + (geometry.splats.covariance?.byteLength ?? 0) + (geometry.splats.appearance?.byteLength ?? 0)));
    for (const tile of this._completed)
      tile.batch?.perTargetData.collectStatistics(stats);
  }

  private deleteDrawResources(gl: WebGL2RenderingContext): void {
    gl.deleteProgram(this._program ?? null);
    gl.deleteProgram(this._pickProgram ?? null);
    gl.deleteProgram(this._compositeProgram ?? null);
    gl.deleteVertexArray(this._vao ?? null);
    gl.deleteBuffer(this._buffer ?? null);
    gl.deleteTexture(this._metadata ?? null);
    gl.deleteTexture(this._planes ?? null);
    this._program = this._pickProgram = this._compositeProgram = undefined;
    this._vao = this._buffer = this._metadata = this._planes = undefined;
  }

  public [Symbol.dispose](): void {
    if (this._disposed)
      return;

    this._disposed = true;
    this.clearDetailRecoveryTimer();
    this._worker[Symbol.dispose]();
    this.releaseCompleted();
    for (const geometry of this._retained)
      geometry.release(this);
    this._retained.clear();
    this._atlas.release(this);
    this._fieldFbo = dispose(this._fieldFbo);
    this._field = dispose(this._field);
    this.deleteDrawResources(System.instance.context);
    this._instances = new Uint32Array(0);
    const observers = gaussianSplatObservers(this._target);
    if (observers) {
      const state: GaussianSplatFrameState = {
        phase: "dispose", time: performance.now(), candidateVersion: this._candidateVersion, completedVersion: 0,
        selectedGeometryIds: [], completedGeometryIds: [], drawnGeometryIds: [], drawnInstances: 0,
        sourceModelIds: [], drawCalls: 0, submittedInstances: 0,
        awaitingCandidate: false, awaitingCoverage: false, coverageComplete: false, sorting: false, atlasPages: this._atlas.numPages, atlasBytes: this._atlas.bytesUsed, packedSplatBytes: 0, failed: false,
      };
      for (const observer of observers) {
        try {
          observer(state);
        } catch (error) {
          this.onError(error);
        }
      }
    }
  }
}
