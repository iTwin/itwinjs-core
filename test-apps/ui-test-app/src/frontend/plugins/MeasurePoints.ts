/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { ColorDef } from "@bentley/imodeljs-common";
import { Point3d, XYAndZ, XAndY, Point2d } from "@bentley/geometry-core";
import {
  IModelApp, PrimitiveTool, ViewRect, Viewport, QuantityType, BeButtonEvent,
  EventHandled, DynamicsContext, DecorateContext, CanvasDecoration,
} from "@bentley/imodeljs-frontend";

class DistanceMarker implements CanvasDecoration {
  public worldLocation: Point3d;
  /** The size of this Marker, in pixels. */
  public size: Point2d;
  public position: Point3d;
  public readonly rect = new ViewRect();
  public label: string = "";
  public labelOffset: XAndY = { x: 0, y: 20 };
  public labelStyle: string = "white";
  public labelAlign: CanvasTextAlign = "center";
  public labelBaseline: CanvasTextBaseline = "middle";
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
  protected _distanceMarker?: DistanceMarker;

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.isSpatialView()); }
  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public onUnsuspend(): void { this.showPrompt(); }
  protected showPrompt(): void { IModelApp.notifications.outputPromptByKey(0 === this.points.length ? "MeasureTool:tools.Measure.Points.Prompts.FirstPoint" : "MeasureTool:tools.Measure.Points.Prompts.NextPoint"); }

  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    IModelApp.accuDraw.deactivate(); // Don't enable AccuDraw automatically when starting dynamics.
    this.showPrompt();
  }

  protected updateDynamicDistanceMarker(points: Point3d[]): void {
    this._distanceMarker = undefined;
    if (points.length < 2)
      return;
    const distance = points[points.length - 1].distance(points[points.length - 2]);
    if (distance === 0.0)
      return;

    const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
    if (undefined === formatterSpec)
      return;
    const formattedValue = IModelApp.quantityFormatter.formatQuantityWithSpec(distance, formatterSpec);
    if (undefined === formattedValue)
      return;

    this._distanceMarker = new DistanceMarker(points[points.length - 1], formattedValue);
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this.points.length < 1)
      return;

    const tmpPoints = this.points.slice();
    tmpPoints.push(ev.point.clone());

    const builder = context.createSceneGraphicBuilder();

    builder.setSymbology(ColorDef.white, ColorDef.white, 1);
    builder.addLineString(tmpPoints);

    context.addGraphic(builder.finish());
    this.updateDynamicDistanceMarker(tmpPoints);
  }

  public decorate(context: DecorateContext): void {
    if (!context.viewport.view.isSpatialView())
      return;
    if (undefined !== this._distanceMarker)
      this._distanceMarker.addDecoration(context);
  }

  public decorateSuspended(context: DecorateContext): void { this.decorate(context); }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this.points.push(ev.point.clone());
    this.setupAndPromptForNextAction();

    if (this.points.length > 1)
      this.onReinitialize(); // 2nd point restarts, distance only shown in dynamics...
    else if (!this.isDynamicsStarted)
      this.beginDynamics();

    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize();
    return EventHandled.No;
  }

  public onRestartTool(): void {
    const tool = new MeasurePointsTool();
    if (!tool.run())
      this.exitTool();
  }
}

// define and run the entry point
// tslint:disable:no-console
function main() {
  const measureNamespace: I18NNamespace = IModelApp.i18n.registerNamespace("MeasureTool");
  measureNamespace.readFinished.then(() => { MeasurePointsTool.register(measureNamespace); })
    .catch((err) => { console.log(err); });
}

main();
