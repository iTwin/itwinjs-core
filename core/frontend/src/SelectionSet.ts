/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module SelectionSet
 */
import { BeEvent, Id64, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";

/** Identifies the type of changes made to the [[SelectionSet]] to produce a [[SelectionSetEvent]].
 * @public
 * @extensions
 */
export enum SelectionSetEventType {
  /** Ids have been added to the set. */
  Add,
  /** Ids have been removed from the set. */
  Remove,
  /** Some ids have been added to the set and others have been removed. */
  Replace,
  /** All ids have been removed from the set. */
  Clear,
}

/** Passed to [[SelectionSet.onChanged]] event listeners when ids are added to the selection set.
 * @public
 * @extensions
 */
export interface SelectAddEvent {
  type: SelectionSetEventType.Add;
  /**
   * The Ids of the elements added to the set.
   * @deprecated in 5.0. Use the [[additions]] attribute instead.
   */
  added: Id64Arg;
  /** A collection of geometric element, model and subcategory ids that have been added to selection set. */
  additions: SelectableIds;
  /** The affected SelectionSet. */
  set: SelectionSet;
}

/** Passed to [[SelectionSet.onChanged]] event listeners when ids are removed from the selection set.
 * @public
 * @extensions
 */
export interface SelectRemoveEvent {
  /** The type of operation that produced this event. */
  type: SelectionSetEventType.Remove | SelectionSetEventType.Clear;
  /**
   * The element Ids removed from the set.
   * @deprecated in 5.0. Use the [[removals]] attribute instead.
   */
  removed: Id64Arg;
  /** A collection of geometric element, model and subcategory ids that have been removed from selection set. */
  removals: SelectableIds;
  /** The affected SelectionSet. */
  set: SelectionSet;
}

/** Passed to [[SelectionSet.onChanged]] event listeners when ids are simultaneously added to and removed from the selection set.
 * @public
 * @extensions
 */
export interface SelectReplaceEvent {
  type: SelectionSetEventType.Replace;
  /**
   * The element Ids added to the set.
   * @deprecated in 5.0. Use the [[additions]] attribute instead.
   */
  added: Id64Arg;
  /** A collection of geometric element, model and subcategory ids that have been added to selection set. */
  additions: SelectableIds;
  /**
   * The element Ids removed from the set.
   * @deprecated in 5.0. Use the [[removals]] attribute instead.
   */
  removed: Id64Arg;
  /** A collection of geometric element, model and subcategory ids that have been removed from selection set. */
  removals: SelectableIds;
  /** The affected SelectionSet. */
  set: SelectionSet;
}

/** Payload sent to [[SelectionSet.onChanged]] event listeners to describe how the contents of the set have changed.
 * The `type` property of the event serves as a type assertion. For example, the following code will output the added and/or removed Ids:
 *  ```ts
 *  processSelectionSetEvent(ev: SelectionSetEvent): void {
 *    if (SelectionSetEventType.Add === ev.type || SelectionSetEventType.Replace === ev.type)
 *      console.log("Added " + (ev.additions.elements?.size ?? 0) + " elements");
 *
 *    if (SelectionSetEventType.Add !== ev.type)
 *      console.log("Removed " + (ev.removals.elements?.size ?? 0) + " elements");
 *  }
 *  ```
 * @public
 * @extensions
 */
export type SelectionSetEvent = SelectAddEvent | SelectRemoveEvent | SelectReplaceEvent;

/** Holds a set of hilited entities and makes any changes to the set by passing the change
 * function to given `change` callback.
 * @internal
 */
class HilitedIds extends Id64.Uint32Set {
  public constructor(private _change: (func: () => void) => void) {
    super();
  }

  public override add(low: number, high: number) {
    this._change(() => super.add(low, high));
  }

  public override delete(low: number, high: number) {
    this._change(() => super.delete(low, high));
  }

  public override clear() {
    this._change(() => super.clear());
  }

  public override addIds(ids: Id64Arg) {
    this._change(() => super.addIds(ids));
  }

  public override deleteIds(ids: Id64Arg) {
    this._change(() => super.deleteIds(ids));
  }
}

/** Describes how the sets of hilited models and subcategories in a [[HiliteSet]] interact.
 *  - "union" indicates a [Feature]($common) will be hilited if either its model **or** its subcategory is present in the HiliteSet.
 *  - "intersection" indicates a [Feature]($common) will be hilited only if both its model **and** its subcategory are present in the HiliteSet.
 *
 * @see [[HiliteSet.modelSubCategoryMode]] to change the mode for a HiliteSet.
 * @public
 */
export type ModelSubCategoryHiliteMode = "union" | "intersection";

/** A set of *hilited* elements for an [[IModelConnection]], by element id.
 * Hilited elements are displayed with a customizable hilite effect within a [[Viewport]].
 * The set exposes 3 types of elements in 3 separate collections: [GeometricElement]($backend), [GeometricModel]($backend), and [SubCategory]($backend).
 * The [[models]] and [[subcategories]] can be hilited independently or as an intersection of the two sets, as specified by [[modelSubCategoryMode]].
 *
 * Technically, the hilite effect is applied to [Feature]($common)s, not [Element]($backend)s. An element's geometry stream can contain multiple
 * features belonging to different subcategories.
 *
 * Because Javascript lacks efficient support for 64-bit integers, the Ids are stored as pairs of 32-bit integers via [Id64.Uint32Set]($bentley).
 *
 * @note Typically, elements are hilited by virtue of their presence in the IModelConnection's [[SelectionSet]]. The HiliteSet allows additional
 * elements to be displayed with the hilite effect without adding them to the [[SelectionSet]]. If you add elements to the HiliteSet directly, you
 * are also responsible for removing them as appropriate.
 * @see [[IModelConnection.hilited]] for the HiliteSet associated with an iModel.
 * @see [Hilite.Settings]($common) for customization of the hilite effect.
 * @public
 * @extensions
 */
export class HiliteSet {
  #mode: ModelSubCategoryHiliteMode = "union";
  #selectionChangesListener?: () => void;
  #changing = false;

  /** The set of hilited elements. */
  public readonly elements: Id64.Uint32Set;

  /** The set of hilited subcategories.
   * @see [[modelSubCategoryMode]] to control how this set interacts with the set of hilited [[models]].
   * @see [[IModelConnection.Categories]] to obtain the set of subcategories associated with one or more [Category]($backend)'s.
   */
  public readonly subcategories: Id64.Uint32Set;

  /** The set of hilited [[GeometricModelState]]s.
   * @see [[modelSubCategoryMode]] to control how this set interacts with the set of hilited [[subcategories]].
   */
  public readonly models: Id64.Uint32Set;

  /** Controls how the sets of hilited [[models]] and [[subcategories]] interact with one another.
   * By default they are treated as a union: a [Feature]($common) is hilited if either its model **or** its subcategory is hilited.
   * This can be changed to an intersection such that a [Feature]($common) is hilited only if both its model **and** subcategory are hilited.
   * @note The sets of hilited models and subcategories are independent of the set of hilited [[elements]] - an element whose Id is present in
   * [[elements]] is always hilited regardless of its model or subcategories.
   */
  public get modelSubCategoryMode(): ModelSubCategoryHiliteMode {
    return this.#mode;
  }
  public set modelSubCategoryMode(mode: ModelSubCategoryHiliteMode) {
    if (mode === this.#mode) {
      return;
    }
    this.onModelSubCategoryModeChanged.raiseEvent(mode);
    this.#mode = mode;
  }

  /** Event raised just before changing the value of [[modelSubCategoryMode]]. */
  public readonly onModelSubCategoryModeChanged = new BeEvent<(newMode: ModelSubCategoryHiliteMode) => void>();

  /** Construct a HiliteSet
   * @param iModel The iModel containing the entities to be hilited.
   * @param syncWithSelectionSet If true, the hilite set contents will be synchronized with those in the `iModel`'s [[SelectionSet]].
   */
  public constructor(public iModel: IModelConnection, syncWithSelectionSet = true) {
    this.elements = new HilitedIds((func) => this.#change(func));
    this.subcategories = new HilitedIds((func) => this.#change(func));
    this.models = new HilitedIds((func) => this.#change(func));
    this.wantSyncWithSelectionSet = syncWithSelectionSet;
  }

  /** Control whether the hilite set will be synchronized with the contents of the [[SelectionSet]].
   * By default they are synchronized. Applications that override this take responsibility for managing the set of hilited entities.
   * When turning synchronization off, the contents of the HiliteSet will remain unchanged.
   * When turning synchronization on, the current contents of the HiliteSet will be preserved, and the contents of the selection set will be added to them.
   */
  public get wantSyncWithSelectionSet(): boolean {
    return !!this.#selectionChangesListener;
  }
  public set wantSyncWithSelectionSet(want: boolean) {
    if (want === this.wantSyncWithSelectionSet) {
      return;
    }
    if (want) {
      const set = this.iModel.selectionSet;
      this.#selectionChangesListener = set.onChanged.addListener((ev) => this.#processSelectionSetEvent(ev));
      this.add(set.active);
    } else {
      this.#selectionChangesListener!();
      this.#selectionChangesListener = undefined;
    }
  }

  #onChanged() {
    if (!this.#changing) {
      IModelApp.viewManager.onSelectionSetChanged(this.iModel);
    }
  }

  #change(func: () => void) {
    const changing = this.#changing;
    this.#changing = true;
    try {
      func();
    } finally {
      this.#changing = changing;
    }
    this.#onChanged();
  }

  #processSelectionSetEvent(ev: SelectionSetEvent) {
    switch (ev.type) {
      case SelectionSetEventType.Add:
        return this.add(ev.additions);
      case SelectionSetEventType.Replace:
        return this.#change(() => {
          this.add(ev.additions);
          this.remove(ev.removals);
        });
      case SelectionSetEventType.Remove:
      case SelectionSetEventType.Clear:
        return this.remove(ev.removals);
    }
  }

  /** Adds a collection of geometric element, model and subcategory ids to this hilite set. */
  public add(additions: SelectableIds): void {
    this.#change(() => {
      additions.elements && this.elements.addIds(additions.elements);
      additions.models && this.models.addIds(additions.models);
      additions.subcategories && this.subcategories.addIds(additions.subcategories);
    });
  }

  /** Removes a collection of geometric element, model and subcategory ids from this hilite set. */
  public remove(removals: SelectableIds): void {
    this.#change(() => {
      removals.elements && this.elements.deleteIds(removals.elements);
      removals.models && this.models.deleteIds(removals.models);
      removals.subcategories && this.subcategories.deleteIds(removals.subcategories);
    });
  }

  /** Replaces ids currently in the hilite set with the given collection. */
  public replace(ids: SelectableIds): void {
    this.#change(() => {
      this.clear();
      this.add(ids);
    });
  }

  /** Remove all elements from the hilited set. */
  public clear() {
    this.#change(() => {
      this.elements.clear();
      this.models.clear();
      this.subcategories.clear();
    });
  }

  /** Returns true if nothing is hilited. */
  public get isEmpty(): boolean {
    return this.elements.isEmpty && this.subcategories.isEmpty && this.models.isEmpty;
  }

  /** Toggle the hilited state of one or more elements.
   * @param arg the ID(s) of the elements whose state is to be toggled.
   * @param onOff True to add the elements to the hilited set, false to remove them.
   * @deprecated in 5.0. Use [[add]], [[remove]], [[replace]] instead.
   */
  public setHilite(arg: Id64Arg, onOff: boolean): void {
    if (onOff) {
      this.add({ elements: arg });
    } else {
      this.remove({ elements: arg });
    }
  }
}

/** A set of *currently selected* geometric elements, models and subcategories for an `IModelConnection`.
 * Generally, selected elements are displayed with a customizable hilite effect within a [[Viewport]], see [[HiliteSet]].
 * @see [Hilite.Settings]($common) for customization of the hilite effect.
 * @public
 * @extensions
 */
export class SelectionSet {
  #selection: {
    [P in keyof SelectableIds]-?: Id64Set;
  };

  /** The IDs of the selected elements.
   * @note Do not modify this set directly. Instead, use methods like [[SelectionSet.add]].
   */
  public get elements(): Set<Id64String> {
    return this.#selection.elements;
  }

  /** The IDs of the selected models.
   * @note Do not modify this set directly. Instead, use methods like [[SelectionSet.add]].
   */
  public get models(): Set<Id64String> {
    return this.#selection.models;
  }

  /** The IDs of the selected subcategories.
   * @note Do not modify this set directly. Instead, use methods like [[SelectionSet.add]].
   */
  public get subcategories(): Set<Id64String> {
    return this.#selection.subcategories;
  }

  /** Get the active selection as a collection of geometric element, model and subcategory ids.
   * @note Do not the sets in returned collection directly. Instead, use methods like [[SelectionSet.add]].
   */
  public get active(): { [P in keyof SelectableIds]-?: Set<Id64String> } {
    return { ...this.#selection };
  }

  /** Called whenever ids are added or removed from this `SelectionSet` */
  public readonly onChanged = new BeEvent<(ev: SelectionSetEvent) => void>();

  public constructor(public iModel: IModelConnection) {
    this.#selection = {
      elements: new Set(),
      models: new Set(),
      subcategories: new Set(),
    };
  }

  #sendChangedEvent(ev: SelectionSetEvent) {
    IModelApp.viewManager.onSelectionSetChanged(this.iModel);
    this.onChanged.raiseEvent(ev);
  }

  /** Get the number of entries in this selection set. */
  public get size() {
    return this.elements.size + this.models.size + this.subcategories.size;
  }

  /** Check whether there are any ids in this selection set. */
  public get isActive() {
    return this.elements.size > 0 || this.models.size > 0 || this.subcategories.size > 0;
  }

  /** Return true if elemId is in this `SelectionSet`.
   * @see [[isSelected]]
   * @deprecated in 5.0. Use `SelectionSet.elements.has(elemId)` instead.
   */
  public has(elemId?: string) {
    return !!elemId && this.elements.has(elemId);
  }

  /** Query whether an Id is in the selection set.
   * @see [[has]]
   * @deprecated in 5.0. Use `SelectionSet.elements.has(elemId)` instead.
   */
  public isSelected(elemId?: Id64String): boolean {
    return !!elemId && this.elements.has(elemId);
  }

  /** Clear current selection set.
   * @note raises the [[onChanged]] event with [[SelectionSetEventType.Clear]].
   */
  public emptyAll(): void {
    if (!this.isActive) {
      return;
    }
    const removals = this.#selection;
    this.#selection = {
      elements: new Set(),
      models: new Set(),
      subcategories: new Set(),
    };
    this.#sendChangedEvent({ set: this, type: SelectionSetEventType.Clear, removals, removed: removals.elements });
  }

  /**
   * Add one or more Ids to the current selection set.
   * @param elem The set of Ids to add.
   * @returns true if any elements were added.
   */
  public add(adds: Id64Arg | SelectableIds): boolean {
    return !!this.#add(adds);
  }

  #add(adds: Id64Arg | SelectableIds, sendEvent = true): SelectableIds | undefined {
    const oldSize = this.size;
    const additions: { [P in keyof SelectableIds]: Id64Array } = {};
    forEachSelectableType({
      ids: adds,
      elements: (elementIds) =>
        addIds({
          target: this.#selection.elements,
          ids: elementIds,
          onAdd: (id) => (additions.elements ??= []).push(id),
        }),
      models: (modelIds) =>
        addIds({
          target: this.#selection.models,
          ids: modelIds,
          onAdd: (id) => (additions.models ??= []).push(id),
        }),
      subcategories: (subcategoryIds) =>
        addIds({
          target: this.#selection.subcategories,
          ids: subcategoryIds,
          onAdd: (id) => (additions.subcategories ??= []).push(id),
        }),
    });
    const changed = oldSize !== this.size;
    if (!changed) {
      return undefined;
    }
    if (sendEvent) {
      this.#sendChangedEvent({
        type: SelectionSetEventType.Add,
        set: this,
        additions,
        added: additions.elements ?? [],
      });
    }
    return additions;
  }

  /**
   * Remove one or more Ids from the current selection set.
   * @param elem The set of Ids to remove.
   * @returns true if any elements were removed.
   */
  public remove(removes: Id64Arg | SelectableIds): boolean {
    return !!this.#remove(removes);
  }

  #remove(removes: Id64Arg | SelectableIds, sendEvent = true): SelectableIds | undefined {
    const oldSize = this.size;
    const removals: { [P in keyof SelectableIds]: Id64Array } = {};
    forEachSelectableType({
      ids: removes,
      elements: (elementIds) =>
        removeIds({
          target: this.#selection.elements,
          ids: elementIds,
          onRemove: (id) => (removals.elements ??= []).push(id),
        }),
      models: (modelIds) =>
        removeIds({
          target: this.#selection.models,
          ids: modelIds,
          onRemove: (id) => (removals.models ??= []).push(id),
        }),
      subcategories: (subcategoryIds) =>
        removeIds({
          target: this.#selection.subcategories,
          ids: subcategoryIds,
          onRemove: (id) => (removals.subcategories ??= []).push(id),
        }),
    });
    const changed = oldSize !== this.size;
    if (!changed) {
      return undefined;
    }
    if (sendEvent) {
      this.#sendChangedEvent({
        type: SelectionSetEventType.Remove,
        set: this,
        removals,
        removed: removals.elements ?? [],
      });
    }
    return removals;
  }

  /**
   * Add one set of Ids, and remove another set of Ids. Any Ids that are in both sets are removed.
   * @returns True if any Ids were either added or removed.
   */
  public addAndRemove(adds: Id64Arg | SelectableIds, removes: Id64Arg | SelectableIds): boolean {
    const additions = this.#add(adds, false);
    const removals = this.#remove(removes, false);
    const addedElements = additions?.elements ?? [];
    const removedElements = removals?.elements ?? [];
    if (additions && removals) {
      this.#sendChangedEvent({
        type: SelectionSetEventType.Replace,
        set: this,
        additions,
        added: addedElements,
        removals,
        removed: removedElements,
      });
    } else if (additions) {
      this.#sendChangedEvent({
        type: SelectionSetEventType.Add,
        set: this,
        additions,
        added: addedElements,
      });
    } else if (removals) {
      this.#sendChangedEvent({
        type: SelectionSetEventType.Remove,
        set: this,
        removals,
        removed: removedElements,
      });
    }
    return !!additions || !!removals;
  }

  /** Invert the state of a set of Ids in the `SelectionSet` */
  public invert(ids: Id64Arg | SelectableIds): boolean {
    const adds: { [P in keyof SelectableIds]: Id64Set } = {};
    const removes: { [P in keyof SelectableIds]: Id64Set } = {};
    forEachSelectableType({
      ids,
      elements: (elementIds) => {
        for (const id of Id64.iterable(elementIds)) {
          ((this.elements.has(id) ? removes : adds).elements ??= new Set()).add(id);
        }
      },
      models: (modelIds) => {
        for (const id of Id64.iterable(modelIds)) {
          ((this.models.has(id) ? removes : adds).models ??= new Set()).add(id);
        }
      },
      subcategories: (subcategoryIds) => {
        for (const id of Id64.iterable(subcategoryIds)) {
          ((this.subcategories.has(id) ? removes : adds).subcategories ??= new Set()).add(id);
        }
      },
    });
    return this.addAndRemove(adds, removes);
  }

  /** Change selection set to be the supplied set of Ids. */
  public replace(ids: Id64Arg | SelectableIds): boolean {
    if (areEqual(this.#selection, ids)) {
      return false;
    }

    const previousSelection = this.#selection;
    this.#selection = {
      elements: new Set(),
      models: new Set(),
      subcategories: new Set(),
    };
    this.#add(ids, false);

    const additions: { [P in keyof SelectableIds]: Id64Set } = {};
    const removals: { [P in keyof SelectableIds]: Id64Set } = {};
    forEachSelectableType({
      ids: this.#selection,
      elements: (elementIds) => {
        removeIds({
          target: previousSelection.elements,
          ids: elementIds,
          onNotFound: (id) => (additions.elements ??= new Set()).add(id),
        });
        if (previousSelection.elements.size > 0) {
          removals.elements = previousSelection.elements;
        }
      },
      models: (modelIds) => {
        removeIds({
          target: previousSelection.models,
          ids: modelIds,
          onNotFound: (id) => (additions.models ??= new Set()).add(id),
        });
        if (previousSelection.models.size > 0) {
          removals.models = previousSelection.models;
        }
      },
      subcategories: (subcategoryIds) => {
        removeIds({
          target: previousSelection.subcategories,
          ids: subcategoryIds,
          onNotFound: (id) => (additions.subcategories ??= new Set()).add(id),
        });
        if (previousSelection.subcategories.size > 0) {
          removals.subcategories = previousSelection.subcategories;
        }
      },
    });

    this.#sendChangedEvent({
      type: SelectionSetEventType.Replace,
      set: this,
      additions,
      added: additions.elements ?? [],
      removals,
      removed: removals.elements ?? [],
    });
    return true;
  }
}

/**
 * A collection of geometric element, model and subcategory ids that can be added to
 * a [[SelectionSet]] or [[HiliteSet]].
 * @public
 */
export interface SelectableIds {
  elements?: Id64Arg;
  models?: Id64Arg;
  subcategories?: Id64Arg;
}

function forEachSelectableType({
  ids,
  elements,
  models,
  subcategories,
}: {
  ids: Id64Arg | SelectableIds;
  elements: (ids: Id64Arg) => void;
  models: (ids: Id64Arg) => void;
  subcategories: (ids: Id64Arg) => void;
}): SelectableIds {
  if (typeof ids === "string" || Array.isArray(ids) || ids instanceof Set) {
    elements(ids);
    return { elements: ids };
  }
  elements(ids.elements ?? []);
  models(ids.models ?? []);
  subcategories(ids.subcategories ?? []);
  return ids;
}

function areEqual(lhs: { [P in keyof SelectableIds]-?: Id64Set }, rhs: Id64Arg | SelectableIds): boolean {
  let result = true;
  forEachSelectableType({
    ids: rhs,
    elements: (elementIds) => {
      if (result && !areIdsEqual(lhs.elements, elementIds)) {
        result = false;
      }
    },
    models: (modelIds) => {
      if (result && !areIdsEqual(lhs.models, modelIds)) {
        result = false;
      }
    },
    subcategories: (subcategoryIds) => {
      if (result && !areIdsEqual(lhs.subcategories, subcategoryIds)) {
        result = false;
      }
    },
  });
  return result;
}

function areIdsEqual(lhs: Set<Id64String>, rhs: Id64Arg): boolean {
  // Size is unreliable if input can contain duplicates...
  if (Array.isArray(rhs)) rhs = Id64.toIdSet(rhs);

  if (lhs.size !== Id64.sizeOf(rhs)) return false;

  for (const id of Id64.iterable(rhs)) if (!lhs.has(id)) return false;

  return true;
}

function addIds({ target, ids, onAdd }: { target: Id64Set; ids: Id64Arg; onAdd?: (id: Id64String) => void }) {
  let size = target.size;
  for (const id of Id64.iterable(ids)) {
    target.add(id);
    const newSize = target.size;
    if (newSize !== size) {
      onAdd?.(id);
    }
    size = newSize;
  }
}

function removeIds({
  target,
  ids,
  onRemove,
  onNotFound,
}: {
  target: Id64Set;
  ids: Id64Arg;
  onRemove?: (id: Id64String) => void;
  onNotFound?: (id: Id64String) => void;
}) {
  let size = target.size;
  for (const id of Id64.iterable(ids)) {
    target.delete(id);
    const newSize = target.size;
    if (newSize !== size) {
      onRemove?.(id);
    } else {
      onNotFound?.(id);
    }
    size = newSize;
  }
}
