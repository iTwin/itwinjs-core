/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { ReadonlySortedArray, SortedArray } from "@itwin/core-bentley";
import { TileUser } from "./internal";

/** An immutable set of [[TileUser]]s wherein uniqueness is determined by each TileUser's unique integer identifier.
 * @see [[UniqueTileUserSets]].
 * @internal
 */
export class ReadonlyTileUserSet extends ReadonlySortedArray<TileUser> {
  public constructor(user?: TileUser) {
    super((lhs, rhs) => lhs.tileUserId - rhs.tileUserId);
    if (undefined !== user)
      this._array.push(user);
  }
}

class TileUserSet extends ReadonlyTileUserSet {
  public copyFrom(src: ReadonlyTileUserSet): void {
    this._array.length = src.length;
    let i = 0;
    for (const user of src)
      this._array[i++] = user;
  }

  public clone(): TileUserSet {
    const clone = new TileUserSet();
    clone.copyFrom(this);
    return clone;
  }

  public insert(user: TileUser): number { return this._insert(user); }
  public remove(user: TileUser): number { return this._remove(user); }
  public clear(): void { this._clear(); }
}

function compareTileUserSets(lhs: TileUserSet, rhs: TileUserSet): number {
  if (lhs === rhs)
    return 0;

  let diff = lhs.length - rhs.length;
  if (0 === diff) {
    for (let i = 0; i < lhs.length; i++) {
      diff = lhs.get(i)!.tileUserId - rhs.get(i)!.tileUserId;
      if (0 !== diff)
        break;
    }
  }

  return diff;
}

const emptySet = new ReadonlyTileUserSet();
const scratchSet = new TileUserSet();

class TileUserSetSet extends SortedArray<TileUserSet> {
  public constructor() {
    super((lhs, rhs) => compareTileUserSets(lhs, rhs));
  }

  private getForUser(user: TileUser): TileUserSet {
    for (let i = 0; i < this.length; i++) {
      const set = this._array[i];
      if (1 === set.length && set.get(0)! === user)
        return set;
    }

    const newSet = new TileUserSet(user);
    this.insert(newSet);
    return newSet;
  }

  public getTileUserSet(user: TileUser, users?: ReadonlyTileUserSet): TileUserSet {
    if (undefined === users || users.isEmpty)
      return this.getForUser(user);

    // Use the scratch set for equality comparison - only allocate if no equivalent set already exists.
    const toFind = scratchSet;
    toFind.copyFrom(users);
    toFind.insert(user);
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

  public forgetUser(user: TileUser): void {
    for (const set of this)
      set.remove(user);
  }
}

/** Maintains a set of [[TileUserSets]] designed to minimize duplication.
 * For example, the tile request scheduler needs to associate with each [[TileRequest]] the set of [[TileUser]]s awaiting the request's response.
 * Using UniqueTileUserSets ensures all tiles requested by the same user use the same TileUserSet object.
 * Additionally, whenever a user is unregistered there is no need to track down every associated tile request - the user can just be removed from the TileUserSets managed by this object.
 * The TileUserSets managed by this object should be treated as immutable - "adding" a user to an existing set should be done using [[getTileUserSet]].
 * @internal
 */
export class UniqueTileUserSets {
  private readonly _sets = new TileUserSetSet();

  public getTileUserSet(user: TileUser, users?: ReadonlyTileUserSet): ReadonlyTileUserSet {
    return this._sets.getTileUserSet(user, users);
  }

  public clearAll(): void {
    this._sets.clearAll();
  }

  public clear(): void {
    this._sets.clear();
  }

  public remove(user: TileUser): void {
    this._sets.forgetUser(user);
  }

  public static get emptySet(): ReadonlyTileUserSet {
    return emptySet;
  }
}
