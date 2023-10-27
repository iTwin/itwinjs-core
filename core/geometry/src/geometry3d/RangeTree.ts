/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d } from "./Range";

/** @packageDocumentation
 * @module CartesianGeometry
 */

type FlexData<T> = undefined | T[] | T;

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
  /** return true if appData within the ranges should be offered to processAppDataPair */
  public abstract isRangePairActive(leftRange: Range3d, rightRange: Range3d): boolean;
  public abstract processAppDataPair(leftItem: FlexData<AppDataType>, rightItem: AppDataType): void;
  /** query to see if the active search has been aborted.  Default returns false so
   * * Default implementation returns false so query runs to completion.
   */
  // eslint-disable-next-line @itwin/prefer-get
  public isAborted(): boolean { return false; }
}

/**
 * An entry in a range heap.
 * Data members are:
 * * range = the union of ranges below in the heap
 * * _children = undefined, singleton AppDataType, or array of AppDataType
 */
export class RangeNode<AppDataType> {
  private _range: Range3d;
  private _appData: FlexData<AppDataType>;
  private _children: undefined | RangeNode<AppDataType> | RangeNode<AppDataType>[];
  /**
   * CAPTURE
   * * range = range for search algorithms
   * * appData = application data relevant to this node.
   * * children = child node reference(s).
   */
  constructor(range: Range3d, appData: FlexData<AppDataType>, children: FlexData<RangeNode<AppDataType>>) {
    this._range = range;
    this._appData = appData;
    this._children = children;
  }
  /**
   * Simplest create: capture the range, appData, and children.
   */
  public static createCapture<AppDataType>(
    range: Range3d,
    appData: FlexData<AppDataType>,
    children: FlexData<RangeNode<AppDataType>>): RangeNode<AppDataType> {
    return new RangeNode<AppDataType>(range, appData, children);
  }
  /** copy from given data into the range in this RangeEntry */
  public setRange(data: Range3d) {
    this._range.setFrom(data);
  }
  /** get (a copy of) the range in this RangeEntry */
  public getRange(data?: Range3d): Range3d {
    return this._range.clone(data);
  }
  public getChildByIndex(index: number): RangeNode<AppDataType> | undefined {
    return getByIndex<RangeNode<AppDataType>>(index, this._children);
  }
  public getAppDataByIndex(index: number): AppDataType | undefined {
    return getByIndex<AppDataType>(index, this._appData);
  }
  public getAllChildren(): FlexData<RangeNode<AppDataType>> {
    return this._children;
  }
  public getAllAppData(): FlexData<AppDataType> {
    return this._appData;
  }
  public recurseIntoTree(
    /**
     * * Tell the  caller's processNode function the range and app data in a node.
     * * Caller can process the immediate application data as it wishes.
     * * Return value indicates whether this method should recurse to the various child nodes.
    */
    announceNode: (range: Range3d, appData: FlexData<AppDataType>) => boolean,
  ) {
    const doChildren = announceNode(this._range, this._appData);
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
      let child: RangeNode<AppDataType> | undefined;
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
    rightStack: RangeNode<AppDataType>[],
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
    tip: RangeNode<AppDataType>,
    fullPath: RangeNode<AppDataType>[],
    partialPath: RangeNode<AppDataType>[],
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
    tip: RangeNode<AppDataType>,
    fullPath: RangeNode<AppDataType>[],
    partialPath: RangeNode<AppDataType>[],
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
    leftTip: RangeNode<AppDataType>,
    leftStack: RangeNode<AppDataType>[],
    leftStackWithAppData: RangeNode<AppDataType>[],
    rightTip: RangeNode<AppDataType>,
    rightStack: RangeNode<AppDataType>[],
    rightStackWithAppData: RangeNode<AppDataType>[],
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    const leftTipHasAppData = leftTip._appData !== undefined;
    const rightTipHasAppData = rightTip._appData !== undefined;
    let leftChild: RangeNode<AppDataType> | undefined;
    let rightChild: RangeNode<AppDataType> | undefined;

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
        for (let leftIndex = 0; undefined !== (leftChild = getByIndex<RangeNode<AppDataType>>(leftIndex, leftTip._children)); leftIndex++) {
          for (let rightIndex = 0; undefined !== (rightChild = getByIndex<RangeNode<AppDataType>>(rightIndex, rightTip._children)); rightIndex++) {
            this.recursivePairSearch(
              leftChild, leftStack, leftStackWithAppData,
              rightChild, rightStack, rightStackWithAppData,
              handler);
          }
        }
        this.popPaths<AppDataType>(leftTip, leftStack, leftStackWithAppData);
        this.popPaths<AppDataType>(rightTip, rightStack, rightStackWithAppData);
      } else if (leftTip._children !== undefined) {
        this.leftRecursivePairSearch<AppDataType>(leftTip, rightStackWithAppData, false, handler);
      } else if (rightTip._children !== undefined) {
        this.leftRecursivePairSearch<AppDataType>(rightTip, leftStackWithAppData, true, handler);
      }

    }

  }
  // Recurse below the tip of leftTip, offering each level's appData to the rightStackWithAppData.
  // (i.e. right side has reached leaf level and has no more recursion)
  private static leftRecursivePairSearch<AppDataType>(
    leftTip: RangeNode<AppDataType>,
    rightStackWithAppData: RangeNode<AppDataType>[],
    reverseAppDataLeftRight: boolean,
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    // rightTip must have no children.
    // The (possibly deep) left children appData needs to be offered to the right path (including tip)
    // Note that there are no stack push/pop operations -- the right stack is already reaching to leaf level, so there are no range or appData nodes to add.
    let leftChild: RangeNode<AppDataType> | undefined;
    for (let leftIndex = 0; undefined !== (leftChild = getByIndex<RangeNode<AppDataType>>(leftIndex, leftTip._children)); leftIndex++) {
      this.processAppDataAndAppDataStack<AppDataType>(leftChild._appData, rightStackWithAppData, reverseAppDataLeftRight, handler);
      this.leftRecursivePairSearch<AppDataType>(
        leftChild, rightStackWithAppData,
        reverseAppDataLeftRight,
        handler);
    }
  }

  public static searchTwoTreesTopDown<AppDataType>(
    leftRoot: RangeNode<AppDataType>,
    rightRoot: RangeNode<AppDataType>,
    handler: TwoTreeSearchHandler<AppDataType>,
  ) {
    this.recursivePairSearch(leftRoot, [], [], rightRoot, [], [], handler);
  }
  /**
   * Create a leaf referencing appData items indexed index0<=index<index1 and with range of the same indices
   * @param ranges array of ranges.
   * @param appData array of AppDataType items
   * @param index0 first index for block of items
   * @param index1 upper limit index for block of items.
   * @returns newly created node.
   */
  private static createLeafInIndexRange<AppDataType>(ranges: Range3d[], appData: AppDataType[], index0: number, index1: number): RangeNode<AppDataType> {
    const appDataBlock: AppDataType[] = [];
    const range = Range3d.createNull();
    for (let i = index0; i < index1; i++) {
      appDataBlock.push(appData[i]);
      range.extendRange(ranges[i]);
    }
    return RangeNode.createCapture(range, appDataBlock, undefined);
  }

  private static createRecursiveByIndexSplits<AppDataType>(ranges: Range3d[], appData: AppDataType[], index0: number, index1: number,
    maxChildPerNode: number,
    maxAppDataPerLeaf: number): RangeNode<AppDataType> | undefined {
    if (index1 > ranges.length)
      index1 = ranges.length;
    if (index1 <= index0 + maxAppDataPerLeaf) {  // leaf node!!!
      return RangeNode.createLeafInIndexRange(ranges, appData, index0, index1);
    } else {
      const num01 = index1 - index0;
      const step = Math.ceil(num01 / maxChildPerNode);
      const range = Range3d.createNull();
      const children: RangeNode<AppDataType>[] = [];
      for (let indexA = index0; indexA < index1; indexA += step) {
        const child = this.createRecursiveByIndexSplits(ranges, appData, indexA, indexA + step, maxChildPerNode, maxAppDataPerLeaf);
        if (child !== undefined) {
          range.extendRange(child._range);
          children.push(child);
        }
      }
      if (children.length > 0)
        return RangeNode.createCapture(range, undefined, children);
    }
    return undefined;
  }
  /**
   * Create a range heap by simple left-right split of given ranges.
   * * Each leaf range is labeled by its corresponding object in the appData array.
   * * Returns undefined if array lengths differ or are zero.
   * @param ranges
   */
  public static createByIndexSplits<AppDataType>(ranges: Range3d[], appData: AppDataType[], numChildrenPerNode: number = 2, numAppDataPerLeaf: number = 2): RangeNode<AppDataType> | undefined {
    if (ranges.length === 0 || ranges.length !== appData.length)
      return undefined;
    if (numChildrenPerNode < 2)
      numChildrenPerNode = 2;
    return RangeNode.createRecursiveByIndexSplits<AppDataType>(ranges, appData, 0, ranges.length, numChildrenPerNode, numAppDataPerLeaf);
  }
}
