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
  private readonly _tasks = new Map<number, { resolve: (result: any) => void, reject: (error: Error) => void }>();
  private _nextId = 0;
  private _disposed = false;

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
    this._worker.onmessageerror = () => this.close(new Error("Gaussian splats worker: invalid response"));
  }

  private close(error: Error): void {
    this._disposed = true;
    this._worker.terminate();
    for (const task of this._tasks.values())
      task.reject(error);

    this._tasks.clear();
  }

  public [Symbol.dispose](): void {
    if (!this._disposed)
      this.close(new Error("Gaussian splats worker disposed"));
  }

  private async call<T>(operation: string, payload: unknown, transfer: Transferable[] = []): Promise<T> {
    if (this._disposed)
      throw new Error("Gaussian splats worker is unavailable");

    return new Promise<T>((resolve, reject) => {
      const id = ++this._nextId;
      this._tasks.set(id, { resolve, reject });
      try {
        this._worker.postMessage({ id, operation, payload }, transfer);
      } catch (error) {
        this._tasks.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public async decode(source: GaussianSplatDecodeRequest): Promise<GaussianSplatData> {
    const arrays = "spz" in source ? [source.spz] : [source.positions, source.rotations, source.scales, source.opacities, source.sh];
    return this.call("decode", source, arrays.map((array) => array.buffer));
  }

  public async register(id: number, positions: Float32Array): Promise<void> {
    await this.call("register", { id, positions }, [positions.buffer]);
  }

  public async release(ids: number[]): Promise<void> { await this.call("release", ids); }
  public async sort(request: GaussianSplatSortRequest): Promise<Uint32Array> { return this.call("sort", request); }
}

let decoder: GaussianSplatWorker | undefined;

/** Decode on a shared worker; tile cancellation is checked by the reader before committing the result.
 * @internal
 */
export async function decodeGaussianSplats(source: GaussianSplatDecodeRequest): Promise<GaussianSplatData> {
  if (!decoder) {
    decoder = new GaussianSplatWorker();
    IModelApp.onBeforeShutdown.addOnce(() => {
      decoder?.[Symbol.dispose]();
      decoder = undefined;
    });
  }

  return decoder.decode(source);
}
