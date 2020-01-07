/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { Subject } from "rxjs/internal/Subject";
import { take } from "rxjs/internal/operators/take";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { Observable } from "../Observable";
import { TreeActions } from "../TreeActions";
import { TreeModelNode, VisibleTreeNodes } from "../TreeModel";
import { SelectionHandler, SingleSelectionHandler, MultiSelectionHandler } from "../../../common/selection/SelectionHandler";
import { SelectionMode } from "../../../common/selection/SelectionModes";

/** @internal */
export interface SelectionReplacementEvent {
  selectedNodeIds: IndividualSelection | RangeSelection;
}

/** @internal */
export interface SelectionModificationEvent {
  selectedNodes: IndividualSelection | RangeSelection;
  deselectedNodes: IndividualSelection;
}

/** @internal */
export interface DragSelectionStartEvent {
  selectionChanges: Observable<SelectionModificationEvent>;
}

/** @internal */
export type IndividualSelection = string[];

/** @internal */
export interface RangeSelection {
  from: string;
  to: string;
}

/** @internal */
export function isRangeSelection(selection: any): selection is RangeSelection {
  return selection && typeof (selection.from) === "string" && typeof (selection.to) === "string";
}

/** @internal */
export class TreeSelectionManager implements Pick<TreeActions, "onNodeClicked" | "onNodeMouseDown" | "onNodeMouseMove"> {
  private _selectionHandler: SelectionHandler<Selection>;
  private _dragSelectionOperation?: Subject<SelectionModificationEvent>;
  private _itemHandlers: Array<Array<SingleSelectionHandler<string>>>;

  private _getVisibleNodes: (() => VisibleTreeNodes) | undefined;

  public onSelectionChanged = new BeUiEvent<SelectionModificationEvent>();
  public onSelectionReplaced = new BeUiEvent<SelectionReplacementEvent>();
  public onDragSelection = new BeUiEvent<DragSelectionStartEvent>();

  constructor(
    selectionMode: SelectionMode,
    getVisibleNodes?: () => VisibleTreeNodes,
  ) {
    this._getVisibleNodes = getVisibleNodes;

    const onItemsSelected = (selections: Selection[], replacement: boolean) => {
      // Assumes that `selections` will only contain either a list of
      // `IndividualSelection` items or a single `RangeSelection` item.
      if (isIndividualSelection(selections[0])) {
        if (replacement) {
          this.onSelectionReplaced.emit({
            selectedNodeIds: selections as IndividualSelection,
          });
        } else {
          this.onSelectionChanged.emit({
            selectedNodes: selections as IndividualSelection,
            deselectedNodes: [],
          });
        }
      } else {
        if (replacement) {
          this.onSelectionReplaced.emit({
            selectedNodeIds: selections[0] as RangeSelection,
          });
        } else {
          this.onSelectionChanged.emit({
            selectedNodes: selections[0] as RangeSelection,
            deselectedNodes: [],
          });
        }
      }
    };

    const onItemsDeselected = (deselections: Selection[]) => {
      // Assumes that this will be always called with `IndividualSelection` items
      this.onSelectionChanged.emit({
        selectedNodes: [],
        deselectedNodes: deselections as IndividualSelection,
      });
    };

    this._selectionHandler = new SelectionHandler(selectionMode, onItemsSelected, onItemsDeselected);

    const _this = this;
    const itemHandlers = new Proxy({}, {
      get(_target, prop) {
        if (prop === "length") {
          return _this._getVisibleNodes === undefined ? 0 : _this._getVisibleNodes().getNumNodes();
        }

        const index: number = +(prop as string);
        const node = _this._getVisibleNodes !== undefined ? _this._getVisibleNodes().getAtIndex(index) : /* istanbul ignore next */ undefined;
        // TODO: Possible exception if cursor is dragged over a pending node
        return node !== undefined ? new ItemHandler(node as TreeModelNode) : /* istanbul ignore next */ undefined;
      },
    }) as Array<SingleSelectionHandler<string>>;
    this._itemHandlers = [itemHandlers];
  }

  public setVisibleNodes(visibleNodes: () => VisibleTreeNodes) {
    this._getVisibleNodes = visibleNodes;
  }

  public onNodeClicked(nodeId: string, event: React.MouseEvent) {
    const selectionFunc = this._selectionHandler.createSelectionFunction(...this.createSelectionHandlers(nodeId));
    selectionFunc(event.shiftKey, event.ctrlKey);
  }

  public onNodeMouseDown(nodeId: string) {
    this._selectionHandler.createDragAction(this.createSelectionHandlers(nodeId)[0], this._itemHandlers, nodeId);
    window.addEventListener(
      "mouseup",
      () => {
        /* istanbul ignore else */
        if (this._dragSelectionOperation) {
          this._selectionHandler.completeDragAction();
          this._dragSelectionOperation.complete();
          this._dragSelectionOperation = undefined;
        }
      },
      { once: true },
    );
    this._dragSelectionOperation = new Subject();
    this._dragSelectionOperation
      .pipe(take(1))
      .subscribe((value) => {
        this.onDragSelection.emit({ selectionChanges: this._dragSelectionOperation! });
        this._dragSelectionOperation!.next(value);
      });
  }

  public onNodeMouseMove(nodeId: string) {
    this._selectionHandler.updateDragAction(nodeId);
  }

  private createSelectionHandlers(
    nodeId: string,
  ): [MultiSelectionHandler<Selection>, SingleSelectionHandler<string>] {
    let deselectedAll = false;
    const multiSelectionHandler: MultiSelectionHandler<Selection> = {
      selectBetween: (item1, item2) => [{ from: item1 as string, to: item2 as string }],
      updateSelection: (selections, deselections) => {
        // Assumes `updateSelection` will never be called with selection ranges
        const selectedNodeIds = selections as string[];
        const deselectedNodeIds = deselections as string[];
        this._dragSelectionOperation!.next({ selectedNodes: selectedNodeIds, deselectedNodes: deselectedNodeIds });
      },
      deselectAll: () => {
        deselectedAll = true;
      },
      areEqual: (item1, item2) => item1 === item2,
    };

    const singleSelectionHandler: SingleSelectionHandler<string> = {
      preselect: () => { },
      select: () => { },
      deselect: () => { },
      isSelected: () => {
        if (deselectedAll || this._getVisibleNodes === undefined) {
          return false;
        }

        const node = this._getVisibleNodes().getModel().getNode(nodeId);
        return node !== undefined && node.isSelected;
      },
      item: () => nodeId,
    };

    return [multiSelectionHandler, singleSelectionHandler];
  }
}

type Selection = string | RangeSelection;

function isIndividualSelection(selection: Selection): selection is string {
  return typeof (selection) === "string";
}

class ItemHandler implements SingleSelectionHandler<string> {
  private _node: TreeModelNode;

  constructor(node: TreeModelNode) {
    this._node = node;
  }

  /* istanbul ignore next: noop */
  public preselect() { }

  /* istanbul ignore next: noop */
  public select() { }

  /* istanbul ignore next: noop */
  public deselect() { }

  // tslint:disable-next-line: prefer-get
  public isSelected(): boolean {
    return this._node.isSelected;
  }

  public item(): string {
    return this._node.id;
  }
}
