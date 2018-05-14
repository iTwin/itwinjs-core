/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet, Keys } from "@bentley/ecpresentation-common";
import ISelectionProvider from "./ISelectionProvider";
import SelectionChangeEvent, { SelectionChangeEventArgs, SelectionChangeType } from "./SelectionChangeEvent";

/**
 * The selection manager which stores the overall selection
 */
export default class SelectionManager implements ISelectionProvider {
  private _selectionContainerMap = new Map<Readonly<IModelToken>, SelectionContainer>();

  /** An event which gets broadcasted on selection changes */
  public selectionChange: SelectionChangeEvent;

  /**
   * Creates an instance of SelectionManager.
   */
  constructor() {
    this.selectionChange = new SelectionChangeEvent();
  }

  private getContainer(imodelToken: Readonly<IModelToken>): SelectionContainer {
    let selectionContainer = this._selectionContainerMap.get(imodelToken);
    if (!selectionContainer) {
      selectionContainer = new SelectionContainer();
      this._selectionContainerMap.set(imodelToken, selectionContainer);
    }
    return selectionContainer;
  }

  /** Get the selection currently stored in this manager */
  public getSelection(imodelToken: Readonly<IModelToken>, level: number = 0): Readonly<KeySet> {
    return this.getContainer(imodelToken).getSelection(level);
  }

  // WIP: subscribe to IModelConnection.onIModelClose even when it becomes available
  // private onConnectionClose(imodelConnection: IModelConnection): void {
  //   this.clearSelection("Connection Close Event", 0, imodelConnection.iModelToken);
  //   this._selectionContainerMap.delete(imodelConnection.iModelToken);
  // }

  private handleEvent(evt: SelectionChangeEventArgs): void {
    const container = this.getContainer(evt.imodelToken);
    const selectedItemsSet = container.getSelection(evt.level);
    switch (evt.changeType) {
      case SelectionChangeType.Add:
        selectedItemsSet.add(evt.keys);
        break;
      case SelectionChangeType.Remove:
        selectedItemsSet.delete(evt.keys);
        break;
      case SelectionChangeType.Replace:
        selectedItemsSet.clear().add(evt.keys);
        break;
      case SelectionChangeType.Clear:
        selectedItemsSet.clear();
        break;
    }
    container.clear(evt.level + 1);

    this.selectionChange.raiseEvent(evt, this);
  }

  /**
   * Add keys to the selection
   * @param source Name of the selection source
   * @param imodelToken IModelToken of the iModel associated with the selection
   * @param keys Keys to add
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public addToSelection(source: string, imodelToken: Readonly<IModelToken>, keys: Keys, level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodelToken,
      changeType: SelectionChangeType.Add,
      keys: new KeySet(keys),
      rulesetId,
    };
    this.handleEvent(evt);
  }

  /**
   * Remove keys from current selection
   * @param source Name of the selection source
   * @param imodelToken IModelToken of the iModel associated with the selection
   * @param keys Keys to remove
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public removeFromSelection(source: string, imodelToken: Readonly<IModelToken>, keys: Keys, level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodelToken,
      changeType: SelectionChangeType.Remove,
      keys: new KeySet(keys),
      rulesetId,
    };
    this.handleEvent(evt);
  }

  /**
   * Replace current selection
   * @param source Name of the selection source
   * @param imodelToken IModelToken of the iModel associated with the selection
   * @param keys Keys to add
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public replaceSelection(source: string, imodelToken: Readonly<IModelToken>, keys: Keys, level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodelToken,
      changeType: SelectionChangeType.Replace,
      keys: new KeySet(keys),
      rulesetId,
    };
    this.handleEvent(evt);
  }

  /**
   * Clear current selection
   * @param source Name of the selection source
   * @param imodelToken IModelToken of the iModel associated with the selection
   * @param level Selection level (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   * @param rulesetId ID of the ruleset in case the selection was changed from a rules-driven control
   */
  public clearSelection(source: string, imodelToken: Readonly<IModelToken>, level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodelToken,
      changeType: SelectionChangeType.Clear,
      keys: new KeySet(),
      rulesetId,
    };
    this.handleEvent(evt);
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
