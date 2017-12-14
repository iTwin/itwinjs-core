/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BeEvent } from "@bentley/bentleyjs-core/lib/BeEvent";
import { Disposable, DisposableList } from "../common/Disposable";
import { ConnectionManager, ConnectionEventArgs } from "./Connections";

export class SelectedItem {
}

/** A set of unique @ref SelectedItem objects. */
export class SelectedItemsSet {
  private _size: number;
  private _dictionary: { [key: string]: SelectedItem };

  /** Constructor. */
  constructor() {
    this._size = 0;
    this._dictionary = {};
  }

  private static toString(item: SelectedItem): string {
    /* @todo:
    switch (item.Type) {
      case NavNodeType.ECInstanceNode:
        {
          const key = <IECInstanceNodeKey>keyBase;
          return "eci_" + key.ECClassId + ":" + key.ECInstanceId;
        }
      default:
        {
          const key = <IGroupingNodeKey>keyBase;
          return key.NodeId;
        }
    }*/
    item;
    return "";
  }

  /** Initializes this set from the supplied array of SelectedItems. */
  public initFromArray(items: SelectedItem[]): void {
    this.clear();
    for (const item of items)
      this.add(item);
  }

  /** Initializes this set from another set of SelectedItems. */
  public initFromSet(set: SelectedItemsSet): void {
    this.clear();
    for (const key in set._dictionary) {
      if (set._dictionary.hasOwnProperty(key))
        this.add(set._dictionary[key]);
    }
  }

  /** Create an array from this set. */
  public asArray(): SelectedItem[] {
    const arr = new Array<SelectedItem>();
    for (const key in this._dictionary) {
      if (this._dictionary.hasOwnProperty(key))
        arr.push(this._dictionary[key]);
    }
    return arr;
  }

  /** @todo: */
  /*public remapNodeIds(remapInfo: { [from: string]: string }): void {
    const IsGroupingNodeKey = (key: SelectedItem): key is IGroupingNodeKey => { return 'NodeId' in key };
    for (let from in remapInfo) {
      let key: SelectedItem = this._dictionary[from];
      if (key && IsGroupingNodeKey(key)) {
        delete this._dictionary[from];
        key.NodeId = remapInfo[from];
        this._dictionary[SelectedItemSet.ToString(key)] = key;
      }
    }
  }*/

  /** Add a new key into this set. */
  public add(key: SelectedItem): void {
    const strKey = SelectedItemsSet.toString(key);
    if (!this._dictionary.hasOwnProperty(strKey)) {
      this._dictionary[strKey] = key;
      ++this._size;
    }
  }

  /** Remove the key from this set. */
  public remove(key: SelectedItem): void {
    const strKey = SelectedItemsSet.toString(key);
    if (this._dictionary.hasOwnProperty(strKey)) {
      delete this._dictionary[strKey];
      --this._size;
    }
  }

  /** Does this set contain the supplied key. */
  public contains(key: SelectedItem): boolean {
    return this._dictionary.hasOwnProperty(SelectedItemsSet.toString(key));
  }

  /** Removed all items from this set. */
  public clear(): void { this._dictionary = {}; this._size = 0; }

  /** Is this set empty. */
  public get isEmpty(): boolean { return 0 === this._size; }

  /** Get the size of this set. */
  public get size(): number { return this._size; }
}

/** The type of selection change */
export enum SelectionChangeType {
  /** Added to selection. */
  Add,

  /** Removed from selection. */
  Remove,

  /** Selection was replaced. */
  Replace,

  /** Selection was cleared. */
  Clear,
}

/** The event object that's sent when the selection changes */
export interface SelectionChangeEventArgs {
  /** The ID of the connection where the selection change happen. */
  connectionId: string;

  /** The name of the selection source which caused the selection change. */
  source: string;

  /** Is this a sub-selection change event. */
  isSubSelection: boolean;

  /** The selection change type. */
  changeType: SelectionChangeType;

  /** The selection affected by this selection change event. */
  items: SelectedItem[];

  /** Any additional presentation-manager specific data. */
  extendedData: any;
}

/** An interface for selection change listeners */
export declare type SelectionChangesListener = (args: SelectionChangeEventArgs) => void;

/** An event broadcasted on selection changes */
export class SelectionChangeEvent extends BeEvent<SelectionChangesListener> { }

/** Selection provider interface which provides main selection and sub-selection */
export interface SelectionProvider {
  /** The main selection. */
  selection: SelectedItemsSet;

  /** The sub-selection. */
  subSelection: SelectedItemsSet;
}

/** Selection manager interface which not only provides selection but can also
 * change it and broadcast selection change events.
 */
export interface SelectionManager extends SelectionProvider {
  /** An event that's broadcasted when selection changes */
  selectionChange: SelectionChangeEvent;

  /** Add to selection.
   * @param[in] connectionId Id of the project, which should handle selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] isSubSelection A flag indicating whether to add to the sub-selection or the main selection.
   * @param[in] items The items to add to selection.
   * @param[in] extendedData The extended data that should be stored in the selection change event.
   */
  addToSelection(connectionId: string, source: string, isSubSelection: boolean, items: SelectedItem[], extendedData: any): void;

  /** Remove from selection.
   * @param[in] connectionId Id of the project, which should handle selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] isSubSelection A flag indicating whether to remove from the sub-selection or the main selection.
   * @param[in] items The items to remove from selection.
   * @param[in] extendedData The extended data that should be stored in the selection change event.
   */
  removeFromSelection(connectionId: string, source: string, isSubSelection: boolean, items: SelectedItem[], extendedData: any): void;

  /** Change selection.
   * @param[in] connectionId Id of the project, which should handle selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] isSubSelection A flag indicating whether to change the sub-selection or the main selection.
   * @param[in] items The items indicating the new selection.
   * @param[in] extendedData The extended data that should be stored in the selection change event.
   */
  replaceSelection(connectionId: string, source: string, isSubSelection: boolean, items: SelectedItem[], extendedData: any): void;

  /** Clear selection.
   * @param[in] connectionId Id of the project, which should handle selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] isSubSelection A flag indicating whether to clear the sub-selection or the main selection.
   * @param[in] extendedData The extended data that should be stored in the selection change event.
   */
  clearSelection(connectionId: string, source: string, isSubSelection: boolean, extendedData: any): void;
}

/** The selection manager which stores the overall selection */
export class SelectionManagerImpl implements Disposable, SelectionManager {
  private _selection: SelectedItemsSet;
  private _subSelection: SelectedItemsSet;
  private _disposables: DisposableList;
  public selectionChange: SelectionChangeEvent;

  /** Constructor.
   * @param[in] connectionManager The connection manager used to listen for connection change
   * events.
   */
  constructor(connectionManager: ConnectionManager) {
    this._selection = new SelectedItemsSet();
    this._subSelection = new SelectedItemsSet();
    this.selectionChange = new SelectionChangeEvent();

    this._disposables = new DisposableList();
    this._disposables.add(connectionManager.connectionClosed.addListener(() => this.onConnectionClose));
  }

  public dispose(): void { this._disposables.dispose(); }

  /** @copydoc SelectionProvider.selection */
  public get selection(): SelectedItemsSet { return this._selection; }

  /** @copydoc SelectionProvider.subSelection */
  public get subSelection(): SelectedItemsSet { return this._subSelection; }

  private handleEvent(evt: SelectionChangeEventArgs): void {
    const container = evt.isSubSelection ? this._subSelection : this._selection;
    switch (evt.changeType) {
      case SelectionChangeType.Add:
        {
          for (const key of evt.items)
            container.add(key);
          break;
        }
      case SelectionChangeType.Remove:
        {
          for (const key of evt.items)
            container.remove(key);
          break;
        }
      case SelectionChangeType.Replace:
        {
          container.initFromArray(evt.items);
          break;
        }
      case SelectionChangeType.Clear:
        {
          container.clear();
          break;
        }
    }
    if (!evt.isSubSelection)
      this._subSelection.clear();

    this.selectionChange.raiseEvent(evt);
  }

  private onConnectionClose(args: ConnectionEventArgs): void {
      const selectionEvent: SelectionChangeEventArgs = {
        connectionId: args.connection.connectionId,
        source: "Unknown",
        isSubSelection: false,
        changeType: SelectionChangeType.Clear,
        items: [],
        extendedData: null,
      };
      this.handleEvent(selectionEvent);
  }

  /** @copydoc SelectionManager.addToSelection */
  public addToSelection(connectionId: string, source: string, isSubSelection: boolean, items: SelectedItem[], extendedData: any): void {
    const evt: SelectionChangeEventArgs = {
      connectionId,
      source,
      isSubSelection,
      changeType: SelectionChangeType.Add,
      items,
      extendedData,
    };
    this.handleEvent(evt);
  }

  /** @copydoc SelectionManager.removeFromSelection */
  public removeFromSelection(connectionId: string, source: string, isSubSelection: boolean, items: SelectedItem[], extendedData: any): void {
    const evt: SelectionChangeEventArgs = {
      connectionId,
      source,
      isSubSelection,
      changeType: SelectionChangeType.Remove,
      items,
      extendedData,
    };
    this.handleEvent(evt);
  }

  /** @copydoc SelectionManager.replaceSelection */
  public replaceSelection(connectionId: string, source: string, isSubSelection: boolean, items: SelectedItem[], extendedData: any): void {
    const evt: SelectionChangeEventArgs = {
      connectionId,
      source,
      isSubSelection,
      changeType: SelectionChangeType.Replace,
      items,
      extendedData,
    };
    this.handleEvent(evt);
  }

  /** @copydoc SelectionManager.clearSelection */
  public clearSelection(connectionId: string, source: string, isSubSelection: boolean, extendedData: any): void {
    const evt: SelectionChangeEventArgs = {
      connectionId,
      source,
      isSubSelection,
      changeType: SelectionChangeType.Clear,
      items: [],
      extendedData,
    };
    this.handleEvent(evt);
  }
}

/** A class that handles selection changes and helps to change the selection */
export abstract class SelectionHandler implements Disposable {
  private _manager: SelectionManager;
  private _inSelect: boolean;
  private _disposables: DisposableList;
  public connectionId: string;
  public name: string;

  /** Constructor.
   * @param[in] name The name of the selection handler.
   */
  constructor(manager: SelectionManager, name: string) {
    this.name = name;
    this._inSelect = false;
    this._manager = manager;
    this._disposables = new DisposableList();
    this._disposables.add(this._manager.selectionChange.addListener(() => this.onSelectionChanged));
  }

  /** Destructor. Must be called before disposing this object to make sure it cleans
   * up correctly.
   */
  public dispose(): void {
    this._disposables.dispose();
  }

  /** Called when the selection changes. Handles this callback by first checking whether
   * the event should be handled at all (see @ref _ShouldHandle) and then calling
   * @ref _Select.
   */
  public onSelectionChanged(evt: SelectionChangeEventArgs, provider: SelectionProvider): void {
    if (!this.shouldHandle(evt))
      return;

    this._inSelect = true;
    this.select(evt, evt.isSubSelection ? provider.subSelection : provider.selection);
    this._inSelect = false;
  }

  /** Called to check whether the event should be handled by this handler.
   * @note Subclasses may want to filter by other event properties in the extended data.
   */
  protected shouldHandle(evt: SelectionChangeEventArgs): boolean {
    if (this.name === evt.source)
      return false;
    return true;
  }

  /** Called to select the provided SelectedItems. Subclasses are responsible for selecting
   * those items in their managed controls.
   */
  protected abstract select(evt: SelectionChangeEventArgs, items: SelectedItemsSet): void;

  /** Supply presentation manager specific extended data for the selection event. */
  protected abstract supplySelectionExtendedData(): any;

  /** Add to selection.
   * @param[in] isSubSelection A flag indicating whether to add to the sub-selection or the main selection.
   * @param[in] items The items to add to selection.
   */
  public addToSelection(isSubSelection: boolean, items: SelectedItem[]): void {
    if (this._inSelect)
      return;

    return this._manager.addToSelection(this.connectionId, this.name, isSubSelection, items, this.supplySelectionExtendedData());
  }

  /** Remove from selection.
   * @param[in] isSubSelection A flag indicating whether to remove from the sub-selection or the main selection.
   * @param[in] items The items to remove from selection.
   */
  public removeFromSelection(isSubSelection: boolean, items: SelectedItem[]): void {
    if (this._inSelect)
      return;

    return this._manager.removeFromSelection(this.connectionId, this.name, isSubSelection, items, this.supplySelectionExtendedData());
  }

  /** Change selection.
   * @param[in] isSubSelection A flag indicating whether to change the sub-selection or the main selection.
   * @param[in] items The items indicating the new selection.
   */
  public replaceSelection(isSubSelection: boolean, items: SelectedItem[]): void {
    if (this._inSelect)
      return;

    return this._manager.replaceSelection(this.connectionId, this.name, isSubSelection, items, this.supplySelectionExtendedData());
  }

  /** Clear selection.
   * @param[in] isSubSelection A flag indicating whether to clear the sub-selection or the main selection.
   */
  public clearSelection(isSubSelection: boolean): void {
    if (this._inSelect)
      return;

    return this._manager.clearSelection(this.connectionId, this.name, isSubSelection, this.supplySelectionExtendedData());
  }
}

class RangeSelectionContainer {
  private _isSelection: boolean;
  private _isSubSelection: boolean = false;
  private _items = new Array<SelectedItem>();
  constructor(isSelection: boolean) {
    this._isSelection = isSelection;
  }
  public get IsSelection(): boolean { return this._isSelection; }
  public get IsSubSelection(): boolean { return this._isSubSelection; }
  public set IsSubSelection(value: boolean) { this._isSubSelection = value; }
  public get Items(): SelectedItem[] { return this._items; }
}

/** A selection handler implementation which can handle range selections.
 * @details Updating selection in ranges (batches) is much more performant as each selection
 * change causes multiple content control updates.
 */
export abstract class RangeSelectionHandler extends SelectionHandler {
  private _rangeSelectionContainer: RangeSelectionContainer | null;
  public isInSelectionChange: boolean;

  /** Constructor.
   * @param[in] selectionSourceName The name of the selection source.
   */
  constructor(manager: SelectionManager, selectionSourceName: string) {
    super(manager, selectionSourceName);
    this._rangeSelectionContainer = null;
    this.isInSelectionChange = false;
  }

  /** Call this function to notify the handler that range selection is started.
   * @param[in] isSelection True if this is a range selection, False if this is deselection.
   */
  public onRangeSelectionStart(isSelection: boolean): void {
    assert(null == this._rangeSelectionContainer, "Range selection container shouldn't exist on range selection start");
    this._rangeSelectionContainer = new RangeSelectionContainer(isSelection);
  }

  /** Call this function to notify the handler that range selection ended.
   * @details Calling this function causes the selection to be actually changed.
   */
  public onRangeSelectionEnd(): void {
    if (null == this._rangeSelectionContainer) {
      assert(false, "Range selection container should exist on range selection end");
      return;
    }

    if (this._rangeSelectionContainer.Items.length > 0) {
      if (this._rangeSelectionContainer.IsSelection) {
        if (this.isInSelectionChange)
          super.replaceSelection(this._rangeSelectionContainer.IsSubSelection, this._rangeSelectionContainer.Items);
        else
          super.addToSelection(this._rangeSelectionContainer.IsSubSelection, this._rangeSelectionContainer.Items);
      } else {
        super.removeFromSelection(this._rangeSelectionContainer.IsSubSelection, this._rangeSelectionContainer.Items);
      }
    } else {
      this.clearSelection(this._rangeSelectionContainer.IsSubSelection);
    }
    this._rangeSelectionContainer = null;
    this.isInSelectionChange = false;
  }

  /** Call this function to dismiss the aggregated selection.
   * @details This function should be called in cases when the range selection is cancelled.
   */
  public dismissSelection(): void {
    this._rangeSelectionContainer = null;
    this.isInSelectionChange = false;
  }

  /** @copydoc SelectionHandler::AddToSelection */
  public addToSelection(isSubSelection: boolean, items: SelectedItem[]): void {
    if (null != this._rangeSelectionContainer) {
      for (const key of items)
        this._rangeSelectionContainer.Items.push(key);
      this._rangeSelectionContainer.IsSubSelection = isSubSelection;
      return;
    }

    if (this.isInSelectionChange) {
      this.isInSelectionChange = false;
      return super.replaceSelection(isSubSelection, items);
    }
    return super.addToSelection(isSubSelection, items);
  }

  /** @copydoc SelectionHandler::RemoveFromSelection */
  public removeFromSelection(isSubSelection: boolean, items: SelectedItem[]): void {
    if (null != this._rangeSelectionContainer) {
      for (const key of items)
        this._rangeSelectionContainer.Items.push(key);
      this._rangeSelectionContainer.IsSubSelection = isSubSelection;
      return;
    }
    return super.removeFromSelection(isSubSelection, items);
  }
}
