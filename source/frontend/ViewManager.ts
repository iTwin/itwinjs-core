/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Viewport } from "./Viewport";
import { Cursor } from "./tools/Tool";

export class ViewManager {
  public static instance = new ViewManager();
  public viewports: Viewport[] = [];
  public active = false;
  public inDynamicsMode = false;
  public cursor?: Cursor;
  private _selectedView?: Viewport;

  public get selectedView() { return this._selectedView; }

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

  // virtual bool _ForceSoftwareRendering() { return false; }
  // DGNVIEW_EXPORT virtual void _NotifySelectedViewportChanged(DgnViewportP, DgnViewportP);
  // DGNVIEW_EXPORT virtual void _NotifyViewOpened(DgnViewportP vp);
  // DGNVIEW_EXPORT virtual void _NotifyViewClosed(DgnViewportP vp);
  // DGNVIEW_EXPORT virtual void _NotifyViewSuspended(DgnViewportP vp);
  // DGNVIEW_EXPORT virtual void _NotifyViewResumed(DgnViewportP vp);
  // DGNVIEW_EXPORT virtual void _NotifyFirstDrawCompleted(DgnViewportP vp);
  // DGNVIEW_EXPORT virtual void _NotifyRenderSceneQueued(DgnViewportP vp);
  // DGNVIEW_EXPORT virtual void _SetViewCursor(Display:: Cursor * newCursor);
  // DGNVIEW_EXPORT virtual BentleyStatus _SetSelectedView(DgnViewportP inVp);
  // DGNVIEW_EXPORT void CheckDeletedModels(TxnManager &);

  // void InitializeRender();
  // void CallDecorators(DecorateContext &);
  // DGNVIEW_EXPORT Display:: InfoWindow & GetInfoWindow() const ;
  // virtual Display:: SystemContext * _GetSystemContext() = 0;

  // public:
  // ViewManager() { }
  // DGNVIEW_EXPORT virtual ~ViewManager();
  // DGNVIEW_EXPORT void Startup();
  // DGNVIEW_EXPORT DgnDbP GetDgnDb() const ;

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

  // BentleyStatus SetSelectedView(DgnViewportP inVp) { return _SetSelectedView(inVp); }
  // DGNVIEW_EXPORT void InvalidateDecorationsAllViews();

  // DGNVIEW_EXPORT DgnViewportP GetFirstOpenView();
  // DGNVIEW_EXPORT void AddViewport(DgnViewportR vp);
  // DGNVIEW_EXPORT StatusInt DropViewport(DgnViewportR);
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
  // DGNVIEW_EXPORT void AddViewMonitor(IViewMonitor *);
  // DGNVIEW_EXPORT void DropViewMonitor(IViewMonitor * sourceToDrop);
}
