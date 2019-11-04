/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { immerable } from "immer";
import { compareNumbers, lowerBound } from "@bentley/bentleyjs-core";

/** @internal */
export interface Node {
  readonly id: string;
}

/** @internal */
export class SparseTree<T extends Node> {
  public static [immerable] = true;

  private _rootNodes = new SparseArray<string>();
  private _parentToChildren: Record<string, SparseArray<string>> = {};
  private _idToNode: Record<string, T> = {};

  public getNode(nodeId: string): T | undefined {
    return this._idToNode[nodeId];
  }

  public getChildren(parentId: string | undefined, createIfNotExist: boolean = false): SparseArray<string> | undefined {
    if (parentId === undefined) {
      return this._rootNodes;
    }

    if (this._parentToChildren[parentId] === undefined && createIfNotExist) {
      this._parentToChildren[parentId] = new SparseArray<string>();
    }

    return this._parentToChildren[parentId];
  }

  public setChildren(parentId: string | undefined, children: T[], offset: number) {
    const existingChildren = this.getChildren(parentId);
    if (existingChildren === undefined) {
      return;
    }

    children.forEach((child, index) => {
      const existingChildId = existingChildren.get(offset + index);
      if (existingChildId !== undefined) {
        this.deleteSubtree(existingChildId);
      }

      existingChildren.set(offset + index, child.id);
      this._idToNode[child.id] = child;
    });
  }

  public setNumChildren(parentId: string | undefined, numChildren: number) {
    const children = this.getChildren(parentId, true)!;
    for (const [childId] of children.iterateValues()) {
      this.deleteSubtree(childId);
    }

    children.setLength(numChildren);
  }

  public deleteSubtree(parentId: string | undefined) {
    const children = this.getChildren(parentId);
    if (children !== undefined) {
      for (const [childId] of children.iterateValues()) {
        this.deleteSubtree(childId);
      }
    }

    if (parentId === undefined) {
      this._rootNodes.setLength(0);
    } else {
      delete this._idToNode[parentId];
      delete this._parentToChildren[parentId];
    }
  }
}

/**
 * Structure for sparse array value storage.
 * The main advantage of this class over the standard javascript array is that
 * this class does not need to check each index when iterating values that are
 * stored in the array.
 * @alpha
 */
export class SparseArray<T> implements Iterable<T | undefined> {
  public static [immerable] = true;

  private _length = 0;
  private _array: Array<[T, number]> = [];

  public getLength(): number {
    return this._length;
  }

  public setLength(length: number) {
    const { index } = this.lowerBound(length);
    this._array.length = index;
    this._length = length;
  }

  public get(index: number): T | undefined {
    const { index: i, equal } = this.lowerBound(index);
    return equal ? this._array[i][0] : undefined;
  }

  public set(index: number, value: T) {
    const { index: i, equal } = this.lowerBound(index);
    this._array.splice(i, equal ? 1 : 0, [value, index]);
    this._length = Math.max(this._length, index + 1);
  }

  /**
   * Iterates values that are stored in the array
   * @returns `[value, index]` tuples.
   */
  public iterateValues(): IterableIterator<[T, number]> {
    return this._array[Symbol.iterator]();
  }

  // Iterates the array with all intermediate `undefined` values
  public [Symbol.iterator](): IterableIterator<T | undefined> {
    const array = this._array;
    const length = this._length;
    return (function* () {
      let currentIndex = 0;
      for (const [value, index] of array) {
        for (; currentIndex < index; ++currentIndex) {
          yield undefined;
        }

        yield value;
        ++currentIndex;
      }

      for (; currentIndex < length; ++currentIndex) {
        yield undefined;
      }
    })();
  }

  private lowerBound(index: number): { index: number, equal: boolean } {
    return lowerBound(index, this._array, SparseArray.compare);
  }

  private static compare<T>(index: number, value: [T, number]): number {
    return compareNumbers(index, value[1]);
  }
}
