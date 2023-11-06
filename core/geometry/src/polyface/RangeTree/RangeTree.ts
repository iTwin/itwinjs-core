/* eslint-disable no-console */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d } from "../../geometry3d/Range";

/** @packageDocumentation
 * @module CartesianGeometry
 */

type FlexData<T> = undefined | T[] | T;
/**
 * Parameterized type which can be
 * * an array of type T
 * * a function which takes an index and returns type T
 */
type IndexToType<T> = T[] | ((index: number) => T);

function evaluateIndexToType<T>(data: IndexToType<T>, index: number): T {
  if (Array.isArray(data))
    return data[index];
  return data(index);
}
/**
 * Get data by index from a source that may be undefined, an array of item of type T, or a singleton of the item type.
 * @param index
 * @param data
 * @returns
 */
function getByIndex<T>(index: number, data: FlexData<T>) {
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
 * Get data by index from a source that may be undefined, an array of item of type T, or a singleton of the item type.
 * @param index
 * @param data
 * @returns
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

export abstract class SingleTreeSearchHandler<AppDataType> {
  /** return true if appData within the range should be offered to processAppData */
  public abstract isRangeActive(range: Range3d): boolean;
  public abstract processAppData(item: AppDataType): void;
  /** query to see if the active search has been aborted.  Default returns false so
   * * Default implementation returns false so query runs to completion.
   */
  // eslint-disable-next-line @itwin/prefer-get
  public isAborted(): boolean { return false; }
}
export abstract class TwoTreeSearchHandler<AppDataType> {
  /** Method which must be implemented by the concrete class.
   * * return true if appData within the ranges should be offered to processAppDataPair. */
  public abstract isRangePairActive(leftRange: Range3d, rightRange: Range3d): boolean;
  public abstract processAppDataPair(leftItem: AppDataType, rightItem: AppDataType): void;
  /** query to see if the active search has been aborted.  Default returns false so
   * * Default implementation returns false so query runs to completion.
   */
  // eslint-disable-next-line @itwin/prefer-get
  public isAborted(): boolean { return false; }
}
/** This class implements the isRangePairActive method, with logic appropriate to
 * searching for minimum distance between AppDataItems.
 * * The concrete class must implement getCurrentDistance() method to provide the best-so-far distance.
 * * This class' implementation of isRangePairActive with return true if the smallest distance between ranges is
 *    less than or equal to the getCurrentDistance() value.
 * * The concrete class can reduce the getCurrentDistance() value as it progresses.
 */
export abstract class TwoTreeDistanceMinimizationSearchHandler<AppDataType> extends TwoTreeSearchHandler<AppDataType>{
  /** REQUIRED method to provide the allowable distance between ranges.
   * * Range pairs with more than this distance separation are rejected.
   * * The implementation may alter (probably reduce) the getCurrentDistance() value as the search progresses.
   */
  public abstract getCurrentDistance(): number;
  /**
   *
   * @param range range containing items to be tested.
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
 *   * TREE is used here in a strictly _structural_ since, which has no broad promises about data members.
 *   * Each RangeNode points to 0, 1 or many _children.
 *   * Each child has (but does not point back to) a single parent.
 *   * The overall tree has a single root.
 *   * Each node is effectively the root of the tree of its children.
 * * NON-TREE DATA MEMBERS
 *   * Data members in each node (in addition to children) are
 *     * _range = the union of ranges below in the heap
 *     * _appData = application data associated with the node.
 *       * Construction methods may place multiple _appData items in each node.
 * * In common use, only the leaves will have _appData.   However, the class definitions allow _appData at all nodes, and search algorithms must include them.
 * * CONSTRUCTION
 *   * The RangeTreeNode.createByIndexSplits method constructs the tree with simple right-left splits within an array of input items.
 *     * The appData is placed entirely in the leaves.
 *     * caller can specify
 *       * the number of _appData items per leaf
 *       * the number of children per node within the tree.
 *     * "deep" trees (2 children per node and one appData per leaf) may have (compared to shallow trees with many children per node and many appData per leaf)
 *       * faster search because lower nodes have smaller ranges that will be skipped by search algorithms.
 *       * larger memory use because of more nodes
 *   * For future construction methods
 *      * _appData "above the leaves" may allow nodes below to have smaller ranges, but add complexity to search.
 *
 */
export class RangeTreeNode<AppDataType> {
  private _range: Range3d;
  private _appData: FlexData<AppDataType>;
  private _children: undefined | RangeTreeNode<AppDataType> | RangeTreeNode<AppDataType>[];
  public id: number;
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
    this.id = numNodeCreated++;
    const childIds: number[] = [];
    if (Array.isArray(this._children))
      for (const c of this._children) childIds.push(c.id);
    else if (this._children instanceof RangeTreeNode)
      childIds.push(this._children.id);
    // const numAppData = getFlexDataCount(appData);
    // console.log({ id: this.id, childIds, numAppData });
  }
  /**
   * Simplest public create: capture the range, appData, and children.
   * *
   */
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
   * * Access a child by index.
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
  /**
   * @returns the (pointer to, not copy of) the array of or singleton children.
   */
  public getAllChildren(): FlexData<RangeTreeNode<AppDataType>> {
    return this._children;
  }
  /**
   * @returns the (pointer to, not copy of) the array of or singleton appData.
   */
  public getAllAppData(): FlexData<AppDataType> {
    return this._appData;
  }
  /**
   * @returns the number of children in this node of the tree.  This is NOT recursive
   */
  public getNumChildren(): number {
    return getFlexDataCount(this._children);
  }
  /**
   * @returns the number of appData items in this node of the tree.  This is NOT recursive
   */
  public getNumAppData(): number {
    return getFlexDataCount(this._appData);
  }

  public recurseIntoTree(
    /**
     * * Tell the  caller's processNode function the range and app data in a node.
     * * Caller can process the immediate application data as it wishes.
     * * Return value indicates whether this method should recurse to the various child nodes.
    */
    announceNode: (node: RangeTreeNode<AppDataType>) => boolean,
  ) {
    const doChildren = announceNode(this);
    if (doChildren) {
      if (this._children === undefined) {

      } else if (Array.isArray(this._children)) {
        for (const child of this._children)
          child.recurseIntoTree(announceNode);
      } else {
        this._children.recurseIntoTree(announceNode);
      }
    }
  }

  public searchTopDown(handler: SingleTreeSearchHandler<AppDataType>) {
    if (handler.isRangeActive(this._range)) {
      let item: AppDataType | undefined;
      for (let i = 0; undefined !== (item = this.getAppDataByIndex(i)); i++) {
        handler.processAppData(item);
        if (handler.isAborted())
          return;
      }
      let child: RangeTreeNode<AppDataType> | undefined;
      for (let i = 0; undefined !== (child = this.getChildByIndex(i)); i++) {
        child.searchTopDown(handler);
      }
    }
  }

  /** Apply the handler.processAppDataPair method to the each if the (0, 1 or array of) appData items combined with appData items in the rightStack.
   * * The trailingNodesWithAppData is managed by the caller so that if interior nodes high in the tree do not have their own appData the path search step does not go there.
   * @param leftAppData singleton or array with data "from left"
   * @param rightStack nodes to process from right path.
   * @param reverseArgs true if the caller is exchanging the sense of left and right and this should be undone int he actual call to handler.processAppDataPair.
   */
  private static processAppDataAndAppDataStack<AppDataType>(
    leftAppData: FlexData<AppDataType>,
    rightStack: RangeTreeNode<AppDataType>[],
    reverseArgs: boolean,
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    let leftItem: AppDataType | undefined;
    let rightItem: AppDataType | undefined;
    // hmm.. we ASSUME that if the tip ranges passed all parent ranges would pass without further test.
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

  /** Apply the handler.processAppDataPair method to the each if the (0, 1 or array of) appData items combined with appData items in the rightStack.
   * * The trailingNodesWithAppData is managed by the caller so that if interior nodes high in the tree do not have their own appData the path search step does not go there.
   * @param leftAppData singleton or array with data "from left"
   * @param rightAppData singleton or array with data "from right"
   * @param reverseArgs true if the caller is exchanging the sense of left and right and this should be undone int he actual call to handler.processAppDataPair.
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
   * @param tip should match the fullPath tip.
   * @param fullPath complete path, which is always popped
   * @param partialPath partial path, which is only popped if the tip has _appData.
   */
  private static popPaths<AppDataType>(
    tip: RangeTreeNode<AppDataType>,
    fullPath: RangeTreeNode<AppDataType>[],
    partialPath: RangeTreeNode<AppDataType>[],
  ) {
    fullPath.pop();
    if (tip._appData !== undefined) {
      partialPath.pop();
    }
  }
  /**
   * process nodes from left and right trees of dual search
   * @param leftTip tip node being explored on left
   * @param leftStack (stack) of prior left nodes
   * @param leftStackWithAppData (stack) of prior left nodes which have appData.
   * @param rightTip tip node being explored on right.
   * @param rightStack (stack) of prior right nodes.
   * @param leftStackHasAppData (stack) of prior right nodes which have appData.
   * @param isReversedDepth true of left and right have been reversed (and should be toggled the other way on recursion)
   * @param _handler
   * * Remark: the separate stacks for nodes that have appData is for efficiency.
   *   * If data is entirely a the leaves (or just in a few nodes), the stacks will all be empty (or very small) and not time will be wasted looking up the stacks for appData to process with the other tip.
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
    // console.log({ leftId: leftTip.id, rightId: rightTip.id });
    const leftTipHasAppData = leftTip._appData !== undefined;
    const rightTipHasAppData = rightTip._appData !== undefined;
    let leftChild: RangeTreeNode<AppDataType> | undefined;
    let rightChild: RangeTreeNode<AppDataType> | undefined;

    // process immediate appData from each tip node with the entire prior path of the other side.
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
  // Recurse below the tip of leftTip, offering each level's appData to the rightStackWithAppData.
  // (i.e. right side has reached leaf level and has no more recursion)
  private static leftRecursivePairSearch<AppDataType>(
    leftTip: RangeTreeNode<AppDataType>,
    rightTip: RangeTreeNode<AppDataType>,
    rightStackWithAppData: RangeTreeNode<AppDataType>[],
    reverseAppDataLeftRight: boolean,
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    // rightTip must have no children.
    // The (possibly deep) left children appData needs to be offered to the right path (including tip)
    // Note that there are no stack push/pop operations -- the right stack is already reaching to leaf level, so there are no range or appData nodes to add.
    let leftChild: RangeTreeNode<AppDataType> | undefined;
    for (let leftIndex = 0; undefined !== (leftChild = getByIndex<RangeTreeNode<AppDataType>>(leftIndex, leftTip._children)); leftIndex++) {
      if (handler.isRangePairActive(leftChild._range, rightTip._range)) {
        this.processAppDataAndAppData<AppDataType>(leftChild._appData, rightTip._appData, reverseAppDataLeftRight, handler);
        this.processAppDataAndAppDataStack<AppDataType>(leftChild._appData, rightStackWithAppData, reverseAppDataLeftRight, handler);
        this.leftRecursivePairSearch<AppDataType>(
          leftChild,
          rightTip, rightStackWithAppData,
          reverseAppDataLeftRight,
          handler);
      }
    }
  }

  public static searchTwoTreesTopDown<AppDataType>(
    leftRoot: RangeTreeNode<AppDataType>,
    rightRoot: RangeTreeNode<AppDataType>,
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    this.recursivePairSearch(leftRoot, [], [], rightRoot, [], [], handler);
  }
}

export class RangeTreeOps {
  public static getRecursiveNodeCount<AppDataType>(root: RangeTreeNode<AppDataType>): number {
    let count = 0;
    root.recurseIntoTree((_node: RangeTreeNode<AppDataType>): boolean => { count++; return true; });
    return count;
  }
  public static getRecursiveAppDataCount<AppDataType>(root: RangeTreeNode<AppDataType>): number {
    let count = 0;
    root.recurseIntoTree(
      (node: RangeTreeNode<AppDataType>): boolean => { count += node.getNumAppData(); return true; });
    return count;
  }
  /**
   * Create a leaf referencing appData items indexed index0<=index<index1 and with range of the same indices
   * @param ranges array of ranges.
   * @param appData array of AppDataType items
   * @param index0 first index for block of items
   * @param index1 upper limit index for block of items.
   * @returns newly created node.
   */
  private static createLeafInIndexRange<AppDataType>(
    ranges: IndexToType<Range3d>,
    appData: IndexToType<AppDataType>,
    index0: number,
    index1: number,
    appDataLength: number): RangeTreeNode<AppDataType> {
    const appDataBlock: AppDataType[] = [];
    const range = Range3d.createNull();
    index1 = Math.min(index1, appDataLength);
    // console.log({ case: "LEAF", index0, index1 });
    for (let i = index0; i < index1; i++) {
      appDataBlock.push(evaluateIndexToType(appData, i));
      range.extendRange(evaluateIndexToType(ranges, i));
    }
    return RangeTreeNode.createCapture(range, appDataBlock, undefined);
  }
  /**
   * Split the array entries appData[index0 <= i < index1] into blocks of at most maxChildPerNode * maxAppDataPerLeaf and assemble into a tree structure.
   * @param ranges range data
   *   * if given as an array (of same length as appData), each is the range of corresponding appData
   *   * if given as a function, this method may call with appData items as needed.
   * @param appData array of application data items
   * @param index0 start index of the block to access
   * @param index1 terminal index for the block (one after final)
   * @param maxChildPerNode max number of child nodes in each interior node
   * @param maxAppDataPerLeaf max number of appData items in each leaf.
   * @returns
   */
  private static createRecursiveByIndexSplits<AppDataType>(
    ranges: IndexToType<Range3d>,
    appData: IndexToType<AppDataType>,
    index0: number,
    index1: number,
    appDataLength: number,
    maxChildPerNode: number,
    maxAppDataPerLeaf: number,
  ): RangeTreeNode<AppDataType> | undefined {
    if (index1 > appDataLength)
      index1 = appDataLength;
    const maxGrandChild = maxChildPerNode * maxAppDataPerLeaf;
    // console.log({ name: "createRecursive", index0, index1, maxGrandChild });
    if (index1 <= index0 + maxGrandChild) {  // leaf node!!!
      // console.log({ case: "LEAF GROUP" });
      const range = Range3d.createNull();
      const children: RangeTreeNode<AppDataType>[] = [];
      for (let indexA = index0 + maxAppDataPerLeaf; index0 < index1; index0 = indexA, indexA = Math.min(indexA + maxAppDataPerLeaf, index1)) {
        const child = RangeTreeOps.createLeafInIndexRange(ranges, appData, index0, indexA, appDataLength);
        if (child !== undefined) {
          range.extendRange(child.getRange());
          children.push(child);
        }
      }
      if (children.length > 0)
        return RangeTreeNode.createCapture(range, undefined, children);

    } else {
      const range = Range3d.createNull();
      const children: RangeTreeNode<AppDataType>[] = [];
      const numPerGulp = Math.ceil((index1 - index0) / maxChildPerNode);

      // console.log({ case: "INTERIOR", index0, index1 });
      for (let indexA = index0 + numPerGulp; index0 < index1; index0 = indexA, indexA = Math.min(indexA + numPerGulp, index1)) {
        const child = this.createRecursiveByIndexSplits(ranges, appData, index0, indexA, appDataLength, maxChildPerNode, maxAppDataPerLeaf);
        if (child !== undefined) {
          range.extendRange(child.getRangeRef());
          children.push(child);
        }
      }
      if (children.length > 0)
        return RangeTreeNode.createCapture(range, undefined, children);
    }
    return undefined;
  }
  /**
   * Create a range tree by simple left-right split of given ranges.
   * * Leaves carry the inputs in left-to-right order.
   * * Each leaf range is labeled by its corresponding object(s) in the appData array.
   * @param ranges array or query function for ranges.
   *   * if this is an array (of same length as appData, these are the ranges.
   *   * if this is a function, the create logic is free to call it with individual appData items to get their range.
   * @param appData access to appData for leaves.
   *   * if this is an array, appData[i] is data for its leaf
   *   * if this is a function, the function is called (with index) to ask for the appData.
   * @param appDataLength number of indices to assign.
   *   * If the appData is an array, this will commonly be the array length.
   *   *If the appData is a function, this will be another limit known to the caller
   * @param numChildrenPerNode (max) number of child nodes allowed for each interior node.
   * @param numAppDataPerLeaf (max) number of appData items allowed in each leaf.
   * @returns the root of the new tree, or undefined if array lengths differ or are zero.
   */
  public static createByIndexSplits<AppDataType>(
    ranges: IndexToType<Range3d>,
    appData: IndexToType<AppDataType>,
    appDataLength: number,
    numChildrenPerNode: number = 2, numAppDataPerLeaf: number = 2): RangeTreeNode<AppDataType> | undefined {
    // console.log();
    // const numData = getFlexDataCount(appData);
    // console.log({ numData });
    if (appDataLength <= 0
      || (Array.isArray(ranges) && ranges.length !== appDataLength))
      return undefined;
    if (numChildrenPerNode < 2)
      numChildrenPerNode = 2;
    return RangeTreeOps.createRecursiveByIndexSplits<AppDataType>(ranges, appData, 0, appDataLength, appDataLength, numChildrenPerNode, numAppDataPerLeaf);
  }

}

