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
  protected readonly _disconnect: VoidFunction[] = [];
  private _isEcho = false;

  private syncView(source: Viewport, target: Viewport) {
    if (this._isEcho)
      return;

    this._isEcho = true; // so we don't react to the echo of this sync
    this.syncViewports(source, target);
    this._isEcho = false;
  }

  protected syncViewports(source: Viewport, target: Viewport): void {
    target.applyViewState(source.view.clone(target.iModel));
  }

  protected connectViewports(source: Viewport, target: Viewport): void {
    const viewState = source.view.clone(target.iModel);
    target.applyViewState(viewState);
  }

  /** Establish the connection between two Viewports. When this method is called, `view2` is initialized with the state of `view1`.
   * Thereafter, any change to the frustum of either view will be reflected in the frustum of the other view.
   */
  public connect(source: Viewport, target: Viewport) {
    this.disconnect();

    this.connectViewports(source, target);

    // listen to the onViewChanged events from both views
    this._disconnect.push(source.onViewChanged.addListener(() => this.syncView(source, target)));
    this._disconnect.push(target.onViewChanged.addListener(() => this.syncView(target, source)));
  }

  /** Remove the connection between the two views. */
  public disconnect() {
    this._disconnect.forEach((f) => f());
    this._disconnect.length = 0;
  }
}

export class TwoWayViewportFrustumSync extends TwoWayViewportSync {
  protected override syncViewports(source: Viewport, target: Viewport): void {
    const pose = source.view.savePose();
    const view = target.view.applyPose(pose);
    target.applyViewState(view);
  }

  protected override connectViewports(source: Viewport, target: Viewport): void {
    this.syncViewports(source, target);
  }
}
