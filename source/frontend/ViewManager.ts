/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Viewport } from "./Viewport";
import { Cursor } from "./tools/Tool";
import { Event } from "@bentley/bentleyjs-core/lib/Event";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { ToolAdmin } from "./tools/ToolAdmin";
import { EventController } from "./tools/EventController";

/** the ViewManager holds the list of opened views, plus the "selected view" */
export class ViewManager {
  public static readonly instance = new ViewManager();
  public readonly viewports: Viewport[] = [];
  public inDynamicsMode = false;
  public cursor?: Cursor;
  private _selectedView?: Viewport;

  /** Called after the selected view changes.
   * @param old   Previously selected viewport.
   * @param current    Currently selected viewport.
   */
  public readonly onSelectedViewportChanged = new Event<(old: Viewport | undefined, current: Viewport | undefined) => void>();

  /** Called after a view is opened. This can happen when the iModel is first opened or when a user opens a closed view. */
  public readonly onViewOpen = new Event<(vp: Viewport) => void>();

  /** Called after a view is closed. This can happen when the iModel is closed or when a user closes an open view. */
  public readonly onViewClose = new Event<(vp: Viewport) => void>();

  /** Called after a view is suspended. This can happen when the application is minimized. */
  public readonly onViewSuspend = new Event<(vp: Viewport) => void>();

  /** Called after a suspended view is resumed.This can happen when a minimized application is stored
   * or, on a tablet, when the application is moved to the foreground.
   */
  public readonly onViewResume = new Event<(vp: Viewport) => void>();

  /** The "selected view" determines  */
  public get selectedView() { return this._selectedView; }
  public set selectedView(vp: Viewport | undefined) {
    if (!vp)
      vp = this.getFirstOpenView();

    if (vp === this._selectedView) // already the selected view
      return;

    const oldVp = this._selectedView;
    this._selectedView = vp;
    this.onSelectedViewportChanged.raiseEvent(oldVp, vp);
  }

  /** get the first opened view. */
  public getFirstOpenView(): Viewport | undefined { return this.viewports.length > 0 ? this.viewports[0] : undefined; }

  /** Add a new Viewport to the list of opened views. Does nothing if newVp is already present in the list.
   * @param newVp the Viewport to add
   */
  public addViewport(newVp: Viewport): void {
    for (const vp of this.viewports) { if (vp === newVp) return; } // make sure its not already in view array
    newVp.setEventController(new EventController(newVp)); // this will direct events to the viewport
    this.viewports.push(newVp);
    this.onViewOpen.raiseEvent(newVp);
  }

  /** Remove a Viewport from the list of opened views.
   * @param vp the Viewport to remove.
   * @return SUCCESS if vp was successfully removed, ERROR if it was not present.
   */
  public dropViewport(vp: Viewport): BentleyStatus {
    this.onViewClose.raiseEvent(vp);
    ToolAdmin.instance.onViewportClosed(vp); // notify tools that this view is no longer valid

    let didDrop = false;
    const vpList = this.viewports;
    for (let i = 0; i < vpList.length; ++i) {
      if (vpList[i] === vp) {
        vp.setEventController(undefined);
        vpList.slice(i, 1);
        didDrop = true;
        break;
      }
    }

    if (!didDrop)
      return BentleyStatus.ERROR;

    if (this.selectedView === vp) // if removed viewport was selectedView, set it to undefined.
      this.selectedView = undefined;

    return BentleyStatus.SUCCESS;
  }
}
