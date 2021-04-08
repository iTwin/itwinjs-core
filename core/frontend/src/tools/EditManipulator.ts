/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { AxisOrder, Geometry, Matrix3d, Plane3dByOriginAndUnitNormal, Point3d, Ray3d, Transform, Vector3d } from "@bentley/geometry-core";
import { ColorDef, Npc } from "@bentley/imodeljs-common";
import { CoordSystem } from "../CoordSystem";
import { HitDetail } from "../HitDetail";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { SelectionSetEvent } from "../SelectionSet";
import { DecorateContext } from "../ViewContext";
import { Viewport } from "../Viewport";
import { BeButton, BeButtonEvent, BeTouchEvent, CoordinateLockOverrides, EventHandled, InputCollector, InputSource, Tool } from "./Tool";
import { ManipulatorToolEvent } from "./ToolAdmin";

/** A manipulator maintains a set of controls used to modify element(s) or pickable decorations.
 * Interactive modification is handled by installing an InputCollector tool.
 * @internal
 */
export namespace EditManipulator {
  export enum EventType { Synch, Cancel, Accept }

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
      this.initLocateElements(false, true, undefined, CoordinateLockOverrides.None); // InputCollector inherits state of suspended primitive, set everything...
    }

    protected cancel(_ev: BeButtonEvent): boolean { return true; }
    protected abstract accept(_ev: BeButtonEvent): boolean;

    public onPostInstall(): void { super.onPostInstall(); this.init(); }
    public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> { if (!this.accept(ev)) return EventHandled.No; this.exitTool(); this.manipulator.onManipulatorEvent(EventType.Accept); return EventHandled.Yes; }
    public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> { if (!this.cancel(ev)) return EventHandled.No; this.exitTool(); this.manipulator.onManipulatorEvent(EventType.Cancel); return EventHandled.Yes; }
    public async onTouchMove(ev: BeTouchEvent): Promise<void> { return IModelApp.toolAdmin.convertTouchMoveToMotion(ev); }
    public async onTouchComplete(ev: BeTouchEvent): Promise<void> { return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev); }
    public async onTouchCancel(ev: BeTouchEvent): Promise<void> { return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev, BeButton.Reset); }
  }

  export abstract class HandleProvider {
    protected _isActive = false;
    protected _removeManipulatorToolListener?: () => void;
    protected _removeSelectionListener?: () => void;
    protected _removeDecorationListener?: () => void;

    // eslint-disable-next-line @typescript-eslint/unbound-method
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
          this._removeSelectionListener = this.iModel.selectionSet.onChanged.addListener(this.onSelectionChanged, this); // eslint-disable-line @typescript-eslint/unbound-method
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

    public onSelectionChanged(ev: SelectionSetEvent): void {
      if (this.iModel === ev.set.iModel)
        this.onManipulatorEvent(EventType.Synch);
    }

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
    protected abstract createControls(): Promise<boolean>;

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

    public onManipulatorEvent(_eventType: EventType): void { this.updateControls(); } // eslint-disable-line @typescript-eslint/no-floating-promises
    protected async onDoubleClick(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled> { return EventHandled.No; }
    protected async onRightClick(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled> { return EventHandled.No; }
    protected async onTouchTap(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled> { return EventHandled.Yes; }

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
        return this.onTouchTap(hit, ev); // Default is to select controls on touch drag only, ignore tap on control...

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

    public static isPointVisible(testPt: Point3d, vp: Viewport, borderPaddingFactor: number = 0.0): boolean {
      const testPtView = vp.worldToView(testPt);
      const frustum = vp.getFrustum(CoordSystem.View);
      const screenRange = Point3d.create();
      screenRange.x = frustum.points[Npc._000].distance(frustum.points[Npc._100]);
      screenRange.y = frustum.points[Npc._000].distance(frustum.points[Npc._010]);
      const xBorder = screenRange.x * borderPaddingFactor;
      const yBorder = screenRange.y * borderPaddingFactor;
      return (!(testPtView.x < xBorder || testPtView.x > (screenRange.x - xBorder) || testPtView.y < yBorder || testPtView.y > (screenRange.y - yBorder)));
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
      if (rayToEye.direction.isParallelTo(lineRay.direction, true))
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

    /** Get a transform to orient arrow shape to view direction. If arrow direction is close to perpendicular to view direction will return undefined. */
    public static getArrowTransform(vp: Viewport, base: Point3d, direction: Vector3d, sizeInches: number): Transform | undefined {
      const boresite = EditManipulator.HandleUtils.getBoresite(base, vp);
      if (Math.abs(direction.dotProduct(boresite.direction)) >= 0.99)
        return undefined;

      const pixelSize = vp.pixelsFromInches(sizeInches);
      const scale = vp.viewingSpace.getPixelSizeAtPoint(base) * pixelSize;
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

    /** Adjust for contrast against view background color when it's relevant */
    public static adjustForBackgroundColor(color: ColorDef, vp: Viewport): ColorDef {
      if (vp.view.is3d() && vp.view.getDisplayStyle3d().environment.sky.display)
        return color;
      return color.adjustedForContrast(vp.view.backgroundColor);
    }
  }
}
