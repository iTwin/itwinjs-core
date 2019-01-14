/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Measure */

import { CanvasDecoration, GraphicType } from "../rendering";
import { Point3d, XYAndZ, XAndY, Vector3d, Matrix3d, PointString3d, AxisOrder, Point2d, IModelJson, Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core";
import { Viewport } from "../Viewport";
import { DecorateContext } from "../ViewContext";
import { Marker } from "../Marker";
import { PrimitiveTool } from "./PrimitiveTool";
import { IModelApp } from "../IModelApp";
import { HitDetail, HitGeomType } from "../HitDetail";
import { GeometryStreamProps, ColorDef, GeoCoordStatus, Cartographic } from "@bentley/imodeljs-common";
import { QuantityType } from "../QuantityFormatter";
import { BeButtonEvent, EventHandled } from "./Tool";
import { NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "../NotificationManager";

/** @hidden */
class MeasureLabel implements CanvasDecoration {
  public worldLocation = new Point3d();
  public position = new Point3d();
  public label: string;

  constructor(worldLocation: XYAndZ, label: string) {
    this.worldLocation.setFrom(worldLocation);
    this.label = label;
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    ctx.font = "14px san-serif";
    const labelHeight = ctx.measureText("M").width; // Close enough for border padding...
    const labelWidth = ctx.measureText(this.label).width + labelHeight;

    ctx.lineWidth = 1;
    ctx.strokeStyle = "white";
    ctx.fillStyle = "rgba(0,0,0,.15)";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 10;
    ctx.fillRect(-(labelWidth / 2), -labelHeight, labelWidth, labelHeight * 2);
    ctx.strokeRect(-(labelWidth / 2), -labelHeight, labelWidth, labelHeight * 2);

    ctx.fillStyle = "white";
    ctx.shadowBlur = 0;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, 0, 0);
  }

  public setPosition(vp: Viewport): boolean {
    vp.worldToView(this.worldLocation, this.position);
    this.position.y -= Math.floor(vp.pixelsFromInches(0.44)) + 0.5; // Offset from snap location...
    return vp.viewRect.containsPoint(this.position);
  }

  public addDecoration(context: DecorateContext) {
    if (this.setPosition(context.viewport))
      context.addCanvasDecoration(this);
  }
}

/** @hidden */
class MeasureMarker extends Marker {
  public isSelected: boolean = false;
  constructor(label: string, title: string, worldLocation: XYAndZ, size: XAndY) {
    super(worldLocation, size);

    const markerDrawFunc = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.arc(0, 0, this.size.x * 0.5, 0, 2 * Math.PI);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "black";
      ctx.fillStyle = this.isSelected ? "rgba(255,200,200,.5)" : "rgba(255,255,255,.5)";
      ctx.fill();
      ctx.stroke();
    };

    this.drawFunc = markerDrawFunc;
    this.title = title;
    this.label = label;
    this.labelFont = "18px san-serif";
    this.labelColor = "black";
  }
}

/** @hidden */
export class MeasureDistanceTool extends PrimitiveTool {
  public static toolId = "Measure.Distance";
  protected readonly _locationData = new Array<{ point: Point3d, refAxes: Matrix3d }>();
  protected readonly _acceptedSegments = new Array<{ distance: number, slope: number, start: Point3d, end: Point3d, delta: Vector3d, refAxes: Matrix3d, marker: MeasureMarker }>();
  protected _totalDistance: number = 0.0;
  protected _totalDistanceMarker?: MeasureLabel;
  protected _snapGeomId?: string;

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.isSpatialView()); }
  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public onUnsuspend(): void { this.showPrompt(); }
  protected showPrompt(): void { IModelApp.notifications.outputPromptByKey(0 === this._locationData.length ? "CoreTools:tools.Measure.Distance.Prompts.FirstPoint" : "CoreTools:tools.Measure.Distance.Prompts.NextPoint"); }

  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    IModelApp.accuDraw.deactivate(); // Don't enable AccuDraw automatically when starting dynamics.
    IModelApp.toolAdmin.setCursor(0 === this._locationData.length ? IModelApp.viewManager.crossHairCursor : IModelApp.viewManager.dynamicsCursor);
    this.showPrompt();
  }

  public testDecorationHit(id: string): boolean { return id === this._snapGeomId; }

  protected getSnapPoints(): Point3d[] | undefined {
    if (this._acceptedSegments.length < 1 && this._locationData.length < 2)
      return undefined;

    const snapPoints: Point3d[] = [];
    for (const seg of this._acceptedSegments) {
      if (0 === snapPoints.length || !seg.start.isAlmostEqual(snapPoints[snapPoints.length - 1]))
        snapPoints.push(seg.start);
      if (!seg.end.isAlmostEqual(snapPoints[0]))
        snapPoints.push(seg.end);
    }

    if (this._locationData.length > 1)
      for (const loc of this._locationData)
        snapPoints.push(loc.point);
    return snapPoints;
  }

  public getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    const snapPoints = this.getSnapPoints();
    if (undefined === snapPoints)
      return undefined;
    const geomData = IModelJson.Writer.toIModelJson(PointString3d.create(snapPoints));
    return (undefined === geomData ? undefined : [geomData]);
  }

  protected displayDynamicDistance(context: DecorateContext, points: Point3d[]): void {
    let totalDistance = 0.0;
    for (let i = 0; i < points.length - 1; i++)
      totalDistance += points[i].distance(points[i + 1]);
    if (0.0 === totalDistance)
      return;

    const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
    if (undefined === formatterSpec)
      return;
    const formattedTotalDistance = IModelApp.quantityFormatter.formatQuantity(totalDistance, formatterSpec);
    const distDyn = new MeasureLabel(points[points.length - 1], formattedTotalDistance);
    distDyn.addDecoration(context);
  }

  protected displayDelta(context: DecorateContext, seg: any): void {
    const xVec = new Vector3d(seg.delta.x, 0.0, 0.0);
    const yVec = new Vector3d(0.0, seg.delta.y, 0.0);
    const zVec = new Vector3d(0.0, 0.0, seg.delta.z);

    seg.refAxes.multiplyVectorInPlace(xVec);
    seg.refAxes.multiplyVectorInPlace(yVec);
    seg.refAxes.multiplyVectorInPlace(zVec);

    const builderAxes = context.createGraphicBuilder(GraphicType.WorldOverlay);
    let basePt = seg.start.clone();

    if (xVec.magnitude() > 1.0e-5) {
      const segPoints: Point3d[] = [];
      segPoints.push(basePt); basePt = basePt.plus(xVec);
      segPoints.push(basePt);
      const colorX = ColorDef.red.adjustForContrast(context.viewport.view.backgroundColor);
      builderAxes.setSymbology(colorX, ColorDef.black, 5);
      builderAxes.addLineString(segPoints);
    }

    if (yVec.magnitude() > 1.0e-5) {
      const segPoints: Point3d[] = [];
      segPoints.push(basePt); basePt = basePt.plus(yVec);
      segPoints.push(basePt);
      const colorY = ColorDef.green.adjustForContrast(context.viewport.view.backgroundColor);
      builderAxes.setSymbology(colorY, ColorDef.black, 5);
      builderAxes.addLineString(segPoints);
    }

    if (zVec.magnitude() > 1.0e-5) {
      const segPoints: Point3d[] = [];
      segPoints.push(basePt); basePt = basePt.plus(zVec);
      segPoints.push(basePt);
      const colorZ = ColorDef.blue.adjustForContrast(context.viewport.view.backgroundColor);
      builderAxes.setSymbology(colorZ, ColorDef.black, 5);
      builderAxes.addLineString(segPoints);
    }

    context.addDecorationFromBuilder(builderAxes);
  }

  public decorate(context: DecorateContext): void {
    if (!context.viewport.view.isSpatialView())
      return;

    if (this._locationData.length > 0) {
      const ev = new BeButtonEvent();
      IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
      const tmpPoints: Point3d[] = [];
      for (const loc of this._locationData)
        tmpPoints.push(loc.point); // Deep copy not necessary...
      tmpPoints.push(ev.point);

      const builderDynVis = context.createGraphicBuilder(GraphicType.WorldDecoration);
      const colorDynVis = context.viewport.hilite.color;

      builderDynVis.setSymbology(colorDynVis, ColorDef.black, 3);
      builderDynVis.addLineString(tmpPoints);

      context.addDecorationFromBuilder(builderDynVis);

      const builderDynHid = context.createGraphicBuilder(GraphicType.WorldOverlay);
      const colorDynHid = colorDynVis.clone(); colorDynHid.setAlpha(100);

      builderDynHid.setSymbology(colorDynHid, ColorDef.black, 1);
      builderDynHid.addLineString(tmpPoints);

      context.addDecorationFromBuilder(builderDynHid);
      this.displayDynamicDistance(context, tmpPoints);
    }

    if (this._acceptedSegments.length > 0) {
      const builderAccVis = context.createGraphicBuilder(GraphicType.WorldDecoration);
      const builderAccHid = context.createGraphicBuilder(GraphicType.WorldOverlay);
      const colorAccVis = ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor);
      const colorAccHid = colorAccVis.clone(); colorAccHid.setAlpha(100);

      builderAccVis.setSymbology(colorAccVis, ColorDef.black, 3);
      builderAccHid.setSymbology(colorAccHid, ColorDef.black, 1);

      for (const seg of this._acceptedSegments) {
        builderAccVis.addLineString([seg.start, seg.end]);
        builderAccHid.addLineString([seg.start, seg.end]);
        seg.marker.addDecoration(context);
        if (seg.marker.isSelected)
          this.displayDelta(context, seg);
      }

      context.addDecorationFromBuilder(builderAccVis);
      context.addDecorationFromBuilder(builderAccHid);
    }

    if (undefined !== this._totalDistanceMarker)
      this._totalDistanceMarker.addDecoration(context);

    const snapPoints = this.getSnapPoints();
    if (undefined === snapPoints)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.next;

    const builderSnapPts = context.createGraphicBuilder(GraphicType.WorldOverlay, undefined, this._snapGeomId);
    const colorAccPts = ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor);

    builderSnapPts.setSymbology(colorAccPts, ColorDef.black, 7);
    builderSnapPts.addPointString(snapPoints);

    context.addDecorationFromBuilder(builderSnapPts);
  }

  public decorateSuspended(context: DecorateContext): void { this.decorate(context); }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> { if (this._locationData.length > 0 && undefined !== ev.viewport) ev.viewport.invalidateDecorations(); }

  protected async updateTotals(): Promise<void> {
    this._totalDistance = 0.0;
    this._totalDistanceMarker = undefined;
    for (const seg of this._acceptedSegments)
      this._totalDistance += seg.distance;
    if (0.0 === this._totalDistance)
      return;

    const formatterSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length);
    if (undefined === formatterSpec)
      return;

    const formattedTotalDistance = IModelApp.quantityFormatter.formatQuantity(this._totalDistance, formatterSpec);
    this._totalDistanceMarker = new MeasureLabel(this._acceptedSegments[this._acceptedSegments.length - 1].end, formattedTotalDistance);

    const briefMsg = IModelApp.i18n.translateKeys(this._acceptedSegments.length > 1 ? "%{CoreTools:tools.Measure.Labels.CumulativeDistance}: " : "%{CoreTools:tools.Measure.Labels.Distance}: ") + formattedTotalDistance;
    const msgDetail = new NotifyMessageDetails(OutputMessagePriority.Info, briefMsg, undefined, OutputMessageType.InputField);
    IModelApp.notifications.outputMessage(msgDetail);
  }

  protected async getMarkerToolTip(distance: number, slope: number, start: Point3d, end: Point3d, delta?: Vector3d): Promise<string> {
    let toolTip = "";

    const distanceFormatterSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length);
    if (undefined === distanceFormatterSpec)
      return toolTip;

    const formattedDistance = IModelApp.quantityFormatter.formatQuantity(distance, distanceFormatterSpec);
    toolTip += IModelApp.i18n.translateKeys("<b>%{CoreTools:tools.Measure.Labels.Distance}:</b> ") + formattedDistance + "<br>";

    const angleFormatterSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Angle);
    if (undefined !== angleFormatterSpec) {
      const formattedSlope = IModelApp.quantityFormatter.formatQuantity(slope, angleFormatterSpec);
      toolTip += IModelApp.i18n.translateKeys("<b>%{CoreTools:tools.Measure.Labels.Slope}:</b> ") + formattedSlope + "<br>";
    }

    const coordFormatterSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    if (undefined !== coordFormatterSpec) {
      let startAdjusted = start;
      let endAdjusted = end;
      if (undefined !== this.targetView && this.targetView.view.isSpatialView()) {
        const globalOrigin = this.iModel.globalOrigin;
        startAdjusted = startAdjusted.minus(globalOrigin);
        endAdjusted = endAdjusted.minus(globalOrigin);
      }

      const formattedStartX = IModelApp.quantityFormatter.formatQuantity(startAdjusted.x, coordFormatterSpec);
      const formattedStartY = IModelApp.quantityFormatter.formatQuantity(startAdjusted.y, coordFormatterSpec);
      const formattedStartZ = IModelApp.quantityFormatter.formatQuantity(startAdjusted.z, coordFormatterSpec);
      toolTip += IModelApp.i18n.translateKeys("<b>%{CoreTools:tools.Measure.Labels.StartCoord}:</b> ") + formattedStartX + ", " + formattedStartY + ", " + formattedStartZ + "<br>";

      const formattedEndX = IModelApp.quantityFormatter.formatQuantity(endAdjusted.x, coordFormatterSpec);
      const formattedEndY = IModelApp.quantityFormatter.formatQuantity(endAdjusted.y, coordFormatterSpec);
      const formattedEndZ = IModelApp.quantityFormatter.formatQuantity(endAdjusted.z, coordFormatterSpec);
      toolTip += IModelApp.i18n.translateKeys("<b>%{CoreTools:tools.Measure.Labels.EndCoord}:</b> ") + formattedEndX + ", " + formattedEndY + ", " + formattedEndZ + "<br>";
    }

    if (undefined !== delta) {
      const formattedDeltaX = IModelApp.quantityFormatter.formatQuantity(delta.x, distanceFormatterSpec);
      const formattedDeltaY = IModelApp.quantityFormatter.formatQuantity(delta.y, distanceFormatterSpec);
      const formattedDeltaZ = IModelApp.quantityFormatter.formatQuantity(delta.z, distanceFormatterSpec);
      toolTip += IModelApp.i18n.translateKeys("<b>%{CoreTools:tools.Measure.Labels.Delta}:</b> ") + formattedDeltaX + ", " + formattedDeltaY + ", " + formattedDeltaZ + "<br>";
    }

    return toolTip;
  }

  protected async updateSelectedMarkerToolTip(seg: any): Promise<void> {
    seg.marker.title = await this.getMarkerToolTip(seg.distance, seg.slope, seg.start, seg.end, seg.marker.isSelected ? seg.delta : undefined);
  }

  protected async acceptNewSegments(): Promise<void> {
    if (this._locationData.length > 1) {
      for (let i = 0; i <= this._locationData.length - 2; i++) {
        const start = this._locationData[i].point;
        const end = this._locationData[i + 1].point;
        const distance = start.distance(end);
        const xyDist = start.distanceXY(end);
        const zDist = end.z - start.z;
        const slope = (0.0 === xyDist ? Math.PI : Math.atan(zDist / xyDist));
        const delta = Vector3d.createStartEnd(start, end);
        const refAxes = this._locationData[i].refAxes;
        refAxes.multiplyTransposeVectorInPlace(delta);

        const toolTip = await this.getMarkerToolTip(distance, slope, start, end);
        const marker = new MeasureMarker((this._acceptedSegments.length + 1).toString(), toolTip, start.interpolate(0.5, end), Point2d.create(25, 25));

        const segMarkerButtonFunc = (ev: BeButtonEvent) => {
          if (ev.isDown)
            return true;

          let selectedMarker: MeasureMarker | undefined;
          for (const seg of this._acceptedSegments) {
            if (!seg.marker.pick(ev.viewPoint))
              continue;
            selectedMarker = (seg.marker.isSelected ? undefined : seg.marker);
            break;
          }

          for (const seg of this._acceptedSegments) {
            const wasSelected = seg.marker.isSelected;
            seg.marker.isSelected = (seg.marker === selectedMarker);
            if (wasSelected !== seg.marker.isSelected)
              this.updateSelectedMarkerToolTip(seg); // tslint:disable-line:no-floating-promises
          }

          if (undefined !== ev.viewport)
            ev.viewport.invalidateDecorations();
          return true;
        };

        marker.onMouseButton = segMarkerButtonFunc;
        this._acceptedSegments.push({ distance, slope, start, end, delta, refAxes, marker });
      }
    }
    this._locationData.length = 0;
    await this.updateTotals();
  }

  protected getReferenceAxes(vp?: Viewport): Matrix3d {
    const refAxes = Matrix3d.createIdentity();
    if (undefined !== vp && vp.isContextRotationRequired)
      vp.getAuxCoordRotation(refAxes);
    return refAxes;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    const point = ev.point.clone();
    const refAxes = this.getReferenceAxes(ev.viewport);
    const zDir = refAxes.columnZ();
    const normal = refAxes.columnZ();
    const tangent = refAxes.columnX();
    const snap = IModelApp.accuSnap.getCurrSnapDetail();

    // Report xyz delta relative to world up. The surface normal and edge tangent help determine the rotation about z...
    if (undefined !== snap) {
      if (undefined !== snap.primitive) {
        const locDetail = snap.primitive.closestPoint(point, false);
        if (undefined !== locDetail && (HitGeomType.Segment === snap.geomType || snap.primitive.isInPlane(Plane3dByOriginAndUnitNormal.create(point, undefined !== snap.normal ? snap.normal : normal)!))) {
          const locRay = snap.primitive.fractionToPointAndUnitTangent(locDetail.fraction);
          tangent.setFrom(locRay.direction);
          if (undefined !== snap.normal)
            normal.setFrom(snap.normal);
        }
      } else if (undefined !== snap.normal) {
        normal.setFrom(snap.normal);
      }
    }

    if (!normal.isParallelTo(zDir, true)) {
      const yDir = zDir.unitCrossProduct(normal);
      if (undefined !== yDir) {
        yDir.unitCrossProduct(zDir, normal);
        Matrix3d.createColumnsInAxisOrder(AxisOrder.ZXY, normal, yDir, zDir, refAxes);
      }
    } else if (!tangent.isParallelTo(zDir, true)) {
      const yDir = zDir.unitCrossProduct(tangent);
      if (undefined !== yDir) {
        yDir.unitCrossProduct(zDir, tangent);
        Matrix3d.createColumnsInAxisOrder(AxisOrder.XYZ, tangent, yDir, zDir, refAxes);
      }
    }

    this._locationData.push({ point, refAxes });

    if (this._locationData.length > 1 && !ev.isControlKey)
      await this.acceptNewSegments();
    this.setupAndPromptForNextAction();
    if (undefined !== ev.viewport)
      ev.viewport.invalidateDecorations();
    return EventHandled.No;
  }

  public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    if (0 === this._locationData.length) {
      this.onReinitialize();
      return EventHandled.No;
    }
    await this.acceptNewSegments();
    this.setupAndPromptForNextAction();
    if (undefined !== ev.viewport)
      ev.viewport.invalidateDecorations();
    return EventHandled.No;
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this._locationData.length && 0 === this._acceptedSegments.length)
      return false;

    if (0 !== this._locationData.length) {
      this._locationData.pop();
    } else if (0 !== this._acceptedSegments.length) {
      this._acceptedSegments.pop();
    }

    if (0 === this._locationData.length && 0 === this._acceptedSegments.length) {
      this.onReinitialize();
    } else {
      await this.updateTotals();
      this.setupAndPromptForNextAction();
    }
    return true;
  }

  public onRestartTool(): void {
    const tool = new MeasureDistanceTool();
    if (!tool.run())
      this.exitTool();
  }
}

/** @hidden */
export class MeasureLocationTool extends PrimitiveTool {
  public static toolId = "Measure.Location";
  protected readonly _acceptedLocations: MeasureMarker[] = [];

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.isSpatialView()); }
  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public onUnsuspend(): void { this.showPrompt(); }
  protected showPrompt(): void { IModelApp.notifications.outputPromptByKey("CoreTools:tools.Measure.Location.Prompts.EnterPoint"); }

  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    IModelApp.accuDraw.deactivate(); // Don't enable AccuDraw automatically when starting dynamics.
    this.showPrompt();
  }

  protected async getMarkerToolTip(point: Point3d): Promise<string> {
    let toolTip = "";

    const coordFormatterSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    if (undefined !== coordFormatterSpec) {
      let pointAdjusted = point;
      if (undefined !== this.targetView && this.targetView.view.isSpatialView()) {
        const globalOrigin = this.iModel.globalOrigin;
        pointAdjusted = pointAdjusted.minus(globalOrigin);
      }
      const formattedPointX = IModelApp.quantityFormatter.formatQuantity(pointAdjusted.x, coordFormatterSpec);
      const formattedPointY = IModelApp.quantityFormatter.formatQuantity(pointAdjusted.y, coordFormatterSpec);
      const formattedPointZ = IModelApp.quantityFormatter.formatQuantity(pointAdjusted.z, coordFormatterSpec);
      if (undefined !== formattedPointX && undefined !== formattedPointY && undefined !== formattedPointZ)
        toolTip += IModelApp.i18n.translateKeys("<b>%{CoreTools:tools.Measure.Labels.Coordinate}:</b> ") + formattedPointX + ", " + formattedPointY + ", " + formattedPointZ + "<br>";
    }

    if (undefined !== this.targetView && this.targetView.view.isSpatialView() && undefined !== this.iModel.ecefLocation) {
      const latLongFormatterSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.LatLong);
      if (undefined !== latLongFormatterSpec && undefined !== coordFormatterSpec) {
        const geoConverter = this.iModel.geoServices.getConverter();
        const coordResponse = await geoConverter.getGeoCoordinatesFromIModelCoordinates([point]);
        if (1 === coordResponse.geoCoords.length && GeoCoordStatus.Success === coordResponse.geoCoords[0].s) {
          const longLatHeight = Point3d.fromJSON(coordResponse.geoCoords[0].p); // x is longitude in degrees, y is latitude in degrees, z is height in meters...
          const cartographic = Cartographic.fromDegrees(longLatHeight.x, longLatHeight.y, longLatHeight.z);
          const formattedLat = IModelApp.quantityFormatter.formatQuantity(Math.abs(cartographic.latitude), latLongFormatterSpec);
          const formattedLong = IModelApp.quantityFormatter.formatQuantity(Math.abs(cartographic.longitude), latLongFormatterSpec);
          const formattedHeight = IModelApp.quantityFormatter.formatQuantity(cartographic.height, coordFormatterSpec);
          const latDir = IModelApp.i18n.translateKeys(cartographic.latitude < 0 ? "%{CoreTools:tools.Measure.Labels.S}" : "%{CoreTools:tools.Measure.Labels.N}");
          const longDir = IModelApp.i18n.translateKeys(cartographic.longitude < 0 ? "%{CoreTools:tools.Measure.Labels.W}" : "%{CoreTools:tools.Measure.Labels.E}");
          toolTip += IModelApp.i18n.translateKeys("<b>%{CoreTools:tools.Measure.Labels.LatLong}:</b> ") + formattedLat + latDir + ", " + formattedLong + longDir + "<br>";
          toolTip += IModelApp.i18n.translateKeys("<b>%{CoreTools:tools.Measure.Labels.Altitude}:</b> ") + formattedHeight + "<br>";
        }
      }
    }

    return toolTip;
  }

  public decorate(context: DecorateContext): void { if (!context.viewport.view.isSpatialView()) return; this._acceptedLocations.forEach((marker) => marker.addDecoration(context)); }
  public decorateSuspended(context: DecorateContext): void { this.decorate(context); }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    const point = ev.point.clone();
    const toolTip = await this.getMarkerToolTip(point);
    const marker = new MeasureMarker((this._acceptedLocations.length + 1).toString(), toolTip, point, Point2d.create(25, 25));

    const noOpButtonFunc = (_ev: BeButtonEvent) => true;
    marker.onMouseButton = noOpButtonFunc;

    this._acceptedLocations.push(marker);
    this.setupAndPromptForNextAction();
    if (undefined !== ev.viewport)
      ev.viewport.invalidateDecorations();
    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize();
    return EventHandled.No;
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this._acceptedLocations.length)
      return false;

    this._acceptedLocations.pop();
    if (0 === this._acceptedLocations.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();
    return true;
  }

  public onRestartTool(): void {
    const tool = new MeasureLocationTool();
    if (!tool.run())
      this.exitTool();
  }
}
