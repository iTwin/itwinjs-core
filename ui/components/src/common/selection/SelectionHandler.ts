/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */
import { SelectionMode, hasFlag, SelectionModeFlags } from "./SelectionModes";
import { Range2d } from "@bentley/geometry-core";

export declare type OnSelectionChanged = (shiftDown?: boolean, ctrlDown?: boolean) => void;

/**
 * Contains single item specific methods required by selection handler.
 */
export interface SingleSelectionHandler<TItem> {
  /**
   * Callback for before an item is selected.
   */
  preselect: () => void;

  /**
   * Selects the item.
   */
  select: () => void;

  /**
   * Deselects the item.
   */
  deselect: () => void;

  /**
   * Returns true if item is selected.
   */
  isSelected: () => boolean;

  /**
   * Returns the item.
   */
  item: () => TItem;
}

/**
 * Contains multi-selection methods required by selection handler.
 */
export interface MultiSelectionHandler<TItem> {
  /**
   * Shift selects between two items.
   * Returns items that were selected.
   */
  selectBetween: (item1: TItem, item2: TItem) => TItem[];

  /**
   * Updates selection.
   * @param selections Items to be added to selection.
   * @param deselections Items to be removed from selection.
   */
  updateSelection: (selections: TItem[], deselections: TItem[]) => void;

  /**
   * Deselects all items.
   */
  deselectAll: () => void;

  /**
   * Returns true if items are equal.
   */
  areEqual: (item1: TItem, item2: TItem) => boolean;
}

/**
 * Called after items were selected.
 * @param items Items that were selected.
 * @param replace Should replace current selection.
 */
export declare type OnItemsSelectedCallback<TItem> = (items: TItem[], replace: boolean) => void;

/**
 * Called after items were deselected.
 * @param items Items that were deselected.
 */
export declare type OnItemsDeselectedCallback<Item> = (items: Item[]) => void;

class BatchSelectionOperation<Item> {
  public readonly selections = new Array<Item>();
  public readonly deselections = new Array<Item>();
  public readonly shouldReplace: boolean;

  private _componentSelectionHandler: MultiSelectionHandler<Item>;

  public constructor(componentSelectionHandler: MultiSelectionHandler<Item>, shouldReplace: boolean) {
    this.shouldReplace = shouldReplace;
    this._componentSelectionHandler = componentSelectionHandler;
  }

  public select(node: Item | Item[]) {
    this.addNodes(node, this.selections, this.shouldReplace ? undefined : this.deselections);
  }

  public deselect(node: Item | Item[]) {
    this.addNodes(node, this.deselections, this.shouldReplace ? undefined : this.selections);
  }

  private addNodes(node: Item | Item[], addTo: Item[], removeFrom?: Item[]) {
    if (Array.isArray(node)) {
      for (const n of node) {
        if (removeFrom) {
          const index = removeFrom.findIndex((x) => this._componentSelectionHandler.areEqual(x, n));
          if (index > -1) {
            removeFrom.splice(index, 1);
            continue;
          }
        }
        addTo.push(n);
      }
    } else {
      this.addNodes([node], addTo, removeFrom);
    }
  }
}

/** @hidden */
export class DragAction<Item> {
  private _itemSelectionHandlers: Array<Array<SingleSelectionHandler<Item>>>;
  private _componentSelectionHandler: MultiSelectionHandler<Item>;
  private _previousRow: number;
  private _previousColumn: number;
  private _firstItemRow: number;
  private _firstItemColumn: number;
  private _firstItemSelected: boolean;

  public constructor(componentSelectionHandler: MultiSelectionHandler<Item>, itemSelectionHandlers: Array<Array<SingleSelectionHandler<Item>>>, firstItem: Item) {
    this._itemSelectionHandlers = itemSelectionHandlers;
    this._componentSelectionHandler = componentSelectionHandler;
    const itemPos = this.findItem(this._itemSelectionHandlers, firstItem);
    this._previousRow = itemPos.y;
    this._previousColumn = itemPos.x;
    this._firstItemRow = itemPos.y;
    this._firstItemColumn = itemPos.x;
    this._firstItemSelected = false;
  }

  public updateDragAction(latestItem: Item): { selections: Item[], deselections: Item[] } {
    const currentPos = this.findItem(this._itemSelectionHandlers, latestItem);
    if (currentPos.y === this._previousRow && currentPos.x === this._previousColumn || currentPos.x < 0 || currentPos.y < 0)
      return { selections: [], deselections: [] };

    const currentRange: Range2d = Range2d.createXYXY(this._firstItemColumn, this._firstItemRow, currentPos.x, currentPos.y);
    const previousRange: Range2d = Range2d.createXYXY(this._firstItemColumn, this._firstItemRow, this._previousColumn, this._previousRow);
    const wholeRange: Range2d = Range2d.createXYXY(
      currentRange.high.x > previousRange.high.x ? currentRange.high.x : previousRange.high.x,
      currentRange.high.y > previousRange.high.y ? currentRange.high.y : previousRange.high.y,
      currentRange.low.x < previousRange.low.x ? currentRange.low.x : previousRange.low.x,
      currentRange.low.y < previousRange.low.y ? currentRange.low.y : previousRange.low.y,
    );
    const selections = [];
    const deselections = [];

    // have to select first item separately since it is will always be in both previous and current ranges.
    if (!this._firstItemSelected) {
      const handler = this._itemSelectionHandlers[this._firstItemRow][this._firstItemColumn];
      if (handler.isSelected())
        deselections.push(handler.item());
      else
        selections.push(handler.item());
      this._firstItemSelected = true;
    }

    for (let r = wholeRange.low.y; r <= wholeRange.high.y; r++) {
      for (let c = wholeRange.low.x; c <= wholeRange.high.x; c++) {
        const insidePrevious = previousRange.containsXY(c, r);
        const insideCurrent = currentRange.containsXY(c, r);
        // If item is in only one of the ranges that means it's selection needs to be toggled.
        if ((insidePrevious || insideCurrent) && insideCurrent !== insidePrevious) {
          const itemHanlder = this._itemSelectionHandlers[r][c];
          if (itemHanlder.isSelected())
            deselections.push(itemHanlder.item());
          else
            selections.push(itemHanlder.item());
        }
      }
    }

    this._previousRow = currentPos.y;
    this._previousColumn = currentPos.x;
    return { selections, deselections };
  }

  private findItem(itemSelectionHandlers: Array<Array<SingleSelectionHandler<Item>>>, item: Item): { x: number, y: number } {
    if (this._previousRow !== undefined && this._previousColumn !== undefined && this._componentSelectionHandler.areEqual(itemSelectionHandlers[this._previousRow][this._previousColumn].item(), item))
      return { y: this._previousRow, x: this._previousColumn };
    for (let row = 0; row < itemSelectionHandlers.length; row++) {
      for (let column = 0; column < itemSelectionHandlers[row].length; column++) {
        if (this._componentSelectionHandler.areEqual(itemSelectionHandlers[row][column].item(), item))
          return { x: column, y: row };
      }
    }
    return { x: -1, y: -1 };
  }

}

/** @hidden */
export class SelectionHandler<Item> {

  /** Selection mode. */
  public selectionMode: SelectionMode;
  public onItemsSelectedCallback?: OnItemsSelectedCallback<Item>;
  public onItemsDeselectedCallback?: OnItemsDeselectedCallback<Item>;

  private _currentOperation?: BatchSelectionOperation<Item>;
  private _lastItem?: Item; // keeps track of last item interacted with for shift selection
  private _dragAction?: DragAction<Item>;
  private _componentSelectionHandler?: MultiSelectionHandler<Item>; // needed for drag selection

  constructor(selectionMode: SelectionMode, onItemsSelectedCallback?: OnItemsSelectedCallback<Item>, onItemsDeselectedCallback?: OnItemsDeselectedCallback<Item>) {
    this.selectionMode = selectionMode;
    this.onItemsSelectedCallback = onItemsSelectedCallback;
    this.onItemsDeselectedCallback = onItemsDeselectedCallback;
  }

  /** Creates a function that should be called when selection changes. */
  public createSelectionFunction(componentHandler: MultiSelectionHandler<Item>, itemHandler: SingleSelectionHandler<Item>): OnSelectionChanged {
    const onSelectionChange: OnSelectionChanged = (shiftDown, ctrlDown) => {
      let operationCreated = false;
      let shiftSelected = false;
      if (!this._currentOperation) {
        // will replace selection if it is limited to one or keys are enabled but ctrl is not down
        const shouldReplace = (hasFlag(this.selectionMode, SelectionModeFlags.KeysEnabled) && !ctrlDown)
          || hasFlag(this.selectionMode, SelectionModeFlags.SelectionLimitOne);
        this._currentOperation = new BatchSelectionOperation<Item>(componentHandler, shouldReplace);
        operationCreated = true;
      }

      if (hasFlag(this.selectionMode, SelectionModeFlags.KeysEnabled)) {
        if (!ctrlDown)
          componentHandler.deselectAll();
        if (shiftDown && this._lastItem !== undefined) {
          const selected = componentHandler.selectBetween(this._lastItem, itemHandler.item());
          this._currentOperation.select(selected);
          shiftSelected = true;
        }
      }

      if (!shiftSelected) {
        itemHandler.preselect();

        if (hasFlag(this.selectionMode, SelectionModeFlags.SelectionLimitOne)
          && !(hasFlag(this.selectionMode, SelectionModeFlags.ToggleEnabled) && itemHandler.isSelected())) {
          componentHandler.deselectAll();
        }

        if (itemHandler.isSelected()) {
          itemHandler.deselect();
          this._currentOperation.deselect(itemHandler.item());
        } else {
          itemHandler.select();
          this._currentOperation.select(itemHandler.item());
        }
        this._lastItem = itemHandler.item();
      }

      if (operationCreated)
        this.completeOperation();
    };
    return onSelectionChange.bind(this);
  }

  private completeOperation(): void {
    if (!this._currentOperation)
      return;

    if (0 !== this._currentOperation.selections.length) {
      if (this.onItemsSelectedCallback) {
        this.onItemsSelectedCallback(this._currentOperation.selections, this._currentOperation.shouldReplace);
        if (this._currentOperation.shouldReplace) {
          this._currentOperation = undefined;
          return;
        }
      }
    }
    if (0 !== this._currentOperation.deselections.length) {
      if (this.onItemsDeselectedCallback)
        this.onItemsDeselectedCallback(this._currentOperation.deselections);
    }
    this._currentOperation = undefined;
  }

  /**
   * Creates drag action.
   * @param componentSelectionHandler Component selection handler.
   * @param items Ordered item selection handlers separated into arrays by rows.
   * @param firstItem Item on which drag action was started.
   */
  public createDragAction(componentSelectionHandler: MultiSelectionHandler<Item>, items: Array<Array<SingleSelectionHandler<Item>>>, firstItem: Item): void {
    if (!hasFlag(this.selectionMode, SelectionModeFlags.DragEnabled))
      return;

    this._dragAction = new DragAction(componentSelectionHandler, items, firstItem);
    this._componentSelectionHandler = componentSelectionHandler;
  }

  /**
   * Updates existing drag action.
   * @param latestItem Latest item in drag action.
   */
  public updateDragAction(latestItem: Item): void {
    if (!hasFlag(this.selectionMode, SelectionModeFlags.DragEnabled))
      return;

    if (!this._dragAction || !this._componentSelectionHandler)
      return;

    this._lastItem = latestItem;
    const selectionChanges = this._dragAction.updateDragAction(latestItem);

    if (selectionChanges.deselections.length !== 0 || selectionChanges.selections.length !== 0) {
      if (!this._currentOperation)
        this._currentOperation = new BatchSelectionOperation(this._componentSelectionHandler, false);
      this._currentOperation.select(selectionChanges.selections);
      this._currentOperation.deselect(selectionChanges.deselections);
      this._componentSelectionHandler.updateSelection(selectionChanges.selections, selectionChanges.deselections);
    }
  }

  /**
   * Completes drag action.
   */
  public completeDragAction() {
    this._dragAction = undefined;
    this._componentSelectionHandler = undefined;
    this.completeOperation();
  }
}
