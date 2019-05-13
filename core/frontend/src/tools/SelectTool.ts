/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SelectionSet */

import { Id64, Id64Arg } from "@bentley/bentleyjs-core";
import { Point2d, Point3d, Range2d } from "@bentley/geometry-core";
import { ColorDef } from "@bentley/imodeljs-common";
import { LocateFilterStatus, LocateResponse } from "../ElementLocateManager";
import { HitDetail } from "../HitDetail";
import { IModelApp } from "../IModelApp";
import { PropertyDescription } from "../properties/Description";
import { PropertyEditorParamTypes } from "../properties/EditorParams";
import { ToolSettingsPropertyRecord, ToolSettingsPropertySyncItem, ToolSettingsValue } from "../properties/ToolSettingsValue";
import { PrimitiveValue } from "../properties/Value";
import { Pixel } from "../rendering";
import { DecorateContext } from "../ViewContext";
import { ViewRect } from "../Viewport";
import { PrimitiveTool } from "./PrimitiveTool";
import { BeButton, BeButtonEvent, BeModifierKeys, BeTouchEvent, EventHandled, InputSource, CoordinateLockOverrides } from "./Tool";
import { ManipulatorToolEvent } from "./ToolAdmin";

/** The method for choosing elements with the [[SelectionTool]]
 * @public
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
  public static hidden = false;
  public static toolId = "Select";
  protected _isSelectByPoints = false;
  protected _isSuspended = false;
  protected readonly _points: Point3d[] = [];
  private _selectionMethodValue = new ToolSettingsValue(SelectionMethod.Pick);
  private _selectionModeValue = new ToolSettingsValue(SelectionMode.Replace);

  public requireWriteableTarget(): boolean { return false; }
  public autoLockTarget(): void { } // NOTE: For selecting elements we only care about iModel, so don't lock target model automatically.

  protected wantSelectionClearOnMiss(_ev: BeButtonEvent): boolean { return SelectionMode.Replace === this.selectionMode; }
  protected wantEditManipulators(): boolean { return SelectionMethod.Pick === this.selectionMethod; }
  protected wantPickableDecorations(): boolean { return this.wantEditManipulators(); } // Allow pickable decorations selection to be independent of manipulators...
  protected wantToolSettings(): boolean { return false; }

  public get selectionMethod(): SelectionMethod { return this._selectionMethodValue.value as SelectionMethod; }
  public set selectionMethod(method: SelectionMethod) { this._selectionMethodValue.value = method; }
  public get selectionMode(): SelectionMode { return this._selectionModeValue.value as SelectionMode; }
  public set selectionMode(mode: SelectionMode) { this._selectionModeValue.value = mode; }

  private static methodsMessage(str: string) { return IModelApp.i18n.translate("CoreTools:tools.ElementSet.SelectionMethods." + str); }
  private static _methodsName = "selectionMethods";
  /* The property descriptions used to generate ToolSettings UI. */
  private static _getMethodsDescription(): PropertyDescription {
    return {
      name: SelectionTool._methodsName,
      displayLabel: IModelApp.i18n.translate("CoreTools:tools.ElementSet.Prompts.Mode"),
      typename: "enum",
      editor: {
        name: "enum-buttongroup",
        params: [
          {
            type: PropertyEditorParamTypes.ButtonGroupData,
            buttons: [
              { iconClass: "icon icon-select-single" },
              { iconClass: "icon icon-select-line" },
              { iconClass: "icon icon-select-box" },
            ],
          },
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

  private static modesMessage(str: string) { return IModelApp.i18n.translate("CoreTools:tools.ElementSet.SelectionModes." + str); }
  private static _modesName = "selectionModes";
  /* The property descriptions used to generate ToolSettings UI. */
  private static _getModesDescription(): PropertyDescription {
    return {
      name: SelectionTool._modesName,
      displayLabel: "",
      typename: "enum",
      editor: {
        name: "enum-buttongroup",
        params: [
          {
            type: PropertyEditorParamTypes.ButtonGroupData,
            buttons: [
              { iconClass: "icon icon-replace" },
              { iconClass: "icon icon-select-plus" },
              {
                iconClass: "icon icon-select-minus",
                isEnabledFunction: () => { const tool = IModelApp.toolAdmin.activeTool; return tool instanceof PrimitiveTool ? tool.iModel.selectionSet.isActive : false; },
              },
            ],
          },
          {
            type: PropertyEditorParamTypes.SuppressEditorLabel,
            suppressLabelPlaceholder: true,
          },
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
    let msg = "IdentifyElement";
    switch (mode) {
      case SelectionMode.Replace:
        switch (method) {
          case SelectionMethod.Line:
            msg = "IdentifyLine";
            break;
          case SelectionMethod.Box:
            msg = "IdentifyBox";
            break;
        }
        break;
      case SelectionMode.Add:
        switch (method) {
          case SelectionMethod.Pick:
            msg = "IdentifyElementAdd";
            break;
          case SelectionMethod.Line:
            msg = "IdentifyLineAdd";
            break;
          case SelectionMethod.Box:
            msg = "IdentifyBoxAdd";
            break;
        }
        break;
      case SelectionMode.Remove:
        switch (method) {
          case SelectionMethod.Pick:
            msg = "IdentifyElementRemove";
            break;
          case SelectionMethod.Line:
            msg = "IdentifyLineRemove";
            break;
          case SelectionMethod.Box:
            msg = "IdentifyBoxRemove";
            break;
        }
        break;
    }

    IModelApp.notifications.outputPromptByKey("CoreTools:tools.ElementSet.Prompts." + msg);
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

    const vp = context.viewport!;
    const bestContrastIsBlack = (ColorDef.black === vp.getContrastToBackgroundColor());
    const crossingLine = (SelectionMethod.Line === this.selectionMethod || (SelectionMethod.Pick === this.selectionMethod && BeButton.Reset === ev.button));
    const overlapSelection = (crossingLine || this.useOverlapSelection(ev));

    const position = vp.worldToView(this._points[0]); position.x = Math.floor(position.x) + 0.5; position.y = Math.floor(position.y) + 0.5;
    const position2 = vp.worldToView(ev.point); position2.x = Math.floor(position2.x) + 0.5; position2.y = Math.floor(position2.y) + 0.5;
    const offset = position2.minus(position);

    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = bestContrastIsBlack ? "black" : "white";
      ctx.lineWidth = 1;
      if (overlapSelection) ctx.setLineDash([5, 5]);
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

  protected selectByPointsProcess(origin: Point3d, corner: Point3d, ev: BeButtonEvent, method: SelectionMethod, overlap: boolean) {
    const vp = ev.viewport;
    if (!vp)
      return;
    const pts: Point2d[] = [];
    pts[0] = new Point2d(Math.floor(origin.x + 0.5), Math.floor(origin.y + 0.5));
    pts[1] = new Point2d(Math.floor(corner.x + 0.5), Math.floor(corner.y + 0.5));
    const range = Range2d.createArray(pts);

    const rect = new ViewRect();
    rect.initFromRange(range);
    vp.readPixels(rect, Pixel.Selector.Feature, (pixels) => {
      if (undefined === pixels)
        return;

      let contents = new Set<string>();
      const testPoint = Point2d.createZero();

      if (SelectionMethod.Box === method) {
        const outline = overlap ? undefined : new Set<string>();
        const offset = range.clone();
        offset.expandInPlace(-2);
        for (testPoint.x = range.low.x; testPoint.x <= range.high.x; ++testPoint.x) {
          for (testPoint.y = range.low.y; testPoint.y <= range.high.y; ++testPoint.y) {
            const pixel = pixels.getPixel(testPoint.x, testPoint.y);
            if (undefined === pixel || undefined === pixel.elementId || Id64.isInvalid(pixel.elementId))
              continue; // no geometry at this location...
            if (undefined !== outline && !offset.containsPoint(testPoint))
              outline.add(pixel.elementId.toString());
            else
              contents.add(pixel.elementId.toString());
          }
        }
        if (undefined !== outline && 0 !== outline.size) {
          const inside = new Set<string>();
          contents.forEach((id) => { if (!outline.has(id)) inside.add(id); });
          contents = inside;
        }
      } else {
        const closePoint = Point2d.createZero();
        for (testPoint.x = range.low.x; testPoint.x <= range.high.x; ++testPoint.x) {
          for (testPoint.y = range.low.y; testPoint.y <= range.high.y; ++testPoint.y) {
            const pixel = pixels.getPixel(testPoint.x, testPoint.y);
            if (undefined === pixel || undefined === pixel.elementId || Id64.isInvalid(pixel.elementId))
              continue; // no geometry at this location...
            const fraction = testPoint.fractionOfProjectionToLine(pts[0], pts[1], 0.0);
            pts[0].interpolate(fraction, pts[1], closePoint);
            if (closePoint.distance(testPoint) < 1.5)
              contents.add(pixel.elementId.toString());
          }
        }
      }

      if (!this.wantPickableDecorations())
        contents.forEach((id) => { if (Id64.isTransient(id)) contents.delete(id); });

      if (0 === contents.size) {
        if (!ev.isControlKey && this.wantSelectionClearOnMiss(ev)) {
          this.iModel.selectionSet.emptyAll();
          this.syncSelectionMode();
        }
        return;
      }

      switch (this.selectionMode) {
        case SelectionMode.Replace:
          if (!ev.isControlKey)
            this.processSelection(contents, SelectionProcessing.ReplaceSelectionWithElement); // tslint:disable-line:no-floating-promises
          else
            this.processSelection(contents, SelectionProcessing.InvertElementInSelection); // tslint:disable-line:no-floating-promises
          break;
        case SelectionMode.Add:
          this.processSelection(contents, SelectionProcessing.AddElementToSelection); // tslint:disable-line:no-floating-promises
          break;
        case SelectionMode.Remove:
          this.processSelection(contents, SelectionProcessing.RemoveElementFromSelection); // tslint:disable-line:no-floating-promises
          break;
      }
    }, true);
  }

  protected selectByPointsStart(ev: BeButtonEvent): boolean {
    if (BeButton.Data !== ev.button && BeButton.Reset !== ev.button)
      return false;
    this._points.length = 0;
    this._points.push(ev.point.clone());
    this._isSelectByPoints = true;
    IModelApp.accuSnap.enableLocate(false);
    IModelApp.toolAdmin.setLocateCircleOn(false);
    return true;
  }

  protected selectByPointsEnd(ev: BeButtonEvent): boolean {
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
      this.selectByPointsProcess(origin, corner, ev, SelectionMethod.Line, true);
    else
      this.selectByPointsProcess(origin, corner, ev, SelectionMethod.Box, this.useOverlapSelection(ev));

    this.initSelectTool();
    vp.invalidateDecorations();
    return true;
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined !== ev.viewport && this._isSelectByPoints)
      ev.viewport.invalidateDecorations();
  }

  public async selectDecoration(ev: BeButtonEvent, currHit?: HitDetail): Promise<EventHandled> {
    if (undefined === currHit)
      currHit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);

    if (undefined !== currHit && !currHit.isElementHit)
      return IModelApp.viewManager.onDecorationButtonEvent(currHit, ev);

    return EventHandled.No;
  }

  public async onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    IModelApp.accuSnap.clear(); // Need to test hit at start drag location, not current AccuSnap...
    if (EventHandled.Yes === await this.selectDecoration(ev))
      return EventHandled.Yes;
    if (InputSource.Touch === ev.inputSource && SelectionMethod.Pick === this.selectionMethod)
      return EventHandled.No; // Require method change for line/box selection...allow IdleTool to handle touch move...
    return this.selectByPointsStart(ev) ? EventHandled.Yes : EventHandled.No;
  }

  public async onMouseEndDrag(ev: BeButtonEvent): Promise<EventHandled> {
    return this.selectByPointsEnd(ev) ? EventHandled.Yes : EventHandled.No;
  }

  public async onDataButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.No;

    if (this.selectByPointsEnd(ev))
      return EventHandled.Yes;

    if (SelectionMethod.Pick !== this.selectionMethod) {
      if (!ev.isControlKey && this.wantSelectionClearOnMiss(ev)) {
        this.iModel.selectionSet.emptyAll();
        this.syncSelectionMode();
      }
      if (InputSource.Touch !== ev.inputSource)
        this.selectByPointsStart(ev); // Require touch move and not tap to start crossing line/box selection...
      return EventHandled.Yes;
    }

    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (hit !== undefined) {
      if (EventHandled.Yes === await this.selectDecoration(ev, hit))
        return EventHandled.Yes;

      switch (this.selectionMode) {
        case SelectionMode.Replace:
          this.processSelection(hit.sourceId, ev.isControlKey ? SelectionProcessing.InvertElementInSelection : SelectionProcessing.ReplaceSelectionWithElement); // tslint:disable-line:no-floating-promises
          break;

        case SelectionMode.Add:
          this.processSelection(hit.sourceId, SelectionProcessing.AddElementToSelection); // tslint:disable-line:no-floating-promises
          break;

        case SelectionMode.Remove:
          this.processSelection(hit.sourceId, SelectionProcessing.RemoveElementFromSelection); // tslint:disable-line:no-floating-promises
          break;
      }
      return EventHandled.Yes;
    }

    if (!ev.isControlKey && 0 !== this.iModel.selectionSet.size && this.wantSelectionClearOnMiss(ev)) {
      this.iModel.selectionSet.emptyAll();
      this.syncSelectionMode();
    }

    return EventHandled.Yes;
  }

  public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    if (this._isSelectByPoints) {
      if (undefined !== ev.viewport)
        ev.viewport.invalidateDecorations();
      this.initSelectTool();
      return EventHandled.Yes;
    }

    // Check for overlapping hits...
    const lastHit = SelectionMode.Remove === this.selectionMode ? undefined : IModelApp.locateManager.currHit;
    if (lastHit && this.iModel.selectionSet.has(lastHit.sourceId)) {
      const autoHit = IModelApp.accuSnap.currHit;

      // Play nice w/auto-locate, only remove previous hit if not currently auto-locating or over previous hit
      if (undefined === autoHit || autoHit.isSameHit(lastHit)) {
        const response = new LocateResponse();
        const nextHit = await IModelApp.locateManager.doLocate(response, false, ev.point, ev.viewport, ev.inputSource);

        // remove element(s) previously selected if in replace mode, or if we have a next element in add mode
        if (SelectionMode.Replace === this.selectionMode || undefined !== nextHit)
          this.processSelection(lastHit.sourceId, SelectionProcessing.RemoveElementFromSelection); // tslint:disable-line:no-floating-promises

        // add element(s) located via reset button
        if (undefined !== nextHit)
          this.processSelection(nextHit.sourceId, SelectionProcessing.AddElementToSelection); // tslint:disable-line:no-floating-promises
        return EventHandled.Yes;
      }
    }

    if (EventHandled.Yes === await this.selectDecoration(ev, IModelApp.accuSnap.currHit))
      return EventHandled.Yes;

    IModelApp.accuSnap.resetButton(); // tslint:disable-line:no-floating-promises
    return EventHandled.Yes;
  }

  public onSuspend(): void { this._isSuspended = true; if (this.wantEditManipulators()) IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Suspend); }
  public onUnsuspend(): void { this._isSuspended = false; if (this.wantEditManipulators()) IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Unsuspend); this.showPrompt(this.selectionMode, this.selectionMethod); } // TODO: Tool assistance...

  public async onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled> {
    if (startEv.isSingleTouch && !this._isSelectByPoints)
      await IModelApp.toolAdmin.convertTouchMoveStartToButtonDownAndMotion(startEv, ev);
    return (this._isSuspended || this._isSelectByPoints) ? EventHandled.Yes : EventHandled.No;
  }

  public async onTouchMove(ev: BeTouchEvent): Promise<void> { if (this._isSelectByPoints) return IModelApp.toolAdmin.convertTouchMoveToMotion(ev); }
  public async onTouchComplete(ev: BeTouchEvent): Promise<void> { if (this._isSelectByPoints) return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev); }
  public async onTouchCancel(ev: BeTouchEvent): Promise<void> { if (this._isSelectByPoints) return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev, BeButton.Reset); }

  public decorate(context: DecorateContext): void { this.selectByPointsDecorate(context); }

  public async onModifierKeyTransition(_wentDown: boolean, modifier: BeModifierKeys, _event: KeyboardEvent): Promise<EventHandled> {
    return (modifier === BeModifierKeys.Shift && this._isSelectByPoints) ? EventHandled.Yes : EventHandled.No;
  }

  public async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    if (!this.wantPickableDecorations() && !hit.isElementHit)
      return LocateFilterStatus.Reject;

    const mode = this.selectionMode;
    if (SelectionMode.Replace === mode)
      return LocateFilterStatus.Accept;

    const isSelected = this.iModel.selectionSet.has(hit.sourceId);
    return ((SelectionMode.Add === mode ? !isSelected : isSelected) ? LocateFilterStatus.Accept : LocateFilterStatus.Reject);
  }

  public onRestartTool(): void { this.exitTool(); }

  public onCleanup(): void {
    if (this.wantEditManipulators())
      IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Stop);
  }

  public onPostInstall(): void {
    super.onPostInstall();
    if (!this.targetView)
      return;
    if (this.wantEditManipulators())
      IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Start);
    this.initSelectTool();
  }

  public static startTool(): boolean { return new SelectionTool().run(); }

  private syncSelectionMode(): void {
    if (SelectionMode.Remove === this.selectionMode && !this.iModel.selectionSet.isActive) {
      // No selection active resetting selection mode since there is nothing to Remove
      this.selectionMode = SelectionMode.Replace;
      this.initSelectTool();
    }
    const syncMode: ToolSettingsPropertySyncItem = { value: this._selectionModeValue.clone(), propertyName: SelectionTool._modesName };
    this.syncToolSettingsProperties([syncMode]);
  }

  /** Used to supply DefaultToolSettingProvider with a list of properties to use to generate ToolSettings.  If undefined then no ToolSettings will be displayed
   * @beta
   */
  public supplyToolSettingsProperties(): ToolSettingsPropertyRecord[] | undefined {
    if (!this.wantToolSettings())
      return undefined;
    const toolSettings = new Array<ToolSettingsPropertyRecord>();
    // generate 3 columns - label will be placed in column 0 and button group editors in columns 1 and 2.
    toolSettings.push(new ToolSettingsPropertyRecord(this._selectionMethodValue.clone() as PrimitiveValue, SelectionTool._getMethodsDescription(), { rowPriority: 0, columnIndex: 1 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._selectionModeValue.clone() as PrimitiveValue, SelectionTool._getModesDescription(), { rowPriority: 0, columnIndex: 2 }));
    return toolSettings;
  }

  /** Used to send changes from UI back to Tool
   * @beta
   */
  public applyToolSettingPropertyChange(updatedValue: ToolSettingsPropertySyncItem): boolean {
    let changed = false;
    if (updatedValue.propertyName === SelectionTool._methodsName) {
      const saveWantManipulators = this.wantEditManipulators();
      if (this._selectionMethodValue.update(updatedValue.value)) {
        const currWantManipulators = this.wantEditManipulators();
        if (saveWantManipulators !== currWantManipulators)
          IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, currWantManipulators ? ManipulatorToolEvent.Start : ManipulatorToolEvent.Stop);
        changed = true;
      }
    }
    if (updatedValue.propertyName === SelectionTool._modesName) {
      if (this._selectionModeValue.update(updatedValue.value)) {
        changed = true;
      }
    }
    if (changed)
      this.initSelectTool();
    return true; // return true if change is valid
  }
}
