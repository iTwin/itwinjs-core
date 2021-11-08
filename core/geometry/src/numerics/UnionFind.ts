/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * Implement the classic UnionFind algorithm, viz https://en.wikipedia.org/wiki/Disjoint-set_data_structure
 * * Each of the entities being merged exists as an entry in an array.
 * * The index in the array is the (only!) identification of the entity.
 * * The array entry is the index of a parent in the merge process.
 * * New entries are created as singletons pointing to themselves.
 * * Merge (i,j) merges the collections containing entries (i) and (j) into a single collection.
 * * The merge process updates the indices "above" (i) and (j)
 * * The whole process is extraordinarily efficient regardless of the order that the (i,j) merges are announced.
 * @internal
 */
export class UnionFindContext {
  private _parentArray: number[];
  /** Create a set initialized with numLeaf singleton subsets */
  public constructor(numLeaf: number = 0) {
    this._parentArray = [];
    for (let i = 0; i < numLeaf; i++)
      this._parentArray.push(i);
  }
  /** Return the number of leaves. */
  public get length(): number { return this._parentArray.length; }
  /** test if index is within the valid index range. */
  public isValidIndex(index: number): boolean {
    return 0 <= index && index < this._parentArray.length;
  }
  /** Return the index of a new singleton set */
  public addLeaf(): number {
    const index = this._parentArray.length;
    this._parentArray.push(index);
    return index;
  }
  /**
   * * follow links to parent
   * * after finding the parent, repeat the search and reset parents along the way.
   * * If index is invalid, return index unchanged.
   * @param index start of search
   */
  public findRoot(index: number): number {
    if (!this.isValidIndex(index))
      return index;
    let currentIndex = index;
    let nextIndex = this._parentArray[index];
    while (nextIndex !== currentIndex) {
      currentIndex = nextIndex;
      nextIndex = this._parentArray[currentIndex];
    }
    const rootIndex = currentIndex;
    // sweep up again and shorten the paths.
    currentIndex = index;
    while (currentIndex !== rootIndex) {
      nextIndex = this._parentArray[currentIndex];
      this._parentArray[currentIndex] = rootIndex;
      currentIndex = nextIndex;
    }
    return rootIndex;
  }

  /** Merge the subsets containing index (i) and (j)
   * * Look up the root of each.
   * * Fix up the path to the root so it points to the root.
   * * Return the root index of the merged set.
   * * If either index is invalid return index i with no changes.
   */
  public mergeSubsets(i: number, j: number): number {
    if (!this.isValidIndex(i) || !this.isValidIndex(j))
      return i;
    const rootIndexI = this.findRoot(i);
    const rootIndexJ = this.findRoot(j);
    if (rootIndexI !== rootIndexJ)
      this._parentArray[rootIndexI] = rootIndexJ;
    // cleanup a little more ...
    return this.findRoot(i);
  }
  /** Return the immediate parent of index (i), with no fixups
   * * If index is invalid, return it.
   */
  public askParent(index: number): number {
    if (!this.isValidIndex(index))
      return index;
    return this._parentArray[index];
  }
  /** Return the number of entries which are their own parent. */
  public countRoots(): number {
    let numRoot = 0;
    const numLeaf = this._parentArray.length;
    for (let i = 0; i < numLeaf; i++)
      if (this._parentArray[i] === i)
        numRoot++;
    return numRoot;
  }
  /** Return the number of entries whose parent is not a root. */
  public countNonTrivialPaths(): number {
    let numLong = 0;
    const numLeaf = this._parentArray.length;
    for (let i = 0; i < numLeaf; i++) {
      const j = this._parentArray[i];
      if (j !== i && this._parentArray[j] !== j)
        numLong++;
    }
    return numLong;
  }
  /** Return an array of all root indices.
   * * This array is sorted.
   */
  public collectRootIndices(): number[] {
    const roots = [];
    const numLeaf = this._parentArray.length;
    for (let i = 0; i < numLeaf; i++) {
      if (this._parentArray[i] === i)
        roots.push(i);
    }
    return roots;
  }
}
