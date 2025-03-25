/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { defer, EMPTY, mergeMap, Observable, of, Subject, Subscription, takeUntil, tap } from "rxjs";
import { Id64, Id64Arg, Id64Array } from "@itwin/core-bentley";
import { IModelConnection, SelectableIds, SelectionSetEvent, SelectionSetEventType } from "@itwin/core-frontend";
import { AsyncTasksTracker, BaseNodeKey, InstanceKey, Key, Keys, KeySet, NodeKey, SelectionScope, SelectionScopeProps } from "@itwin/presentation-common";
import {
  createStorage,
  CustomSelectable,
  Selectable,
  Selectables,
  SelectionStorage,
  StorageSelectionChangeEventArgs,
  StorageSelectionChangeType,
  TRANSIENT_ELEMENT_CLASSNAME,
} from "@itwin/unified-selection";
import { Presentation } from "../Presentation.js";
import { HiliteSet, HiliteSetProvider } from "./HiliteSetProvider.js";
import { ISelectionProvider } from "./ISelectionProvider.js";
import { SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType } from "./SelectionChangeEvent.js";
import { createSelectionScopeProps, SelectionScopesManager } from "./SelectionScopesManager.js";

/**
 * Properties for creating [[SelectionManager]].
 * @public
 * @deprecated in 5.0. Use `SelectionStorage` from [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md) package instead.
 */
export interface SelectionManagerProps {
  /** A manager for [selection scopes]($docs/presentation/unified-selection/index#selection-scopes) */
  scopes: SelectionScopesManager;

  /**
   * Custom unified selection storage to be used by [[SelectionManager]]. If not provided [[SelectionManager]] creates
   * and maintains storage.
   */
  selectionStorage?: SelectionStorage;

  /**
   * An optional function that returns a key for the given iModel. The key is what "glues" iModel selection
   * changes made in `selectionStorage`, where iModels are identified by key, and `SelectionManager`, where
   * iModels are specified as `IModelConnection`.
   *
   * If not provided, [IModelConnection.key]($core-frontend) or [IModelConnection.name]($core-frontend) is used.
   */
  imodelKeyFactory?: (imodel: IModelConnection) => string;
}

/**
 * The selection manager which stores the overall selection.
 * @public
 * @deprecated in 5.0. Use `SelectionStorage` from [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md) package instead.
 */
export class SelectionManager implements ISelectionProvider, Disposable {
  private _imodelKeyFactory: (imodel: IModelConnection) => string;
  private _imodelToolSelectionSyncHandlers = new Map<IModelConnection, { requestorsCount: number; handler: ToolSelectionSyncHandler }>();
  private _hiliteSetProviders = new Map<IModelConnection, HiliteSetProvider>();
  private _ownsStorage: boolean;

  private _knownIModels = new Set<IModelConnection>();
  private _currentSelection = new CurrentSelectionStorage();
  private _selectionChanges = new Subject<StorageSelectionChangeEventArgs>();
  private _selectionEventsSubscription: Subscription;
  private _listeners: Array<() => void> = [];

  /**
   * Underlying selection storage used by this selection manager. Ideally, consumers should use
   * the storage directly instead of using this manager to manipulate selection.
   */
  public readonly selectionStorage: SelectionStorage;

  /** An event which gets broadcasted on selection changes */
  public readonly selectionChange: SelectionChangeEvent;

  /** Manager for [selection scopes]($docs/presentation/unified-selection/index#selection-scopes) */
  public readonly scopes: SelectionScopesManager;

  /**
   * Creates an instance of SelectionManager.
   */
  constructor(props: SelectionManagerProps) {
    this.selectionChange = new SelectionChangeEvent();
    this.scopes = props.scopes;
    this.selectionStorage = props.selectionStorage ?? createStorage();
    this._imodelKeyFactory = props.imodelKeyFactory ?? ((imodel) => (imodel.key.length ? imodel.key : imodel.name));
    this._ownsStorage = props.selectionStorage === undefined;
    this.selectionStorage.selectionChangeEvent.addListener((args) => this._selectionChanges.next(args));
    this._selectionEventsSubscription = this.streamSelectionEvents();
    this._listeners.push(
      IModelConnection.onOpen.addListener((imodel) => {
        this._knownIModels.add(imodel);
      }),
    );
    this._listeners.push(
      IModelConnection.onClose.addListener((imodel: IModelConnection) => {
        this.onConnectionClose(imodel);
      }),
    );
  }

  public [Symbol.dispose]() {
    this._selectionEventsSubscription.unsubscribe();
    this._listeners.forEach((dispose) => dispose());
  }

  /** @deprecated in 5.0. Use [Symbol.dispose] instead. */
  /* c8 ignore next 3 */
  public dispose() {
    this[Symbol.dispose]();
  }

  private onConnectionClose(imodel: IModelConnection): void {
    const imodelKey = this._imodelKeyFactory(imodel);
    this._hiliteSetProviders.delete(imodel);
    this._knownIModels.delete(imodel);
    this._currentSelection.clear(imodelKey);
    if (this._ownsStorage) {
      this.clearSelection("Connection Close Event", imodel);
      this.selectionStorage.clearStorage({ imodelKey });
    }
  }

  /** @internal */
  /* c8 ignore next 3 */
  public getToolSelectionSyncHandler(imodel: IModelConnection) {
    return this._imodelToolSelectionSyncHandlers.get(imodel)?.handler;
  }

  /**
   * Request the manager to sync with imodel's tool selection (see `IModelConnection.selectionSet`).
   */
  public setSyncWithIModelToolSelection(imodel: IModelConnection, sync = true) {
    const registration = this._imodelToolSelectionSyncHandlers.get(imodel);
    if (sync) {
      if (!registration || registration.requestorsCount === 0) {
        this._imodelToolSelectionSyncHandlers.set(imodel, { requestorsCount: 1, handler: new ToolSelectionSyncHandler(imodel, this) });
      } else {
        this._imodelToolSelectionSyncHandlers.set(imodel, { ...registration, requestorsCount: registration.requestorsCount + 1 });
      }
    } else {
      if (registration && registration.requestorsCount > 0) {
        const requestorsCount = registration.requestorsCount - 1;
        if (requestorsCount > 0) {
          this._imodelToolSelectionSyncHandlers.set(imodel, { ...registration, requestorsCount });
        } else {
          this._imodelToolSelectionSyncHandlers.delete(imodel);
          registration.handler[Symbol.dispose]();
        }
      }
    }
  }

  /**
   * Temporarily suspends tool selection synchronization until the returned `Disposable`
   * is disposed.
   */
  public suspendIModelToolSelectionSync(imodel: IModelConnection) {
    const registration = this._imodelToolSelectionSyncHandlers.get(imodel);
    if (!registration) {
      const noop = () => {};
      return { [Symbol.dispose]: noop, dispose: noop };
    }

    const wasSuspended = registration.handler.isSuspended;
    registration.handler.isSuspended = true;
    const doDispose = () => (registration.handler.isSuspended = wasSuspended);
    return { [Symbol.dispose]: doDispose, dispose: doDispose };
  }

  /** Get the selection levels currently stored in this manager for the specified imodel */
  public getSelectionLevels(imodel: IModelConnection): number[] {
    const imodelKey = this._imodelKeyFactory(imodel);
    return this.selectionStorage.getSelectionLevels({ imodelKey });
  }

  /**
   * Get the selection currently stored in this manager
   *
   * @note Calling immediately after `add*`|`replace*`|`remove*`|`clear*` method call does not guarantee
   * that returned `KeySet` will include latest changes. Listen for `selectionChange` event to get the
   * latest selection after changes.
   */
  public getSelection(imodel: IModelConnection, level: number = 0): Readonly<KeySet> {
    const imodelKey = this._imodelKeyFactory(imodel);
    return this._currentSelection.getSelection(imodelKey, level);
  }

  private handleEvent(evt: SelectionChangeEventArgs): void {
    const imodelKey = this._imodelKeyFactory(evt.imodel);
    this._knownIModels.add(evt.imodel);
    switch (evt.changeType) {
      case SelectionChangeType.Add:
        this.selectionStorage.addToSelection({
          imodelKey,
          source: evt.source,
          level: evt.level,
          selectables: keysToSelectable(evt.imodel, evt.keys),
        });
        break;
      case SelectionChangeType.Remove:
        this.selectionStorage.removeFromSelection({
          imodelKey,
          source: evt.source,
          level: evt.level,
          selectables: keysToSelectable(evt.imodel, evt.keys),
        });
        break;
      case SelectionChangeType.Replace:
        this.selectionStorage.replaceSelection({
          imodelKey,
          source: evt.source,
          level: evt.level,
          selectables: keysToSelectable(evt.imodel, evt.keys),
        });
        break;
      case SelectionChangeType.Clear:
        this.selectionStorage.clearSelection({ imodelKey, source: evt.source, level: evt.level });
        break;
    }
  }

  /**
   * Add keys to the selection
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param keys Keys to add
   * @param level Selection level (see [selection levels documentation section]($docs/presentation/unified-selection/index#selection-levels))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public addToSelection(source: string, imodel: IModelConnection, keys: Keys, level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodel,
      changeType: SelectionChangeType.Add,
      keys: new KeySet(keys),
      timestamp: new Date(),
      rulesetId,
    };
    this.handleEvent(evt);
  }

  /**
   * Remove keys from current selection
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param keys Keys to remove
   * @param level Selection level (see [selection levels documentation section]($docs/presentation/unified-selection/index#selection-levels))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public removeFromSelection(source: string, imodel: IModelConnection, keys: Keys, level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodel,
      changeType: SelectionChangeType.Remove,
      keys: new KeySet(keys),
      timestamp: new Date(),
      rulesetId,
    };
    this.handleEvent(evt);
  }

  /**
   * Replace current selection
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param keys Keys to add
   * @param level Selection level (see [selection levels documentation section]($docs/presentation/unified-selection/index#selection-levels))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public replaceSelection(source: string, imodel: IModelConnection, keys: Keys, level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodel,
      changeType: SelectionChangeType.Replace,
      keys: new KeySet(keys),
      timestamp: new Date(),
      rulesetId,
    };
    this.handleEvent(evt);
  }

  /**
   * Clear current selection
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param level Selection level (see [selection levels documentation section]($docs/presentation/unified-selection/index#selection-levels))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public clearSelection(source: string, imodel: IModelConnection, level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodel,
      changeType: SelectionChangeType.Clear,
      keys: new KeySet(),
      timestamp: new Date(),
      rulesetId,
    };
    this.handleEvent(evt);
  }

  /**
   * Add keys to selection after applying [selection scope]($docs/presentation/unified-selection/index#selection-scopes) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param ids Element IDs to add
   * @param scope Selection scope to apply
   * @param level Selection level (see [selection levels documentation section]($docs/presentation/unified-selection/index#selection-levels))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async addToSelectionWithScope(
    source: string,
    imodel: IModelConnection,
    ids: Id64Arg,
    scope: SelectionScopeProps | SelectionScope | string,
    level: number = 0,
    rulesetId?: string,
  ): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, ids, scope);
    this.addToSelection(source, imodel, scopedKeys, level, rulesetId);
  }

  /**
   * Remove keys from current selection after applying [selection scope]($docs/presentation/unified-selection/index#selection-scopes) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param ids Element IDs to remove
   * @param scope Selection scope to apply
   * @param level Selection level (see [selection levels documentation section]($docs/presentation/unified-selection/index#selection-levels))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async removeFromSelectionWithScope(
    source: string,
    imodel: IModelConnection,
    ids: Id64Arg,
    scope: SelectionScopeProps | SelectionScope | string,
    level: number = 0,
    rulesetId?: string,
  ): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, ids, scope);
    this.removeFromSelection(source, imodel, scopedKeys, level, rulesetId);
  }

  /**
   * Replace current selection with keys after applying [selection scope]($docs/presentation/unified-selection/index#selection-scopes) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param ids Element IDs to replace with
   * @param scope Selection scope to apply
   * @param level Selection level (see [selection levels documentation section]($docs/presentation/unified-selection/index#selection-levels))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async replaceSelectionWithScope(
    source: string,
    imodel: IModelConnection,
    ids: Id64Arg,
    scope: SelectionScopeProps | SelectionScope | string,
    level: number = 0,
    rulesetId?: string,
  ): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, ids, scope);
    this.replaceSelection(source, imodel, scopedKeys, level, rulesetId);
  }

  /**
   * Get the current hilite set for the specified imodel
   * @public
   */
  public async getHiliteSet(imodel: IModelConnection): Promise<HiliteSet> {
    return this.getHiliteSetProvider(imodel).getHiliteSet(this.getSelection(imodel));
  }

  /**
   * Get the current hilite set iterator for the specified imodel.
   * @public
   */
  public getHiliteSetIterator(imodel: IModelConnection) {
    return this.getHiliteSetProvider(imodel).getHiliteSetIterator(this.getSelection(imodel));
  }

  private getHiliteSetProvider(imodel: IModelConnection) {
    let provider = this._hiliteSetProviders.get(imodel);
    if (!provider) {
      provider = HiliteSetProvider.create({ imodel });
      this._hiliteSetProviders.set(imodel, provider);
    }
    return provider;
  }

  private streamSelectionEvents() {
    return this._selectionChanges
      .pipe(
        mergeMap((args) => {
          const currentSelectables = this.selectionStorage.getSelection({ imodelKey: args.imodelKey, level: args.level });
          return this._currentSelection.computeSelection(args.imodelKey, args.level, currentSelectables, args.selectables).pipe(
            mergeMap(({ level, changedSelection }): Observable<SelectionChangeEventArgs> => {
              const imodel = findIModel(this._knownIModels, this._imodelKeyFactory, args.imodelKey);
              /* c8 ignore next 3 */
              if (!imodel) {
                return EMPTY;
              }
              return of({
                imodel,
                keys: changedSelection,
                level,
                source: args.source,
                timestamp: args.timestamp,
                changeType: getChangeType(args.changeType),
              });
            }),
          );
        }),
      )
      .subscribe({
        next: (args) => {
          this.selectionChange.raiseEvent(args, this);
        },
      });
  }
}

function findIModel(set: Set<IModelConnection>, imodelKeyFactory: (imodel: IModelConnection) => string, key: string) {
  for (const imodel of set) {
    if (imodelKeyFactory(imodel) === key) {
      return imodel;
    }
  }
  return undefined;
}

/** @internal */
export class ToolSelectionSyncHandler implements Disposable {
  private _selectionSourceName = "Tool";
  private _logicalSelection: SelectionManager;
  private _imodel: IModelConnection;
  private _imodelToolSelectionListenerDisposeFunc: () => void;
  private _asyncsTracker = new AsyncTasksTracker();
  public isSuspended?: boolean;

  public constructor(imodel: IModelConnection, logicalSelection: SelectionManager) {
    this._imodel = imodel;
    this._logicalSelection = logicalSelection;
    this._imodelToolSelectionListenerDisposeFunc = imodel.selectionSet.onChanged.addListener(this.onToolSelectionChanged);
  }

  public [Symbol.dispose]() {
    this._imodelToolSelectionListenerDisposeFunc();
  }

  /** note: used only it tests */
  public get pendingAsyncs() {
    return this._asyncsTracker.pendingAsyncs;
  }

  private onToolSelectionChanged = async (ev: SelectionSetEvent): Promise<void> => {
    // ignore selection change event if the handler is suspended
    if (this.isSuspended) {
      return;
    }

    // this component only cares about its own imodel
    const imodel = ev.set.iModel;
    if (imodel !== this._imodel) {
      return;
    }

    // determine the level of selection changes
    // wip: may want to allow selecting at different levels?
    const selectionLevel = 0;

    let ids: SelectableIds;
    switch (ev.type) {
      case SelectionSetEventType.Add:
        ids = ev.additions;
        break;
      case SelectionSetEventType.Replace:
        ids = ev.set.active;
        break;
      default:
        ids = ev.removals;
        break;
    }

    // we're always using scoped selection changer even if the scope is set to "element" - that
    // makes sure we're adding to selection keys with concrete classes and not "BisCore:Element", which
    // we can't because otherwise our keys compare fails (presentation components load data with
    // concrete classes)
    const changer = new ScopedSelectionChanger(
      this._selectionSourceName,
      this._imodel,
      this._logicalSelection,
      createSelectionScopeProps(this._logicalSelection.scopes.activeScope),
    );

    using _r = this._asyncsTracker.trackAsyncTask();
    switch (ev.type) {
      case SelectionSetEventType.Add:
        await changer.add(ids, selectionLevel);
        break;
      case SelectionSetEventType.Replace:
        await changer.replace(ids, selectionLevel);
        break;
      case SelectionSetEventType.Remove:
        await changer.remove(ids, selectionLevel);
        break;
      case SelectionSetEventType.Clear:
        await changer.clear(selectionLevel);
        break;
    }
  };
}

const parseElementIds = (ids: Id64Arg): { persistent: Id64Arg; transient: Id64Arg } => {
  let allPersistent = true;
  let allTransient = true;
  for (const id of Id64.iterable(ids)) {
    if (Id64.isTransient(id)) {
      allPersistent = false;
    } else {
      allTransient = false;
    }

    if (!allPersistent && !allTransient) {
      break;
    }
  }

  // avoid making a copy if ids are only persistent or only transient
  if (allPersistent) {
    return { persistent: ids, transient: [] };
  } else if (allTransient) {
    return { persistent: [], transient: ids };
  }

  // if `ids` contain mixed ids, we have to copy.. use Array instead of
  // a Set for performance
  const persistentElementIds: Id64Array = [];
  const transientElementIds: Id64Array = [];
  for (const id of Id64.iterable(ids)) {
    if (Id64.isTransient(id)) {
      transientElementIds.push(id);
    } else {
      persistentElementIds.push(id);
    }
  }

  return { persistent: persistentElementIds, transient: transientElementIds };
};

function addKeys(target: KeySet, className: string, ids: Id64Arg) {
  for (const id of Id64.iterable(ids)) {
    target.add({ className, id });
  }
}

class ScopedSelectionChanger {
  public readonly name: string;
  public readonly imodel: IModelConnection;
  public readonly manager: SelectionManager;
  public readonly scope: SelectionScopeProps | SelectionScope | string;
  public constructor(name: string, imodel: IModelConnection, manager: SelectionManager, scope: SelectionScopeProps | SelectionScope | string) {
    this.name = name;
    this.imodel = imodel;
    this.manager = manager;
    this.scope = scope;
  }
  public async clear(level: number): Promise<void> {
    this.manager.clearSelection(this.name, this.imodel, level);
  }
  public async add(ids: SelectableIds, level: number): Promise<void> {
    const keys = await this.#computeSelection(ids);
    this.manager.addToSelection(this.name, this.imodel, keys, level);
  }
  public async remove(ids: SelectableIds, level: number): Promise<void> {
    const keys = await this.#computeSelection(ids);
    this.manager.removeFromSelection(this.name, this.imodel, keys, level);
  }
  public async replace(ids: SelectableIds, level: number): Promise<void> {
    const keys = await this.#computeSelection(ids);
    this.manager.replaceSelection(this.name, this.imodel, keys, level);
  }
  async #computeSelection(ids: SelectableIds) {
    let keys = new KeySet();
    if (ids.elements) {
      const { persistent, transient } = parseElementIds(ids.elements);
      keys = await this.manager.scopes.computeSelection(this.imodel, persistent, this.scope);
      addKeys(keys, TRANSIENT_ELEMENT_CLASSNAME, transient);
    }
    if (ids.models) {
      addKeys(keys, "BisCore.Model", ids.models);
    }
    if (ids.subcategories) {
      addKeys(keys, "BisCore.SubCategory", ids.subcategories);
    }
    return keys;
  }
}

/** Stores current selection in `KeySet` format per iModel.  */
class CurrentSelectionStorage {
  private _currentSelection = new Map<string, IModelSelectionStorage>();

  private getCurrentSelectionStorage(imodelKey: string) {
    let storage = this._currentSelection.get(imodelKey);
    if (!storage) {
      storage = new IModelSelectionStorage();
      this._currentSelection.set(imodelKey, storage);
    }
    return storage;
  }

  public getSelection(imodelKey: string, level: number) {
    return this.getCurrentSelectionStorage(imodelKey).getSelection(level);
  }

  public clear(imodelKey: string) {
    this._currentSelection.delete(imodelKey);
  }

  public computeSelection(imodelKey: string, level: number, currSelectables: Selectables, changedSelectables: Selectables) {
    return this.getCurrentSelectionStorage(imodelKey).computeSelection(level, currSelectables, changedSelectables);
  }
}

interface StorageEntry {
  value: KeySet;
  ongoingComputationDisposers: Set<Subject<void>>;
}

/**
 * Computes and stores current selection in `KeySet` format.
 * It always stores result of latest resolved call to `computeSelection`.
 */
class IModelSelectionStorage {
  private _currentSelection = new Map<number, StorageEntry>();

  public getSelection(level: number): KeySet {
    let entry = this._currentSelection.get(level);
    if (!entry) {
      entry = { value: new KeySet(), ongoingComputationDisposers: new Set() };
      this._currentSelection.set(level, entry);
    }
    return entry.value;
  }

  private clearSelections(level: number) {
    const clearedLevels = [];
    for (const [storedLevel] of this._currentSelection.entries()) {
      if (storedLevel > level) {
        clearedLevels.push(storedLevel);
      }
    }
    clearedLevels.forEach((storedLevel) => {
      const entry = this._currentSelection.get(storedLevel);
      /* c8 ignore next 3 */
      if (!entry) {
        return;
      }

      for (const disposer of entry.ongoingComputationDisposers) {
        disposer.next();
      }
      this._currentSelection.delete(storedLevel);
    });
  }

  private addDisposer(level: number, disposer: Subject<void>) {
    const entry = this._currentSelection.get(level);
    if (!entry) {
      this._currentSelection.set(level, { value: new KeySet(), ongoingComputationDisposers: new Set([disposer]) });
      return;
    }
    entry.ongoingComputationDisposers.add(disposer);
  }

  private setSelection(level: number, keys: KeySet, disposer: Subject<void>) {
    const currEntry = this._currentSelection.get(level);
    if (currEntry) {
      currEntry.ongoingComputationDisposers.delete(disposer);
    }
    this._currentSelection.set(level, {
      value: keys,
      ongoingComputationDisposers: currEntry?.ongoingComputationDisposers ?? /* c8 ignore next */ new Set(),
    });
  }

  public computeSelection(level: number, currSelectables: Selectables, changedSelectables: Selectables) {
    this.clearSelections(level);

    const prevComputationsDisposers = [...(this._currentSelection.get(level)?.ongoingComputationDisposers ?? [])];
    const currDisposer = new Subject<void>();
    this.addDisposer(level, currDisposer);

    return defer(async () => {
      const convertedSelectables: SelectableKeys[] = [];
      const [current, changed] = await Promise.all([
        selectablesToKeys(currSelectables, convertedSelectables),
        selectablesToKeys(changedSelectables, convertedSelectables),
      ]);

      const currentSelection = new KeySet([...current.keys, ...current.selectableKeys.flatMap((selectable) => selectable.keys)]);
      const changedSelection = new KeySet([...changed.keys, ...changed.selectableKeys.flatMap((selectable) => selectable.keys)]);

      return {
        level,
        currentSelection,
        changedSelection,
      };
    }).pipe(
      takeUntil(currDisposer),
      tap({
        next: (val) => {
          prevComputationsDisposers.forEach((disposer) => disposer.next());
          this.setSelection(val.level, val.currentSelection, currDisposer);
        },
      }),
    );
  }
}

function keysToSelectable(imodel: IModelConnection, keys: Readonly<KeySet>) {
  const selectables: Selectable[] = [];
  keys.forEach((key) => {
    if ("id" in key) {
      selectables.push(key);
      return;
    }

    const customSelectable: CustomSelectable = {
      identifier: key.pathFromRoot.join("/"),
      data: key,
      loadInstanceKeys: () => createInstanceKeysIterator(imodel, key),
    };
    selectables.push(customSelectable);
  });
  return selectables;
}

interface SelectableKeys {
  identifier: string;
  keys: Key[];
}

async function selectablesToKeys(selectables: Selectables, convertedList: SelectableKeys[]) {
  const keys: Key[] = [];
  const selectableKeys: SelectableKeys[] = [];

  for (const [className, ids] of selectables.instanceKeys) {
    for (const id of ids) {
      keys.push({ id, className });
    }
  }

  for (const [_, selectable] of selectables.custom) {
    if (isNodeKey(selectable.data)) {
      selectableKeys.push({ identifier: selectable.identifier, keys: [selectable.data] });
      continue;
    }
    const converted = convertedList.find((con) => con.identifier === selectable.identifier);
    if (converted) {
      selectableKeys.push(converted);
      continue;
    }

    const newConverted: SelectableKeys = { identifier: selectable.identifier, keys: [] };
    convertedList.push(newConverted);
    for await (const instanceKey of selectable.loadInstanceKeys()) {
      newConverted.keys.push(instanceKey);
    }
    selectableKeys.push(newConverted);
  }

  return { keys, selectableKeys };
}

async function* createInstanceKeysIterator(imodel: IModelConnection, nodeKey: NodeKey): AsyncIterableIterator<InstanceKey> {
  if (NodeKey.isInstancesNodeKey(nodeKey)) {
    for (const key of nodeKey.instanceKeys) {
      yield key;
    }
    return;
  }

  const content = await Presentation.presentation.getContentInstanceKeys({
    imodel,
    keys: new KeySet([nodeKey]),
    rulesetOrId: {
      id: "grouped-instances",
      rules: [
        {
          ruleType: "Content",
          specifications: [
            {
              specType: "SelectedNodeInstances",
            },
          ],
        },
      ],
    },
  });

  for await (const key of content.items()) {
    yield key;
  }
}

function isNodeKey(data: unknown): data is NodeKey {
  const key = data as BaseNodeKey;
  return key.pathFromRoot !== undefined && key.type !== undefined;
}

function getChangeType(type: StorageSelectionChangeType): SelectionChangeType {
  switch (type) {
    case "add":
      return SelectionChangeType.Add;
    case "remove":
      return SelectionChangeType.Remove;
    case "replace":
      return SelectionChangeType.Replace;
    case "clear":
      return SelectionChangeType.Clear;
  }
}
