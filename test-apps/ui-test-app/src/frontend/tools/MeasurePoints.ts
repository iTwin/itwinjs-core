/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import {
  IModelApp, PrimitiveTool, AccuDrawHintBuilder, ViewRect, Viewport, ToolFormatType,
  BeButtonEvent, EventHandled, AccuDrawShortcuts, DynamicsContext, RotationMode, DecorateContext,
} from "@bentley/imodeljs-frontend";
import { GraphicType, CanvasDecoration } from "@bentley/imodeljs-frontend/lib/rendering";
import { ColorDef } from "@bentley/imodeljs-common";
import { Point3d, Vector3d, XYAndZ, XAndY, Point2d } from "@bentley/geometry-core";

class DistanceMarker implements CanvasDecoration {
  public worldLocation: Point3d;
  /** The size of this Marker, in pixels. */
  public size: Point2d;
  public position: Point3d;
  public readonly rect = new ViewRect();
  public label: string = "";
  public labelOffset: XAndY = { x: 0, y: 20 };
  public labelStyle: string = "white";
  public labelAlign: string = "center";
  public labelBaseline: string = "middle";
  public labelFont: string = "14px san-serif";
  public padding: number = 20;
  public frameHeight: number = 30;
  public frameStrokeStyle: string = "black";
  public frameFillStyle: string = "green";

  private static _size = { x: 30, y: 30 };

  constructor(worldLocation: XYAndZ, distanceLabel: string) {
    this.worldLocation = Point3d.createFrom(worldLocation);
    this.size = Point2d.createFrom(DistanceMarker._size);
    this.position = new Point3d();
    this.label = distanceLabel;
    const offset: Point2d = new Point2d(0, 20);
    this.labelOffset = offset;
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    if (this.label !== undefined) {
      ctx.font = this.labelFont;
      const labelWidth = ctx.measureText(this.label).width + this.padding;
      const textOffsetX = this.labelOffset ? this.labelOffset.x : 0;
      const textOffsetY = this.labelOffset ? this.labelOffset.y : 0;
      ctx.beginPath();
      ctx.rect(0 - (labelWidth / 2 + textOffsetX), 0 - (textOffsetY + this.frameHeight / 2), labelWidth, this.frameHeight);
      ctx.fillStyle = this.frameFillStyle;
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.frameStrokeStyle;
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = this.labelAlign;
      ctx.textBaseline = this.labelBaseline;
      ctx.font = this.labelFont;
      ctx.fillStyle = this.labelStyle;
      ctx.fillText(this.label, this.labelOffset ? -this.labelOffset.x : 0, this.labelOffset ? -this.labelOffset.y : 0);
    }
  }

  public setPosition(vp: Viewport): boolean {
    vp.worldToView(this.worldLocation, this.position);
    const origin = this.position;
    const sizeX = this.size.x / 2;
    const sizeY = this.size.y / 2;
    this.rect.init(origin.x - sizeX, origin.y - sizeY, origin.x + sizeX, origin.y + sizeY);
    return vp.viewRect.containsPoint(this.position);
  }

  public addDecoration(context: DecorateContext) {
    const vp = context.viewport;
    if (this.setPosition(vp))
      context.addCanvasDecoration(this);
  }
}

export class MeasurePointsTool extends PrimitiveTool {
  public static toolId = "Measure.Points";
  public readonly points: Point3d[] = [];
  private _measurements: DistanceMarker[] = [];

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);

    if (0 === this.points.length) {
      IModelApp.notifications.outputPromptByKey("SampleApp:MeasureByPoints.Prompt.FirstPoint");
      return;
    }

    IModelApp.notifications.outputPromptByKey("SampleApp:MeasureByPoints.Prompt.NextPoint");

    const hints = new AccuDrawHintBuilder();
    hints.enableSmartRotation = true;

    if (this.points.length > 1 && !(this.points[this.points.length - 1].isAlmostEqual(this.points[this.points.length - 2])))
      hints.setXAxis(Vector3d.createStartEnd(this.points[this.points.length - 2], this.points[this.points.length - 1])); // Rotate AccuDraw to last segment...

    hints.setOrigin(this.points[this.points.length - 1]);
    hints.sendHints();
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this.points.length < 1)
      return;

    const tmpPoints = this.points.slice();
    tmpPoints.push(ev.point.clone());

    const distance = tmpPoints[tmpPoints.length - 1].distance(tmpPoints[tmpPoints.length - 2]);
    if (distance !== 0.0) {
      const me = this;

      IModelApp.quantityFormatManager.formatToolQuantity(distance, ToolFormatType.Length).then((formattedValue: string) => {
        if (me.points.length > 0) {
          if (me._measurements.length === 0)
            me._measurements.push(new DistanceMarker(tmpPoints[tmpPoints.length - 1], formattedValue));
          else
            me._measurements[0] = new DistanceMarker(tmpPoints[tmpPoints.length - 1], formattedValue);
          // IModelApp.notifications.outputPrompt("Measure Distance> distance=" + formattedValue);
        }
      });
    }

    const builder = context.createGraphicBuilder(GraphicType.Scene);

    builder.setSymbology(ColorDef.white, ColorDef.white, 1);
    builder.addLineString(tmpPoints);

    context.addGraphic(builder.finish());
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport.view.isSpatialView())
      this._measurements.forEach((measurement) => measurement.addDecoration(context));
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this.points.push(ev.point.clone());
    this.setupAndPromptForNextAction();

    if (!this.isDynamicsStarted)
      this.beginDynamics();

    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize();
    return EventHandled.No;
  }

  public onUndoPreviousStep(): boolean {
    if (0 === this.points.length)
      return false;

    this.points.pop();
    if (0 === this.points.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();
    return true;
  }

  public async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (wentDown) {
      switch (keyEvent.key) {
        case " ":
          AccuDrawShortcuts.changeCompassMode();
          break;
        case "Enter":
          AccuDrawShortcuts.lockSmart();
          break;
        case "x":
        case "X":
          AccuDrawShortcuts.lockX();
          break;
        case "y":
        case "Y":
          AccuDrawShortcuts.lockY();
          break;
        case "z":
        case "Z":
          AccuDrawShortcuts.lockZ();
          break;
        case "a":
        case "A":
          AccuDrawShortcuts.lockAngle();
          break;
        case "d":
        case "D":
          AccuDrawShortcuts.lockDistance();
          break;
        case "t":
        case "T":
          AccuDrawShortcuts.setStandardRotation(RotationMode.Top);
          break;
        case "f":
        case "F":
          AccuDrawShortcuts.setStandardRotation(RotationMode.Front);
          break;
        case "s":
        case "S":
          AccuDrawShortcuts.setStandardRotation(RotationMode.Side);
          break;
        case "v":
        case "V":
          AccuDrawShortcuts.setStandardRotation(RotationMode.View);
          break;
        case "o":
        case "O":
          AccuDrawShortcuts.setOrigin();
          break;
        case "c":
        case "C":
          AccuDrawShortcuts.rotateCycle(false);
          break;
        case "q":
        case "Q":
          AccuDrawShortcuts.rotateAxes(true);
          break;
        case "e":
        case "E":
          AccuDrawShortcuts.rotateToElement(false);
          break;
        case "r":
        case "R":
          AccuDrawShortcuts.defineACSByPoints();
          break;
      }
    }
    return EventHandled.No;
  }

  public onRestartTool(): void {
    this.points.length = 0;  // clear array to stop onDynamicFrame processing
    IModelApp.notifications.outputPrompt("");
    const tool = new MeasurePointsTool();
    if (!tool.run())
      this.exitTool();
  }
}
