/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Transform } from "@itwin/core-geometry";
import { gaussianSplatsPerPage } from "./GaussianSplatSort";

/** One occurrence of a splat tile: its geometry and the transform from the tile's coordinates to world coordinates. A tile
 * drawn twice with different transforms has two occurrences. @internal
 */
export interface GaussianSplatOccurrence {
  readonly geometryId: number;
  readonly transform: Transform;
}

/** Whether `a` and `b` are the same occurrence of the same tile. @internal */
export function isSameGaussianSplatOccurrence(a: GaussianSplatOccurrence, b: GaussianSplatOccurrence): boolean {
  return a.geometryId === b.geometryId && a.transform.isAlmostEqual(b.transform);
}

/** An occurrence and its number of splats. @internal */
export interface GaussianSplatCountedOccurrence {
  readonly occurrence: GaussianSplatOccurrence;
  readonly count: number;
}

/** The logical pages one sorted occurrence owns. A sorted instance is the single uint32 logical slot
 * `firstPage * gaussianSplatsPerPage + i` for the occurrence's splat `i`. @internal
 */
export interface GaussianSplatLogicalTile extends GaussianSplatCountedOccurrence {
  readonly firstPage: number;
  readonly pageCount: number;
}

/** The logical page layout of a field's occurrences, in draw order, which its sorts are requested with. Logical pages are
 * independent of atlas residency, so a sorted order stays valid while atlas rows move; only the page table changes. @internal
 */
export interface GaussianSplatLogicalLayout {
  readonly tiles: readonly GaussianSplatLogicalTile[];
  readonly pageCount: number;
}

/** A tile row drawn this frame (its metadata row) and its resident atlas rows. @internal */
export interface GaussianSplatDrawnTile extends GaussianSplatCountedOccurrence {
  readonly pages: readonly number[];
}

/** Page table entry tile row for logical pages whose occurrence is not drawn; the vertex shader discards them. @internal */
export const gaussianSplatHiddenTile = 0xffffffff;
/** Width in texels of the page table texture; the vertex shader hard-codes it as a shift and mask. @internal */
export const gaussianSplatPageTableWidth = 1024;
/** 32-bit words per page table texel (RGBA32UI): atlas row, drawn tile row, page within the occurrence, unused. @internal */
export const gaussianSplatPageTableTexelWords = 4;

/** Assign each occurrence a contiguous range of logical pages, in order. @internal */
export function gaussianSplatLogicalLayout(tiles: readonly GaussianSplatCountedOccurrence[]): GaussianSplatLogicalLayout {
  let pageCount = 0;
  const logicalTiles = tiles.map(({ occurrence, count }) => {
    const firstPage = pageCount;
    const tilePageCount = Math.ceil(count / gaussianSplatsPerPage);
    pageCount += tilePageCount;
    return { occurrence, count, firstPage, pageCount: tilePageCount };
  });

  return { tiles: logicalTiles, pageCount };
}

/** Whether `layout` lays out exactly `tiles`: the same occurrences, with the same splat counts, in the same order. @internal */
export function isGaussianSplatLayoutOf(layout: GaussianSplatLogicalLayout, tiles: readonly GaussianSplatCountedOccurrence[]): boolean {
  return layout.tiles.length === tiles.length
    && layout.tiles.every((tile, index) => tile.count === tiles[index].count && isSameGaussianSplatOccurrence(tile.occurrence, tiles[index].occurrence));
}

/** Fill the RGBA32UI page table that pairs a sorted order (with its logical layout) with the tiles drawn this frame:
 * for each logical page, (atlas row, drawn tile row, page within its occurrence). Occurrences are matched in order, so repeated
 * occurrences keep distinct rows. Pages of occurrences not drawn this frame get [[gaussianSplatHiddenTile]],
 * as do those of an occurrence whose atlas pages do not match its logical pages, instead of failing the whole field: counted
 * in `nonResident` if the tile has no atlas pages at all, else in `mismatched` (a bookkeeping error), so the caller can report them.
 * `reuse` is filled instead of a new array when it has the table's length, a whole number of texture rows.
 * @returns the table and the numbers of hidden occurrences.
 * @internal
 */
export function buildGaussianSplatPageTable(layout: GaussianSplatLogicalLayout, drawn: GaussianSplatDrawnTile[], reuse?: Uint32Array): { words: Uint32Array, mismatched: number, nonResident: number } {
  const textureRows = Math.max(1, Math.ceil(layout.pageCount / gaussianSplatPageTableWidth));
  const length = textureRows * gaussianSplatPageTableWidth * gaussianSplatPageTableTexelWords;
  const words = reuse?.length === length ? reuse : new Uint32Array(length);

  // The drawn rows of each geometry, removed as the layout's occurrences are matched to them.
  const rowsByGeometry = new Map<number, Array<{ row: number, tile: GaussianSplatDrawnTile }>>();
  for (const [row, tile] of drawn.entries()) {
    const rows = rowsByGeometry.get(tile.occurrence.geometryId);
    if (rows)
      rows.push({ row, tile });
    else
      rowsByGeometry.set(tile.occurrence.geometryId, [{ row, tile }]);
  }

  const takeDrawnRow = (occurrence: GaussianSplatOccurrence) => {
    const rows = rowsByGeometry.get(occurrence.geometryId);
    const index = rows?.findIndex((row) => isSameGaussianSplatOccurrence(row.tile.occurrence, occurrence)) ?? -1;
    return index < 0 ? undefined : rows?.splice(index, 1)[0];
  };

  let mismatched = 0, nonResident = 0;
  for (const logical of layout.tiles) {
    const candidate = takeDrawnRow(logical.occurrence);
    const shown = candidate?.tile.pages.length === logical.pageCount ? candidate : undefined;
    if (candidate && !shown) {
      if (candidate.tile.pages.length === 0)
        nonResident++;
      else
        mismatched++;
    }

    const atlasRows = shown?.tile.pages;
    const tileRow = shown?.row ?? gaussianSplatHiddenTile;
    for (let page = 0; page < logical.pageCount; page++) {
      const entry = (logical.firstPage + page) * gaussianSplatPageTableTexelWords;
      words[entry] = atlasRows?.[page] ?? 0;
      words[entry + 1] = tileRow;
      words[entry + 2] = page;
      words[entry + 3] = 0;
    }
  }

  return { words, mismatched, nonResident };
}
