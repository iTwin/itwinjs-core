/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { ModifyElementSource } from "./PrimitiveTool";
import { IdSet } from "../SelectionSet";

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
  /**  all of the entries in this agenda were hilited by a call to ElementAgenda::Hilite */
  Yes = 1,
  /**  all of the entries in this agenda were unhilited by a call to ElementAgenda::ClearHilite */
  No = 2,
}

export interface GroupMark {
  start: number;
  source: ModifyElementSource;
}

export class ElementAgenda {
  public readonly m_elements: Id64[] = [];
  public readonly m_groupMarks: GroupMark[] = [];
  /** whether elements are flagged as hilited when added to the agenda. */
  public m_hiliteOnAdd = true;
  public m_hilitedState = HilitedState.Unknown;

  /** Populate an IdSet from this agenda. */
  public getElementIdSet(ids: IdSet) { this.m_elements.forEach((id) => ids.add(id.value)); }

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

  /** Calls ClearHilite and removes the last group of elements added to this ElementAgenda. */
  public popGroup() {
    if (this.m_groupMarks.length <= 1) {
      this.clear();
      return;
    }

    const group = this.m_groupMarks.pop()!;

    if (HilitedState.No !== this.m_hilitedState)
      this.setEntriesHiliteState(false, group.start, m_elements.size()); // make sure removed entries aren't left hilited...

    m_elements.erase(m_elements.begin() + groupStart, m_elements.end());
    m_groupMarks.pop_back();
  }

  //! If entries in agenda are drawn in hilite by a previous call to #Hilite, they are unhilited.
  DGNVIEW_EXPORT void ClearHilite();

  //! Mark all entries in this agenda as being hilited and then redraw the agenda so that fact is visible to the user. The agenda itself
  //! also holds a flag indicating whether its entries are all in the hilite state so that calls to #ClearHilite can reverse that.
  //! @note Any calls to one of the Insert methods clears to hilite flag on the ElementAgenda, so that #ClearHilite will not do anything.
  DGNVIEW_EXPORT void Hilite();

  //! Return true if element is already in this ElementAgenda.
  DGNVIEW_EXPORT bool Find(DgnElementId, DgnDbR) const;

  //! Add a single element to the ElementAgenda.
  DGNVIEW_EXPORT bool Add(DgnElementId, DgnDbR);

  //! Remove element (and all other elements added as part of a group/assembly) from the ElementAgenda.
  DGNVIEW_EXPORT bool Remove(DgnElementId, DgnDbR);

  //! Add a set of elements to the ElementAgenda.
  DGNVIEW_EXPORT bool Add(DgnElementIdSet const&, DgnDbR);

  //! Remove a set of elements from the ElementAgenda.
  DGNVIEW_EXPORT bool Remove(DgnElementIdSet const&, DgnDbR);

  //! Add elements not currently in the ElementAgenda and remove elements currently in the ElementAgenda.
  DGNVIEW_EXPORT bool Invert(DgnElementIdSet const&, DgnDbR);

}; // ElementAgenda
