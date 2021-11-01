/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { Id64, Id64Arg, Id64Array, IDisposable, using } from "@itwin/core-bentley";
import { IModelConnection, SelectionSetEvent, SelectionSetEventType } from "@itwin/core-frontend";
import { AsyncTasksTracker, Keys, KeySet, SelectionScope } from "@itwin/presentation-common";
import { HiliteSet, HiliteSetProvider } from "./HiliteSetProvider";
import { ISelectionProvider } from "./ISelectionProvider";
import { SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType } from "./SelectionChangeEvent";
import { getScopeId, SelectionScopesManager } from "./SelectionScopesManager";

/**
 * Properties for creating [[SelectionManager]].
 * @public
 */
export interface SelectionManagerProps {
  /** A manager for [selection scopes]($docs/presentation/Unified-Selection/index#selection-scopes) */
  scopes: SelectionScopesManager;
}

/**
 * The selection manager which stores the overall selection.
 * @public
 */
export class SelectionManager implements ISelectionProvider {
  private _selectionContainerMap = new Map<IModelConnection, SelectionContainer>();
  private _imodelToolSelectionSyncHandlers = new Map<IModelConnection, { requestorsCount: number, handler: ToolSelectionSyncHandler }>();
  private _hiliteSetProviders = new Map<IModelConnection, HiliteSetProvider>();

  /** An event which gets broadcasted on selection changes */
  public readonly selectionChange: SelectionChangeEvent;

  /** Manager for [selection scopes]($docs/presentation/Unified-Selection/index#selection-scopes) */
  public readonly scopes: SelectionScopesManager;

  /**
   * Creates an instance of SelectionManager.
   */
  constructor(props: SelectionManagerProps) {
    this.selectionChange = new SelectionChangeEvent();
    this.scopes = props.scopes;
    IModelConnection.onClose.addListener((imodel: IModelConnection) => {
      this.onConnectionClose(imodel);
    });
  }

  private onConnectionClose(imodel: IModelConnection): void {
    this.clearSelection("Connection Close Event", imodel);
    this._selectionContainerMap.delete(imodel);
    this._hiliteSetProviders.delete(imodel);
  }

  private getContainer(imodel: IModelConnection): SelectionContainer {
    let selectionContainer = this._selectionContainerMap.get(imodel);
    if (!selectionContainer) {
      selectionContainer = new SelectionContainer();
      this._selectionContainerMap.set(imodel, selectionContainer);
    }
    return selectionContainer;
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
    if (!registration)
      return { dispose: () => { } };

    const wasSuspended = registration.handler.isSuspended;
    registration.handler.isSuspended = true;
    return { dispose: () => (registration.handler.isSuspended = wasSuspended) };
  }

  /** Get the selection levels currently stored in this manager for the specified imodel */
  public getSelectionLevels(imodel: IModelConnection): number[] {
    return this.getContainer(imodel).getSelectionLevels();
  }

  /** Get the selection currently stored in this manager */
  public getSelection(imodel: IModelConnection, level: number = 0): Readonly<KeySet> {
    return this.getContainer(imodel).getSelection(level);
  }

  private handleEvent(evt: SelectionChangeEventArgs): void {
    const container = this.getContainer(evt.imodel);
    const selectedItemsSet = container.getSelection(evt.level);
    const guidBefore = selectedItemsSet.guid;
    switch (evt.changeType) {
      case SelectionChangeType.Add:
        selectedItemsSet.add(evt.keys);
        break;
      case SelectionChangeType.Remove:
        selectedItemsSet.delete(evt.keys);
        break;
      case SelectionChangeType.Replace:
        if (selectedItemsSet.size !== evt.keys.size || !selectedItemsSet.hasAll(evt.keys)) {
          // note: the above check is only needed to avoid changing
          // guid of the keyset if we're replacing keyset with the same keys
          selectedItemsSet.clear().add(evt.keys);
        }
        break;
      case SelectionChangeType.Clear:
        selectedItemsSet.clear();
        break;
    }

    if (selectedItemsSet.guid === guidBefore)
      return;

    container.clear(evt.level + 1);
    this.selectionChange.raiseEvent(evt, this);
  }

  /**
   * Add keys to the selection
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param keys Keys to add
   * @param level Selection level (see [Selection levels]($docs/presentation/Unified-Selection/index#selection-levels))
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
   * @param level Selection level (see [Selection levels]($docs/presentation/Unified-Selection/index#selection-levels))
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
   * @param level Selection level (see [Selection levels]($docs/presentation/Unified-Selection/index#selection-levels))
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
   * @param level Selection level (see [Selection levels]($docs/presentation/Unified-Selection/index#selection-levels))
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
   * Add keys to selection after applying [selection scope]($docs/presentation/Unified-Selection/index#selection-scopes) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param ids Element IDs to add
   * @param scope Selection scope to apply
   * @param level Selection level (see [Selection levels]($docs/presentation/Unified-Selection/index#selection-levels))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async addToSelectionWithScope(source: string, imodel: IModelConnection, ids: Id64Arg, scope: SelectionScope | string, level: number = 0, rulesetId?: string): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, ids, scope);
    this.addToSelection(source, imodel, scopedKeys, level, rulesetId);
  }

  /**
   * Remove keys from current selection after applying [selection scope]($docs/presentation/Unified-Selection/index#selection-scopes) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param ids Element IDs to remove
   * @param scope Selection scope to apply
   * @param level Selection level (see [Selection levels]($docs/presentation/Unified-Selection/index#selection-levels))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async removeFromSelectionWithScope(source: string, imodel: IModelConnection, ids: Id64Arg, scope: SelectionScope | string, level: number = 0, rulesetId?: string): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, ids, scope);
    this.removeFromSelection(source, imodel, scopedKeys, level, rulesetId);
  }

  /**
   * Replace current selection with keys after applying [selection scope]($docs/presentation/Unified-Selection/index#selection-scopes) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param ids Element IDs to replace with
   * @param scope Selection scope to apply
   * @param level Selection level (see [Selection levels]($docs/presentation/Unified-Selection/index#selection-levels))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async replaceSelectionWithScope(source: string, imodel: IModelConnection, ids: Id64Arg, scope: SelectionScope | string, level: number = 0, rulesetId?: string): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, ids, scope);
    this.replaceSelection(source, imodel, scopedKeys, level, rulesetId);
  }

  /**
   * Get the current hilite set for the specified imodel
   * @public
   */
  public async getHiliteSet(imodel: IModelConnection): Promise<HiliteSet> {
    let provider = this._hiliteSetProviders.get(imodel);
    if (!provider) {
      provider = HiliteSetProvider.create({ imodel });
      this._hiliteSetProviders.set(imodel, provider);
    }
    return provider.getHiliteSet(this.getSelection(imodel));
  }
}

/** @internal */
class SelectionContainer {
  private readonly _selectedItemsSetMap: Map<number, KeySet>;

  constructor() {
    this._selectedItemsSetMap = new Map<number, KeySet>();
  }

  public getSelection(level: number): KeySet {
    let selectedItemsSet = this._selectedItemsSetMap.get(level);
    if (!selectedItemsSet) {
      selectedItemsSet = new KeySet();
      this._selectedItemsSetMap.set(level, selectedItemsSet);
    }
    return selectedItemsSet;
  }

  public getSelectionLevels(): number[] {
    const levels = new Array<number>();
    for (const entry of this._selectedItemsSetMap.entries()) {
      if (!entry[1].isEmpty)
        levels.push(entry[0]);
    }
    return levels.sort();
  }

  public clear(level: number) {
    const keys = this._selectedItemsSetMap.keys();
    for (const key of keys) {
      if (key >= level) {
        const selectedItemsSet = this._selectedItemsSetMap.get(key)!;
        selectedItemsSet.clear();
      }
    }
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
  public get pendingAsyncs() { return this._asyncsTracker.pendingAsyncs; }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onToolSelectionChanged = async (ev: SelectionSetEvent): Promise<void> => {
    // ignore selection change event if the handler is suspended
    if (this.isSuspended)
      return;

    // this component only cares about its own imodel
    const imodel = ev.set.iModel;
    if (imodel !== this._imodel)
      return;

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

    const scopeId = getScopeId(this._logicalSelection.scopes.activeScope);

    // we're always using scoped selection changer even if the scope is set to "element" - that
    // makes sure we're adding to selection keys with concrete classes and not "BisCore:Element", which
    // we can't because otherwise our keys compare fails (presentation components load data with
    // concrete classes)
    const changer = new ScopedSelectionChanger(this._selectionSourceName, this._imodel, this._logicalSelection, scopeId);

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

const parseIds = (ids: Id64Arg): { persistent: Id64Arg, transient: Id64Arg } => {
  let allPersistent = true;
  let allTransient = true;
  for (const id of Id64.iterable(ids)) {
    if (Id64.isTransient(id))
      allPersistent = false;
    else
      allTransient = false;

    if (!allPersistent && !allTransient)
      break;
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
    if (Id64.isTransient(id))
      transientElementIds.push(id);
    else
      persistentElementIds.push(id);
  }

  return { persistent: persistentElementIds, transient: transientElementIds };
};

function addTransientKeys(transientIds: Id64Arg, keys: KeySet): void {
  for (const id of Id64.iterable(transientIds))
    keys.add({ className: TRANSIENT_ELEMENT_CLASSNAME, id });
}

/** @internal */
class ScopedSelectionChanger {
  public readonly name: string;
  public readonly imodel: IModelConnection;
  public readonly manager: SelectionManager;
  public readonly scope: SelectionScope | string;
  public constructor(name: string, imodel: IModelConnection, manager: SelectionManager, scope: SelectionScope | string) {
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
