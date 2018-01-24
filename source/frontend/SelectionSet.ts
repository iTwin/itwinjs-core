/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Id64Set } from "@bentley/bentleyjs-core/lib/Id";
import { IModelConnection } from "./IModelConnection";
import { BeEvent } from "@bentley/bentleyjs-core/lib/BeEvent";
import { iModelApp } from "./IModelApp";

export const enum EventType { Add, Remove, Replace, Clear }
export type IdArg = Id64 | Id64Set | string[];

export class HilitedSet {
  public readonly hilited = new Set<string>();
  public constructor(public iModel: IModelConnection) { }
  public setHilite(arg: IdArg, onOff: boolean) {
    Id64.toIdSet(arg).forEach((id) => onOff ? this.hilited.add(id) : this.hilited.delete(id));
    iModelApp.viewManager.onSelectionSetChanged(this.iModel);
  }
  public clearAll() {
    this.hilited.clear();
    iModelApp.viewManager.onSelectionSetChanged(this.iModel);
  }
  public isHilited(id: Id64) { return this.hilited.has(id.value); }
}

/** the set of currently selected elements for an iModel */
export class SelectionSet {
  public readonly selected = new Set<string>();
  public readonly onChanged = new BeEvent<(iModel: IModelConnection, evType: EventType, ids?: Set<string> | undefined) => void>();
  public constructor(public iModel: IModelConnection) { }

  private sendChangedEvent(evType: EventType, ids?: Set<string>) { this.onChanged.raiseEvent(this.iModel, evType, ids); }
  /**
   * Get the number of entries in the current selection set.
   * @return count of entries in current selection set.
   */
  public get numSelected() { return this.selected.size; }

  /** Check whether there are any selected elements. */
  public isActive() { return this.numSelected === 0; }

  /** Query whether an element is in the selection set. */
  public isSelected(elemId: Id64): boolean { return this.selected.has(elemId.value); }

  /** Clear current selection set. */
  public emptyAll(): void {
    if (!this.isActive())
      return;
    this.selected.clear();
    this.sendChangedEvent(EventType.Clear);
  }

  /**
   * Add an element or set of elements to the current selection set.
   * @returns true if any elements were added.
   */
  public add(elem: IdArg, sendEvent = true): boolean {
    const oldSize = this.selected.size;
    elem = Id64.toIdSet(elem);
    elem.forEach((id) => this.selected.add(id));
    const changed = oldSize !== this.selected.size;
    if (sendEvent && changed)
      this.sendChangedEvent(0 /* Add */, elem);
    return changed;
  }

  /**
   * Remove an element or set of elements from the current selection set.
   * @returns true if any elements were removed.
   */
  public remove(elem: IdArg, sendEvent = true): boolean {
    const oldSize = this.selected.size;
    elem = Id64.toIdSet(elem);
    elem.forEach((id) => this.selected.delete(id));
    const changed = oldSize !== this.selected.size;
    if (sendEvent && changed)
      this.sendChangedEvent(EventType.Remove, elem);
    return changed;
  }

  public addAndRemove(adds: IdArg, removes: IdArg): boolean {
    const added = this.add(adds);
    const removed = this.remove(removes);
    return added || removed; // don't put this on one line. Make sure we call both.
  }

  /** invert the state of a set of elements in the SelectionSet */
  public invert(elem: IdArg): boolean {
    const elementsToAdd = new Set<string>();
    const elementsToRemove = new Set<string>();
    Id64.toIdSet(elem).forEach((id) => { if (this.selected.has(id)) elementsToRemove.add(id); else elementsToAdd.add(id); });
    return this.addAndRemove(elementsToAdd, elementsToRemove);
  }

  /** Change selection set to be the supplied element or set of elements */
  public replace(elem: IdArg): void {
    this.selected.clear();
    this.add(elem, false);
    this.sendChangedEvent(EventType.Replace, this.selected);
  }
}
