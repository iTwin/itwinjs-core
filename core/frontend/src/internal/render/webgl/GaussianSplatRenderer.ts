/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expectDefined, Logger } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { FrontendLoggerCategory } from "../../../common/FrontendLoggerCategory";
import { RenderMemory } from "../../../render/RenderMemory";
import type { TileTree } from "../../../tile/internal";
import { GaussianSplatSortTile, gaussianSplatsPerPage } from "../GaussianSplatSort";
import { DrawCommand, DrawCommands } from "./DrawCommand";
import { FrameBuffer } from "./FrameBuffer";
import { GaussianSplatGeometry } from "./GaussianSplatGeometry";
import { GaussianSplatDrawPass } from "./GaussianSplatDrawPass";
import { GaussianSplatField } from "./GaussianSplatField";
import { gaussianSplatSortPositionBytes, GaussianSplatSortScheduler } from "./GaussianSplatSortScheduler";
import {
  gatherGaussianSplatTiles, gaussianSplatGeometriesOf, GaussianSplatVisibleTile,
} from "./GaussianSplatVisibleTiles";
import { System } from "./System";
import { Target } from "./Target";

/** The splat geometry `command` draws, if any. */
function splatGeometryOf(command: DrawCommand): GaussianSplatGeometry | undefined {
  if (command.opcode !== "drawPrimitive")
    return undefined;

  const geometry = command.primitive.cachedGeometry;
  return geometry instanceof GaussianSplatGeometry ? geometry : undefined;
}

/** The order of a candidate of a single splat, which needs no sort: its one logical slot. */
function singleSplatOrder(sortTiles: GaussianSplatSortTile[]): Uint32Array {
  const tile = sortTiles.find((sortTile) => sortTile.count === 1);
  if (!tile)
    throw new Error("Gaussian splats: an unsorted candidate must be a single splat");

  return new Uint32Array([tile.firstPage * gaussianSplatsPerPage]);
}

/** The tiles a frame draws, and an error to report once they are drawn. */
interface PreparedTiles {
  tiles: GaussianSplatVisibleTile[];
  preparationError?: Error;
}

/** A per-viewport instance list and sorting worker, referencing the system-wide GPU atlas.
 * Uses native framebuffers, opaque depth, clipping state, and redraw scheduling.
 * Each frame it gathers the visible splat tiles, makes them the candidate field once the atlas holds them all, requests their
 * order ([[GaussianSplatSortScheduler]]), displays the candidate once its order is ready ([[GaussianSplatField]]), and draws the
 * displayed field ([[GaussianSplatDrawPass]]).
 * @internal
 */
export class GaussianSplatRenderer implements Disposable {
  private readonly _atlas = System.instance.gaussianSplatAtlas;
  private readonly _sorter: GaussianSplatSortScheduler;
  private readonly _field: GaussianSplatField;
  private readonly _pass: GaussianSplatDrawPass;
  /** This viewport's sort worker and sorted-order bytes: memory statistics, not tile content. */
  private _workerBytes = 0;
  /** Geometries whose CPU data this viewport holds: those of the displayed field and the candidate. */
  private readonly _retainedGeometries = new Set<GaussianSplatGeometry>();
  private _disposed = false;
  /** Asleep with nothing to draw (see [[sleep]]). */
  private _dormant = false;
  private _lastError = "";

  public constructor(private readonly _target: Target) {
    this._field = new GaussianSplatField(_target);
    this._sorter = new GaussianSplatSortScheduler(_target, {
      candidate: () => this._field.candidate,
      memoryChanged: () => this.measureWorkerMemory(),
      onError: (error) => this.onError(error),
    });
    this._pass = new GaussianSplatDrawPass(_target, this._atlas);
  }

  private completedTiles(): GaussianSplatVisibleTile[] {
    return gatherGaussianSplatTiles(this._target, this._field.commands, true);
  }

  private pruneCompleted(): TileTree[] {
    const { trees, reset } = this._field.prune();
    if (reset)
      this._sorter.invalidate();

    return trees;
  }

  private updateResidency(tiles: GaussianSplatVisibleTile[]): void {
    const geometries = gaussianSplatGeometriesOf([...this._field.completed, ...tiles]);
    const needed = new Set(geometries);
    for (const geometry of this._retainedGeometries) {
      if (!needed.has(geometry)) {
        geometry.release(this);
        this._retainedGeometries.delete(geometry);
      }
    }

    for (const geometry of geometries) {
      if (!this._retainedGeometries.has(geometry)) {
        geometry.retain(this);
        this._retainedGeometries.add(geometry);
      }
    }

    this._sorter.register(geometries);
    this.measureWorkerMemory();
  }

  /** With nothing to draw (its splat models were removed), release the worker and the content this viewport retained. Drawing
   * splats again creates a new worker. */
  private sleep(): void {
    if (this._dormant)
      return;

    this._dormant = true;
    this._field.sleep();
    for (const geometry of this._retainedGeometries)
      geometry.release(this);

    this._retainedGeometries.clear();
    this._sorter.sleep();
    this._workerBytes = 0;
  }

  private measureWorkerMemory(): void {
    if (this._disposed)
      return;

    const positionBytes = gaussianSplatSortPositionBytes(this._retainedGeometries);
    this._workerBytes = this._sorter.reservedBytes(positionBytes) + this._field.instances.byteLength;
  }

  /** Keep drawing the completed field, without a candidate. */
  private keepCompleted(): GaussianSplatVisibleTile[] {
    this._sorter.cancel();
    this.updateResidency([]);
    return this.completedTiles();
  }

  /** Make this frame's `tiles` the candidate, request their order, and display them once it is ready. Returns the tiles to draw:
   * these, or the completed field while the candidate waits.
   */
  private prepare(tiles: GaussianSplatVisibleTile[], commands: DrawCommands): GaussianSplatVisibleTile[] {
    this._sorter.restartIfLost();
    const trees = this.pruneCompleted();
    this._field.updateCoverage();
    const keepsCompleted = !tiles.length && this.isMomentarilyEmpty(commands);
    if (keepsCompleted || !this.stageCandidate(tiles))
      return this.keepCompleted();

    if (!tiles.length)
      return tiles;

    const sortTiles = this.sortTilesOf(tiles);
    this.displayCandidateIfOrdered(tiles, sortTiles);
    this._sorter.request(sortTiles, expectDefined(this._field.candidate), this.nearestSplatDistance(tiles));
    return this._field.refresh(tiles, trees) ? tiles : this.completedTiles();
  }

  /** Whether a frame without ready splat tiles keeps the completed field: traversal can momentarily produce none for a native
   * source that is still drawn, as opposed to one whose splat models were removed or are hidden by clipping.
   */
  private isMomentarilyEmpty(commands: DrawCommands): boolean {
    const selected = new Set(commands.flatMap((command) => splatGeometryOf(command)?.id ?? []));
    return this._field.retainSelected(selected);
  }

  /** Retain the candidate's CPU data, register its positions with the sorter, and upload it to the atlas, so that it can be
   * displayed as soon as its order is ready. Returns false, rejecting the candidate, if the device cannot hold it: the atlas then
   * asked the tile admin for coarser tiles.
   */
  private stageCandidate(tiles: GaussianSplatVisibleTile[]): boolean {
    this.updateResidency(tiles);
    if (!this._atlas.makeResident(gaussianSplatGeometriesOf(tiles))) {
      IModelApp.requestNextAnimation();
      this._field.rejectCandidate();
      return false;
    }

    // Each occurrence sorts into its own logical page range, which depends only on the candidate's occurrences. The page table
    // resolves logical pages to atlas rows at draw time, so atlas moves (another viewport's compaction, an appended tile) never
    // touch the sorted order.
    if (this._field.propose(tiles))
      this._sorter.invalidate();

    return true;
  }

  /** What the sorter needs of each of the candidate's `tiles`. */
  private sortTilesOf(tiles: GaussianSplatVisibleTile[]): GaussianSplatSortTile[] {
    const layout = expectDefined(this._field.candidate);
    return tiles.map(({ geometry, transform }, row) => ({
      id: geometry.id, firstPage: layout.tiles[row].firstPage, count: geometry.splats.count, transform, sortingMethod: geometry.splats.sortingMethod,
    }));
  }

  /** Display the candidate once its order is ready; the completed field stays displayed until then. */
  private displayCandidateIfOrdered(tiles: GaussianSplatVisibleTile[], sortTiles: GaussianSplatSortTile[]): void {
    const ready = this._sorter.ready;
    const splatCount = tiles.reduce((sum, tile) => sum + tile.geometry.splats.count, 0);
    if (!this._field.canCommit(undefined !== ready, splatCount))
      return;

    // A ready order was sorted into the candidate's layout: a sort of any other candidate is not kept.
    this._field.commit(tiles, ready?.instances ?? singleSplatOrder(sortTiles));
    this._sorter.clearReady();
    // The field it replaced no longer needs its tiles.
    this.updateResidency(tiles);
  }

  /** Distance from the eye to the nearest of `tiles`' splats, judged from the eye-space bounds of their means (which can only
   * underestimate it), and at least the near plane's distance, since nearer splats are not drawn. */
  private nearestSplatDistance(tiles: GaussianSplatVisibleTile[]): number {
    const eye = Point3d.createZero();
    const nearest = Math.min(...tiles.map((tile) => tile.eyeRange.distanceToPoint(eye)));
    return Math.max(nearest, this._target.uniforms.frustum.nearPlane);
  }

  private onError(error: unknown): void {
    if (this._disposed)
      return;

    if (this._sorter.isWorkerDisposed) {
      this._target.screenSpaceEffectContext.viewport.requestRedraw();
      IModelApp.requestNextAnimation();
    }

    Logger.logError(FrontendLoggerCategory.Render, String(error));
  }

  public draw(commands: DrawCommands, destination: FrameBuffer, multisampled: boolean): void {
    try {
      this.drawContent(commands, destination, multisampled);
      this._lastError = "";
    } catch (error) {
      // Failure of opt-in content must not prevent the rest of the iModel from rendering.
      const message = String(error);
      if (message !== this._lastError) {
        this._lastError = message;
        this.onError(error);
      }
    }
  }

  /** The tiles a color frame draws, or undefined if the renderer has gone to sleep. */
  private colorTiles(commands: DrawCommands): PreparedTiles | undefined {
    const gathered = gatherGaussianSplatTiles(this._target, commands);
    const drawsSplats = gathered.length > 0 || commands.some((command) => splatGeometryOf(command) !== undefined);
    if (!drawsSplats) {
      // No splat model is drawn any more: once the completed field is gone too, there is nothing to keep.
      if (!this._dormant)
        this.pruneCompleted();

      if (!this._field.completed.length) {
        this.sleep();
        return undefined;
      }
    }

    this._dormant = false;
    return this.prepareOrKeepCompleted(gathered, commands);
  }

  private prepareOrKeepCompleted(gathered: GaussianSplatVisibleTile[], commands: DrawCommands): PreparedTiles {
    try {
      return { tiles: this.prepare(gathered, commands) };
    } catch (error) {
      // Failed staging must not blank the working field. Report the error after
      // drawing the preserved allocation, while leaving other iModel passes intact.
      const preparationError = error instanceof Error ? error : new Error(String(error));
      this.updateResidency([]);
      return { tiles: this.completedTiles(), preparationError };
    }
  }

  private drawContent(commands: DrawCommands, destination: FrameBuffer, multisampled: boolean): void {
    if (this._disposed)
      return;

    const prepared = this.colorTiles(commands);
    if (!prepared)
      return;

    const { tiles, preparationError } = prepared;
    if (tiles.length) {
      this._pass.upload(tiles, this._field);
      this._pass.drawColor(tiles, destination, multisampled);
    }

    if (preparationError)
      throw preparationError;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this._pass.collectStatistics(stats);
    // This viewport's sort worker and sorted orders (positions, sort scratch). They are not tile content: the tile memory limit
    // does not include them. Tiles report their own content; content kept after a tile released it is reported once by the
    // render system.
    stats.addGaussianSplats(this._workerBytes);
  }

  public [Symbol.dispose](): void {
    if (this._disposed)
      return;

    this._disposed = true;
    // Report what was hidden since the last report now, rather than from a timer after disposal.
    this._pass.logHiddenOccurrences();
    this._sorter[Symbol.dispose]();
    this._field[Symbol.dispose]();
    for (const geometry of this._retainedGeometries)
      geometry.release(this);

    this._retainedGeometries.clear();
    this._pass[Symbol.dispose]();
  }
}
