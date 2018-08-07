/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { CoordinateLockOverrides } from "./ToolAdmin";
import { BeButtonEvent, BeCursor, InteractiveTool, BeButton } from "./Tool";
import { Viewport } from "../Viewport";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { AccuDrawShortcuts } from "./AccuDrawTool";
import { NotifyMessageDetails, OutputMessagePriority } from "../NotificationManager";
import { LocateResponse } from "../ElementLocateManager";
import { HitDetail } from "../HitDetail";

export const enum ModifyElementSource {
  /** The source for the element is unknown - not caused by a modification command. */
  Unknown = 0,
  /** The element is selected by the user. */
  Selected = 1,
  /** The element is processed because it is in the selection set. */
  SelectionSet = 2,
  /** The element is processed because it is passes the fence criteria. */
  Fence = 3,
  /** The element is processed because it belongs to the group of the selected element (for _FilterAgendaEntries only) */
  Group = 4,
  /** The element is selected by the user by drag selection or multi-selection using ctrl. */
  DragSelect = 5,
}

/**
 * The PrimitiveTool class can be used to implement a primitive command. Placement
 * tools that don't need to locate or modify elements are good candidates for a PrimitiveTool.
 */
export abstract class PrimitiveTool extends InteractiveTool {
  public targetView?: Viewport;
  public targetModelId?: string;
  public targetIsLocked: boolean = false; // If target model is known, set this to true in constructor and override getTargetModel.

  /** Get the iModel the tool is operating against. */
  public get iModel(): IModelConnection { return this.targetView!.view!.iModel; }

  /**
   * Establish this tool as the active PrimitiveTool.
   * @return true if this tool was installed (though it may have exited too)
   */
  public run(): boolean {
    const { toolAdmin, viewManager } = IModelApp;
    if (!this.isCompatibleViewport(viewManager.selectedView, false) || !toolAdmin.onInstallTool(this))
      return false;

    toolAdmin.startPrimitiveTool(this);
    toolAdmin.onPostInstallTool(this);
    return true;
  }

  /**
   * Determine whether the supplied Viewport is compatible with this tool.
   * @param vp the Viewport to check
   */
  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean {
    if (undefined === vp)
      return false; // No views are open...

    const view = vp.view;
    const iModel = view.iModel;
    if (this.requireWriteableTarget()) {
      if (iModel.isReadonly()) {
        // IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, IModelApp.i18n.translate("DgnViewL10N::MSG_UnableToStartTool_FileIsReadOnly"))); ###TODO find correct i18n message code
        return false; // Tool can't be used when iModel is read only.
      }

      // ###TODO lock specific code
      // IBriefcaseManager:: Request req;
      // req.Locks().Insert(db, LockLevel:: Shared);
      // if (!db.BriefcaseManager().AreResourcesAvailable(req, nullptr, IBriefcaseManager:: FastQuery:: Yes))
      //   return false;   // another briefcase has locked the db for editing
    }

    if (undefined === this.targetView)
      this.targetView = vp; // Update target to newly selected view.
    else if (iModel !== this.iModel)
      return false; // Once a ViewState has been established, only accept viewport showing the same iModel.

    if (!this.targetIsLocked) {
      if (isSelectedViewChange)
        this.targetView = vp; // Update target to newly selected view.

      return true; // Any type of model/view is still ok and target is still free to change.
    }

    if (this.targetModelId && !view.viewsModel(this.targetModelId))
      return false; // Only allow view where target is being viewed.

    if (this.requireWriteableTarget()) {
      // ###TODO lock specific code
      //   IBriefcaseManager:: Request req;
      //   req.Locks().Insert(* targetModel, LockLevel:: Shared);
      //   if (!db.BriefcaseManager().AreResourcesAvailable(req, nullptr, IBriefcaseManager:: FastQuery:: Yes))
      //     return false; // another briefcase has locked the model for editing
    }

    return true;
  }

  /**
   * Checks that the adjusted point from the supplied button event is within the project extents for spatial views. The range of physical geometry
   * should always be fully inside the project extents. Only checking the adjusted point won't absolutely guarantee that a tool doesn't create/move geometry
   * outside the project extents, but it will be sufficient to handle most cases and provide good feedback to the user.
   * @return true if ev is acceptable.
   */
  public isValidLocation(ev: BeButtonEvent, isButtonEvent: boolean): boolean {
    const vp = ev.viewport;

    if (undefined === vp)
      return false;

    if (isButtonEvent && BeButton.Data !== ev.button)
      return true;

    const view = vp.view;
    const iModel = view.iModel;
    if (!view.isSpatialView() || iModel.isReadonly() || !this.requireWriteableTarget())
      return true;

    // NOTE: If points aren't being adjusted then the tool shouldn't be creating geometry currently (ex. locating elements) and we shouldn't filter point...
    if (0 !== (IModelApp.toolAdmin.toolState.coordLockOvr & CoordinateLockOverrides.ACS))
      return true;

    // We know the tool isn't doing a locate, we don't know what it will do with this point. Minimize erroneous filtering by restricting the check to when AccuSnap is tool enable (not user enabled)...
    if (!IModelApp.accuSnap.isSnapEnabled())
      return true;

    const extents = iModel.projectExtents;
    if (extents.containsPoint(ev.point))
      return true;

    if (isButtonEvent && ev.isDown) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, IModelApp.i18n.translate("CoreTools:tools.ElementSet.Error.ProjectExtents")));
    }

    return false;
  }

  public getCursor(): BeCursor { return BeCursor.Arrow; }

  /** Called on data button down event to lock the tool to its current target model. */
  public autoLockTarget(): void { if (undefined !== this.targetView) return; this.targetIsLocked = true; }

  /**  Returns the prompt based on the tool's current state. */
  public getPrompt(): string { return ""; }

  /** Called from isCompatibleViewport to check for a read only iModel, which is not a valid target for tools that create or modify elements. */
  public requireWriteableTarget(): boolean { return true; }

  /** Invoked to allow tools to filter which elements can be located.
   * return true to reject hit (fill out response with reason, if it is defined)
   */
  public onPostLocate(_hit: HitDetail, _out?: LocateResponse): boolean { return false; }

  /**
   * Called when active view changes. Tool may choose to restart or exit based on current view type.
   * @param _previous The previously active view.
   * @param current The new active view.
   */
  public onSelectedViewportChanged(_previous: Viewport | undefined, current: Viewport | undefined): void {
    if (this.isCompatibleViewport(current, true))
      return;
    this.onRestartTool();
  }

  /**
   * Called when an external event may invalidate the current tool's state.
   * Examples are undo, which may invalidate any references to elements, or an incompatible active view change.
   * The active tool is expected to call installTool with a new instance, or exitTool to start the default tool.
   */
  public abstract onRestartTool(): void;

  /**
   * Called to reset tool to initial state. This method is provided here for convenience; the only
   * external caller is ElementSetTool. PrimitiveTool implements this method to call onRestartTool.
   */
  public onReinitialize(): void { this.onRestartTool(); }

  public exitTool(): void { IModelApp.toolAdmin.startDefaultTool(); }

  /**
   * Called to revert to a previous tool state (ex. undo last data button).
   * @return false to instead reverse the most recent transaction.
   */
  public onUndoPreviousStep(): boolean { return false; }

  public undoPreviousStep(): boolean {
    if (!this.onUndoPreviousStep())
      return false;

    AccuDrawShortcuts.processPendingHints(); // Process any hints the active tool setup in _OnUndoPreviousStep now...
    IModelApp.toolAdmin.updateDynamics();

    return true;
  }

  /**
   * Tools need to call SaveChanges to commit any elements they have added/changes they have made.
   * This helper method supplies the tool name for the undo string to iModel.saveChanges.
   */
  public async saveChanges(): Promise<void> { return this.iModel.saveChanges(this.toolId); }
}
