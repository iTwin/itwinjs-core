/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { BeButtonEvent } from "./Tool";
import { HitDetail } from "../HitDetail";
import { Viewport } from "../Viewport";
import { DecorateContext, DynamicsContext } from "../ViewContext";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { FenceParams } from "../FenceParams";

/** Control selection modes. */
export const enum ManipulatorSelectionMode {
  New = 0,
  Add = 1,
  Subtract = 2,
  Inverse = 3,
  Clear = 4,
  All = 5,
}

/**
 * A manipulator maintains a set of controls used to modify an element.The manipulator
 * is a new object that gets created by the handler for a supplied element.The
 * EditManipulator controls are driven by view based point to point changes.
 */
export abstract class EditManipulator {

  /**
   * Called to have manipulator populate it's internal set of controls.
   * @return true if controls were created.
   */
  public abstract doCreateControls(): boolean;

  /**
   * Called to have manipulator cleanup it's internal control data so that
   * doCreateControls might be called again. For example after a successful drag,
   * doCleanupControls will be called followed by doCreateControls to
   * have the controls reflect the changes to the element.
   */
  public abstract doCleanupControls(): void;

  /**
   * Flash control(s) at the button location. A flashed control is considered to be selected.
   * Called on motion, controls should not remain selected when the button is no longer over them.
   * @return true if a control is flashed.
   */
  public abstract doUpdateFlashedControls(ev: BeButtonEvent): boolean;

  /**
   * Select control(s) that the button location is over. Controls should remain selected
   * until specifically de-selected.
   * @return true if any controls remain selected.
   */
  public abstract doUpdateSelectedControls(ev: BeButtonEvent | FenceParams, mode: ManipulatorSelectionMode): boolean;

  /**
   * Select control(s) that make the most sense for the supplied hit.
   * This method supports modification tools that need to select both the
   * element and controls from a single click and immediately start modification.
   * The manipulator might not ever be asked to draw it's controls.
   * @note A manipulator should always try to select at least one control.
   * @return true if any control is selected.
   */
  public abstract doUpdateSelectedControls(path: HitDetail): boolean;

  /**
   * Check whether manipulator currently has any controls selected.
   * @return true if manipulator has controls selected or flashed.
   */
  public abstract hasSelectedControls(): boolean;

  /** Return whether manipulator controls or dynamics should be shown in the supplied view. */
  public abstract isDisplayedInView(vp: Viewport): boolean;

  /**
   * Called to display the manipulator's controls in the supplied viewport.
   * This is commonly done by drawing sprites, but the manipulator can choose to draw any geometry it wants.
   */
  public abstract onDraw(_context: DecorateContext): void;

  /**
   * When multiple manipulators are active on a selection set, only the one whose control is actually
   * selected to start the modify operation is given responsibility for setting up the modification.
   * If called, the manipulator is responsible for setting the anchor point that will be used by all
   * active manipulators to the center of it's selected control. This manipulator can also enable AccuSnap/AccuDraw.
   * @param[in,out] ev Current button event, point needs to be set to center of selected control.
   * @note If you merely want a control to handle clicks, implement _OnClick instead.
   * @return false to reject starting modify dynamics.
   * @see _OnClick
   */
  public abstract onPreModify(ev: BeButtonEvent): void;

  /**
   * Called when the modify operation is about to begin. It is the responsibility of the
   * manipulator to keep the point in the supplied button event to use as the anchor
   * point of the modify operation.
   */
  public abstract onModifyStart(ev: BeButtonEvent): void;

  /** Called if user aborts drag operation (reset), manipulator can cleanup anything done in onModifyStart. */
  public abstract onModifyCancel(ev: BeButtonEvent): void;

  /**
   * Called to show modify dynamics. Expected to call doModify with isDynamics set
   * to true, and to display the result if doModify returned SUCCESS.
   * @return SUCCESS if modify operation could be applied.
   */
  public abstract onModify(ev: BeButtonEvent, context: DynamicsContext): BentleyStatus;

  /**
   * Called to accept modify operation. Expected to call doModify with isDynamics set
   * to false, and to update the element in the DgnDb if doModify returned SUCCESS.
   * @return SUCCESS if modify operation could be applied and element was updated.
   */
  public abstract onModifyAccept(ev: BeButtonEvent): BentleyStatus;

  /**
   * It is expected that this is where all the work is done to update the element.
   * Using the anchor point from _OnModifyStart and the supplied button event for the cursor
   * location, update the element data.
   * @param[in] ev Current button event,
   * @param[in] isDynamics Whether manipulator is being called from _OnModify or _OnModifyAccept.
   * @return SUCCESS if modify operation could be applied.
   */
  public abstract doModify(ev: BeButtonEvent, isDynamics: boolean): BentleyStatus;

  /**
   * Called when manipulator is displaying controls and user clicks on the same or different geometry
   * instead of on a control. Manipulator may choose to present the user with a different set of controls or cleanup.
   * Transient manipulators need to verify that the new hit is compatible as caller has no way of checking.
   * @return true to clear manipulator, false if current manipulator is still ok.
   */
  public onNewHit(hit: HitDetail) { return !!hit.elementId; }

  /**
   *  Called on a data button event to allow controls to act on a single click.
   * @note This method can be used to launch editors as it is called before _OnPreModify.
   * @return true if event was handled and modify dynamics should not be started.
   */
  public onClick(_ev: BeButtonEvent) { return false; }

  /**
   * Called on right - click when not manipulating a control.One use of this event would be to
   * present the user with a menu of editing options.
   * @return true if manipulator wants to do something and handled the right - click event.
   * @note It is up to the manipulator to check whether a control is selected or under the cursor by
   * calling HaveSelectedControls.A manipulator * could * also check if the current auto - locate HitDetail
   * is for the geometry that the manipulator was created for when not over a control.
   */
  public onRightClick(_ev: BeButtonEvent) { return false; }

  /**
   * Called when user double clicks on the manipulator's element. (ex. edit text)
   * @return true if manipulator handled double - click event.
   */
  public onDoubleClick(_path: HitDetail) { return false; }

  /**
   * Called when a drag operation starts.This method is only useful for manipulators that
   * wish to distinguish click - move - click from down - drag - release.
   * @return true if the manipulator has handled the event.
   */
  public onDragStart(_ev: BeButtonEvent) { return false; }

  /**  Called when a drag operation ends. */
  public onDragEnd(_ev: BeButtonEvent) { }

  /**
   * Called when a sub entity selection effects an element that is being manipulated.
   * Typically the manipulator should get the current selection state from the element
   * and update its display as appropriate.
   * @return true if the manipulator has handled the event.
   */
  public onSubSelection() { return false; }

  /**
   * Called if a modifier key goes up or down while dragging.Manipulator can use this
   * to cycle between different drag behaviors for a control, ex.move or copy.
   */
  public onModifierKeyTransition(_wentDown: boolean, _key: number) { }

  /**
   * Called when a keyboard key is pressed while an element is being manipulated.
   * This method is only called for a small set of specific keys presses(See below).
   * @param _wentDown true if the key was pressed, false if the key was released.
   * @param _key One of VK_TAB, VK_RETURN, VK_END, VK_HOME, VK_LEFT, VK_UP, VK_RIGHT, VKdOWN.
   * @param _shiftIsDown The shift key was down during the transition.
   * @param _ctrlIsDown The control key was down during the transition.
   * @return true if the manipulator has handled the key.This will prevent further processing of the key press.
   */
  public onKeyTransition(_wentDown: boolean, _key: number, _shiftIsDown: boolean, _ctrlIsDown: boolean) { return false; }

  /**
   * Return a string suitable for display in a tool tip that describes the currently selected controls.
   * @return String to describe selected controls or an empty string for no description.
   */
  public abstract onGetDescription(): string;
}
