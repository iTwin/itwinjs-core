/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Viewport } from "./Viewport";

/** Forms a 2-way connection between 2 Viewports of the same iModel, such that any change of the parameters in one will be reflected in the other.
 * For example, Navigator uses this class to synchronize two views for revision comparison.
 * @note It is possible to synchronize two Viewports from two different [[IModelConnection]]s of the same iModel.
 * @beta
 */
export class TwoWayViewportSync {
  private readonly _disconnect: VoidFunction[] = [];
  private _isEcho = false;

  private syncView(source: Viewport, target: Viewport) {
    if (this._isEcho) return;
    this._isEcho = true; // so we don't react to the echo of this sync
    target.applyViewState(source.view.clone(target.iModel));
    this._isEcho = false;
  }

  /** Establish the connection between two Viewports. When this method is called, view2 is initialized with the state of view1. */
  public connect(view1: Viewport, view2: Viewport) {
    this.disconnect();

    const viewState2 = view1.view.clone(view2.iModel); // use view1 as the starting point
    view2.applyViewState(viewState2);

    // listen to the onViewChanged events from both views
    this._disconnect.push(view1.onViewChanged.addListener(() => this.syncView(view1, view2)));
    this._disconnect.push(view2.onViewChanged.addListener(() => this.syncView(view2, view1)));
  }

  /** Remove the connection between the two views. */
  public disconnect() {
    this._disconnect.forEach((f) => f());
    this._disconnect.length = 0;
  }
}
