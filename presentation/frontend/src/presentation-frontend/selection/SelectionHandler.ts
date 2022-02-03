/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

import type { IDisposable } from "@itwin/core-bentley";
import { DisposableList } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Keys, KeySet } from "@itwin/presentation-common";
import type { ISelectionProvider } from "./ISelectionProvider";
import type { SelectionChangeEventArgs, SelectionChangesListener } from "./SelectionChangeEvent";
import type { SelectionManager } from "./SelectionManager";

/**
 * Properties for creating a `SelectionHandler` instance.
 * @public
 */
export interface SelectionHandlerProps {
  /** SelectionManager used to store overall selection. */
  manager: SelectionManager;
  /** iModel connection the selection changes will be associated with. */
  imodel: IModelConnection;
  /**
   * Name of the selection handler. This is an identifier of what caused the
   * selection to change, set as `SelectionChangeEventArgs.source` when firing
   * selection change events. `SelectionHandler.shouldHandle` uses `name` to filter
   * events that it doesn't need to handle.
   */
  name: string;
  /**
   * ID of presentation ruleset used by the component using this handler. The ID is set as
   * `SelectionChangeEventArgs.rulesetId` when making selection changes and event
   * listeners can use or ignore this information.
   */
  rulesetId?: string;
  /** Callback function called when selection changes. */
  onSelect?: SelectionChangesListener;
}

/**
 * A class that handles selection changes and helps to change
 * internal the selection state.
 *
 * @public
 */
export class SelectionHandler implements IDisposable {
  private _inSelect: boolean;
  private _disposables: DisposableList;

  /** Selection manager used by this handler to manage selection */
  public readonly manager: SelectionManager;
  /** Name that's used as `SelectionChangeEventArgs.source` when making selection changes */
  public name: string;
  /** iModel whose selection is being handled */
  public imodel: IModelConnection;
  /**
   * Id of a ruleset selection changes will be associated with.
   * @see `SelectionHandlerProps.rulesetId`
   */
  public rulesetId?: string;
  /** Callback function called when selection changes */
  public onSelect?: SelectionChangesListener;

  /**
   * Constructor.
   */
  constructor(props: SelectionHandlerProps) {
    this._inSelect = false;
    this.manager = props.manager;
    this._disposables = new DisposableList();
    this.name = props.name;
    this.rulesetId = props.rulesetId;
    this.imodel = props.imodel;
    this.onSelect = props.onSelect;
    this._disposables.add(this.manager.selectionChange.addListener(this.onSelectionChanged));
  }

  /**
   * Destructor. Must be called before disposing this object to make sure it cleans
   * up correctly.
   */
  public dispose(): void {
    this._disposables.dispose();
  }

  /**
   * Called when the selection changes. Handles this callback by first checking whether
   * the event should be handled at all (using the `shouldHandle` method) and then calling `onSelect`
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected onSelectionChanged = (evt: SelectionChangeEventArgs, provider: ISelectionProvider): void => {
    if (!this.onSelect || !this.shouldHandle(evt))
      return;

    this._inSelect = true;
    this.onSelect(evt, provider);
    this._inSelect = false;
  };

  /** Called to check whether the event should be handled by this handler */
  protected shouldHandle(evt: SelectionChangeEventArgs): boolean {
    if (this.name === evt.source)
      return false;
    return true;
  }

  /** Get selection levels for the imodel managed by this handler */
  public getSelectionLevels(): number[] {
    return this.manager.getSelectionLevels(this.imodel);
  }

  /**
   * Get selection for the imodel managed by this handler.
   * @param level Level of the selection to get. Defaults to 0.
   */
  public getSelection(level?: number): Readonly<KeySet> {
    return this.manager.getSelection(this.imodel, level);
  }

  /**
   * Add to selection.
   * @param keys The keys to add to selection.
   * @param level Level of the selection.
   */
  public addToSelection(keys: Keys, level: number = 0): void {
    if (this._inSelect)
      return;

    return this.manager.addToSelection(this.name, this.imodel, keys, level, this.rulesetId);
  }

  /**
   * Remove from selection.
   * @param keys The keys to remove from selection.
   * @param level Level of the selection.
   */
  public removeFromSelection(keys: Keys, level: number = 0): void {
    if (this._inSelect)
      return;

    return this.manager.removeFromSelection(this.name, this.imodel, keys, level, this.rulesetId);
  }

  /**
   * Change selection.
   * @param keys The keys indicating the new selection.
   * @param level Level of the selection.
   */
  public replaceSelection(keys: Keys, level: number = 0): void {
    if (this._inSelect)
      return;

    return this.manager.replaceSelection(this.name, this.imodel, keys, level, this.rulesetId);
  }

  /**
   * Clear selection.
   * @param level Level of the selection.
   */
  public clearSelection(level: number = 0): void {
    if (this._inSelect)
      return;

    return this.manager.clearSelection(this.name, this.imodel, level, this.rulesetId);
  }
}
