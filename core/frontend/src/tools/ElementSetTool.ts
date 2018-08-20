/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Id64, Id64Arg } from "@bentley/bentleyjs-core";
import { ModifyElementSource } from "./PrimitiveTool";
import { IModelConnection } from "../IModelConnection";

/** The requested source for the elements to modify. */
export const enum ElemSource {
  /** Populate ElementAgenda from a locate */
  Pick,
  /**  Populate ElementAgenda from active fence */
  Fence,
  /**  Populate ElementAgenda from active selection set */
  SelectionSet,
}

/** The method that will be used to update the tool's ElementAgenda. */
export const enum ElemMethod {
  /** Entries will be added to ElementAgenda */
  Add,
  /** Entries currently in the ElementAgenda are removed, entries not currently in the ElementAgenda are added. */
  Invert,
}

/** Should the active fence be used, required, or ignored as a possible ElemSource. */
export const enum UsesFence {
  /** Active Fence is allowed as ElemSource */
  Check,
  /** Active Fence is required as ElemSource */
  Required,
  /** Active Fence is not supported as ElemSource */
  None,
}

/** Should the active selection set be used, required, or ignored as a possible ElemSource. */
export const enum UsesSelection {
  /** Active Selection Set is allowed as ElemSource */
  Check,
  /** Active Selection Set is required as ElemSource */
  Required,
  /** Active Selection Set is not supported as ElemSource */
  None,
}

/** Should ElemSource::Pick allow a drag select to identify elements. */
export const enum UsesDragSelect {
  /** Drag selection using shape inside/overlap */
  Box,
  /** Drag selection using crossing line */
  Line,
  /** Tool does not support drag selection for ElemSource.Pick */
  None,
}

/** Helps determine the action ModifyAgenda will take on the agenda elements after calling doFenceClip. */
export const enum ClipResult {
  /** Tool does not support fence clip */
  NotSupported,
  /** Valid entries in ElementAgenda are new elements, no elemRef but correct modelRef. */
  NewElements,
  /** Valid entries in ElementAgenda reference original elemRef and modelRef. */
  OriginalElements,
}

/** ElemSource specific failures. */
export const enum ErrorNums {
  /** No fence is currently active */
  NoFence,
  /** No acceptable element(s) inside fence */
  NoFenceElems,
  /** No acceptable element(s) outside fence */
  NoFenceElemsOutside,
  /** No acceptable element(s) in selection set */
  NoSSElems,
  /** Located element rejected by tool filters */
  NotSupportedElmType,
}

export const enum HilitedState {
  /**  this agenda is in an indeterminate state wrt hilite */
  Unknown = 0,
  /**  all of the entries in this agenda were hilited by a call to ElementAgenda.hilite */
  Yes = 1,
  /**  all of the entries in this agenda were un-hilited by a call to ElementAgenda.clearHilite */
  No = 2,
}

export interface GroupMark {
  start: number;
  source: ModifyElementSource;
}

export class ElementAgenda {
  public readonly elements: string[] = [];
  public readonly groupMarks: GroupMark[] = [];
  /** Whether elements are flagged as hilited when added to the agenda. */
  public hiliteOnAdd = true;
  public hilitedState = HilitedState.Unknown;
  public constructor(public iModel: IModelConnection) { }

  /**
   * Get the source for this ElementAgenda, if applicable. The "source" is merely an indication of what the collection of elements
   * in this agenda means. When the source is ModifyElementSource.SelectionSet, the attempt will be made to keep the Selection
   * Set current with changes to the agenda.
   */
  public getSource() { return this.groupMarks.length === 0 ? ModifyElementSource.Unknown : this.groupMarks[this.groupMarks.length - 1].source; }

  /** Set the source for this ElementAgenda. */
  public setSource(val: ModifyElementSource) { if (this.groupMarks.length > 0) this.groupMarks[this.groupMarks.length - 1].source = val; }

  public get isEmpty() { return this.length === 0; }
  public get count() { return this.length; }
  public get length() { return this.elements.length; }

  /** Calls ClearHilite and empties this ElementAgenda. */
  public clear() { this.clearHilite(); this.elements.length = 0; this.groupMarks.length = 0; }

  /** clear hilite on any currently hilited entries */
  private clearHilite() {
    if (HilitedState.No === this.hilitedState)
      return;

    this.setEntriesHiliteState(false); // make sure all entries have their hilite flag off
    this.hilitedState = HilitedState.No;
  }

  private setEntriesHiliteState(onOff: boolean, groupStart = 0, groupEnd = 0) {
    const group = (0 === groupEnd) ? this.elements : this.elements.filter((_id, index) => index >= groupStart && index < groupEnd);
    this.iModel.hilited.setHilite(group, onOff);
  }

  /** Calls ClearHilite and removes the last group of elements added to this ElementAgenda. */
  public popGroup() {
    if (this.groupMarks.length <= 1) {
      this.clear();
      return;
    }
    const group = this.groupMarks.pop()!;
    if (HilitedState.No !== this.hilitedState)
      this.setEntriesHiliteState(false, group.start, this.length); // make sure removed entries aren't left hilited...
    this.elements.splice(group.start);
  }

  /** Mark all entries in this agenda as being hilited. */
  public hilite() {
    if (HilitedState.Yes === this.hilitedState)
      return;

    this.setEntriesHiliteState(this.hiliteOnAdd); // make sure all entries have their hilite flag on.
    this.hilitedState = HilitedState.Yes;
  }

  public has(id: string) { return this.elements.some((entry) => id === entry); }

  /** Return true if elementId is already in this ElementAgenda. */
  public find(id: Id64) { return this.has(id.value); }

  /** Add elements to this ElementAgenda. */
  public add(arg: Id64Arg) {
    const groupStart = this.length;
    Id64.toIdSet(arg).forEach((id) => { if (!this.has(id)) this.elements.push(id); });
    if (groupStart === this.length)
      return false;
    this.groupMarks.push({ start: groupStart, source: ModifyElementSource.Unknown });
    if (HilitedState.No !== this.hilitedState)
      this.setEntriesHiliteState(this.hiliteOnAdd, groupStart, this.length);
    return true;
  }

  private removeOne(id: string) {
    let pos = -1;
    const elements = this.elements;
    const groupMarks = this.groupMarks;

    elements.some((entry, index) => { if (id !== entry) return false; pos = index; return true; });
    if (pos === -1)
      return false;

    if (1 === elements.length || (1 === groupMarks.length && ModifyElementSource.DragSelect !== groupMarks[groupMarks.length - 1].source)) {
      this.clear();
      return true;
    }

    const groupIndex = pos;
    let groupStart = 0, groupEnd = 0;
    let markToErase = 0;
    let removeSingleEntry = false;

    for (let iMark = 0; iMark < groupMarks.length; ++iMark) {
      if (0 === groupEnd) {
        if (iMark + 1 === groupMarks.length) {
          markToErase = iMark;
          removeSingleEntry = (ModifyElementSource.DragSelect === groupMarks[iMark].source);
          groupStart = groupMarks[iMark].start;
          groupEnd = elements.length;
        } else if (groupMarks[iMark].start <= groupIndex && groupMarks[iMark + 1].start > groupIndex) {
          markToErase = iMark;
          removeSingleEntry = (ModifyElementSource.DragSelect === groupMarks[iMark].source);
          groupStart = groupMarks[iMark].start;
          groupEnd = groupMarks[iMark + 1].start;
        }

        continue;
      }

      if (removeSingleEntry)
        groupMarks[iMark].start -= 1; // Only removing single entry, not entire group...
      else
        groupMarks[iMark].start -= (groupEnd - groupStart); // Adjust indices...
    }

    if (removeSingleEntry) { // Only remove single entry...
      if (HilitedState.No !== this.hilitedState)
        this.setEntriesHiliteState(false, groupIndex, groupIndex + 1); // make sure removed entry isn't left hilited...

      elements.splice(groupIndex, 1);

      if (groupEnd === groupStart + 1)
        groupMarks.splice(markToErase, 1);

      return true;
    }

    if (HilitedState.No !== this.hilitedState)
      this.setEntriesHiliteState(false, groupStart, groupEnd); // make sure removed entries aren't left hilited...

    elements.splice(groupStart, groupEnd - groupStart);
    groupMarks.splice(markToErase, 1);
    return true;
  }

  public remove(arg: Id64Arg) {
    if (0 === this.length)
      return false;

    const elSet = Id64.toIdSet(arg);
    if (elSet.size === 0)
      return false;

    const needClearHilite = (HilitedState.No !== this.hilitedState);

    if (needClearHilite)
      this.clearHilite(); // Avoid making multiple draws to unhilite entries as they are removed...

    elSet.forEach((elId) => this.removeOne(elId)); // NOTE: Removes group associated with this element, not just a single entry...

    if (needClearHilite)
      this.hilite();

    return true;
  }

  /** Add elements not currently in the ElementAgenda and remove elements currently in the ElementAgenda. */
  public invert(arg: Id64Arg) {
    if (0 === this.length)
      return this.add(arg);

    const elSet = Id64.toIdSet(arg);
    if (elSet.size === 0)
      return false;

    const adds: string[] = [];
    const removes: string[] = [];
    elSet.forEach((id) => { if (this.has(id)) removes.push(id); else adds.push(id); });
    if (adds.length === 0 && removes.length === 0)
      return false;

    const needClearHilite = (HilitedState.No !== this.hilitedState);

    if (needClearHilite)
      this.clearHilite(); // Avoid making multiple draws to unhilite/hilite entries as they are removed/added...

    removes.forEach((id) => this.removeOne(id));

    if (adds.length > 0) {
      const groupStart = this.length;
      adds.forEach((id) => this.elements.push(id));
      this.groupMarks.push({ start: groupStart, source: ModifyElementSource.Unknown });

      if (HilitedState.No !== this.hilitedState)
        this.setEntriesHiliteState(this.hiliteOnAdd, groupStart, this.length); // make sure added entries are hilited (when not also removing)...
    }

    if (needClearHilite)
      this.hilite();

    return true;
  }
}
