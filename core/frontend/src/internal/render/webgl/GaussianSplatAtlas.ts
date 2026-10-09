/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "../../../IModelApp";
import { GaussianSplatData, gaussianSplatStride } from "../GaussianSplatData";
import { gaussianSplatsPerPage } from "../GaussianSplatSort";
import { gaussianSplatDecoderBytes } from "../GaussianSplatWorker";
import { GaussianSplatGeometry } from "./GaussianSplatGeometry";
import { System } from "./System";

/** Preserve bindings when using a private program/VAO/textures alongside the native renderer's caches.
 * RenderState and FrameBufferStack continue to own render flags and framebuffer bindings.
 * @internal
 */
export function withGaussianSplatBindings<T>(operation: (gl: WebGL2RenderingContext) => T): T {
  const gl = System.instance.context;
  const active = gl.getParameter(gl.ACTIVE_TEXTURE);
  const program = gl.getParameter(gl.CURRENT_PROGRAM);
  const vao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
  const buffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
  const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
  const textures: Array<[WebGLTexture | null, WebGLTexture | null]> = [];
  for (let unit = 0; unit < 5; unit++) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    textures.push([gl.getParameter(gl.TEXTURE_BINDING_2D), gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY)]);
  }

  try {
    return operation(gl);
  } finally {
    for (let unit = 0; unit < textures.length; unit++) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, textures[unit][0]);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, textures[unit][1]);
    }

    gl.activeTexture(active);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
  }
}

const auxiliaryPageFloats = 256 * 128 * 4;
const basePageBytes = gaussianSplatsPerPage * gaussianSplatStride * 4;

/** Float auxiliary stride: optional SH, covariance precision and exact appearance. @internal */
export function gaussianSplatAuxiliaryStride(splats: GaussianSplatData): number {
  return splats.sh.length / splats.count + (splats.covariance ? 6 : 0) + (splats.appearance ? 4 : 0);
}

interface Allocation {
  geometry: WeakRef<GaussianSplatGeometry>;
  pages: number[];
  auxiliaryOffset: number;
}

/** Shared compact atlas with transactional, exact-sized allocations. The budget includes
 * old and incoming GPU storage; no speculative growth or allocation retry is permitted.
 * @internal
 */
export class GaussianSplatAtlas implements Disposable {
  public texture?: WebGLTexture;
  public auxiliaryTexture?: WebGLTexture;
  public readonly width = 256;
  public readonly height = 128;
  private _bytes = 0;
  private readonly _allocations = new Map<number, Allocation>();
  private readonly _users = new Map<object, Set<number>>();
  private readonly _maxPages: number;
  private _blockedSelection = "";
  private readonly _workerReservations = new Map<object, { bytes: number, geometries: GaussianSplatGeometry[] }>();
  public reserveWorker(user: object, bytes: number, geometries: GaussianSplatGeometry[]): void {
    this._workerReservations.set(user, { bytes, geometries });
  }

  public constructor(private _budget = 256 * 1024 * 1024) {
    this._maxPages = System.instance.context.getParameter(System.instance.context.MAX_ARRAY_TEXTURE_LAYERS);
  }
  public get hasSpareCapacity(): boolean { return this._bytes < this._budget / 4; }
  public get bytesUsed(): number { return this._bytes; }
  public get numPages(): number { return [...this._allocations.values()].reduce((sum, a) => sum + a.pages.length, 0); }

  private layout(geometries: GaussianSplatGeometry[]): { basePages: number, auxiliaryPages: number, bytes: number } {
    const basePages = geometries.reduce((n, g) => n + Math.ceil(g.splats.count / gaussianSplatsPerPage), 0);
    const auxiliaryPages = Math.max(basePages ? 1 : 0, Math.ceil(geometries.reduce((n, g) => n + g.splats.count * gaussianSplatAuxiliaryStride(g.splats), 0) / auxiliaryPageFloats));
    return { basePages, auxiliaryPages, bytes: basePages * basePageBytes + auxiliaryPages * auxiliaryPageFloats * 4 };
  }

  /** Stable ownership reserves one additional copy for the incoming field.
   * Bootstrap cannot consume the reserve needed for later coarse replacements. */
  public canAdmit(user: object, geometries: GaussianSplatGeometry[]): boolean {
    const selected = new Map(geometries.map((g) => [g.id, g]));
    for (const [owner, ids] of this._users)
      if (owner !== user)
        for (const id of ids) {
          const g = this._allocations.get(id)?.geometry.deref();
          if (g && !g.isDisposed) selected.set(id, g);
        }
    return this.layout([...selected.values()]).bytes <= this._budget / 2;
  }

  /** Admission includes every viewport's completed/candidate ownership and transition overlap. */
  public canUpdate(user: object, geometries: GaussianSplatGeometry[], prospective?: { bytes: number, geometries: GaussianSplatGeometry[] }): boolean {
    const others = new Set<number>();
    for (const [owner, ids] of this._users)
      if (owner !== user)
        for (const id of ids) others.add(id);
    const selected = new Map(geometries.map((g) => [g.id, g]));
    for (const id of others) {
      const g = this._allocations.get(id)?.geometry.deref();
      if (g && !g.isDisposed) selected.set(id, g);
    }
    if (this.selectionKey([...selected.values()]) === this._blockedSelection) return false;
    const next = this.layout([...selected.values()]);
    const cpu = new Map(selected);
    let workerBytes = gaussianSplatDecoderBytes();
    for (const [owner, reservation] of this._workerReservations) {
      if (owner === user && prospective) continue;
      workerBytes += reservation.bytes;
      for (const geometry of reservation.geometries) cpu.set(geometry.id, geometry);
    }
    if (prospective) {
      workerBytes += prospective.bytes;
      for (const geometry of prospective.geometries) cpu.set(geometry.id, geometry);
    }
    const cpuBytes = [...cpu.values()].reduce((n, g) => n + g.splats.data.byteLength + g.splats.sh.byteLength + (g.splats.covariance?.byteLength ?? 0) + (g.splats.appearance?.byteLength ?? 0), 0);
    return cpuBytes + workerBytes + next.bytes + this._bytes + 2 * auxiliaryPageFloats * 4 <= 512 * 1024 * 1024 && next.basePages <= this._maxPages && next.auxiliaryPages <= Math.min(this._maxPages, 128) && next.bytes + this._bytes <= this._budget;
  }

  public update(user: object, geometries: GaussianSplatGeometry[]): void {
    const before = this._users.get(user);
    this._users.set(user, new Set(geometries.map((g) => g.id)));
    try {
      const selected = new Map(geometries.map((g) => [g.id, g]));
      for (const ids of this._users.values())
        for (const id of ids) {
          const g = this._allocations.get(id)?.geometry.deref();
          if (g && !g.isDisposed) selected.set(id, g);
        }
      if (this.layout([...selected.values()]).bytes === this._bytes && selected.size === this._allocations.size && [...selected.keys()].every((id) => this._allocations.has(id)))
        return;
      this.replace([...selected.values()]);
    } catch (error) {
      if (before) this._users.set(user, before);
      else this._users.delete(user);
      throw error;
    }
  }

  private selectionKey(geometries: GaussianSplatGeometry[]): string {
    return JSON.stringify(geometries.map((g) => [g.id, g.splats.count]).sort((a, b) => a[0] - b[0]));
  }

  private replace(geometries: GaussianSplatGeometry[]): void {
    const layout = this.layout(geometries);
    if (layout.bytes > 0 && (layout.basePages > this._maxPages || layout.auxiliaryPages > Math.min(this._maxPages, 128) || layout.bytes + this._bytes > this._budget))
      throw new Error("Gaussian splats: GPU residency budget exceeded; reduce visible tile detail");
    const allocations = new Map<number, Allocation>();
    let page = 0, auxiliaryOffset = 0;
    for (const geometry of geometries) {
      const pages = Array.from({ length: Math.ceil(geometry.splats.count / gaussianSplatsPerPage) }, () => page++);
      allocations.set(geometry.id, { geometry: new WeakRef(geometry), pages, auxiliaryOffset });
      auxiliaryOffset += geometry.splats.count * gaussianSplatAuxiliaryStride(geometry.splats);
    }
    withGaussianSplatBindings((gl) => {
      let base: WebGLTexture | undefined, auxiliary: WebGLTexture | undefined;
      try {
        const allocate = (layers: number, format: number) => {
          const texture = gl.createTexture();
          if (!texture) throw new Error("Gaussian splats: failed to allocate GPU atlas");
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
          gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, format, this.width, this.height, layers);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          return texture;
        };
        gl.activeTexture(gl.TEXTURE0);
        if (layout.basePages) base = allocate(layout.basePages, gl.RGBA32UI);
        if (gl.getError() !== gl.NO_ERROR)
          throw new Error("Gaussian splats: GPU atlas allocation failed");
        const values = new Uint32Array(gaussianSplatsPerPage * gaussianSplatStride);
        for (const g of geometries) {
          const a = allocations.get(g.id)!;
          for (let p = 0; p < a.pages.length; p++) {
            values.fill(0);
            values.set(g.splats.data.subarray(p * values.length, (p + 1) * values.length));
            gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, a.pages[p], this.width, this.height, 1, gl.RGBA_INTEGER, gl.UNSIGNED_INT, values);
          }
        }
        if (layout.auxiliaryPages) {
          auxiliary = allocate(layout.auxiliaryPages, gl.RGBA32F);
          // One bounded page staging buffer, rather than a second entire snapshot.
          const floats = new Float32Array(auxiliaryPageFloats);
          let used = 0, layer = 0;
          const flush = () => {
            gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer++, this.width, this.height, 1, gl.RGBA, gl.FLOAT, floats);
            floats.fill(0); used = 0;
          };
          const append = (array: Float32Array, start: number, length: number) => {
            for (let i = start; i < start + length; i++) {
              floats[used++] = array[i];
              if (used === floats.length) flush();
            }
          };
          for (const g of geometries) {
            const shStride = g.splats.sh.length / g.splats.count;
            for (let i = 0; i < g.splats.count; i++) {
              append(g.splats.sh, i * shStride, shStride);
              if (g.splats.covariance) append(g.splats.covariance, i * 6, 6);
              if (g.splats.appearance) append(g.splats.appearance, i * 4, 4);
            }
          }
          if (used) flush();
        }
        if (gl.getError() !== gl.NO_ERROR)
          throw new Error("Gaussian splats: GPU atlas upload failed");
        gl.deleteTexture(this.texture ?? null);
        gl.deleteTexture(this.auxiliaryTexture ?? null);
        this.texture = base; this.auxiliaryTexture = auxiliary;
        base = auxiliary = undefined;
        this._blockedSelection = "";
        this._bytes = layout.bytes;
        this._allocations.clear();
        for (const [id, a] of allocations) this._allocations.set(id, a);
        for (const viewport of IModelApp.viewManager) viewport.requestRedraw();
      } catch (error) {
        gl.deleteTexture(base ?? null); gl.deleteTexture(auxiliary ?? null);
        // Lower admission after a driver failure; retry only after traversal reduces the workload.
        this._blockedSelection = this.selectionKey(geometries);
        // Keep the reserve required to retire the completed field. Reducing below
        // that reserve would reject every later coarse replacement by construction.
        this._budget = Math.min(this._budget, Math.max(16 * 1024 * 1024, this._bytes * 1.5, Math.floor((this._bytes + layout.bytes) * 0.75)));
        throw error;
      }
    });
  }

  public pages(id: number): number[] {
    const allocation = this._allocations.get(id);
    if (!allocation) throw new Error("Gaussian splats: missing GPU tile allocation");
    return allocation.pages;
  }
  public auxiliaryOffset(id: number): number { return this._allocations.get(id)?.auxiliaryOffset ?? 0; }

  public release(user: object): void {
    this._users.delete(user);
    this._workerReservations.delete(user);
    const active = new Set([...this._users.values()].flatMap((ids) => [...ids]));
    const geometries = [...this._allocations].flatMap(([id, a]) => {
      const g = a.geometry.deref();
      return active.has(id) && g && !g.isDisposed ? [g] : [];
    });
    if (geometries.length !== this._allocations.size) {
      try { this.replace(geometries); } catch {
        // Closing a view must always release ownership. Preserve addresses belonging
        // to other views if compaction cannot allocate; later traversal can shrink.
        for (const id of this._allocations.keys())
          if (!active.has(id)) this._allocations.delete(id);
      }
    }
  }

  public [Symbol.dispose](): void {
    System.instance.context.deleteTexture(this.texture ?? null);
    System.instance.context.deleteTexture(this.auxiliaryTexture ?? null);
    this.texture = this.auxiliaryTexture = undefined;
    this._bytes = 0; this._allocations.clear(); this._users.clear(); this._workerReservations.clear();
  }
}

let atlas: GaussianSplatAtlas | undefined;

/** @internal */
export function getGaussianSplatAtlas(): GaussianSplatAtlas {
  if (!atlas) {
    atlas = new GaussianSplatAtlas();
    IModelApp.onBeforeShutdown.addOnce(() => {
      atlas?.[Symbol.dispose]();
      atlas = undefined;
    });
  }

  return atlas;
}
