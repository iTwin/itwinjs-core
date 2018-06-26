/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SelectionSet */
import { Id64, Id64Arg, Id64Set } from "@bentley/bentleyjs-core";
import { IModelConnection } from "./IModelConnection";
import { BeEvent } from "@bentley/bentleyjs-core";
import { IModelApp } from "./IModelApp";

/** event types for SelectionSet.onChanged  */
export const enum SelectEventType { Add, Remove, Replace, Clear }

/** The set of hilited elements for an IModelConnection, by element id */
export class HilitedSet {
  public readonly elements = new Set<string>();
  public constructor(public iModel: IModelConnection) { }
  public setHilite(arg: Id64Arg, onOff: boolean) {
    Id64.toIdSet(arg).forEach((id) => onOff ? this.elements.add(id) : this.elements.delete(id));
    IModelApp.viewManager.onSelectionSetChanged(this.iModel);
  }
  public clearAll() {
    this.elements.clear();
    IModelApp.viewManager.onSelectionSetChanged(this.iModel);
  }
  public has(id: string) { return this.elements.has(id); }
  public isHilited(id: Id64) { return this.elements.has(id.value); }
  public get size() { return this.elements.size; }
}

/** The set of currently selected elements for an IModelConnection */
export class SelectionSet {
  public readonly elements = new Set<string>();
  /** Called whenever elements are added or removed from this SelectionSet */
  public readonly onChanged = new BeEvent<(iModel: IModelConnection, evType: SelectEventType, ids?: Id64Set) => void>();
  public constructor(public iModel: IModelConnection) { }

  private sendChangedEvent(evType: SelectEventType, ids?: Id64Set) {
    IModelApp.viewManager.onSelectionSetChanged(this.iModel);
    this.onChanged.raiseEvent(this.iModel, evType, ids);
  }

  /** Get the number of entries in this selection set. */
  public get size() { return this.elements.size; }

  /** Check whether there are any selected elements. */
  public isActive() { return this.size !== 0; }

  /** return true if elemId is in this SelectionSet */
  public has(elemId?: string) { return !!elemId && this.elements.has(elemId); }

  /** Query whether an element is in the selection set. */
  public isSelected(elemId?: Id64): boolean { return !!elemId && this.elements.has(elemId.value); }

  /** Clear current selection set. */
  public emptyAll(): void {
    if (!this.isActive())
      return;
    this.elements.clear();
    this.sendChangedEvent(SelectEventType.Clear);
  }

  /**
   * Add one or more elements to the current selection set.
   * @returns true if any elements were added.
   */
  public add(elem: Id64Arg, sendEvent = true): boolean {
    const oldSize = this.elements.size;
    elem = Id64.toIdSet(elem);
    elem.forEach((id) => this.elements.add(id));
    const changed = oldSize !== this.elements.size;
    if (sendEvent && changed)
      this.sendChangedEvent(SelectEventType.Add, elem);
    return changed;
  }

  /**
   * Remove one or more elements from the current selection set.
   * @returns true if any elements were removed.
   */
  public remove(elem: Id64Arg, sendEvent = true): boolean {
    const oldSize = this.elements.size;
    elem = Id64.toIdSet(elem);
    elem.forEach((id) => this.elements.delete(id));
    const changed = oldSize !== this.elements.size;
    if (sendEvent && changed)
      this.sendChangedEvent(SelectEventType.Remove, elem);
    return changed;
  }

  public addAndRemove(adds: Id64Arg, removes: Id64Arg): boolean {
    const added = this.add(adds);
    const removed = this.remove(removes);
    return added || removed; // don't put this on one line. Make sure we call both.
  }

  /** invert the state of a set of elements in the SelectionSet */
  public invert(elem: Id64Arg): boolean {
    const elementsToAdd = new Set<string>();
    const elementsToRemove = new Set<string>();
    Id64.toIdSet(elem).forEach((id) => { if (this.elements.has(id)) elementsToRemove.add(id); else elementsToAdd.add(id); });
    return this.addAndRemove(elementsToAdd, elementsToRemove);
  }

  /** Change selection set to be the supplied set of elements */
  public replace(elem: Id64Arg): void {
    this.elements.clear();
    this.add(elem, false);
    this.sendChangedEvent(SelectEventType.Replace, this.elements);
  }
}
