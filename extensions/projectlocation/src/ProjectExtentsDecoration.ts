/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Point3d, ClipVector, ClipShape, Range1d, PolygonOps, Vector3d, Transform, Range3d, Matrix3d, Angle, AxisOrder, Arc3d, Ray3d, AxisIndex } from "@bentley/geometry-core";
import { ColorDef, Cartographic, EcefLocation } from "@bentley/imodeljs-common";
import {
  DecorateContext,
  IModelApp,
  ScreenViewport,
  GraphicType,
  EditManipulator,
  ViewClipControlArrow,
  ViewClipTool,
  ViewClipShapeModifyTool,
  HitDetail,
  BeButtonEvent,
  EventHandled,
  ViewClipDecorationProvider,
  Viewport,
  QuantityType,
  BeButton,
  CoreTools,
  NotifyMessageDetails,
  OutputMessagePriority,
} from "@bentley/imodeljs-frontend";
import { translateCoreMeasureBold, translateMessageBold, translateMessage } from "./ProjectLocation";
import { ProjectGeolocationNorthTool, ProjectGeolocationPointTool } from "./ProjectGeolocation";

function clearViewClip(vp: ScreenViewport): boolean {
  if (!ViewClipTool.doClipClear(vp))
    return false;
  ViewClipDecorationProvider.create().onClearClip(vp); // Send clear event...
  ViewClipDecorationProvider.clear();
  return true;
}

function enableBackgroundMap(viewport: Viewport, onOff: boolean): boolean {
  if (onOff === viewport.viewFlags.backgroundMap)
    return false;

  const viewFlags = viewport.viewFlags.clone();
  viewFlags.backgroundMap = onOff;
  viewport.viewFlags = viewFlags;
  return true;
}

function updateMapDisplay(vp: ScreenViewport, turnOnMap: boolean): void {
  vp.displayStyle.backgroundMap.treeOwner.dispose(); // Recreate background map on next update after ecef transform change...this is NOT something that should normally be done by applications!
  if (!turnOnMap || !enableBackgroundMap(vp, true))
    vp.invalidateRenderPlan();
}

/** @alpha Controls to modify project extents shown using view clip */
export class ProjectExtentsClipDecoration extends EditManipulator.HandleProvider {
  private static _decorator?: ProjectExtentsClipDecoration;
  protected _clip?: ClipVector;
  protected _clipId?: string;
  protected _clipShape?: ClipShape;
  protected _clipShapeExtents?: Range1d;
  protected _clipRange?: Range3d;
  protected _ecefLocation?: EcefLocation;
  protected _origin?: Cartographic; // ### TODO Make cartographic origin part of EcefLocation and persist...
  protected _allowEcefLocationChange = false;
  protected _hasGCSDefined?: boolean;
  protected _controlIds: string[] = [];
  protected _controls: ViewClipControlArrow[] = [];
  protected _monumentPoint?: Point3d;
  protected _northDirection?: Ray3d;
  protected _monumentId?: string;
  protected _northId?: string;
  protected _suspendDecorator = false;
  protected _removeViewCloseListener?: () => void;
  public suspendGeolocationDecorations = false;

  public constructor(public viewport: ScreenViewport) {
    super(viewport.iModel);
    if (!this.getClipData())
      return;
    this._ecefLocation = this.iModel.ecefLocation;
    this._monumentPoint = this.getMonumentPoint();
    this._northDirection = this.getNorthDirection();
    this._monumentId = this.iModel.transientIds.next;
    this._northId = this.iModel.transientIds.next;
    this._clipId = this.iModel.transientIds.next;
    this.start();
  }

  protected start(): void {
    this.updateDecorationListener(true);
    this._removeViewCloseListener = IModelApp.viewManager.onViewClose.addListener(this.onViewClose, this);
    this.iModel.selectionSet.replace(this._clipId!); // Always select decoration on create...
  }

  protected stop(): void {
    const selectedId = (undefined !== this._clipId && this.iModel.selectionSet.has(this._clipId)) ? this._clipId : undefined;
    this._clipId = undefined; // Invalidate id so that decorator will be dropped...
    super.stop();
    if (undefined !== selectedId)
      this.iModel.selectionSet.remove(selectedId); // Don't leave decorator id in selection set...
    if (undefined !== this._removeViewCloseListener) {
      this._removeViewCloseListener();
      this._removeViewCloseListener = undefined;
    }
  }

  public onViewClose(vp: ScreenViewport): void {
    if (this.viewport === vp)
      ProjectExtentsClipDecoration.clear();
  }

  private getClipData(): boolean {
    this._clip = this._clipShape = this._clipShapeExtents = this._clipRange = undefined;
    const clip = this.viewport.view.getViewClip();
    if (undefined === clip)
      return false;

    const clipShape = ViewClipTool.isSingleClipShape(clip);
    if (undefined === clipShape)
      return false;

    if (5 !== clipShape.polygon.length || undefined === clipShape.zLow || undefined === clipShape.zHigh)
      return false; // Not a box, can't be project extents clip...

    if (undefined !== clipShape.transformFromClip && !clipShape.transformFromClip.isIdentity)
      return false; // Not axis aligned, can't be project extents clip...

    this._clipShapeExtents = Range1d.createXX(clipShape.zLow, clipShape.zHigh);
    this._clipShape = clipShape;
    this._clip = clip;

    this._clipRange = Range3d.create();
    const shapePtsLo = ViewClipTool.getClipShapePoints(this._clipShape, this._clipShapeExtents.low);
    const shapePtsHi = ViewClipTool.getClipShapePoints(this._clipShape, this._clipShapeExtents.high);

    this._clipRange.extendArray(shapePtsLo);
    this._clipRange.extendArray(shapePtsHi);
    return true;
  }

  private ensureNumControls(numReqControls: number): void {
    const numCurrent = this._controlIds.length;
    if (numCurrent < numReqControls) {
      const transientIds = this.iModel.transientIds;
      for (let i: number = numCurrent; i < numReqControls; i++)
        this._controlIds[i] = transientIds.next;
    } else if (numCurrent > numReqControls) {
      this._controlIds.length = numReqControls;
    }
  }

  private createClipShapeControls(): boolean {
    if (undefined === this._clipShape)
      return false;

    const shapePtsLo = ViewClipTool.getClipShapePoints(this._clipShape, this._clipShapeExtents!.low);
    const shapePtsHi = ViewClipTool.getClipShapePoints(this._clipShape, this._clipShapeExtents!.high);
    const shapeArea = PolygonOps.centroidAreaNormal(shapePtsLo);
    if (undefined === shapeArea)
      return false;

    const numControls = shapePtsLo.length + 1; // Number of edge midpoints plus zLow and zHigh...
    this.ensureNumControls(numControls);

    for (let i: number = 0; i < numControls - 2; i++) {
      const midPtLo = shapePtsLo[i].interpolate(0.5, shapePtsLo[i + 1]);
      const midPtHi = shapePtsHi[i].interpolate(0.5, shapePtsHi[i + 1]);
      const faceCenter = midPtLo.interpolate(0.5, midPtHi);
      const edgeTangent = Vector3d.createStartEnd(shapePtsLo[i], shapePtsLo[i + 1]);
      const faceNormal = edgeTangent.crossProduct(shapeArea.direction); faceNormal.normalizeInPlace();
      this._controls[i] = new ViewClipControlArrow(faceCenter, faceNormal, 0.75);
    }

    const zFillColor = ColorDef.from(150, 150, 250);
    this._controls[numControls - 2] = new ViewClipControlArrow(shapeArea.origin, Vector3d.unitZ(-1.0), 0.75, zFillColor, undefined, "zLow");
    this._controls[numControls - 1] = new ViewClipControlArrow(shapeArea.origin.plusScaled(Vector3d.unitZ(), shapePtsLo[0].distance(shapePtsHi[0])), Vector3d.unitZ(), 0.75, zFillColor, undefined, "zHigh");

    return true;
  }

  protected async hasValidGCS(): Promise<boolean> {
    if (!this.iModel.isGeoLocated || this.iModel.noGcsDefined)
      return false;

    if (undefined === this.iModel.noGcsDefined) {
      try {
        await this.iModel.spatialToCartographicFromGcs(Point3d.createZero());
      } catch (error) {
        if (this.iModel.noGcsDefined)
          return false;
      }
    }

    if (undefined === this._hasGCSDefined)
      this._hasGCSDefined = true; // Only set for initial create...

    // ### TODO: Only allow ecef location to be changed if GCS is not a map projection (gcs with named that is undefined or empty)...
    return false;
  }

  protected async createControls(): Promise<boolean> {
    // Always update to current view clip to handle post-modify, etc.
    if (undefined === this._clipId || !this.getClipData())
      return false;

    this._allowEcefLocationChange = !(await this.hasValidGCS());

    // Show controls if only range box and it's controls are selected, selection set doesn't include any other elements...
    let showControls = false;
    if (this.iModel.selectionSet.size <= this._controlIds.length + 1 && this.iModel.selectionSet.has(this._clipId)) {
      showControls = true;
      if (this.iModel.selectionSet.size > 1) {
        this.iModel.selectionSet.elements.forEach((val) => {
          if (this._clipId !== val && !this._controlIds.includes(val))
            showControls = false;
        });
      }
    }

    if (!showControls)
      return false; // Don't clear decoration on de-select...

    return this.createClipShapeControls();
  }

  protected clearControls(): void {
    this.iModel.selectionSet.remove(this._controlIds); // Remove any selected controls as they won't continue to be displayed...
    super.clearControls();
  }

  protected modifyControls(hit: HitDetail, _ev: BeButtonEvent): boolean {
    if (undefined === this._clip || hit.sourceId === this._clipId)
      return false;

    const saveQualifiers = IModelApp.toolAdmin.currentInputState.qualifiers;
    if (undefined !== this._clipShape) {
      const clipShapeModifyTool = new ViewClipShapeModifyTool(this, this._clip, this.viewport, hit.sourceId, this._controlIds, this._controls);
      this._suspendDecorator = clipShapeModifyTool.run();
    }

    if (this._suspendDecorator)
      IModelApp.toolAdmin.currentInputState.qualifiers = saveQualifiers; // onInstallTool cleared qualifiers, preserve for "modify all" behavior when shift was held and drag started...

    return this._suspendDecorator;
  }

  protected async onRightClick(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled> { return EventHandled.No; }

  protected async onTouchTap(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> { return (hit.sourceId === this._clipId ? EventHandled.No : super.onTouchTap(hit, ev)); }

  public async onDecorationButtonEvent(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> {
    if (hit.sourceId === this._monumentId) {
      if (BeButton.Data === ev.button && !ev.isDown && !ev.isDragging)
        ProjectGeolocationPointTool.startTool();
      return EventHandled.Yes; // Only pickable for tooltip, don't allow selection...
    }

    if (hit.sourceId === this._northId) {
      if (BeButton.Data === ev.button && !ev.isDown && !ev.isDragging)
        ProjectGeolocationNorthTool.startTool();
      return EventHandled.Yes; // Only pickable for tooltip, don't allow selection...
    }

    return super.onDecorationButtonEvent(hit, ev);
  }

  public onManipulatorEvent(eventType: EditManipulator.EventType): void {
    this._suspendDecorator = false;
    super.onManipulatorEvent(eventType);
  }

  public async getDecorationToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    const toolTip = document.createElement("div");
    let toolTipHtml = "";

    if (hit.sourceId === this._monumentId) {
      const coordFormatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Coordinate);
      if (undefined !== coordFormatterSpec) {
        const pointAdjusted = this._monumentPoint!.minus(this.iModel.globalOrigin);
        const formattedPointX = IModelApp.quantityFormatter.formatQuantity(pointAdjusted.x, coordFormatterSpec);
        const formattedPointY = IModelApp.quantityFormatter.formatQuantity(pointAdjusted.y, coordFormatterSpec);
        const formattedPointZ = IModelApp.quantityFormatter.formatQuantity(pointAdjusted.z, coordFormatterSpec);
        toolTipHtml += translateCoreMeasureBold("Coordinate") + formattedPointX + ", " + formattedPointY + ", " + formattedPointZ + "<br>";
      }

      const latLongFormatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.LatLong);
      if (undefined !== latLongFormatterSpec && undefined !== coordFormatterSpec && this.iModel.isGeoLocated) {
        const cartographic = this.iModel.spatialToCartographicFromEcef(this._monumentPoint!);
        const formattedLat = IModelApp.quantityFormatter.formatQuantity(Math.abs(cartographic.latitude), latLongFormatterSpec);
        const formattedLong = IModelApp.quantityFormatter.formatQuantity(Math.abs(cartographic.longitude), latLongFormatterSpec);
        const formattedHeight = IModelApp.quantityFormatter.formatQuantity(cartographic.height, coordFormatterSpec);
        const latDir = CoreTools.translate(cartographic.latitude < 0 ? "Measure.Labels.S" : "Measure.Labels.N");
        const longDir = CoreTools.translate(cartographic.longitude < 0 ? "Measure.Labels.W" : "Measure.Labels.E");
        toolTipHtml += translateCoreMeasureBold("LatLong") + formattedLat + latDir + ", " + formattedLong + longDir + "<br>";
        toolTipHtml += translateCoreMeasureBold("Altitude") + formattedHeight + "<br>";
      }

    } else if (hit.sourceId === this._northId) {
      const angleFormatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Angle);
      if (undefined !== angleFormatterSpec) {
        const formattedAngle = IModelApp.quantityFormatter.formatQuantity(this.getClockwiseAngleToNorth().radians, angleFormatterSpec);
        toolTipHtml += translateMessageBold("North") + formattedAngle + "<br>";
      }

    } else if (hit.sourceId === this._clipId) {
      const distanceFormatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
      toolTipHtml += translateMessage("ProjectExtents") + "<br>";
      if (undefined !== distanceFormatterSpec && undefined !== this._clipRange) {
        const formattedLength = IModelApp.quantityFormatter.formatQuantity(this._clipRange.xLength(), distanceFormatterSpec);
        const formattedWidth = IModelApp.quantityFormatter.formatQuantity(this._clipRange.yLength(), distanceFormatterSpec);
        const formattedHeight = IModelApp.quantityFormatter.formatQuantity(this._clipRange.zLength(), distanceFormatterSpec);
        toolTipHtml += translateMessageBold("Length") + formattedLength + "<br>";
        toolTipHtml += translateMessageBold("Width") + formattedWidth + "<br>";
        toolTipHtml += translateMessageBold("Height") + formattedHeight + "<br>";
      }

    } else {
      const arrowIndex = this._controlIds.indexOf(hit.sourceId);
      if (-1 !== arrowIndex) {
        toolTipHtml += translateMessage("ModifyProjectExtents") + "<br>";
        const heightFormatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Coordinate);
        if (undefined !== heightFormatterSpec && undefined !== this._clipRange && this.iModel.isGeoLocated) {
          const arrowControl = this._controls[arrowIndex];
          if (undefined !== arrowControl.name) {
            const heightPt = ("zLow" === arrowControl.name ? this._clipRange.low : this._clipRange.high);
            const cartographic = this.iModel.spatialToCartographicFromEcef(heightPt);
            const formattedAltitude = IModelApp.quantityFormatter.formatQuantity(cartographic.height, heightFormatterSpec);
            toolTipHtml += translateCoreMeasureBold("Altitude") + formattedAltitude + "<br>";
          }
        }
      }
    }

    toolTip.innerHTML = toolTipHtml;
    return toolTip;
  }

  public testDecorationHit(id: string): boolean { return (id === this._monumentId || id === this._northId || id === this._clipId || this._controlIds.includes(id)); }
  protected updateDecorationListener(_add: boolean): void { super.updateDecorationListener(undefined !== this._clipId); } // Decorator isn't just for resize controls...

  public getMonumentPoint(): Point3d {
    const origin = this.iModel.projectExtents.low.clone();
    if (0.0 > this.iModel.projectExtents.low.z && 0.0 < this.iModel.projectExtents.high.z)
      origin.z = 0.0;
    return origin;
  }

  public getClockwiseAngleToNorth(): Angle {
    const angle = this.getNorthAngle();
    angle.setRadians(Angle.adjustRadians0To2Pi(angle.radians));
    return angle;
  }

  public getNorthAngle(): Angle {
    const northDirection = (undefined !== this._northDirection ? this._northDirection : this.getNorthDirection());
    return northDirection.direction.angleToXY(Vector3d.unitY());
  }

  public getNorthDirection(refOrigin?: Point3d): Ray3d {
    const origin = (undefined !== refOrigin ? refOrigin : this.iModel.projectExtents.center);

    if (!this.iModel.isGeoLocated)
      return Ray3d.create(origin, Vector3d.unitY());

    const cartographic = this.iModel.spatialToCartographicFromEcef(origin);
    cartographic.latitude += Angle.createDegrees(0.1).radians;
    const pt2 = this.iModel.cartographicToSpatialFromEcef(cartographic);
    const northVec = Vector3d.createStartEnd(origin, pt2);
    northVec.z = 0.0;
    northVec.normalizeInPlace();

    return Ray3d.create(origin, northVec);
  }

  public drawNorthArrow(context: DecorateContext, northDir: Ray3d, id?: string): void {
    const vp = context.viewport;
    const pixelSize = vp.pixelsFromInches(0.55);
    const scale = vp.viewingSpace.getPixelSizeAtPoint(northDir.origin) * pixelSize;
    const matrix = Matrix3d.createRigidFromColumns(northDir.direction, Vector3d.unitZ(), AxisOrder.YZX);

    if (undefined === matrix)
      return;

    matrix.scaleColumnsInPlace(scale, scale, scale);
    const arrowTrans = Transform.createRefs(northDir.origin, matrix);

    const northArrowBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay, arrowTrans, id);
    const color = ColorDef.white;

    const arrowOutline: Point3d[] = [];
    arrowOutline[0] = Point3d.create(0.0, 0.65);
    arrowOutline[1] = Point3d.create(-0.45, -0.5);
    arrowOutline[2] = Point3d.create(0.0, -0.2);
    arrowOutline[3] = Point3d.create(0.45, -0.5);
    arrowOutline[4] = arrowOutline[0].clone();

    const arrowLeftFill: Point3d[] = [];
    arrowLeftFill[0] = arrowOutline[0].clone();
    arrowLeftFill[1] = arrowOutline[1].clone();
    arrowLeftFill[2] = arrowOutline[2].clone();
    arrowLeftFill[3] = arrowLeftFill[0].clone();

    const arrowRightFill: Point3d[] = [];
    arrowRightFill[0] = arrowOutline[0].clone();
    arrowRightFill[1] = arrowOutline[3].clone();
    arrowRightFill[2] = arrowOutline[2].clone();
    arrowRightFill[3] = arrowRightFill[0].clone();

    northArrowBuilder.setSymbology(color, ColorDef.from(0, 0, 0, 200), 1);
    northArrowBuilder.addArc(Arc3d.createXY(Point3d.createZero(), 0.6), true, true);
    northArrowBuilder.addArc(Arc3d.createXY(Point3d.create(0.0, 0.85), 0.2), true, true);

    northArrowBuilder.setSymbology(color, color, 2);
    northArrowBuilder.addArc(Arc3d.createXY(Point3d.createZero(), 0.5), false, false);
    northArrowBuilder.addLineString([Point3d.create(0.6, 0.0), Point3d.create(-0.6, 0.0)]);
    northArrowBuilder.addLineString([Point3d.create(0.0, 0.6), Point3d.create(0.0, -0.6)]);

    northArrowBuilder.setSymbology(color, ColorDef.from(150, 150, 150), 1);
    northArrowBuilder.addShape(arrowLeftFill);

    northArrowBuilder.setSymbology(color, ColorDef.black, 1);
    northArrowBuilder.addShape(arrowRightFill);

    northArrowBuilder.setSymbology(color, color, 1);
    northArrowBuilder.addLineString(arrowOutline);
    northArrowBuilder.setSymbology(color, color, 3);
    northArrowBuilder.addLineString([Point3d.create(-0.1, 0.75), Point3d.create(-0.1, 0.95), Point3d.create(0.1, 0.75), Point3d.create(0.1, 0.95)]);

    context.addDecorationFromBuilder(northArrowBuilder);
  }

  public drawMonumentPoint(context: DecorateContext, point: Point3d, scaleFactor: number, id?: string): void {
    const vp = context.viewport;
    const pixelSize = vp.pixelsFromInches(0.25) * scaleFactor;
    const scale = vp.viewingSpace.getPixelSizeAtPoint(point) * pixelSize;
    const matrix = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createDegrees(45.0));

    matrix.scaleColumnsInPlace(scale, scale, scale);
    const monumentTrans = Transform.createRefs(point, matrix);

    const monumentPointBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay, monumentTrans, id);
    const color = ColorDef.white;

    monumentPointBuilder.setSymbology(color, ColorDef.from(0, 0, 0, 150), 1);
    monumentPointBuilder.addArc(Arc3d.createXY(Point3d.createZero(), 0.7), true, true);

    monumentPointBuilder.setSymbology(color, color, 2);
    monumentPointBuilder.addArc(Arc3d.createXY(Point3d.createZero(), 0.5), false, false);
    monumentPointBuilder.addLineString([Point3d.create(0.5, 0.0), Point3d.create(-0.5, 0.0)]);
    monumentPointBuilder.addLineString([Point3d.create(0.0, 0.5), Point3d.create(0.0, -0.5)]);

    context.addDecorationFromBuilder(monumentPointBuilder);
  }

  public decorate(context: DecorateContext): void {
    if (this._suspendDecorator)
      return;

    if (undefined === this._clipId || undefined === this._clipShape || undefined === this._clipRange)
      return;

    const vp = context.viewport;
    if (this.viewport !== vp)
      return;

    if (!this.suspendGeolocationDecorations && undefined !== this._northDirection && this._allowEcefLocationChange && this.iModel.isGeoLocated)
      this.drawNorthArrow(context, this._northDirection, this._northId);

    const maxSizeInches = ((this._clipRange.maxLength() / vp.viewingSpace.getPixelSizeAtPoint(this._clipRange.center)) / vp.pixelsPerInch) * 0.5; // Display size limit when zooming out...
    if (maxSizeInches < 0.5)
      return;

    if (!this.suspendGeolocationDecorations && undefined !== this._monumentPoint && this._allowEcefLocationChange)
      this.drawMonumentPoint(context, this._monumentPoint, 1.0, this._monumentId);

    ViewClipTool.drawClipShape(context, this._clipShape, this._clipShapeExtents!, ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor), 3, this._clipId);

    if (!this._isActive)
      return;

    const outlineColor = ColorDef.from(0, 0, 0, 50).adjustForContrast(vp.view.backgroundColor);
    const fillVisColor = ColorDef.from(150, 250, 200, 225).adjustForContrast(vp.view.backgroundColor);
    const fillHidColor = fillVisColor.clone(); fillHidColor.setAlpha(200);
    const fillSelColor = fillVisColor.invert(); fillSelColor.setAlpha(75);
    const shapePts = EditManipulator.HandleUtils.getArrowShape(0.0, 0.15, 0.55, 1.0, 0.3, 0.5, 0.1);

    for (let iFace = 0; iFace < this._controlIds.length; iFace++) {
      const sizeInches = Math.min(this._controls[iFace].sizeInches, maxSizeInches);
      if (0.0 === sizeInches)
        continue;

      const anchorRay = ViewClipTool.getClipRayTransformed(this._controls[iFace].origin, this._controls[iFace].direction, undefined !== this._clipShape ? this._clipShape.transformFromClip : undefined);
      const transform = EditManipulator.HandleUtils.getArrowTransform(vp, anchorRay.origin, anchorRay.direction, sizeInches);
      if (undefined === transform)
        continue;

      const visPts: Point3d[] = []; for (const pt of shapePts) visPts.push(pt.clone()); // deep copy because we're using a builder transform w/addLineString...
      const hidPts: Point3d[] = []; for (const pt of shapePts) hidPts.push(pt.clone());
      const arrowVisBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay, transform, this._controlIds[iFace]);
      const arrowHidBuilder = context.createGraphicBuilder(GraphicType.WorldDecoration, transform);
      const isSelected = this.iModel.selectionSet.has(this._controlIds[iFace]);

      let outlineColorOvr = this._controls[iFace].outline;
      if (undefined !== outlineColorOvr) {
        outlineColorOvr = outlineColorOvr.adjustForContrast(vp.view.backgroundColor);
        outlineColorOvr.setAlpha(outlineColor.getAlpha());
      } else {
        outlineColorOvr = outlineColor;
      }

      let fillVisColorOvr = this._controls[iFace].fill;
      let fillHidColorOvr = fillHidColor;
      let fillSelColorOvr = fillSelColor;
      if (undefined !== fillVisColorOvr) {
        fillVisColorOvr = fillVisColorOvr.adjustForContrast(vp.view.backgroundColor);
        fillVisColorOvr.setAlpha(fillVisColor.getAlpha());
        fillHidColorOvr = fillVisColorOvr.clone(); fillHidColorOvr.setAlpha(fillHidColor.getAlpha());
        fillSelColorOvr = fillVisColorOvr.invert(); fillSelColorOvr.setAlpha(fillSelColor.getAlpha());
      } else {
        fillVisColorOvr = fillVisColor;
      }

      arrowVisBuilder.setSymbology(outlineColorOvr, outlineColorOvr, isSelected ? 4 : 2);
      arrowVisBuilder.addLineString(visPts);
      arrowVisBuilder.setBlankingFill(isSelected ? fillSelColorOvr : fillVisColorOvr);
      arrowVisBuilder.addShape(visPts);
      context.addDecorationFromBuilder(arrowVisBuilder);

      arrowHidBuilder.setSymbology(fillHidColorOvr, fillHidColorOvr, 1);
      arrowHidBuilder.addShape(hidPts);
      context.addDecorationFromBuilder(arrowHidBuilder);
    }
  }

  public resetEcefLocation(): boolean {
    if (!this._allowEcefLocationChange)
      return false;

    if (undefined === this._ecefLocation) {
      enableBackgroundMap(this.viewport, false); // Wasn't geolocated originally, can't clear...but we can turn off map.
      return false;
    }

    if (undefined === this.getModifiedEcefLocation())
      return false; // Wasn't changed...

    this.iModel.setEcefLocation(this._ecefLocation);
    if (this._hasGCSDefined)
      this.iModel.disableGCS(false);

    this._origin = undefined;
    this._monumentPoint = this.getMonumentPoint();
    this._northDirection = this.getNorthDirection();

    updateMapDisplay(this.viewport, false);
    return true;
  }

  public updateEcefLocation(origin: Cartographic, point?: Point3d, angle?: Angle): boolean {
    if (!this._allowEcefLocationChange)
      return false;

    const newEcefLocation = EcefLocation.createFromCartographicOrigin(origin, point, (undefined !== angle ? angle : this.getNorthAngle())); // Preserve modified north direction...
    const ecefLocation = this.iModel.ecefLocation;
    if (undefined !== ecefLocation && this.isAlmostEqualEcefLocations(ecefLocation, newEcefLocation))
      return false;

    this.iModel.setEcefLocation(newEcefLocation);
    if (this._hasGCSDefined)
      this.iModel.disableGCS(true); // Map display will ignore change to ecef location when GCS is present...

    this._origin = origin.clone();
    this._monumentPoint = this.iModel.cartographicToSpatialFromEcef(origin);
    this._northDirection = this.getNorthDirection(undefined !== this._northDirection ? this._northDirection.origin : undefined); // Preserve modified north reference point...

    updateMapDisplay(this.viewport, true);
    return true;
  }

  public updateNorthDirection(northDir: Ray3d): boolean {
    if (!this._allowEcefLocationChange || !this.iModel.isGeoLocated)
      return false;

    const point = (undefined !== this._monumentPoint ? this._monumentPoint : this.getMonumentPoint()); // Preserve modified monument point...
    const origin = this.iModel.spatialToCartographicFromEcef(point);

    const saveDirection = this._northDirection;
    this._northDirection = northDir; // Change reference point to input location...
    const angle = this.getNorthAngle();

    if (!this.updateEcefLocation(origin, point, angle)) {
      this._northDirection = saveDirection;
      return false;
    }

    return true;
  }

  private isAlmostEqualEcefLocations(loc1: EcefLocation, loc2: EcefLocation): boolean {
    return (loc1.origin.isAlmostEqual(loc2.origin) && loc1.orientation.isAlmostEqual(loc2.orientation));
  }

  public getModifiedEcefLocation(): EcefLocation | undefined {
    const ecefLocation = this.iModel.ecefLocation;
    if (undefined === ecefLocation)
      return undefined; // geolocation wasn't added...

    if (undefined === this._ecefLocation)
      return ecefLocation; // geolocation didn't exist previously...

    return (this.isAlmostEqualEcefLocations(ecefLocation, this._ecefLocation) ? undefined : ecefLocation);
  }

  public getModifiedExtents(): Range3d | undefined {
    if (undefined === this._clipRange)
      return undefined;
    // ### TODO: Validate that size is reasonable...something like the following:
    //   20km for non-projected
    //   350km for projected
    //   2km height?
    //   Show some visual indication when extents too big...
    return this._clipRange.isAlmostEqual(this.iModel.projectExtents) ? undefined : this._clipRange;
  }

  public static allowEcefLocationChange(requireExisting: boolean, outputError: boolean = true): boolean {
    if (undefined === ProjectExtentsClipDecoration._decorator) {
      if (outputError)
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, translateMessage("NotActive")));
      return false;
    } else if (!ProjectExtentsClipDecoration._decorator._allowEcefLocationChange) {
      if (outputError)
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, translateMessage("NotAllowed")));
      return false;
    } else if (requireExisting && !ProjectExtentsClipDecoration._decorator.iModel.isGeoLocated) {
      if (outputError)
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, translateMessage("NotGeolocated")));
      return false;
    }
    return true;
  }

  public static get(): ProjectExtentsClipDecoration | undefined {
    if (undefined === ProjectExtentsClipDecoration._decorator)
      return undefined;
    return ProjectExtentsClipDecoration._decorator;
  }

  public static show(vp: ScreenViewport): boolean {
    if (!vp.view.isSpatialView())
      return false;

    if (undefined !== ProjectExtentsClipDecoration._decorator) {
      const deco = ProjectExtentsClipDecoration._decorator;
      if (vp === deco.viewport && undefined !== deco._clipId && undefined !== deco._clip) {
        if (deco._clip !== vp.view.getViewClip()) {
          clearViewClip(vp);
          ViewClipTool.enableClipVolume(vp);
          ViewClipTool.setViewClip(vp, deco._clip);
        }
        if (undefined === deco._removeManipulatorToolListener) {
          deco._removeManipulatorToolListener = IModelApp.toolAdmin.manipulatorToolEvent.addListener(deco.onManipulatorToolEvent, deco);
          deco.start();
        }
        return true;
      }
      ProjectExtentsClipDecoration.clear();
    }

    clearViewClip(vp); // Clear any existing view clip and send clear event...
    ViewClipTool.enableClipVolume(vp);
    if (!ViewClipTool.doClipToRange(vp, vp.iModel.projectExtents, Transform.createIdentity()))
      return false;

    ProjectExtentsClipDecoration._decorator = new ProjectExtentsClipDecoration(vp);
    vp.onChangeView.addOnce(() => this.clear(false, true));
    return (undefined !== ProjectExtentsClipDecoration._decorator._clipId);
  }

  public static hide(): void {
    if (undefined === ProjectExtentsClipDecoration._decorator)
      return;
    const saveClipId = ProjectExtentsClipDecoration._decorator._clipId; // cleared by stop to trigger decorator removal...
    ProjectExtentsClipDecoration._decorator.stop();
    ProjectExtentsClipDecoration._decorator._clipId = saveClipId;
  }

  public static clear(clearClip: boolean = true, resetEcef: boolean = true): void {
    if (undefined === ProjectExtentsClipDecoration._decorator)
      return;
    if (clearClip)
      clearViewClip(ProjectExtentsClipDecoration._decorator.viewport); // Clear project extents view clip...
    if (resetEcef)
      ProjectExtentsClipDecoration._decorator.resetEcefLocation(); // Restore modified ecef location back to create state...
    ProjectExtentsClipDecoration._decorator.stop();
    ProjectExtentsClipDecoration._decorator = undefined;
  }
}
