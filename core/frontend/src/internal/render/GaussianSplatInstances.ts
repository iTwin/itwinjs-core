/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { gaussianSplatsPerPage } from "./GaussianSplatSort";

/** A transformed tile occurrence and its current atlas pages. @internal */
export interface InstanceTile {
  identity: string;
  pages: number[];
}

/** Preserve sorted order while resolving changed occurrences or atlas pages.
 * May return the input array; callers must treat the result as immutable. @internal
 */
export function remapSortedInstances(instances: Uint32Array, previous: InstanceTile[], current: InstanceTile[]): Uint32Array {
  // Camera-only sorts and picks commonly keep the same occurrence rows and page
  // addresses. The worker's order is already usable; do not walk/copy every splat.
  if (previous.length === current.length && previous.every((tile, t) => tile.identity === current[t].identity
    && tile.pages.length === current[t].pages.length && tile.pages.every((page, p) => page === current[t].pages[p])))
    return instances;

  const occurrences = new Map<string, number[]>();
  for (let t = 0; t < current.length; t++) {
    const rows = occurrences.get(current[t].identity) ?? [];
    rows.push(t);
    occurrences.set(current[t].identity, rows);
  }

  const matches = previous.map((tile) => {
    const t = occurrences.get(tile.identity)?.shift();
    if (t === undefined)
      return undefined;

    // Native atlas allocations are contiguous per tile. A moved tile normally
    // needs one address offset, not a page-map lookup for every sorted splat.
    const delta = current[t].pages[0] - tile.pages[0];
    const offset = tile.pages.length === current[t].pages.length && tile.pages.every((page, p) => current[t].pages[p] - page === delta)
      ? delta * gaussianSplatsPerPage : undefined;
    const pages = offset === undefined ? new Map(tile.pages.map((page, p) => [page, current[t].pages[p]])) : undefined;
    return { t, pages, offset };
  });
  const remapped = new Uint32Array(instances.length);
  let count = 0;
  for (let i = 0; i < instances.length; i += 2) {
    const match = matches[instances[i + 1]];
    if (!match)
      continue;
    if (match.offset !== undefined) {
      remapped[count++] = instances[i] + match.offset;
      remapped[count++] = match.t;
    } else {
      const page = match.pages?.get(Math.floor(instances[i] / gaussianSplatsPerPage));
      if (page !== undefined) {
        remapped[count++] = page * gaussianSplatsPerPage + instances[i] % gaussianSplatsPerPage;
        remapped[count++] = match.t;
      }
    }
  }

  return count === remapped.length ? remapped : remapped.slice(0, count);
}
