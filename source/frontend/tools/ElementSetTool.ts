/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Id64Set } from "@bentley/bentleyjs-core/lib/Id";
import { ModifyElementSource } from "./PrimitiveTool";
import { IModelConnection } from "../IModelConnection";

export type IdArg = Id64 | Id64Set | string[];

// tslint:disable:variable-name

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
  public readonly m_elements: string[] = [];
  public readonly m_groupMarks: GroupMark[] = [];
  /** whether elements are flagged as hilited when added to the agenda. */
  public m_hiliteOnAdd = true;
  public m_hilitedState = HilitedState.Unknown;
  public constructor(public iModel: IModelConnection) { }

  /** Populate an IdSet from this agenda. */
  public getElementIdSet(ids: Id64Set) { this.m_elements.forEach((id) => ids.add(id)); }

  /**
   * Get the source for this ElementAgenda, if applicable. The "source" is merely an indication of what the collection of elements
   * in this agenda means. When the source is ModifyElementSource.SelectionSet, the attempt will be made to keep the Selection
   * Set current with changes to the agenda.
   */
  public getSource() { return this.m_groupMarks.length === 0 ? ModifyElementSource.Unknown : this.m_groupMarks[this.m_groupMarks.length - 1].source; }

  /** Set the source for this ElementAgenda. */
  public setSource(val: ModifyElementSource) { if (this.m_groupMarks.length > 0) this.m_groupMarks[this.m_groupMarks.length - 1].source = val; }

  public isEmpty() { return this.m_elements.length > 0; }
  public getCount() { return this.m_elements.length; }

  /** Calls ClearHilite and empties this ElementAgenda. */
  public clear() { this.clearHilite(); this.m_elements.length = 0; this.m_groupMarks.length = 0; }

  /** clear hilite on any currently hilited entries */
  private clearHilite() {
    if (HilitedState.No === this.m_hilitedState)
      return;

    this.setEntriesHiliteState(false); // make sure all entries have their hilite flag off
    this.m_hilitedState = HilitedState.No;
  }

  private setEntriesHiliteState(onOff: boolean, groupStart = 0, groupEnd = 0) {
    const group = (0 === groupEnd) ? this.m_elements : this.m_elements.filter((_id, index) => index >= groupStart && index < groupEnd);
    this.iModel.hilited.setHilite(group, onOff);
  }

  /** Calls ClearHilite and removes the last group of elements added to this ElementAgenda. */
  public popGroup() {
    if (this.m_groupMarks.length <= 1) {
      this.clear();
      return;
    }
    const group = this.m_groupMarks.pop()!;
    if (HilitedState.No !== this.m_hilitedState)
      this.setEntriesHiliteState(false, group.start, this.m_elements.length); // make sure removed entries aren't left hilited...
    this.m_elements.splice(group.start);
  }

  /** Mark all entries in this agenda as being hilited. */
  public hilite() {
    if (HilitedState.Yes === this.m_hilitedState)
      return;

    this.setEntriesHiliteState(this.m_hiliteOnAdd); // make sure all entries have their hilite flag on.
    this.m_hilitedState = HilitedState.Yes;
  }

  public hasValue(id: string) { return this.m_elements.some((entry) => id === entry); }

  /** Return true if elementId is already in this ElementAgenda. */
  public find(id: Id64) { return this.hasValue(id.value); }

  /** Add elements to this ElementAgenda. */
  public add(arg: IdArg) {
    const groupStart = this.m_elements.length;
    Id64.toIdSet(arg).forEach((id) => { if (!this.hasValue(id)) this.m_elements.push(id); });
    if (groupStart === this.m_elements.length)
      return false;
    this.m_groupMarks.push({ start: groupStart, source: ModifyElementSource.Unknown });
    if (HilitedState.No !== this.m_hilitedState)
      this.setEntriesHiliteState(this.m_hiliteOnAdd, groupStart, this.m_elements.length);
    return true;
  }

  public removeOne(id: string) {
    let pos = -1;
    const elements = this.m_elements;
    const groupMarks = this.m_groupMarks;

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
      if (HilitedState.No !== this.m_hilitedState)
        this.setEntriesHiliteState(false, groupIndex, groupIndex + 1); // make sure removed entry isn't left hilited...

      elements.splice(groupIndex, 1);

      if (groupEnd === groupStart + 1)
        groupMarks.splice(markToErase, 1);

      return true;
    }

    if (HilitedState.No !== this.m_hilitedState)
      this.setEntriesHiliteState(false, groupStart, groupEnd); // make sure removed entries aren't left hilited...

    elements.splice(groupStart, groupEnd - groupStart);
    groupMarks.splice(markToErase, 1);
    return true;
  }

  public remove(arg: IdArg) {
    if (0 === this.m_elements.length)
      return false;

    const elSet = Id64.toIdSet(arg);
    if (elSet.size === 0)
      return false;

    const needClearHilite = (HilitedState.No !== this.m_hilitedState);

    if (needClearHilite)
      this.clearHilite(); // Avoid making multiple draws to unhilite entries as they are removed...

    elSet.forEach((elId) => this.removeOne(elId)); // NOTE: Removes group associated with this element, not just a single entry...

    if (needClearHilite)
      this.hilite();

    return true;
  }

  /** Add elements not currently in the ElementAgenda and remove elements currently in the ElementAgenda. */
  public invert(arg: IdArg) {
    if (0 === this.m_elements.length)
      return this.add(arg);

    const elSet = Id64.toIdSet(arg);
    if (elSet.size === 0)
      return false;

    const adds: string[] = [];
    const removes: string[] = [];
    elSet.forEach((id) => { if (this.hasValue(id)) removes.push(id); else adds.push(id); });
    if (adds.length === 0 && removes.length === 0)
      return false;

    const needClearHilite = (HilitedState.No !== this.m_hilitedState);

    if (needClearHilite)
      this.clearHilite(); // Avoid making multiple draws to unhilite/hilite entries as they are removed/added...

    removes.forEach((id) => this.removeOne(id));

    if (adds.length > 0) {
      const groupStart = this.m_elements.length;
      adds.forEach((id) => this.m_elements.push(id));
      this.m_groupMarks.push({ start: groupStart, source: ModifyElementSource.Unknown });

      if (HilitedState.No !== this.m_hilitedState)
        this.setEntriesHiliteState(this.m_hiliteOnAdd, groupStart, this.m_elements.length); // make sure added entries are hilited (when not also removing)...
    }

    if (needClearHilite)
      this.hilite();

    return true;
  }
}
