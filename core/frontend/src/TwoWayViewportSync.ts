/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Viewport } from "./Viewport";

/** Forms a bidirectional connection between two [[Viewport]]s such that the [Frustum]($common)s of both Viewports are synchronized.
 * For example, panning in one viewport will cause the other viewport to pan by the same distance.
 * @see [Multiple Viewport Sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=multi-viewport-sample&imodel=Metrostation+Sample)
 * for an interactive demonstration.
 * @public
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

  /** Establish the connection between two Viewports. When this method is called, `view2` is initialized with the state of `view1`.
   * Thereafter, any change to the frustum of either view will be reflected in the frustum of the other view.
   */
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
