/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Viewport } from "./Viewport";
import { Cursor } from "./tools/Tool";
import { EventList, Event } from "@bentley/bentleyjs-core/lib/Event";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { ToolAdmin } from "./tools/ToolAdmin";

export class ViewManager {
  private _viewEvents = new EventList<(vp: Viewport) => void>();
  public static instance = new ViewManager();
  public viewports: Viewport[] = [];
  public active = false;
  public inDynamicsMode = false;
  public cursor?: Cursor;
  private _selectedView?: Viewport;

  /** Called after the selected view changes.
   * @param old   Previously selected viewport.
   * @param current    Currently selected viewport.
   */
  public get onSelectedViewportChanged(): Event<(old: Viewport | undefined, current: Viewport | undefined) => void> { return this._viewEvents.get("selected") as any; }

  /** Called after a view is opened. This can happen when the iModel is first opened or when a user opens a closed view. */

  public get onViewOpen() { return this._viewEvents.get("open"); }

  /** Called after a view is closed. This can happen when the iModel is closed or when a user closes an open view. */
  public get onViewClose() { return this._viewEvents.get("close"); }

  /** Called after a view is suspended. This can happen when the application is minimized. */
  public get onViewSuspend() { return this._viewEvents.get("suspend"); }

  /** Called after a suspended view is resumed.This can happen when a minimized application is stored
   * or, on a tablet, when the application is moved to the foreground.
   */
  public get onViewResume() { return this._viewEvents.get("resume"); }

  public get selectedView() { return this._selectedView; }
  public setSelectedView(vp: Viewport | undefined): BentleyStatus {
    if (!vp)
      vp = this.getFirstOpenView();

    if (vp === this._selectedView)
      return BentleyStatus.SUCCESS;

    if (!vp) {
      this.clearSelectedView();
      return BentleyStatus.ERROR;
    }

    const oldVp = this._selectedView;
    this._selectedView = vp;

    this.onSelectedViewportChanged.raiseEvent(oldVp, vp);
    return BentleyStatus.SUCCESS;
  }

  public getFirstOpenView(): Viewport | undefined { return this.viewports.length > 0 ? this.viewports[0] : undefined; }

  private clearSelectedView(): void {
    const oldVp = this._selectedView;
    this._selectedView = undefined;
    this.onSelectedViewportChanged.raiseEvent(oldVp, undefined);
  }

  public addViewport(newVp: Viewport): void {
    for (const vp of this.viewports) { if (vp === newVp) return; } // make sure its not already in view array
    this.viewports.push(newVp);
    this.onViewOpen.raiseEvent(newVp);
  }

  public dropViewport(vp: Viewport): BentleyStatus {
    this.onViewClose.raiseEvent(vp);
    ToolAdmin.instance.onViewportClosed(vp); // notify tools that this view is no longer valid

    let didDrop = false;
    const vpList = this.viewports;
    for (let i = 0; i < vpList.length; ++i) {
      if (vpList[i] === vp) {
        vpList.slice(i, 1);
        didDrop = true;
        break;
      }
    }

    if (!didDrop) {
      return BentleyStatus.ERROR;
    }

    if (this.selectedView === vp)
      this.setSelectedView(undefined);

    return BentleyStatus.SUCCESS;
  }
}

  //   mutable Display:: InfoWindow * m_infoWindow = nullptr;
  //   EventHandlerList<ViewDecoration> m_decorators;
  //   EventHandlerList<IViewMonitor> m_viewMonitors;
  //   EventHandlerList<IInputDevice> m_inputDev;
  //   BeAtomic<bool> m_newTilesReady;

  //   virtual bool _DoesHostHaveFocus() = 0;
  //   DGNVIEW_EXPORT bool _OnPromptReverseAll() override;
  //   DGNVIEW_EXPORT void _RestartTool() override;
  //   DGNVIEW_EXPORT void _OnNothingToUndo() override;
  //   DGNVIEW_EXPORT void _OnPrepareForUndoRedo() override;
  //   DGNVIEW_EXPORT void _OnNothingToRedo() override;
  //   DGNVIEW_EXPORT void _OnCommit(TxnManager &) override;
  //   DGNVIEW_EXPORT void _OnUndoRedo(TxnManager &, TxnAction) override;
  //   void _OnGraphicElementAdded(DgnDbR db, DgnElementId id) override { if (& db == GetDgnDb()) m_forDraw.insert(id); }
  // void _OnAppliedChanges(TxnManager & mgr) override { CheckDeletedModels(mgr); }

  // DGNVIEW_EXPORT virtual void _SetViewCursor(Display:: Cursor * newCursor);
  // DGNVIEW_EXPORT void CheckDeletedModels(TxnManager &);

  // void InitializeRender();
  // void CallDecorators(DecorateContext &);
  // DGNVIEW_EXPORT Display:: InfoWindow & GetInfoWindow() const ;
  // virtual Display:: SystemContext * _GetSystemContext() = 0;

  // void PickDecorators(PickContextR);
  // void RenderLoop();
  // void BeginDynamicsMode() { m_inDynamicsMode = true; }
  // void EndDynamicsMode();
  // bool InDynamicsMode() const { return m_inDynamicsMode;
  // }
  // void OnGraphicOverrideChanged(DgnElementId id) { m_forChange.insert(id); }

  // DGNVIEW_EXPORT void ShowChanges();
  // DGNVIEW_EXPORT void OnSelectionSetChanged(DgnDbR);
  // DGNVIEW_EXPORT void OnUndisplayedSetChanged(DgnDbR);
  // DGNVIEW_EXPORT bool ExchangeNewTilesReady(bool val);
  // DGNVIEW_EXPORT void ClearSelectedView();

  // DGNVIEW_EXPORT void InvalidateDecorationsAllViews();

  // DGNVIEW_EXPORT void SuspendForBackground();

  // DGNVIEW_EXPORT void AddInputDevice(IInputDevice &);
  // DGNVIEW_EXPORT void DropInputDevice(IInputDevice &);
  // DGNVIEW_EXPORT bool CheckInputDeviceStop();

  // bool DoesHostHaveFocus() { return _DoesHostHaveFocus(); }
  // DGNVIEW_EXPORT static void UpdateCheckstopTime();
  // DGNVIEW_EXPORT static BeTimePoint GetCheckstopTime();
  // DGNVIEW_EXPORT static bool GetHaveTouchDown();
  // DGNVIEW_EXPORT static void SetHaveTouchDown(bool haveDown);

  // DGNVIEW_EXPORT void ShowInfoWindow(DPoint3dCR viewPt, DgnViewportCR, Utf8StringCR, void const* owner = nullptr);
  // DGNVIEW_EXPORT void ShowInfoWindow(DPoint3dCR viewPt, DgnViewportCR, HitDetailCP hit, int detailLevel, void const* owner = nullptr);
  // DGNVIEW_EXPORT bool IsInfoWindowUp() const ;
  // DGNVIEW_EXPORT void ClearInfoWindow();
  // DGNVIEW_EXPORT void const* GetInfoWindowOwner() const ;
  // DGNVIEW_EXPORT bool CheckForUserEvents(UpdateAbort &, StopEvents);
  // DGNVIEW_EXPORT static ViewManagerR GetManager();
  // bool IsGraphicsOn() { return m_active; }

  // DGNVIEW_EXPORT Display:: Cursor * GetCursor(Display:: Cursor:: Id);
  // void SetViewCursor(Display:: Cursor * cursor) { _SetViewCursor(cursor); }
  // Display:: Cursor * GetViewCursorP() { return m_cursor; }
  // Display:: SystemContext * GetSystemContext() { return _GetSystemContext(); }
  // Render:: System * GetRenderSystem();

  // //! @name DgnViewport Event Handlers
  // DGNVIEW_EXPORT void AddViewDecoration(ViewDecoration * decorator);
  // DGNVIEW_EXPORT void DropViewDecoration(ViewDecoration * decorator);
