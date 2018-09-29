/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SelectionSet */
import { Id64, Id64Arg, Id64Set } from "@bentley/bentleyjs-core";
import { IModelConnection } from "./IModelConnection";
import { BeEvent } from "@bentley/bentleyjs-core";
import { IModelApp } from "./IModelApp";

/** event types for SelectionSet.onChanged  */
export const enum SelectEventType { Add, Remove, Replace, Clear }

/** A set of *hilited* elements for an IModelConnection, by element id. */
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

/** A set of *currently selected* elements for an IModelConnection. */
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
  public get isActive() { return this.size !== 0; }

  /** Return true if elemId is in this SelectionSet.
   * @see [[isSelected]]
   */
  public has(elemId?: string) { return !!elemId && this.elements.has(elemId); }

  /** Query whether an Ids is in the selection set.
   * @see [[has]]
   */
  public isSelected(elemId?: Id64): boolean { return !!elemId && this.elements.has(elemId.value); }

  /** Clear current selection set.
   * @note raises the [[onChanged]] event with [[SelectEventType.Clear]].
   */
  public emptyAll(): void {
    if (!this.isActive)
      return;
    this.elements.clear();
    this.sendChangedEvent(SelectEventType.Clear);
  }

  /**
   * Add one or more Ids to the current selection set.
   * @param elem The set of Ids to add.
   * @param sendEvent If true, raise the [[onChanged]] event with [[SelectEventType.Add]]. Default is true.
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
   * Remove one or more Ids from the current selection set.
   * @param elem The set of Ids to remove.
   * @param sendEvent If true, raise the [[onChanged]] event with [[SelectEventType.Remove]]. Default is true.
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

  /**
   * Add one set of Ids, and remove another set of Ids. Any Ids that are in both sets are removed.
   * @returns True if any Ids were either added or removed.
   */
  public addAndRemove(adds: Id64Arg, removes: Id64Arg): boolean {
    const added = this.add(adds);
    const removed = this.remove(removes);
    return added || removed; // don't put this on one line. Make sure we call both.
  }

  /** Invert the state of a set of Ids in the SelectionSet */
  public invert(elem: Id64Arg): boolean {
    const elementsToAdd = new Set<string>();
    const elementsToRemove = new Set<string>();
    Id64.toIdSet(elem).forEach((id) => { if (this.elements.has(id)) elementsToRemove.add(id); else elementsToAdd.add(id); });
    return this.addAndRemove(elementsToAdd, elementsToRemove);
  }

  /** Change selection set to be the supplied set of Ids. */
  public replace(elem: Id64Arg): void {
    this.elements.clear();
    this.add(elem, false);
    this.sendChangedEvent(SelectEventType.Replace, this.elements);
  }
}
