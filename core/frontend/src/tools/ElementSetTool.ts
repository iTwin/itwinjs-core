/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { Id64, Id64Arg, Id64Array, Id64String } from "@bentley/bentleyjs-core";
import { Point2d, Point3d, Range2d } from "@bentley/geometry-core";
import { ColorDef } from "@bentley/imodeljs-common";
import { AccuDrawFlags } from "../AccuDraw";
import { LocateFilterStatus, LocateResponse } from "../ElementLocateManager";
import { HitDetail } from "../HitDetail";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { NotifyMessageDetails, OutputMessagePriority } from "../NotificationManager";
import { Pixel } from "../render/Pixel";
import { SelectionSet } from "../SelectionSet";
import { DecorateContext } from "../ViewContext";
import { Viewport } from "../Viewport";
import { ViewRect } from "../ViewRect";
import { PrimitiveTool } from "./PrimitiveTool";
import { SelectionMethod } from "./SelectTool";
import { BeButton, BeButtonEvent, BeModifierKeys, CoreTools, EventHandled } from "./Tool";
import { ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction, ToolAssistanceSection } from "./ToolAssistance";

/** @alpha */
export enum ModifyElementSource {
  /** The source for the element is unknown - not caused by a modification command. */
  Unknown = 0,
  /** The element is selected by the user. */
  Selected = 1,
  /** The element is processed because it is in the selection set. */
  SelectionSet = 2, // eslint-disable-line @typescript-eslint/no-shadow
  /** The element is selected by the user using drag box or crossing line selection. */
  DragSelect = 3,
}

/** @alpha */
export interface GroupMark {
  start: number;
  source: ModifyElementSource;
}

/** @alpha */
export class ElementAgenda {
  public readonly elements: Id64Array = [];
  public readonly groupMarks: GroupMark[] = [];
  public manageHiliteState = true; // Whether entries are hilited/unhilited as they are added/removed...
  public constructor(public iModel: IModelConnection) { }

  /** Get the source for this ElementAgenda, if applicable. The "source" is merely an indication of what the collection of elements represents. */
  public getSource() { return this.groupMarks.length === 0 ? ModifyElementSource.Unknown : this.groupMarks[this.groupMarks.length - 1].source; }

  /** Set the source for this ElementAgenda. */
  public setSource(val: ModifyElementSource) { if (this.groupMarks.length > 0) this.groupMarks[this.groupMarks.length - 1].source = val; }

  public get isEmpty() { return this.length === 0; }
  public get count() { return this.length; }
  public get length() { return this.elements.length; }

  /** Empties this ElementAgenda and clears hilite state when manageHiliteState is true. */
  public clear() { this.setEntriesHiliteState(false); this.elements.length = 0; this.groupMarks.length = 0; }

  private setEntriesHiliteState(onOff: boolean, groupStart = 0, groupEnd = 0) {
    if (!this.manageHiliteState)
      return;

    const ss = this.iModel.selectionSet.isActive ? this.iModel.selectionSet.elements : undefined;
    if (undefined === ss && 0 === groupEnd) {
      this.iModel.hilited.setHilite(this.elements, onOff);
      return;
    }

    const shouldChangeHilite = (id: string, index: number) => {
      if (undefined !== ss && ss.has(id))
        return false; // Don't turn hilite on/off for elements in current selection set...
      return (0 === groupEnd || (index >= groupStart && index < groupEnd));
    };

    const group = this.elements.filter((id, index) => shouldChangeHilite(id, index));
    this.iModel.hilited.setHilite(group, onOff);
  }

  /** Removes the last group of elements added to this ElementAgenda. */
  public popGroup() {
    if (this.groupMarks.length <= 1) {
      this.clear();
      return;
    }
    const group = this.groupMarks.pop()!;
    this.setEntriesHiliteState(false, group.start, this.length); // make sure removed entries aren't left hilited...
    this.elements.splice(group.start);
  }

  /** Return true if elementId is already in this ElementAgenda. */
  public has(id: string) { return this.elements.some((entry) => id === entry); }

  /** Return true if elementId is already in this ElementAgenda. */
  public find(id: Id64String) { return this.has(id); }

  /** Add elements to this ElementAgenda. */
  public add(arg: Id64Arg) {
    const groupStart = this.length;
    Id64.forEach(arg, (id) => {
      if (!this.has(id))
        this.elements.push(id);
    });

    if (groupStart === this.length)
      return false;

    this.groupMarks.push({ start: groupStart, source: ModifyElementSource.Unknown });
    this.setEntriesHiliteState(true, groupStart, this.length);

    return true;
  }

  private removeOne(id: string) {
    let pos = -1;
    const elements = this.elements;
    const groupMarks = this.groupMarks;

    elements.some((entry, index) => { if (id !== entry) return false; pos = index; return true; });
    if (pos === -1)
      return false;

    if (1 === elements.length || (1 === groupMarks.length && ModifyElementSource.DragSelect !== groupMarks[groupMarks.length - 1].source)) {
      this.clear();
      return true;
    }

    const groupIndex = pos;
    let groupStart = 0, groupEnd = 0;
    let markToErase = 0;
    let removeSingleEntry = false;

    for (let iMark = 0; iMark < groupMarks.length; ++iMark) {
      if (0 === groupEnd) {
        if (iMark + 1 === groupMarks.length) {
          markToErase = iMark;
          removeSingleEntry = (ModifyElementSource.DragSelect === groupMarks[iMark].source);
          groupStart = groupMarks[iMark].start;
          groupEnd = elements.length;
        } else if (groupMarks[iMark].start <= groupIndex && groupMarks[iMark + 1].start > groupIndex) {
          markToErase = iMark;
          removeSingleEntry = (ModifyElementSource.DragSelect === groupMarks[iMark].source);
          groupStart = groupMarks[iMark].start;
          groupEnd = groupMarks[iMark + 1].start;
        }

        continue;
      }

      if (removeSingleEntry)
        groupMarks[iMark].start -= 1; // Only removing single entry, not entire group...
      else
        groupMarks[iMark].start -= (groupEnd - groupStart); // Adjust indices...
    }

    if (removeSingleEntry) { // Only remove single entry...
      this.setEntriesHiliteState(false, groupIndex, groupIndex + 1); // make sure removed entry isn't left hilited...

      elements.splice(groupIndex, 1);

      if (groupEnd === groupStart + 1)
        groupMarks.splice(markToErase, 1);

      return true;
    }

    this.setEntriesHiliteState(false, groupStart, groupEnd); // make sure removed entries aren't left hilited...

    elements.splice(groupStart, groupEnd - groupStart);
    groupMarks.splice(markToErase, 1);
    return true;
  }

  public remove(arg: Id64Arg) {
    if (0 === this.length)
      return false;

    if (0 === Id64.sizeOf(arg))
      return false;

    let changed = false;
    Id64.forEach(arg, (elId) => { if (this.removeOne(elId)) changed = true; }); // NOTE: Removes group associated with this element, not just a single entry...

    return changed;
  }

  /** Add elements not currently in the ElementAgenda and remove elements currently in the ElementAgenda. */
  public invert(arg: Id64Arg) {
    if (0 === this.length)
      return this.add(arg);

    if (0 === Id64.sizeOf(arg))
      return false;

    const adds: string[] = [];
    const removes: string[] = [];
    Id64.forEach(arg, (id) => { if (this.has(id)) removes.push(id); else adds.push(id); });
    if (adds.length === 0 && removes.length === 0)
      return false;

    removes.forEach((id) => this.removeOne(id));

    if (adds.length > 0) {
      const groupStart = this.length;
      adds.forEach((id) => this.elements.push(id));
      this.groupMarks.push({ start: groupStart, source: ModifyElementSource.Unknown });

      this.setEntriesHiliteState(true, groupStart, this.length); // make sure added entries are hilited (when not also removing)...
    }

    return true;
  }
}

/** @alpha */
export abstract class ElementSetTool extends PrimitiveTool {
  private _agenda?: ElementAgenda;
  private _useSelectionSet: boolean = false;
  private _processDataButtonUp: boolean = false;
  protected anchorPoint?: Point3d; // Accept point for selection set, drag select, or final located element...
  protected dragStartPoint?: Point3d;

  /** Get the ElementAgenda the tool will operate on. */
  protected get agenda(): ElementAgenda {
    if (undefined === this._agenda)
      this._agenda = new ElementAgenda(this.iModel);
    return this._agenda;
  }

  /** Convenience method to get current ElementAgenda entry count. */
  protected get currentElementCount(): number { return undefined !== this._agenda ? this._agenda.count : 0; }

  /** Minimum required number of elements for tool to be able to complete. */
  protected get requiredElementCount(): number { return 1; }

  /** Support identifying elements using ctrl+left drag for box selection or ctrl+right drag for crossing line selection. */
  protected get allowDragSelect(): boolean { return false; }

  /** Support picking assemblies or groups independent of selection scope. */
  protected get allowGroups(): boolean { return false; }

  /** Whether the ElementAgenda should be populated from an active selection set. */
  protected get allowSelectionSet(): boolean { return false; }

  /** Whether to clear the active selection set for a tool that doesn't support selection sets. */
  protected get clearSelectionSet(): boolean { return !this.allowSelectionSet; }

  /** Whether a selection set should be processed immediately upon installation or require a data button to accept. */
  protected get requireAcceptForSelectionSetOperation(): boolean { return true; }

  /** Whether to begin dynamics for a selection set immediately or wait for a data button. */
  protected get requireAcceptForSelectionSetDynamics(): boolean { return true; }

  /** Whether original source of elements being modified was the active selection set. */
  protected get isSelectionSetModify(): boolean { return this._useSelectionSet; }

  /** Whether drag box or crossing line selection is currently active. */
  protected get isSelectByPoints(): boolean { return undefined !== this.dragStartPoint; }

  /** Convenience method to check whether control key is currently down w/o having a button event. */
  protected get isControlDown(): boolean { return IModelApp.toolAdmin.currentInputState.isControlDown; }

  /** Whether to continue selection of additional elements by holding the ctrl key down. */
  protected get controlKeyContinuesSelection(): boolean { return false; }

  /** Whether to invert selection of elements identified with the ctrl key held down. */
  protected get controlKeyInvertsSelection(): boolean { return this.controlKeyContinuesSelection; }

  /** Whether to enable AccuSnap. */
  protected get wantAccuSnap(): boolean { return false; }

  /** Whether to start element dynamics after all requested elements have been identified. */
  protected get wantDynamics(): boolean { return false; }

  /** Whether tool is done identifying elements and is ready to move to the next phase. */
  protected get wantAdditionalElements(): boolean {
    if (this.isSelectionSetModify)
      return false;

    if (this.currentElementCount < this.requiredElementCount)
      return true;

    // A defined anchor indicates input collection phase has begun and ctrl should no longer continue selection...
    return undefined === this.anchorPoint && this.controlKeyContinuesSelection && this.isControlDown;
  }

  /** Whether the tool has gathered enough input to complete. Sub-classes should override to check for additional point input collected by wantProcessAgenda. */
  protected get wantAdditionalInput(): boolean { return (!this.isDynamicsStarted && this.wantDynamics); } // Dynamics requires accept to have a chance to preview result...

  /** Whether the tool is ready for processAgenda to be called to complete the tool operation. Sub-classes should override to collect additional point input before calling super or wantAdditionalInput. */
  protected wantProcessAgenda(_ev: BeButtonEvent): boolean { return !this.wantAdditionalInput; }

  /** Whether tool should operate on an existing selection set or instead prompt user to identity elements. */
  protected setPreferredElementSource(): void {
    this._useSelectionSet = false;
    if (!this.iModel.selectionSet.isActive)
      return;
    if (this.allowSelectionSet && this.iModel.selectionSet.size >= this.requiredElementCount)
      this._useSelectionSet = true;
    else if (this.clearSelectionSet)
      this.iModel.selectionSet.emptyAll();
  }

  /** Get element ids to process from the active selection set. Sub-classes may override to support selection scopes or apply tool specific filtering. */
  protected async getSelectionSetCandidates(ss: SelectionSet): Promise<Id64Arg> {
    const ids = new Set<Id64String>();
    ss.elements.forEach((val) => { if (this.isElementIdValid(val, ModifyElementSource.SelectionSet)) ids.add(val); });
    return ids;
  }

  protected async buildSelectionSetAgenda(ss: SelectionSet): Promise<boolean> {
    const candidates = await this.getSelectionSetCandidates(ss);

    if (Id64.sizeOf(candidates) < this.requiredElementCount || !this.agenda.add(candidates)) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, CoreTools.translate("ElementSet.Error.NoSSElems")));
      return false;
    }

    this.agenda.setSource(ModifyElementSource.SelectionSet);
    await this.onAgendaModified();
    return true;
  }

  /** Get element id(s) to process from a HitDetail already accepted by isElementValidForOperation. Sub-classes may override to support selection scopes. */
  protected async getLocateCandidates(hit: HitDetail): Promise<Id64Arg> {
    if (!this.allowGroups)
      return hit.sourceId;

    const ids = new Set<Id64String>();
    ids.add(hit.sourceId);

    try {
      const ecsql = `SELECT ECInstanceId as id, Parent.Id as parentId FROM BisCore.GeometricElement WHERE Parent.Id IN (SELECT Parent.Id as parentId FROM BisCore.GeometricElement WHERE parent.Id != 0 AND ECInstanceId IN (${hit.sourceId}))`;
      for await (const row of this.iModel.query(ecsql)) {
        ids.add(row.parentId as Id64String);
        ids.add(row.id as Id64String);
      }
    } catch { }

    return ids;
  }

  protected async buildLocateAgenda(hit: HitDetail): Promise<boolean> {
    if (this.agenda.find(hit.sourceId)) {
      if (this.isControlDown && this.controlKeyInvertsSelection && this.agenda.remove(hit.sourceId)) {
        await this.onAgendaModified();
        return true;
      }
      return false;
    }

    const candidates = await this.getLocateCandidates(hit);

    if (!this.agenda.add(candidates))
      return false;

    this.agenda.setSource(ModifyElementSource.Selected);
    await this.onAgendaModified();
    return true;
  }

  /** Get element ids to process from drag box or crossing line selection. Sub-classes may override to support selection scopes or apply tool specific filtering. */
  protected async getDragSelectCandidates(vp: Viewport, origin: Point3d, corner: Point3d, method: SelectionMethod, overlap: boolean): Promise<Id64Arg> {
    let contents = new Set<Id64String>();

    // TODO: Include option to use IModelConnection.getGeometryContainment instead of readPixels. No/Yes/2dOnly...
    const pts: Point2d[] = [];
    pts[0] = new Point2d(Math.floor(origin.x + 0.5), Math.floor(origin.y + 0.5));
    pts[1] = new Point2d(Math.floor(corner.x + 0.5), Math.floor(corner.y + 0.5));
    const range = Range2d.createArray(pts);

    const rect = new ViewRect();
    rect.initFromRange(range);
    vp.readPixels(rect, Pixel.Selector.Feature, (pixels) => {
      if (undefined === pixels)
        return;

      const sRange = Range2d.createNull();
      sRange.extendPoint(Point2d.create(vp.cssPixelsToDevicePixels(range.low.x), vp.cssPixelsToDevicePixels(range.low.y)));
      sRange.extendPoint(Point2d.create(vp.cssPixelsToDevicePixels(range.high.x), vp.cssPixelsToDevicePixels(range.high.y)));

      pts[0].x = vp.cssPixelsToDevicePixels(pts[0].x);
      pts[0].y = vp.cssPixelsToDevicePixels(pts[0].y);

      pts[1].x = vp.cssPixelsToDevicePixels(pts[1].x);
      pts[1].y = vp.cssPixelsToDevicePixels(pts[1].y);

      const testPoint = Point2d.createZero();

      const getPixelElementId = (pixel: Pixel.Data) => {
        if (undefined === pixel.elementId || Id64.isInvalid(pixel.elementId))
          return undefined; // no geometry at this location...

        if (!vp.isPixelSelectable(pixel))
          return undefined; // reality model, terrain, etc - not selectable

        if (!this.isElementIdValid(pixel.elementId, ModifyElementSource.DragSelect))
          return undefined;

        return pixel.elementId;
      };

      if (SelectionMethod.Box === method) {
        const outline = overlap ? undefined : new Set<string>();
        const offset = sRange.clone();
        offset.expandInPlace(-2);
        for (testPoint.x = sRange.low.x; testPoint.x <= sRange.high.x; ++testPoint.x) {
          for (testPoint.y = sRange.low.y; testPoint.y <= sRange.high.y; ++testPoint.y) {
            const pixel = pixels.getPixel(testPoint.x, testPoint.y);
            const elementId = getPixelElementId(pixel);
            if (undefined === elementId)
              continue;

            if (undefined !== outline && !offset.containsPoint(testPoint))
              outline.add(elementId.toString());
            else
              contents.add(elementId.toString());
          }
        }
        if (undefined !== outline && 0 !== outline.size) {
          const inside = new Set<string>();
          contents.forEach((id) => { if (!outline.has(id)) inside.add(id); });
          contents = inside;
        }
      } else {
        const closePoint = Point2d.createZero();
        for (testPoint.x = sRange.low.x; testPoint.x <= sRange.high.x; ++testPoint.x) {
          for (testPoint.y = sRange.low.y; testPoint.y <= sRange.high.y; ++testPoint.y) {
            const pixel = pixels.getPixel(testPoint.x, testPoint.y);
            const elementId = getPixelElementId(pixel);
            if (undefined === elementId)
              continue;

            const fraction = testPoint.fractionOfProjectionToLine(pts[0], pts[1], 0.0);
            pts[0].interpolate(fraction, pts[1], closePoint);
            if (closePoint.distance(testPoint) < 1.5)
              contents.add(elementId.toString());
          }
        }
      }
    }, true);

    return contents;
  }

  protected async buildDragSelectAgenda(vp: Viewport, origin: Point3d, corner: Point3d, method: SelectionMethod, overlap: boolean): Promise<boolean> {
    const candidates = await this.getDragSelectCandidates(vp, origin, corner, method, overlap);

    if (!this.isControlDown || !this.controlKeyInvertsSelection) {
      if (!this.agenda.add(candidates))
        return false;
    } else {
      if (!this.agenda.invert(candidates))
        return false;
    }

    if (ModifyElementSource.Unknown === this.agenda.getSource())
      this.agenda.setSource(ModifyElementSource.DragSelect); // Don't set source if invert only removed entries...

    await this.onAgendaModified();
    return true;
  }

  /** Quick id validity check, sub-classes that wish to allow pickable decorations from selection sets can override. */
  protected isElementIdValid(id: Id64String, source: ModifyElementSource): boolean {
    switch (source) {
      case ModifyElementSource.Selected:
        return true; // Locate options already checked prior to calling isElementValidForOperation...
      case ModifyElementSource.SelectionSet:
        return (!Id64.isInvalid(id) && !Id64.isTransient(id)); // Locate options are invalid, locate isn't enabled when processing a selection set...
      case ModifyElementSource.DragSelect:
        return (!Id64.isInvalid(id) && (IModelApp.locateManager.options.allowDecorations || !Id64.isTransient(id))); // Locate options are valid but have not yet been checked...
      default:
        return false;
    }
  }

  /** Sub-classes should override to apply tool specific filtering and to provide an explanation for rejection. */
  protected async isElementValidForOperation(hit: HitDetail, _out?: LocateResponse): Promise<boolean> {
    return this.isElementIdValid(hit.sourceId, ModifyElementSource.Selected);
  }

  /** Called from doLocate as well as auto-locate to accept or reject elements under the cursor. */
  public async filterHit(hit: HitDetail, out?: LocateResponse): Promise<LocateFilterStatus> {
    // Support deselect using control key and don't show "not" cursor over an already selected element...
    if (undefined !== this._agenda && this._agenda.find(hit.sourceId)) {
      const status = (this.isControlDown || !this.controlKeyInvertsSelection) ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
      if (out && LocateFilterStatus.Reject === status)
        out.explanation = CoreTools.translate(`ElementSet.Error.AlreadySelected`);
      return status;
    }

    return await this.isElementValidForOperation(hit, out) ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }

  /** Identify an element and update the element agenda. */
  protected async doLocate(ev: BeButtonEvent, newSearch: boolean): Promise<boolean> {
    if (!newSearch)
      this.agenda.popGroup();

    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), newSearch, ev.point, ev.viewport, ev.inputSource);
    const changed = (undefined !== hit && await this.buildLocateAgenda(hit));

    if (!changed && !newSearch)
      await this.onAgendaModified(); // only change was popGroup...

    return changed || !newSearch;
  }

  protected useOverlapSelection(ev: BeButtonEvent): boolean {
    if (undefined === ev.viewport || undefined === this.dragStartPoint)
      return false;
    const pt1 = ev.viewport.worldToView(this.dragStartPoint);
    const pt2 = ev.viewport.worldToView(ev.point);
    const overlapMode = (pt1.x > pt2.x);
    return (ev.isShiftKey ? !overlapMode : overlapMode); // Shift inverts inside/overlap selection...
  }

  protected async selectByPointsStart(ev: BeButtonEvent): Promise<boolean> {
    if (BeButton.Data !== ev.button && BeButton.Reset !== ev.button)
      return false;

    if (!ev.isControlKey || !this.allowDragSelect || !this.wantAdditionalElements)
      return false;

    this.dragStartPoint = ev.point.clone();
    this.setupAndPromptForNextAction();
    return true;
  }

  protected async selectByPointsEnd(ev: BeButtonEvent): Promise<boolean> {
    if (undefined === this.dragStartPoint)
      return false;

    const vp = ev.viewport;
    if (vp === undefined) {
      this.dragStartPoint = undefined;
      this.setupAndPromptForNextAction();
      return false;
    }

    const origin = vp.worldToView(this.dragStartPoint);
    const corner = vp.worldToView(ev.point);
    if (BeButton.Reset === ev.button)
      await this.buildDragSelectAgenda(vp, origin, corner, SelectionMethod.Line, true);
    else
      await this.buildDragSelectAgenda(vp, origin, corner, SelectionMethod.Box, this.useOverlapSelection(ev));

    this.dragStartPoint = undefined;
    this.setupAndPromptForNextAction();
    vp.invalidateDecorations();
    return true;
  }

  protected selectByPointsDecorate(context: DecorateContext): void {
    if (undefined === this.dragStartPoint)
      return;

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    if (undefined === ev.viewport)
      return;

    const vp = context.viewport;
    const bestContrastIsBlack = (ColorDef.black === vp.getContrastToBackgroundColor());
    const crossingLine = (BeButton.Reset === ev.button);
    const overlapSelection = (crossingLine || this.useOverlapSelection(ev));

    const position = vp.worldToView(this.dragStartPoint); position.x = Math.floor(position.x) + 0.5; position.y = Math.floor(position.y) + 0.5;
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

  public decorate(context: DecorateContext): void { this.selectByPointsDecorate(context); }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined !== ev.viewport && this.isSelectByPoints)
      ev.viewport.invalidateDecorations();
  }

  public async onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    if (await this.selectByPointsStart(ev))
      return EventHandled.Yes;
    return super.onMouseStartDrag(ev);
  }

  public async onMouseEndDrag(ev: BeButtonEvent): Promise<EventHandled> {
    if (await this.selectByPointsEnd(ev))
      return EventHandled.Yes;
    return super.onMouseEndDrag(ev);
  }

  public async onModifierKeyTransition(_wentDown: boolean, modifier: BeModifierKeys, _event: KeyboardEvent): Promise<EventHandled> {
    if (this.isSelectionSetModify)
      return EventHandled.No;

    if (this.isSelectByPoints)
      return (BeModifierKeys.Shift === modifier ? EventHandled.Yes : EventHandled.No);

    if (BeModifierKeys.Control !== modifier || undefined !== this.anchorPoint || !this.controlKeyContinuesSelection)
      return EventHandled.No;

    if (this.currentElementCount < this.requiredElementCount && !this.wantAccuSnap)
      return EventHandled.No; // Can only early return if AccuSnap doesn't need to be disabled for ctrl selection...

    this.setupAndPromptForNextAction(); // Enable/disable auto-locate, AccuSnap, update prompts...
    return EventHandled.Yes;
  }

  /** Advance to next prelocated hit using auto-locate or change last accepted hit to next hit on a reset button event.
   * @returns EventHandled.Yes if onReinitalize was called to restart or exit tool.
   */
  protected async chooseNextHit(ev: BeButtonEvent): Promise<EventHandled> {
    if (this.isSelectionSetModify) {
      this.onReinitialize();
      return EventHandled.Yes;
    }

    if (0 !== this.currentElementCount) {
      let autoLocateChooseNext = false;

      if (this.wantAdditionalElements) {
        const lastHit = IModelApp.locateManager.currHit;
        const autoHit = IModelApp.accuSnap.currHit;

        // Choose next using auto-locate or normal locate?
        if (undefined !== autoHit && (undefined === lastHit || !autoHit.isSameHit(lastHit)))
          autoLocateChooseNext = true;
      }

      if (!autoLocateChooseNext) {
        await this.doLocate(ev, false);

        if (this.agenda.isEmpty) {
          this.onReinitialize();
          return EventHandled.Yes;
        }

        this.setupAndPromptForNextAction();
        return EventHandled.No;
      }
    }

    IModelApp.accuSnap.resetButton(); // eslint-disable-line @typescript-eslint/no-floating-promises
    return EventHandled.No;
  }

  /** Orchestrates updating the internal state of the tool on a reset button event.
   * @returns EventHandled.Yes if onReinitalize was called to restart or exit tool.
   */
  protected async processResetButton(ev: BeButtonEvent): Promise<EventHandled> {
    if (ev.isDown)
      return EventHandled.No;

    return this.chooseNextHit(ev);
  }

  public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    return this.processResetButton(ev);
  }

  public async onResetButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    return this.processResetButton(ev);
  }

  protected async gatherElements(ev: BeButtonEvent): Promise<EventHandled | undefined> {
    if (this.isSelectionSetModify) {
      if (this.agenda.isEmpty && !await this.buildSelectionSetAgenda(this.iModel.selectionSet)) {
        this.onReinitialize();
        return EventHandled.Yes;
      }
    }

    if (this.wantAdditionalElements) {
      if (ev.isDown && ev.isControlKey && this.allowDragSelect) {
        this._processDataButtonUp = true;
        return EventHandled.No; // Defer locate to up event so that box select can be initiated while over an element...
      }

      if (!await this.doLocate(ev, true))
        return EventHandled.No;

      if (this.wantAdditionalElements) {
        this.setupAndPromptForNextAction();
        return EventHandled.No; // Continue identifying elements...
      }
    }

    return undefined;
  }

  protected async gatherInput(ev: BeButtonEvent): Promise<EventHandled | undefined> {
    if (undefined === this.anchorPoint) {
      this.anchorPoint = ev.point.clone();
      IModelApp.accuDraw.setContext(AccuDrawFlags.AlwaysSetOrigin, this.anchorPoint);
    }

    if (!this.wantProcessAgenda(ev)) {
      if (this.wantDynamics)
        await this.initAgendaDynamics();
      this.setupAndPromptForNextAction();
      return EventHandled.No;
    }

    return undefined;
  }

  /** Orchestrates advancing the internal state of the tool on a data button event.
   * - Collect elements: Add to the element agenda until no additional elements are requested.
   * - Gather input: Initiates element dynamics and accepts additional points as required.
   * - Complete operation: Process agenda entries, restart or exit tool.
   * @returns EventHandled.Yes if onReinitalize was called to restart or exit tool.
   */
  protected async processDataButton(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.isDown && !this._processDataButtonUp)
      return EventHandled.No;
    this._processDataButtonUp = false;

    const elementStatus = await this.gatherElements(ev);
    if (undefined !== elementStatus)
      return elementStatus;

    const inputStatus = await this.gatherInput(ev);
    if (undefined !== inputStatus)
      return inputStatus;

    await this.processAgenda(ev);
    await this.onProcessComplete();
    return EventHandled.Yes;
  }

  public async onDataButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    return this.processDataButton(ev);
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    return this.processDataButton(ev);
  }

  protected async initAgendaDynamics(): Promise<boolean> {
    if (this.isDynamicsStarted)
      return false;
    this.beginDynamics();
    return true;
  }

  protected async onAgendaModified(): Promise<void> {}

  /** Sub-classes can override to continue with current agenda or restart after processing has completed. */
  protected async onProcessComplete(): Promise<void> { this.onReinitialize(); }

  /** Sub-classes that don't require or use an accept point should override to apply the tool operation to the agenda. */
  protected async processAgendaImmediate(): Promise<void> { }

  /** Sub-classes that require and use the accept point should override to apply the tool operation to the agenda. */
  protected async processAgenda(_ev: BeButtonEvent): Promise<void> { return this.processAgendaImmediate(); }

  protected async doProcessSelectionSetImmediate(): Promise<void> {
    const buildImmediate = (!this.requireAcceptForSelectionSetOperation || (this.wantDynamics && !this.requireAcceptForSelectionSetDynamics));
    if (!buildImmediate)
      return;

    if (!await this.buildSelectionSetAgenda(this.iModel.selectionSet)) {
      this.onReinitialize();
      return;
    }

    if (!this.requireAcceptForSelectionSetOperation) {
      await this.processAgendaImmediate();
      await this.onProcessComplete();
    } else {
      await this.initAgendaDynamics();
    }
  }

  public onPostInstall() {
    super.onPostInstall();
    this.setPreferredElementSource();
    this.setupAndPromptForNextAction();

    if (this.isSelectionSetModify)
      this.doProcessSelectionSetImmediate(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public onCleanup(): void {
    super.onCleanup();
    if (undefined !== this._agenda)
      this._agenda.clear();
  }

  public onReinitialize(): void {
    if (this.isSelectionSetModify) {
      this.exitTool();
      return;
    }
    this.onRestartTool();
  }

  public onUnsuspend(): void {
    this.provideToolAssistance();
  }

  protected get shouldEnableLocate(): boolean { return this.isSelectByPoints ? false : this.wantAdditionalElements; }
  protected get shouldEnableSnap(): boolean { return this.isSelectByPoints ? false : (this.wantAccuSnap && (!this.isControlDown || !this.controlKeyContinuesSelection || !this.wantAdditionalElements)); }

  protected setupAndPromptForNextAction(): void {
    this.initLocateElements(this.shouldEnableLocate, this.shouldEnableSnap);
    this.provideToolAssistance();
  }

  /** Sub-classes should override to provide tool specific instructions. */
  protected provideToolAssistance(mainInstrText?: string, additionalInstr?: ToolAssistanceInstruction[]): void {
    let mainMsg;
    let leftMsg;
    let rghtMsg;
    let addDragInstr = false;

    if (this.isSelectionSetModify) {
      if (this.wantAdditionalInput) {
        mainMsg = "ElementSet.Prompts.IdentifyPoint";
        leftMsg = "ElementSet.Inputs.AcceptPoint";
        rghtMsg = "ElementSet.Inputs.Exit";
      } else if (0 === this.currentElementCount) {
        mainMsg = "ElementSet.Prompts.ConfirmSelection";
        leftMsg = "ElementSet.Inputs.AcceptSelection";
        rghtMsg = "ElementSet.Inputs.RejectSelection";
      } else {
        mainMsg = "ElementSet.Inputs.Complete";
        leftMsg = "ElementSet.Inputs.Accept";
        rghtMsg = "ElementSet.Inputs.Exit";
      }
    } else {
      if (this.isSelectByPoints) {
        mainMsg = "ElementSet.Prompts.OppositeCorner";
        leftMsg = "ElementSet.Inputs.BoxCorners";
        rghtMsg = "ElementSet.Inputs.CrossingLine";
      } else if (this.wantAdditionalElements) {
        mainMsg = "ElementSet.Prompts.IdentifyElement";
        leftMsg = "ElementSet.Inputs.AcceptElement";
        rghtMsg = "ElementSet.Inputs.Cancel";
        addDragInstr = this.allowDragSelect;
      } else if (this.wantAdditionalInput) {
        mainMsg = "ElementSet.Prompts.IdentifyPoint";
        leftMsg = "ElementSet.Inputs.AcceptPoint";
        rghtMsg = "ElementSet.Inputs.Cancel";
      } else {
        mainMsg = "ElementSet.Inputs.Complete";
        leftMsg = "ElementSet.Inputs.Accept";
        rghtMsg = "ElementSet.Inputs.Restart";
      }
    }

    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, CoreTools.translate(leftMsg), false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, CoreTools.translate(leftMsg), false, ToolAssistanceInputMethod.Mouse));

    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, CoreTools.translate(rghtMsg), false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, CoreTools.translate(rghtMsg), false, ToolAssistanceInputMethod.Mouse));

    if (addDragInstr) {
      mouseInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.ctrlKey, ToolAssistanceImage.LeftClickDrag, CoreTools.translate("ElementSet.Inputs.BoxCorners"), false, ToolAssistanceInputMethod.Mouse));
      mouseInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.ctrlKey, ToolAssistanceImage.RightClickDrag, CoreTools.translate("ElementSet.Inputs.CrossingLine"), false, ToolAssistanceInputMethod.Mouse));
      mouseInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.shiftKey, ToolAssistanceImage.LeftClickDrag, CoreTools.translate("ElementSet.Inputs.OverlapSelection"), false, ToolAssistanceInputMethod.Mouse));
    }

    if (undefined !== additionalInstr) {
      for (const instr of additionalInstr) {
        if (ToolAssistanceInputMethod.Touch === instr.inputMethod)
          touchInstructions.push(instr);
        else
          mouseInstructions.push(instr);
      }
    }

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, undefined !== mainInstrText ? mainInstrText : CoreTools.translate(mainMsg));
    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }
}
