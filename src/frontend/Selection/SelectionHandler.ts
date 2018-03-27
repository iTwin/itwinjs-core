/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { SelectionManager } from "./SelectionManager";
import { IDisposable, DisposableList } from "@bentley/bentleyjs-core/lib/Disposable";
import { SelectedItem } from "./SelectedItem";
import { SelectionChangeEventArgs, SelectionChangesListener } from "./SelectionChangeEvent";
import { SelectionProvider } from "./SelectionProvider";
import { IModelToken } from "@bentley/imodeljs-common/lib/IModel";

/** A class that handles selection changes and helps to change the selection */
export class SelectionHandler implements IDisposable {
  private _manager: SelectionManager;
  private _inSelect: boolean;
  private _disposables: DisposableList;
  public onSelect?: SelectionChangesListener;
  public name: string;
  public rulesetId: string;
  public imodelToken: IModelToken;

  /** Constructor.
   * @param[in] manager SelectionManager used to store overall selection.
   * @param[in] name The name of the selection handler.
   * @param[in] rulesetId Id of a ruleset selection changes will be associated.
   * @param[in] imodelToken Token of the imodel connection with which the selection changes will be associated.
   * @param[in] onSelect Callback function called when selection changes.
   */
  constructor(manager: SelectionManager, name: string, rulesetId: string, imodelToken: IModelToken, onSelect?: SelectionChangesListener) {
    this.name = name;
    this._inSelect = false;
    this._manager = manager;
    this._disposables = new DisposableList();
    this.rulesetId = rulesetId;
    this.onSelect = onSelect;
    this.imodelToken = imodelToken;
    if (onSelect)
      this._disposables.add(this._manager.selectionChange.addListener(this.onSelectionChanged, this));
  }

  /** Destructor. Must be called before disposing this object to make sure it cleans
   * up correctly.
   */
  public dispose(): void {
    this._disposables.dispose();
  }

  /** Called when the selection changes. Handles this callback by first checking whether
   * the event should be handled at all (see @ref shouldHandle) and then calling onSelect
   */
  protected onSelectionChanged(evt: SelectionChangeEventArgs, provider: SelectionProvider): void {
    if (!this.shouldHandle(evt) || !this.onSelect)
      return;

    this._inSelect = true;
    this.onSelect(evt, provider);
    this._inSelect = false;
  }

  /** Called to check whether the event should be handled by this handler.
   */
  protected shouldHandle(evt: SelectionChangeEventArgs): boolean {
    if (this.name === evt.source)
      return false;
    return true;
  }

  /** Add to selection.
   * @param[in] items The items to add to selection.
   * @param[in] level Level of the selection.
   */
  public addToSelection(items: SelectedItem[], level: number = 0): void {
    if (this._inSelect)
      return;

    return this._manager.addToSelection(this.name, this.imodelToken, items, level, this.rulesetId);
  }

  /** Remove from selection.
   * @param[in] items The items to remove from selection.
   * @param[in] level Level of the selection.
   */
  public removeFromSelection(items: SelectedItem[], level: number = 0): void {
    if (this._inSelect)
      return;

    return this._manager.removeFromSelection(this.name, this.imodelToken, items, level, this.rulesetId);
  }

  /** Change selection.
   * @param[in] level Level of the selection.
   * @param[in] items The items indicating the new selection.
   */
  public replaceSelection(items: SelectedItem[], level: number = 0): void {
    if (this._inSelect)
      return;

    return this._manager.replaceSelection(this.name, this.imodelToken, items, level, this.rulesetId);
  }

  /** Clear selection.
   * @param[in] level Level of the selection.
   */
  public clearSelection(level: number = 0): void {
    if (this._inSelect)
      return;

    return this._manager.clearSelection(this.name, this.imodelToken, level, this.rulesetId);
  }
}
