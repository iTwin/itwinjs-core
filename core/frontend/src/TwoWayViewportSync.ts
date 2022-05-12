/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Viewport } from "./Viewport";

export type SynchronizeViewports = (source: Viewport, target: Viewport) => void;

export function connectViewports(viewports: Iterable<Viewport>, sync: (source: Viewport) => SynchronizeViewports): () => void {
  const disconnect: VoidFunction[] = [];

  let echo = false;
  const synchronize = (source: Viewport) => {
    if (echo)
      return;

    echo = true;
    try {
      const doSync = sync(source);
      for (const vp of viewports)
        if (vp !== source)
          doSync(source, vp);
    } finally {
      echo = false;
    }
  };

  for (const vp of viewports)
    disconnect.push(vp.onViewChanged.addListener(() => synchronize(vp)));

  return () => {
    for (const f of disconnect)
      f();

    disconnect.length = 0;
  };
}

/** Forms a bidirectional connection between two [[Viewport]]s such that the [[ViewState]]s of each are synchronized with one another.
 * For example, panning in one viewport will cause the other viewport to pan by the same distance, and changing the [RenderMode]($common) of one viewport
 * will change it in the other viewport.
 * By default, all aspects of the views - display style, category and model selectors, frustum, etc - are synchronized, but this can be customized by
 * subclassing and overriding the [[syncViewports]] and [[connectViewports]] methods.
 * @see [Multiple Viewport Sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=multi-viewport-sample&imodel=Metrostation+Sample)
 * for an interactive demonstration.
 * @see [[TwoWayViewportFrustumSync]] to synchronize only the frusta of the viewports.
 * @public
 */
export class TwoWayViewportSync {
  protected readonly _disconnect: VoidFunction[] = [];

  /** Invoked from [[connect]] to set up the initial synchronization between the two viewports.
   * `target` should be modified to match `source`.
   * The default implementation applies a clone of `source`'s [[ViewState]] to `target`.
   * @see [[syncViewports]] to customize subsequent synchronization.
   */
  protected connectViewports(source: Viewport, target: Viewport): void {
    const viewState = source.view.clone(target.iModel);
    target.applyViewState(viewState);
  }

  /** Invoked each time `source` changes to update `target` to match.
   * The default implementation applies a clone of `source`'s [[ViewState]] to `target`.
   * @param source The viewport that changed
   * @param target The viewport that should be updated to match `source`
   * @see [[connectViewports]] to set up the initial synchronization between the two viewports.
   */
  protected syncViewports(source: Viewport, target: Viewport): void {
    target.applyViewState(source.view.clone(target.iModel));
  }

  /** Establish the connection between two Viewports. When this method is called, `viewport2` is initialized with the state of `viewport1` via [[connectViewports]].
   * Thereafter, any change to the frustum of either viewport will be reflected in the frustum of the other viewport via [[syncViewports]].
   */
  public connect(viewport1: Viewport, viewport2: Viewport) {
    this.disconnect();

    this.connectViewports(viewport1, viewport2);

    this._disconnect.push(connectViewports([viewport1, viewport2], () => (source, target) => this.syncViewports(source, target)));
  }

  /** Remove the connection between the two views. */
  public disconnect() {
    this._disconnect.forEach((f) => f());
    this._disconnect.length = 0;
  }
}

/** Forms a bidirectional connection between two [[Viewport]]s such that the [Frustum]($common)s of each are synchronized with one another.
 * For example, zooming out in one viewport will zoom out by the same distance in the other viewport.
 * No other aspects of the viewports are synchronized - they may have entirely different display styles, category/model selectors, etc.
 * @see [[TwoWayViewportSync]] to synchronize all aspects of the viewports.
 * @public
 */
export class TwoWayViewportFrustumSync extends TwoWayViewportSync {
  /** @internal override */
  protected override syncViewports(source: Viewport, target: Viewport): void {
    const pose = source.view.savePose();
    const view = target.view.applyPose(pose);
    target.applyViewState(view);
  }

  /** @internal override */
  protected override connectViewports(source: Viewport, target: Viewport): void {
    this.syncViewports(source, target);
  }
}
