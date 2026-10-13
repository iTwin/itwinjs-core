/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { createWorkerProxy, WorkerProxy } from "../../common/WorkerProxy";
import { IModelApp } from "../../IModelApp";
import { RetryableTileContentError } from "../tile/RetryableTileContentError";
import { GaussianSplatData, gaussianSplatDecodeBytes, GaussianSplatDecodeRequest, gaussianSplatRequestInputBytes } from "./GaussianSplatData";
import { GaussianSplatSortRequest } from "./GaussianSplatSort";

/** The operations of the Gaussian splat worker script, `scripts/gaussian-splats-worker.js`. @internal */
export interface GaussianSplatWorkerOperations {
  decode(request: GaussianSplatDecodeRequest): GaussianSplatData;
  register(tile: { id: number, positions: Float32Array }): void;
  release(ids: number[]): void;
  /** Logical slots, back to front. */
  sort(request: GaussianSplatSortRequest): Uint32Array;
}

/** A call that has not settled after this long means the worker is stuck. */
const callTimeout = 30000;

function createGaussianSplatWorker(): WorkerProxy<GaussianSplatWorkerOperations> {
  return createWorkerProxy(`${IModelApp.publicPath}scripts/gaussian-splats-worker.js`, { callTimeout });
}

/** One viewport's sort worker: it holds the sort positions of the tiles the viewport draws, and sorts them on request. A worker that
 * fails or is disposed loses its registrations; [[isDisposed]] tells its owner to replace it.
 * @internal
 */
export class GaussianSplatWorker implements Disposable {
  private readonly _worker = createGaussianSplatWorker();
  private readonly _positionBytes = new Map<number, number>();
  /** Bytes of sort positions on their way to the worker. */
  private _registeringBytes = 0;

  public get isDisposed(): boolean { return this._worker.isTerminated; }

  /** The sort positions the worker holds or is receiving. */
  public get bytesUsed(): number {
    if (this.isDisposed)
      return 0;

    let positionBytes = this._registeringBytes;
    for (const bytes of this._positionBytes.values())
      positionBytes += bytes;

    return positionBytes;
  }

  public async register(id: number, positions: Float32Array): Promise<void> {
    const bytes = positions.byteLength;
    this._registeringBytes += bytes;
    try {
      await this._worker.register({ id, positions }, [positions.buffer]);
      this._positionBytes.set(id, bytes);
    } finally {
      this._registeringBytes -= bytes;
    }
  }

  public async release(ids: number[]): Promise<void> {
    await this._worker.release(ids);
    for (const id of ids)
      this._positionBytes.delete(id);
  }

  public async sort(request: GaussianSplatSortRequest): Promise<Uint32Array> {
    return this._worker.sort(request);
  }

  public [Symbol.dispose](): void {
    this._worker.terminate();
  }
}

/** The arrays a decode request transfers to the worker, and the bytes the decode reserves while it runs. */
function measureDecode(request: GaussianSplatDecodeRequest) {
  const inputs = request.format === "spz" ? [request.spz] : request.views;
  const inputBytes = gaussianSplatRequestInputBytes(request);
  const peakBytes = gaussianSplatDecodeBytes(request.count, request.shDegree, inputBytes);
  return { transfer: inputs.map((array) => array.buffer), inputBytes, peakBytes };
}

/** A decode waiting for the decoder, or running on it. */
interface DecodeTask {
  readonly request: GaussianSplatDecodeRequest;
  readonly transfer: Transferable[];
  /** Bytes of the arrays the request holds until it runs. */
  readonly inputBytes: number;
  /** Bytes the decode may use while it runs. */
  readonly peakBytes: number;
  readonly isCanceled: () => boolean;
  readonly resolve: (data: GaussianSplatData | undefined) => void;
  readonly reject: (error: unknown) => void;
}

/** After this many consecutive worker failures, a further failure is reported as permanent, so that a decoder that cannot run at all
 * (e.g. its script is missing or blocked by a Content Security Policy) does not make tiles retry forever.
 */
const maxConsecutiveWorkerFailures = 3;

/** Decodes tiles on a worker, one at a time, so that the packing peaks of several tiles never add up. A worker that fails or gets
 * stuck is replaced. Queued decodes still hold their inputs and run on the replacement. The decode whose inputs the failed worker
 * took cannot run again; it fails with a [[RetryableTileContentError]], so that its tile is requested again.
 */
class GaussianSplatDecoder implements Disposable {
  private _worker?: WorkerProxy<GaussianSplatWorkerOperations>;
  private readonly _queue: DecodeTask[] = [];
  private _running?: DecodeTask;
  private _consecutiveWorkerFailures = 0;

  /** The running decode's reservation and the inputs of the queued decodes. */
  public get bytesUsed(): number {
    let bytes = this._running?.peakBytes ?? 0;
    for (const task of this._queue)
      bytes += task.inputBytes;

    return bytes;
  }

  /** Resolves to undefined if `isCanceled` returns true before the decode starts. */
  public async decode(request: GaussianSplatDecodeRequest, isCanceled: () => boolean): Promise<GaussianSplatData | undefined> {
    const { transfer, inputBytes, peakBytes } = measureDecode(request);
    return new Promise((resolve, reject) => {
      this._queue.push({ request, transfer, inputBytes, peakBytes, isCanceled, resolve, reject });
      this.runNext();
    });
  }

  private runNext(): void {
    if (this._running)
      return;

    const task = this.dequeue();
    if (!task)
      return;

    this._running = task;
    const worker = this._worker ??= createGaussianSplatWorker();
    worker.decode(task.request, task.transfer).then((data) => {
      this._consecutiveWorkerFailures = 0;
      task.resolve(data);
    }, (error: unknown) => task.reject(this.decodeFailure(worker, error))).finally(() => {
      this._running = undefined;
      this.runNext();
    });
  }

  /** The next queued decode whose tile still wants it. A canceled decode resolves without running. */
  private dequeue(): DecodeTask | undefined {
    for (let task = this._queue.shift(); task; task = this._queue.shift()) {
      if (!task.isCanceled())
        return task;

      task.resolve(undefined);
    }

    return undefined;
  }

  /** The error to report for a failed decode: the content's own error if the worker rejected the content, else a retryable one. */
  private decodeFailure(worker: WorkerProxy<GaussianSplatWorkerOperations>, error: unknown): unknown {
    const workerStopped = worker.isTerminated;
    if (!workerStopped)
      return error;

    if (this._worker === worker)
      this._worker = undefined;

    const failures = ++this._consecutiveWorkerFailures;
    if (failures > maxConsecutiveWorkerFailures)
      return error;

    const reason = error instanceof Error ? error.message : String(error);
    return new RetryableTileContentError(`Gaussian splat decoder stopped: ${reason}`);
  }

  public [Symbol.dispose](): void {
    const disposed = new Error("Gaussian splat decoder disposed");
    for (const task of [...this._queue.splice(0), this._running])
      task?.reject(disposed);

    this._worker?.terminate();
    this._worker = undefined;
  }
}

let decoder: GaussianSplatDecoder | undefined;

function sharedDecoder(): GaussianSplatDecoder {
  if (!decoder) {
    decoder = new GaussianSplatDecoder();
    IModelApp.onBeforeShutdown.addOnce(() => {
      decoder?.[Symbol.dispose]();
      decoder = undefined;
    });
  }

  return decoder;
}

/** Decode on the shared decoder. Resolves to undefined if `isCanceled` returns true before the decode starts.
 * @internal
 */
export async function decodeGaussianSplats(request: GaussianSplatDecodeRequest, isCanceled: () => boolean): Promise<GaussianSplatData | undefined> {
  return sharedDecoder().decode(request, isCanceled);
}

/** The bytes the shared decoder reserves for its running and queued decodes. @internal */
export function gaussianSplatDecoderBytes(): number { return decoder?.bytesUsed ?? 0; }
