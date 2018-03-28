/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet, Keys } from "@bentley/ecpresentation-common";
import { SelectionManager } from "./SelectionManager";
import { SelectionChangeType, SelectionChangeEvent, SelectionChangeEventArgs } from "./SelectionChangeEvent";

/** The selection manager which stores the overall selection */
export class SelectionManagerImpl implements SelectionManager {
  public selectionChange: SelectionChangeEvent;
  private _selectionContainerMap = new Map<Readonly<IModelToken>, SelectionContainer>();

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

  public getSelection(imodelToken: Readonly<IModelToken>, level: number = 0): Readonly<KeySet> {
    return this.getContainer(imodelToken).getSelection(level);
  }

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
        const selectedItemsSet = this._selectedItemsSetMap.get(key);
        if (selectedItemsSet)
          selectedItemsSet.clear();
      }
    }
  }
}
