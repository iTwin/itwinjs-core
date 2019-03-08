/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Point3d, Vector3d } from "@bentley/geometry-core";
import { BeButton, BeButtonEvent, BeTouchEvent, EventHandled, IModelApp } from "@bentley/imodeljs-frontend";
import { Element as MarkupElement, Marker, SVG, Svg } from "@svgdotjs/svg.js";
import { MarkupTool } from "./MarkupTool";
import { markupApp } from "./Markup";

export abstract class RedlineTool extends MarkupTool {
  protected _minPoints = 1;
  protected _nRequiredPoints = 2;
  protected readonly _points: Point3d[] = [];

  protected onAdded(el: MarkupElement) {
    const markup = this.markup;
    const undo = markup.undo;
    undo.doGroup(() => undo.onAdded(el));
    markup.selected.restart(el);
  }
  protected isComplete(_ev: BeButtonEvent) { return this._points.length >= this._nRequiredPoints; }
  protected setupAndPromptForNextAction(): void {
    super.setupAndPromptForNextAction();
    this.markup.setCursor(0 === this._points.length ? IModelApp.viewManager.crossHairCursor : IModelApp.viewManager.dynamicsCursor);
  }

  protected createMarkup(_svgMarkup: Svg, _ev: BeButtonEvent, _isDynamics: boolean): void { }

  protected clearDynamicsMarkup(_isDynamics: boolean): void {
    this.markup.svgDynamics!.clear();
  }

  protected setCurrentStyle(element: MarkupElement, canBeFilled: boolean): void {
    const active = markupApp.props.active;
    element.css(active.element);
    if (!canBeFilled)
      element.css({ fill: "none" });
  }

  protected setCurrentTextStyle(element: MarkupElement): void {
    const active = markupApp.props.active;
    element.css(active.text);
  }

  public onRestartTool(): void { this.exitTool(); } // Default to single shot and return control to select tool...
  public onCleanup() { this.clearDynamicsMarkup(false); }

  public onReinitialize(): void {
    this.clearDynamicsMarkup(false); // ### TODO Should this be automatically cleared when installing a new tool?
    super.onReinitialize();
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    return (0 === this._points.length) ? false : (this.onReinitialize(), true);
  }

  public async onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled> {
    if (startEv.isSingleTouch)
      await IModelApp.toolAdmin.convertTouchMoveStartToButtonDownAndMotion(startEv, ev);
    return EventHandled.Yes; // View tools are not allowed during redlining; use touch events to create markup and don't pass event to IdleTool...
  }

  public async onTouchMove(ev: BeTouchEvent): Promise<void> { return IModelApp.toolAdmin.convertTouchMoveToMotion(ev); }
  public async onTouchComplete(ev: BeTouchEvent): Promise<void> { return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev); }
  public async onTouchCancel(ev: BeTouchEvent): Promise<void> { return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev, BeButton.Reset); }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport || this._points.length < this._minPoints)
      return;
    this.clearDynamicsMarkup(true);
    this.createMarkup(this.markup.svgDynamics!, ev, true);
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.No;

    this._points.push(ev.viewPoint.clone());
    if (!this.isComplete(ev)) {
      this.setupAndPromptForNextAction();
      return EventHandled.No;
    }

    this.createMarkup(this.markup.svgMarkup!, ev, false);
    this.onReinitialize();
    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize();
    return EventHandled.No;
  }
}

export class LineTool extends RedlineTool {
  public static toolId = "Markup.Line";

  protected showPrompt(): void { this.outputMarkupPrompt(0 === this._points.length ? "Line.Prompts.FirstPoint" : "Line.Prompts.NextPoint"); }

  protected createMarkup(svgMarkup: Svg, ev: BeButtonEvent, isDynamics: boolean): void {
    if (this._points.length < (isDynamics ? this._nRequiredPoints - 1 : this._nRequiredPoints))
      return;
    const start = this._points[0];
    const end = isDynamics ? ev.viewPoint : this._points[1];
    const element = svgMarkup.line(start.x, start.y, end.x, end.y);
    this.setCurrentStyle(element, false);
    element.attr("stroke-linecap", "round");
    if (!isDynamics)
      this.onAdded(element);
  }
}

export class RectangleTool extends RedlineTool {
  public static toolId = "Markup.Rectangle";

  constructor(protected _roundCorners?: boolean) { super(); }

  protected showPrompt(): void { this.outputMarkupPrompt(0 === this._points.length ? "Rectangle.Prompts.FirstPoint" : "Rectangle.Prompts.NextPoint"); }

  protected createMarkup(svgMarkup: Svg, ev: BeButtonEvent, isDynamics: boolean): void {
    if (this._points.length < (isDynamics ? this._nRequiredPoints - 1 : this._nRequiredPoints))
      return;
    const start = this._points[0];
    const end = isDynamics ? ev.viewPoint : this._points[1];
    const vec = start.vectorTo(end);
    const width = Math.abs(vec.x);
    const height = Math.abs(vec.y);
    if (width < 1 || height < 1)
      return;
    const offset = Point3d.create(vec.x < 0 ? end.x : start.x, vec.y < 0 ? end.y : start.y); // define location by corner points...
    const element = svgMarkup.rect(width, height).move(offset.x, offset.y);
    this.setCurrentStyle(element, true);
    if (this._roundCorners)
      element.radius(10.0);
    if (!isDynamics)
      this.onAdded(element);
  }
}

export class PolygonTool extends RedlineTool {
  public static toolId = "Markup.Polygon";

  constructor(protected _numSides?: number) { super(); } // Specify number of polygon sides. Default if undefined is 5.

  protected showPrompt(): void { this.outputMarkupPrompt(0 === this._points.length ? "Polygon.Prompts.FirstPoint" : "Polygon.Prompts.NextPoint"); }

  protected getPoints(points: number[], center: Point3d, edge: Point3d, numSides: number, inscribe: boolean): boolean {
    if (numSides < 3 || numSides > 100)
      return false;
    let radius = center.distanceXY(edge);
    if (radius < 1)
      return false;
    const delta = (Math.PI * 2.0) / numSides;
    const vec = center.vectorTo(edge);
    let angle = Vector3d.unitX().planarRadiansTo(vec, Vector3d.unitZ());
    if (!inscribe) { const theta = delta * 0.5; angle -= theta; radius /= Math.cos(theta); }
    const rtmp = Point3d.create();
    const stmp = Point3d.create();
    for (let i = 0; i < numSides; i++ , angle += delta) {
      rtmp.x = radius * Math.cos(angle);
      rtmp.y = radius * Math.sin(angle);
      rtmp.z = 0.0;
      center.plus(rtmp, stmp);
      points.push(stmp.x);
      points.push(stmp.y);
    }
    return true;
  }

  protected createMarkup(svgMarkup: Svg, ev: BeButtonEvent, isDynamics: boolean): void {
    if (this._points.length < (isDynamics ? this._nRequiredPoints - 1 : this._nRequiredPoints))
      return;
    const center = this._points[0];
    const edge = isDynamics ? ev.viewPoint : this._points[1];
    const pts: number[] = [];
    if (!this.getPoints(pts, center, edge, undefined !== this._numSides ? this._numSides : 5, true))
      return;
    const element = svgMarkup.polygon(pts);
    this.setCurrentStyle(element, true);
    if (!isDynamics)
      this.onAdded(element);
  }
}

export class CloudTool extends RedlineTool {
  public static toolId = "Markup.Cloud";
  protected _cloud?: MarkupElement;

  protected showPrompt(): void { this.outputMarkupPrompt(0 === this._points.length ? "Cloud.Prompts.FirstPoint" : "Cloud.Prompts.NextPoint"); }

  protected createMarkup(svgMarkup: Svg, ev: BeButtonEvent, isDynamics: boolean): void {
    if (this._points.length < (isDynamics ? this._nRequiredPoints - 1 : this._nRequiredPoints))
      return;
    const start = this._points[0];
    const end = isDynamics ? ev.viewPoint : this._points[1];
    const vec = start.vectorTo(end);
    const width = Math.abs(vec.x);
    const height = Math.abs(vec.y);
    if (width < 10 || height < 10)
      return;
    if (undefined === this._cloud) {
      this._cloud = svgMarkup.path("M3.0,2.5 C3.9,.78 5.6,-.4 8.1,1.0 C9.1,0 11.3,-.2 12.5,.5 C14.2,-.5 17,.16 17.9,2.5 C21,3 20.2,7.3 17.6,7.5 C16.5,9.2 14.4,9.8 12.7,8.9 C11.6,10 9.5,10.3 8.1,9.4 C5.7,10.8 3.3,9.4 2.6,7.5 C-.9,7.7 .6,1.7 3.0,2.5z");
      this._cloud.attr("stroke-linejoin", "round");
    } else if (!isDynamics) {
      svgMarkup.add(this._cloud);
    }
    const offset = Point3d.create(vec.x < 0 ? end.x : start.x, vec.y < 0 ? end.y : start.y); // define location by corner points...
    this._cloud.move(offset.x, offset.y);
    this._cloud.width(width);
    this._cloud.height(height);
    this.setCurrentStyle(this._cloud, true);
    if (!isDynamics)
      this.onAdded(this._cloud);
  }

  protected clearDynamicsMarkup(isDynamics: boolean): void {
    if (!isDynamics)
      super.clearDynamicsMarkup(isDynamics); // For dynamics we don't create a new cloud each frame, we just set the width/height...
  }
}

export class CircleTool extends RedlineTool {
  public static toolId = "Markup.Circle";

  protected showPrompt(): void { this.outputMarkupPrompt(0 === this._points.length ? "Circle.Prompts.FirstPoint" : "Circle.Prompts.NextPoint"); }

  protected createMarkup(svgMarkup: Svg, ev: BeButtonEvent, isDynamics: boolean): void {
    if (this._points.length < (isDynamics ? this._nRequiredPoints - 1 : this._nRequiredPoints))
      return;
    const start = this._points[0];
    const end = isDynamics ? ev.viewPoint : this._points[1];
    const radius = start.distanceXY(end);
    if (radius < 1)
      return;
    const element = svgMarkup.circle(radius * 2.0).center(start.x, start.y);
    this.setCurrentStyle(element, true);
    if (!isDynamics)
      this.onAdded(element);
  }
}

export class EllipseTool extends RedlineTool {
  public static toolId = "Markup.Ellipse";

  protected showPrompt(): void { this.outputMarkupPrompt(0 === this._points.length ? "Ellipse.Prompts.FirstPoint" : "Ellipse.Prompts.NextPoint"); }

  protected createMarkup(svgMarkup: Svg, ev: BeButtonEvent, isDynamics: boolean): void {
    if (this._points.length < (isDynamics ? this._nRequiredPoints - 1 : this._nRequiredPoints))
      return;
    const start = this._points[0];
    const end = isDynamics ? ev.viewPoint : this._points[1];
    const vec = start.vectorTo(end);
    const width = Math.abs(vec.x);
    const height = Math.abs(vec.y);
    if (width < 1 || height < 1)
      return;
    const offset = Point3d.create(vec.x < 0 ? end.x : start.x, vec.y < 0 ? end.y : start.y); // define location by corner points...
    const element = svgMarkup.ellipse(width, height).move(offset.x, offset.y);
    this.setCurrentStyle(element, true);
    if (!isDynamics)
      this.onAdded(element);
  }
}

export class ArrowTool extends RedlineTool {
  public static toolId = "Markup.Arrow";

  constructor(protected _arrowPos?: string) { super(); } // Specify "start", "end", or "both". Default if undefined is "start".

  protected showPrompt(): void { this.outputMarkupPrompt(0 === this._points.length ? "Arrow.Prompts.FirstPoint" : "Arrow.Prompts.NextPoint"); }

  protected createMarkup(svgMarkup: Svg, ev: BeButtonEvent, isDynamics: boolean): void {
    if (this._points.length < (isDynamics ? this._nRequiredPoints - 1 : this._nRequiredPoints))
      return;
    const arrowLength = 7;
    const arrowWidth = 6;
    const start = this._points[0];
    const end = isDynamics ? ev.viewPoint : this._points[1];
    const vec = start.vectorTo(end);
    if (!vec.normalizeInPlace())
      return;
    const element = svgMarkup.line(start.x, start.y, end.x, end.y);
    this.setCurrentStyle(element, false);
    element.attr("stroke-linecap", "round");
    const color = element.css("stroke"); // ###TODO - Flashing doesn't currently affect markers, need support for "context-stroke" and "context-fill". For now encode color in name...
    const arrowMarkerId = "ArrowMarker" + arrowLength + "x" + arrowWidth + "-" + color;
    let marker = SVG("#" + arrowMarkerId) as Marker;
    if (null === marker) {
      marker = svgMarkup.marker(arrowLength, arrowWidth).id(arrowMarkerId);
      marker.polygon([0, 0, arrowLength, arrowWidth * 0.5, 0, arrowWidth]);
      marker.attr("orient", "auto-start-reverse");
      marker.attr("overflow", "visible"); // Don't clip the stroke that is being applied to allow the specified start/end to be used directly while hiding the arrow tail fully under the arrow head...
      marker.attr("refX", arrowLength);
      marker.css({ stroke: color, fill: color });
    }
    if (undefined === this._arrowPos || "start" === this._arrowPos || "both" === this._arrowPos)
      element.marker("start", marker);
    if ("end" === this._arrowPos || "both" === this._arrowPos)
      element.marker("end", marker);
    if (!isDynamics)
      this.onAdded(element);
  }
}

export class SketchTool extends RedlineTool {
  public static toolId = "Markup.Sketch";
  protected _minDistSquared = 100;

  protected showPrompt(): void { this.outputMarkupPrompt(0 === this._points.length ? "Sketch.Prompts.FirstPoint" : "Sketch.Prompts.NextPoint"); }

  protected createMarkup(svgMarkup: Svg, ev: BeButtonEvent, isDynamics: boolean): void {
    if (this._points.length < (isDynamics ? this._nRequiredPoints - 1 : this._nRequiredPoints))
      return;
    const pts: number[] = [];
    this._points.forEach((pt) => { pts.push(pt.x); pts.push(pt.y); });
    if (isDynamics && !ev.viewPoint.isAlmostEqualXY(this._points[this._points.length - 1])) { pts.push(ev.viewPoint.x); pts.push(ev.viewPoint.y); }
    const isClosed = (this._points.length > 2 && (this._points[0].distanceSquaredXY(isDynamics ? ev.viewPoint : this._points[this._points.length - 1]) < this._minDistSquared * 2));
    const element = isClosed ? svgMarkup.polygon(pts) : svgMarkup.polyline(pts);
    this.setCurrentStyle(element, isClosed);
    element.attr("stroke-linecap", "round");
    element.attr("stroke-linejoin", "round");
    if (!isDynamics)
      this.onAdded(element);
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined !== ev.viewport && this._points.length > 0 && ev.viewPoint.distanceSquaredXY(this._points[this._points.length - 1]) > this._minDistSquared)
      this._points.push(ev.viewPoint.clone());
    super.onMouseMotion(ev); // tslint:disable-line:no-floating-promises
  }
}
