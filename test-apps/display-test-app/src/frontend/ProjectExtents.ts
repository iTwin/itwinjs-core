/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  Geometry,
  Range3d,
  Point2d,
  Point3d,
  Vector3d,
} from "@bentley/geometry-core";
import {
  AxisAlignedBox3d,
  ColorDef,
  LinePixels,
} from "@bentley/imodeljs-common";
import {
  imageElementFromUrl,
  BeButtonEvent,
  CoordinateLockOverrides,
  DecorateContext,
  DynamicsContext,
  EditManipulator,
  EventHandled,
  GraphicType,
  HitDetail,
  IModelApp,
  IModelConnection,
  Marker,
} from "@bentley/imodeljs-frontend";

export class ProjectExtentsResizeTool extends EditManipulator.HandleTool {
  protected _anchorIndex: number;
  protected _ids: string[];
  protected _base: Point3d[];
  protected _axis: Vector3d[];

  public constructor(manipulator: EditManipulator.HandleProvider, hitId: string, ids: string[], base: Point3d[], axis: Vector3d[]) {
    super(manipulator);
    this._anchorIndex = ids.indexOf(hitId);
    this._ids = ids;
    this._base = base;
    this._axis = axis;
  }

  protected init(): void {
    this.receivedDownEvent = true;
    this.initLocateElements(false, false, undefined, CoordinateLockOverrides.All); // Disable locate/snap/locks for control modification; overrides state inherited from suspended primitive...
    IModelApp.accuDraw.deactivate(); // Disable activate of compass from beginDynamics...
    this.beginDynamics();
  }

  protected accept(ev: BeButtonEvent): boolean {
    const extents = this.computeNewExtents(ev);
    if (undefined === extents)
      return true;

    // NEEDSWORK: Update extents and low/high markers...
    return true;
  }

  public computeNewExtents(ev: BeButtonEvent): Range3d | undefined {
    if (-1 === this._anchorIndex || undefined === ev.viewport)
      return undefined;

    // NOTE: Use AccuDraw z instead of view z if AccuDraw is explicitly enabled (tool disables by default)...
    const projectedPt = EditManipulator.HandleUtils.projectPointToLineInView(ev.point, this._base[this._anchorIndex], this._axis[this._anchorIndex], ev.viewport, true);
    if (undefined === projectedPt)
      return undefined;

    const anchorPt = this._base[this._anchorIndex];
    const offsetVec = Vector3d.createStartEnd(anchorPt, projectedPt);
    let offset = offsetVec.normalizeWithLength(offsetVec).mag;
    if (offset < Geometry.smallMetricDistance)
      return;
    if (offsetVec.dotProduct(this._axis[this._anchorIndex]) < 0.0)
      offset *= -1.0;

    const adjustedPts: Point3d[] = [];
    for (let iFace = 0; iFace < this._ids.length; iFace++) {
      if (iFace === this._anchorIndex || this.manipulator.iModel.selectionSet.has(this._ids[iFace]))
        adjustedPts.push(this._base[iFace].plusScaled(this._axis[iFace], offset));
      else
        adjustedPts.push(this._base[iFace]);
    }

    const extents = Range3d.create();
    extents.extendArray(adjustedPts);

    return extents;
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    const extents = this.computeNewExtents(ev);
    if (undefined === extents)
      return;

    const builder = context.createSceneGraphicBuilder();
    builder.setSymbology(ev.viewport!.getContrastToBackgroundColor(), ColorDef.black, 1, LinePixels.Code2);
    builder.addRangeBox(extents);
    context.addGraphic(builder.finish());
  }
}

export class ProjectExtentsDecoration extends EditManipulator.HandleProvider {
  private static _decorator?: ProjectExtentsDecoration;
  protected _extents: AxisAlignedBox3d;
  protected _markers: Marker[] = [];
  protected _boxId?: string;
  protected _controlIds: string[] = [];
  protected _controlPoint: Point3d[] = [];
  protected _controlAxis: Vector3d[] = [];

  public constructor(iModel: IModelConnection) {
    super(iModel);
    this._extents = this.iModel.projectExtents;
    this._boxId = this.iModel.transientIds.next;
    this.updateDecorationListener(true);

    const image = imageElementFromUrl("map_pin.svg");
    const markerDrawFunc = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, 2 * Math.PI);
      ctx.fillStyle = "green";
      ctx.lineWidth = 1;
      ctx.strokeStyle = "black";
      ctx.fill();
      ctx.stroke();
    };

    const markerSize = Point2d.create(48, 48);
    const imageOffset = Point2d.create(-11, 32);
    const createBoundsMarker = (label: string, markerPos: Point3d): void => {
      const marker = new Marker(markerPos, markerSize);
      marker.drawFunc = markerDrawFunc;
      marker.label = label;
      marker.imageOffset = imageOffset;
      marker.setImage(image);
      marker.setScaleFactor({ low: .4, high: 1.5 });
      this._markers.push(marker);
    };

    createBoundsMarker(this.iModel.iModelToken.key!, this._extents.center);
    createBoundsMarker("low", this._extents.low);
    createBoundsMarker("high", this._extents.high);
  }

  protected stop(): void {
    const selectedId = (undefined !== this._boxId && this.iModel.selectionSet.has(this._boxId)) ? this._boxId : undefined;
    this._boxId = undefined; // Invalidate id so that decorator will be dropped...
    super.stop();
    if (undefined !== selectedId)
      this.iModel.selectionSet.remove(selectedId); // Don't leave decorator id in selection set...
  }

  protected async createControls(): Promise<boolean> {
    //    if (this.iModel.isReadonly)
    //      return false;

    // Decide if resize controls should be presented.
    if (undefined === this._boxId)
      return false;

    const iModel = this.iModel;

    // Show controls if only extents box and it's controls are selected, selection set doesn't include any other elements...
    let showControls = false;
    if (iModel.selectionSet.size <= this._controlIds.length + 1 && iModel.selectionSet.has(this._boxId)) {
      showControls = true;
      if (iModel.selectionSet.size > 1) {
        iModel.selectionSet.elements.forEach((val) => {
          if (this._boxId !== val && !this._controlIds.includes(val))
            showControls = false;
        });
      }
    }

    if (!showControls)
      return false;

    this._extents = iModel.projectExtents; // Update extents post-modify...NEEDSWORK - Update marker locations too!

    const transientIds = iModel.transientIds;
    if (0 === this._controlIds.length) {
      this._controlIds[0] = transientIds.next;
      this._controlIds[1] = transientIds.next;
      this._controlIds[2] = transientIds.next;
      this._controlIds[3] = transientIds.next;
      this._controlIds[4] = transientIds.next;
      this._controlIds[5] = transientIds.next;
    }

    const xOffset = 0.5 * this._extents.xLength();
    const yOffset = 0.5 * this._extents.yLength();
    const zOffset = 0.5 * this._extents.zLength();
    const center = this._extents.center;

    this._controlAxis[0] = Vector3d.unitX();
    this._controlAxis[1] = Vector3d.unitX(-1.0);
    this._controlPoint[0] = center.plusScaled(this._controlAxis[0], xOffset);
    this._controlPoint[1] = center.plusScaled(this._controlAxis[1], xOffset);

    this._controlAxis[2] = Vector3d.unitY();
    this._controlAxis[3] = Vector3d.unitY(-1.0);
    this._controlPoint[2] = center.plusScaled(this._controlAxis[2], yOffset);
    this._controlPoint[3] = center.plusScaled(this._controlAxis[3], yOffset);

    this._controlAxis[4] = Vector3d.unitZ();
    this._controlAxis[5] = Vector3d.unitZ(-1.0);
    this._controlPoint[4] = center.plusScaled(this._controlAxis[4], zOffset);
    this._controlPoint[5] = center.plusScaled(this._controlAxis[5], zOffset);

    return true;
  }

  protected clearControls(): void {
    this.iModel.selectionSet.remove(this._controlIds); // Remove any selected controls as they won't continue to be displayed...
    super.clearControls();
  }

  protected modifyControls(hit: HitDetail, _ev: BeButtonEvent): boolean {
    if (hit.sourceId === this._boxId)
      return false;
    const manipTool = new ProjectExtentsResizeTool(this, hit.sourceId, this._controlIds, this._controlPoint, this._controlAxis);
    return manipTool.run();
  }

  public testDecorationHit(id: string): boolean { return (id === this._boxId || this._controlIds.includes(id)); }
  public async getDecorationToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    if (hit.sourceId === this._boxId) {
      const popup = window.document.createElement("div");
      const image = window.document.createElement("img"); image.className = "simpleicon"; image.src = "Warning_sign.svg"; popup.appendChild(image);
      const descr = window.document.createElement("div"); descr.className = "tooltip"; descr.innerHTML = "Project Extents"; popup.appendChild(descr);
      return popup;
    }
    return "Resize Project Extents";
  }
  protected async onTouchTap(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> { return (hit.sourceId === this._boxId ? EventHandled.No : super.onTouchTap(hit, ev)); }

  protected updateDecorationListener(_add: boolean) {
    super.updateDecorationListener(undefined !== this._boxId); // Decorator isn't just for resize controls...
  }

  public decorate(context: DecorateContext): void {
    if (undefined === this._boxId)
      return;

    const vp = context.viewport;
    if (!vp.view.isSpatialView())
      return;

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined, this._boxId);

    builder.setSymbology(vp.getContrastToBackgroundColor(), ColorDef.black, 3);
    builder.addRangeBox(this._extents);
    context.addDecorationFromBuilder(builder);

    this._markers.forEach((marker) => marker.addDecoration(context));

    if (!this._isActive)
      return;

    const outlineColor = ColorDef.black.adjustForContrast(vp.view.backgroundColor, 100);
    for (let iFace = 0; iFace < this._controlIds.length; iFace++) {
      const transform = EditManipulator.HandleUtils.getArrowTransform(vp, this._controlPoint[iFace], this._controlAxis[iFace], 0.75);
      if (undefined === transform)
        continue;

      const fillColor = (0.0 !== this._controlAxis[iFace].x ? ColorDef.red : (0.0 !== this._controlAxis[iFace].y ? ColorDef.green : ColorDef.blue)).adjustForContrast(vp.view.backgroundColor, 100);
      const shapePts = EditManipulator.HandleUtils.getArrowShape(0.0, 0.15, 0.55, 1.0, 0.3, 0.5, 0.1);
      const arrowBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay, transform, this._controlIds[iFace]);

      arrowBuilder.setSymbology(outlineColor, outlineColor, 2);
      arrowBuilder.addLineString(shapePts);
      arrowBuilder.setBlankingFill(fillColor);
      arrowBuilder.addShape(shapePts);

      context.addDecorationFromBuilder(arrowBuilder);
    }
  }

  public static toggle(imodel: IModelConnection) {
    if (undefined === ProjectExtentsDecoration._decorator) {
      ProjectExtentsDecoration._decorator = new ProjectExtentsDecoration(imodel);
      IModelApp.toolAdmin.startDefaultTool();
    } else {
      ProjectExtentsDecoration._decorator.stop();
      ProjectExtentsDecoration._decorator = undefined;
    }
  }
}

export function toggleProjectExtents(imodel: IModelConnection): void {
  ProjectExtentsDecoration.toggle(imodel);
}
