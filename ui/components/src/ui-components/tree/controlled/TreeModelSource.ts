/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { produce } from "immer";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { MutableTreeModel, TreeModel, VisibleTreeNodes } from "./TreeModel";

/**
 * Controls tree model and visible tree nodes.
 * It is used to modify model and inform when tree model changes.
 * @beta
 */
export class TreeModelSource {
  private _model = new MutableTreeModel();
  private _visibleNodes?: VisibleTreeNodes;

  /** Event that is emitted every time tree model is changed. */
  public onModelChanged = new BeUiEvent<TreeModel>();

  constructor() {
    this.onModelChanged.addListener(() => this._visibleNodes = undefined);
  }

  /**
   * Modifies tree model using provided callback.
   * If changes to tree model is detected then onModelChanged event is emitted.
   */
  public modifyModel(callback: (model: MutableTreeModel) => void): void {
    const newModel = produce(this._model, (draft: MutableTreeModel) => callback(draft));
    if (newModel !== this._model) {
      this._model = newModel;
      this.onModelChanged.emit(this._model);
    }
  }

  /** Returns tree model. */
  public getModel(): TreeModel { return this._model; }

  /** Computes and returns flat list of visible tree nodes. */
  public getVisibleNodes(): VisibleTreeNodes {
    if (!this._visibleNodes) {
      this._visibleNodes = this._model.computeVisibleNodes();
    }

    return this._visibleNodes;
  }
}
