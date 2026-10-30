/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "../../../IModelApp";
import { RenderMemory } from "../../../render/RenderMemory";
import { GaussianSplatData } from "../GaussianSplatData";
import { gaussianSplatsPerPage } from "../GaussianSplatSort";
import type { GaussianSplatGeometry } from "./GaussianSplatGeometry";
import { Texture2DArrayHandle, Texture2DArrayRowCopy } from "./Texture";

/** Every texture layer of both arrays is 256x128 RGBA32UI texels; the shader hard-codes this. */
const layerWidth = 256;
const layerHeight = 128;
/** 32-bit words in a row: one page of [[gaussianSplatsPerPage]] base records (8 words each), or as many words of higher SH bands. */
const rowWords = layerWidth * 4;
const rowBytes = rowWords * 4;
/** The shader reads a tile's first auxiliary texel from float32 tile metadata, which is exact only below 2^24 texels. */
const maxExactAuxiliaryLayers = 2 ** 24 / (layerWidth * layerHeight);
/** A rebuilt array has this much more capacity than its rows need, so that the tiles loaded next fit without a rebuild. Once its
 * rows use less than half of the capacity, it is rebuilt smaller.
 */
const spareCapacity = 1.5;

/** A run of rows. */
interface Rows {
  first: number;
  count: number;
}

/** One texture array whose rows are allocated to tiles in contiguous runs. Rows a tile frees are reused by later tiles. When a
 * tile does not fit in the free rows, the array is rebuilt with its rows packed together and spare capacity, as far as the
 * device's array layer limit allows; rebuilding copies the rows on the GPU.
 */
class RowArray implements Disposable {
  public texture?: Texture2DArrayHandle;
  private _rows = new Map<number, Rows>();
  private _rowsInUse = 0;

  public constructor(private readonly _maxLayers: number) { }

  public get rowsInUse(): number { return this._rowsInUse; }
  public get capacity(): number { return this.texture?.rowCount ?? 0; }
  public rowsOf(id: number): Rows | undefined { return this._rows.get(id); }

  /** Upload `data` into `count` rows for tile `id`, padding the last row with zeros.
   * @returns false if the rows do not fit within the device's limit.
   */
  public allocate(id: number, count: number, data: Uint32Array): boolean {
    let first = this.texture ? this.findFreeRows(count) : undefined;
    if (undefined === first) {
      if (!this.rebuild(count))
        return false;

      first = this._rowsInUse;
    }

    // Upload before recording the rows: if the upload fails, they stay free and no tile refers to what it wrote.
    this.upload(first, data);
    this._rows.set(id, { first, count });
    this._rowsInUse += count;
    return true;
  }

  /** Make room for `count` more rows, rebuilding at most once, so that tiles placed one after another do not rebuild the array
   * each time it fills up.
   * @returns false if the rows in use and `count` exceed the device's limit.
   */
  public reserve(count: number): boolean {
    return this.capacity - this._rowsInUse >= count || this.rebuild(count);
  }

  public free(id: number): void {
    const rows = this._rows.get(id);
    if (!rows)
      return;

    this._rows.delete(id);
    this._rowsInUse -= rows.count;
  }

  /** Rebuild smaller once less than half of the capacity is in use. */
  public compactIfSparse(): void {
    if (this.texture && this._rowsInUse * 2 < this.capacity)
      this.rebuild(0);
  }

  /** Replace the texture with one holding the rows in use, packed in their current order, and room for `extraRows` after them,
   * with spare capacity as far as the device allows.
   * @returns false if the rows in use and `extraRows` exceed the device's limit.
   */
  private rebuild(extraRows: number): boolean {
    const exactLayers = Math.max(1, Math.ceil((this._rowsInUse + extraRows) / layerHeight));
    if (exactLayers > this._maxLayers)
      return false;

    const layers = Math.min(this._maxLayers, Math.ceil(exactLayers * spareCapacity));
    const texture = Texture2DArrayHandle.createForIntegerData(layerWidth, layerHeight, layers);
    if (!texture)
      return false;

    const packed = new Map<number, Rows>();
    const copies: Texture2DArrayRowCopy[] = [];
    let next = 0;
    for (const [id, rows] of [...this._rows].sort(([, a], [, b]) => a.first - b.first)) {
      packed.set(id, { first: next, count: rows.count });
      copies.push({ sourceRow: rows.first, targetRow: next, rowCount: rows.count });
      next += rows.count;
    }

    if (this.texture)
      texture.copyRows(this.texture, copies);

    this.texture?.[Symbol.dispose]();
    this.texture = texture;
    this._rows = packed;
    return true;
  }

  /** The first of `count` consecutive free rows, if any. */
  private findFreeRows(count: number): number | undefined {
    let start = 0;
    for (const rows of [...this._rows.values()].sort((a, b) => a.first - b.first)) {
      if (rows.first - start >= count)
        return start;

      start = Math.max(start, rows.first + rows.count);
    }

    return this.capacity - start >= count ? start : undefined;
  }

  private upload(first: number, data: Uint32Array): void {
    const texture = this.texture;
    if (!texture)
      return;

    const fullRows = Math.floor(data.length / rowWords);
    if (fullRows > 0)
      texture.replaceRows(first, data.subarray(0, fullRows * rowWords));

    const remainder = data.subarray(fullRows * rowWords);
    if (remainder.length > 0) {
      const lastRow = new Uint32Array(rowWords);
      lastRow.set(remainder);
      texture.replaceRows(first + fullRows, lastRow);
    }
  }

  public [Symbol.dispose](): void {
    this.texture?.[Symbol.dispose]();
    this.texture = undefined;
    this._rows.clear();
    this._rowsInUse = 0;
  }
}

/** A resident tile's addresses. */
interface Allocation {
  geometry: GaussianSplatGeometry;
  /** Its base pages, one texture row each; replaced, never mutated, when the tile moves. */
  pages: number[];
  /** Its first word in the auxiliary array. */
  auxiliaryOffset: number;
}

function basePageCount(splats: GaussianSplatData): number { return Math.ceil(splats.count / gaussianSplatsPerPage); }
function auxiliaryRowCount(splats: GaussianSplatData): number { return Math.ceil(splats.sh.length / rowWords); }

/** GPU bytes of the atlas rows that splats occupy while resident. @internal */
export function gaussianSplatRowBytes(splats: GaussianSplatData): number {
  return (basePageCount(splats) + auxiliaryRowCount(splats)) * rowBytes;
}

/** The GPU copies of the Gaussian splat geometries that viewports display, in two texture arrays shared by all viewports: base
 * records, and higher SH bands. A viewport makes a candidate field's geometries resident before it sorts them
 * ([[makeResident]]), and a geometry's rows are freed once no viewport retains it ([[remove]]). Tiles count the rows they occupy
 * while resident as part of their content from the time they load, so that the tile cache's limit covers them. Owned by the
 * [[System]].
 * @internal
 */
export class GaussianSplatAtlas implements Disposable {
  private readonly _base: RowArray;
  private readonly _auxiliary: RowArray;
  private readonly _resident = new Map<number, Allocation>();
  private _compactionScheduled = false;

  /** @param maxLayers The device's limit on the layers of an array texture. */
  public constructor(maxLayers: number) {
    this._base = new RowArray(maxLayers);
    this._auxiliary = new RowArray(Math.min(maxLayers, maxExactAuxiliaryLayers));
  }

  public get texture(): WebGLTexture | undefined { return this._base.texture?.getHandle(); }
  public get auxiliaryTexture(): WebGLTexture | undefined { return this._auxiliary.texture?.getHandle(); }

  /** GPU bytes of both arrays, including rows no tile uses. */
  public get bytesUsed(): number { return (this._base.capacity + this._auxiliary.capacity) * rowBytes; }

  /** The tile's pages, or undefined when it is not resident. The array is never mutated. */
  public residentPages(id: number): number[] | undefined { return this._resident.get(id)?.pages; }

  public auxiliaryOffset(id: number): number { return this._resident.get(id)?.auxiliaryOffset ?? 0; }

  /** GPU bytes of the tile's rows; 0 when it is not resident. */
  public residentBytes(id: number): number {
    const baseRows = this._base.rowsOf(id)?.count ?? 0, auxiliaryRows = this._auxiliary.rowsOf(id)?.count ?? 0;
    return (baseRows + auxiliaryRows) * rowBytes;
  }

  /** Upload the rows of every geometry of a candidate field that is not yet resident.
   * @returns false if the device cannot hold them all. Then none of them is uploaded, and the tile admin is asked to free unused
   * tiles and coarsen reality tiles.
   */
  public makeResident(geometries: GaussianSplatGeometry[]): boolean {
    const added = geometries.filter((geometry) => !this._resident.has(geometry.id));
    if (this.reserve(added) && this.placeAll(added))
      return true;

    IModelApp.tileAdmin.onTileContentAllocationFailed();
    return false;
  }

  /** Make room in both arrays for all of `geometries` at once. Placed one after another, a candidate's new tiles would rebuild an
   * array each time they outgrew its spare capacity.
   */
  private reserve(geometries: GaussianSplatGeometry[]): boolean {
    const baseRows = geometries.reduce((sum, { splats }) => sum + basePageCount(splats), 0);
    const auxiliaryRows = geometries.reduce((sum, { splats }) => sum + auxiliaryRowCount(splats), 0);
    return this._base.reserve(baseRows) && this._auxiliary.reserve(auxiliaryRows);
  }

  /** Place all of `geometries`, or none of them. */
  private placeAll(geometries: GaussianSplatGeometry[]): boolean {
    const placed: GaussianSplatGeometry[] = [];
    for (const geometry of geometries) {
      if (!this.place(geometry)) {
        for (const unused of placed)
          this.remove(unused);

        return false;
      }

      placed.push(geometry);
    }

    return true;
  }

  /** Free a geometry's rows. */
  public remove(geometry: GaussianSplatGeometry): void {
    if (!this._resident.delete(geometry.id))
      return;

    this._base.free(geometry.id);
    this._auxiliary.free(geometry.id);
    this.scheduleCompaction();
  }

  /** Report what tiles do not: the rows no resident tile uses, and the content of geometries whose tiles have released them while
   * a viewport still displays them.
   */
  public collectStatistics(stats: RenderMemory.Statistics): void {
    let residentBytes = 0;
    for (const { geometry } of this._resident.values()) {
      const gpuBytes = this.residentBytes(geometry.id);
      residentBytes += gpuBytes;
      if (geometry.isContentReleased) {
        stats.addGaussianSplats(geometry.cpuBytes);
        stats.addTexture(gpuBytes);
      }
    }

    stats.addTexture(this.bytesUsed - residentBytes);
  }

  private place(geometry: GaussianSplatGeometry): boolean {
    const { id } = geometry;
    if (!this._base.allocate(id, basePageCount(geometry.splats), geometry.splats.data))
      return false;

    if (!this._auxiliary.allocate(id, auxiliaryRowCount(geometry.splats), geometry.splats.sh)) {
      this._base.free(id);
      return false;
    }

    this._resident.set(id, { geometry, pages: [], auxiliaryOffset: 0 });
    this.updateAddresses();
    return true;
  }

  /** Refresh the addresses of tiles that were added or moved (a rebuild packs rows). */
  private updateAddresses(): void {
    let moved = false;
    for (const allocation of this._resident.values()) {
      const { id } = allocation.geometry;
      const firstPage = this._base.rowsOf(id)?.first ?? 0;
      const auxiliaryOffset = (this._auxiliary.rowsOf(id)?.first ?? 0) * rowWords;
      const pageCount = basePageCount(allocation.geometry.splats);
      const unchanged = allocation.pages.length === pageCount && allocation.pages[0] === firstPage && allocation.auxiliaryOffset === auxiliaryOffset;
      if (unchanged)
        continue;

      moved ||= allocation.pages.length > 0;
      allocation.pages = Array.from({ length: pageCount }, (_, page) => firstPage + page);
      allocation.auxiliaryOffset = auxiliaryOffset;
    }

    // Viewports drawing a moved tile must draw again with its new addresses.
    if (moved)
      for (const viewport of IModelApp.viewManager)
        viewport.requestRedraw();
  }

  /** Viewports release many tiles at once: compact after all of them have been freed. */
  private scheduleCompaction(): void {
    if (this._compactionScheduled)
      return;

    this._compactionScheduled = true;
    queueMicrotask(() => {
      this._compactionScheduled = false;
      this._base.compactIfSparse();
      this._auxiliary.compactIfSparse();
      this.updateAddresses();
    });
  }

  public [Symbol.dispose](): void {
    this._base[Symbol.dispose]();
    this._auxiliary[Symbol.dispose]();
    this._resident.clear();
  }
}
