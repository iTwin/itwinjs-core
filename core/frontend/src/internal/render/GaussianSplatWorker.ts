/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "../../IModelApp";
import { GaussianSplatData, GaussianSplatDecodeRequest } from "./GaussianSplatData";
import { GaussianSplatSortRequest } from "./GaussianSplatSort";

/** Browser decoder/sorter client with deterministic termination and rejection of pending calls.
 * @internal
 */
export class GaussianSplatWorker implements Disposable {
  private readonly _worker: Worker;
  private readonly _tasks = new Map<number, { resolve: (result: any) => void, reject: (error: Error) => void, timer: ReturnType<typeof setTimeout>, bytes: number }>();
  private _nextId = 0;
  private _disposed = false;
  private _wasmBytes = 0;
  private _pendingBytes = 0;
  private _queuedDecodeBytes = 0;
  private _decodeBusy = false;
  private _decodedSpz = false;
  private readonly _decodeQueue: Array<{ run: () => void, reject: (error: Error) => void, bytes: number }> = [];
  private readonly _positionBytes = new Map<number, number>();
  public get isIdle(): boolean { return this._tasks.size === 0 && !this._decodeBusy && this._decodeQueue.length === 0; }
  public get bytesUsed(): number { return this._wasmBytes + this._pendingBytes + this._queuedDecodeBytes + [...this._positionBytes.values()].reduce((a, b) => a + b, 0); }
  public get decodedSpz(): boolean { return this._decodedSpz; }
  public get wasmBytes(): number { return this._wasmBytes; }

  public get isDisposed(): boolean { return this._disposed; }

  public constructor() {
    const url = new URL(`${IModelApp.publicPath}scripts/gaussian-splats-worker.js`, globalThis.location.href);
    let blob: string | undefined;
    if (url.origin !== globalThis.location.origin)
      blob = URL.createObjectURL(new Blob([`importScripts(${JSON.stringify(url.toString())});`], { type: "text/javascript" }));

    this._worker = new Worker(blob ?? url);
    if (blob)
      URL.revokeObjectURL(blob);

    this._worker.onmessage = (event) => {
      const task = this._tasks.get(event.data.id);
      if (!task)
        return;

      this._pendingBytes -= task.bytes;
      clearTimeout(task.timer);
      this._wasmBytes = event.data.wasmBytes ?? this._wasmBytes;
      this._tasks.delete(event.data.id);
      if (event.data.error)
        task.reject(new Error(event.data.error));
      else
        task.resolve(event.data.result);
    };
    this._worker.onerror = (event) => {
      event.preventDefault();
      this.close(new Error(`Gaussian splats worker: ${event.message}`));
    };
    this._worker.addEventListener("messageerror", () => this.close(new Error("Gaussian splats worker: invalid response")));
  }

  private close(error: Error): void {
    this._disposed = true;
    this._worker.terminate();
    for (const task of this._tasks.values()) {
      clearTimeout(task.timer);
      task.reject(error);
    }

    for (const task of this._decodeQueue) task.reject(error);
    this._decodeQueue.length = 0;
    this._queuedDecodeBytes = 0;
    this._tasks.clear();
    this._pendingBytes = 0;
    this._wasmBytes = 0;
    this._positionBytes.clear();
  }

  public [Symbol.dispose](): void {
    if (!this._disposed)
      this.close(new Error("Gaussian splats worker disposed"));
  }

  private async call<T>(operation: string, payload: unknown, transfer: Transferable[] = [], bytes = 0): Promise<T> {
    if (this._disposed)
      throw new Error("Gaussian splats worker is unavailable");

    return new Promise<T>((resolve, reject) => {
      const id = ++this._nextId;
      const timer = setTimeout(() => this.close(new Error("Gaussian splats worker timed out")), 30000);
      this._pendingBytes += bytes;
      this._tasks.set(id, { resolve, reject, timer, bytes });
      try {
        this._worker.postMessage({ id, operation, payload }, transfer);
      } catch (error) {
        this._pendingBytes -= bytes;
        clearTimeout(timer);
        this._tasks.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public async decode(source: GaussianSplatDecodeRequest): Promise<GaussianSplatData> {
    const arrays = "spz" in source ? [source.spz] : [source.positions, source.rotations, source.scales, source.opacities, source.sh];
    const inputBytes = arrays.reduce((n, array) => n + array.byteLength, 0);
    const count = "spz" in source ? source.count : source.opacities.length;
    const stride = "spz" in source ? 48 : source.sh.length / Math.max(1, count);
    const peakBytes = Math.max(inputBytes, count * (stride * 8 + 160));
    if (peakBytes > 512 * 1024 * 1024)
      throw new Error("Gaussian splats tile packing budget exceeded");
    if (this._disposed)
      throw new Error("Gaussian splats worker is unavailable");

    // Queue inputs on the caller, reserving only their existing buffers until
    // execution. Temporary decoder pressure must not permanently fail valid tiles.
    return new Promise<GaussianSplatData>((resolve, reject) => {
      const run = () => {
        this._decodeBusy = true;
        void this.call<GaussianSplatData>("decode", source, arrays.map((array) => array.buffer), peakBytes).then((result) => {
          this._decodedSpz ||= "spz" in source;
          this.finishDecode();
          resolve(result);
        }, (error) => {
          this.finishDecode();
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      };
      if (this._decodeBusy) {
        this._queuedDecodeBytes += inputBytes;
        this._decodeQueue.push({ run, reject, bytes: inputBytes });
      } else {
        run();
      }
    });
  }

  private finishDecode(): void {
    this._decodeBusy = false;
    const next = this._decodeQueue.shift();
    if (next) {
      this._queuedDecodeBytes -= next.bytes;
      next.run();
    }
  }

  public async register(id: number, positions: Float32Array): Promise<void> {
    const bytes = positions.byteLength;
    await this.call("register", { id, positions }, [positions.buffer], bytes);
    this._positionBytes.set(id, bytes);
  }

  public async release(ids: number[]): Promise<void> {
    await this.call("release", ids);
    for (const id of ids) this._positionBytes.delete(id);
  }
  public async sort(request: GaussianSplatSortRequest): Promise<Uint32Array> { return this.call("sort", request); }
}

let decoder: GaussianSplatWorker | undefined;

/** Decode on a shared worker; tile cancellation is checked by the reader before committing the result.
 * @internal
 */
export async function decodeGaussianSplats(source: GaussianSplatDecodeRequest): Promise<GaussianSplatData> {
  if (!decoder || decoder.isDisposed) {
    const replacement = new GaussianSplatWorker();
    // One listener per application lifetime disposes whichever worker is current.
    if (!decoder) {
      IModelApp.onBeforeShutdown.addOnce(() => {
        decoder?.[Symbol.dispose]();
        decoder = undefined;
      });
    }

    decoder = replacement;
  }

  const worker = decoder;
  const result = await worker.decode(source);
  // Retire idle SPZ codec or oversized packing heaps without replaying detached inputs.
  if (worker.isIdle && (worker.decodedSpz || worker.wasmBytes > 64 * 1024 * 1024))
    worker[Symbol.dispose]();
  return result;
}

/** Shared decoder's retained heap and queued input reservation. @internal */
export function gaussianSplatDecoderBytes(): number { return decoder?.bytesUsed ?? 0; }
