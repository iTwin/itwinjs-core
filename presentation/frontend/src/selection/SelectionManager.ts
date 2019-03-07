/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import { EntityProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
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
   * @param keys Keys to add
   * @param scope Selection scope to apply
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async addToSelectionWithScope(source: string, imodel: IModelConnection, keys: EntityProps | EntityProps[], scope: SelectionScope | string, level: number = 0, rulesetId?: string): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, keys, scope);
    this.addToSelection(source, imodel, scopedKeys, level, rulesetId);
  }

  /**
   * Remove keys from current selection after applying [selection scope]($docs/learning/unified-selection/Terminology#selection-scope) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param keys Keys to remove
   * @param scope Selection scope to apply
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async removeFromSelectionWithScope(source: string, imodel: IModelConnection, keys: EntityProps | EntityProps[], scope: SelectionScope | string, level: number = 0, rulesetId?: string): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, keys, scope);
    this.removeFromSelection(source, imodel, scopedKeys, level, rulesetId);
  }

  /**
   * Replace current selection with keys after applying [selection scope]($docs/learning/unified-selection/Terminology#selection-scope) on them.
   * @param source Name of the selection source
   * @param imodel iModel associated with the selection
   * @param keys Keys to add
   * @param scope Selection scope to apply
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public async replaceSelectionWithScope(source: string, imodel: IModelConnection, keys: EntityProps | EntityProps[], scope: SelectionScope | string, level: number = 0, rulesetId?: string): Promise<void> {
    const scopedKeys = await this.scopes.computeSelection(imodel, keys, scope);
    this.replaceSelection(source, imodel, scopedKeys, level, rulesetId);
  }
}

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
