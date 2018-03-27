/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { SelectionManager } from "./SelectionManager";
import { SelectedItemsSet } from "./SelectedItemsSet";
import { SelectionChangeEvent, SelectionChangeEventArgs } from "./SelectionChangeEvent";
import { SelectionChangeType } from "./SelectionChangeType";
import { SelectedItem } from "./SelectedItem";
import { IModelToken } from "@bentley/imodeljs-common/lib/IModel";

/** The selection manager which stores the overall selection */
export class SelectionManagerImpl implements SelectionManager {
  public selectionChange: SelectionChangeEvent;
  private _selectionContainerMap: Map<IModelToken, SelectionContainer> = new Map<IModelToken, SelectionContainer>();

  constructor() {
    this.selectionChange = new SelectionChangeEvent();
  }

  private getContainer(imodelToken: IModelToken): SelectionContainer {
    let selectionContainer = this._selectionContainerMap.get(imodelToken);
    if (!selectionContainer) {
      selectionContainer = new SelectionContainer();
      this._selectionContainerMap.set(imodelToken, selectionContainer);
    }
    return selectionContainer;
  }

  public getSelection(imodelToken: IModelToken, level: number = 0): Readonly<SelectedItemsSet> {
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
        {
          for (const key of evt.items)
            selectedItemsSet.add(key);
          break;
        }
      case SelectionChangeType.Remove:
        {
          for (const key of evt.items)
            selectedItemsSet.remove(key);
          break;
        }
      case SelectionChangeType.Replace:
        {
          selectedItemsSet.initFromArray(evt.items);
          break;
        }
      case SelectionChangeType.Clear:
        {
          selectedItemsSet.clear();
          break;
        }
    }
    container.clear(evt.level + 1);

    this.selectionChange.raiseEvent(evt, this);
  }

  public addToSelection(source: string, imodelToken: IModelToken, items: SelectedItem[], level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodelToken,
      changeType: SelectionChangeType.Add,
      items,
      rulesetId,
    };
    this.handleEvent(evt);
  }

  public removeFromSelection(source: string, imodelToken: IModelToken, items: SelectedItem[], level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodelToken,
      changeType: SelectionChangeType.Remove,
      items,
      rulesetId,
    };
    this.handleEvent(evt);
  }

  public replaceSelection(source: string, imodelToken: IModelToken, items: SelectedItem[], level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodelToken,
      changeType: SelectionChangeType.Replace,
      items,
      rulesetId,
    };
    this.handleEvent(evt);
  }

  public clearSelection(source: string, imodelToken: IModelToken, level: number = 0, rulesetId?: string): void {
    const evt: SelectionChangeEventArgs = {
      source,
      level,
      imodelToken,
      changeType: SelectionChangeType.Clear,
      items: [],
      rulesetId,
    };
    this.handleEvent(evt);
  }
}

class SelectionContainer {
  private _selectedItemsSetMap: Map<number, SelectedItemsSet>;

  constructor() {
    this._selectedItemsSetMap = new Map<number, SelectedItemsSet>();
  }

  public getSelection(level: number): SelectedItemsSet {
    let selectedItemsSet = this._selectedItemsSetMap.get(level);
    if (!selectedItemsSet) {
      selectedItemsSet = new SelectedItemsSet();
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
