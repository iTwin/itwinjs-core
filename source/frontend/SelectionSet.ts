/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Id64Set } from "@bentley/bentleyjs-core/lib/Id";
import { IModelConnection } from "./IModelConnection";
import { BeEvent } from "@bentley/bentleyjs-core/lib/BeEvent";
import { iModelApp } from "./IModelApp";

export const enum SelectEventType { Add, Remove, Replace, Clear }
export type IdArg = Id64 | Id64Set | string[];

export class HilitedSet {
  public readonly elements = new Set<string>();
  public constructor(public iModel: IModelConnection) { }
  public setHilite(arg: IdArg, onOff: boolean) {
    Id64.toIdSet(arg).forEach((id) => onOff ? this.elements.add(id) : this.elements.delete(id));
    iModelApp.viewManager.onSelectionSetChanged(this.iModel);
  }
  public clearAll() {
    this.elements.clear();
    iModelApp.viewManager.onSelectionSetChanged(this.iModel);
  }
  public has(id: string) { return this.elements.has(id); }
  public isHilited(id: Id64) { return this.elements.has(id.value); }
  public get size() { return this.elements.size; }
}

/** the set of currently selected elements for an iModel */
export class SelectionSet {
  public readonly elements = new Set<string>();
  public readonly onChanged = new BeEvent<(iModel: IModelConnection, evType: SelectEventType, ids?: Set<string>) => void>();
  public constructor(public iModel: IModelConnection) { }

  private sendChangedEvent(evType: SelectEventType, ids?: Set<string>) { this.onChanged.raiseEvent(this.iModel, evType, ids); }

  /** Get the number of entries in this selection set. */
  public get size() { return this.elements.size; }

  /** Check whether there are any selected elements. */
  public isActive() { return this.size !== 0; }

  /** return true if elemId is in this SelectionSet */
  public has(elemId: string) { return this.elements.has(elemId); }

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
   * Add an element or set of elements to the current selection set.
   * @returns true if any elements were added.
   */
  public add(elem: IdArg, sendEvent = true): boolean {
    const oldSize = this.elements.size;
    elem = Id64.toIdSet(elem);
    elem.forEach((id) => this.elements.add(id));
    const changed = oldSize !== this.elements.size;
    if (sendEvent && changed)
      this.sendChangedEvent(SelectEventType.Add, elem);
    return changed;
  }

  /**
   * Remove an element or set of elements from the current selection set.
   * @returns true if any elements were removed.
   */
  public remove(elem: IdArg, sendEvent = true): boolean {
    const oldSize = this.elements.size;
    elem = Id64.toIdSet(elem);
    elem.forEach((id) => this.elements.delete(id));
    const changed = oldSize !== this.elements.size;
    if (sendEvent && changed)
      this.sendChangedEvent(SelectEventType.Remove, elem);
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
    Id64.toIdSet(elem).forEach((id) => { if (this.elements.has(id)) elementsToRemove.add(id); else elementsToAdd.add(id); });
    return this.addAndRemove(elementsToAdd, elementsToRemove);
  }

  /** Change selection set to be the supplied element or set of elements */
  public replace(elem: IdArg): void {
    this.elements.clear();
    this.add(elem, false);
    this.sendChangedEvent(SelectEventType.Replace, this.elements);
  }
}
