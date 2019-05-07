/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import { IDisposable, Id64Set, GuidString, Guid, Id64Arg, Id64, Id64Array } from "@bentley/bentleyjs-core";
import { IModelConnection, SelectEventType, ElementLocateManager, IModelApp } from "@bentley/imodeljs-frontend";
import { KeySet, Keys, SelectionScope } from "@bentley/presentation-common";
import ISelectionProvider from "./ISelectionProvider";
import SelectionChangeEvent, { SelectionChangeEventArgs, SelectionChangeType } from "./SelectionChangeEvent";
import { SelectionScopesManager } from "./SelectionScopesManager";

/** Properties for creating [[SelectionManager]] */
export interface SelectionManagerProps {
  /** A manager for [selection scopes]($docs/learning/unified-selection/Terminology#selection-scope) */
  scopes: SelectionScopesManager;
}

/**
 * The selection manager which stores the overall selection
 */
export class SelectionManager implements ISelectionProvider {
  private _selectionContainerMap = new Map<IModelConnection, SelectionContainer>();
  private _imodelToolSelectionSyncHandlers = new Map<IModelConnection, { requestorsCount: number, handler: ToolSelectionSyncHandler }>();

  /** An event which gets broadcasted on selection changes */
  public readonly selectionChange: SelectionChangeEvent;

  /** Manager for [selection scopes]($docs/learning/unified-selection/Terminology#selection-scope) */
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
        this._imodelToolSelectionSyncHandlers.set(imodel, { requestorsCount: 1, handler: new ToolSelectionSyncHandler(imodel, IModelApp.locateManager, this) });
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
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
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
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
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
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
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
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
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
   * Add keys to selection after applying [selection scope]($docs/learning/unified-selection/Terminology#selection-scope) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param ids Element IDs to add
   * @param scope Selection scope to apply
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async addToSelectionWithScope(source: string, imodel: IModelConnection, ids: Id64Arg, scope: SelectionScope | string, level: number = 0, rulesetId?: string): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, ids, scope);
    this.addToSelection(source, imodel, scopedKeys, level, rulesetId);
  }

  /**
   * Remove keys from current selection after applying [selection scope]($docs/learning/unified-selection/Terminology#selection-scope) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param ids Element IDs to remove
   * @param scope Selection scope to apply
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async removeFromSelectionWithScope(source: string, imodel: IModelConnection, ids: Id64Arg, scope: SelectionScope | string, level: number = 0, rulesetId?: string): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, ids, scope);
    this.removeFromSelection(source, imodel, scopedKeys, level, rulesetId);
  }

  /**
   * Replace current selection with keys after applying [selection scope]($docs/learning/unified-selection/Terminology#selection-scope) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param ids Element IDs to replace with
   * @param scope Selection scope to apply
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async replaceSelectionWithScope(source: string, imodel: IModelConnection, ids: Id64Arg, scope: SelectionScope | string, level: number = 0, rulesetId?: string): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, ids, scope);
    this.replaceSelection(source, imodel, scopedKeys, level, rulesetId);
  }
}

/** @hidden */
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

/** @hidden */
export class ToolSelectionSyncHandler implements IDisposable {

  private _selectionSourceName = "Tool";
  private _logicalSelection: SelectionManager;
  private _locateManager: ElementLocateManager;
  private _imodel: IModelConnection;
  private _imodelToolSelectionListenerDisposeFunc: () => void;
  private _asyncsInProgress = new Set<GuidString>();

  public constructor(imodel: IModelConnection, locateManager: ElementLocateManager, logicalSelection: SelectionManager) {
    this._imodel = imodel;
    this._locateManager = locateManager;
    this._logicalSelection = logicalSelection;
    this._imodelToolSelectionListenerDisposeFunc = imodel.selectionSet.onChanged.addListener(this.onToolSelectionChanged);
  }

  public dispose() {
    this._imodelToolSelectionListenerDisposeFunc();
  }

  /** note: used only it tests */
  public get pendingAsyncs() { return this._asyncsInProgress; }

  // tslint:disable-next-line:naming-convention
  private onToolSelectionChanged = async (imodel: IModelConnection, eventType: SelectEventType, ids?: Id64Set): Promise<void> => {
    // this component only cares about its own imodel
    if (imodel !== this._imodel)
      return;

    // determine the level of selection changes
    // wip: may want to allow selecting at different levels?
    const selectionLevel = 0;

    // determine the scope id
    // note: _always_ use "element" scope for fence selection
    let scopeId = getScopeId(this._logicalSelection.scopes.activeScope);
    const isSingleSelectionFromPick = (undefined !== ids
      && 1 === ids.size
      && undefined !== this._locateManager.currHit
      && ids.has(this._locateManager.currHit.sourceId));
    if (!isSingleSelectionFromPick)
      scopeId = "element";

    // we're always using scoped selection changer even if the scope is set to "element" - that
    // makes sure we're adding to selection keys with concrete classes and not "BisCore:Element", which
    // we can't because otherwise our keys compare fails (presentation components load data with
    // concrete classes)
    const changer = new ScopedSelectionChanger(this._selectionSourceName, this._imodel, this._logicalSelection, scopeId);

    // we know what to do immediately on `clear` events
    if (eventType === SelectEventType.Clear) {
      await changer.clear(selectionLevel);
      return;
    }

    const persistentElementIds = getPersistentElementIds(ids!);
    const asyncId = Guid.createValue();
    this._asyncsInProgress.add(asyncId);
    try {
      switch (eventType) {
        case SelectEventType.Add:
          await changer.add(persistentElementIds, selectionLevel);
          break;
        case SelectEventType.Replace:
          await changer.replace(persistentElementIds, selectionLevel);
          break;
        case SelectEventType.Remove:
          await changer.remove(persistentElementIds, selectionLevel);
          break;
      }
    } finally {
      this._asyncsInProgress.delete(asyncId);
    }
  }
}

const getScopeId = (scope: SelectionScope | string | undefined): string => {
  if (!scope)
    return "element";
  if (typeof scope === "string")
    return scope;
  return scope.id;
};

const getPersistentElementIds = (ids: Id64Set): Id64Array | Id64Set => {
  let hasTransients = false;
  for (const id of ids) {
    if (Id64.isTransient(id)) {
      hasTransients = true;
      break;
    }
  }
  if (!hasTransients) {
    // avoid making a copy if there are no transient element ids in
    // the given set
    return ids;
  }

  // if `ids` contain transient ids, we have to copy.. use Array instead of
  // a Set for performance
  const persistentElementIds: Id64Array = [];
  ids.forEach((id) => {
    if (!Id64.isTransient(id))
      persistentElementIds.push(id);
  });
  return persistentElementIds;
};

/** @hidden */
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
  public async add(ids: Id64Array | Id64Set, level: number): Promise<void> {
    await this.manager.addToSelectionWithScope(this.name, this.imodel, ids, this.scope, level);
  }
  public async remove(ids: Id64Array | Id64Set, level: number): Promise<void> {
    await this.manager.removeFromSelectionWithScope(this.name, this.imodel, ids, this.scope, level);
  }
  public async replace(ids: Id64Array | Id64Set, level: number): Promise<void> {
    await this.manager.replaceSelectionWithScope(this.name, this.imodel, ids, this.scope, level);
  }
}
