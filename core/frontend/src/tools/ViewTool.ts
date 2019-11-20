/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Angle, Matrix3d, Point2d, Point3d, Range3d, Transform, Vector2d, Vector3d, YawPitchRollAngles, ClipUtilities, Geometry, Constant, Arc3d, AngleSweep, Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core";
import { ColorDef, Frustum, Npc, NpcCenter, LinePixels } from "@bentley/imodeljs-common";
import { BeTimePoint, BeDuration } from "@bentley/bentleyjs-core";
import { TentativeOrAccuSnap } from "../AccuSnap";
import { IModelApp } from "../IModelApp";
import { GraphicType } from "../rendering";
import { DecorateContext } from "../ViewContext";
import { CoordSystem, ScreenViewport, Viewport, ViewRect, Animator, areViewportsCompatible, DepthPointSource } from "../Viewport";
import { MarginPercent, ViewState3d, ViewStatus } from "../ViewState";
import { BeButton, BeButtonEvent, BeTouchEvent, BeWheelEvent, CoordSource, EventHandled, InputSource, InteractiveTool, ToolSettings, CoreTools } from "./Tool";
import { AccuDraw } from "../AccuDraw";
import { StandardViewId } from "../StandardView";
import { AccuDrawShortcuts } from "./AccuDrawTool";
import { PrimitiveTool } from "./PrimitiveTool";
import { PropertyDescription } from "../properties/Description";
import { PropertyEditorParamTypes, SuppressLabelEditorParams } from "../properties/EditorParams";
import { ToolSettingsValue, ToolSettingsPropertyRecord, ToolSettingsPropertySyncItem } from "../properties/ToolSettingsValue";
import { LengthDescription } from "../properties/LengthDescription";
import { PrimitiveValue } from "../properties/Value";
import { ToolAssistance, ToolAssistanceInstruction, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceSection } from "./ToolAssistance";

/** @internal */
const enum ViewHandleWeight {
  Thin = 1,
  Normal = 2,
  Bold = 3,
  VeryBold = 4,
  FatDot = 8,
}

/** @internal */
export const enum ViewHandleType {  // tslint:disable-line:no-const-enum
  None = 0,
  Rotate = 1,
  TargetCenter = 1 << 1,
  Pan = 1 << 2,
  Scroll = 1 << 3,
  Zoom = 1 << 4,
  Walk = 1 << 5,
  Fly = 1 << 6,
  Look = 1 << 7,
}

/** @internal */
const enum ViewManipPriority {
  Low = 1,
  Normal = 10,
  Medium = 100,
  High = 1000,
}

const enum NavigateMode { Pan = 0, Look = 1, Travel = 2 }

/** An InteractiveTool that manipulates a view.
 * @public
 */
export abstract class ViewTool extends InteractiveTool {
  public static translate(val: string) { return CoreTools.translate("View." + val); }

  public inDynamicUpdate = false;
  public beginDynamicUpdate() { this.inDynamicUpdate = true; }
  public endDynamicUpdate() { this.inDynamicUpdate = false; }
  public run(..._args: any[]): boolean {
    const toolAdmin = IModelApp.toolAdmin;
    if (undefined !== this.viewport && this.viewport === toolAdmin.markupView) {
      IModelApp.notifications.outputPromptByKey("Viewing.NotDuringMarkup");
      return false;
    }

    if (!toolAdmin.onInstallTool(this))
      return false;

    toolAdmin.startViewTool(this);
    toolAdmin.onPostInstallTool(this);
    return true;
  }

  public constructor(public viewport?: ScreenViewport) {
    super();
  }
  public async onResetButtonUp(_ev: BeButtonEvent) {
    this.exitTool();
    return EventHandled.Yes;
  }

  /** Do not override. */
  public exitTool(): void { IModelApp.toolAdmin.exitViewTool(); }
  public static showPrompt(prompt: string) {
    IModelApp.notifications.outputPrompt(ViewTool.translate(prompt));
  }
}

/** @internal */
export abstract class ViewingToolHandle {
  protected readonly _lastPtNpc = new Point3d();

  constructor(public viewTool: ViewManip) { }
  public onReinitialize(): void { }
  public focusOut(): void { }
  public noMotion(_ev: BeButtonEvent): boolean { return false; }
  public motion(_ev: BeButtonEvent): boolean { return false; }
  public checkOneShot(): boolean { return true; }
  public getHandleCursor(): string { return "default"; }
  public abstract doManipulation(ev: BeButtonEvent, inDynamics: boolean): boolean;
  public abstract firstPoint(ev: BeButtonEvent): boolean;
  public abstract testHandleForHit(ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean;
  public abstract get handleType(): ViewHandleType;
  public focusIn(): void { IModelApp.toolAdmin.setCursor(this.getHandleCursor()); }
  public drawHandle(_context: DecorateContext, _hasFocus: boolean): void { }
  public onWheel(_ev: BeWheelEvent): void { }
  public needDepthPoint(_ev: BeButtonEvent, _isPreview: boolean): boolean { return false; }
  public adjustDepthPoint(isValid: boolean, _vp: Viewport, _plane: Plane3dByOriginAndUnitNormal, source: DepthPointSource): boolean {
    switch (source) {
      case DepthPointSource.Geometry:
      case DepthPointSource.Model:
      case DepthPointSource.BackgroundMap:
      case DepthPointSource.GroundPlane:
      case DepthPointSource.Grid:
        return isValid; // Sources with visible geometry/graphics are considered valid by default...
      default:
        return false; // Sources without visible geometry/graphics are NOT considered valid by default...
    }
  }
}

/** @internal */
export class ViewHandleArray {
  public handles: ViewingToolHandle[] = [];
  public focus = -1;
  public focusDrag = false;
  public hitHandleIndex = 0;
  constructor(public viewTool: ViewManip) { }

  public empty() {
    this.focus = -1;
    this.focusDrag = false;
    this.hitHandleIndex = -1; // setting to -1 will result in onReinitialize getting called before testHit which sets the hit index
    this.handles.length = 0;
  }

  public get count(): number { return this.handles.length; }
  public get hitHandle(): ViewingToolHandle | undefined { return this.getByIndex(this.hitHandleIndex); }
  public get focusHandle(): ViewingToolHandle | undefined { return this.getByIndex(this.focus); }
  public add(handle: ViewingToolHandle): void { this.handles.push(handle); }
  public getByIndex(index: number): ViewingToolHandle | undefined { return (index >= 0 && index < this.count) ? this.handles[index] : undefined; }
  public focusHitHandle(): void { this.setFocus(this.hitHandleIndex); }

  public testHit(ptScreen: Point3d, forced = ViewHandleType.None): boolean {
    this.hitHandleIndex = -1;
    const data = { distance: 0.0, priority: ViewManipPriority.Normal };
    let minDistance = 0.0;
    let minDistValid = false;
    let highestPriority = ViewManipPriority.Low;
    let nearestHitHandle: ViewingToolHandle | undefined;

    for (let i = 0; i < this.count; i++) {
      data.priority = ViewManipPriority.Normal;
      const handle = this.handles[i];

      if (forced) {
        if (handle.handleType === forced) {
          this.hitHandleIndex = i;
          return true;
        }
      } else if (handle.testHandleForHit(ptScreen, data)) {
        if (data.priority >= highestPriority) {
          if (data.priority > highestPriority)
            minDistValid = false;

          highestPriority = data.priority;

          if (!minDistValid || (data.distance < minDistance)) {
            minDistValid = true;
            minDistance = data.distance;
            nearestHitHandle = handle;
            this.hitHandleIndex = i;
          }
        }
      }
    }
    return undefined !== nearestHitHandle;
  }

  public drawHandles(context: DecorateContext): void {
    if (0 === this.count)
      return;

    // all handle objects must draw themselves
    for (let i = 0; i < this.count; ++i) {
      if (i !== this.hitHandleIndex) {
        const handle = this.handles[i];
        handle.drawHandle(context, this.focus === i);
      }
    }

    // draw the hit handle last
    if (-1 !== this.hitHandleIndex) {
      const handle = this.handles[this.hitHandleIndex];
      handle.drawHandle(context, this.focus === this.hitHandleIndex);
    }
  }

  public setFocus(index: number): void {
    if (this.focus === index && (this.focusDrag === this.viewTool.inHandleModify))
      return;

    let focusHandle: ViewingToolHandle | undefined;
    if (this.focus >= 0) {
      focusHandle = this.getByIndex(this.focus);
      if (focusHandle)
        focusHandle.focusOut();
    }

    if (index >= 0) {
      focusHandle = this.getByIndex(index);
      if (focusHandle)
        focusHandle.focusIn();
    }

    this.focus = index;
    this.focusDrag = this.viewTool.inHandleModify;

    const vp = this.viewTool.viewport;
    if (undefined !== vp)
      vp.invalidateDecorations();
  }

  public onReinitialize() { this.handles.forEach((handle) => handle.onReinitialize()); }
  public motion(ev: BeButtonEvent) { this.handles.forEach((handle) => handle.motion(ev)); }
  public onWheel(ev: BeWheelEvent) { this.handles.forEach((handle) => handle.onWheel(ev)); }

  /** determine whether a handle of a specific type exists */
  public hasHandle(handleType: ViewHandleType): boolean { return this.handles.some((handle) => handle.handleType === handleType); }
}

/** Base class for tools that manipulate the frustum of a Viewport.
 * @public
 */
export abstract class ViewManip extends ViewTool {
  /** @internal */
  public viewHandles: ViewHandleArray;
  public frustumValid = false;
  public readonly targetCenterWorld = new Point3d();
  public inHandleModify = false;
  public isDragging = false;
  public stoppedOverHandle = false;
  public targetCenterValid = false;
  public targetCenterLocked = false;
  public nPts = 0;
  /** @internal */
  protected _forcedHandle = ViewHandleType.None;
  /** @internal */
  protected _depthPreview?: { testPoint: Point3d, pickRadius: number, plane: Plane3dByOriginAndUnitNormal, source: DepthPointSource, isDefaultDepth: boolean, sourceId?: string };

  constructor(viewport: ScreenViewport | undefined, public handleMask: number, public oneShot: boolean, public isDraggingRequired: boolean = false) {
    super(viewport);
    this.viewHandles = new ViewHandleArray(this);
    this.changeViewport(viewport);
  }

  public decorate(context: DecorateContext): void {
    this.viewHandles.drawHandles(context);
    this.previewDepthPoint(context);
  }

  /** @internal */
  public previewDepthPoint(context: DecorateContext): void {
    if (undefined === this._depthPreview)
      return;

    const cursorVp = IModelApp.toolAdmin.cursorView;
    if (cursorVp !== context.viewport)
      return;

    let origin = this._depthPreview.plane.getOriginRef();
    let normal = (DepthPointSource.Model === this._depthPreview.source ? Vector3d.unitZ() : this._depthPreview.plane.getNormalRef());

    if (this._depthPreview.isDefaultDepth) {
      origin = cursorVp.worldToView(origin); origin.z = 0.0; cursorVp.viewToWorld(origin, origin); // Avoid getting clipped out in z...
      normal = context.viewport.view.getZVector(); // Always draw circle for invalid depth point oriented to view...
    }

    const pixelSize = context.viewport.getPixelSizeAtPoint(origin);
    const radius = this._depthPreview.pickRadius * pixelSize;
    const rMatrix = Matrix3d.createRigidHeadsUp(normal);
    const ellipse = Arc3d.createScaledXYColumns(origin, rMatrix, radius, radius, AngleSweep.create360());
    const colorBase = (this._depthPreview.isDefaultDepth ? ColorDef.red : (DepthPointSource.Geometry === this._depthPreview.source ? ColorDef.green : context.viewport.hilite.color));
    const colorLine = colorBase.adjustForContrast(cursorVp.view.backgroundColor); colorLine.setTransparency(50);
    const colorFill = colorLine.clone(); colorFill.setTransparency(200);

    const builder = context.createGraphicBuilder(GraphicType.WorldOverlay);
    builder.setSymbology(colorLine, colorFill, 1, this._depthPreview.isDefaultDepth ? LinePixels.Code2 : LinePixels.Solid);
    builder.addArc(ellipse, true, true);
    builder.addArc(ellipse, false, false);
    context.addDecorationFromBuilder(builder);

    ViewTargetCenter.drawCross(context, origin, this._depthPreview.pickRadius * 0.5, false);
  }

  /** @internal */
  public getDepthPointGeometryId(): string | undefined {
    if (undefined === this._depthPreview)
      return undefined;
    return (DepthPointSource.Geometry === this._depthPreview.source ? this._depthPreview.sourceId : undefined);
  }

  /** @internal */
  public clearDepthPoint(): boolean {
    if (undefined === this._depthPreview)
      return false;
    this._depthPreview = undefined;
    return true;
  }

  /** @internal */
  public getDepthPoint(ev: BeButtonEvent, isPreview: boolean = false): Point3d | undefined {
    if (!isPreview && ev.viewport && undefined !== this.getDepthPointGeometryId())
      ev.viewport.setFlashed(undefined, 0.0);

    this.clearDepthPoint();
    if (isPreview && this.inDynamicUpdate)
      return undefined;

    const vp = ev.viewport;
    if (undefined === vp || undefined === this.viewHandles.hitHandle || !this.viewHandles.hitHandle.needDepthPoint(ev, isPreview))
      return undefined;

    const pickRadiusPixels = vp.pixelsFromInches(ToolSettings.viewToolPickRadiusInches);
    const result = vp.pickDepthPoint(ev.rawPoint, pickRadiusPixels);
    let isValidDepth = false;

    switch (result.source) {
      case DepthPointSource.Geometry:
      case DepthPointSource.Model:
        isValidDepth = true;
        break;
      case DepthPointSource.BackgroundMap:
      case DepthPointSource.GroundPlane:
      case DepthPointSource.Grid:
      case DepthPointSource.ACS:
      case DepthPointSource.TargetPoint:
        const npcPt = vp.worldToNpc(result.plane.getOriginRef());
        isValidDepth = !(npcPt.z < 0.0 || npcPt.z > 1.0);
        break;
    }

    // Allow handle to reject depth depending on source and to set a default depth point when invalid...
    isValidDepth = this.viewHandles.hitHandle.adjustDepthPoint(isValidDepth, vp, result.plane, result.source);

    if (isPreview)
      this._depthPreview = { testPoint: ev.rawPoint, pickRadius: pickRadiusPixels, plane: result.plane, source: result.source, isDefaultDepth: !isValidDepth, sourceId: result.sourceId };

    return (isValidDepth || isPreview ? result.plane.getOriginRef() : undefined);
  }

  public onReinitialize(): void {
    if (undefined !== this.viewport) {
      this.viewport.synchWithView(true); // make sure we store any changes in view undo buffer.
      this.viewHandles.setFocus(-1);
    }

    this.nPts = 0;
    this.inHandleModify = false;
    this.inDynamicUpdate = false;
    this.frustumValid = false;

    this.viewHandles.onReinitialize();
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    // Tool was started in "drag required" mode, don't advance tool state and wait to see if we get the start drag event.
    if (0 === this.nPts && this.isDraggingRequired && !this.isDragging || undefined === ev.viewport)
      return EventHandled.No;

    switch (this.nPts) {
      case 0:
        this.changeViewport(ev.viewport);
        if (this.processFirstPoint(ev))
          this.nPts = 1;
        break;
      case 1:
        this.nPts = 2;
        break;
    }

    if (this.nPts > 1) {
      this.inDynamicUpdate = false;
      if (this.processPoint(ev, false) && this.oneShot)
        this.exitTool();
      else
        this.onReinitialize();
    }

    return EventHandled.Yes;
  }

  public async onDataButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (this.nPts <= 1 && this.isDraggingRequired && !this.isDragging && this.oneShot)
      this.exitTool();

    return EventHandled.No;
  }

  public async onMouseWheel(inputEv: BeWheelEvent): Promise<EventHandled> {
    const ev = inputEv.clone();
    this.viewHandles.onWheel(ev); // notify handles that wheel has rolled.

    IModelApp.toolAdmin.processWheelEvent(ev, false); // tslint:disable-line:no-floating-promises
    return EventHandled.Yes;
  }

  /** @internal */
  public async startHandleDrag(ev: BeButtonEvent, forcedHandle?: ViewHandleType): Promise<EventHandled> {
    if (this.inHandleModify)
      return EventHandled.No; // If already changing the view reject the request...

    if (undefined !== forcedHandle) {
      if (!this.viewHandles.hasHandle(forcedHandle))
        return EventHandled.No; // If requested handle isn't present reject the request...
      this._forcedHandle = forcedHandle;
    }

    this.receivedDownEvent = true; // Request up events even though we may not have gotten the down event...
    this.isDragging = true;

    if (0 === this.nPts)
      this.onDataButtonDown(ev); // tslint:disable-line:no-floating-promises

    return EventHandled.Yes;
  }

  public async onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    switch (ev.button) {
      case BeButton.Reset:
        return EventHandled.No;
      case BeButton.Middle:
        if (!this.viewHandles.hasHandle(ViewHandleType.Walk) && !this.viewHandles.hasHandle(ViewHandleType.Fly)) // Allow middle drag to override IdleTool for walk/fly...
          return EventHandled.No;
    }
    return this.startHandleDrag(ev);
  }

  public async onMouseEndDrag(ev: BeButtonEvent): Promise<EventHandled> {
    // NOTE: To support startHandleDrag being called by IdleTool for middle button drag, check inHandleModify and not the button type...
    if (!this.inHandleModify)
      return EventHandled.No;
    this.isDragging = false;
    return (0 === this.nPts) ? EventHandled.Yes : this.onDataButtonDown(ev);
  }

  public async onMouseMotion(ev: BeButtonEvent) {
    this.stoppedOverHandle = false;
    if (0 === this.nPts && this.viewHandles.testHit(ev.viewPoint))
      this.viewHandles.focusHitHandle();

    if (0 !== this.nPts)
      this.processPoint(ev, true);

    this.viewHandles.motion(ev);

    const prevSourceId = this.getDepthPointGeometryId();
    const showDepthChanged = ((0 === this.nPts && undefined !== this.getDepthPoint(ev, true)) || this.clearDepthPoint());
    if (ev.viewport && (showDepthChanged || prevSourceId)) {
      const currSourceId = this.getDepthPointGeometryId();
      if (currSourceId !== prevSourceId)
        ev.viewport.setFlashed(currSourceId, 0.25);
      ev.viewport.invalidateDecorations();
    }
  }

  public async onMouseMotionStopped(ev: BeButtonEvent) {
    if (ev.viewport !== this.viewport)
      return;

    if (0 === this.nPts) {
      if (this.viewHandles.testHit(ev.viewPoint)) {
        this.stoppedOverHandle = true;
        this.viewHandles.focusHitHandle();
      } else if (this.stoppedOverHandle) {
        this.stoppedOverHandle = false;
        this.viewport!.invalidateDecorations();
      }
    }
  }

  public async onMouseNoMotion(ev: BeButtonEvent) {
    if (0 === this.nPts || !ev.viewport)
      return;

    const hitHandle = this.viewHandles.hitHandle;
    if (hitHandle)
      hitHandle.noMotion(ev);
  }

  public async onTouchTap(ev: BeTouchEvent): Promise<EventHandled> { return ev.isSingleTap ? EventHandled.Yes : EventHandled.No; } // Prevent IdleTool from converting single tap into data button down/up...
  public async onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled> { if (!this.inHandleModify && startEv.isSingleTouch) await IModelApp.toolAdmin.convertTouchMoveStartToButtonDownAndMotion(startEv, ev); return this.inHandleModify ? EventHandled.Yes : EventHandled.No; }
  public async onTouchMove(ev: BeTouchEvent): Promise<void> { if (this.inHandleModify) return IModelApp.toolAdmin.convertTouchMoveToMotion(ev); }
  public async onTouchComplete(ev: BeTouchEvent): Promise<void> { if (this.inHandleModify) return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev); }
  public async onTouchCancel(ev: BeTouchEvent): Promise<void> { if (this.inHandleModify) return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev, BeButton.Reset); }

  public onPostInstall(): void {
    super.onPostInstall();
    this.onReinitialize(); // Call onReinitialize now that tool is installed.
  }

  /** @beta */
  public provideToolAssistance(mainInstrKey: string, additionalInstr?: ToolAssistanceInstruction[]): void {
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, ViewTool.translate(mainInstrKey));
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    const acceptMsg = CoreTools.translate("ElementSet.Inputs.AcceptPoint");
    const rejectMsg = CoreTools.translate("ElementSet.Inputs.Exit");
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchDrag, acceptMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, acceptMsg, false, ToolAssistanceInputMethod.Mouse));
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, rejectMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, rejectMsg, false, ToolAssistanceInputMethod.Mouse));

    if (undefined !== additionalInstr) {
      for (const instr of additionalInstr) {
        if (ToolAssistanceInputMethod.Touch === instr.inputMethod)
          touchInstructions.push(instr);
        else
          mouseInstructions.push(instr);
      }
    }

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  public onCleanup(): void {
    let restorePrevious = false;

    if (this.inDynamicUpdate) {
      this.endDynamicUpdate();
      restorePrevious = true;
    }

    const vp = this.viewport;
    if (undefined !== vp) {
      vp.synchWithView(true);

      if (restorePrevious)
        vp.doUndo(ToolSettings.animationTime);

      vp.invalidateDecorations();
    }
    this.viewHandles.empty();
  }

  /**
   * Set the center of rotation for rotate handle.
   * @param pt the new target point in world coordinates
   * @param lockTarget consider the target point locked for this tool instance
   * @param saveTarget save this target point for use between tool instances
   */
  public setTargetCenterWorld(pt: Point3d, lockTarget: boolean, saveTarget: boolean) {
    this.targetCenterWorld.setFrom(pt);
    this.targetCenterValid = true;
    this.targetCenterLocked = lockTarget;

    if (!this.viewport)
      return;

    if (!this.viewport.view.allow3dManipulations())
      this.targetCenterWorld.z = 0.0;

    this.viewport.viewCmdTargetCenter = (saveTarget ? pt : undefined);
  }

  public updateTargetCenter(): void {
    const vp = this.viewport;
    if (!vp)
      return;

    if (this.targetCenterValid) {
      if (this.inHandleModify)
        return;
      if (IModelApp.tentativePoint.isActive) {
        this.setTargetCenterWorld(IModelApp.tentativePoint.getPoint(), true, false);
        IModelApp.tentativePoint.clear(true); // Clear tentative, there won't be a datapoint to accept...
      }
      return;
    }

    if (IModelApp.tentativePoint.isActive)
      return this.setTargetCenterWorld(IModelApp.tentativePoint.getPoint(), true, false);

    if (TentativeOrAccuSnap.isHot)
      return this.setTargetCenterWorld(TentativeOrAccuSnap.getCurrentPoint(), true, false);

    if (vp.viewCmdTargetCenter && this.isPointVisible(vp.viewCmdTargetCenter))
      return this.setTargetCenterWorld(vp.viewCmdTargetCenter, true, true);

    return this.setTargetCenterWorld(ViewManip.getDefaultTargetPointWorld(vp), false, false);
  }

  public processFirstPoint(ev: BeButtonEvent) {
    const forcedHandle = this._forcedHandle;
    this._forcedHandle = ViewHandleType.None;
    this.frustumValid = false;

    if (this.viewHandles.testHit(ev.viewPoint, forcedHandle)) {
      this.inHandleModify = true;
      this.viewHandles.focusHitHandle();
      const handle = this.viewHandles.hitHandle;
      if (undefined !== handle && !handle.firstPoint(ev))
        return false;
    }

    return true;
  }

  public processPoint(ev: BeButtonEvent, inDynamics: boolean) {
    const hitHandle = this.viewHandles.hitHandle;
    if (undefined === hitHandle)
      return true;

    const doUpdate = hitHandle.doManipulation(ev, inDynamics);
    return inDynamics || (doUpdate && hitHandle.checkOneShot());
  }

  public lensAngleMatches(angle: Angle, tolerance: number): boolean {
    const cameraView = this.viewport!.view;
    return !cameraView.is3d() ? false : Math.abs(cameraView.calcLensAngle().radians - angle.radians) < tolerance;
  }

  public get isZUp() {
    const view = this.viewport!.view;
    const viewX = view.getXVector();
    const viewY = view.getXVector();
    const zVec = Vector3d.unitZ();
    return (Math.abs(zVec.dotProduct(viewY)) > 0.99 && Math.abs(zVec.dotProduct(viewX)) < 0.01);
  }

  public static getFocusPlaneNpc(vp: Viewport): number {
    const pt = vp.worldToNpc(vp.view.getTargetPoint());
    return (pt.z < 0.0 || pt.z > 1.0) ? 0.5 : pt.z;
  }

  public static getDefaultTargetPointWorld(vp: Viewport): Point3d {
    if (!vp.view.allow3dManipulations())
      return vp.npcToWorld(NpcCenter);

    const targetPoint = vp.view.getTargetPoint();
    const targetPointNpc = vp.worldToNpc(targetPoint);

    if (targetPointNpc.z < 0.0 || targetPointNpc.z > 1.0) {
      targetPointNpc.z = 0.5;
      vp.npcToWorld(targetPointNpc, targetPoint);
    }

    return targetPoint;
  }

  /** Determine whether the supplied point is visible in this Viewport. */
  public isPointVisible(testPt: Point3d): boolean {
    const vp = this.viewport;
    if (!vp)
      return false;
    const testPtView = vp.worldToView(testPt);
    const frustum = vp.getFrustum(CoordSystem.View);

    const screenRange = Point3d.create(
      frustum.points[Npc._000].distance(frustum.points[Npc._100]),
      frustum.points[Npc._000].distance(frustum.points[Npc._010]),
      frustum.points[Npc._000].distance(frustum.points[Npc._001]));

    return (!((testPtView.x < 0 || testPtView.x > screenRange.x) || (testPtView.y < 0 || testPtView.y > screenRange.y)));
  }

  protected static _useViewAlignedVolume: boolean = false;
  public static fitView(viewport: ScreenViewport, doAnimate: boolean, marginPercent?: MarginPercent) {
    const range = viewport.computeViewRange();
    const aspect = viewport.viewRect.aspect;
    const before = viewport.getFrustum();

    const clip = (viewport.viewFlags.clipVolume ? viewport.view.getViewClip() : undefined);
    if (undefined !== clip) {
      const clipRange = ClipUtilities.rangeOfClipperIntersectionWithRange(clip, range);
      if (!clipRange.isNull)
        range.setFrom(clipRange);
    }

    if (this._useViewAlignedVolume)
      viewport.view.lookAtViewAlignedVolume(range, aspect, marginPercent);
    else
      viewport.view.lookAtVolume(range, aspect, marginPercent);

    viewport.synchWithView(true);
    viewport.viewCmdTargetCenter = undefined;

    if (doAnimate)
      viewport.animateToCurrent(before);
  }

  public static async zoomToAlwaysDrawnExclusive(viewport: ScreenViewport, doAnimate: boolean, marginPercent?: MarginPercent): Promise<boolean> {
    if (!viewport.isAlwaysDrawnExclusive || undefined === viewport.alwaysDrawn || 0 === viewport.alwaysDrawn.size)
      return false;
    await viewport.zoomToElements(viewport.alwaysDrawn, { animateFrustumChange: doAnimate, marginPercent });
    return true;
  }

  public setCameraLensAngle(lensAngle: Angle, retainEyePoint: boolean): ViewStatus {
    const vp = this.viewport;
    if (!vp)
      return ViewStatus.InvalidViewport;

    const view = vp.view;
    if (!view || !view.is3d() || !view.allow3dManipulations())
      return ViewStatus.InvalidViewport;

    const result = (retainEyePoint && view.isCameraOn) ?
      view.lookAtUsingLensAngle(view.getEyePoint(), view.getTargetPoint(), view.getYVector(), lensAngle) :
      vp.turnCameraOn(lensAngle);

    if (result !== ViewStatus.Success)
      return result;

    vp.synchWithView(false);
    return ViewStatus.Success;
  }

  public enforceZUp(pivotPoint: Point3d) {
    const vp = this.viewport;
    if (!vp || this.isZUp)
      return false;

    const viewY = vp.view.getYVector();
    const rotMatrix = Matrix3d.createRotationVectorToVector(viewY, Vector3d.unitZ());
    if (!rotMatrix)
      return false;

    const transform = Transform.createFixedPointAndMatrix(pivotPoint, rotMatrix);
    const frust = vp.getWorldFrustum();
    frust.multiply(transform);
    vp.setupViewFromFrustum(frust);
    return true;
  }

  public changeViewport(vp?: ScreenViewport): void {
    if (vp === this.viewport && 0 !== this.viewHandles.count) // If viewport isn't really changing do nothing...
      return;

    if (this.viewport)
      this.viewport.invalidateDecorations(); // Remove decorations from current viewport...

    this.viewport = vp;
    this.targetCenterValid = false;
    if (this.handleMask & (ViewHandleType.Rotate | ViewHandleType.TargetCenter))
      this.updateTargetCenter();

    this.viewHandles.empty();
    if (this.handleMask & ViewHandleType.Rotate)
      this.viewHandles.add(new ViewRotate(this));

    if (this.handleMask & ViewHandleType.TargetCenter)
      this.viewHandles.add(new ViewTargetCenter(this));

    if (this.handleMask & ViewHandleType.Pan)
      this.viewHandles.add(new ViewPan(this));

    if (this.handleMask & ViewHandleType.Scroll)
      this.viewHandles.add(new ViewScroll(this));

    if (this.handleMask & ViewHandleType.Zoom)
      this.viewHandles.add(new ViewZoom(this));

    if (this.handleMask & ViewHandleType.Walk)
      this.viewHandles.add(new ViewWalk(this));

    if (this.handleMask & ViewHandleType.Fly)
      this.viewHandles.add(new ViewFly(this));

    if (this.handleMask & ViewHandleType.Look)
      this.viewHandles.add(new ViewLook(this));
  }
}

/** ViewingToolHandle for modifying the view's target point for operations like rotate */
class ViewTargetCenter extends ViewingToolHandle {
  public get handleType() { return ViewHandleType.TargetCenter; }
  public checkOneShot(): boolean { return false; } // Don't exit tool after moving target in single-shot mode...

  public firstPoint(ev: BeButtonEvent) {
    if (!ev.viewport)
      return false;
    IModelApp.accuSnap.enableSnap(true);
    return true;
  }

  public testHandleForHit(ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    if (this.viewTool.isDraggingRequired)
      return false; // Target center handle is not movable in this mode, but it's still nice to display the point we're rotating about...

    const targetPt = this.viewTool.viewport!.worldToView(this.viewTool.targetCenterWorld);
    const distance = targetPt.distanceXY(ptScreen);
    const locateThreshold = this.viewTool.viewport!.pixelsFromInches(0.15);

    if (distance > locateThreshold)
      return false;

    out.distance = distance;
    out.priority = ViewManipPriority.High;
    return true;
  }

  /** @internal */
  public static drawCross(context: DecorateContext, worldPoint: Point3d, sizePixels: number, hasFocus: boolean): void {
    const crossSize = Math.floor(sizePixels) + 0.5;
    const outlineSize = crossSize + 1;
    const position = context.viewport.worldToView(worldPoint); position.x = Math.floor(position.x) + 0.5; position.y = Math.floor(position.y) + 0.5;
    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,.5)";
      ctx.lineWidth = hasFocus ? 5 : 3;
      ctx.moveTo(-outlineSize, 0);
      ctx.lineTo(outlineSize, 0);
      ctx.moveTo(0, -outlineSize);
      ctx.lineTo(0, outlineSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.lineWidth = hasFocus ? 3 : 1;
      ctx.shadowColor = "black";
      ctx.shadowBlur = hasFocus ? 7 : 5;
      ctx.moveTo(-crossSize, 0);
      ctx.lineTo(crossSize, 0);
      ctx.moveTo(0, -crossSize);
      ctx.lineTo(0, crossSize);
      ctx.stroke();
    };
    context.addCanvasDecoration({ position, drawDecoration });
  }

  public drawHandle(context: DecorateContext, hasFocus: boolean): void {
    if (context.viewport !== this.viewTool.viewport)
      return;

    if (!this.viewTool.targetCenterLocked && !this.viewTool.inHandleModify)
      return; // Don't display default target center, will be updated to use pick point on element...

    let sizeInches = 0.2;
    if (!hasFocus && this.viewTool.inHandleModify) {
      const hitHandle = this.viewTool.viewHandles.hitHandle;
      if (undefined !== hitHandle && ViewHandleType.Rotate !== hitHandle.handleType)
        return; // Only display when modifying another handle if that handle is rotate (not pan)...
      sizeInches = 0.1; // Display small target when dragging...
    }

    const crossSize = context.viewport.pixelsFromInches(sizeInches);
    ViewTargetCenter.drawCross(context, this.viewTool.targetCenterWorld, crossSize, hasFocus);
  }

  public doManipulation(ev: BeButtonEvent, inDynamics: boolean) {
    if (ev.viewport !== this.viewTool.viewport)
      return false;

    this.viewTool.setTargetCenterWorld(ev.point, !inDynamics, InputSource.Touch === ev.inputSource ? false : !inDynamics);
    ev.viewport!.invalidateDecorations();

    if (!inDynamics)
      IModelApp.accuSnap.enableSnap(false);

    return false; // false means don't do screen update
  }
}

/** A ViewingToolHandle with inertia.
 * If the handle is used with *throwing action* (mouse is moving when button goes up or via a touch with movement).
 * it continues to move briefly causing the operation to continue.
 */
abstract class HandleWithInertia extends ViewingToolHandle implements Animator {
  protected _duration!: BeDuration;
  protected _end!: BeTimePoint;
  protected _inertiaVec?: Vector3d;
  public noMotion(_ev: BeButtonEvent): boolean {
    this._inertiaVec = undefined;
    return false;
  }

  public doManipulation(ev: BeButtonEvent, inDynamics: boolean): boolean {
    if (ToolSettings.viewingInertia.enabled && !inDynamics && undefined !== this._inertiaVec)
      return this.beginAnimation();

    const thisPtNpc = ev.viewport!.worldToNpc(ev.point);
    thisPtNpc.z = this._lastPtNpc.z;

    this._inertiaVec = undefined;
    if (this._lastPtNpc.isAlmostEqual(thisPtNpc, 1.0e-10))
      return true;

    this._inertiaVec = this._lastPtNpc.vectorTo(thisPtNpc);
    return this.perform(thisPtNpc);
  }

  /** Set this handle to become the Viewport's animator */
  protected beginAnimation() {
    this._duration = ToolSettings.viewingInertia.duration;
    if (this._duration.isTowardsFuture) { // ensure duration is towards future. Otherwise, don't start animation
      this._end = BeTimePoint.fromNow(this._duration);
      this.viewTool.viewport!.setAnimator(this);
    }
    return true;
  }

  /** Move this handle during the inertia duration */
  public animate(): boolean {
    if (undefined === this._inertiaVec)
      return true; // handle was removed

    // get the fraction of the inertia duration that remains. The decay is a combination of the number of iterations (see damping below)
    // and time. That way the handle slows down even if the framerate is lower.
    const remaining = ((this._end.milliseconds - BeTimePoint.now().milliseconds) / this._duration.milliseconds);
    const pt = this._lastPtNpc!.plusScaled(this._inertiaVec, remaining);

    // if we're not moving any more, or if the duration has elapsed, we're done
    if (remaining <= 0 || (this._lastPtNpc!.minus(pt).magnitudeSquared() < .000001)) {
      this.viewTool.viewport!.saveViewUndo();
      return true; // remove this as the animator
    }
    this.perform(pt); // perform the viewing operation
    this._inertiaVec.scaleInPlace(ToolSettings.viewingInertia.damping); // dampen the inertia vector
    return false;
  }

  public interrupt() { }
  protected abstract perform(thisPtNpc: Point3d): boolean;
}

/** ViewingToolHandle for performing the "pan view" operation */
class ViewPan extends HandleWithInertia {
  public get handleType() { return ViewHandleType.Pan; }
  public getHandleCursor() { return this.viewTool.inHandleModify ? IModelApp.viewManager.grabbingCursor : IModelApp.viewManager.grabCursor; }

  public firstPoint(ev: BeButtonEvent) {
    this._inertiaVec = undefined;
    const vp = ev.viewport!;
    vp.worldToNpc(ev.point, this._lastPtNpc);

    // if the camera is on, we need to find the element under the starting point to get the z
    if (this.needDepthPoint(ev, false)) {
      const visiblePoint = this.viewTool.getDepthPoint(ev);
      if (undefined !== visiblePoint)
        vp.worldToNpc(visiblePoint, this._lastPtNpc);
      else
        this._lastPtNpc.z = ViewManip.getFocusPlaneNpc(vp);
    }

    this.viewTool.beginDynamicUpdate();
    this.viewTool.provideToolAssistance("Pan.Prompts.NextPoint");
    return true;
  }

  public testHandleForHit(_ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    out.distance = 0.0;
    out.priority = ViewManipPriority.Low;
    return true;
  }

  /** perform the view pan operation */
  protected perform(thisPtNpc: Point3d) {
    const vp = this.viewTool.viewport!;
    const dist = vp.npcToWorld(thisPtNpc).vectorTo(vp.npcToWorld(this._lastPtNpc));
    const view = vp.view;
    if (view.is3d()) {
      if (ViewStatus.Success !== view.moveCameraWorld(dist))
        return false;
    } else {
      view.setOrigin(view.getOrigin().plus(dist));
    }

    vp.setupFromView();
    this._lastPtNpc.setFrom(thisPtNpc);
    return true;
  }

  /** @internal */
  public needDepthPoint(ev: BeButtonEvent, _isPreview: boolean): boolean {
    return ev.viewport!.isCameraOn && CoordSource.User === ev.coordsFrom;
  }
}

/** ViewingToolHandle for performing the "rotate view" operation */
class ViewRotate extends HandleWithInertia {
  private readonly _frustum = new Frustum();
  private readonly _activeFrustum = new Frustum();
  private readonly _anchorPtNpc = new Point3d();
  public get handleType() { return ViewHandleType.Rotate; }
  public getHandleCursor() { return IModelApp.viewManager.rotateCursor; }

  public testHandleForHit(_ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    out.distance = 0.0;
    out.priority = ViewManipPriority.Low;
    return true;
  }

  public firstPoint(ev: BeButtonEvent) {
    this._inertiaVec = undefined;

    const tool = this.viewTool;
    const vp = ev.viewport!;

    const visiblePoint = tool.getDepthPoint(ev);
    if (undefined !== visiblePoint)
      tool.setTargetCenterWorld(visiblePoint, false, false);

    vp.worldToNpc(ev.rawPoint, this._anchorPtNpc);
    this._lastPtNpc.setFrom(this._anchorPtNpc);

    vp.getWorldFrustum(this._activeFrustum);
    this._frustum.setFrom(this._activeFrustum);

    tool.beginDynamicUpdate();
    this.viewTool.provideToolAssistance("Rotate.Prompts.NextPoint");
    return true;
  }

  public perform(ptNpc: Point3d): boolean {
    const tool = this.viewTool;
    const vp = tool.viewport!;

    if (this._anchorPtNpc.isAlmostEqual(ptNpc, 1.0e-2)) // too close to anchor pt
      ptNpc.setFrom(this._anchorPtNpc);

    const currentFrustum = vp.getWorldFrustum();
    const frustumChange = !currentFrustum.equals(this._activeFrustum);
    if (frustumChange)
      this._frustum.setFrom(currentFrustum);
    else {
      if (!vp.setupViewFromFrustum(this._frustum))
        return false;
    }

    const currPt = vp.npcToView(ptNpc);
    if (frustumChange)
      this._anchorPtNpc.setFrom(ptNpc);

    let angle: Angle;
    let worldAxis: Vector3d;
    const worldPt = tool.targetCenterWorld;
    if (!vp.view.allow3dManipulations()) {
      const centerPt = vp.worldToView(worldPt);
      const firstPt = vp.npcToView(this._anchorPtNpc);
      const vector0 = Vector2d.createStartEnd(centerPt, firstPt);
      const vector1 = Vector2d.createStartEnd(centerPt, currPt);
      angle = vector0.angleTo(vector1);
      worldAxis = Vector3d.unitZ();
    } else {
      const viewRect = vp.viewRect;

      vp.npcToView(ptNpc, currPt);
      const firstPt = vp.npcToView(this._anchorPtNpc);

      const xDelta = (currPt.x - firstPt.x);
      const yDelta = (currPt.y - firstPt.y);

      // Movement in screen x == rotation about drawing Z (preserve up) or rotation about screen  Y...
      const xAxis = ToolSettings.preserveWorldUp ? Vector3d.unitZ() : vp.rotation.getRow(1);

      // Movement in screen y == rotation about screen X...
      const yAxis = vp.rotation.getRow(0);

      const xRMatrix = xDelta ? Matrix3d.createRotationAroundVector(xAxis, Angle.createRadians(Math.PI / (viewRect.width / xDelta)))! : Matrix3d.identity;
      const yRMatrix = yDelta ? Matrix3d.createRotationAroundVector(yAxis, Angle.createRadians(Math.PI / (viewRect.height / yDelta)))! : Matrix3d.identity;
      const worldRMatrix = yRMatrix.multiplyMatrixMatrix(xRMatrix);
      const result = worldRMatrix.getAxisAndAngleOfRotation();
      angle = Angle.createRadians(-result.angle.radians);
      worldAxis = result.axis;
    }

    this.rotateViewWorld(worldPt, worldAxis, angle);
    vp.getWorldFrustum(this._activeFrustum);
    this._lastPtNpc.setFrom(ptNpc);

    return true;
  }

  private rotateViewWorld(worldPt: Point3d, worldAxis: Vector3d, angle: Angle) {
    const worldMatrix = Matrix3d.createRotationAroundVector(worldAxis, angle);
    if (!worldMatrix)
      return;
    const worldTransform = Transform.createFixedPointAndMatrix(worldPt, worldMatrix!);
    const frustum = this._frustum.transformBy(worldTransform);
    this.viewTool.viewport!.setupViewFromFrustum(frustum);
  }

  public onWheel(ev: BeWheelEvent): void {
    // When rotate is active, the mouse wheel should zoom about the target center when it's displayed...
    const tool = this.viewTool;
    if (tool.targetCenterLocked || tool.inHandleModify) {
      ev.point = tool.targetCenterWorld;
      ev.coordsFrom = CoordSource.Precision; // WheelEventProcessor.doZoom checks this to decide whether to use raw or adjusted point...
    }
  }

  /** @internal */
  public needDepthPoint(ev: BeButtonEvent, _isPreview: boolean): boolean {
    return (!this.viewTool.targetCenterLocked && ev.viewport!.view.allow3dManipulations());
  }

  /** @internal */
  public adjustDepthPoint(isValid: boolean, vp: Viewport, plane: Plane3dByOriginAndUnitNormal, source: DepthPointSource): boolean {
    if (super.adjustDepthPoint(isValid, vp, plane, source))
      return true;
    plane.getOriginRef().setFrom(this.viewTool.targetCenterWorld);
    return false;
  }
}

/** ViewingToolHandle for performing the "look view" operation */
class ViewLook extends ViewingToolHandle {
  private _eyePoint = new Point3d();
  private _firstPtView = new Point3d();
  private _rotation = new Matrix3d();
  private _frustum = new Frustum();
  public get handleType() { return ViewHandleType.Look; }
  public getHandleCursor(): string { return IModelApp.viewManager.lookCursor; }

  public testHandleForHit(_ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    out.distance = 0.0;
    out.priority = ViewManipPriority.Low;
    return true;
  }

  public firstPoint(ev: BeButtonEvent) {
    const tool = this.viewTool;
    const vp = ev.viewport!;
    const view = vp.view;
    if (!view || !view.is3d() || !view.allow3dManipulations())
      return false;

    this._firstPtView.setFrom(ev.viewPoint);
    this._eyePoint.setFrom(view.getEyePoint());
    this._rotation.setFrom(vp.rotation);

    vp.getWorldFrustum(this._frustum);
    tool.beginDynamicUpdate();
    this.viewTool.provideToolAssistance("Look.Prompts.NextPoint");
    return true;
  }

  public doManipulation(ev: BeButtonEvent, _inDynamics: boolean): boolean {
    const tool = this.viewTool;
    const viewport = tool.viewport!;

    if (ev.viewport !== viewport)
      return false;

    const worldTransform = this.getLookTransform(viewport, this._firstPtView, ev.viewPoint);
    const frustum = this._frustum.transformBy(worldTransform);
    this.viewTool.viewport!.setupViewFromFrustum(frustum);

    return true;
  }

  private getLookTransform(vp: Viewport, firstPt: Point3d, currPt: Point3d): Transform {
    const viewRect = vp.viewRect;
    const xExtent = viewRect.width;
    const yExtent = viewRect.height;
    const xDelta = (currPt.x - firstPt.x);
    const yDelta = (currPt.y - firstPt.y);
    const xAngle = -(xDelta / xExtent) * Math.PI;
    const yAngle = -(yDelta / yExtent) * Math.PI;

    const inverseRotation = this._rotation.inverse();
    const horizontalRotation = Matrix3d.createRotationAroundVector(Vector3d.unitZ(), Angle.createRadians(xAngle));
    const verticalRotation = Matrix3d.createRotationAroundVector(Vector3d.unitX(), Angle.createRadians(yAngle));

    if (undefined === inverseRotation || undefined === horizontalRotation || undefined === verticalRotation)
      return Transform.createIdentity();

    verticalRotation.multiplyMatrixMatrix(this._rotation, verticalRotation);
    inverseRotation.multiplyMatrixMatrix(verticalRotation, verticalRotation);

    const newRotation = horizontalRotation.multiplyMatrixMatrix(verticalRotation);
    const transform = Transform.createFixedPointAndMatrix(this._eyePoint, newRotation);
    return transform;
  }
}

/** handle for tools that animate a frustum change based on the position of the cursor relative to an anchor point. */
abstract class AnimatedHandle extends ViewingToolHandle {
  protected readonly _anchorPtView = new Point3d();
  protected readonly _lastPtView = new Point3d();
  protected _lastMotionTime = 0;

  public testHandleForHit(_ptScreen: Point3d, out: { distance: number, priority: ViewManipPriority }): boolean {
    out.distance = 0.0;
    out.priority = ViewManipPriority.Low;
    return true;
  }

  protected getElapsedTime(): number {
    const prev = this._lastMotionTime;
    this._lastMotionTime = Date.now();
    return Geometry.clamp(this._lastMotionTime - prev, 0, 1000) / 1000.;
  }
  // called on mouse motion
  public doManipulation(ev: BeButtonEvent): boolean {
    this._lastPtView.setFrom(ev.viewPoint);
    return true;
  }

  // called when animation is interrupted
  public interrupt(): void { }
  public abstract animate(): boolean;

  public firstPoint(ev: BeButtonEvent): boolean {
    const vp = ev.viewport;
    const tool = this.viewTool;
    tool.inDynamicUpdate = true;
    if (vp && this.needDepthPoint(ev, false)) {
      const visiblePoint = this.viewTool.getDepthPoint(ev);
      if (undefined !== visiblePoint) {
        vp.worldToView(visiblePoint, this._anchorPtView);
      } else {
        vp.worldToNpc(ev.point, this._anchorPtView);
        this._anchorPtView.z = ViewManip.getFocusPlaneNpc(vp);
        vp.npcToView(this._anchorPtView, this._anchorPtView);
      }
    } else {
      this._anchorPtView.setFrom(ev.viewPoint);
    }
    this._lastPtView.setFrom(this._anchorPtView);
    tool.viewport!.setAnimator(this);
    return true;
  }

  protected getDirection(): Vector3d | undefined {
    const dir = this._anchorPtView.vectorTo(this._lastPtView);
    dir.z = 0;
    return dir.magnitudeSquared() < 36 ? undefined : dir; // dead zone around starting point
  }

  protected getInputVector(): Vector3d | undefined {
    const dir = this.getDirection();
    if (undefined === dir)
      return undefined;
    const viewRect = this.viewTool.viewport!.viewRect;
    return new Vector3d(dir.x * (2.0 / viewRect.width), dir.y * 2.0 / viewRect.height);
  }

  public onReinitialize(): void {
    const tool = this.viewTool;
    tool.inDynamicUpdate = false;
    const vp = tool.viewport;
    if (undefined !== vp)
      vp.setAnimator();
  }

  // called when wheel rolls, reset tool
  public onWheel() {
    const tool = this.viewTool;
    tool.nPts = 0; // start over
    tool.inDynamicUpdate = false; // not active
  }
}

/** ViewingToolHandle for performing the "scroll view" operation */
class ViewScroll extends AnimatedHandle {
  public get handleType() { return ViewHandleType.Scroll; }
  public getHandleCursor(): string { return "move"; }

  public drawHandle(context: DecorateContext, _hasFocus: boolean): void {
    if (context.viewport !== this.viewTool.viewport || !this.viewTool.inDynamicUpdate)
      return;

    const radius = Math.floor(context.viewport.pixelsFromInches(0.1)) + 0.5;
    const position = this._anchorPtView.clone();
    const position2 = this._lastPtView.clone();
    const offset = position2.minus(position);
    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,255,0,.3)";
      ctx.setLineDash([10, 4]);
      ctx.lineWidth = 3;
      ctx.moveTo(0, 0);
      ctx.lineTo(offset.x, offset.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(0,0,0,.5)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      let vec = Vector2d.createStartEnd(position, position2);
      if (undefined === vec)
        vec = Vector2d.unitX();
      else
        vec.normalize(vec);

      const slashPts = [new Point2d(), new Point2d()];
      slashPts[0].plusScaled(vec, radius, slashPts[0]);
      slashPts[1].plusScaled(vec, -radius, slashPts[1]);

      ctx.beginPath();
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.moveTo(slashPts[0].x, slashPts[0].y);
      ctx.lineTo(slashPts[1].x, slashPts[1].y);
      ctx.stroke();
    };
    context.addCanvasDecoration({ position, drawDecoration }, true);
  }

  public firstPoint(ev: BeButtonEvent) {
    super.firstPoint(ev);
    this.viewTool.provideToolAssistance("Scroll.Prompts.NextPoint");
    return true;
  }

  public animate(): boolean {
    const dist = this.getDirection();
    if (undefined === dist)
      return false;

    dist.scaleInPlace(ToolSettings.scrollSpeed * this.getElapsedTime());
    const tool = this.viewTool;
    const viewport = tool.viewport!;

    if (viewport.isCameraOn) {
      const points: Point3d[] = new Array<Point3d>(2);
      points[0] = this._anchorPtView.clone();
      points[1] = points[0].plus(dist);

      viewport.viewToNpcArray(points);
      points[1].z = points[0].z;
      viewport.npcToWorldArray(points);

      const offset = points[1].minus(points[0]);
      const offsetTransform = Transform.createTranslation(offset);
      const frustum = viewport.getWorldFrustum();
      frustum.transformBy(offsetTransform, frustum);
      viewport.setupViewFromFrustum(frustum);
    } else {
      viewport.scroll(dist, { saveInUndo: false, animateFrustumChange: false });
    }

    return false;
  }

  /** @internal */
  public needDepthPoint(ev: BeButtonEvent, _isPreview: boolean): boolean {
    return ev.viewport!.isCameraOn && CoordSource.User === ev.coordsFrom;
  }
}

/** ViewingToolHandle for performing the "zoom view" operation */
class ViewZoom extends AnimatedHandle {
  private readonly _anchorPtNpc = new Point3d();
  private _lastZoomRatio = 1.0;
  public get handleType() { return ViewHandleType.Zoom; }
  public getHandleCursor() { return IModelApp.viewManager.zoomCursor; }

  public drawHandle(context: DecorateContext, _hasFocus: boolean): void {
    if (context.viewport !== this.viewTool.viewport || !this.viewTool.inDynamicUpdate)
      return;

    const radius = Math.floor(context.viewport.pixelsFromInches(0.15)) + 0.5;
    const crossRadius = radius * 0.6;
    const position = this._anchorPtView.clone(); position.x = Math.floor(position.x) + 0.5; position.y = Math.floor(position.y) + 0.5;
    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,.5)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.moveTo(-crossRadius, 0);
      ctx.lineTo(crossRadius, 0);
      if (this._lastZoomRatio < 1.0) {
        ctx.moveTo(0, -crossRadius);
        ctx.lineTo(0, crossRadius);
      }
      ctx.stroke();
    };
    context.addCanvasDecoration({ position, drawDecoration }, true);
  }

  public firstPoint(ev: BeButtonEvent) {
    super.firstPoint(ev);
    ev.viewport!.viewToNpc(this._anchorPtView, this._anchorPtNpc);
    this.viewTool.provideToolAssistance("Zoom.Prompts.NextPoint");
    return true;
  }

  public animate(): boolean {
    if (undefined === this.getDirection()) // on anchor point?
      return false;

    const tool = this.viewTool;
    const viewport = tool.viewport!;
    const view = viewport.view;
    const thisPtNpc = viewport.viewToNpc(this._lastPtView);
    const dist = this._anchorPtNpc.minus(thisPtNpc); dist.z = 0.0;
    let zoomRatio = 1.0 + (dist.magnitude() * ToolSettings.zoomSpeed * this.getElapsedTime());
    const bumpDistance = ToolSettings.wheelZoomBumpDistance * zoomRatio;
    if (dist.y < 0)
      zoomRatio = 1.0 / zoomRatio;
    this._lastZoomRatio = zoomRatio;

    if (view.is3d() && view.isCameraOn) {
      const anchorPtWorld = viewport.npcToWorld(this._anchorPtNpc);
      const transform = Transform.createFixedPointAndMatrix(anchorPtWorld, Matrix3d.createScale(zoomRatio, zoomRatio, zoomRatio));
      const oldEyePoint = view.getEyePoint();
      const newEyePoint = transform.multiplyPoint3d(oldEyePoint);
      const cameraOffset = Vector3d.createStartEnd(oldEyePoint, newEyePoint);

      // As you near the depth point, the zoom operation continues to slow. Apply "bump distance" to move through the initial depth point.
      if (cameraOffset.magnitude() < bumpDistance)
        cameraOffset.scaleToLength(bumpDistance, cameraOffset);

      const cameraOffsetTransform = Transform.createTranslation(cameraOffset);
      const frustum = viewport.getWorldFrustum();
      frustum.transformBy(cameraOffsetTransform, frustum);
      viewport.setupViewFromFrustum(frustum);
    } else {
      const transform = Transform.createFixedPointAndMatrix(this._anchorPtNpc, Matrix3d.createScale(zoomRatio, zoomRatio, 1.0));
      const frustum = viewport.getFrustum(CoordSystem.Npc, true);
      frustum.transformBy(transform, frustum);
      viewport.npcToWorldArray(frustum.points);
      viewport.setupViewFromFrustum(frustum);
    }
    return false;
  }

  /** @internal */
  public needDepthPoint(ev: BeButtonEvent, _isPreview: boolean): boolean {
    return ev.viewport!.isCameraOn && CoordSource.User === ev.coordsFrom;
  }
}

/** @internal */
class NavigateMotion {
  private _seconds = 0;
  public readonly transform = Transform.createIdentity();
  constructor(public viewport: Viewport) { }

  public init(seconds: number) {
    this._seconds = seconds;
    this.transform.setIdentity();
  }

  public getViewUp(result?: Vector3d) { return this.viewport.rotation.getRow(1, result); }

  public getViewDirection(result?: Vector3d): Vector3d {
    const forward = this.viewport.rotation.getRow(2, result);
    forward.scale(-1, forward); // positive z is out of the screen, but we want direction into the screen
    return forward;
  }

  public takeElevator(height: number): void {
    const up = Point3d.create(0, 0, height * this._seconds);
    Transform.createTranslation(up, this.transform);
  }

  public modifyPitchAngleToPreventInversion(pitchAngle: number): number {
    const angleLimit = Angle.degreesToRadians(85);
    const angleTolerance = Angle.degreesToRadians(0.01);

    if (0.0 === pitchAngle)
      return 0.0;

    const viewUp = this.getViewUp();
    const viewDir = this.getViewDirection();
    const worldUp = Vector3d.unitZ();

    let viewAngle = worldUp.angleTo(viewUp).radians;
    if (viewDir.z < 0)
      viewAngle *= -1;

    let newAngle = pitchAngle + viewAngle;
    if (Math.abs(newAngle) < angleLimit)
      return pitchAngle; // not close to the limit
    if ((pitchAngle > 0) !== (viewAngle > 0) && (Math.abs(pitchAngle) < Math.PI / 2))
      return pitchAngle; // tilting away from the limit
    if (Math.abs(viewAngle) >= (angleLimit - angleTolerance))
      return 0.0; // at the limit already

    const difference = Math.abs(newAngle) - angleLimit;
    newAngle = (pitchAngle > 0) ? pitchAngle - difference : pitchAngle + difference;
    return newAngle; // almost at the limit, but still can go a little bit closer
  }

  public generateRotationTransform(yawRate: number, pitchRate: number, result?: Transform): Transform {
    const vp = this.viewport;
    const view = vp.view as ViewState3d;
    const viewRot = vp.rotation;
    const invViewRot = viewRot.inverse()!;
    const pitchAngle = Angle.createRadians(this.modifyPitchAngleToPreventInversion(pitchRate * this._seconds));
    const pitchMatrix = Matrix3d.createRotationAroundVector(Vector3d.unitX(), pitchAngle)!;
    const pitchTimesView = pitchMatrix.multiplyMatrixMatrix(viewRot);
    const inverseViewTimesPitchTimesView = invViewRot.multiplyMatrixMatrix(pitchTimesView);
    const yawMatrix = Matrix3d.createRotationAroundVector(Vector3d.unitZ(), Angle.createRadians(yawRate * this._seconds))!;
    const yawTimesInverseViewTimesPitchTimesView = yawMatrix.multiplyMatrixMatrix(inverseViewTimesPitchTimesView);
    return Transform.createFixedPointAndMatrix(view.getEyePoint(), yawTimesInverseViewTimesPitchTimesView, result);
  }

  public generateTranslationTransform(velocity: Vector3d, isConstrainedToXY: boolean, result?: Transform) {
    const points: Point3d[] = new Array<Point3d>(3);
    points[0] = new Point3d(0, 0, 0);
    points[1] = new Point3d(1, 0, 0);
    points[2] = new Point3d(0, 1, 0);
    if (this.viewport.isCameraOn) {
      this.viewport.viewToNpcArray(points);
      points[0].z = points[1].z = points[2].z = ViewManip.getFocusPlaneNpc(this.viewport); // use the focal plane for z coordinates
      this.viewport.npcToViewArray(points);
    }
    this.viewport.viewToWorldArray(points);
    const xDir = Vector3d.createStartEnd(points[0], points[1]);
    xDir.normalizeInPlace();
    const yDir = Vector3d.createStartEnd(points[0], points[2]);
    yDir.normalizeInPlace();

    const zDir = this.getViewDirection();

    if (isConstrainedToXY) {
      const up = Vector3d.unitZ();
      const cross = up.crossProduct(zDir);
      cross.crossProduct(up, zDir);
      zDir.normalizeInPlace();
    }

    xDir.scale(velocity.x * this._seconds, xDir);
    yDir.scale(velocity.y * this._seconds, yDir);
    zDir.scale(velocity.z * this._seconds, zDir);

    xDir.plus(yDir, xDir).plus(zDir, xDir);
    return Transform.createTranslation(xDir, result);
  }

  protected moveAndLook(linearVelocity: Vector3d, angularVelocityX: number, angularVelocityY: number, isConstrainedToXY: boolean): void {
    const rotateTrans = this.generateRotationTransform(angularVelocityX, angularVelocityY);
    const dollyTrans = this.generateTranslationTransform(linearVelocity, isConstrainedToXY);
    this.transform.setMultiplyTransformTransform(rotateTrans, dollyTrans);
  }

  public pan(horizontalVelocity: number, verticalVelocity: number): void {
    const travel = new Vector3d(horizontalVelocity, verticalVelocity, 0);
    this.moveAndLook(travel, 0, 0, false);
  }

  public travel(yawRate: number, pitchRate: number, forwardVelocity: number, isConstrainedToXY: boolean): void {
    const travel = new Vector3d(0, 0, forwardVelocity);
    this.moveAndLook(travel, yawRate, pitchRate, isConstrainedToXY);
  }

  public look(yawRate: number, pitchRate: number): void { this.generateRotationTransform(yawRate, pitchRate, this.transform); }

  /** reset pitch of view to zero */
  public resetToLevel(): void {
    const view = this.viewport.view;
    if (!view.is3d() || !view.isCameraOn)
      return;
    const angles = YawPitchRollAngles.createFromMatrix3d(this.viewport.rotation)!;
    angles.pitch.setRadians(0); // reset pitch to zero
    Transform.createFixedPointAndMatrix(view.getEyePoint(), angles.toMatrix3d(), this.transform);
  }
}

/** ViewingToolHandle for performing the Walk and Fly operations */
abstract class ViewNavigate extends AnimatedHandle {
  private _initialized = false;
  protected abstract getNavigateMotion(seconds: number): NavigateMotion | undefined;

  public getHandleCursor() { return IModelApp.viewManager.walkCursor; }
  public getMaxLinearVelocity() { return ToolSettings.walkVelocity; }
  public getMaxAngularVelocity() { return Math.PI / 4; }

  public getNavigateMode(): NavigateMode {
    const state = IModelApp.toolAdmin.currentInputState;
    return (state.isShiftDown || !this.viewTool.viewport!.isCameraOn) ? NavigateMode.Pan :
      state.isControlDown ? NavigateMode.Look : NavigateMode.Travel;
  }

  // called in animation loop
  public animate(): boolean {
    const motion = this.getNavigateMotion(this.getElapsedTime());

    if (undefined !== motion) {
      const vp = this.viewTool.viewport!;
      const frust = vp.getWorldFrustum();
      frust.multiply(motion.transform);
      vp.setupViewFromFrustum(frust);
    }
    return false;
  }

  public onReinitialize(): void {
    super.onReinitialize();
    if (this._initialized)
      return;
    this._initialized = true;

    const tool = this.viewTool;
    const vp = tool.viewport!;
    const view = vp.view;
    if (!view.allow3dManipulations())
      return;

    const startFrust = vp.getWorldFrustum();
    const walkAngle = ToolSettings.walkCameraAngle;
    if (!tool.lensAngleMatches(walkAngle, Angle.degreesToRadians(15.)) || !tool.isZUp) {
      //  This turns on the camera if its not already on. It also assures the camera is centered. Obviously this is required if
      //  the camera is not on or the lens angle is not what we want. We also want to do it if Z will be
      //  adjusted because EnforceZUp swivels the camera around what GetTargetPoint returns. If the FocusDistance is not set to something
      //  reasonable the target point may be far beyond anything relevant.
      tool.setCameraLensAngle(walkAngle, tool.lensAngleMatches(walkAngle, Angle.degreesToRadians(45.)));
    }

    if (ToolSettings.walkEnforceZUp)
      tool.enforceZUp(view.getTargetPoint());

    const endFrust = vp.getWorldFrustum();
    if (!startFrust.equals(endFrust)) {
      vp.animateToCurrent(startFrust);
    }
  }

  public drawHandle(context: DecorateContext, _hasFocus: boolean): void {
    if (context.viewport !== this.viewTool.viewport || !this.viewTool.inDynamicUpdate)
      return;
    const position = this._anchorPtView.clone();
    position.x = Math.floor(position.x) + 0.5;
    position.y = Math.floor(position.y) + 0.5;
    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.strokeStyle = "black";
      ctx.fillStyle = "rgba(255,255,255,.3)";
      ctx.lineWidth = 1;
      ctx.arc(0, 0, 5, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fill();
    };
    context.addCanvasDecoration({ position, drawDecoration });
  }
}

/** ViewingToolHandle for performing the "walk view" operation */
class ViewWalk extends ViewNavigate {
  private _navigateMotion: NavigateMotion;

  constructor(viewManip: ViewManip) {
    super(viewManip);
    this._navigateMotion = new NavigateMotion(this.viewTool.viewport!);
  }
  public get handleType(): ViewHandleType { return ViewHandleType.Walk; }
  public firstPoint(ev: BeButtonEvent): boolean { this.viewTool.provideToolAssistance("Walk.Prompts.NextPoint"); return super.firstPoint(ev); }

  protected getNavigateMotion(elapsedTime: number): NavigateMotion | undefined {
    const input = this.getInputVector();
    if (undefined === input)
      return undefined;

    const motion = this._navigateMotion;
    motion.init(elapsedTime);

    switch (this.getNavigateMode()) {
      case NavigateMode.Pan:
        input.scale(this.getMaxLinearVelocity(), input);
        motion.pan(input.x, input.y);
        break;
      case NavigateMode.Look:
        input.scale(-this.getMaxAngularVelocity(), input);
        motion.look(input.x, input.y);
        break;
      case NavigateMode.Travel:
        motion.travel(-input.x * this.getMaxAngularVelocity(), 0, -input.y * this.getMaxLinearVelocity(), true);
        break;
    }

    return motion;
  }
}

/** ViewingToolHandle for performing the "fly view" operation */
class ViewFly extends ViewNavigate {
  private _navigateMotion: NavigateMotion;

  constructor(viewManip: ViewManip) {
    super(viewManip);
    this._navigateMotion = new NavigateMotion(this.viewTool.viewport!);
  }
  public get handleType(): ViewHandleType { return ViewHandleType.Fly; }
  public firstPoint(ev: BeButtonEvent): boolean { this.viewTool.provideToolAssistance("Fly.Prompts.NextPoint"); return super.firstPoint(ev); }

  protected getNavigateMotion(elapsedTime: number): NavigateMotion | undefined {
    const input = this.getInputVector();
    if (undefined === input)
      return undefined;

    const motion = this._navigateMotion;
    motion.init(elapsedTime);

    switch (this.getNavigateMode()) {
      case NavigateMode.Pan:
        input.scale(this.getMaxLinearVelocity(), input);
        motion.pan(input.x, input.y);
        break;
      case NavigateMode.Look:
        input.scale(-this.getMaxAngularVelocity(), input);
        motion.look(input.x, input.y);
        break;
      case NavigateMode.Travel:
        input.scale(-this.getMaxAngularVelocity() * 2.0, input);
        motion.travel(input.x, input.y, this.getMaxLinearVelocity(), false);
        break;
    }

    return motion;
  }
}

/** The tool that performs a Pan view operation
 * @public
 */
export class PanViewTool extends ViewManip {
  public static toolId = "View.Pan";
  public static iconSpec = "icon-hand-2";
  constructor(vp: ScreenViewport | undefined, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Pan, oneShot, isDraggingRequired);
  }
  public onReinitialize(): void {
    super.onReinitialize();
    this.provideToolAssistance("Pan.Prompts.FirstPoint");
  }
}

/** A tool that performs a Rotate view operation
 * @public
 */
export class RotateViewTool extends ViewManip {
  public static toolId = "View.Rotate";
  public static iconSpec = "icon-gyroscope";
  constructor(vp: ScreenViewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Rotate | ViewHandleType.Pan | ViewHandleType.TargetCenter, oneShot, isDraggingRequired);
  }
  public onReinitialize(): void { super.onReinitialize(); this.provideToolAssistance("Rotate.Prompts.FirstPoint"); }
}

/** A tool that performs the look operation
 * @public
 */
export class LookViewTool extends ViewManip {
  public static toolId = "View.Look";
  public static iconSpec = "icon-view-navigation";
  constructor(vp: ScreenViewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Look, oneShot, isDraggingRequired);
  }
  public onReinitialize(): void { super.onReinitialize(); this.provideToolAssistance("Look.Prompts.FirstPoint"); }
}

/** A tool that performs the scroll operation
 * @public
 */
export class ScrollViewTool extends ViewManip {
  public static toolId = "View.Scroll";
  public static iconSpec = "icon-move";
  constructor(vp: ScreenViewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Scroll, oneShot, isDraggingRequired);
  }
  public onReinitialize(): void { super.onReinitialize(); this.provideToolAssistance("Scroll.Prompts.FirstPoint"); }
}

/** A tool that performs the zoom operation
 * @public
 */
export class ZoomViewTool extends ViewManip {
  public static toolId = "View.Zoom";
  public static iconSpec = "icon-zoom";
  constructor(vp: ScreenViewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Zoom, oneShot, isDraggingRequired);
  }
  public onReinitialize(): void { super.onReinitialize(); this.provideToolAssistance("Zoom.Prompts.FirstPoint"); }
}

/** A tool that performs the walk operation
 * @public
 */
export class WalkViewTool extends ViewManip {
  public static toolId = "View.Walk";
  public static iconSpec = "icon-walk";
  constructor(vp: ScreenViewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Walk, oneShot, isDraggingRequired);
  }
  public onReinitialize(): void { super.onReinitialize(); this.provideToolAssistance("Walk.Prompts.FirstPoint"); }

  /** @beta */
  public provideToolAssistance(mainInstrKey: string): void {
    const walkInstructions: ToolAssistanceInstruction[] = [];
    walkInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.shiftKey, ToolAssistanceImage.LeftClickDrag, ViewTool.translate("Pan.flyover"), false, ToolAssistanceInputMethod.Mouse));
    walkInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.ctrlKey, ToolAssistanceImage.LeftClickDrag, ViewTool.translate("Look.flyover"), false, ToolAssistanceInputMethod.Mouse));
    super.provideToolAssistance(mainInstrKey, walkInstructions);
  }
}

/** A tool that performs the fly operation
 * @public
 */
export class FlyViewTool extends ViewManip {
  public static toolId = "View.Fly";
  public static iconSpec = "icon-airplane";
  constructor(vp: ScreenViewport, oneShot = false, isDraggingRequired = false) {
    super(vp, ViewHandleType.Fly, oneShot, isDraggingRequired);
  }
  public onReinitialize(): void { super.onReinitialize(); this.provideToolAssistance("Fly.Prompts.FirstPoint"); }

  /** @beta */
  public provideToolAssistance(mainInstrKey: string): void {
    const flyInstructions: ToolAssistanceInstruction[] = [];
    flyInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.shiftKey, ToolAssistanceImage.LeftClickDrag, ViewTool.translate("Pan.flyover"), false, ToolAssistanceInputMethod.Mouse));
    flyInstructions.push(ToolAssistance.createModifierKeyInstruction(ToolAssistance.ctrlKey, ToolAssistanceImage.LeftClickDrag, ViewTool.translate("Look.flyover"), false, ToolAssistanceInputMethod.Mouse));
    super.provideToolAssistance(mainInstrKey, flyInstructions);
  }
}

/** A tool that performs a fit view
 * @public
 */
export class FitViewTool extends ViewTool {
  public static toolId = "View.Fit";
  public static iconSpec = "icon-fit-to-view";
  public oneShot: boolean;
  public doAnimate: boolean;
  public isolatedOnly: boolean;
  constructor(viewport: ScreenViewport, oneShot: boolean, doAnimate = true, isolatedOnly = true) {
    super(viewport);
    this.viewport = viewport;
    this.oneShot = oneShot;
    this.doAnimate = doAnimate;
    this.isolatedOnly = isolatedOnly;
  }

  /** @beta */
  public provideToolAssistance(): void {
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, ViewTool.translate("Fit.Prompts.FirstPoint"));
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    const acceptMsg = CoreTools.translate("ElementSet.Inputs.Accept");
    const rejectMsg = CoreTools.translate("ElementSet.Inputs.Exit");
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, acceptMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, acceptMsg, false, ToolAssistanceInputMethod.Mouse));
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, rejectMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, rejectMsg, false, ToolAssistanceInputMethod.Mouse));

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (ev.viewport)
      return await this.doFit(ev.viewport, this.oneShot, this.doAnimate, this.isolatedOnly) ? EventHandled.Yes : EventHandled.No;

    return EventHandled.No;
  }

  public onPostInstall() {
    super.onPostInstall();
    if (undefined === this.viewport || !this.oneShot)
      this.provideToolAssistance();

    if (this.viewport)
      this.doFit(this.viewport, this.oneShot, this.doAnimate, this.isolatedOnly); // tslint:disable-line:no-floating-promises
  }

  public async doFit(viewport: ScreenViewport, oneShot: boolean, doAnimate = true, isolatedOnly = true): Promise<boolean> {
    if (!isolatedOnly || !await ViewManip.zoomToAlwaysDrawnExclusive(viewport, doAnimate))
      ViewManip.fitView(viewport, doAnimate);
    if (oneShot)
      this.exitTool();
    return oneShot;
  }
}

/** A tool that rotates the view to one of the standard views.
 * @public
 */
export class StandardViewTool extends ViewTool {
  public static toolId = "View.Standard";
  public static iconSpec = "icon-cube-faces-top";
  constructor(viewport: ScreenViewport, private _standardViewId: StandardViewId) { super(viewport); }

  public onPostInstall() {
    super.onPostInstall();
    if (this.viewport) {
      const vp = this.viewport;
      const id = vp.view.allow3dManipulations() ? this._standardViewId : StandardViewId.Top;
      const rMatrix = AccuDraw.getStandardRotation(id, vp, vp.isContextRotationRequired);
      const inverse = rMatrix.inverse();
      if (undefined !== inverse) {
        const targetMatrix = inverse.multiplyMatrixMatrix(vp.rotation);
        const rotateTransform = Transform.createFixedPointAndMatrix(ViewManip.getDefaultTargetPointWorld(vp), targetMatrix);
        const startFrustum = vp.getFrustum();
        const newFrustum = startFrustum.clone();
        newFrustum.multiply(rotateTransform);
        vp.view.setupFromFrustum(newFrustum);
        vp.synchWithView(true);
        vp.animateToCurrent(startFrustum);
      }
    }
    this.exitTool();
  }
}

/** A tool that performs a Window-area view operation
 * @public
 */
export class WindowAreaTool extends ViewTool {
  public static toolId = "View.WindowArea";
  public static iconSpec = "icon-window-area";
  private _haveFirstPoint: boolean = false;
  private _firstPtWorld: Point3d = Point3d.create();
  private _secondPtWorld: Point3d = Point3d.create();
  private _lastPtView?: Point3d;
  private _corners = [new Point3d(), new Point3d()];
  private _shapePts = [new Point3d(), new Point3d(), new Point3d(), new Point3d(), new Point3d()];
  private _fillColor = ColorDef.from(0, 0, 255, 200);

  public onPostInstall() { super.onPostInstall(); this.provideToolAssistance(); }
  public onReinitialize() { this._haveFirstPoint = false; this._firstPtWorld.setZero(); this._secondPtWorld.setZero(); this.provideToolAssistance(); }
  public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> { if (this._haveFirstPoint) { this.onReinitialize(); return EventHandled.Yes; } return super.onResetButtonUp(ev); }

  /** @beta */
  public provideToolAssistance(): void {
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, ViewTool.translate(this._haveFirstPoint ? "WindowArea.Prompts.NextPoint" : "WindowArea.Prompts.FirstPoint"));
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    const acceptMsg = CoreTools.translate("ElementSet.Inputs.AcceptPoint");
    const restartMsg = CoreTools.translate("ElementSet.Inputs.Restart");
    const exitMsg = CoreTools.translate("ElementSet.Inputs.Exit");
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchDrag, acceptMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, acceptMsg, false, ToolAssistanceInputMethod.Mouse));
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, exitMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, this._haveFirstPoint ? restartMsg : exitMsg, false, ToolAssistanceInputMethod.Mouse));

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.Yes;

    if (undefined === this.viewport) {
      this.viewport = ev.viewport;
    } else if (!areViewportsCompatible(ev.viewport, this.viewport)) {
      if (this._haveFirstPoint)
        return EventHandled.Yes;
      this.viewport = ev.viewport;
      this._lastPtView = ev.viewPoint;
      IModelApp.viewManager.invalidateDecorationsAllViews();
      return EventHandled.Yes;
    }

    if (this._haveFirstPoint) {
      this._secondPtWorld.setFrom(ev.point);
      this.doManipulation(ev, false);
      this.onReinitialize();
      this.viewport!.invalidateDecorations();
    } else {
      this._firstPtWorld.setFrom(ev.point);
      this._secondPtWorld.setFrom(this._firstPtWorld);
      this._haveFirstPoint = true;
      this._lastPtView = ev.viewPoint;
      this.provideToolAssistance();
    }

    return EventHandled.Yes;
  }

  public async onMouseMotion(ev: BeButtonEvent) { this.doManipulation(ev, true); }
  public async onTouchTap(ev: BeTouchEvent): Promise<EventHandled> { return ev.isSingleTap ? EventHandled.Yes : EventHandled.No; } // Prevent IdleTool from converting single tap into data button down/up...
  public async onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled> { if (!this._haveFirstPoint && startEv.isSingleTouch) await IModelApp.toolAdmin.convertTouchMoveStartToButtonDownAndMotion(startEv, ev); return this._haveFirstPoint ? EventHandled.Yes : EventHandled.No; }
  public async onTouchMove(ev: BeTouchEvent): Promise<void> { if (this._haveFirstPoint) return IModelApp.toolAdmin.convertTouchMoveToMotion(ev); }
  public async onTouchComplete(ev: BeTouchEvent): Promise<void> { if (this._haveFirstPoint) return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev); }
  public async onTouchCancel(ev: BeTouchEvent): Promise<void> { if (this._haveFirstPoint) return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev, BeButton.Reset); }

  private computeWindowCorners(): Point3d[] | undefined {
    const vp = this.viewport!;
    const corners = this._corners;

    corners[0].setFrom(this._firstPtWorld);
    corners[1].setFrom(this._secondPtWorld);
    vp.worldToViewArray(corners);

    const delta = corners[1].minus(corners[0]);
    if (delta.magnitudeXY() < vp.pixelsFromInches(ToolSettings.startDragDistanceInches))
      return undefined;

    const currentDelta = vp.viewDelta;
    if (currentDelta.x === 0 || delta.x === 0)
      return undefined;

    const viewAspect = currentDelta.y / currentDelta.x;
    const aspectRatio = Math.abs(delta.y / delta.x);

    let halfDeltaX;
    let halfDeltaY;
    if (aspectRatio < viewAspect) {
      halfDeltaX = Math.abs(delta.x) / 2.0;
      halfDeltaY = halfDeltaX * viewAspect;
    } else {
      halfDeltaY = Math.abs(delta.y) / 2.0;
      halfDeltaX = halfDeltaY / viewAspect;
    }

    const center = corners[0].plusScaled(delta, 0.5);
    corners[0].x = center.x - halfDeltaX;
    corners[0].y = center.y - halfDeltaY;
    corners[1].x = center.x + halfDeltaX;
    corners[1].y = center.y + halfDeltaY;
    return corners;
  }

  public decorate(context: DecorateContext): void {
    if (undefined === this.viewport || !areViewportsCompatible(context.viewport, this.viewport))
      return;
    const vp = this.viewport;
    const color = vp.getContrastToBackgroundColor();
    if (this._haveFirstPoint) {
      const corners = this.computeWindowCorners();
      if (undefined === corners)
        return;

      this._shapePts[0].x = this._shapePts[3].x = corners[0].x;
      this._shapePts[1].x = this._shapePts[2].x = corners[1].x;
      this._shapePts[0].y = this._shapePts[1].y = corners[0].y;
      this._shapePts[2].y = this._shapePts[3].y = corners[1].y;
      this._shapePts[0].z = this._shapePts[1].z = this._shapePts[2].z = this._shapePts[3].z = corners[0].z;
      this._shapePts[4].setFrom(this._shapePts[0]);
      vp.viewToWorldArray(this._shapePts);

      const builder = context.createGraphicBuilder(GraphicType.WorldOverlay);

      builder.setBlankingFill(this._fillColor);
      builder.addShape(this._shapePts);

      builder.setSymbology(color, color, ViewHandleWeight.Thin);
      builder.addLineString(this._shapePts);

      builder.setSymbology(color, color, ViewHandleWeight.FatDot);
      builder.addPointString([this._firstPtWorld]);

      context.addDecorationFromBuilder(builder);
      return;
    }

    if (undefined === this._lastPtView || context.viewport !== IModelApp.toolAdmin.cursorView)
      return; // Full screen cross-hair only displays in cursor view...

    const cursorPt = this._lastPtView.clone(); cursorPt.x = Math.floor(cursorPt.x) + 0.5; cursorPt.y = Math.floor(cursorPt.y) + 0.5;
    const viewRect = vp.viewRect;

    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.strokeStyle = (ColorDef.black === color ? "black" : "white");
      ctx.lineWidth = 1;
      ctx.moveTo(viewRect.left, cursorPt.y);
      ctx.lineTo(viewRect.right, cursorPt.y);
      ctx.moveTo(cursorPt.x, viewRect.top);
      ctx.lineTo(cursorPt.x, viewRect.bottom);
      ctx.stroke();
    };
    context.addCanvasDecoration({ drawDecoration });
  }

  private doManipulation(ev: BeButtonEvent, inDynamics: boolean): void {
    this._secondPtWorld.setFrom(ev.point);
    if (inDynamics) {
      if (undefined !== this.viewport && undefined !== ev.viewport && !areViewportsCompatible(ev.viewport, this.viewport)) {
        this._lastPtView = undefined;
        return;
      }
      this._lastPtView = ev.viewPoint;
      IModelApp.viewManager.invalidateDecorationsAllViews();
      return;
    }

    const corners = this.computeWindowCorners();
    if (undefined === corners)
      return;

    let delta: Vector3d;
    const vp = this.viewport!;
    const view = vp.view;
    const startFrust = vp.getWorldFrustum();
    vp.viewToWorldArray(corners);

    if (view.is3d() && view.isCameraOn) {
      const windowArray: Point3d[] = [corners[0].clone(), corners[1].clone()];
      vp.worldToViewArray(windowArray);

      const windowRange = new ViewRect(windowArray[0].x, windowArray[0].y, windowArray[1].x, windowArray[1].y);

      let npcZValues = vp.determineVisibleDepthRange(windowRange);
      if (undefined === npcZValues)
        npcZValues = { minimum: 0, maximum: ViewManip.getFocusPlaneNpc(vp) };

      const lensAngle = view.getLensAngle();

      vp.worldToNpcArray(corners);
      corners[0].z = corners[1].z = npcZValues.maximum;

      vp.npcToWorldArray(corners);  // Put corners back in world at correct depth
      const viewPts: Point3d[] = [corners[0].clone(), corners[1].clone()];
      vp.rotation.multiplyVectorArrayInPlace(viewPts);  // rotate to view orientation to get extents

      const range = Range3d.createArray(viewPts);
      delta = Vector3d.createStartEnd(range.low, range.high);

      const focusDist = Math.max(delta.x, delta.y) / (2.0 * Math.tan(lensAngle.radians / 2));

      const newTarget = corners[0].interpolate(.5, corners[1]);
      const newEye = newTarget.plusScaled(view.getZVector(), focusDist);

      if (ViewStatus.Success !== view.lookAtUsingLensAngle(newEye, newTarget, view.getYVector(), lensAngle))
        return;
    } else {
      vp.rotation.multiplyVectorArrayInPlace(corners);

      const range = Range3d.createArray(corners);
      delta = Vector3d.createStartEnd(range.low, range.high);
      // get the view extents
      delta.z = view.getExtents().z;

      // make sure its not too big or too small
      if (ViewStatus.Success !== view.validateViewDelta(delta, true))
        return;

      view.setExtents(delta);

      const originVec = vp.rotation.multiplyTransposeXYZ(range.low.x, range.low.y, range.low.z);
      view.setOrigin(Point3d.createFrom(originVec));
    }

    vp.synchWithView(true);
    vp.animateToCurrent(startFrust);
  }
}

/** @internal */
export class DefaultViewTouchTool extends ViewManip implements Animator {
  public static toolId = ""; // touch tools installed by IdleTool are never registered
  private readonly _lastPtView = new Point3d();
  private readonly _startPtWorld = new Point3d();
  private readonly _startPtView = new Point3d();
  private readonly _frustum = new Frustum();
  private _startDirection!: Vector2d;
  private _startDistance = 0.0;
  private _startTouchCount = 0;
  private _inertiaVec?: Vector3d;
  private _singleTouch = false;
  private _duration!: BeDuration;
  private _end!: BeTimePoint;
  private _hasZoom = false;

  /** Move this handle during the inertia duration */
  public animate(): boolean {
    if (undefined === this._inertiaVec)
      return true; // handle was removed

    // get the fraction of the inertia duration that remains. The decay is a combination of the number of iterations (see damping below)
    // and time. That way the handle slows down even if the framerate is lower.
    const remaining = ((this._end.milliseconds - BeTimePoint.now().milliseconds) / this._duration.milliseconds);
    const pt = this._lastPtView.plusScaled(this._inertiaVec, remaining);
    const vec = this._lastPtView.minus(pt);

    // if we're not moving any more, or if the duration has elapsed, we're done
    if (remaining <= 0 || (vec.magnitudeSquared() < .000001)) {
      this.viewport!.saveViewUndo();
      return true; // remove this as the animator
    }

    this._lastPtView.setFrom(pt);
    this.perform();
    this._inertiaVec.scaleInPlace(ToolSettings.viewingInertia.damping); // dampen the inertia vector
    return false;
  }

  public interrupt() { }

  constructor(startEv: BeTouchEvent, _ev: BeTouchEvent) {
    super(startEv.viewport!, 0, true, false);
    this.onStart(startEv);
  }

  public onStart(ev: BeTouchEvent): void {
    const vp = this.viewport!;
    vp.getWorldFrustum(this._frustum);

    const visiblePoint = vp.pickNearestVisibleGeometry(ev.rawPoint, vp.pixelsFromInches(ToolSettings.viewToolPickRadiusInches));
    if (undefined !== visiblePoint) {
      this._startPtWorld.setFrom(visiblePoint);
      vp.worldToView(this._startPtWorld, this._startPtView);
    } else {
      this._startPtView.setFrom(ev.viewPoint);
      this._startPtView.z = vp.worldToView(ViewManip.getDefaultTargetPointWorld(vp)).z;
      vp.viewToWorld(this._startPtView, this._startPtWorld);
    }
    this._lastPtView.setFrom(this._startPtView);
    this._startTouchCount = ev.touchCount;
    this._startDirection = (2 <= ev.touchCount ? Vector2d.createStartEnd(BeTouchEvent.getTouchPosition(ev.touchEvent.targetTouches[0], vp), BeTouchEvent.getTouchPosition(ev.touchEvent.targetTouches[1], vp)) : Vector2d.createZero());
    this._startDistance = (2 === ev.touchCount ? this._startDirection.magnitude() : 0.0);
  }

  private computeZoomRatio(ev?: BeTouchEvent): number {
    this._hasZoom = false;
    if (undefined === ev || 0.0 === this._startDistance)
      return 1.0;

    const vp = this.viewport!;
    const distance = (2 === ev.touchCount ? BeTouchEvent.getTouchPosition(ev.touchEvent.targetTouches[0], vp).distance(BeTouchEvent.getTouchPosition(ev.touchEvent.targetTouches[1], vp)) : 0.0);

    if (0.0 === distance || Math.abs(this._startDistance - distance) < this.viewport!.pixelsFromInches(ToolSettings.touchZoomChangeThresholdInches))
      return 1.0;

    this._hasZoom = true;
    return Geometry.clamp(this._startDistance / distance, .1, 10);
  }

  private computeRotation(ev?: BeTouchEvent): Angle {
    if (undefined === ev || ev.touchCount < 2)
      return Angle.createDegrees(0.0);

    const vp = this.viewport!;
    const direction = Vector2d.createStartEnd(BeTouchEvent.getTouchPosition(ev.touchEvent.targetTouches[0], vp), BeTouchEvent.getTouchPosition(ev.touchEvent.targetTouches[1], vp));
    const rotation = this._startDirection.angleTo(direction);

    if (Math.abs(rotation.radians) < Angle.createDegrees(5.0).radians)
      return Angle.createDegrees(0.0);

    const angularDistance = Math.abs(direction.magnitude() / 2.0 * Math.sin(Math.abs(rotation.radians)));
    const zoomDistance = Math.abs(direction.magnitude() - this._startDirection.magnitude());
    const panDistance = this._startPtView.distanceXY(this._lastPtView);

    // NOTE: The * 0.75 below is because it's easy to confuse an attempted rotate for an attempted pan, and this tries to balance that without having a false positive in the opposite direction.
    if (Math.abs(rotation.radians) > Angle.createDegrees(18.0).radians || (angularDistance > zoomDistance && angularDistance > panDistance * 0.75))
      return rotation;

    return Angle.createDegrees(0.0);
  }

  private handle2dPan() {
    const screenDist = Point2d.create(this._startPtView.x - this._lastPtView.x, this._startPtView.y - this._lastPtView.y);
    this.viewport!.scroll(screenDist, { saveInUndo: false, animateFrustumChange: false });
  }

  private handle2dRotateZoom(ev?: BeTouchEvent): void {
    const vp = this.viewport!;
    const rotation = this.computeRotation(ev);
    const zoomRatio = this.computeZoomRatio(ev);
    const targetWorld = vp.viewToWorld(this._lastPtView);
    const translateTransform = Transform.createTranslation(this._startPtWorld.minus(targetWorld));
    const rotationTransform = Transform.createFixedPointAndMatrix(targetWorld, Matrix3d.createRotationAroundVector(vp.view.getZVector(), rotation)!);
    const scaleTransform = Transform.createScaleAboutPoint(this._startPtWorld, zoomRatio);
    const transform = translateTransform.multiplyTransformTransform(rotationTransform);

    scaleTransform.multiplyTransformTransform(transform, transform);
    const frustum = this._frustum.transformBy(transform);
    vp.setupViewFromFrustum(frustum);
  }

  private handle3dRotate(): void {
    const vp = this.viewport!;
    const viewRect = vp.viewRect;
    const xExtent = viewRect.width;
    const yExtent = viewRect.height;
    const xDelta = this._lastPtView.x - this._startPtView.x;
    const yDelta = this._lastPtView.y - this._startPtView.y;

    const xAxis = ToolSettings.preserveWorldUp ? Vector3d.unitZ() : vp.rotation.getRow(1);
    const yAxis = vp.rotation.getRow(0);
    const xRMatrix = (0.0 !== xDelta) ? Matrix3d.createRotationAroundVector(xAxis, Angle.createRadians(Math.PI / (xExtent / xDelta)))! : Matrix3d.identity;
    const yRMatrix = (0.0 !== yDelta) ? Matrix3d.createRotationAroundVector(yAxis, Angle.createRadians(Math.PI / (yExtent / yDelta)))! : Matrix3d.identity;
    const worldRMatrix = yRMatrix.multiplyMatrixMatrix(xRMatrix);

    const result = worldRMatrix.getAxisAndAngleOfRotation();
    const radians = Angle.createRadians(-result.angle.radians);
    const worldAxis = result.axis;

    const rotationMatrix = Matrix3d.createRotationAroundVector(worldAxis, radians);
    if (undefined === rotationMatrix)
      return;

    const worldTransform = Transform.createFixedPointAndMatrix(this._startPtWorld, rotationMatrix);
    const frustum = this._frustum.transformBy(worldTransform);
    vp.setupViewFromFrustum(frustum);
  }

  private handle3dPanZoom(ev?: BeTouchEvent): void {
    const vp = this.viewport!;
    const zoomRatio = this.computeZoomRatio(ev);

    if (vp.isCameraOn) {
      const targetWorld = vp.viewToWorld(this._lastPtView);
      const preTrans = Transform.createTranslationXYZ(-targetWorld.x, -targetWorld.y, -targetWorld.z);
      const postTrans = Transform.createTranslation(this._startPtWorld);

      preTrans.origin.scaleInPlace(zoomRatio);
      preTrans.matrix.scale(zoomRatio, preTrans.matrix);
      const cameraTransform = postTrans.multiplyTransformTransform(preTrans);

      const view = vp.view as ViewState3d;
      const oldEyePoint = view.getEyePoint();
      const newEyePoint = cameraTransform.multiplyPoint3d(oldEyePoint);
      const cameraOffset = newEyePoint.minus(oldEyePoint);
      const cameraOffsetTransform = Transform.createTranslation(cameraOffset);

      const frustum = this._frustum.transformBy(cameraOffsetTransform);
      vp.setupViewFromFrustum(frustum);
      return;
    }

    const targetNpc = vp.viewToNpc(this._lastPtView);
    const transform = Transform.createFixedPointAndMatrix(targetNpc, Matrix3d.createScale(zoomRatio, zoomRatio, 1.0));
    const viewCenter = Point3d.create(.5, .5, .5);
    const startPtNpc = vp.viewToNpc(this._startPtView);
    const shift = startPtNpc.minus(targetNpc); shift.z = 0.0;
    const offset = Transform.createTranslation(shift);

    offset.multiplyTransformTransform(transform, transform);
    transform.multiplyPoint3d(viewCenter, viewCenter);
    vp.npcToWorld(viewCenter, viewCenter);
    vp.zoom(viewCenter, zoomRatio, { saveInUndo: false, animateFrustumChange: false });
  }

  private handleEvent(ev: BeTouchEvent): void {
    if (undefined === this.viewport)
      return;

    if (this._startTouchCount !== ev.touchCount) {
      this.onStart(ev);
      return;
    }

    this._inertiaVec = undefined;
    const vp = this.viewport;
    const thisPt = ev.viewPoint;
    const smallDistance = vp.pixelsFromInches(0.05);
    const samePoint = this._lastPtView.isAlmostEqualXY(thisPt, smallDistance);
    if (1 === ev.touchCount && samePoint)
      return; // Don't early return if multi-touch, center doesn't have to move for zoom...

    if (this._startPtView.isAlmostEqualXY(thisPt, smallDistance)) {
      this._lastPtView.setFrom(this._startPtView);
    } else {
      // Don't add inertia if the viewing operation included zoom, only do this for pan and rotate...
      if (!samePoint && !this._hasZoom) {
        this._inertiaVec = this._lastPtView.vectorTo(thisPt);
        this._inertiaVec.z = 0;
      }
      this._singleTouch = ev.isSingleTouch;
      this._lastPtView.setFrom(thisPt);
      this._lastPtView.z = this._startPtView.z;
    }
    this.perform(ev);
  }

  private perform(ev?: BeTouchEvent) {
    const vp = this.viewport!;
    vp.setupViewFromFrustum(this._frustum);

    const singleTouch = this._singleTouch;
    return vp.view.allow3dManipulations() ?
      singleTouch ? this.handle3dRotate() : this.handle3dPanZoom(ev) :
      singleTouch ? this.handle2dPan() : this.handle2dRotateZoom(ev);
  }

  public async onDataButtonDown(_ev: BeButtonEvent) { return EventHandled.Yes; }
  public async onDataButtonUp(_ev: BeButtonEvent) { return EventHandled.Yes; }
  public async onTouchMove(ev: BeTouchEvent): Promise<void> {
    this.handleEvent(ev);
  }
  public async onTouchCancel(_ev: BeTouchEvent): Promise<void> { this.exitTool(); }
  public async onTouchComplete(_ev: BeTouchEvent): Promise<void> {
    // if we were moving when the touch ended, add inertia to the viewing operation
    if (this._inertiaVec) {
      this._duration = ToolSettings.viewingInertia.duration;
      if (this._duration.isTowardsFuture) { // ensure duration is towards future. Otherwise, don't start animation
        this._end = BeTimePoint.fromNow(this._duration);
        this.viewport!.setAnimator(this);
      }
    }

    this.exitTool();
  }
}

/** A tool that performs view undo operation. An application could also just call Viewport.doUndo directly, creating a ViewTool isn't required.
 * @public
 */
export class ViewUndoTool extends ViewTool {
  public static toolId = "View.Undo";
  public static iconSpec = "icon-window-backward";

  public onPostInstall() {
    if (this.viewport)
      this.viewport.doUndo(ToolSettings.animationTime);
    this.exitTool();
  }
}

/** A tool that performs view redo operation. An application could also just call Viewport.doRedo directly, creating a ViewTool isn't required.
 * @public
 */
export class ViewRedoTool extends ViewTool {
  public static toolId = "View.Redo";
  public static iconSpec = "icon-window-forward";

  public onPostInstall() {
    if (this.viewport)
      this.viewport.doRedo(ToolSettings.animationTime);
    this.exitTool();
  }
}

/** A tool that toggles the camera on/off in a spatial view
 * @public
 */
export class ViewToggleCameraTool extends ViewTool {
  public static toolId = "View.ToggleCamera";
  public static iconSpec = "icon-camera";

  public onInstall(): boolean { return (undefined !== this.viewport && this.viewport.view.allow3dManipulations()); }

  public onPostInstall(): void {
    if (this.viewport) {
      const vp = this.viewport;
      if (vp.isCameraOn)
        (vp.view as ViewState3d).turnCameraOff();
      else
        vp.turnCameraOn();

      const startFrustum = vp.getFrustum();
      vp.synchWithView(true);
      vp.animateToCurrent(startFrustum);
    }
    this.exitTool();
  }
}

/** A tool that sets the view camera by two points. This is a PrimitiveTool and not a ViewTool to allow the view to panned, zoomed, and rotated while defining the points.
 * To show tool settings for specifying camera and target heights above the snap point, make sure formatting and parsing data are cached before the tool starts
 * by calling QuantityFormatter.onInitialized at app startup.
 * @alpha
 */
export class SetupCameraTool extends PrimitiveTool {
  public static toolId = "View.SetupCamera";
  public static iconSpec = "icon-camera-location";
  public viewport?: ScreenViewport;
  protected _haveEyePt: boolean = false;
  protected _eyePtWorld: Point3d = Point3d.create();
  protected _targetPtWorld: Point3d = Point3d.create();

  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.allow3dManipulations()); }
  public isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; }
  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onUnsuspend(): void { this.provideToolAssistance(); }
  protected setupAndPromptForNextAction(): void { IModelApp.accuSnap.enableSnap(true); this.provideToolAssistance(); }
  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> { if (this._haveEyePt) this.onReinitialize(); else this.exitTool(); return EventHandled.Yes; }

  /** @beta */
  protected provideToolAssistance(): void {
    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, ViewTool.translate(this._haveEyePt ? "SetupCamera.Prompts.NextPoint" : "SetupCamera.Prompts.FirstPoint"));
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    const acceptMsg = CoreTools.translate("ElementSet.Inputs.AcceptPoint");
    const rejectMsg = CoreTools.translate(this._haveEyePt ? "ElementSet.Inputs.Restart" : "ElementSet.Inputs.Exit");
    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, acceptMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, acceptMsg, false, ToolAssistanceInputMethod.Mouse));
    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, rejectMsg, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, rejectMsg, false, ToolAssistanceInputMethod.Mouse));

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  public onRestartTool(): void {
    const tool = new SetupCameraTool();
    if (!tool.run())
      this.exitTool();
  }

  protected getAdjustedEyePoint() { return this.useCameraHeight ? this._eyePtWorld.plusScaled(Vector3d.unitZ(), this.cameraHeight) : this._eyePtWorld; }
  protected getAdjustedTargetPoint() { return this.useTargetHeight ? this._targetPtWorld.plusScaled(Vector3d.unitZ(), this.targetHeight) : this._targetPtWorld; }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport) {
      return EventHandled.Yes;
    } else if (undefined === this.viewport) {
      if (!ev.viewport.view.allow3dManipulations())
        return EventHandled.Yes;
      this.viewport = ev.viewport;
    } else if (this.viewport.view.iModel !== ev.viewport.view.iModel) {
      if (this._haveEyePt)
        return EventHandled.Yes;
      this.viewport = ev.viewport;
      return EventHandled.Yes;
    }

    if (this._haveEyePt) {
      this._targetPtWorld.setFrom(ev.point);
      this.doManipulation();
      this.onReinitialize();
    } else {
      this._eyePtWorld.setFrom(ev.point);
      this._targetPtWorld.setFrom(this._eyePtWorld);
      this._haveEyePt = true;
      this.setupAndPromptForNextAction();
    }

    return EventHandled.Yes;
  }

  public async onMouseMotion(ev: BeButtonEvent) {
    if (!this._haveEyePt)
      return;
    this._targetPtWorld.setFrom(ev.point);
    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  public async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (EventHandled.Yes === await super.onKeyTransition(wentDown, keyEvent))
      return EventHandled.Yes;
    return (wentDown && AccuDrawShortcuts.processShortcutKey(keyEvent)) ? EventHandled.Yes : EventHandled.No;
  }

  public decorate(context: DecorateContext): void {
    if (!this._haveEyePt || undefined === this.viewport || !this.viewport.view.is3d() || this.viewport.view.iModel !== context.viewport.view.iModel)
      return;

    const eyePtWorld = this.getAdjustedEyePoint();
    const targetPtWorld = this.getAdjustedTargetPoint();
    const zVec = Vector3d.createStartEnd(eyePtWorld, targetPtWorld);
    const focusDist = zVec.normalizeWithLength(zVec).mag;
    if (focusDist <= Constant.oneMillimeter) // eye and target are too close together
      return;

    const xVec = new Vector3d();
    const yVec = Vector3d.unitZ();
    if (yVec.crossProduct(zVec).normalizeWithLength(xVec).mag < Geometry.smallMetricDistance)
      return;
    if (zVec.crossProduct(xVec).normalizeWithLength(yVec).mag < Geometry.smallMetricDistance)
      return;

    const lensAngle = ToolSettings.walkCameraAngle;
    const extentX = Math.tan(lensAngle.radians / 2.0) * focusDist;
    const extentY = extentX * (this.viewport.view.extents.y / this.viewport.view.extents.x);

    const pt1 = targetPtWorld.plusScaled(xVec, -extentX); pt1.plusScaled(yVec, extentY, pt1);
    const pt2 = targetPtWorld.plusScaled(xVec, extentX); pt2.plusScaled(yVec, extentY, pt2);
    const pt3 = targetPtWorld.plusScaled(xVec, extentX); pt3.plusScaled(yVec, -extentY, pt3);
    const pt4 = targetPtWorld.plusScaled(xVec, -extentX); pt4.plusScaled(yVec, -extentY, pt4);

    const color = this.viewport.getContrastToBackgroundColor();
    const builderHid = context.createGraphicBuilder(GraphicType.WorldOverlay);

    builderHid.setSymbology(color, color, ViewHandleWeight.Bold);
    builderHid.addLineString([eyePtWorld, targetPtWorld]);

    builderHid.setSymbology(color, color, ViewHandleWeight.Thin, LinePixels.Code2);
    builderHid.addLineString([eyePtWorld, pt1]);
    builderHid.addLineString([eyePtWorld, pt2]);
    builderHid.addLineString([eyePtWorld, pt3]);
    builderHid.addLineString([eyePtWorld, pt4]);
    builderHid.addLineString([pt1, pt2, pt3, pt4, pt1]);

    if (this.useCameraHeight)
      builderHid.addLineString([this._eyePtWorld, eyePtWorld]);
    if (this.useTargetHeight)
      builderHid.addLineString([this._targetPtWorld, targetPtWorld]);

    builderHid.setSymbology(color, color, ViewHandleWeight.FatDot);
    builderHid.addPointString([eyePtWorld, targetPtWorld]);

    if (this.useCameraHeight)
      builderHid.addPointString([this._eyePtWorld]);
    if (this.useTargetHeight)
      builderHid.addPointString([this._targetPtWorld]);

    context.addDecorationFromBuilder(builderHid);

    const backColor = ColorDef.from(0, 0, 255, 200);
    const sideColor = context.viewport.hilite.color.clone(); sideColor.setAlpha(25);
    const builderVis = context.createGraphicBuilder(GraphicType.WorldDecoration);

    builderVis.setSymbology(color, color, ViewHandleWeight.Normal);
    builderVis.addLineString([eyePtWorld, pt1]);
    builderVis.addLineString([eyePtWorld, pt2]);
    builderVis.addLineString([eyePtWorld, pt3]);
    builderVis.addLineString([eyePtWorld, pt4]);
    builderVis.addLineString([pt1, pt2, pt3, pt4, pt1]);

    builderVis.setSymbology(color, backColor, ViewHandleWeight.Thin);
    builderVis.addShape([pt1, pt2, pt3, pt4]);

    builderVis.setSymbology(color, sideColor, ViewHandleWeight.Thin);
    builderVis.addShape([eyePtWorld, pt1, pt2]);
    builderVis.addShape([eyePtWorld, pt2, pt3]);
    builderVis.addShape([eyePtWorld, pt3, pt4]);
    builderVis.addShape([eyePtWorld, pt4, pt1]);

    context.addDecorationFromBuilder(builderVis);
  }

  public decorateSuspended(context: DecorateContext): void { this.decorate(context); }

  private doManipulation(): void {
    const vp = this.viewport;
    if (undefined === vp)
      return;

    const view = vp.view;
    if (!view.is3d() || !view.allow3dManipulations())
      return;

    const eyePtWorld = this.getAdjustedEyePoint();
    const targetPtWorld = this.getAdjustedTargetPoint();
    const lensAngle = ToolSettings.walkCameraAngle;
    const startFrust = vp.getWorldFrustum();
    if (ViewStatus.Success !== view.lookAtUsingLensAngle(eyePtWorld, targetPtWorld, Vector3d.unitZ(), lensAngle))
      return;

    vp.synchWithView(true);
    vp.animateToCurrent(startFrust, BeDuration.fromMilliseconds(500));
  }

  private _useCameraHeightValue = new ToolSettingsValue(false);
  public get useCameraHeight(): boolean { return this._useCameraHeightValue.value as boolean; }
  public set useCameraHeight(option: boolean) { this._useCameraHeightValue.value = option; }
  private static _useCameraHeightName = "useCameraHeight";

  private static _getUseCameraHeightDescription = (): PropertyDescription => {
    return {
      name: SetupCameraTool._useCameraHeightName,
      displayLabel: "",
      typename: "boolean",
      editor: {
        params: [
          {
            type: PropertyEditorParamTypes.SuppressEditorLabel,
            suppressLabelPlaceholder: true,
          } as SuppressLabelEditorParams,
        ],
      },
    };
  }

  private _useTargetHeightValue = new ToolSettingsValue(false);
  public get useTargetHeight(): boolean { return this._useTargetHeightValue.value as boolean; }
  public set useTargetHeight(option: boolean) { this._useTargetHeightValue.value = option; }
  private static _useTargetHeightName = "useTargetHeight";
  private static _getUseTargetHeightDescription = (): PropertyDescription => {
    return {
      name: SetupCameraTool._useTargetHeightName,
      displayLabel: "",
      typename: "boolean",
      editor: {
        params: [
          {
            type: PropertyEditorParamTypes.SuppressEditorLabel,
            suppressLabelPlaceholder: true,
          } as SuppressLabelEditorParams,
        ],
      },
    };
  }

  private _cameraHeightValue = new ToolSettingsValue(0.0);
  public get cameraHeight(): number { return this._cameraHeightValue.value as number; }
  public set cameraHeight(option: number) { this._cameraHeightValue.value = option; }
  private static _cameraHeightName = "cameraHeight";
  private static _cameraHeightDescription?: LengthDescription;
  private _getCameraHeightDescription = (): PropertyDescription => {
    if (!SetupCameraTool._cameraHeightDescription)
      SetupCameraTool._cameraHeightDescription = new LengthDescription(SetupCameraTool._cameraHeightName, ViewTool.translate("SetupCamera.Labels.CameraHeight"));
    return SetupCameraTool._cameraHeightDescription;
  }

  private _targetHeightValue = new ToolSettingsValue(0.0);
  public get targetHeight(): number { return this._targetHeightValue.value as number; }
  public set targetHeight(option: number) { this._targetHeightValue.value = option; }
  private static _targetHeightName = "targetHeight";
  private static _targetHeightDescription?: LengthDescription;
  private _getTargetHeightDescription = (): PropertyDescription => {
    if (!SetupCameraTool._targetHeightDescription)
      SetupCameraTool._targetHeightDescription = new LengthDescription(SetupCameraTool._targetHeightName, ViewTool.translate("SetupCamera.Labels.TargetHeight"));
    return SetupCameraTool._targetHeightDescription;
  }

  private syncCameraHeightState(): void {
    const cameraHeightValue = new ToolSettingsValue(this.cameraHeight);
    cameraHeightValue.displayValue = SetupCameraTool._cameraHeightDescription!.format(cameraHeightValue.value as number);
    const syncItem: ToolSettingsPropertySyncItem = { value: cameraHeightValue, propertyName: SetupCameraTool._cameraHeightName, isDisabled: !this.useCameraHeight };
    this.syncToolSettingsProperties([syncItem]);
  }

  private syncTargetHeightState(): void {
    const targetHeightValue = new ToolSettingsValue(this.targetHeight);
    targetHeightValue.displayValue = SetupCameraTool._targetHeightDescription!.format(targetHeightValue.value as number);
    const syncItem: ToolSettingsPropertySyncItem = { value: targetHeightValue, propertyName: SetupCameraTool._targetHeightName, isDisabled: !this.useTargetHeight };
    this.syncToolSettingsProperties([syncItem]);
  }

  public applyToolSettingPropertyChange(updatedValue: ToolSettingsPropertySyncItem): boolean {
    if (updatedValue.propertyName === SetupCameraTool._useCameraHeightName) {
      this.useCameraHeight = updatedValue.value.value as boolean;
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: SetupCameraTool._useCameraHeightName, value: this._useCameraHeightValue });
      this.syncCameraHeightState();
    } else if (updatedValue.propertyName === SetupCameraTool._useTargetHeightName) {
      this.useTargetHeight = updatedValue.value.value as boolean;
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: SetupCameraTool._useTargetHeightName, value: this._useTargetHeightValue });
      this.syncTargetHeightState();
    } else if (updatedValue.propertyName === SetupCameraTool._cameraHeightName) {
      this.cameraHeight = updatedValue.value.value as number;
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: SetupCameraTool._cameraHeightName, value: this._cameraHeightValue });
    } else if (updatedValue.propertyName === SetupCameraTool._targetHeightName) {
      this.targetHeight = updatedValue.value.value as number;
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: SetupCameraTool._targetHeightName, value: this._targetHeightValue });
    }
    return true;
  }

  public supplyToolSettingsProperties(): ToolSettingsPropertyRecord[] | undefined {
    IModelApp.toolAdmin.toolSettingsState.initializeToolSettingProperties(this.toolId, [
      { propertyName: SetupCameraTool._useCameraHeightName, value: this._useCameraHeightValue },
      { propertyName: SetupCameraTool._cameraHeightName, value: this._cameraHeightValue },
      { propertyName: SetupCameraTool._useTargetHeightName, value: this._useTargetHeightValue },
      { propertyName: SetupCameraTool._targetHeightName, value: this._targetHeightValue },
    ]);

    const toolSettings = new Array<ToolSettingsPropertyRecord>();
    toolSettings.push(new ToolSettingsPropertyRecord(this._useCameraHeightValue.clone() as PrimitiveValue, SetupCameraTool._getUseCameraHeightDescription(), { rowPriority: 1, columnIndex: 0 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._cameraHeightValue.clone() as PrimitiveValue, this._getCameraHeightDescription(), { rowPriority: 1, columnIndex: 2 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._useTargetHeightValue.clone() as PrimitiveValue, SetupCameraTool._getUseTargetHeightDescription(), { rowPriority: 2, columnIndex: 0 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._targetHeightValue.clone() as PrimitiveValue, this._getTargetHeightDescription(), { rowPriority: 2, columnIndex: 2 }));
    return toolSettings;
  }
}
