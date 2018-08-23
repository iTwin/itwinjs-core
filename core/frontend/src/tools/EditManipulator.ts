/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { BeButtonEvent, InputCollector, BeButton, EventHandled, BeTouchEvent, InputSource } from "./Tool";
import { DecorateContext, DynamicsContext } from "../ViewContext";
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
     * By default a vertex type manipulator should honor all locks and support AccuSnap.
     * @note We set this.receivedDownEvent to get up events for this tool even though it was the primitive tool that installed this instance that was sent the down event.
     */
    protected init(): void { this.receivedDownEvent = true; IModelApp.toolAdmin.toolState.coordLockOvr = CoordinateLockOverrides.None; IModelApp.accuSnap.enableLocate(false); IModelApp.accuSnap.enableSnap(true); }
    protected cancel(_ev: BeButtonEvent): boolean { return true; }
    protected abstract accept(_ev: BeButtonEvent): boolean;

    public onPostInstall(): void { super.onPostInstall(); this.init(); }
    public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> { if (!this.accept(ev)) return EventHandled.No; this.exitTool(); this.manipulator.onManipulatorEvent(EventType.Accept); return EventHandled.Yes; }
    public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> { if (!this.cancel(ev)) return EventHandled.No; this.exitTool(); this.manipulator.onManipulatorEvent(EventType.Cancel); return EventHandled.Yes; }
    public async onTouchMove(ev: BeTouchEvent): Promise<void> { IModelApp.toolAdmin.convertTouchMoveToMotion(ev); }
    public async onTouchComplete(ev: BeTouchEvent): Promise<void> { IModelApp.toolAdmin.convertTouchEndToButtonUp(ev); }
    public async onTouchCancel(ev: BeTouchEvent): Promise<void> { IModelApp.toolAdmin.convertTouchEndToButtonUp(ev, BeButton.Reset); }
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
          this.removeDecorationListener = IModelApp.viewManager.addDecorator(this);
        IModelApp.viewManager.invalidateDecorationsAllViews();
      }
    }

    public decorate(_context: DecorateContext): void { }
    protected abstract selectControls(_ev: BeButtonEvent): boolean;
    protected abstract modifyControls(_ev: BeButtonEvent): boolean; // run EditManipulator.Tool to handle interactive drag/click modification.
    protected async onDoubleClick(_ev: BeButtonEvent): Promise<EventHandled> { return EventHandled.No; } // IModelApp.locateManager.currHit holds located element or pickable decoration

    public async onButtonEvent(ev: BeButtonEvent): Promise<EventHandled> {
      if (ev.isDoubleClick)
        return this.onDoubleClick(ev);

      if (!this.isActive)
        return EventHandled.No;

      if (BeButton.Data !== ev.button)
        return EventHandled.No;

      if (ev.isDragging && ev.isControlKey)
        return EventHandled.No; // Don't select or modify controls with ctrl+drag...

      if (((ev.isDown || InputSource.Touch === ev.inputSource) && !ev.isDragging) || !this.selectControls(ev))
        return EventHandled.No; // Select controls on up event or down event only after drag started...

      if (ev.isControlKey)
        return EventHandled.Yes; // Support ctrl+click to select multiple controls...

      if (this.modifyControls(ev))
        return EventHandled.Yes; // Handle modification. Install InputCollector to modify using hold+drag, release or click+click.

      return EventHandled.No;
    }

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

/** @hidden */
export class TestEditManipulatorTool extends EditManipulator.Tool {
  protected init(): void { super.init(); this.beginDynamics(); }
  protected accept(_ev: BeButtonEvent): boolean { return true; }
  public onDynamicFrame(_ev: BeButtonEvent, _context: DynamicsContext): void { }
}

/** @hidden */
export class TestEditManipulatorProvider extends EditManipulator.Provider {
  protected createControls(): boolean {
    return 1 === this.iModel.selectionSet.size;
  }
  protected selectControls(_ev: BeButtonEvent): boolean {
    const autoHit = IModelApp.accuSnap.currHit;
    return (undefined !== autoHit && this.iModel.selectionSet.has(autoHit.sourceId));
  }
  protected modifyControls(_ev: BeButtonEvent): boolean {
    const manipTool = new TestEditManipulatorTool(this);
    return manipTool.run();
  }
  protected drawControls(_context: DecorateContext): void { }
  public onManipulatorEvent(eventType: EditManipulator.EventType): void {
    super.onManipulatorEvent(eventType);
  }
}
