/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { gaussianSplatStride } from "../GaussianSplatData";
import { GaussianSplatLogicalLayout } from "../GaussianSplatInstances";
import { GaussianSplatSortCamera, GaussianSplatSortRequest, GaussianSplatSortTile, isGaussianSplatSortCurrent } from "../GaussianSplatSort";
import { GaussianSplatWorker } from "../GaussianSplatWorker";
import { FrustumUniformType } from "./FrustumUniforms";
import { GaussianSplatGeometry } from "./GaussianSplatGeometry";
import { Target } from "./Target";

/** Worker bytes per registered splat: its float32 sort position. */
const positionBytesPerSplat = 12;
/** Worker bytes per splat of a running sort: its keys, codes, indices and result. */
const sortBytesPerSplat = 32;
/** After a sort worker fails, a new one is started after this delay, doubled with each further failure up to the maximum. */
const firstRestartDelayMs = 1000;
const maxRestartDelayMs = 30_000;

/** The bytes of the sort positions the worker holds for `geometries`. @internal */
export function gaussianSplatSortPositionBytes(geometries: Iterable<GaussianSplatGeometry>): number {
  let bytes = 0;
  for (const geometry of geometries)
    bytes += geometry.splats.count * positionBytesPerSplat;
  return bytes;
}

/** The float32 mean of each splat of `geometry`, packed for the worker. */
function gaussianSplatSortPositions(geometry: GaussianSplatGeometry): Float32Array {
  const { count, data } = geometry.splats;
  const positions = new Float32Array(count * 3);
  // The packed records may be a view into a larger buffer (a decoded glTF buffer, a worker transfer).
  const floats = new Float32Array(data.buffer, data.byteOffset, data.length);
  for (let i = 0; i < count; i++)
    positions.set(floats.subarray(i * gaussianSplatStride, i * gaussianSplatStride + 3), i * 3);

  return positions;
}

/** A finished sort of the candidate and its order. @internal */
export interface GaussianSplatReadySort {
  pending: GaussianSplatPendingSort;
  instances: Uint32Array;
}

/** A requested sort of the candidate. @internal */
export interface GaussianSplatPendingSort {
  request: GaussianSplatSortRequest;
  /** The candidate's layout, which the request sorts into; the sorted order is valid only with a page table built from it. */
  layout: GaussianSplatLogicalLayout;
  /** The camera the request sorts for. */
  camera: GaussianSplatSortCamera;
}

/** What a [[GaussianSplatSortScheduler]] needs from its renderer. @internal */
export interface GaussianSplatSortHost {
  /** The layout of the candidate: a finished sort of another candidate is not kept. */
  candidate(): GaussianSplatLogicalLayout | undefined;
  /** The worker's or the orders' bytes changed. */
  memoryChanged(): void;
  onError(error: unknown): void;
}

/** One viewport's sorting: a worker holding the sort positions of the tiles it draws, which sorts one request at a time.
 * A request made while a sort runs waits (only the latest), and a request is skipped while the candidate is unchanged and the
 * camera has moved too little to change the order. A finished sort of the candidate is held as the ready order until the
 * renderer commits it with its field.
 * @internal
 */
export class GaussianSplatSortScheduler implements Disposable {
  private _worker = new GaussianSplatWorker();
  private _workerGeneration = 0;
  private _activeSortCount = 0;
  private readonly _registered = new Set<number>();
  /** The latest requested sort. Forgetting it (candidate change, worker loss, registration failure, refusal, pruning, sleep)
   * forces the next request to sort. */
  private _requested?: GaussianSplatPendingSort;
  private _sorting = false;
  private _queued?: GaussianSplatPendingSort;
  private _readySort?: GaussianSplatReadySort;
  /** The worker was released by [[sleep]], not lost to a failure. */
  private _asleep = false;
  /** When a failed worker may be replaced, and the delay before replacing the next one that fails. */
  private _restart: { at?: number, delayMs: number, timer?: ReturnType<typeof setTimeout> } = { delayMs: firstRestartDelayMs };
  private _disposed = false;

  public constructor(private readonly _target: Target, private readonly _host: GaussianSplatSortHost) { }

  /** The finished sort of the candidate, not yet committed. */
  public get ready(): GaussianSplatReadySort | undefined { return this._readySort; }
  public get isWorkerDisposed(): boolean { return this._worker.isDisposed; }

  /** CPU bytes the worker and the orders hold, given the bytes of the sort positions of the geometries this viewport retains:
   * the positions (or what the worker reports, if more), the running sort's scratch, and the ready order. The displayed order
   * is the field's.
   */
  public reservedBytes(positionBytes: number): number {
    const workerPositionBytes = Math.max(positionBytes, this._worker.bytesUsed);
    const sortBytes = this._activeSortCount * sortBytesPerSplat;
    const readyOrderBytes = this._readySort?.instances.byteLength ?? 0;
    return workerPositionBytes + sortBytes + readyOrderBytes;
  }

  /** Whether the worker can sort: it has not failed, nor been released by [[sleep]] and not restarted yet. */
  private get _canSort(): boolean { return !this._worker.isDisposed; }

  /** Whether a failed worker must still wait before it is replaced. The first frame that finds it failed starts the wait, which
   * doubles with each failure, and schedules a redraw for its end. */
  private isRestartDelayed(): boolean {
    const now = Date.now();
    const restart = this._restart;
    if (undefined === restart.at) {
      restart.at = now + restart.delayMs;
      restart.timer = setTimeout(() => this.requestRedraw(), restart.delayMs);
      restart.delayMs = Math.min(2 * restart.delayMs, maxRestartDelayMs);
    }

    return now < restart.at;
  }

  /** Replace a worker that was released by [[sleep]], or one that failed once its restart delay has passed: its registrations,
   * requests and orders are gone with it. Meanwhile nothing is registered or sorted, and the displayed field stays as it is. */
  public restartIfLost(): void {
    if (this._canSort)
      return;

    const failed = !this._asleep;
    if (failed && this.isRestartDelayed())
      return;

    this._asleep = false;
    this._restart.at = undefined;
    this._worker = new GaussianSplatWorker();
    this._workerGeneration++;
    this._activeSortCount = 0;
    this._registered.clear();
    this._requested = undefined;
    this._sorting = false;
    this._queued = undefined;
    this._readySort = undefined;
  }

  /** Give the worker the sort positions of `geometries` it does not have, and release those of geometries not among them. */
  public register(geometries: GaussianSplatGeometry[]): void {
    if (!this._canSort)
      return;

    const kept = new Set(geometries.map((geometry) => geometry.id));
    const released = [...this._registered].filter((id) => !kept.has(id));
    if (released.length) {
      for (const id of released)
        this._registered.delete(id);

      this._worker.release(released).catch((error) => this._host.onError(error));
    }

    for (const geometry of geometries) {
      if (this._registered.has(geometry.id))
        continue;

      this._registered.add(geometry.id);
      this._worker.register(geometry.id, gaussianSplatSortPositions(geometry)).catch((error) => {
        this._registered.delete(geometry.id);
        this._requested = undefined;
        this._host.onError(error);
      });
    }
  }

  /** The candidate changed: the next request sorts, and the ready order is dropped. A running or queued sort still runs; its
   * order is kept only if it sorts the candidate by then. */
  public invalidate(): void {
    this._requested = undefined;
    this._readySort = undefined;
  }

  /** As [[invalidate]], and drop the queued sort. */
  public cancel(): void {
    this.invalidate();
    this._queued = undefined;
  }

  /** The ready order was committed. */
  public clearReady(): void {
    this._readySort = undefined;
  }

  /** Request an order of the candidate's occurrences, `tiles`, which sort into the candidate's `layout`. */
  public request(tiles: GaussianSplatSortTile[], layout: GaussianSplatLogicalLayout, nearestSplatDistance: number): void {
    if (!this._canSort)
      return;

    const request = { tiles, perspective: this._target.uniforms.frustum.type === FrustumUniformType.Perspective };
    // The candidate is unchanged and the camera moved too little to change the order: keep the requested one. A new candidate
    // always sorts, since it forgets the requested sort; so a candidate is never left waiting on a skipped sort (its own sort
    // was requested when it became the candidate) and is never shown before that sort is ready.
    const camera = this.sortCamera(request.perspective, nearestSplatDistance);
    const requested = this._requested;
    const requestedOrderValid = requested?.layout === layout && isGaussianSplatSortCurrent(requested.camera, camera, {
      cameraDistance: tiles.some((tile) => tile.sortingMethod !== "viewDepth"),
      viewDepth: tiles.some((tile) => tile.sortingMethod === "viewDepth"),
    });
    if (requestedOrderValid)
      return;

    const pending = { request, layout, camera };
    this._requested = pending;
    if (this._sorting)
      this._queued = pending;
    else
      this.sort(pending);
  }

  /** World eye position and unit view direction of this frame's view. */
  private sortCamera(perspective: boolean, nearestSplatDistance: number): GaussianSplatSortCamera {
    const view = this._target.uniforms.frustum.viewMatrix;
    const eye = view.inverse()?.origin ?? view.origin;
    // The view matrix's third row is the view's z axis in world coordinates.
    const rotation = view.matrix;
    const direction = { x: rotation.at(2, 0), y: rotation.at(2, 1), z: rotation.at(2, 2) };
    const length = Geometry.hypotenuseXYZ(direction.x, direction.y, direction.z) || 1;
    return {
      perspective, eye: { x: eye.x, y: eye.y, z: eye.z }, direction: { x: direction.x / length, y: direction.y / length, z: direction.z / length }, nearestSplatDistance,
    };
  }

  private requestRedraw(): void {
    for (const viewport of IModelApp.viewManager)
      if (viewport.target === this._target)
        viewport.requestRedraw();

    IModelApp.requestNextAnimation();
  }

  private sort(pending: GaussianSplatPendingSort): void {
    const generation = this._workerGeneration;
    this._activeSortCount = pending.request.tiles.reduce((sum, tile) => sum + tile.count, 0);
    this._host.memoryChanged();
    this._sorting = true;
    this._worker.sort(pending.request).then((instances) => {
      // Accept older camera orders during motion, but commit only an order of the latest candidate.
      // The order is committed with its logical layout at the next draw; the page table resolves atlas rows.
      const stale = this._disposed || generation !== this._workerGeneration || pending.layout !== this._host.candidate();
      if (stale)
        return;

      this._readySort = { pending, instances };
      this._restart.delayMs = firstRestartDelayMs;
      this.requestRedraw();
    }).catch((error) => {
      // A failed sort must not stand in for later camera changes: the next request sorts again.
      if (this._requested === pending)
        this._requested = undefined;
      if (pending.layout === this._host.candidate())
        this._host.onError(error);
    }).finally(() => {
      if (generation !== this._workerGeneration)
        return;

      this._sorting = false;
      this._activeSortCount = 0;
      this._host.memoryChanged();
      const queued = this._queued;
      this._queued = undefined;
      if (queued && !this._disposed)
        this.sort(queued);
    });
  }

  /** Release the worker and the positions it holds, and forget every request; the next frame that sorts starts a new worker. */
  public sleep(): void {
    this.cancel();
    this._asleep = true;
    this._registered.clear();
    this._worker[Symbol.dispose]();
  }

  public [Symbol.dispose](): void {
    this._disposed = true;
    clearTimeout(this._restart.timer);
    this._worker[Symbol.dispose]();
  }
}
