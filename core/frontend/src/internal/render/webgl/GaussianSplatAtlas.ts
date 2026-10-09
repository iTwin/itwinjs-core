/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "../../../IModelApp";
import { GaussianSplatData, gaussianSplatStride } from "../GaussianSplatData";
import { GaussianSplatAtlasUpload } from "../GaussianSplatDiagnostics";
import { gaussianSplatsPerPage } from "../GaussianSplatSort";
import { gaussianSplatDecoderBytes } from "../GaussianSplatWorker";
import { GaussianSplatGeometry } from "./GaussianSplatGeometry";
import { System } from "./System";

/** Preserve bindings when using a private program/VAO/textures alongside the native renderer's caches.
 * RenderState and FrameBufferStack continue to own render flags and framebuffer bindings. The
 * viewport is not read back: that query synchronizes with the GPU process and stalled the main
 * thread for milliseconds per frame. Callers that change it restore the target's view rectangle,
 * as the other native passes do.
 * @internal
 */
export function withGaussianSplatBindings<T>(operation: (gl: WebGL2RenderingContext) => T): T {
  const gl = System.instance.context;
  const active = gl.getParameter(gl.ACTIVE_TEXTURE);
  const program = gl.getParameter(gl.CURRENT_PROGRAM);
  const vao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
  const buffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
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
  }
}

const auxiliaryRowFloats = 256 * 4;
const auxiliaryRowsPerPage = 128;
const auxiliaryPageFloats = auxiliaryRowsPerPage * auxiliaryRowFloats;
const basePageBytes = gaussianSplatsPerPage * gaussianSplatStride * 4;
const auxiliaryPageBytes = auxiliaryPageFloats * 4;
/** Spare capacity reserved on each rebuild so that later selection changes upload incrementally. */
const capacitySlack = 1.5;
const maxAuxiliaryPages = 256;
const minimumBudget = 16 * 1024 * 1024;
const totalMemoryLimit = 512 * 1024 * 1024;

/** Float auxiliary stride: optional SH, covariance precision and exact appearance. @internal */
export function gaussianSplatAuxiliaryStride(splats: GaussianSplatData): number {
  return splats.sh.length / splats.count + (splats.covariance ? 6 : 0) + (splats.appearance ? 4 : 0);
}

interface Allocation {
  geometry: WeakRef<GaussianSplatGeometry>;
  /** Contiguous base pages. */
  pages: number[];
  /** First float of the tile's contiguous auxiliary rows. */
  auxiliaryOffset: number;
  auxiliaryRows: number;
}

interface Layout { basePages: number, auxiliaryRows: number, auxiliaryPages: number, bytes: number }
interface Capacity { basePages: number, auxiliaryPages: number }
interface Placement { geometry: GaussianSplatGeometry, allocation: Allocation }

function basePagesOf(geometry: GaussianSplatGeometry): number { return Math.ceil(geometry.splats.count / gaussianSplatsPerPage); }
function auxiliaryRowsOf(geometry: GaussianSplatGeometry): number { return Math.ceil(geometry.splats.count * gaussianSplatAuxiliaryStride(geometry.splats) / auxiliaryRowFloats); }
function capacityBytes(capacity: Capacity): number { return capacity.basePages * basePageBytes + capacity.auxiliaryPages * auxiliaryPageBytes; }
function cpuBytesOf(g: GaussianSplatGeometry): number { return g.splats.data.byteLength + g.splats.sh.byteLength + (g.splats.covariance?.byteLength ?? 0) + (g.splats.appearance?.byteLength ?? 0); }

/** First gap of at least `length` units among sorted `[start, length]` ranges within `capacity`. */
function firstFit(used: Array<[number, number]>, length: number, capacity: number): number | undefined {
  if (length === 0) return 0;
  used.sort((a, b) => a[0] - b[0]);
  let start = 0;
  for (const [s, l] of used) {
    if (s - start >= length) return start;
    start = Math.max(start, s + l);
  }
  return capacity - start >= length ? start : undefined;
}

/** Shared atlas with persistent base and auxiliary texture arrays. Tiles own contiguous page
 * and row ranges, so a selection change uploads only its new tiles. The arrays are rebuilt
 * only to grow, or to compact once less than half the capacity is in use. A rebuild allocates
 * the replacement first when both fit the budget, and otherwise rebuilds in place so resident
 * content can approach the whole budget rather than half of it.
 * @internal
 */
export class GaussianSplatAtlas implements Disposable {
  public texture?: WebGLTexture;
  public auxiliaryTexture?: WebGLTexture;
  public readonly width = 256;
  public readonly height = 128;
  private _basePages = 0;
  private _auxiliaryPages = 0;
  private _statistics?: GaussianSplatAtlasUpload[];
  private _baseStaging?: Uint32Array;
  private _auxiliaryStaging?: Float32Array;

  /** Scope timing to observed draws. Ordinary rendering performs no timing calls. */
  public collectUploadStatistics<T>(statistics: GaussianSplatAtlasUpload[], operation: () => T): T {
    const previous = this._statistics;
    this._statistics = statistics;
    try { return operation(); } finally { this._statistics = previous; }
  }
  private _allocations = new Map<number, Allocation>();
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
  private get _maxAuxiliaryPages(): number { return Math.min(this._maxPages, maxAuxiliaryPages); }
  /** GPU bytes held by the texture arrays, including spare capacity. */
  public get bytesUsed(): number { return capacityBytes({ basePages: this._basePages, auxiliaryPages: this._auxiliaryPages }); }
  /** Bytes the resident tiles need without spare capacity. */
  public get bytesRequired(): number { return this.layout(this.residentGeometries()).bytes; }
  public get numPages(): number { return [...this._allocations.values()].reduce((sum, a) => sum + a.pages.length, 0); }

  private residentGeometries(): GaussianSplatGeometry[] {
    return [...this._allocations.values()].flatMap((a) => { const g = a.geometry.deref(); return g && !g.isDisposed ? [g] : []; });
  }

  private layout(geometries: GaussianSplatGeometry[]): Layout {
    const basePages = geometries.reduce((n, g) => n + basePagesOf(g), 0);
    const auxiliaryRows = geometries.reduce((n, g) => n + auxiliaryRowsOf(g), 0);
    const auxiliaryPages = Math.max(basePages ? 1 : 0, Math.ceil(auxiliaryRows / auxiliaryRowsPerPage));
    return { basePages, auxiliaryRows, auxiliaryPages, bytes: capacityBytes({ basePages, auxiliaryPages }) };
  }

  private fits(layout: Layout): boolean {
    return layout.basePages <= this._maxPages && layout.auxiliaryPages <= this._maxAuxiliaryPages && layout.bytes <= this._budget;
  }

  private selectedWith(user: object, geometries: GaussianSplatGeometry[]): Map<number, GaussianSplatGeometry> {
    const selected = new Map(geometries.map((g) => [g.id, g]));
    for (const [owner, ids] of this._users)
      if (owner !== user)
        for (const id of ids) {
          const g = this._allocations.get(id)?.geometry.deref();
          if (g && !g.isDisposed) selected.set(id, g);
        }
    return selected;
  }

  /** The selection, with every other viewport's ownership, fits the residency budget. */
  public canAdmit(user: object, geometries: GaussianSplatGeometry[]): boolean {
    return this.fits(this.layout([...this.selectedWith(user, geometries).values()]));
  }

  /** Admission includes every viewport's completed/candidate ownership and the CPU/worker estimate. */
  public canUpdate(user: object, geometries: GaussianSplatGeometry[], prospective?: { bytes: number, geometries: GaussianSplatGeometry[] }): boolean {
    const selected = this.selectedWith(user, geometries);
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
    const cpuBytes = [...cpu.values()].reduce((n, g) => n + cpuBytesOf(g), 0);
    return cpuBytes + workerBytes + Math.max(this.bytesUsed, next.bytes) + 2 * auxiliaryPageBytes <= totalMemoryLimit && this.fits(next);
  }

  /** Largest factor by which this user's resident selection could grow while every admission
   * check still passes: the residency budget, array layer limits, and the combined CPU/worker
   * estimate. Other users' ownership and reservations stay fixed. Infinity when this user owns
   * nothing resident.
   */
  public growthHeadroom(user: object): number {
    const own: GaussianSplatGeometry[] = [], others: GaussianSplatGeometry[] = [];
    for (const [owner, ids] of this._users)
      for (const id of ids) {
        const g = this._allocations.get(id)?.geometry.deref();
        if (g && !g.isDisposed) (owner === user ? own : others).push(g);
      }
    const ownLayout = this.layout(own);
    if (ownLayout.bytes <= 0) return Infinity;
    const otherLayout = this.layout(others);
    const ownIds = new Set(own.map((g) => g.id));
    let ownCpu = own.reduce((n, g) => n + cpuBytesOf(g), 0), ownWorker = 0;
    let fixed = gaussianSplatDecoderBytes() + others.reduce((n, g) => n + cpuBytesOf(g), 0);
    for (const [owner, reservation] of this._workerReservations) {
      if (owner === user) {
        ownWorker += reservation.bytes;
        for (const g of reservation.geometries) if (!ownIds.has(g.id)) { ownIds.add(g.id); ownCpu += cpuBytesOf(g); }
      } else {
        fixed += reservation.bytes + reservation.geometries.reduce((n, g) => n + cpuBytesOf(g), 0);
      }
    }
    return Math.max(0, Math.min(
      (this._budget - otherLayout.bytes) / ownLayout.bytes,
      (this._maxPages - otherLayout.basePages) / ownLayout.basePages,
      (this._maxAuxiliaryPages - otherLayout.auxiliaryPages) / ownLayout.auxiliaryPages,
      (totalMemoryLimit - 2 * auxiliaryPageBytes - otherLayout.bytes - fixed) / (ownCpu + ownWorker + ownLayout.bytes),
    ));
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
      if (selected.size === this._allocations.size && [...selected.keys()].every((id) => this._allocations.has(id)))
        return;
      this.apply([...selected.values()]);
    } catch (error) {
      if (before) this._users.set(user, before);
      else this._users.delete(user);
      throw error;
    }
  }

  private selectionKey(geometries: GaussianSplatGeometry[]): string {
    return JSON.stringify(geometries.map((g) => [g.id, g.splats.count]).sort((a, b) => a[0] - b[0]));
  }

  private apply(geometries: GaussianSplatGeometry[]): void {
    if (!this._statistics) {
      this.applyContent(geometries);
      return;
    }
    const start = performance.now();
    const statistics: GaussianSplatAtlasUpload = {
      durationMs: 0, allocationMs: 0, uploadMs: 0, uploadedBytes: 0, allocatedBytes: 0,
      splats: geometries.reduce((n, g) => n + g.splats.count, 0),
      retainedSplats: geometries.reduce((n, g) => n + (this._allocations.has(g.id) ? g.splats.count : 0), 0), succeeded: false,
    };
    try {
      this.applyContent(geometries, statistics);
      statistics.succeeded = true;
    } finally {
      statistics.durationMs = performance.now() - start;
      this._statistics.push(statistics);
    }
  }

  /** Compaction is worthwhile once under half the capacity is in use, and is only attempted
   * when the smaller replacement can be allocated beside the current arrays. */
  private shouldCompact(layout: Layout): boolean {
    return this.texture !== undefined && layout.bytes * 2 < this.bytesUsed && this.bytesUsed + layout.bytes <= this._budget;
  }

  private applyContent(geometries: GaussianSplatGeometry[], statistics?: GaussianSplatAtlasUpload): void {
    const layout = this.layout(geometries);
    if (layout.bytes > 0 && !this.fits(layout))
      throw new Error("Gaussian splats: GPU residency budget exceeded; reduce visible tile detail");
    if (!layout.bytes) {
      this.deleteTextures();
      return;
    }
    const previous = this._allocations;
    const keep = new Set(geometries.map((g) => g.id));
    this._allocations = new Map([...previous].filter(([id]) => keep.has(id)));
    try {
      const incoming = geometries.filter((g) => !this._allocations.has(g.id));
      const placed = this.shouldCompact(layout) ? undefined : this.place(incoming);
      if (placed)
        this.append(placed, geometries, statistics);
      else
        this.rebuild(geometries, layout, statistics);
    } catch (error) {
      if (this.texture !== undefined || this._allocations.size === 0)
        this._allocations = this.texture !== undefined ? previous : new Map();
      throw error;
    }
  }

  /** Contiguous ranges for new tiles inside the current arrays, or undefined when any does not fit. */
  private place(incoming: GaussianSplatGeometry[]): Placement[] | undefined {
    const base: Array<[number, number]> = [], auxiliary: Array<[number, number]> = [];
    for (const a of this._allocations.values()) {
      base.push([a.pages[0], a.pages.length]);
      auxiliary.push([a.auxiliaryOffset / auxiliaryRowFloats, a.auxiliaryRows]);
    }
    const placed: Placement[] = [];
    for (const geometry of incoming) {
      const pages = basePagesOf(geometry), rows = auxiliaryRowsOf(geometry);
      const page = firstFit(base, pages, this._basePages);
      const row = firstFit(auxiliary, rows, this._auxiliaryPages * auxiliaryRowsPerPage);
      if (page === undefined || row === undefined) return undefined;
      base.push([page, pages]);
      auxiliary.push([row, rows]);
      placed.push({ geometry, allocation: { geometry: new WeakRef(geometry), pages: Array.from({ length: pages }, (_, p) => page + p), auxiliaryOffset: row * auxiliaryRowFloats, auxiliaryRows: rows } });
    }
    return placed;
  }

  private append(placed: Placement[], geometries: GaussianSplatGeometry[], statistics?: GaussianSplatAtlasUpload): void {
    withGaussianSplatBindings((gl) => {
      gl.activeTexture(gl.TEXTURE0);
      this.uploadAll(gl, placed, statistics);
      if (gl.getError() !== gl.NO_ERROR) {
        this._blockedSelection = this.selectionKey(geometries);
        throw new Error("Gaussian splats: GPU atlas upload failed");
      }
      for (const { geometry, allocation } of placed) this._allocations.set(geometry.id, allocation);
      this._blockedSelection = "";
    });
  }

  private planCapacity(layout: Layout): Capacity & { inPlace: boolean } {
    const exact = { basePages: layout.basePages, auxiliaryPages: layout.auxiliaryPages };
    const slack = { basePages: Math.min(this._maxPages, Math.ceil(layout.basePages * capacitySlack)), auxiliaryPages: Math.min(this._maxAuxiliaryPages, Math.ceil(layout.auxiliaryPages * capacitySlack)) };
    const old = this.bytesUsed;
    if (old + capacityBytes(slack) <= this._budget)
      return { ...slack, inPlace: false };
    if (old + layout.bytes <= this._budget) {
      const grown = { ...exact };
      while (grown.basePages < slack.basePages && old + capacityBytes(grown) + basePageBytes <= this._budget) grown.basePages++;
      while (grown.auxiliaryPages < slack.auxiliaryPages && old + capacityBytes(grown) + auxiliaryPageBytes <= this._budget) grown.auxiliaryPages++;
      return { ...grown, inPlace: false };
    }
    const shrunk = { ...slack };
    while (capacityBytes(shrunk) > this._budget && (shrunk.basePages > exact.basePages || shrunk.auxiliaryPages > exact.auxiliaryPages)) {
      if (shrunk.basePages > exact.basePages) shrunk.basePages--;
      else shrunk.auxiliaryPages--;
    }
    return { ...shrunk, inPlace: true };
  }

  /** Pack every tile into fresh arrays with spare capacity. Existing tiles keep their relative order. */
  private rebuild(geometries: GaussianSplatGeometry[], layout: Layout, statistics?: GaussianSplatAtlasUpload): void {
    const capacity = this.planCapacity(layout);
    const order = [...geometries].sort((a, b) => (this._allocations.get(a.id)?.pages[0] ?? Infinity) - (this._allocations.get(b.id)?.pages[0] ?? Infinity));
    const placed: Placement[] = [];
    let page = 0, row = 0;
    for (const geometry of order) {
      const pages = basePagesOf(geometry), rows = auxiliaryRowsOf(geometry);
      placed.push({ geometry, allocation: { geometry: new WeakRef(geometry), pages: Array.from({ length: pages }, (_, p) => page + p), auxiliaryOffset: row * auxiliaryRowFloats, auxiliaryRows: rows } });
      page += pages;
      row += rows;
    }
    const previous = { allocations: this._allocations, texture: this.texture, auxiliaryTexture: this.auxiliaryTexture, basePages: this._basePages, auxiliaryPages: this._auxiliaryPages };
    withGaussianSplatBindings((gl) => {
      let base: WebGLTexture | undefined, auxiliary: WebGLTexture | undefined;
      if (capacity.inPlace) {
        // The budget cannot hold both arrays. Release the current ones first; on failure the
        // previous arrays are rebuilt from the retained CPU copies.
        this.deleteTextures();
      }
      try {
        gl.activeTexture(gl.TEXTURE0);
        base = this.allocate(gl, capacity.basePages, gl.RGBA32UI, statistics);
        auxiliary = this.allocate(gl, capacity.auxiliaryPages, gl.RGBA32F, statistics);
        if (gl.getError() !== gl.NO_ERROR)
          throw new Error("Gaussian splats: GPU atlas allocation failed");
        this.uploadAll(gl, placed, statistics, base, auxiliary);
        if (gl.getError() !== gl.NO_ERROR)
          throw new Error("Gaussian splats: GPU atlas upload failed");
        if (!capacity.inPlace) {
          gl.deleteTexture(this.texture ?? null);
          gl.deleteTexture(this.auxiliaryTexture ?? null);
        }
        this.texture = base; this.auxiliaryTexture = auxiliary;
        this._basePages = capacity.basePages; this._auxiliaryPages = capacity.auxiliaryPages;
        this._allocations = new Map(placed.map(({ geometry, allocation }) => [geometry.id, allocation]));
        this._blockedSelection = "";
        // Addresses changed for every viewport sharing the atlas.
        for (const viewport of IModelApp.viewManager) viewport.requestRedraw();
      } catch (error) {
        gl.deleteTexture(base ?? null); gl.deleteTexture(auxiliary ?? null);
        // Lower admission after a driver failure; retry only after traversal reduces the workload.
        this._blockedSelection = this.selectionKey(geometries);
        this._budget = Math.min(this._budget, Math.max(minimumBudget, capacityBytes(previous), Math.floor(capacityBytes(capacity) * 0.75)));
        if (capacity.inPlace)
          this.restore(gl, previous);
        throw error;
      }
    });
  }

  /** Re-create the arrays released by a failed in-place rebuild at their previous addresses. */
  private restore(gl: WebGL2RenderingContext, previous: { allocations: Map<number, Allocation>, basePages: number, auxiliaryPages: number }): void {
    const placed: Placement[] = [];
    for (const allocation of previous.allocations.values()) {
      const geometry = allocation.geometry.deref();
      if (geometry && !geometry.isDisposed) placed.push({ geometry, allocation });
    }
    if (!placed.length) return;
    let base: WebGLTexture | undefined, auxiliary: WebGLTexture | undefined;
    try {
      gl.activeTexture(gl.TEXTURE0);
      base = this.allocate(gl, previous.basePages, gl.RGBA32UI);
      auxiliary = this.allocate(gl, previous.auxiliaryPages, gl.RGBA32F);
      if (gl.getError() !== gl.NO_ERROR) throw new Error("Gaussian splats: GPU atlas allocation failed");
      this.uploadAll(gl, placed, undefined, base, auxiliary);
      if (gl.getError() !== gl.NO_ERROR) throw new Error("Gaussian splats: GPU atlas upload failed");
      this.texture = base; this.auxiliaryTexture = auxiliary;
      this._basePages = previous.basePages; this._auxiliaryPages = previous.auxiliaryPages;
      this._allocations = new Map(placed.map(({ geometry, allocation }) => [geometry.id, allocation]));
    } catch {
      // Nothing remains resident; owners re-stage their content when admission allows.
      gl.deleteTexture(base ?? null); gl.deleteTexture(auxiliary ?? null);
      this._allocations = new Map();
    }
  }

  private allocate(gl: WebGL2RenderingContext, layers: number, format: number, statistics?: GaussianSplatAtlasUpload): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture) throw new Error("Gaussian splats: failed to allocate GPU atlas");
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    const start = statistics ? performance.now() : 0;
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, format, this.width, this.height, Math.max(1, layers));
    if (statistics) {
      statistics.allocationMs += performance.now() - start;
      statistics.allocatedBytes += layers * this.width * this.height * 16;
    }
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private uploadAll(gl: WebGL2RenderingContext, placed: Placement[], statistics?: GaussianSplatAtlasUpload, base = this.texture, auxiliary = this.auxiliaryTexture): void {
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, base ?? null);
    for (const { geometry, allocation } of placed) this.uploadBase(gl, geometry, allocation, statistics);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, auxiliary ?? null);
    for (const { geometry, allocation } of placed) this.uploadAuxiliary(gl, geometry, allocation, statistics);
  }

  private uploadBase(gl: WebGL2RenderingContext, geometry: GaussianSplatGeometry, allocation: Allocation, statistics?: GaussianSplatAtlasUpload): void {
    const values = this._baseStaging ??= new Uint32Array(gaussianSplatsPerPage * gaussianSplatStride);
    const data = geometry.splats.data;
    for (let p = 0; p < allocation.pages.length; p++) {
      const source = data.subarray(p * values.length, (p + 1) * values.length);
      if (source.length < values.length) values.fill(0, source.length);
      values.set(source);
      const start = statistics ? performance.now() : 0;
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, allocation.pages[p], this.width, this.height, 1, gl.RGBA_INTEGER, gl.UNSIGNED_INT, values);
      if (statistics) {
        statistics.uploadMs += performance.now() - start;
        statistics.uploadedBytes += values.byteLength;
      }
    }
  }

  /** The tile's SH, covariance and appearance arrays are stored contiguously, in that order,
   * across whole rows that may span auxiliary pages. One bounded staging buffer is reused. */
  private uploadAuxiliary(gl: WebGL2RenderingContext, geometry: GaussianSplatGeometry, allocation: Allocation, statistics?: GaussianSplatAtlasUpload): void {
    if (!allocation.auxiliaryRows) return;
    const floats = this._auxiliaryStaging ??= new Float32Array(auxiliaryPageFloats);
    const arrays = [geometry.splats.sh, geometry.splats.covariance, geometry.splats.appearance].filter((a): a is Float32Array => !!a && a.length > 0);
    let arrayIndex = 0, arrayOffset = 0;
    const take = (count: number): void => {
      let filled = 0;
      while (filled < count && arrayIndex < arrays.length) {
        const array = arrays[arrayIndex];
        const length = Math.min(count - filled, array.length - arrayOffset);
        floats.set(array.subarray(arrayOffset, arrayOffset + length), filled);
        filled += length;
        arrayOffset += length;
        if (arrayOffset === array.length) { arrayIndex++; arrayOffset = 0; }
      }
      if (filled < count) floats.fill(0, filled, count);
    };
    let row = allocation.auxiliaryOffset / auxiliaryRowFloats, remaining = allocation.auxiliaryRows;
    while (remaining > 0) {
      const layer = Math.floor(row / auxiliaryRowsPerPage), y = row % auxiliaryRowsPerPage;
      const rows = Math.min(remaining, auxiliaryRowsPerPage - y);
      take(rows * auxiliaryRowFloats);
      const start = statistics ? performance.now() : 0;
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, y, layer, this.width, rows, 1, gl.RGBA, gl.FLOAT, floats.subarray(0, rows * auxiliaryRowFloats));
      if (statistics) {
        statistics.uploadMs += performance.now() - start;
        statistics.uploadedBytes += rows * auxiliaryRowFloats * 4;
      }
      row += rows;
      remaining -= rows;
    }
  }

  private deleteTextures(): void {
    const gl = System.instance.context;
    gl.deleteTexture(this.texture ?? null);
    gl.deleteTexture(this.auxiliaryTexture ?? null);
    this.texture = this.auxiliaryTexture = undefined;
    this._basePages = this._auxiliaryPages = 0;
    this._allocations = new Map();
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
    for (const id of [...this._allocations.keys()])
      if (!active.has(id)) this._allocations.delete(id);
    const geometries = this.residentGeometries();
    if (!geometries.length) {
      this.deleteTextures();
      return;
    }
    if (this.shouldCompact(this.layout(geometries))) {
      try { this.apply(geometries); } catch {
        // Closing a view must always release ownership. Addresses belonging to other
        // views are preserved if compaction cannot allocate; later traversal can shrink.
      }
    }
  }

  public [Symbol.dispose](): void {
    this.deleteTextures();
    this._users.clear(); this._workerReservations.clear();
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
