/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { produce } from "immer";
import type { PropertyData } from "../PropertyDataProvider";
import type { IMutableFlatGridItem } from "./flat-items/MutableFlatGridItem";
import type { IMutableGridItemFactory } from "./flat-items/MutableGridItemFactory";
import type { IMutablePropertyGridModel, IPropertyGridModel} from "./PropertyGridModel";
import { MutablePropertyGridModel } from "./PropertyGridModel";
import { PropertyGridModelChangeEvent } from "./PropertyGridModelChangeEvent";

/** @beta */
export interface IPropertyGridModelSource {
  onModelChanged: PropertyGridModelChangeEvent;
  setPropertyData: (data: PropertyData) => void;
  modifyModel(callback: (model: IMutablePropertyGridModel) => void): void;
  getModel(): IPropertyGridModel | undefined;
}

/**
 * Controls property grid model.
 * It is used to modify property grid model model and inform when the model changes.
 * @beta
 */
export class PropertyGridModelSource implements IPropertyGridModelSource {
  private _model?: IMutablePropertyGridModel;
  /** Event that is emitted every time property model is changed. */
  public onModelChanged = new PropertyGridModelChangeEvent();

  public constructor(private _gridFactory: IMutableGridItemFactory) {
  }

  private getFullModelMap(fullModel: IMutableFlatGridItem[]): Map<string, IMutableFlatGridItem> {
    const fullModelMap = new Map<string, IMutableFlatGridItem>();
    for (const item of fullModel) {
      const key = item.selectionKey;
      fullModelMap.set(key, item);
    }

    return fullModelMap;
  }

  private moveOldModelState(oldModel: IMutablePropertyGridModel, newModel: IMutablePropertyGridModel) {
    const oldModelMap = this.getFullModelMap(oldModel.getFlatGrid());
    const flatGrid = newModel.getFlatGrid();

    flatGrid.forEach((gridItem) => {
      const oldGridItem = oldModelMap.get(gridItem.selectionKey);
      // istanbul ignore else
      if (oldGridItem)
        gridItem.isExpanded = oldGridItem.isExpanded;
    });
  }

  public setPropertyData(data: PropertyData) {
    const newModel = new MutablePropertyGridModel(data, this._gridFactory);
    if (this._model !== undefined && data.reusePropertyDataState)
      this.moveOldModelState(this._model, newModel);

    this._model = newModel;
    this.onModelChanged.raiseEvent();
  }

  /**
   * Modifies property grid model using provided callback.
   * If changes to model are detected, onModelChanged emits an event to all subscribers.
   */
  public modifyModel(callback: (model: IMutablePropertyGridModel) => void): void {
    if (!this._model)
      return;

    this._model = produce(this._model, callback);
    this.onModelChanged.raiseEvent();
  }

  /** Returns property grid model. */
  public getModel(): IPropertyGridModel | undefined {
    return this._model;
  }
}
