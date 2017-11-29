/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ToolAdmin, CoordinateLockOverrides } from "./ToolAdmin";
import { PrimitiveToolBase, ButtonEvent } from "./Tool";
import { Viewport } from "../Viewport";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { ViewManager } from "../ViewManager";

// tslint:disable:no-empty

const toolAdmin = ToolAdmin.instance;
const viewManager = ViewManager.instance;

/**
 * The PrimitiveTool class can be used to implement a primitive command. Placement
 * tools that don't need to locate or modify elements are good candidates for a PrimitiveTool.
 */
export abstract class PrimitiveTool extends PrimitiveToolBase {

  /** Called by InstallTool to setup tool instance as the current active primitive command.
   *  @return SUCCESS if new tool instance is now the active primitive command.
   *  @see Tool.installTool Tool.onInstall Tool.onPostInstall
   *  @private
   */
  public installToolImplementation(): BentleyStatus {
    if (this.isCompatibleViewport(viewManager.selectedView, false) || !toolAdmin.onInstallTool(this))
      return BentleyStatus.ERROR;

    toolAdmin.startPrimitiveTool(this);
    toolAdmin.setPrimitiveTool(this);

    // The tool may exit in onPostInstall causing "this" to be
    // deleted so installToolImplementation must not call any
    // methods on "this" after _OnPostInstall returns.
    toolAdmin.onPostInstallTool(this);

    return BentleyStatus.SUCCESS;
  }

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean {
    if (!vp)
      return false;
    const view = vp.view;
    const iModel = view.iModel;
    if (this.requireWriteableTarget()) {
      if (iModel.isReadonly())
        return false; // Tool can't be used when DgnDb is read only.

      // IBriefcaseManager:: Request req;
      // req.Locks().Insert(db, LockLevel:: Shared);
      // if (!db.BriefcaseManager().AreResourcesAvailable(req, nullptr, IBriefcaseManager:: FastQuery:: Yes))
      //   return false;   // another briefcase has locked the db for editing
    }

    if (!this.targetView)
      this.targetView = vp;
    else if (iModel !== this.getIModel())
      return false; // Once a ViewController has been established, only accept views for the same DgnDb by default.

    if (!this.targetIsLocked) {
      if (isSelectedViewChange)
        this.targetView = vp; // Update target to newly selected view.

      return true; // Any type of model/view is still ok and target is still free to change.
    }

    if (this.targetModelId.isValid() && !view.viewsModel(this.targetModelId))
      return false; // Only allow view where target is being viewed.

    // if (_RequireWriteableTarget()) {
    //   IBriefcaseManager:: Request req;
    //   req.Locks().Insert(* targetModel, LockLevel:: Shared);
    //   if (!db.BriefcaseManager().AreResourcesAvailable(req, nullptr, IBriefcaseManager:: FastQuery:: Yes))
    //     return false; // another briefcase has locked the model for editing
    // }

    return true;
  }

  /**
   * Checks that the adjusted point from the supplied button event is within the project extents for spatial views. The range of physical geometry
   * should always be fully inside the project extents. Only checking the adjusted point won't absolutely guarantee that a tool doesn't create/move geometry
   * outside the project extents, but it will be sufficient to handle most cases and provide good feedback to the user.
   * @return true if ev is acceptable.
   */
  public isValidLocation(ev: ButtonEvent, isButtonEvent: boolean) {
    const vp = ev.viewport;
    if (!vp)
      return false;

    const view = vp.view;
    const iModel = view.iModel;
    if (!view.isSpatialView() || iModel.isReadonly() || !this.requireWriteableTarget())
      return true;

    // NOTE: If points aren't being adjusted then the tool shouldn't be creating geometry currently (ex. locating elements) and we shouldn't filter point...
    if (0 !== (toolAdmin.toolState.coordLockOvr & CoordinateLockOverrides.OVERRIDE_COORDINATE_LOCK_ACS))
      return true;

    const extents = iModel.extents;
    if (extents.containsPoint(ev.point))
      return true;

    if (isButtonEvent && ev.isDown) {
      //   NotificationManager:: OutputMessage(NotifyMessageDetails(OutputMessagePriority:: Error, DgnViewL10N:: GetString(DgnViewL10N:: ELEMENTSETTOOL_ERROR_ProjectExtents()).c_str()));
    }

    return false;
  }

  public exitTool(): void { toolAdmin.startDefaultTool(); }

  /**
   * Called to revert to a previous tool state (ex. undo last data button).
   * @return false to instead reverse the most recent transaction.
   */
  public onUndoPreviousStep(): boolean { return false; }

  // Tools need to call SaveChanges to commit any elements they have added/changes they have made.
  // This helper method supplies the tool name for the undo string to DgnDb::SaveChanges.
  // BeSQLite:: DbResult SaveChanges() { return GetDgnDb().SaveChanges(GetLocalizedToolName().c_str()); }

  // //! Ensures that any locks and/or codes required for the operation are obtained from DgnDbServer before making any changes to the DgnDb.
  // //! Default implementation invokes _PopulateRequest() and forwards request to server.
  // DGNVIEW_EXPORT virtual RepositoryStatus _AcquireLocks();

  // //! Called from _AcquireLocks() to identify any locks and/or codes required to perform the operation
  // virtual RepositoryStatus _PopulateRequest(IBriefcaseManager:: Request & request) { return RepositoryStatus:: Success; }

  // //! Query availability of locks, potentially notifying user of result
  // DGNVIEW_EXPORT bool AreLocksAvailable(IBriefcaseManager:: Request & request, DgnDbR db, bool fastQuery = true);

  // //! Acquire locks on this tools behalf, potentially notifying user of result
  // DGNVIEW_EXPORT RepositoryStatus AcquireLocks(IBriefcaseManager:: Request & request, DgnDbR db);

  // //! Acquire a shared lock on the specified model (e.g., for placement tools which create new elements)
  // DGNVIEW_EXPORT RepositoryStatus LockModelForPlacement(DgnModelR model);

  // //! Acquires any locks and/or codes required to perform the specified operation on the element
  // //! If your tool operates on more than one element it should batch all such requests rather than calling this convenience function repeatedly.
  // DGNVIEW_EXPORT RepositoryStatus LockElementForOperation(DgnElementCR element, BeSQLite:: DbOpcode operation);

  // //! Call to find out of complex dynamics are currently active.
  // //! @return true if dynamics have been started.
  // DGNVIEW_EXPORT bool GetDynamicsStarted();

  // //! Call to initialize complex dynamics.
  // //! @see #_OnDynamicFrame
  // DGNVIEW_EXPORT virtual void _BeginDynamics();

  // //! Call to terminate complex dynamics.
  // //! @see #_OnDynamicFrame
  // DGNVIEW_EXPORT virtual void _EndDynamics();

  // //! Called to display dynamic elements.
  // virtual void _OnDynamicFrame(DgnButtonEventCR, DynamicsContextR) { }

  public callOnRestartTool(): void { this.onRestartTool(); }
  public undoPreviousStep(): boolean {
    if (!this.onUndoPreviousStep())
      return false;

    // AccuDrawShortcuts:: ProcessPendingHints(); // Process any hints the active tool setup in _OnUndoPreviousStep now...

    const ev = new ButtonEvent();
    toolAdmin.fillEventFromCursorLocation(ev);
    this.updateDynamics(ev);
    return true;
  }

  public updateDynamics(ev: ButtonEvent): void {
    if (!ev.viewport || !viewManager.inDynamicsMode)
      return;

    // DynamicsContext context(* ev.GetViewport(), Render:: Task:: Priority:: Highest());
    // _OnDynamicFrame(ev, context);
  }
}
