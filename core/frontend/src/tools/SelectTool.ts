/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SelectionSet
 */

import { Id64, Id64Arg, Id64String } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { ColorDef } from "@itwin/core-common";
import {
  ButtonGroupEditorParams, DialogItem, DialogItemValue, DialogPropertySyncItem, PropertyDescription, PropertyEditorParamTypes,
  SuppressLabelEditorParams,
} from "@itwin/appui-abstract";
import { LocateFilterStatus, LocateResponse } from "../ElementLocateManager";
import { HitDetail } from "../HitDetail";
import { IModelApp } from "../IModelApp";
import { DecorateContext } from "../ViewContext";
import { PrimitiveTool } from "./PrimitiveTool";
import { BeButton, BeButtonEvent, BeModifierKeys, BeTouchEvent, CoordinateLockOverrides, CoreTools, EventHandled, InputSource } from "./Tool";
import { ManipulatorToolEvent } from "./ToolAdmin";
import { ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction, ToolAssistanceSection } from "./ToolAssistance";
import { ElementSetTool } from "./ElementSetTool";

// cSpell:ignore buttongroup

/** The method for choosing elements with the [[SelectionTool]]
 * @public
 * @extensions
 */
export enum SelectionMethod {
  /** Identify element(s) by picking for drag selection (inside/overlap for drag box selection determined by point direction and shift key) */
  Pick,
  /** Identify elements by overlap with crossing line */
  Line,
  /** Identify elements by box selection (inside/overlap for box selection determined by point direction and shift key) */
  Box,
}

/** The mode for choosing elements with the [[SelectionTool]]
 * @public
 * @extensions
 */
export enum SelectionMode {
  /** Identified elements replace the current selection set (use control key to add or remove) */
  Replace,
  /** Identified elements are added to the current selection set */
  Add,
  /** Identified elements are removed from the current selection set */
  Remove,
}

/** The processing method to use to update the current selection.
 * @public
 * @extensions
 */
export enum SelectionProcessing {
  /** Add element to selection. */
  AddElementToSelection,
  /** Remove element from selection. */
  RemoveElementFromSelection,
  /** If element is in selection remove it, else add it. */
  InvertElementInSelection,
  /** Replace current selection with element. */
  ReplaceSelectionWithElement,
}

/** Tool for picking a set of elements of interest, selected by the user.
 * @public
 */
export class SelectionTool extends PrimitiveTool {
  public static override hidden = false;
  public static override toolId = "Select";
  public static override iconSpec = "icon-cursor";
  protected _isSelectByPoints = false;
  protected _isSuspended = false;
  protected readonly _points: Point3d[] = [];
  private _selectionMethodValue: DialogItemValue = { value: SelectionMethod.Pick };
  private _selectionModeValue: DialogItemValue = { value: SelectionMode.Replace };

  public override requireWriteableTarget(): boolean { return false; }
  public override autoLockTarget(): void { } // NOTE: For selecting elements we only care about iModel, so don't lock target model automatically.

  protected wantSelectionClearOnMiss(_ev: BeButtonEvent): boolean { return SelectionMode.Replace === this.selectionMode; }
  protected wantEditManipulators(): boolean { return SelectionMethod.Pick === this.selectionMethod; }
  protected wantPickableDecorations(): boolean { return this.wantEditManipulators(); } // Allow pickable decorations selection to be independent of manipulators...
  protected wantToolSettings(): boolean { return true; }

  public get selectionMethod(): SelectionMethod { return this._selectionMethodValue.value as SelectionMethod; }
  public set selectionMethod(method: SelectionMethod) { this._selectionMethodValue.value = method; }
  public get selectionMode(): SelectionMode { return this._selectionModeValue.value as SelectionMode; }
  public set selectionMode(mode: SelectionMode) { this._selectionModeValue.value = mode; }

  private static methodsMessage(str: string) { return CoreTools.translate(`ElementSet.SelectionMethods.${str}`); }
  private static _methodsName = "selectionMethods";
  /* The property descriptions used to generate ToolSettings UI. */
  private static _getMethodsDescription(): PropertyDescription {
    return {
      name: SelectionTool._methodsName,
      displayLabel: "",
      typename: "enum",
      editor: {
        name: "enum-buttongroup",
        params: [{
          type: PropertyEditorParamTypes.ButtonGroupData,
          buttons: [
            { iconSpec: "icon-select-single" },
            { iconSpec: "icon-select-line" },
            { iconSpec: "icon-select-box" },
          ],
        } as ButtonGroupEditorParams, {
          type: PropertyEditorParamTypes.SuppressEditorLabel,
          suppressLabelPlaceholder: true,
        } as SuppressLabelEditorParams,
        ],
      },
      enum: {
        choices: [
          { label: SelectionTool.methodsMessage("Pick"), value: SelectionMethod.Pick },
          { label: SelectionTool.methodsMessage("Line"), value: SelectionMethod.Line },
          { label: SelectionTool.methodsMessage("Box"), value: SelectionMethod.Box },
        ],
      },
    };
  }

  private static modesMessage(str: string) { return CoreTools.translate(`ElementSet.SelectionModes.${str}`); }
  private static _modesName = "selectionModes";
  /* The property descriptions used to generate ToolSettings UI. */
  private static _getModesDescription(): PropertyDescription {
    return {
      name: SelectionTool._modesName,
      displayLabel: "",
      typename: "enum",
      editor: {
        name: "enum-buttongroup",
        params: [{
          type: PropertyEditorParamTypes.ButtonGroupData,
          buttons: [
            { iconSpec: "icon-replace" },
            { iconSpec: "icon-select-plus" },
            {
              iconSpec: "icon-select-minus",
              isEnabledFunction: () => {
                const tool = IModelApp.toolAdmin.activeTool;
                return tool instanceof PrimitiveTool ? tool.iModel.selectionSet.isActive : false;
              },
            },
          ],
        } as ButtonGroupEditorParams, {
          type: PropertyEditorParamTypes.SuppressEditorLabel,
          suppressLabelPlaceholder: true,
        } as SuppressLabelEditorParams,
        ],
      },
      enum: {
        choices: [
          { label: SelectionTool.modesMessage("Replace"), value: SelectionMode.Replace },
          { label: SelectionTool.modesMessage("Add"), value: SelectionMode.Add },
          { label: SelectionTool.modesMessage("Remove"), value: SelectionMode.Remove },
        ],
      },
    };
  }

  protected showPrompt(mode: SelectionMode, method: SelectionMethod): void {
    let mainMsg = "ElementSet.Prompts.";
    switch (method) {
      case SelectionMethod.Pick:
        mainMsg += "IdentifyElement";
        break;
      case SelectionMethod.Line:
        mainMsg += (0 === this._points.length ? "StartPoint" : "EndPoint");
        break;
      case SelectionMethod.Box:
        mainMsg += (0 === this._points.length ? "StartCorner" : "OppositeCorner");
        break;
    }

    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, CoreTools.translate(mainMsg));
    const sections: ToolAssistanceSection[] = [];

    switch (method) {
      case SelectionMethod.Pick:
        const mousePickInstructions: ToolAssistanceInstruction[] = [];
        mousePickInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, CoreTools.translate("ElementSet.Inputs.AcceptElement"), false, ToolAssistanceInputMethod.Mouse));
        mousePickInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClickDrag, CoreTools.translate("ElementSet.Inputs.BoxCorners"), false, ToolAssistanceInputMethod.Mouse));
        mousePickInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClickDrag, CoreTools.translate("ElementSet.Inputs.CrossingLine"), false, ToolAssistanceInputMethod.Mouse));
        mousePickInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.shiftKey, ToolAssistanceImage.LeftClickDrag, CoreTools.translate("ElementSet.Inputs.OverlapSelection"), false, ToolAssistanceInputMethod.Mouse));
        if (SelectionMode.Replace === mode) {
          mousePickInstructions.push(ToolAssistance.createKeyboardInstruction(ToolAssistance.ctrlKeyboardInfo, CoreTools.translate("ElementSet.Inputs.InvertSelection"), false, ToolAssistanceInputMethod.Mouse));
          mousePickInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.CursorClick, CoreTools.translate("ElementSet.Inputs.ClearSelection"), false, ToolAssistanceInputMethod.Mouse));
        }
        sections.push(ToolAssistance.createSection(mousePickInstructions, ToolAssistance.inputsLabel));

        const touchPickInstructions: ToolAssistanceInstruction[] = [];
        if (!ToolAssistance.createTouchCursorInstructions(touchPickInstructions))
          touchPickInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, CoreTools.translate("ElementSet.Inputs.AcceptElement"), false, ToolAssistanceInputMethod.Touch));
        sections.push(ToolAssistance.createSection(touchPickInstructions, ToolAssistance.inputsLabel));
        break;
      case SelectionMethod.Line:
        const mouseLineInstructions: ToolAssistanceInstruction[] = [];
        mouseLineInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, CoreTools.translate("ElementSet.Inputs.AcceptPoint"), false, ToolAssistanceInputMethod.Mouse));
        if (SelectionMode.Replace === mode)
          mouseLineInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.ctrlKey, ToolAssistanceImage.LeftClick, CoreTools.translate("ElementSet.Inputs.InvertSelection"), false, ToolAssistanceInputMethod.Mouse));
        sections.push(ToolAssistance.createSection(mouseLineInstructions, ToolAssistance.inputsLabel));

        const touchLineInstructions: ToolAssistanceInstruction[] = [];
        touchLineInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchDrag, CoreTools.translate("ElementSet.Inputs.AcceptPoint"), false, ToolAssistanceInputMethod.Touch));
        sections.push(ToolAssistance.createSection(touchLineInstructions, ToolAssistance.inputsLabel));
        break;
      case SelectionMethod.Box:
        const mouseBoxInstructions: ToolAssistanceInstruction[] = [];
        mouseBoxInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, CoreTools.translate("ElementSet.Inputs.AcceptPoint"), false, ToolAssistanceInputMethod.Mouse));
        mouseBoxInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.shiftKey, ToolAssistanceImage.LeftClick, CoreTools.translate("ElementSet.Inputs.OverlapSelection"), false, ToolAssistanceInputMethod.Mouse));
        if (SelectionMode.Replace === mode)
          mouseBoxInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.ctrlKey, ToolAssistanceImage.LeftClick, CoreTools.translate("ElementSet.Inputs.InvertSelection"), false, ToolAssistanceInputMethod.Mouse));
        sections.push(ToolAssistance.createSection(mouseBoxInstructions, ToolAssistance.inputsLabel));

        const touchBoxInstructions: ToolAssistanceInstruction[] = [];
        touchBoxInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchDrag, CoreTools.translate("ElementSet.Inputs.AcceptPoint"), false, ToolAssistanceInputMethod.Touch));
        sections.push(ToolAssistance.createSection(touchBoxInstructions, ToolAssistance.inputsLabel));
        break;
    }

    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  protected initSelectTool(): void {
    const method = this.selectionMethod;
    const mode = this.selectionMode;
    const enableLocate = SelectionMethod.Pick === method;

    this._isSelectByPoints = false;
    this._points.length = 0;

    this.initLocateElements(enableLocate, false, enableLocate ? "default" : IModelApp.viewManager.crossHairCursor, CoordinateLockOverrides.All);
    IModelApp.locateManager.options.allowDecorations = true; // Always locate to display tool tip even if we reject for adding to selection set...
    this.showPrompt(mode, method);
  }

  protected processMiss(_ev: BeButtonEvent): boolean {
    if (!this.iModel.selectionSet.isActive)
      return false;
    this.iModel.selectionSet.emptyAll();
    return true;
  }

  public updateSelection(elementId: Id64Arg, process: SelectionProcessing): boolean {
    let returnValue = false;
    switch (process) {
      case SelectionProcessing.AddElementToSelection:
        returnValue = this.iModel.selectionSet.add(elementId);
        break;
      case SelectionProcessing.RemoveElementFromSelection:
        returnValue = this.iModel.selectionSet.remove(elementId);
        break;
      case SelectionProcessing.InvertElementInSelection: // (if element is in selection remove it else add it.)
        returnValue = this.iModel.selectionSet.invert(elementId);
        break;
      case SelectionProcessing.ReplaceSelectionWithElement:
        this.iModel.selectionSet.replace(elementId);
        returnValue = true;
        break;
      default:
        return false;
    }
    // always force UI to sync display of options since the select option of Remove should only be enabled if the selection set has elements.
    if (returnValue)
      this.syncSelectionMode();
    return returnValue;
  }

  public async processSelection(elementId: Id64Arg, process: SelectionProcessing): Promise<boolean> { return this.updateSelection(elementId, process); }

  protected useOverlapSelection(ev: BeButtonEvent): boolean {
    if (undefined === ev.viewport)
      return false;
    const pt1 = ev.viewport.worldToView(this._points[0]);
    const pt2 = ev.viewport.worldToView(ev.point);
    const overlapMode = (pt1.x > pt2.x);
    return (ev.isShiftKey ? !overlapMode : overlapMode); // Shift inverts inside/overlap selection...
  }

  private selectByPointsDecorate(context: DecorateContext): void {
    if (!this._isSelectByPoints)
      return;

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    if (undefined === ev.viewport)
      return;

    const vp = context.viewport;
    const bestContrastIsBlack = (ColorDef.black === vp.getContrastToBackgroundColor());
    const crossingLine = (SelectionMethod.Line === this.selectionMethod || (SelectionMethod.Pick === this.selectionMethod && BeButton.Reset === ev.button));
    const overlapSelection = (crossingLine || this.useOverlapSelection(ev));

    const position = vp.worldToView(this._points[0]);
    position.x = Math.floor(position.x) + 0.5;
    position.y = Math.floor(position.y) + 0.5;
    const position2 = vp.worldToView(ev.point);
    position2.x = Math.floor(position2.x) + 0.5;
    position2.y = Math.floor(position2.y) + 0.5;
    const offset = position2.minus(position);

    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = bestContrastIsBlack ? "black" : "white";
      ctx.lineWidth = 1;
      if (overlapSelection)
        ctx.setLineDash([5, 5]);

      if (crossingLine) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(offset.x, offset.y);
        ctx.stroke();
      } else {
        ctx.strokeRect(0, 0, offset.x, offset.y);
        ctx.fillStyle = bestContrastIsBlack ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.06)";
        ctx.fillRect(0, 0, offset.x, offset.y);
      }
    };
    context.addCanvasDecoration({ position, drawDecoration });
  }

  protected async selectByPointsProcess(origin: Point3d, corner: Point3d, ev: BeButtonEvent, method: SelectionMethod, overlap: boolean): Promise<boolean> {
    const vp = ev.viewport;
    if (!vp)
      return false;

    const filter = (id: Id64String) => { return !Id64.isTransient(id); };
    const contents = await ElementSetTool.getAreaOrVolumeSelectionCandidates(vp, origin, corner, method, overlap, this.wantPickableDecorations() ? undefined : filter, this.wantPickableDecorations());

    if (0 === contents.size) {
      if (!ev.isControlKey && this.wantSelectionClearOnMiss(ev) && this.processMiss(ev)) {
        this.syncSelectionMode();
        return true;
      }
      return false;
    }

    switch (this.selectionMode) {
      case SelectionMode.Replace:
        if (!ev.isControlKey)
          return this.processSelection(contents, SelectionProcessing.ReplaceSelectionWithElement);
        return this.processSelection(contents, SelectionProcessing.InvertElementInSelection);

      case SelectionMode.Add:
        return this.processSelection(contents, SelectionProcessing.AddElementToSelection);

      case SelectionMode.Remove:
        return this.processSelection(contents, SelectionProcessing.RemoveElementFromSelection);
    }
  }

  protected selectByPointsStart(ev: BeButtonEvent): boolean {
    if (BeButton.Data !== ev.button && BeButton.Reset !== ev.button)
      return false;
    this._points.length = 0;
    this._points.push(ev.point.clone());
    this._isSelectByPoints = true;
    IModelApp.accuSnap.enableLocate(false);
    IModelApp.toolAdmin.setLocateCircleOn(false);
    this.showPrompt(this.selectionMode, this.selectionMethod);
    return true;
  }

  protected async selectByPointsEnd(ev: BeButtonEvent): Promise<boolean> {
    if (!this._isSelectByPoints)
      return false;

    const vp = ev.viewport;
    if (vp === undefined) {
      this.initSelectTool();
      return false;
    }

    const origin = vp.worldToView(this._points[0]);
    const corner = vp.worldToView(ev.point);
    if (SelectionMethod.Line === this.selectionMethod || (SelectionMethod.Pick === this.selectionMethod && BeButton.Reset === ev.button))
      await this.selectByPointsProcess(origin, corner, ev, SelectionMethod.Line, true);
    else
      await this.selectByPointsProcess(origin, corner, ev, SelectionMethod.Box, this.useOverlapSelection(ev));

    this.initSelectTool();
    vp.invalidateDecorations();
    return true;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined !== ev.viewport && this._isSelectByPoints)
      ev.viewport.invalidateDecorations();
  }

  public async selectDecoration(ev: BeButtonEvent, currHit?: HitDetail): Promise<EventHandled> {
    if (undefined === currHit)
      currHit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);

    if (undefined !== currHit)
      return (currHit.isElementHit ? IModelApp.viewManager.overrideElementButtonEvent(currHit, ev) : IModelApp.viewManager.onDecorationButtonEvent(currHit, ev));

    return EventHandled.No;
  }

  public async processHit(ev: BeButtonEvent, hit: HitDetail): Promise<EventHandled> {
    if (hit.isModelHit || hit.isMapHit)
      return EventHandled.No; // model hit = terrain, reality models, background maps, etc - not selectable

    switch (this.selectionMode) {
      case SelectionMode.Replace:
        await this.processSelection(hit.sourceId, ev.isControlKey ? SelectionProcessing.InvertElementInSelection : SelectionProcessing.ReplaceSelectionWithElement);
        break;

      case SelectionMode.Add:
        await this.processSelection(hit.sourceId, SelectionProcessing.AddElementToSelection);
        break;

      case SelectionMode.Remove:
        await this.processSelection(hit.sourceId, SelectionProcessing.RemoveElementFromSelection);
        break;
    }
    return EventHandled.Yes;
  }

  public override async onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    IModelApp.accuSnap.clear(); // Need to test hit at start drag location, not current AccuSnap...
    if (EventHandled.Yes === await this.selectDecoration(ev))
      return EventHandled.Yes;
    if (InputSource.Touch === ev.inputSource && SelectionMethod.Pick === this.selectionMethod)
      return EventHandled.No; // Require method change for line/box selection...allow IdleTool to handle touch move...
    return this.selectByPointsStart(ev) ? EventHandled.Yes : EventHandled.No;
  }

  public override async onMouseEndDrag(ev: BeButtonEvent): Promise<EventHandled> {
    return await this.selectByPointsEnd(ev) ? EventHandled.Yes : EventHandled.No;
  }

  public override async onDataButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.No;

    if (await this.selectByPointsEnd(ev))
      return EventHandled.Yes;

    if (SelectionMethod.Pick !== this.selectionMethod) {
      if (!ev.isControlKey && this.wantSelectionClearOnMiss(ev) && this.processMiss(ev))
        this.syncSelectionMode();
      if (InputSource.Touch !== ev.inputSource)
        this.selectByPointsStart(ev); // Require touch move and not tap to start crossing line/box selection...
      return EventHandled.Yes;
    }

    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (hit !== undefined) {
      if (EventHandled.Yes === await this.selectDecoration(ev, hit))
        return EventHandled.Yes;

      if (EventHandled.Yes === await this.processHit(ev, hit))
        return EventHandled.Yes;
    }

    if (!ev.isControlKey && this.wantSelectionClearOnMiss(ev) && this.processMiss(ev))
      this.syncSelectionMode();

    return EventHandled.Yes;
  }

  public override async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    if (this._isSelectByPoints) {
      if (undefined !== ev.viewport)
        ev.viewport.invalidateDecorations();
      this.initSelectTool();
      return EventHandled.Yes;
    }

    // Check for overlapping hits...
    const lastHit = SelectionMode.Remove === this.selectionMode ? undefined : IModelApp.locateManager.currHit;
    if (lastHit && this.iModel.selectionSet.elements.has(lastHit.sourceId)) {
      const autoHit = IModelApp.accuSnap.currHit;

      // Play nice w/auto-locate, only remove previous hit if not currently auto-locating or over previous hit
      if (undefined === autoHit || autoHit.isSameHit(lastHit)) {
        const response = new LocateResponse();
        let nextHit;
        do {
          nextHit = await IModelApp.locateManager.doLocate(response, false, ev.point, ev.viewport, ev.inputSource);
        } while (undefined !== nextHit && (nextHit.isModelHit || nextHit.isMapHit)); // Ignore reality models, terrain, maps, etc.

        // remove element(s) previously selected if in replace mode, or if we have a next element in add mode
        if (SelectionMode.Replace === this.selectionMode || undefined !== nextHit)
          await this.processSelection(lastHit.sourceId, SelectionProcessing.RemoveElementFromSelection);

        // add element(s) located via reset button
        if (undefined !== nextHit)
          await this.processSelection(nextHit.sourceId, SelectionProcessing.AddElementToSelection);

        return EventHandled.Yes;
      }
    }

    if (EventHandled.Yes === await this.selectDecoration(ev, IModelApp.accuSnap.currHit))
      return EventHandled.Yes;

    await IModelApp.accuSnap.resetButton();
    return EventHandled.Yes;
  }

  public override async onSuspend() {
    this._isSuspended = true;
    if (this.wantEditManipulators())
      IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Suspend);
  }

  public override async onUnsuspend() {
    this._isSuspended = false;
    if (this.wantEditManipulators())
      IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Unsuspend);

    this.showPrompt(this.selectionMode, this.selectionMethod);
  }

  public override async onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled> {
    if (startEv.isSingleTouch && !this._isSelectByPoints)
      await IModelApp.toolAdmin.convertTouchMoveStartToButtonDownAndMotion(startEv, ev);
    return (this._isSuspended || this._isSelectByPoints) ? EventHandled.Yes : EventHandled.No;
  }

  public override async onTouchMove(ev: BeTouchEvent): Promise<void> {
    if (this._isSelectByPoints)
      return IModelApp.toolAdmin.convertTouchMoveToMotion(ev);
  }

  public override async onTouchComplete(ev: BeTouchEvent): Promise<void> {
    if (this._isSelectByPoints)
      return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev);
  }

  public override async onTouchCancel(ev: BeTouchEvent): Promise<void> {
    if (this._isSelectByPoints)
      return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev, BeButton.Reset);
  }

  public override decorate(context: DecorateContext): void { this.selectByPointsDecorate(context); }

  public override async onModifierKeyTransition(_wentDown: boolean, modifier: BeModifierKeys, _event: KeyboardEvent): Promise<EventHandled> {
    return (modifier === BeModifierKeys.Shift && this._isSelectByPoints) ? EventHandled.Yes : EventHandled.No;
  }

  public override async filterHit(hit: HitDetail, out?: LocateResponse): Promise<LocateFilterStatus> {
    if (!this.wantPickableDecorations() && !hit.isElementHit)
      return LocateFilterStatus.Reject;

    const mode = this.selectionMode;
    if (SelectionMode.Replace === mode)
      return LocateFilterStatus.Accept;

    const isSelected = this.iModel.selectionSet.elements.has(hit.sourceId);
    const status = ((SelectionMode.Add === mode ? !isSelected : isSelected) ? LocateFilterStatus.Accept : LocateFilterStatus.Reject);
    if (out && LocateFilterStatus.Reject === status)
      out.explanation = CoreTools.translate(`ElementSet.Error.${isSelected ? "AlreadySelected" : "NotSelected"}`);
    return status;
  }

  public async onRestartTool(): Promise<void> { return this.exitTool(); }

  public override async onCleanup() {
    if (this.wantEditManipulators())
      IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Stop);
  }

  public override async onPostInstall() {
    await super.onPostInstall();
    if (!this.targetView)
      return;
    if (this.wantEditManipulators())
      IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Start);
    this.initSelectTool();
  }

  public static async startTool(): Promise<boolean> { return new SelectionTool().run(); }

  private syncSelectionMode(): void {
    if (SelectionMode.Remove === this.selectionMode && !this.iModel.selectionSet.isActive) {
      // No selection active resetting selection mode since there is nothing to Remove
      this.selectionMode = SelectionMode.Replace;
      this.initSelectTool();
    }
    if (this.wantToolSettings()) {
      const syncMode: DialogPropertySyncItem = { value: this._selectionModeValue, propertyName: SelectionTool._modesName };
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, syncMode);
      this.syncToolSettingsProperties([syncMode]);
    }
  }

  /** Used to supply DefaultToolSettingProvider with a list of properties to use to generate ToolSettings.  If undefined then no ToolSettings will be displayed
   * @beta
   */
  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    if (!this.wantToolSettings())
      return undefined;

    // load latest values from session
    IModelApp.toolAdmin.toolSettingsState.getInitialToolSettingValues(this.toolId, [SelectionTool._modesName])?.forEach((value) => {
      if (value.propertyName === SelectionTool._modesName)
        this._selectionModeValue = value.value;
    });

    // Make sure a mode of SelectionMode.Remove is valid
    if (SelectionMode.Remove === this.selectionMode && !this.iModel.selectionSet.isActive) {
      this.selectionMode = SelectionMode.Replace;
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: SelectionTool._modesName, value: this._selectionModeValue });
    }

    const toolSettings = new Array<DialogItem>();
    // generate 3 columns - label will be placed in column 0 and button group editors in columns 1 and 2.
    toolSettings.push({ value: this._selectionMethodValue, property: SelectionTool._getMethodsDescription(), editorPosition: { rowPriority: 0, columnIndex: 1 } });
    toolSettings.push({ value: this._selectionModeValue, property: SelectionTool._getModesDescription(), editorPosition: { rowPriority: 0, columnIndex: 2 } });
    return toolSettings;
  }

  /** Used to send changes from UI back to Tool
   * @beta
   */
  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    let changed = false;
    if (updatedValue.propertyName === SelectionTool._methodsName) {
      const saveWantManipulators = this.wantEditManipulators();
      this._selectionMethodValue = updatedValue.value;
      if (this._selectionMethodValue) {
        const currWantManipulators = this.wantEditManipulators();
        if (saveWantManipulators !== currWantManipulators)
          IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, currWantManipulators ? ManipulatorToolEvent.Start : ManipulatorToolEvent.Stop);
        changed = true;
      }
    }
    if (updatedValue.propertyName === SelectionTool._modesName) {
      this._selectionModeValue = updatedValue.value;
      if (this._selectionModeValue) {
        if (this.wantToolSettings())
          IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: SelectionTool._modesName, value: this._selectionModeValue });
        changed = true;
      }
    }
    if (changed)
      this.initSelectTool();
    return true; // return true if change is valid
  }
}
