/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { defer, EMPTY, mergeMap, Observable, of, Subject, Subscription, takeUntil, tap } from "rxjs";
import { Id64, Id64Arg, Id64Array, IDisposable, using } from "@itwin/core-bentley";
import { IModelConnection, SelectionSetEvent, SelectionSetEventType } from "@itwin/core-frontend";
import { AsyncTasksTracker, BaseNodeKey, InstanceKey, Key, Keys, KeySet, NodeKey, SelectionScope, SelectionScopeProps } from "@itwin/presentation-common";
import {
  createStorage,
  CustomSelectable,
  Selectable,
  Selectables,
  SelectionStorage,
  StorageSelectionChangeEventArgs,
  StorageSelectionChangeType,
} from "@itwin/unified-selection";
import { Presentation } from "../Presentation";
import { HiliteSet, HiliteSetProvider } from "./HiliteSetProvider";
import { ISelectionProvider } from "./ISelectionProvider";
import { SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType } from "./SelectionChangeEvent";
import { createSelectionScopeProps, SelectionScopesManager } from "./SelectionScopesManager";

/**
 * Properties for creating [[SelectionManager]].
 * @public
 */
export interface SelectionManagerProps {
  /** A manager for [selection scopes]($docs/presentation/unified-selection/index#selection-scopes) */
  scopes: SelectionScopesManager;
  /**
   * Custom unified selection storage to be used by [[SelectionManager]]. If not provided [[SelectionManager]] creates
   * and maintains storage.
   */
  selectionStorage?: SelectionStorage;
}

/**
 * The selection manager which stores the overall selection.
 * @public
 */
export class SelectionManager implements ISelectionProvider {
  private _selectionStorage: SelectionStorage;
  private _imodelToolSelectionSyncHandlers = new Map<IModelConnection, { requestorsCount: number; handler: ToolSelectionSyncHandler }>();
  private _hiliteSetProviders = new Map<IModelConnection, HiliteSetProvider>();
  private _ownsStorage: boolean;

  private _knownIModels = new Map<string, IModelConnection>();
  private _currentSelection = new CurrentSelectionStorage();
  private _selectionChanges = new Subject<StorageSelectionChangeEventArgs>();
  private _selectionEventsSubscription: Subscription;
  private _listeners: Array<() => void> = [];

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
    this._selectionStorage = props.selectionStorage ?? createStorage();
    this._ownsStorage = props.selectionStorage === undefined;
    this._selectionStorage.selectionChangeEvent.addListener((args) => this._selectionChanges.next(args));
    this._selectionEventsSubscription = this.streamSelectionEvents();
    this._listeners.push(
      IModelConnection.onOpen.addListener((imodel) => {
        this._knownIModels.set(imodel.key, imodel);
      }),
    );
    this._listeners.push(
      IModelConnection.onClose.addListener((imodel: IModelConnection) => {
        this.onConnectionClose(imodel);
      }),
    );
  }

  public dispose() {
    this._selectionEventsSubscription.unsubscribe();
    this._listeners.forEach((dispose) => dispose());
  }

  private onConnectionClose(imodel: IModelConnection): void {
    this._hiliteSetProviders.delete(imodel);
    this._knownIModels.delete(imodel.key);
    this._currentSelection.clear(imodel.key);
    if (this._ownsStorage) {
      this.clearSelection("Connection Close Event", imodel);
      this._selectionStorage.clearStorage({ iModelKey: imodel.key });
    }
  }

  /** @internal */
  // istanbul ignore next
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
          registration.handler.dispose();
        }
      }
    }
  }

  /**
   * Temporarily suspends tool selection synchronization until the returned `IDisposable`
   * is disposed.
   */
  public suspendIModelToolSelectionSync(imodel: IModelConnection): IDisposable {
    const registration = this._imodelToolSelectionSyncHandlers.get(imodel);
    if (!registration) {
      return { dispose: () => {} };
    }

    const wasSuspended = registration.handler.isSuspended;
    registration.handler.isSuspended = true;
    return { dispose: () => (registration.handler.isSuspended = wasSuspended) };
  }

  /** Get the selection levels currently stored in this manager for the specified imodel */
  public getSelectionLevels(imodel: IModelConnection): number[] {
    return this._selectionStorage.getSelectionLevels({ iModelKey: imodel.key });
  }

  /**
   * Get the selection currently stored in this manager
   *
   * @note Calling immediately after `add*`|`replace*`|`remove*`|`clear*` method call does not guarantee
   * that returned `KeySet` will include latest changes. Listen for `selectionChange` event to get the
   * latest selection after changes.
   */
  public getSelection(imodel: IModelConnection, level: number = 0): Readonly<KeySet> {
    return this._currentSelection.getSelection(imodel.key, level);
  }

  private handleEvent(evt: SelectionChangeEventArgs): void {
    switch (evt.changeType) {
      case SelectionChangeType.Add:
        this._selectionStorage.addToSelection({
          iModelKey: evt.imodel.key,
          source: evt.source,
          level: evt.level,
          selectables: keysToSelectable(evt.imodel, evt.keys),
        });
        break;
      case SelectionChangeType.Remove:
        this._selectionStorage.removeFromSelection({
          iModelKey: evt.imodel.key,
          source: evt.source,
          level: evt.level,
          selectables: keysToSelectable(evt.imodel, evt.keys),
        });
        break;
      case SelectionChangeType.Replace:
        this._selectionStorage.replaceSelection({
          iModelKey: evt.imodel.key,
          source: evt.source,
          level: evt.level,
          selectables: keysToSelectable(evt.imodel, evt.keys),
        });
        break;
      case SelectionChangeType.Clear:
        this._selectionStorage.clearSelection({ iModelKey: evt.imodel.key, source: evt.source, level: evt.level });
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
          const currentSelectables = this._selectionStorage.getSelection({ iModelKey: args.iModelKey, level: args.level });
          return this._currentSelection.computeSelection(args.iModelKey, args.level, currentSelectables, args.selectables).pipe(
            mergeMap(({ level, changedSelection }): Observable<SelectionChangeEventArgs> => {
              const imodel = this._knownIModels.get(args.iModelKey);
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

/** @internal */
export const TRANSIENT_ELEMENT_CLASSNAME = "/TRANSIENT";

/** @internal */
export class ToolSelectionSyncHandler implements IDisposable {
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

  public dispose() {
    this._imodelToolSelectionListenerDisposeFunc();
  }

  /** note: used only it tests */
  public get pendingAsyncs() {
    return this._asyncsTracker.pendingAsyncs;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
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

    let ids: Id64Arg;
    switch (ev.type) {
      case SelectionSetEventType.Add:
        ids = ev.added;
        break;
      case SelectionSetEventType.Replace:
        ids = ev.set.elements;
        break;
      default:
        ids = ev.removed;
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

    // we know what to do immediately on `clear` events
    if (SelectionSetEventType.Clear === ev.type) {
      await changer.clear(selectionLevel);
      return;
    }

    const parsedIds = parseIds(ids);
    await using(this._asyncsTracker.trackAsyncTask(), async (_r) => {
      switch (ev.type) {
        case SelectionSetEventType.Add:
          await changer.add(parsedIds.transient, parsedIds.persistent, selectionLevel);
          break;
        case SelectionSetEventType.Replace:
          await changer.replace(parsedIds.transient, parsedIds.persistent, selectionLevel);
          break;
        case SelectionSetEventType.Remove:
          await changer.remove(parsedIds.transient, parsedIds.persistent, selectionLevel);
          break;
      }
    });
  };
}

const parseIds = (ids: Id64Arg): { persistent: Id64Arg; transient: Id64Arg } => {
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

function addTransientKeys(transientIds: Id64Arg, keys: KeySet): void {
  for (const id of Id64.iterable(transientIds)) {
    keys.add({ className: TRANSIENT_ELEMENT_CLASSNAME, id });
  }
}

/** @internal */
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
  public async add(transientIds: Id64Arg, persistentIds: Id64Arg, level: number): Promise<void> {
    const keys = await this.manager.scopes.computeSelection(this.imodel, persistentIds, this.scope);
    addTransientKeys(transientIds, keys);
    this.manager.addToSelection(this.name, this.imodel, keys, level);
  }
  public async remove(transientIds: Id64Arg, persistentIds: Id64Arg, level: number): Promise<void> {
    const keys = await this.manager.scopes.computeSelection(this.imodel, persistentIds, this.scope);
    addTransientKeys(transientIds, keys);
    this.manager.removeFromSelection(this.name, this.imodel, keys, level);
  }
  public async replace(transientIds: Id64Arg, persistentIds: Id64Arg, level: number): Promise<void> {
    const keys = await this.manager.scopes.computeSelection(this.imodel, persistentIds, this.scope);
    addTransientKeys(transientIds, keys);
    this.manager.replaceSelection(this.name, this.imodel, keys, level);
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
      // istanbul ignore if
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
    // istanbul ignore else
    if (currEntry) {
      currEntry.ongoingComputationDisposers.delete(disposer);
    }
    this._currentSelection.set(level, {
      value: keys,
      ongoingComputationDisposers: currEntry?.ongoingComputationDisposers ?? /* istanbul ignore next */ new Set(),
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
