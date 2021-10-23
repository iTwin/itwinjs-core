/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

// cspell:ignore lhvp rhvp
import { ReadonlySortedArray, SortedArray } from "@itwin/core-bentley";
import { Viewport } from "./Viewport";

/** An immutable set of [[Viewport]]s wherein uniqueness is determined by each Viewport's unique integer identifier.
 * @see [[UniqueViewportSets]].
 * @internal
 */
export class ReadonlyViewportSet extends ReadonlySortedArray<Viewport> {
  public constructor(vp?: Viewport) {
    super((lhs, rhs) => lhs.viewportId - rhs.viewportId);
    if (undefined !== vp)
      this._array.push(vp);
  }
}

class ViewportSet extends ReadonlyViewportSet {
  public copyFrom(src: ReadonlyViewportSet): void {
    this._array.length = src.length;
    let i = 0;
    for (const vp of src)
      this._array[i++] = vp;
  }

  public clone(): ViewportSet {
    const clone = new ViewportSet();
    clone.copyFrom(this);
    return clone;
  }

  public insert(vp: Viewport): number { return this._insert(vp); }
  public remove(vp: Viewport): number { return this._remove(vp); }
  public clear(): void { this._clear(); }
}

function compareViewportSets(lhs: ViewportSet, rhs: ViewportSet): number {
  if (lhs === rhs)
    return 0;

  let diff = lhs.length - rhs.length;
  if (0 === diff) {
    for (let i = 0; i < lhs.length; i++) {
      const lhvp = lhs.get(i)!;
      const rhvp = rhs.get(i)!;
      diff = lhvp.viewportId - rhvp.viewportId;
      if (0 !== diff)
        break;
    }
  }

  return diff;
}

const emptySet = new ReadonlyViewportSet();
const scratchSet = new ViewportSet();

class ViewportSetSet extends SortedArray<ViewportSet> {
  public constructor() {
    super((lhs, rhs) => compareViewportSets(lhs, rhs));
  }

  private getForViewport(vp: Viewport): ViewportSet {
    for (let i = 0; i < this.length; i++) {
      const set = this._array[i];
      if (1 === set.length && set.get(0)! === vp)
        return set;
    }

    const newSet = new ViewportSet(vp);
    this.insert(newSet);
    return newSet;
  }

  public getViewportSet(vp: Viewport, vps?: ReadonlyViewportSet): ViewportSet {
    if (undefined === vps || vps.isEmpty)
      return this.getForViewport(vp);

    // Use the scratch set for equality comparison - only allocate if no equivalent set already exists.
    const toFind = scratchSet;
    toFind.copyFrom(vps);
    toFind.insert(vp);
    const found = this.findEqual(toFind);
    if (undefined !== found) {
      toFind.clear();
      return found;
    }

    const newSet = toFind.clone();
    toFind.clear();
    this.insert(newSet);
    return newSet;
  }

  public clearAll(): void {
    this.forEach((set) => set.clear());
    this.clear();
  }

  public forgetViewport(vp: Viewport): void {
    for (const set of this)
      set.remove(vp);
  }
}

/** Maintains a set of [[ViewportSets]] designed to minimize duplication.
 * For example, the tile request scheduler needs to associate with each [[TileRequest]] the set of viewports awaiting the request's response.
 * Using UniqueViewportSets ensures all tiles requested by the same viewports use the same ViewportSet object.
 * Additionally, whenever a viewport is destroyed there is no need to track down every associated tile request - the viewport can just be removed from the ViewportSets managed by this object.
 * The ViewportSets managed by this object should be treated as immutable - "adding" a viewport to an existing set should be done using [[getViewportSet]].
 * @internal
 */
export class UniqueViewportSets {
  private readonly _sets = new ViewportSetSet();

  public getViewportSet(vp: Viewport, vps?: ReadonlyViewportSet): ReadonlyViewportSet {
    return this._sets.getViewportSet(vp, vps);
  }

  public clearAll(): void {
    this._sets.clearAll();
  }

  public clear(): void {
    this._sets.clear();
  }

  public remove(vp: Viewport): void {
    this._sets.forgetViewport(vp);
  }

  public static get emptySet(): ReadonlyViewportSet {
    return emptySet;
  }
}
