/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { BeButtonEvent, InputCollector, BeButton, EventHandled, BeTouchEvent, InputSource, Tool } from "./Tool";
import { DecorateContext } from "../ViewContext";
import { IModelApp } from "../IModelApp";
import { CoordinateLockOverrides, ManipulatorToolEvent } from "./ToolAdmin";
import { IModelConnection } from "../IModelConnection";
import { SelectEventType } from "../SelectionSet";
import { HitDetail } from "../HitDetail";
import { Viewport } from "../Viewport";
import { Point3d, Vector3d, Transform, Matrix3d, AxisOrder, Geometry } from "@bentley/geometry-core";
import { Ray3d, Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core/lib/AnalyticGeometry";

/**
 * A manipulator maintains a set of controls used to modify element(s) or pickable decorations.
 * Interactive modification is handled by installing an InputCollector tool.
 */
export namespace EditManipulator {
  export const enum EventType { Synch, Cancel, Accept }

  export abstract class HandleTool extends InputCollector {
    public static toolId = "Select.Manipulator";
    public static hidden = true;
    public constructor(public manipulator: HandleProvider) { super(); }

    /** Setup tool for press, hold, drag or click+click modification.
     * By default a geometry manipulator (ex. move linestring vertices) should honor all locks and support AccuSnap.
     * @note We set this.receivedDownEvent to get up events for this tool instance when it's installed from a down event like onModelStartDrag.
     */
    protected init(): void {
      this.receivedDownEvent = true;
      IModelApp.toolAdmin.toolState.coordLockOvr = CoordinateLockOverrides.None;
      IModelApp.accuSnap.enableLocate(false);
      IModelApp.accuSnap.enableSnap(true);
    }

    protected cancel(_ev: BeButtonEvent): boolean { return true; }
    protected abstract accept(_ev: BeButtonEvent): boolean;

    public onPostInstall(): void { super.onPostInstall(); this.init(); }
    public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> { if (!this.accept(ev)) return EventHandled.No; this.exitTool(); this.manipulator.onManipulatorEvent(EventType.Accept); return EventHandled.Yes; }
    public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> { if (!this.cancel(ev)) return EventHandled.No; this.exitTool(); this.manipulator.onManipulatorEvent(EventType.Cancel); return EventHandled.Yes; }
    public async onTouchMove(ev: BeTouchEvent): Promise<void> { IModelApp.toolAdmin.convertTouchMoveToMotion(ev); }
    public async onTouchComplete(ev: BeTouchEvent): Promise<void> { IModelApp.toolAdmin.convertTouchEndToButtonUp(ev); }
    public async onTouchCancel(ev: BeTouchEvent): Promise<void> { IModelApp.toolAdmin.convertTouchEndToButtonUp(ev, BeButton.Reset); }
  }

  export abstract class HandleProvider {
    protected _isActive = false;
    protected _removeManipulatorToolListener?: () => void;
    protected _removeSelectionListener?: () => void;
    protected _removeDecorationListener?: () => void;

    public constructor(public iModel: IModelConnection) { this._removeManipulatorToolListener = IModelApp.toolAdmin.manipulatorToolEvent.addListener(this.onManipulatorToolEvent, this); }

    protected stop(): void {
      if (this._removeSelectionListener) {
        this._removeSelectionListener();
        this._removeSelectionListener = undefined;
      }
      if (this._removeManipulatorToolListener) {
        this._removeManipulatorToolListener();
        this._removeManipulatorToolListener = undefined;
      }
      this.clearControls();
    }

    public onManipulatorToolEvent(_tool: Tool, event: ManipulatorToolEvent): void {
      switch (event) {
        case ManipulatorToolEvent.Start: {
          if (this._removeSelectionListener)
            break;
          this._removeSelectionListener = this.iModel.selectionSet.onChanged.addListener(this.onSelectionChanged, this);
          if (this.iModel.selectionSet.isActive)
            this.onManipulatorEvent(EventType.Synch); // Give opportunity to add controls when tool is started with an existing selection...
          break;
        }
        case ManipulatorToolEvent.Stop: {
          if (!this._removeSelectionListener)
            break;
          this._removeSelectionListener();
          this._removeSelectionListener = undefined;
          this.clearControls();
        }
      }
    }

    public onSelectionChanged(iModel: IModelConnection, _eventType: SelectEventType, _ids?: Set<string>): void { if (this.iModel === iModel) this.onManipulatorEvent(EventType.Synch); }

    protected updateDecorationListener(add: boolean): void {
      if (this._removeDecorationListener) {
        if (!add) {
          this._removeDecorationListener();
          this._removeDecorationListener = undefined;
        }
        IModelApp.viewManager.invalidateDecorationsAllViews();
      } else if (add) {
        if (!this._removeDecorationListener)
          this._removeDecorationListener = IModelApp.viewManager.addDecorator(this);
        IModelApp.viewManager.invalidateDecorationsAllViews();
      }
    }

    public decorate(_context: DecorateContext): void { }

    /** Provider is responsible for checking if modification by controls is valid.
     * May still wish to present controls for "transient" geometry in non-read/write applications, etc.
     */
    protected abstract async createControls(): Promise<boolean>;

    protected async updateControls(): Promise<void> {
      const created = await this.createControls();
      if (this._isActive && !created)
        this.clearControls();
      else
        this.updateDecorationListener(this._isActive = created);
    }

    protected clearControls(): void {
      this.updateDecorationListener(this._isActive = false);
    }

    /** run tool to handle interactive drag/click modification. */
    protected abstract modifyControls(_hit: HitDetail, _ev: BeButtonEvent): boolean;

    public onManipulatorEvent(_eventType: EventType): void { this.updateControls(); }
    protected async onDoubleClick(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled> { return EventHandled.No; }
    protected async onRightClick(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled> { return EventHandled.No; }

    public async onDecorationButtonEvent(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> {
      if (!this._isActive)
        return EventHandled.No;

      if (ev.isDoubleClick)
        return this.onDoubleClick(hit, ev);

      if (BeButton.Reset === ev.button && !ev.isDown && !ev.isDragging)
        return this.onRightClick(hit, ev);

      if (BeButton.Data !== ev.button)
        return EventHandled.No;

      if (ev.isControlKey)
        return EventHandled.No; // Support ctrl+click to select multiple controls (ex. linestring vertices)...

      if (InputSource.Touch === ev.inputSource && !ev.isDragging)
        return EventHandled.Yes; // Select controls on touch drag only, ignore tap on control...

      if (ev.isDown && !ev.isDragging)
        return EventHandled.No; // Select controls on up event or down event only after drag started...

      if (!this.modifyControls(hit, ev))
        return EventHandled.No;

      // In case InputCollector was installed for handle modification, don't wait for motion to show dynamic frame adjusted for AccuDraw hints...
      IModelApp.accuDraw.refreshDecorationsAndDynamics();

      return EventHandled.Yes;
    }
  }

  export class HandleUtils {
    public static getBoresite(origin: Point3d, vp: Viewport, checkAccuDraw: boolean = false, checkACS: boolean = false): Ray3d {
      if (checkAccuDraw && IModelApp.accuDraw.isActive)
        return Ray3d.create(origin, IModelApp.accuDraw.getRotation().getRow(2).negate());

      if (checkACS && vp.isContextRotationRequired)
        return Ray3d.create(origin, vp.getAuxCoordRotation().getRow(2).negate());

      const eyePoint = vp.worldToViewMap.transform1.columnZ();
      const direction = Vector3d.createFrom(eyePoint);
      const aa = Geometry.conditionalDivideFraction(1, eyePoint.w);
      if (aa !== undefined) {
        const xyzEye = direction.scale(aa);
        direction.setFrom(origin.vectorTo(xyzEye));
      }
      direction.scaleToLength(-1.0, direction);
      return Ray3d.create(origin, direction);
    }

    public static projectPointToPlaneInView(spacePt: Point3d, planePt: Point3d, planeNormal: Vector3d, vp: Viewport, checkAccuDraw: boolean = false, checkACS: boolean = false): Point3d | undefined {
      const plane = Plane3dByOriginAndUnitNormal.create(planePt, planeNormal);
      if (undefined === plane)
        return undefined;
      const rayToEye = EditManipulator.HandleUtils.getBoresite(spacePt, vp, checkAccuDraw, checkACS);
      const projectedPt = Point3d.createZero();
      if (undefined === rayToEye.intersectionWithPlane(plane, projectedPt))
        return undefined;
      return projectedPt;
    }

    public static projectPointToLineInView(spacePt: Point3d, linePt: Point3d, lineDirection: Vector3d, vp: Viewport, checkAccuDraw: boolean = false, checkACS: boolean = false): Point3d | undefined {
      const lineRay = Ray3d.create(linePt, lineDirection);
      const rayToEye = EditManipulator.HandleUtils.getBoresite(spacePt, vp, checkAccuDraw, checkACS);
      if (rayToEye.direction.isParallelTo(lineRay.direction))
        return lineRay.projectPointToRay(spacePt);
      const matrix = Matrix3d.createRigidFromColumns(lineRay.direction, rayToEye.direction, AxisOrder.XZY);
      if (undefined === matrix)
        return undefined;
      const plane = Plane3dByOriginAndUnitNormal.create(linePt, matrix.columnZ());
      if (undefined === plane)
        return undefined;
      const projectedPt = Point3d.createZero();
      if (undefined === rayToEye.intersectionWithPlane(plane, projectedPt))
        return undefined;
      return lineRay.projectPointToRay(projectedPt);
    }

    /** Get a transform to orient arrow shape to view direction. If arrow direction is almost perpendicular to view direction will return undefined. */
    public static getArrowTransform(vp: Viewport, base: Point3d, direction: Vector3d, sizeInches: number): Transform | undefined {
      const boresite = EditManipulator.HandleUtils.getBoresite(base, vp);
      if (Math.abs(direction.dotProduct(boresite.direction)) >= 0.99)
        return undefined;

      const pixelSize = vp.pixelsFromInches(sizeInches);
      const scale = vp.viewFrustum.getPixelSizeAtPoint(base) * pixelSize;
      const matrix = Matrix3d.createRigidFromColumns(direction, boresite.direction, AxisOrder.XZY);
      if (undefined === matrix)
        return undefined;

      matrix.scaleColumnsInPlace(scale, scale, scale);
      return Transform.createRefs(base.clone(), matrix);
    }

    /** Return array of shape points representing a unit arrow in xy plane pointing in positive x direction. */
    public static getArrowShape(baseStart: number = 0.0, baseWidth: number = 0.15, tipStart: number = 0.55, tipEnd: number = 1.0, tipWidth: number = 0.3, flangeStart: number = tipStart, flangeWidth: number = baseWidth): Point3d[] {
      const shapePts: Point3d[] = [];
      shapePts[0] = Point3d.create(tipEnd, 0.0);
      shapePts[1] = Point3d.create(flangeStart, tipWidth);
      shapePts[2] = Point3d.create(tipStart, flangeWidth);
      shapePts[3] = Point3d.create(baseStart, baseWidth);
      shapePts[4] = Point3d.create(baseStart, -baseWidth);
      shapePts[5] = Point3d.create(tipStart, -flangeWidth);
      shapePts[6] = Point3d.create(flangeStart, -tipWidth);
      shapePts[7] = shapePts[0].clone();
      return shapePts;
    }
  }
}
