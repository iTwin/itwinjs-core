/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { BeButtonEvent, InputCollector, BeButton, BeGestureEvent } from "./Tool";
import { DecorateContext } from "../ViewContext";
import { IModelApp } from "../IModelApp";
import { CoordinateLockOverrides } from "./ToolAdmin";
import { IModelConnection } from "../IModelConnection";
import { SelectEventType } from "../SelectionSet";

/**
 * A manipulator maintains a set of controls used to modify element(s) or pickable decorations.
 * Interactive modification is handled by installing an InputCollector tool.
 */
export namespace EditManipulator {
  export const enum EventType { Synch, Cancel, Accept }

  export abstract class Tool extends InputCollector {
    public static toolId = "Select.Manipulator";
    public static hidden = true;
    public constructor(public manipulator: Provider) { super(); }

    /** Setup tool for press, hold, drag or click+click modification.
     * To support drag operation, request up event be sent to this tool even though it would not have received the down event.
     * By default a vertex type manipulator should honor all locks and support AccuSnap.
     */
    protected init(): void { IModelApp.toolAdmin.currentInputState.buttonDownTool = this; IModelApp.toolAdmin.toolState.coordLockOvr = CoordinateLockOverrides.None; IModelApp.accuSnap.enableLocate(false); IModelApp.accuSnap.enableSnap(true); }
    protected cancel(_ev: BeButtonEvent): boolean { return true; }
    protected abstract accept(_ev: BeButtonEvent): boolean;

    public onPostInstall(): void { super.onPostInstall(); this.init(); }
    public onDataButtonDown(ev: BeButtonEvent): boolean { if (!this.accept(ev)) return false; this.exitTool(); this.manipulator.onManipulatorEvent(EventType.Accept); return true; }
    public onResetButtonUp(ev: BeButtonEvent): boolean { if (!this.cancel(ev)) return false; this.exitTool(); this.manipulator.onManipulatorEvent(EventType.Cancel); return true; }
  }

  export abstract class Provider {
    public isActive = false;
    public removeSelectionListener?: () => void;
    public removeDecorationListener?: () => void;
    public constructor(public iModel: IModelConnection) { }
    public allowTransientControls(): boolean { return false; }

    /** Provider is responsible for checking if modification by controls is valid.
     * May still wish to present controls for "transient" geometry in non-read/write applications, etc.
     */
    protected abstract createControls(): boolean;

    protected updateControls(): void {
      this.isActive = this.createControls();
      this.updateDecorationListener(this.isActive);
    }

    protected clearControls(): void {
      this.isActive = false;
      this.updateDecorationListener(false);
    }

    protected updateDecorationListener(add: boolean): void {
      if (this.removeDecorationListener) {
        if (!add) {
          this.removeDecorationListener();
          this.removeDecorationListener = undefined;
        }
        IModelApp.viewManager.invalidateDecorationsAllViews();
      } else if (add) {
        if (!this.removeDecorationListener)
          this.removeDecorationListener = IModelApp.viewManager.onDecorate.addListener(this.drawControls, this);
        IModelApp.viewManager.invalidateDecorationsAllViews();
      }
    }

    protected drawControls(_context: DecorateContext): void { }
    protected abstract selectControls(_ev: BeButtonEvent): boolean;
    protected abstract modifyControls(_ev: BeButtonEvent): boolean; // run EditManipulator.Tool to handle interactive drag/click modification.
    protected onDoubleClick(_ev: BeButtonEvent): boolean { return false; } // IModelApp.locateManager.currHit holds located element or pickable decoration

    public onButtonEvent(ev: BeButtonEvent): boolean {
      if (ev.isDoubleClick)
        return this.onDoubleClick(ev);

      if (!this.isActive)
        return false;

      if (BeButton.Data !== ev.button)
        return false;

      const isDragging = ev.isDown && IModelApp.toolAdmin.currentInputState.isDragging(BeButton.Data);

      if (isDragging && ev.isControlKey)
        return false; // Don't select or modify controls with ctrl+drag...

      if ((ev.isDown && !isDragging) || !this.selectControls(ev))
        return false; // Select controls on up event or down event only after drag started...

      if (ev.isControlKey)
        return true; // Support ctrl+click to select multiple controls...

      return this.modifyControls(ev); // Handle modification. Install InputCollector to modify using hold+drag, release or click+click.
    }

    public onGestureEvent(_ev: BeGestureEvent): boolean { return false; }
    public onManipulatorEvent(_eventType: EventType): void { this.updateControls(); }
    public onSelectionChanged(iModel: IModelConnection, _eventType: SelectEventType, _ids?: Set<string>): void { if (this.iModel === iModel) this.onManipulatorEvent(EventType.Synch); }

    public init(): void {
      this.removeSelectionListener = this.iModel.selectionSet.onChanged.addListener(this.onSelectionChanged, this);
      this.updateControls();
    }

    public clear(): void {
      if (this.removeSelectionListener) {
        this.removeSelectionListener();
        this.removeSelectionListener = undefined;
      }
      this.clearControls();
    }
  }
}
