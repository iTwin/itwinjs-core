/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { assert } from "@itwin/core-bentley";
import { Range3d } from "../../geometry3d/Range";

/** Type name FlexData is shorthand for a member or parameter which can be:
 * * undefined
 * * an array of values of type T
 * * a singleton of type T
 */
type FlexData<T> = undefined | T[] | T;
/**
 * Type name IndexToType is shorthand for a member or parameter which can be:
 * * an array of values of type T
 * * a function from integers to type T.
 */
type IndexToType<T> = T[] | ((index: number) => T);

/**
 * Map an (unchecked) integer to a parameterized type T, where the data argument can be either:
 * * an array of type T
 * * a function which takes an index and returns type T
 * @internal
 */
function evaluateIndexToType<T>(data: IndexToType<T>, index: number): T {
  if (Array.isArray(data))
    return data[index];
  return data(index);
}
/**
 * Get data by index from a source that may be undefined, an array of item of type T, or a singleton of the item type.
 * @internal
 */
function getByIndex<T>(index: number, data: FlexData<T>): T | undefined {
  if (data !== undefined) {
    if (Array.isArray(data)) {
      if (index < data.length)
        return data[index];
    } else {
      return data;
    }
  }
  return undefined;
}
/**
 * Return the number of items in an object that can be undefined, an array of item of type T, or a singleton of the item type.
 * @internal
 */
function getFlexDataCount<T>(data: FlexData<T>): number {
  if (data !== undefined) {
    if (Array.isArray(data)) {
      return data.length;
    } else {
      return 1;
    }
  }
  return 0;
}
/**
 * Abstract class for handler objects called during traversal of a single range tree.
 * @internal
 */
export abstract class SingleTreeSearchHandler<AppDataType> {
  /** Return true if appData within the range should be offered to `processAppData`. */
  public abstract isRangeActive(range: Range3d): boolean;
  /**
   * Called for a (single) child referenced by a tree.
   * * This is only called when range checks on the path from root have been passed.
   * @param item child (of type AppDataType) in the tree.
   */
  public abstract processAppData(item: AppDataType): void;
  /**
   * Query to see if the active search has been aborted.
   * * Default implementation returns false so query runs to completion.
   * * Search processes check this after range tests and child processing.
   */
  // eslint-disable-next-line @itwin/prefer-get
  public isAborted(): boolean { return false; }
}
/**
 * Abstract class for handler objects called during traversal of two range trees.
 * @internal
 */
export abstract class TwoTreeSearchHandler<AppDataType> {
  /** Return true if appData within the ranges should be offered to `processAppDataPair`. */
  public abstract isRangePairActive(leftRange: Range3d, rightRange: Range3d): boolean;
  /**
   * Called with AppDataType items from left tree and right tree.
   * * This is only called when range tests have been passed.
   * @param leftItem
   * @param rightItem
   */
  public abstract processAppDataPair(leftItem: AppDataType, rightItem: AppDataType): void;
  /**
   * Query to see if the active search has been aborted.
   * * Default implementation returns false so query runs to completion.
   * * Search processes check this after range tests and child processing.
   */
  // eslint-disable-next-line @itwin/prefer-get
  public isAborted(): boolean { return false; }
}
/**
 * This class refines the TwoTreeSearchHandler with an implementation of `isRangePairActive` appropriate for computing the minimum distance between trees.
 * * The concrete class must implement `getCurrentDistance()` method to provide the best-so-far distance.
 * * The implementation of `isRangePairActive` returns true if the distance between ranges is less than or equal to the `getCurrentDistance()` value.
 * @internal
 */
export abstract class TwoTreeDistanceMinimizationSearchHandler<AppDataType> extends TwoTreeSearchHandler<AppDataType>{
  /**
   * Provides the allowable distance between ranges.
   * * Range pairs with more than this distance separation are rejected.
   * * The implementation may alter (probably reduce) the getCurrentDistance() value as the search progresses.
   */
  public abstract getCurrentDistance(): number;
  /**
   * Method called to decide whether to process subtrees and immediate child appData items from a left tree node and right tree node.
   * @param leftRange range from a node in the left tree
   * @param rightRange range from a node in the right tree.
   * @returns true if the smallest distance from leftRange to rightRange is less than or equal to getCurrentDistance()
   */
  public override isRangePairActive(leftRange: Range3d, rightRange: Range3d): boolean {
    const currentDistance = this.getCurrentDistance();
    const distanceBetweenRanges = leftRange.distanceToRange(rightRange);
    if (distanceBetweenRanges <= currentDistance) {
      return true;
    }
    return false;
  }
}
let numNodeCreated = 0;
/**
 * * TREE STRUCTURE
 *   * A RangeTreeNode is part of a range tree.
 *   * TREE is used here in a strictly _structural_ sense, which has no broad promises about data members.
 *   * Each RangeNode points to 0, 1 or many children.
 *   * Each child has (but does not point back to) a single parent.
 *   * The overall tree has a single root.
 *   * Each node is effectively the root of the tree of its children.
 * * NON-TREE DATA MEMBERS
 *   * Data members in each node (in addition to children) are
 *     * _range = the union of ranges below in the heap
 *     * _appData = application data associated with the node.
 *       * Construction methods may place multiple _appData items in each node.
 * * In common use, only the leaves will have _appData. However, the class definitions allow _appData at all nodes, and search algorithms must include them.
 * * CONSTRUCTION
 *   * The RangeTreeNode.createByIndexSplits method constructs the tree with simple right-left splits within an array of input items.
 *     * The appData is placed entirely in the leaves.
 *     * caller can specify:
 *       * the number of _appData items per leaf
 *       * the number of children per node within the tree.
 *     * "deep" trees (2 children per node and one appData per leaf) may have (compared to shallow trees with many children per node and many appData per leaf)
 *       * faster search because lower nodes have smaller ranges that will be skipped by search algorithms.
 *       * larger memory use because of more nodes
 *   * For future construction methods:
 *      * _appData "above the leaves" may allow nodes below to have smaller ranges, but add complexity to search.
 * @internal
 */
export class RangeTreeNode<AppDataType> {
  private _range: Range3d;
  private _appData: FlexData<AppDataType>;
  private _children: FlexData<RangeTreeNode<AppDataType>>;
  /** an id assigned sequentially as nodes are created.  For debugging use only. */
  private _id: number;
  /**
   * CONSTRUCTOR
   * CAPTURE (not copy)
   * * range = range for search algorithms
   * * appData = application data relevant to this node.
   * * children = child node reference(s).
   */
  private constructor(range: Range3d, appData: FlexData<AppDataType>, children: FlexData<RangeTreeNode<AppDataType>>) {
    this._range = range;
    this._appData = appData;
    this._children = children;
    this._id = numNodeCreated++;
    // const childIds: number[] = [];
    // if (Array.isArray(this._children))
    //   for (const c of this._children) childIds.push(c._id);
    // else if (this._children instanceof RangeTreeNode)
    //   childIds.push(this._children._id);
    // const numAppData = getFlexDataCount(appData);
    // console.log({ id: this._id, childIds, numAppData });
  }
  /** Simplest public create: capture the range, appData, and children. */
  public static createCapture<AppDataType>(
    range: Range3d,
    appData: FlexData<AppDataType>,
    children: FlexData<RangeTreeNode<AppDataType>>): RangeTreeNode<AppDataType> {
    return new RangeTreeNode<AppDataType>(range, appData, children);
  }
  /** copy (not capture) from given data into the range in this RangeEntry */
  public setRange(data: Range3d) {
    this._range.setFrom(data);
  }
  /** return (a copy of) the range in this RangeEntry */
  public getRange(data?: Range3d): Range3d {
    return this._range.clone(data);
  }
  /** return (a reference to) the range in this RangeEntry */
  public getRangeRef(): Range3d {
    return this._range;
  }
  /**
   * Access a child by index.
   * * If the child data is an array, this dereferences the array.
   * * If the child data is a singleton, treat it as index 0.
   * * return undefined if there are no children.
   * @param index index of item to access.
   */
  public getChildByIndex(index: number): RangeTreeNode<AppDataType> | undefined {
    return getByIndex<RangeTreeNode<AppDataType>>(index, this._children);
  }
  /**
   * * Access an appData by index.
   * * If the appData data is an array, this dereferences the array.
   * * If the appData data is a singleton, treat it as if it is at index 0 in an array
   * * return undefined if there are no appData or for any index out of range.
   * @param index index of item to access.
   */
  public getAppDataByIndex(index: number): AppDataType | undefined {
    return getByIndex<AppDataType>(index, this._appData);
  }
  /** Access the children or child (does not clone). */
  public getAllChildren(): FlexData<RangeTreeNode<AppDataType>> {
    return this._children;
  }
  /** Access the appData array or singleton (does not clone). */
  public getAllAppData(): FlexData<AppDataType> {
    return this._appData;
  }
  /**
   * Count the direct children in this node of the tree.
   * * This is not recursive. For a recursive count, use `RangeTreeOps.getRecursiveNodeCount`.
   */
  public getNumChildren(): number {
    return getFlexDataCount(this._children);
  }
  /**
   * Count the appData items in this node of the tree.
   * * This is not recursive. For a recursive count, use `RangeTreeOps.getRecursiveAppDataCount`.
   */
  public getNumAppData(): number {
    return getFlexDataCount(this._appData);
  }
  /**
   * Depth-first tree iteration, calling `announceNode` on each node.
   * @param announceNode callback that returns true to recurse into children
   */
  public recurseIntoTree(announceNode: (node: RangeTreeNode<AppDataType>) => boolean) {
    const doChildren = announceNode(this);
    if (doChildren) {
      if (Array.isArray(this._children)) {
        for (const child of this._children)
          child.recurseIntoTree(announceNode);
      } else if (this._children !== undefined) {
        this._children.recurseIntoTree(announceNode);
      }
    }
  }
  /**
   * Depth-first tree iteration via handler.
   * * if handler decides the instance range is active, process appData, then recurse on children
   * * if handler decides to abort after processing an appData, skip processing rest of appData and children
   */
  public searchTopDown(handler: SingleTreeSearchHandler<AppDataType>) {
    if (handler.isRangeActive(this._range)) {
      let itemToProcess: AppDataType | undefined;
      for (let i = 0; undefined !== (itemToProcess = this.getAppDataByIndex(i)); i++) {
        // console.log(itemToProcess);
        handler.processAppData(itemToProcess);
        if (handler.isAborted())
          return;
      }
      let child: RangeTreeNode<AppDataType> | undefined;
      for (let i = 0; undefined !== (child = this.getChildByIndex(i)); i++) {
        child.searchTopDown(handler);
      }
    }
  }

  /**
   * Apply the handler.processAppDataPair method to each pair of appData items from leftAppData and rightStack.
   * @param leftAppData singleton or array with data "from left"
   * @param rightStack stack of nodes to process from right path.
   * @param reverseArgs true if the caller is exchanging the sense of left and right and this should be undone in the actual call to handler.processAppDataPair.
   * @param handler search handler
   */
  private static processAppDataAndAppDataStack<AppDataType>(
    leftAppData: FlexData<AppDataType>,
    rightStack: RangeTreeNode<AppDataType>[],
    reverseArgs: boolean,
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    if (leftAppData !== undefined) {
      let leftItem: AppDataType | undefined;
      let rightItem: AppDataType | undefined;
      // hmm.. we ASSUME that if the tip ranges passed, then all parent ranges would pass without further test.
      for (let rangeIndex = rightStack.length; rangeIndex-- > 0;) {
        const rightAppData = rightStack[rangeIndex]._appData;
        for (let rightIndex = 0; undefined !== (rightItem = getByIndex<AppDataType>(rightIndex, rightAppData)); rightIndex++) {
          for (let leftIndex = 0; undefined !== (leftItem = getByIndex<AppDataType>(leftIndex, leftAppData)); leftIndex++) {
            if (!reverseArgs)
              handler.processAppDataPair(leftItem, rightItem);
            else
              handler.processAppDataPair(rightItem, leftItem);
            if (handler.isAborted())
              return;
          }
        }
      }
    }
  }

  /**
   * Apply the handler.processAppDataPair method to each pair of appData items from leftAppData and rightAppData.
   * @param leftAppData singleton or array with data "from left"
   * @param rightAppData singleton or array with data "from right"
   * @param reverseArgs true if the caller is exchanging the sense of left and right and this should be undone in the actual call to handler.processAppDataPair.
   * @param handler search handler
   */
  private static processAppDataAndAppData<AppDataType>(
    leftAppData: FlexData<AppDataType>,
    rightAppData: FlexData<AppDataType>,
    reverseArgs: boolean,
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    if (leftAppData !== undefined && rightAppData !== undefined) {
      let leftItem: AppDataType | undefined;
      let rightItem: AppDataType | undefined;
      for (let rightIndex = 0; undefined !== (rightItem = getByIndex<AppDataType>(rightIndex, rightAppData)); rightIndex++) {
        for (let leftIndex = 0; undefined !== (leftItem = getByIndex<AppDataType>(leftIndex, leftAppData)); leftIndex++) {
          if (!reverseArgs)
            handler.processAppDataPair(leftItem, rightItem);
          else
            handler.processAppDataPair(rightItem, leftItem);
          if (handler.isAborted())
            return;
        }
      }
    }
  }
  /**
   * Push the tip node to stack(s).
   * @param tip new node (to be pushed)
   * @param fullPath complete path, which is always extended
   * @param partialPath partial path, which is only extended if the tip has _appData.
   */
  private static pushPaths<AppDataType>(
    tip: RangeTreeNode<AppDataType>,
    fullPath: RangeTreeNode<AppDataType>[],
    partialPath: RangeTreeNode<AppDataType>[],
  ) {
    fullPath.push(tip);
    if (tip._appData !== undefined) {
      partialPath.push(tip);
    }
  }
  /**
   * Pop the tip node from stack(s).
   * @param tip should match the fullPath tip.
   * @param fullPath complete path, which is always popped
   * @param partialPath partial path, which is only popped if the tip has _appData.
   */
  private static popPaths<AppDataType>(
    tip: RangeTreeNode<AppDataType>,
    fullPath: RangeTreeNode<AppDataType>[],
    partialPath: RangeTreeNode<AppDataType>[],
  ) {
    assert(fullPath[fullPath.length - 1] === tip);
    fullPath.pop();
    if (tip._appData !== undefined) {
      partialPath.pop();
    }
  }
  /**
   * Process nodes from left and right trees of dual search.
   * * The separate stacks for nodes that have appData is for efficiency.
   * * If data is entirely in the leaves (or just in a few nodes), the stacks will all be empty (or very small) and no time will be wasted looking up the stacks for appData to process with the other tip.
   * @param leftTip tip node being explored on left
   * @param leftStack stack of prior left nodes
   * @param leftStackWithAppData stack of prior left nodes which have appData.
   * @param rightTip tip node being explored on right.
   * @param rightStack stack of prior right nodes.
   * @param rightStackWithAppData stack of prior right nodes which have appData.
   * @param handler search handler
   */
  private static recursivePairSearch<AppDataType>(
    leftTip: RangeTreeNode<AppDataType>,
    leftStack: RangeTreeNode<AppDataType>[],
    leftStackWithAppData: RangeTreeNode<AppDataType>[],
    rightTip: RangeTreeNode<AppDataType>,
    rightStack: RangeTreeNode<AppDataType>[],
    rightStackWithAppData: RangeTreeNode<AppDataType>[],
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    // console.log({ leftId: leftTip._id, rightId: rightTip._id });
    const leftTipHasAppData = leftTip._appData !== undefined;
    const rightTipHasAppData = rightTip._appData !== undefined;
    let leftChild: RangeTreeNode<AppDataType> | undefined;
    let rightChild: RangeTreeNode<AppDataType> | undefined;

    // process immediate appData from each tip node with the entire prior path of the other side (each stack currently lacks the tip).
    if (leftTipHasAppData && rightStackWithAppData.length > 0) {
      this.processAppDataAndAppDataStack<AppDataType>(leftTip._appData, rightStackWithAppData, false, handler);
    }
    if (leftStackWithAppData.length > 0 && rightTipHasAppData) {
      this.processAppDataAndAppDataStack<AppDataType>(rightTip._appData, leftStackWithAppData, true, handler);
    }

    if (handler.isRangePairActive(leftTip._range, rightTip._range)) {
      this.processAppDataAndAppData<AppDataType>(leftTip._appData, rightTip._appData, false, handler);

      if (leftTip._children !== undefined && rightTip._children !== undefined) {
        this.pushPaths<AppDataType>(leftTip, leftStack, leftStackWithAppData);
        this.pushPaths<AppDataType>(rightTip, rightStack, rightStackWithAppData);
        for (let leftIndex = 0; undefined !== (leftChild = getByIndex<RangeTreeNode<AppDataType>>(leftIndex, leftTip._children)); leftIndex++) {
          for (let rightIndex = 0; undefined !== (rightChild = getByIndex<RangeTreeNode<AppDataType>>(rightIndex, rightTip._children)); rightIndex++) {
            this.recursivePairSearch(
              leftChild, leftStack, leftStackWithAppData,
              rightChild, rightStack, rightStackWithAppData,
              handler);
          }
        }
        this.popPaths<AppDataType>(leftTip, leftStack, leftStackWithAppData);
        this.popPaths<AppDataType>(rightTip, rightStack, rightStackWithAppData);
      } else if (leftTip._children !== undefined) {
        this.leftRecursivePairSearch<AppDataType>(leftTip, rightTip, rightStackWithAppData, false, handler);
      } else if (rightTip._children !== undefined) {
        this.leftRecursivePairSearch<AppDataType>(rightTip, leftTip, leftStackWithAppData, true, handler);
      }
    }
  }
  /**
   * Recurse below the tip of leftTip, offering each level's appData to the appData of rightTip and rightStackWithAppData.
   * @param leftTip tip node being explored on left. Its appData is not processed.
   * @param rightTip tip node being explored on right. It has no children.
   * @param rightStackWithAppData stack of prior right nodes which have appData.
   * @param reverseArgs true if the caller is exchanging the sense of left and right
   * @param handler search handler
   */
  private static leftRecursivePairSearch<AppDataType>(
    leftTip: RangeTreeNode<AppDataType>,
    rightTip: RangeTreeNode<AppDataType>,
    rightStackWithAppData: RangeTreeNode<AppDataType>[],
    reverseArgs: boolean,
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    assert(rightTip._children === undefined);
    // The (possibly deep) left children appData needs to be offered to the right path (including tip)
    // Note that there are no stack push/pop operations -- the right stack is already reaching to leaf level, so there are no range or appData nodes to add.
    let leftChild: RangeTreeNode<AppDataType> | undefined;
    for (let leftIndex = 0; undefined !== (leftChild = getByIndex<RangeTreeNode<AppDataType>>(leftIndex, leftTip._children)); leftIndex++) {
      if (handler.isRangePairActive(leftChild._range, rightTip._range)) {
        this.processAppDataAndAppData<AppDataType>(leftChild._appData, rightTip._appData, reverseArgs, handler);
        this.processAppDataAndAppDataStack<AppDataType>(leftChild._appData, rightStackWithAppData, reverseArgs, handler);
        this.leftRecursivePairSearch<AppDataType>(leftChild, rightTip, rightStackWithAppData, reverseArgs, handler);
      }
    }
  }
  /**
   * Recursive search down two trees, with range tests and child processing under control of a handler.
   * @param leftRoot root of left tree
   * @param rightRoot root of right tree
   * @param handler handler for range tests and child process
   */
  public static searchTwoTreesTopDown<AppDataType>(
    leftRoot: RangeTreeNode<AppDataType>,
    rightRoot: RangeTreeNode<AppDataType>,
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    this.recursivePairSearch(leftRoot, [], [], rightRoot, [], [], handler);
  }
}
/**
 * Utilities for various operations on RangeTree
 * @internal
 */
export class RangeTreeOps {
  /** Count nodes in this tree. */
  public static getRecursiveNodeCount<AppDataType>(root: RangeTreeNode<AppDataType>): number {
    let count = 0;
    root.recurseIntoTree((_node: RangeTreeNode<AppDataType>): boolean => { count++; return true; });
    return count;
  }
  /** Count appData in this tree. */
  public static getRecursiveAppDataCount<AppDataType>(root: RangeTreeNode<AppDataType>): number {
    let count = 0;
    root.recurseIntoTree(
      (node: RangeTreeNode<AppDataType>): boolean => { count += node.getNumAppData(); return true; });
    return count;
  }
  /**
   * Create a leaf referencing appData items indexed index0<=index<index1 and with combined range of the same indices
   * @param ranges access to ranges
   * @param appData access to AppDataType items
   * @param index0 first index for block of items
   * @param index1 upper limit index for block of items.
   * @param arrayLength one more than the largest range/appData index
   * @returns newly created node.
   */
  private static createLeafInIndexRange<AppDataType>(
    ranges: IndexToType<Range3d>,
    appData: IndexToType<AppDataType>,
    index0: number,
    index1: number,
    arrayLength: number): RangeTreeNode<AppDataType> {
    const appDataBlock: AppDataType[] = [];
    const range = Range3d.createNull();
    index1 = Math.min(index1, arrayLength);
    // console.log({ case: "LEAF", index0, index1 });
    for (let i = index0; i < index1; i++) {
      appDataBlock.push(evaluateIndexToType(appData, i));
      range.extendRange(evaluateIndexToType(ranges, i));
    }
    return RangeTreeNode.createCapture(range, appDataBlock, undefined);
  }
  /**
   * Split the array entries appData[index0 <= i < index1] into blocks of at most maxChildPerNode * maxAppDataPerLeaf and assemble into a tree structure.
   * @param ranges access to ranges
   * @param appData access to AppDataType items
   * @param index0 start index of the block to access
   * @param index1 terminal index for the block (one after final)
   * @param arrayLength one more than the largest range/appData index
   * @param maxChildPerNode max number of child nodes in each interior node
   * @param maxAppDataPerLeaf max number of appData items in each leaf.
   * @returns
   */
  private static createRecursiveByIndexSplits<AppDataType>(
    ranges: IndexToType<Range3d>,
    appData: IndexToType<AppDataType>,
    index0: number,
    index1: number,
    arrayLength: number,
    maxChildPerNode: number,
    maxAppDataPerLeaf: number,
  ): RangeTreeNode<AppDataType> | undefined {
    if (index1 > arrayLength)
      index1 = arrayLength;

    const range = Range3d.createNull();
    const children: RangeTreeNode<AppDataType>[] = [];
    const maxChildrenAppData = maxChildPerNode * maxAppDataPerLeaf;
    // console.log({ name: "createRecursive", index0, index1, maxChildrenAppData });

    if (index1 <= index0 + maxChildrenAppData) {  // index range is small enough to hold the appData in leaf children
      // console.log({ case: "LEAF GROUP", index0, index1 });
      for (let indexA = index0 + maxAppDataPerLeaf; index0 < index1; index0 = indexA, indexA = Math.min(indexA + maxAppDataPerLeaf, index1)) {
        const leaf = RangeTreeOps.createLeafInIndexRange(ranges, appData, index0, indexA, arrayLength);
        if (leaf !== undefined) {
          range.extendRange(leaf.getRangeRef());
          children.push(leaf);
        }
      }
    } else {  // split the appData among interior and leaf children
      // console.log({ case: "INTERIOR", index0, index1 });
      const numPerGulp = Math.ceil((index1 - index0) / maxChildPerNode);
      for (let indexA = index0 + numPerGulp; index0 < index1; index0 = indexA, indexA = Math.min(indexA + numPerGulp, index1)) {
        const child = this.createRecursiveByIndexSplits(ranges, appData, index0, indexA, arrayLength, maxChildPerNode, maxAppDataPerLeaf);
        if (child !== undefined) {
          range.extendRange(child.getRangeRef());
          children.push(child);
        }
      }
    }
    return (children.length > 0) ? RangeTreeNode.createCapture(range, undefined, children) : undefined;
  }
  /**
   * Create a range tree by simple left-right split of given ranges.
   * * Leaves carry the inputs in left-to-right order.
   * * Each leaf range is labeled by its corresponding object(s) in the appData array.
   * @param ranges access to ranges.
   * @param appData access to AppDataType items (for leaves).
   * @param arrayLength one more than the largest range/appData index
   * @param maxChildrenPerNode max number of child nodes allowed for each interior node.
   * @param maxAppDataPerLeaf max number of appData items allowed in each leaf.
   * @returns the root of the new tree, or undefined if array lengths differ or are zero.
   */
  public static createByIndexSplits<AppDataType>(
    ranges: IndexToType<Range3d>,
    appData: IndexToType<AppDataType>,
    arrayLength: number,
    maxChildrenPerNode: number = 2,
    maxAppDataPerLeaf: number = 2,
  ): RangeTreeNode<AppDataType> | undefined {
    // console.log();
    // const numData = getFlexDataCount(appData);
    // console.log({ numData });
    if (arrayLength <= 0
      || (Array.isArray(ranges) && ranges.length !== arrayLength)
      || (Array.isArray(appData) && appData.length !== arrayLength))
      return undefined;
    if (maxChildrenPerNode < 2)
      maxChildrenPerNode = 2;
    return RangeTreeOps.createRecursiveByIndexSplits<AppDataType>(ranges, appData, 0, arrayLength, arrayLength, maxChildrenPerNode, maxAppDataPerLeaf);
  }
}

