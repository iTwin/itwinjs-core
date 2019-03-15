/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { Element as MarkupElement } from "@svgdotjs/svg.js";
import { markupApp } from "./Markup";

abstract class UndoAction {
  public cmdId: number = 0;
  public abstract reverse(): void;
  public abstract reinstate(): void;
}

let markupId = 100; // serialized id for all new Markup elements

class AddAction extends UndoAction {
  private _parent: MarkupElement;
  private _index: number;
  constructor(private _elem: MarkupElement) {
    super();
    _elem.id("markup" + (markupId++));
    this._parent = _elem.parent() as MarkupElement;
    assert(this._parent !== undefined);
    this._index = _elem.position();
  }
  public reinstate() { this._parent.add(this._elem, this._index); }
  public reverse() { markupApp.markup!.selected.drop(this._elem); this._elem.remove(); }
}

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
  public reinstate() { markupApp.markup!.selected.drop(this._elem); this._elem.remove(); }
}

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
  public reverse() { this._oldParent.add(this._elem, this._oldIndex); if (this._elem.inSelection) markupApp.markup!.selected.drop(this._elem); }
}

class ModifyAction extends UndoAction {
  constructor(private _newElem: MarkupElement, private _oldElement: MarkupElement) {
    super();
    assert(_newElem !== undefined && _oldElement !== undefined);
    markupApp.markup!.selected.replace(_oldElement, _newElem);
  }
  public reinstate() { this._oldElement.replace(this._newElem); markupApp.markup!.selected.replace(this._oldElement, this._newElem); }
  public reverse() { this._newElem.replace(this._oldElement); markupApp.markup!.selected.replace(this._newElem, this._oldElement); }
}

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
  public startGroup() { this.startCommand(); ++this._grouped; }
  public endGroup() { --this._grouped; }
  public doGroup(fn: VoidFunction) { this.startGroup(); fn(); this.endGroup(); }
  public onAdded(elem: MarkupElement) { this.addAction(new AddAction(elem)); }
  public onDelete(elem: MarkupElement) { this.addAction(new DeleteAction(elem)); }
  public onRepositioned(elem: MarkupElement, oldIndex: number, oldParent: MarkupElement) { this.addAction(new RepositionAction(elem, oldIndex, oldParent)); }
  public onModified(newElem: MarkupElement, oldElem: MarkupElement) { this.addAction(new ModifyAction(newElem, oldElem)); }

  public doUndo() {
    if (this._currentPos === 0)
      return;

    const cmdId = this._stack[this._currentPos - 1].cmdId;
    while (this._currentPos > 0 && cmdId === this._stack[this._currentPos - 1].cmdId)
      this._stack[--this._currentPos].reverse();
  }
  public doRedo() {
    if (this._currentPos === this.size)
      return;

    const cmdId = this._stack[this._currentPos].cmdId;
    while (this._currentPos < this.size && cmdId === this._stack[this._currentPos].cmdId)
      this._stack[this._currentPos++].reinstate();
  }
}
