/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { Geometry, IModelJson as GeomJson, LineString3d, Point3d, Vector3d } from "@itwin/core-geometry";
import { ColorDef, GeometryStreamProps } from "@itwin/core-common";
import {
  AccuDraw,
  AccuDrawHintBuilder, BeButtonEvent, CanvasDecoration, CompassMode, DecorateContext, DynamicsContext, EventHandled, GraphicType, HitDetail, IModelApp, ItemField, PrimitiveTool, SnapStatus,
} from "@itwin/core-frontend";

interface AccuDrawItemFieldData { itemField: number, value: number, displayValue: string, locked: boolean }

class AccuDrawInputFields implements CanvasDecoration {
  public position = new Point3d();
  protected fieldData: AccuDrawItemFieldData[] = [];
  protected focusItem: ItemField;

  constructor(position: Point3d, fieldData: AccuDrawItemFieldData[], focusItem: ItemField) {
    this.position.setFrom(position);
    this.fieldData = fieldData;
    this.focusItem = focusItem;
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = "black";

    let yOffset = 0;

    const drawField = (field: AccuDrawItemFieldData) => {
      const metrics = ctx.measureText(field.displayValue);
      const textWidth = metrics.width;
      const textHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      const textValueHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

      if (field.itemField === this.focusItem) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0, 225, 255, 0.4)";
        ctx.fillRect(0, yOffset, textWidth, textValueHeight);
      }

      ctx.shadowBlur = 5;
      ctx.fillStyle = (field.locked ? "orange" : "white");
      ctx.fillText(field.displayValue, 0, yOffset);

      yOffset += textHeight;
    };

    for (const field of this.fieldData)
      drawField(field);
  }

  public addDecoration(context: DecorateContext) {
    context.addCanvasDecoration(this);
  }
}

export class DisplayTestAppAccuDraw extends AccuDraw {
  protected itemFieldData: AccuDrawItemFieldData[] = [];
  protected focusItem: ItemField;
  protected cursorPoint = new Point3d();

  public constructor() {
    super();

    for (let index = ItemField.DIST_Item; index <= ItemField.Z_Item; ++index)
      this.itemFieldData.push({ itemField: index, value: 0, displayValue: "", locked: false });

    this.focusItem = this.defaultFocusItem();
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (!this.isActive)
      return; // Don't show spatial coordinates for rectangular mode at cursor when inactive...

    if (context.viewport !== IModelApp.toolAdmin.cursorView)
      return;

    const position = context.viewport.worldToView(this.cursorPoint);
    position.x += Math.floor(context.viewport.pixelsFromInches(0.4)) + 0.5; // Offset from snap location...
    position.y += Math.floor(context.viewport.pixelsFromInches(0.1)) + 0.5; // Offset from snap location...
    if (!context.viewport.viewRect.containsPoint(position))
      return; // Could choose another location to ensure fields are in view...

    const activeFields: AccuDrawItemFieldData[] = [];

    if (CompassMode.Polar === this.compassMode) {
      activeFields.push(this.itemFieldData[ItemField.DIST_Item]);
      activeFields.push(this.itemFieldData[ItemField.ANGLE_Item]);
    } else {
      activeFields.push(this.itemFieldData[ItemField.X_Item]);
      activeFields.push(this.itemFieldData[ItemField.Y_Item]);
    }

    if (context.viewport.view.allow3dManipulations() && (!Geometry.isAlmostEqualNumber(this.itemFieldData[ItemField.Z_Item].value, 0.0) || this.itemFieldData[ItemField.Z_Item].locked))
      activeFields.push(this.itemFieldData[ItemField.Z_Item]);

    const displayedFields = new AccuDrawInputFields(position, activeFields, this.focusItem);
    displayedFields.addDecoration(context);
  }

  public override setFocusItem(index: ItemField) {
    this.focusItem = index;
  }

  public override onCompassDisplayChange(_state: "show" | "hide"): void {
    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  public override onCompassModeChange(): void {
    this.focusItem = this.defaultFocusItem();
  }

  public override onFieldLockChange(index: ItemField) {
    this.itemFieldData[index].locked = !this.itemFieldData[index].locked;
    assert(this.itemFieldData[index].locked === this.getFieldLock(index)); // Make sure lock change notifications weren't omitted...
  }

  public override onFieldValueChange(index: ItemField) {
    this.itemFieldData[index].value = this.getValueByIndex(index);
    this.itemFieldData[index].displayValue = this.getFormattedValueByIndex(index);
  }

  public override onMotion(ev: BeButtonEvent): void {
    this.processMotion();
    this.cursorPoint.setFrom(ev.point);
  }
}

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
