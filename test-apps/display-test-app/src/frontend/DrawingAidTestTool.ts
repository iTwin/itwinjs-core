/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Angle, IModelJson as GeomJson, LineString3d, Point3d, Vector3d } from "@itwin/core-geometry";
import { ColorDef, GeometryStreamProps } from "@itwin/core-common";
import { AccuDrawChangeModeTool, AccuDrawHintBuilder, AccuDrawRotateAxesTool, AccuDrawRotateCycleTool, AccuDrawRotateElementTool, AccuDrawRotateFrontTool, AccuDrawRotateSideTool, AccuDrawRotateTopTool, AccuDrawRotateViewTool, AccuDrawSetLockAngleTool, AccuDrawSetLockDistanceTool, AccuDrawSetLockIndexTool, AccuDrawSetLockSmartTool, AccuDrawSetLockXTool, AccuDrawSetLockYTool, AccuDrawSetLockZTool, AccuDrawSetOriginTool, AccuDrawShortcuts, AccuDrawSuspendToggleTool, AccuDrawViewportUI, BeButtonEvent, DecorateContext, DefineACSByElementTool, DefineACSByPointsTool, DynamicsContext, EventHandled, GraphicType, HitDetail, IModelApp, PrimitiveTool, ScreenViewport, SnapMode, SnapStatus, ToolType } from "@itwin/core-frontend";
import { PlaceLineStringTool } from "./EditingTools";
import { DisplayTestApp } from "./App";

function toggleUILayout(): void {
  const accuDraw = IModelApp.accuDraw;
  if (!(accuDraw instanceof AccuDrawViewportUI))
    return;
  const accuDrawUI = (accuDraw instanceof AccuDrawViewportUI ? accuDraw : undefined);
  if (undefined === accuDrawUI)
    return;
  if (AccuDrawViewportUI.controlProps.horizontalArrangement)
    accuDrawUI.setVerticalCursorLayout();
  else
    accuDrawUI.setHorizontalFixedLayout();
  accuDrawUI.refreshControls();
}

function toggleRoundOff(): void {
  const accuDraw = IModelApp.accuDraw;
  accuDraw.angleRoundOff.active = !accuDraw.angleRoundOff.active;
  if (accuDraw.angleRoundOff.active) {
    accuDraw.angleRoundOff.units.clear();
    accuDraw.angleRoundOff.units.add(Angle.createDegrees(10).radians);
  }

  accuDraw.distanceRoundOff.active = !accuDraw.distanceRoundOff.active;
  if (accuDraw.distanceRoundOff.active) {
    accuDraw.distanceRoundOff.units.clear();
    accuDraw.distanceRoundOff.units.add(0.1);
    accuDraw.distanceRoundOff.units.add(1.0);
    accuDraw.distanceRoundOff.units.add(10.0);
  }
}

interface AccuDrawShortcutProps {
  key: string;
  description?: string;
  run?: () => void;
  submenu?: AccuDrawShortcutProps[];
}

export class DisplayTestAppShortcutsUI {
  private static shortcutTimeout = 2000;
  private _shortcuts: AccuDrawShortcutProps[] = [];
  private _shortcutOverlayDiv: HTMLDivElement | undefined;
  private _shortcutTimerId: NodeJS.Timeout | undefined;

  private createShortcutsOverlayDiv(vp: ScreenViewport): HTMLDivElement {
    return vp.addNewDiv("accudraw-shortcuts-overlay", true, 50);
  }

  private removeShortcutsOverlayDiv(): void {
    if (undefined !== this._shortcutTimerId) {
      clearTimeout(this._shortcutTimerId);
      this._shortcutTimerId = undefined;
    }

    if (undefined !== this._shortcutOverlayDiv) {
      this._shortcutOverlayDiv.remove();
      this._shortcutOverlayDiv = undefined;
    }
  }

  private createShortcutsDiv(): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "accudraw-shortcuts";

    const style = div.style;
    style.pointerEvents = "none";
    style.overflow = "visible";
    style.position = "absolute";
    style.top = style.left = "0";
    style.height = style.width = "100%";

    return div;
  }

  private positionShortcutsDiv(div: HTMLDivElement, vp: ScreenViewport, width: number, height: number): void {
    const viewRect = vp.viewRect;
    div.style.top = "0.5em";
    div.style.left = `${(viewRect.left + ((viewRect.width - width) * 0.5))}px`;
    div.style.width = `${width}px`;
    div.style.height = `${height}px`;
  }

  private initializeElementStyle(style: CSSStyleDeclaration, isLabel: boolean): void {
    style.pointerEvents = isLabel ? "none" : "auto"; // Don't let events over submenu to to view...
    style.position = "absolute";
    style.textWrap = "nowrap";
    style.textAnchor = "top";
    style.textAlign = "left";
    style.paddingLeft = style.paddingRight = isLabel ? "0.5em" : "";

    style.fontFamily = "sans-serif";
    style.fontSize = isLabel ? "12pt" : "9pt";
    style.borderRadius = isLabel ? "0.5em" : "0.25em";
    style.outlineStyle = "solid";
    style.outlineWidth = "thin";
    style.color = style.outlineColor = "white";
    style.backgroundColor = "rgba(150, 150, 150, 0.5)";
    style.boxShadow = "0.25em 0.25em 0.2em rgb(75, 75, 75)";
  }

  private createLabelElement(label: string): HTMLLabelElement {
    const labelElement = document.createElement("label");
    labelElement.innerHTML = label;
    this.initializeElementStyle(labelElement.style, true);

    return labelElement;
  }

  private createTableElement(submenu: AccuDrawShortcutProps[], labelElement?: HTMLLabelElement): HTMLTableElement {
    const tableElement = document.createElement("table");
    tableElement.contentEditable = "true";
    this.initializeElementStyle(tableElement.style, false);
    tableElement.style.borderSpacing = "0";

    for (const shortcut of submenu) {
      const row = tableElement.insertRow();
      if (0 === tableElement.rows.length % 2)
        row.style.backgroundColor = "rgba(100, 100, 100, 0.5)";

      const columnKey = row.insertCell();
      columnKey.innerHTML = shortcut.key;
      columnKey.style.paddingLeft = columnKey.style.paddingRight = "0.5em";

      const columnDesc = row.insertCell();
      columnDesc.innerHTML = shortcut.description ?? "";
      columnDesc.style.paddingLeft = columnDesc.style.paddingRight = "0.5em";
    }

    if (labelElement)
      tableElement.style.left = `${labelElement.offsetWidth * 1.2}px`; // Position to the left of the label...

    return tableElement;
  }

  private runShortcut(props: AccuDrawShortcutProps, initialKey?: string): void {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || undefined === props.run)
      return;

    this.removeShortcutsOverlayDiv(); // Clear shortcuts that haven't timed out yet...
    this._shortcutOverlayDiv = this.createShortcutsOverlayDiv(vp);
    const div = this.createShortcutsDiv();
    this._shortcutOverlayDiv.appendChild(div);

    const shortcutLabel = `${(initialKey ? initialKey : "") + props.key} - ${props.description}`;
    const shortcutElement = this.createLabelElement(shortcutLabel);
    div.appendChild(shortcutElement);

    this.positionShortcutsDiv(div, vp, shortcutElement.offsetWidth, shortcutElement.offsetHeight);

    this._shortcutTimerId = setTimeout(() => { this.removeShortcutsOverlayDiv() }, DisplayTestAppShortcutsUI.shortcutTimeout);
    props.run();
  }

  private chooseShortcut(props: AccuDrawShortcutProps): void {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || undefined === props.submenu || 0 === props.submenu.length)
      return;

    this.removeShortcutsOverlayDiv(); // Clear shortcuts that haven't timed out yet...
    this._shortcutOverlayDiv = this.createShortcutsOverlayDiv(vp);
    const div = this.createShortcutsDiv();
    this._shortcutOverlayDiv.appendChild(div);

    const shortcutElement = this.createLabelElement(props.key);
    div.appendChild(shortcutElement);

    const shortcutChoices = this.createTableElement(props.submenu, shortcutElement);
    div.appendChild(shortcutChoices);

    this.positionShortcutsDiv(div, vp, shortcutElement.offsetWidth + shortcutChoices.offsetWidth, shortcutChoices.offsetHeight);

    const close = (ev: Event) => {
      this.removeShortcutsOverlayDiv();
      ev.stopPropagation();
    };

    const submenu = props.submenu;
    const onKeyEvent = (ev: KeyboardEvent, isDown: boolean) => {
      if (isDown) {
        switch (ev.key) {
          case "Enter":
          case "Escape":
            shortcutChoices.blur();
            break;

          default:
            const shortcut = this.findShortcut(ev.key, submenu);
            if (undefined === shortcut || undefined === shortcut.run)
              break;
            shortcutChoices.blur(); // Focus out before running shortcut so it doesn't close timed notification...
            this.runShortcut(shortcut, props.key);
            break;
        }
      }
      ev.preventDefault();
      ev.stopPropagation();
    };

    shortcutChoices.focus();
    shortcutChoices.onblur = close;
    shortcutChoices.onmousedown = shortcutChoices.onmouseup = shortcutChoices.onmousemove = (ev: MouseEvent) => { ev.stopPropagation(); }
    shortcutChoices.ontouchstart = shortcutChoices.ontouchend = shortcutChoices.ontouchcancel = shortcutChoices.ontouchmove = (ev: TouchEvent) => { ev.stopPropagation(); }
    shortcutChoices.onwheel = (ev: WheelEvent) => { ev.stopPropagation(); }
    shortcutChoices.onkeydown = (ev: KeyboardEvent) => { onKeyEvent(ev, true) }
    shortcutChoices.onkeyup = (ev: KeyboardEvent) => { onKeyEvent(ev, false) }
  }

  private displayKey(key: string): string {
    return (1 === key.length ? key.toUpperCase() : key);
  }

  private findShortcut(key: string, shortcuts: AccuDrawShortcutProps[]): AccuDrawShortcutProps | undefined {
    const displayKey = this.displayKey(key);
    const shortcut = shortcuts.find((entry) => entry.key === displayKey);
    return shortcut;
  }

  private addShortcut(key: string, description: string, run: () => void, shortcuts: AccuDrawShortcutProps[]): boolean {
    if (undefined !== this.findShortcut(key, shortcuts))
      return false;
    shortcuts.push({ key: this.displayKey(key), description, run })
    return true;
  }

  private addShortcutForTool(key: string, tool: ToolType, shortcuts: AccuDrawShortcutProps[]): boolean {
    return this.addShortcut(key, tool.flyover, () => { void IModelApp.tools.run(tool.toolId); }, shortcuts);
  }

  private addShortcutSubMenu(key: string, shortcuts: AccuDrawShortcutProps[]): AccuDrawShortcutProps[] | undefined {
    if (undefined !== this.findShortcut(key, shortcuts))
      return undefined;
    const submenu: AccuDrawShortcutProps[] = [];
    shortcuts.push({ key: this.displayKey(key), submenu });
    return submenu;
  }

  public populateDefaultShortcuts(): void {
    this.addShortcutForTool("O", AccuDrawSetOriginTool, this._shortcuts);
    this.addShortcutForTool("M", AccuDrawChangeModeTool, this._shortcuts);
    this.addShortcutForTool("X", AccuDrawSetLockXTool, this._shortcuts);
    this.addShortcutForTool("Y", AccuDrawSetLockYTool, this._shortcuts);
    this.addShortcutForTool("Z", AccuDrawSetLockZTool, this._shortcuts);
    this.addShortcutForTool("D", AccuDrawSetLockDistanceTool, this._shortcuts);
    this.addShortcutForTool("A", AccuDrawSetLockAngleTool, this._shortcuts);
    this.addShortcutForTool("L", AccuDrawSetLockSmartTool, this._shortcuts); // Multi-point placement tools can use both Enter and Reset to accept...
    this.addShortcutForTool("Enter", AccuDrawSetLockSmartTool, this._shortcuts); // Legacy mapping...

    const shortcutsForR = this.addShortcutSubMenu("R", this._shortcuts);
    if (undefined !== shortcutsForR) {
      this.addShortcutForTool("T", AccuDrawRotateTopTool, shortcutsForR);
      this.addShortcutForTool("F", AccuDrawRotateFrontTool, shortcutsForR);
      this.addShortcutForTool("S", AccuDrawRotateSideTool, shortcutsForR);
      this.addShortcutForTool("V", AccuDrawRotateViewTool, shortcutsForR);
      this.addShortcutForTool("C", AccuDrawRotateCycleTool, shortcutsForR);
      this.addShortcutForTool("Q", AccuDrawRotateAxesTool, shortcutsForR);
      this.addShortcutForTool("E", AccuDrawRotateElementTool, shortcutsForR);
    }

    const shortcutsForQ = this.addShortcutSubMenu("Q", this._shortcuts);
    if (undefined !== shortcutsForQ) {
      this.addShortcutForTool("A", DefineACSByPointsTool, shortcutsForQ);
      this.addShortcutForTool("E", DefineACSByElementTool, shortcutsForQ);
      this.addShortcutForTool("H", AccuDrawSuspendToggleTool, shortcutsForQ);
      this.addShortcutForTool("I", AccuDrawSetLockIndexTool, shortcutsForQ);
      this.addShortcut("F", "Focus AccuDraw", () => { AccuDrawShortcuts.requestInputFocus(); }, shortcutsForQ);
      this.addShortcut("W", "Toggle UI Layout", () => { toggleUILayout(); }, shortcutsForQ);
      this.addShortcut("U", "Toggle Metric/Imperial", () => { void IModelApp.tools.parseAndRun("fdt metric"); }, shortcutsForQ);
      this.addShortcut("R", "Toggle Round Off", () => { toggleRoundOff(); }, shortcutsForQ);
      this.addShortcut("L", "Place Line String", () => { void IModelApp.tools.run(PlaceLineStringTool.toolId); }, shortcutsForQ);
      this.addShortcut("C", "Clear Saved Values", () => { AccuDrawShortcuts.clearSavedValues(); }, shortcutsForQ);
      this.addShortcut("P", "Snap Perpendicular", () => { DisplayTestApp.setSnapModeOverride(SnapMode.PerpendicularPoint); }, shortcutsForQ);
    }
  }

  public async processShortcutKey(ev: KeyboardEvent) {
    const shortcut = this.findShortcut(ev.key, this._shortcuts);
    if (undefined === shortcut)
      return false;

    if (undefined !== shortcut.run) {
      this.runShortcut(shortcut);
      return true;
    } else if (undefined !== shortcut.submenu) {
      this.chooseShortcut(shortcut);
      return true;
    }

    return false;
  }
};

export class DrawingAidTestTool extends PrimitiveTool {
  public static override toolId = "DrawingAidTest.Points";
  public readonly points: Point3d[] = [];
  protected _snapGeomId?: string;

  public override requireWriteableTarget(): boolean { return false; }
  public override async onPostInstall() {
    await super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);

    if (0 === this.points.length)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.enableSmartRotation = true;

    if (this.points.length > 1 && !(this.points[this.points.length - 1].isAlmostEqual(this.points[this.points.length - 2])))
      hints.setXAxis(Vector3d.createStartEnd(this.points[this.points.length - 2], this.points[this.points.length - 1])); // Rotate AccuDraw to last segment...

    hints.setOrigin(this.points[this.points.length - 1]);
    hints.sendHints();
  }

  public override testDecorationHit(id: string): boolean { return id === this._snapGeomId; }

  public override getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    if (this.points.length < 2)
      return undefined;

    const geomData = GeomJson.Writer.toIModelJson(LineString3d.create(this.points));
    return (undefined === geomData ? undefined : [geomData]);
  }

  public override decorate(context: DecorateContext): void {
    if (this.points.length < 2)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.getNext();

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined, this._snapGeomId);

    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString(this.points);

    context.addDecorationFromBuilder(builder);
  }

  public override onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this.points.length < 1)
      return;

    const builder = context.createSceneGraphicBuilder();

    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([this.points[this.points.length - 1], ev.point]); // Only draw current segment in dynamics, accepted segments are drawn as pickable decorations...

    context.addGraphic(builder.finish());
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this.points.push(ev.point.clone());
    this.setupAndPromptForNextAction();

    if (!this.isDynamicsStarted)
      this.beginDynamics();

    return EventHandled.No;
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined !== IModelApp.accuSnap.currHit) {
      const status = await IModelApp.accuSnap.resetButton(); // TESTING ONLY - NOT NORMAL TOOL OPERATION - Exercise AccuSnap hit cycling...only restart when no current hit or not hot snap on next hit...
      if (SnapStatus.Success === status)
        return EventHandled.No;
    }
    await this.onReinitialize();
    return EventHandled.No;
  }

  public override async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this.points.length)
      return false;

    this.points.pop();
    if (0 === this.points.length)
      await this.onReinitialize();
    else
      this.setupAndPromptForNextAction();
    return true;
  }

  public async onRestartTool() {
    const tool = new DrawingAidTestTool();
    if (!await tool.run())
      return this.exitTool();
  }
}
