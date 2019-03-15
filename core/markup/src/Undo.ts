/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { Element as MarkupElement } from "@svgdotjs/svg.js";
import { MarkupApp } from "./Markup";

abstract class UndoAction {
  public cmdId: number = 0;
  public abstract reverse(): void;
  public abstract reinstate(): void;
}

/** created when a new element is added to the markup */
class AddAction extends UndoAction {
  private _parent: MarkupElement;
  private _index: number;
  constructor(private _elem: MarkupElement) {
    super();
    this._parent = _elem.parent() as MarkupElement;
    assert(this._parent !== undefined);
    this._index = _elem.position();
  }
  public reinstate() { this._parent.add(this._elem, this._index); }
  public reverse() { MarkupApp.markup!.selected.drop(this._elem); this._elem.remove(); }
}

/** created when an existing element is deleted from the markup */
class DeleteAction extends UndoAction {
  private _parent: MarkupElement;
  private _index: number;
  constructor(private _elem: MarkupElement) {
    super();
    this._parent = _elem.parent() as MarkupElement;
    assert(this._parent !== undefined);
    this._index = _elem.position();
  }
  public reverse() { this._parent.add(this._elem, this._index); }
  public reinstate() { MarkupApp.markup!.selected.drop(this._elem); this._elem.remove(); }
}

/** created when an existing element's position is moved in the display order. This can also include re-parenting */
class RepositionAction extends UndoAction {
  private _newParent: MarkupElement;
  private _newIndex: number;

  constructor(private _elem: MarkupElement, private _oldIndex: number, private _oldParent: MarkupElement) {
    super();
    this._newParent = _elem.parent() as MarkupElement;
    assert(this._newParent !== undefined);
    this._newIndex = _elem.position();
  }
  public reinstate() { this._newParent.add(this._elem, this._newIndex); }
  public reverse() { this._oldParent.add(this._elem, this._oldIndex); if (this._elem.inSelection) MarkupApp.markup!.selected.drop(this._elem); }
}

/** created when an existing element's properties are modified. */
class ModifyAction extends UndoAction {
  constructor(private _newElem: MarkupElement, private _oldElement: MarkupElement) {
    super();
    assert(_newElem !== undefined && _oldElement !== undefined);
    MarkupApp.markup!.selected.replace(_oldElement, _newElem);
  }
  public reinstate() { this._oldElement.replace(this._newElem); MarkupApp.markup!.selected.replace(this._oldElement, this._newElem); }
  public reverse() { this._newElem.replace(this._oldElement); MarkupApp.markup!.selected.replace(this._newElem, this._oldElement); }
}

/** Stores the sequence of operations performed on the markup. Facilitates undo/redo of the operations. */
export class UndoManager {
  private _currentCmd = 0;
  private _grouped = 0;
  private _stack: UndoAction[] = [];
  private _currentPos = 0;

  private addAction(action: UndoAction) {
    this._stack.length = this._currentPos;
    action.cmdId = this._currentCmd;
    this._stack.push(action);
    this._currentPos = this.size;
  }

  public get size() { return this._stack.length; }
  private startCommand() { if (0 === this._grouped)++this._currentCmd; }
  private startGroup() { this.startCommand(); ++this._grouped; }
  private endGroup() { --this._grouped; }

  /** Perform a series of changes to elements that should all be reversed as a single operation.
   * @param fn the function that performs the changes to the elements. It must call the onXXX methods of this class to store
   * the operations in the undo buffer.
   * @note all of the onXXX methods of this class should *only* be called from within the callback function of this method.
   */
  public doGroup(fn: VoidFunction) { this.startGroup(); fn(); this.endGroup(); }

  /** call this from within a [doGroup] function *after* an element has been added to a markup */
  public onAdded(elem: MarkupElement) { this.addAction(new AddAction(elem)); }
  /** call this from within a [doGroup] function *before* an element is about to be deleted from a markup */
  public onDelete(elem: MarkupElement) { this.addAction(new DeleteAction(elem)); }
  /** call this from within a [doGroup] function *after* an element has been moved in display order in a markup */
  public onRepositioned(elem: MarkupElement, oldIndex: number, oldParent: MarkupElement) { this.addAction(new RepositionAction(elem, oldIndex, oldParent)); }
  /** call this from within a [doGroup] function *after* an element has been modified in a markup */
  public onModified(newElem: MarkupElement, oldElem: MarkupElement) { this.addAction(new ModifyAction(newElem, oldElem)); }

  /** reverse the most recent operation, if any */
  public doUndo() {
    if (this._currentPos === 0)
      return; // no operations have been performed

    const cmdId = this._stack[this._currentPos - 1].cmdId;
    while (this._currentPos > 0 && cmdId === this._stack[this._currentPos - 1].cmdId)
      this._stack[--this._currentPos].reverse();
  }
  /** reinstate the most recently reversed operation, if any */
  public doRedo() {
    if (this._currentPos === this.size)
      return; // no operations have been reversed.

    const cmdId = this._stack[this._currentPos].cmdId;
    while (this._currentPos < this.size && cmdId === this._stack[this._currentPos].cmdId)
      this._stack[this._currentPos++].reinstate();
  }
}
