/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Range3d, ClipVector, ClipShape, ClipPrimitive, ClipPlane, ConvexClipPlaneSet, Plane3dByOriginAndUnitNormal, Vector3d, Point3d, Transform, Matrix3d, ClipMaskXYZRangePlanes, Range1d, PolygonOps, Geometry, Ray3d, ClipUtilities, Loop, Path, GeometryQuery, LineString3d } from "@bentley/geometry-core";
import { Placement2d, Placement3d, Placement2dProps, ColorDef, LinePixels } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { BeButtonEvent, EventHandled, CoordinateLockOverrides } from "./Tool";
import { LocateResponse } from "../ElementLocateManager";
import { Id64Arg, Id64, BeEvent, GuidString, Guid } from "@bentley/bentleyjs-core";
import { Viewport, ScreenViewport } from "../Viewport";
import { TentativeOrAccuSnap } from "../AccuSnap";
import { PrimitiveTool } from "./PrimitiveTool";
import { DecorateContext } from "../ViewContext";
import { EditManipulator } from "./EditManipulator";
import { AccuDrawHintBuilder, AccuDraw } from "../AccuDraw";
import { StandardViewId } from "../StandardView";
import { GraphicType } from "../rendering";
import { HitDetail } from "../HitDetail";
import { PropertyDescription } from "../properties/Description";
import { ToolSettingsValue, ToolSettingsPropertyRecord, ToolSettingsPropertySyncItem } from "../properties/ToolSettingsValue";
import { PrimitiveValue } from "../properties/Value";
import { AccuDrawShortcuts } from "./AccuDrawTool";
import { IModelConnection } from "../IModelConnection";
import { AuthorizedFrontendRequestContext } from "../imodeljs-frontend";
import { SettingsResult, SettingsStatus, SettingsMapResult } from "@bentley/imodeljs-clients";

/** @internal The orientation to use to define the view clip volume */
export const enum ClipOrientation { // tslint:disable-line:no-const-enum
  Top,
  Front,
  Left,
  Bottom,
  Back,
  Right,
  View,
  Face,
}

/** @internal An object that can react to a view's clip being changed by tools or modify handles. */
export interface ViewClipEventHandler {
  selectOnCreate(): boolean; // Add newly created clip geometry to selection set and show modify controls.
  clearOnDeselect(): boolean; // Stop displaying clip geometry when clip is removed from the selection set.
  onNewClip(viewport: Viewport): void; // Called by tools that set or replace the existing view clip with a new clip.
  onNewClipPlane(viewport: Viewport): void; // Called by tools that add a single plane to the view clip. When there is more than one plane, the new plane is always last.
  onModifyClip(viewport: Viewport): void; // Called by tools after modifying the view clip.
  onClearClip(viewport: Viewport): void; // Called when the view clip is cleared from the view.
  onActivateClip(viewport: Viewport, interactive: boolean): void; // Called when the view clip is changed to a saved clip.
  onRightClick(hit: HitDetail, ev: BeButtonEvent): boolean; // Called when user right clicks on clip geometry or clip modify handle. Return true if event handled.
}

/** @internal A tool to define a clip volume for a view */
export class ViewClipTool extends PrimitiveTool {
  constructor(protected _clipEventHandler?: ViewClipEventHandler) { super(); }

  protected static _orientationName = "enumAsOrientation";
  protected static enumAsOrientationMessage(str: string) { return IModelApp.i18n.translate("CoreTools:tools.ViewClip.Settings.Orientation." + str); }
  protected static _getEnumAsOrientationDescription = (): PropertyDescription => {
    return {
      name: ViewClipTool._orientationName,
      displayLabel: IModelApp.i18n.translate("CoreTools:tools.ViewClip.Settings.Orientation.Label"),
      typename: "enum",
      enum: {
        choices: [
          { label: ViewClipTool.enumAsOrientationMessage("Top"), value: ClipOrientation.Top },
          { label: ViewClipTool.enumAsOrientationMessage("Front"), value: ClipOrientation.Front },
          { label: ViewClipTool.enumAsOrientationMessage("Left"), value: ClipOrientation.Left },
          { label: ViewClipTool.enumAsOrientationMessage("Bottom"), value: ClipOrientation.Bottom },
          { label: ViewClipTool.enumAsOrientationMessage("Back"), value: ClipOrientation.Back },
          { label: ViewClipTool.enumAsOrientationMessage("Right"), value: ClipOrientation.Right },
          { label: ViewClipTool.enumAsOrientationMessage("View"), value: ClipOrientation.View },
          { label: ViewClipTool.enumAsOrientationMessage("Face"), value: ClipOrientation.Face },
        ],
      },
    };
  }

  public requireWriteableTarget(): boolean { return false; }
  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp.view.allow3dManipulations()); }

  public onPostInstall(): void { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onUnsuspend(): void { this.showPrompt(); }
  public onRestartTool(): void { this.exitTool(); }

  protected outputPrompt(prompt: string) { IModelApp.notifications.outputPromptByKey("CoreTools:tools.ViewClip." + prompt); }
  protected showPrompt(): void { }
  protected setupAndPromptForNextAction(): void { this.showPrompt(); }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> { this.onReinitialize(); return EventHandled.No; }

  public static getPlaneInwardNormal(orientation: ClipOrientation, viewport: Viewport): Vector3d | undefined {
    const matrix = ViewClipTool.getClipOrientation(orientation, viewport);
    if (undefined === matrix)
      return undefined;
    return matrix.getColumn(2).negate();
  }

  public static getClipOrientation(orientation: ClipOrientation, viewport: Viewport): Matrix3d | undefined {
    switch (orientation) {
      case ClipOrientation.Top:
        return AccuDraw.getStandardRotation(StandardViewId.Top, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.Front:
        return AccuDraw.getStandardRotation(StandardViewId.Front, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.Left:
        return AccuDraw.getStandardRotation(StandardViewId.Left, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.Bottom:
        return AccuDraw.getStandardRotation(StandardViewId.Bottom, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.Back:
        return AccuDraw.getStandardRotation(StandardViewId.Back, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.Right:
        return AccuDraw.getStandardRotation(StandardViewId.Right, viewport, viewport.isContextRotationRequired).inverse();
      case ClipOrientation.View:
        return viewport.view.getRotation().inverse();
      case ClipOrientation.Face:
        const snap = TentativeOrAccuSnap.getCurrentSnap(false);
        if (undefined === snap || undefined === snap.normal)
          return undefined;
        const normal = Vector3d.createZero();
        const boresite = EditManipulator.HandleUtils.getBoresite(snap.hitPoint, viewport);
        if (snap.normal.dotProduct(boresite.direction) < 0.0)
          normal.setFrom(snap.normal);
        else
          snap.normal.negate(normal);
        return Matrix3d.createRigidHeadsUp(normal);
    }
    return undefined;
  }

  public static enableClipVolume(viewport: Viewport): boolean {
    if (viewport.viewFlags.clipVolume)
      return false;
    const viewFlags = viewport.viewFlags.clone();
    viewFlags.clipVolume = true;
    viewport.viewFlags = viewFlags;
    return true;
  }

  public static setViewClip(viewport: Viewport, clip?: ClipVector): boolean {
    viewport.view.setViewClip(clip);
    viewport.setupFromView();
    return true;
  }

  public static doClipToConvexClipPlaneSet(viewport: Viewport, planes: ConvexClipPlaneSet): boolean {
    const prim = ClipPrimitive.createCapture(planes);
    const clip = ClipVector.createEmpty();
    clip.appendReference(prim);
    return this.setViewClip(viewport, clip);
  }

  public static doClipToPlane(viewport: Viewport, origin: Point3d, normal: Vector3d, clearExistingPlanes: boolean): boolean {
    const plane = Plane3dByOriginAndUnitNormal.create(origin, normal);
    if (undefined === plane)
      return false;
    let planeSet: ConvexClipPlaneSet | undefined;
    if (!clearExistingPlanes) {
      const existingClip = viewport.view.getViewClip();
      if (undefined !== existingClip && 1 === existingClip.clips.length) {
        const existingPrim = existingClip.clips[0];
        if (!(existingPrim instanceof ClipShape)) {
          const existingPlaneSets = existingPrim.fetchClipPlanesRef();
          if (undefined !== existingPlaneSets && 1 === existingPlaneSets.convexSets.length)
            planeSet = existingPlaneSets.convexSets[0];
        }
      }
    }
    if (undefined === planeSet)
      planeSet = ConvexClipPlaneSet.createEmpty();
    planeSet.addPlaneToConvexSet(ClipPlane.createPlane(plane));
    return this.doClipToConvexClipPlaneSet(viewport, planeSet);
  }

  public static doClipToShape(viewport: Viewport, xyPoints: Point3d[], transform?: Transform, zLow?: number, zHigh?: number): boolean {
    const clip = ClipVector.createEmpty();
    clip.appendShape(xyPoints, zLow, zHigh, transform);
    return this.setViewClip(viewport, clip);
  }

  public static doClipToRange(viewport: Viewport, range: Range3d, transform?: Transform): boolean {
    if (range.isNull || range.isAlmostZeroX || range.isAlmostZeroY)
      return false;
    const clip = ClipVector.createEmpty();
    const block = ClipShape.createBlock(range, range.isAlmostZeroZ ? ClipMaskXYZRangePlanes.XAndY : ClipMaskXYZRangePlanes.All, false, false, transform);
    clip.appendReference(block);
    return this.setViewClip(viewport, clip);
  }

  public static doClipClear(viewport: Viewport): boolean {
    if (!ViewClipTool.hasClip(viewport))
      return false;
    return this.setViewClip(viewport);
  }

  public static getClipRayTransformed(origin: Point3d, direction: Vector3d, transform?: Transform): Ray3d {
    const facePt = origin.clone();
    const faceDir = direction.clone();

    if (undefined !== transform) {
      transform.multiplyPoint3d(facePt, facePt);
      transform.multiplyVector(faceDir, faceDir);
      faceDir.normalizeInPlace();
    }

    return Ray3d.createCapture(facePt, faceDir);
  }

  public static getOffsetValueTransformed(offset: number, transform?: Transform) {
    if (undefined === transform)
      return offset;
    const lengthVec = Vector3d.create(offset);
    transform.multiplyVector(lengthVec, lengthVec);
    const localOffset = lengthVec.magnitude();
    return (offset < 0 ? -localOffset : localOffset);
  }

  public static drawClipShape(context: DecorateContext, shape: ClipShape, extents: Range1d, color: ColorDef, weight: number, id?: string): void {
    const shapePtsLo = ViewClipTool.getClipShapePoints(shape, extents.low);
    const shapePtsHi = ViewClipTool.getClipShapePoints(shape, extents.high);
    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, shape.transformFromClip, id); // Use WorldDecoration not WorldOverlay to make sure handles have priority...
    builder.setSymbology(color, ColorDef.black, weight);
    for (let i: number = 0; i < shapePtsLo.length; i++)
      builder.addLineString([shapePtsLo[i].clone(), shapePtsHi[i].clone()]);
    builder.addLineString(shapePtsLo);
    builder.addLineString(shapePtsHi);
    context.addDecorationFromBuilder(builder);
  }

  public static getClipShapePoints(shape: ClipShape, z: number): Point3d[] {
    const points: Point3d[] = [];
    for (const pt of shape.polygon)
      points.push(Point3d.create(pt.x, pt.y, z));
    return points;
  }

  public static getClipShapeExtents(shape: ClipShape, viewRange: Range3d): Range1d {
    let zLow = shape.zLow;
    let zHigh = shape.zHigh;
    if (undefined === zLow || undefined === zHigh) {
      const zVec = Vector3d.unitZ();
      const origin = shape.polygon[0];
      const corners = viewRange.corners();
      if (undefined !== shape.transformToClip)
        shape.transformToClip.multiplyPoint3dArrayInPlace(corners);
      for (const corner of corners) {
        const delta = Vector3d.createStartEnd(origin, corner);
        const projection = delta.dotProduct(zVec);
        if (undefined === shape.zLow && (undefined === zLow || projection < zLow))
          zLow = projection;
        if (undefined === shape.zHigh && (undefined === zHigh || projection > zHigh))
          zHigh = projection;
      }
    }
    return Range1d.createXX(zLow!, zHigh!);
  }

  public static isSingleClipShape(clip: ClipVector): ClipShape | undefined {
    if (1 !== clip.clips.length)
      return undefined;
    const prim = clip.clips[0];
    if (!(prim instanceof ClipShape))
      return undefined;
    if (!prim.isValidPolygon)
      return undefined;
    return prim;
  }

  public static drawClipPlanesLoops(context: DecorateContext, loops: GeometryQuery[], color: ColorDef, weight: number, dashed?: boolean, fill?: ColorDef, id?: string): void {
    if (loops.length < 1)
      return;
    const builderEdge = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined, id); // Use WorldDecoration not WorldOverlay to make sure handles have priority...
    builderEdge.setSymbology(color, ColorDef.black, weight, dashed ? LinePixels.Code2 : undefined);
    for (const geom of loops) {
      if (!(geom instanceof Loop))
        continue;
      builderEdge.addPath(Path.createArray(geom.children));
    }
    context.addDecorationFromBuilder(builderEdge);
    if (undefined === fill)
      return;
    const builderFace = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined);
    builderFace.setSymbology(fill, fill, 0);
    for (const geom of loops) {
      if (!(geom instanceof Loop))
        continue;
      builderFace.addLoop(geom);
    }
    context.addDecorationFromBuilder(builderFace);
  }

  public static isSingleConvexClipPlaneSet(clip: ClipVector): ConvexClipPlaneSet | undefined {
    if (1 !== clip.clips.length)
      return undefined;
    const prim = clip.clips[0];
    if (prim instanceof ClipShape)
      return undefined;
    const planeSets = prim.fetchClipPlanesRef();
    return (undefined !== planeSets && 1 === planeSets.convexSets.length) ? planeSets.convexSets[0] : undefined;
  }

  public static isSingleClipPlane(clip: ClipVector): ClipPlane | undefined {
    const clipPlanes = ViewClipTool.isSingleConvexClipPlaneSet(clip);
    if (undefined === clipPlanes || 1 !== clipPlanes.planes.length)
      return undefined;
    return clipPlanes.planes[0];
  }

  public static areClipsEqual(clipA: ClipVector, clipB: ClipVector): boolean {
    if (clipA === clipB)
      return true;
    if (clipA.clips.length !== clipB.clips.length)
      return false;
    for (let iPrim = 0; iPrim < clipA.clips.length; iPrim++) {
      const primA = clipA.clips[iPrim];
      const primB = clipB.clips[iPrim];
      const planesA = primA.fetchClipPlanesRef();
      const planesB = primB.fetchClipPlanesRef();
      if (undefined !== planesA && undefined !== planesB) {
        if (planesA.convexSets.length !== planesB.convexSets.length)
          return false;
        for (let iPlane = 0; iPlane < planesA.convexSets.length; iPlane++) {
          const planeSetA = planesA.convexSets[iPlane];
          const planeSetB = planesB.convexSets[iPlane];
          if (planeSetA.planes.length !== planeSetB.planes.length)
            return false;
          for (let iClipPlane = 0; iClipPlane < planeSetA.planes.length; iClipPlane++) {
            const planeA = planeSetA.planes[iClipPlane];
            const planeB = planeSetB.planes[iClipPlane];
            if (!planeA.isAlmostEqual(planeB))
              return false;
          }
        }
      } else if (undefined === planesA && undefined === planesB) {
        continue;
      } else {
        return false;
      }
    }
    return true;
  }

  public static hasClip(viewport: Viewport) {
    return (undefined !== viewport.view.getViewClip());
  }
}

/** @internal A tool to remove a clip volume for a view */
export class ViewClipClearTool extends ViewClipTool {
  public static toolId = "ViewClip.Clear";
  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && ViewClipTool.hasClip(vp)); }

  protected showPrompt(): void { this.outputPrompt("Clear.Prompts.FirstPoint"); }

  protected doClipClear(viewport: Viewport): boolean {
    if (!ViewClipTool.doClipClear(viewport))
      return false;
    if (undefined !== this._clipEventHandler)
      this._clipEventHandler.onClearClip(viewport);
    this.onReinitialize();
    return true;
  }

  public onPostInstall(): void {
    super.onPostInstall();
    if (undefined !== this.targetView)
      this.doClipClear(this.targetView);
  }

  public async onDataButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;
    return this.doClipClear(this.targetView) ? EventHandled.Yes : EventHandled.No;
  }
}

/** @internal A tool to define a clip volume for a view by specifying a plane */
export class ViewClipByPlaneTool extends ViewClipTool {
  public static toolId = "ViewClip.ByPlane";
  private _orientationValue = new ToolSettingsValue(ClipOrientation.Face);
  constructor(clipEventHandler?: ViewClipEventHandler, protected _clearExistingPlanes: boolean = false) { super(clipEventHandler); }

  public get orientation(): ClipOrientation { return this._orientationValue.value as ClipOrientation; }
  public set orientation(option: ClipOrientation) { this._orientationValue.value = option; }

  public supplyToolSettingsProperties(): ToolSettingsPropertyRecord[] | undefined {
    const toolSettings = new Array<ToolSettingsPropertyRecord>();
    toolSettings.push(new ToolSettingsPropertyRecord(this._orientationValue.clone() as PrimitiveValue, ViewClipTool._getEnumAsOrientationDescription(), { rowPriority: 0, columnIndex: 2 }));
    return toolSettings;
  }

  public applyToolSettingPropertyChange(updatedValue: ToolSettingsPropertySyncItem): boolean {
    if (updatedValue.propertyName === ViewClipTool._orientationName)
      return this._orientationValue.update(updatedValue.value);
    return false;
  }

  protected showPrompt(): void { this.outputPrompt("ByPlane.Prompts.FirstPoint"); }

  protected setupAndPromptForNextAction(): void {
    super.setupAndPromptForNextAction();
    IModelApp.accuSnap.enableSnap(true);
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;
    const normal = ViewClipTool.getPlaneInwardNormal(this.orientation, this.targetView);
    if (undefined === normal)
      return EventHandled.No;
    ViewClipTool.enableClipVolume(this.targetView);
    if (!ViewClipTool.doClipToPlane(this.targetView, ev.point, normal, this._clearExistingPlanes))
      return EventHandled.No;
    if (undefined !== this._clipEventHandler)
      this._clipEventHandler.onNewClipPlane(this.targetView);
    this.onReinitialize();
    return EventHandled.Yes;
  }
}

/** @internal A tool to define a clip volume for a view by specifying a shape */
export class ViewClipByShapeTool extends ViewClipTool {
  public static toolId = "ViewClip.ByShape";
  private _orientationValue = new ToolSettingsValue(ClipOrientation.Top);
  protected readonly _points: Point3d[] = [];
  protected _matrix?: Matrix3d;
  protected _zLow?: number;
  protected _zHigh?: number;

  public get orientation(): ClipOrientation { return this._orientationValue.value as ClipOrientation; }
  public set orientation(option: ClipOrientation) { this._orientationValue.value = option; }

  public supplyToolSettingsProperties(): ToolSettingsPropertyRecord[] | undefined {
    const toolSettings = new Array<ToolSettingsPropertyRecord>();
    toolSettings.push(new ToolSettingsPropertyRecord(this._orientationValue.clone() as PrimitiveValue, ViewClipTool._getEnumAsOrientationDescription(), { rowPriority: 0, columnIndex: 2 }));
    return toolSettings;
  }

  public applyToolSettingPropertyChange(updatedValue: ToolSettingsPropertySyncItem): boolean {
    if (updatedValue.propertyName === ViewClipTool._orientationName) {
      if (!this._orientationValue.update(updatedValue.value))
        return false;
      this._points.length = 0;
      this._matrix = undefined;
      IModelApp.accuDraw.deactivate();
      this.setupAndPromptForNextAction();
      return true;
    }
    return false;
  }

  protected showPrompt(): void {
    switch (this._points.length) {
      case 0:
        this.outputPrompt("ByShape.Prompts.FirstPoint");
        break;
      case 1:
        this.outputPrompt("ByShape.Prompts.SecondPoint");
        break;
      case 2:
        this.outputPrompt("ByShape.Prompts.ThirdPoint");
        break;
      default:
        this.outputPrompt("ByShape.Prompts.NextPoint");
        break;
    }
  }

  protected setupAndPromptForNextAction(): void {
    super.setupAndPromptForNextAction();
    IModelApp.accuSnap.enableSnap(true);
    if (0 === this._points.length)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.setOrigin(this._points[this._points.length - 1]);
    hints.setRotation(this._matrix!.inverse()!);
    hints.setModeRectangular();
    hints.setLockZ = true;
    hints.sendHints();
  }

  protected getClipPoints(ev: BeButtonEvent): Point3d[] {
    const points: Point3d[] = [];
    if (undefined === this.targetView || this._points.length < 1)
      return points;
    for (const pt of this._points)
      points.push(pt.clone());

    const normal = this._matrix!.getColumn(2);
    let currentPt = EditManipulator.HandleUtils.projectPointToPlaneInView(ev.point, points[0], normal, ev.viewport!, true);
    if (undefined === currentPt)
      currentPt = ev.point.clone();
    if (2 === points.length && !ev.isControlKey) {
      const xDir = Vector3d.createStartEnd(points[0], points[1]);
      const xLen = xDir.magnitude(); xDir.normalizeInPlace();
      const yDir = xDir.crossProduct(normal); yDir.normalizeInPlace();
      const cornerPt = EditManipulator.HandleUtils.projectPointToLineInView(currentPt, points[1], yDir, ev.viewport!, true);
      if (undefined !== cornerPt) {
        points.push(cornerPt);
        cornerPt.plusScaled(xDir, -xLen, currentPt);
      }
    }
    points.push(currentPt);
    if (points.length > 2)
      points.push(points[0].clone());

    return points;
  }

  public isValidLocation(ev: BeButtonEvent, isButtonEvent: boolean): boolean {
    return (this._points.length > 0 ? true : super.isValidLocation(ev, isButtonEvent));
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport !== this.targetView)
      return;

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    const points = this.getClipPoints(ev);
    if (points.length < 2)
      return;

    const builderAccVis = context.createGraphicBuilder(GraphicType.WorldDecoration);
    const builderAccHid = context.createGraphicBuilder(GraphicType.WorldOverlay);
    const colorAccVis = ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor);
    const colorAccHid = colorAccVis.clone(); colorAccHid.setAlpha(100);
    const fillAccVis = context.viewport.hilite.color.clone(); fillAccVis.setAlpha(25);

    builderAccVis.setSymbology(colorAccVis, fillAccVis, 3);
    builderAccHid.setSymbology(colorAccHid, fillAccVis, 1);

    if (points.length > 2)
      builderAccHid.addShape(points);

    builderAccVis.addLineString(points);
    builderAccHid.addLineString(points);

    context.addDecorationFromBuilder(builderAccVis);
    context.addDecorationFromBuilder(builderAccHid);
  }

  public decorateSuspended(context: DecorateContext): void { this.decorate(context); }
  public async onMouseMotion(ev: BeButtonEvent): Promise<void> { if (this._points.length > 0 && undefined !== ev.viewport) ev.viewport.invalidateDecorations(); }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;

    if (this._points.length > 1 && !ev.isControlKey) {
      const points = this.getClipPoints(ev);
      if (points.length < 3)
        return EventHandled.No;

      const transform = Transform.createOriginAndMatrix(points[0], this._matrix);
      transform.multiplyInversePoint3dArrayInPlace(points);
      ViewClipTool.enableClipVolume(this.targetView);
      if (!ViewClipTool.doClipToShape(this.targetView, points, transform, this._zLow, this._zHigh))
        return EventHandled.No;
      if (undefined !== this._clipEventHandler)
        this._clipEventHandler.onNewClip(this.targetView);
      this.onReinitialize();
      return EventHandled.Yes;
    }

    if (undefined === this._matrix && undefined === (this._matrix = ViewClipTool.getClipOrientation(this.orientation, this.targetView)))
      return EventHandled.No;

    const currPt = ev.point.clone();
    if (this._points.length > 0) {
      const planePt = EditManipulator.HandleUtils.projectPointToPlaneInView(currPt, this._points[0], this._matrix!.getColumn(2), ev.viewport!, true);
      if (undefined !== planePt)
        currPt.setFrom(planePt);
    }

    this._points.push(currPt);
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this._points.length)
      return false;

    this._points.pop();
    if (0 === this._points.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();
    return true;
  }

  public async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (EventHandled.Yes === await super.onKeyTransition(wentDown, keyEvent))
      return EventHandled.Yes;
    return (wentDown && AccuDrawShortcuts.processShortcutKey(keyEvent)) ? EventHandled.Yes : EventHandled.No;
  }
}

/** @internal A tool to define a clip volume for a view by specifying range corners */
export class ViewClipByRangeTool extends ViewClipTool {
  public static toolId = "ViewClip.ByRange";
  protected _corner?: Point3d;

  protected showPrompt(): void { this.outputPrompt(undefined === this._corner ? "ByRange.Prompts.FirstPoint" : "ByRange.Prompts.NextPoint"); }

  protected setupAndPromptForNextAction(): void {
    super.setupAndPromptForNextAction();
    IModelApp.accuSnap.enableSnap(true);
  }

  protected getClipRange(range: Range3d, transform: Transform, ev: BeButtonEvent): boolean {
    if (undefined === this.targetView || undefined === this._corner)
      return false;
    // Creating clip aligned with ACS when ACS context lock is enabled...
    const matrix = ViewClipTool.getClipOrientation(ClipOrientation.Top, this.targetView);
    Transform.createOriginAndMatrix(this._corner, matrix, transform);
    const pt1 = transform.multiplyInversePoint3d(this._corner);
    const pt2 = transform.multiplyInversePoint3d(ev.point);
    if (undefined === pt1 || undefined === pt2)
      return false;
    range.setFrom(Range3d.create(pt1, pt2));
    return true;
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport !== this.targetView || undefined === this._corner)
      return;

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    const range = Range3d.create();
    const transform = Transform.createIdentity();
    if (!this.getClipRange(range, transform, ev))
      return;

    const builderAccVis = context.createGraphicBuilder(GraphicType.WorldDecoration, transform);
    const builderAccHid = context.createGraphicBuilder(GraphicType.WorldOverlay, transform);
    const colorAccVis = ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor);
    const colorAccHid = colorAccVis.clone(); colorAccHid.setAlpha(100);

    builderAccVis.setSymbology(colorAccVis, ColorDef.black, 3);
    builderAccHid.setSymbology(colorAccHid, ColorDef.black, 1);

    builderAccVis.addRangeBox(range);
    builderAccHid.addRangeBox(range);

    context.addDecorationFromBuilder(builderAccVis);
    context.addDecorationFromBuilder(builderAccHid);
  }

  public decorateSuspended(context: DecorateContext): void { this.decorate(context); }
  public async onMouseMotion(ev: BeButtonEvent): Promise<void> { if (undefined !== this._corner && undefined !== ev.viewport) ev.viewport.invalidateDecorations(); }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;

    if (undefined !== this._corner) {
      const range = Range3d.create();
      const transform = Transform.createIdentity();
      if (!this.getClipRange(range, transform, ev))
        return EventHandled.No;
      ViewClipTool.enableClipVolume(this.targetView);
      if (!ViewClipTool.doClipToRange(this.targetView, range, transform))
        return EventHandled.No;
      if (undefined !== this._clipEventHandler)
        this._clipEventHandler.onNewClip(this.targetView);
      this.onReinitialize();
      return EventHandled.Yes;
    }

    this._corner = ev.point.clone();
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (undefined === this._corner)
      return false;
    this.onReinitialize();
    return true;
  }
}

/** @internal A tool to define a clip volume for a view by element(s) */
export class ViewClipByElementTool extends ViewClipTool {
  public static toolId = "ViewClip.ByElement";
  constructor(clipEventHandler?: ViewClipEventHandler, protected _alwaysUseRange: boolean = false) { super(clipEventHandler); }

  protected showPrompt(): void { this.outputPrompt("ByElement.Prompts.FirstPoint"); }

  public onPostInstall(): void {
    super.onPostInstall();
    if (undefined !== this.targetView && this.targetView.iModel.selectionSet.isActive) {
      let useSelection = true;
      this.targetView.iModel.selectionSet.elements.forEach((val) => { if (Id64.isInvalid(val) || Id64.isTransient(val)) useSelection = false; });
      if (useSelection) {
        this.doClipToSelectedElements(this.targetView); // tslint:disable-line:no-floating-promises
        return;
      }
    }
    this.initLocateElements(true, false, "default", CoordinateLockOverrides.All);
  }

  public async doClipToSelectedElements(viewport: Viewport): Promise<boolean> {
    if (await this.doClipToElements(viewport, viewport.iModel.selectionSet.elements, this._alwaysUseRange))
      return true;
    this.exitTool();
    return false;
  }

  protected async doClipToElements(viewport: Viewport, ids: Id64Arg, alwaysUseRange: boolean = false): Promise<boolean> {
    try {
      const elementProps = await viewport.iModel.elements.getProps(ids);
      if (0 === elementProps.length)
        return false;
      const range = new Range3d();
      const transform = Transform.createIdentity();
      for (const props of elementProps) {
        if (undefined === props.placement)
          continue;
        const hasAngle = (arg: any): arg is Placement2dProps => arg.angle !== undefined;
        const placement = hasAngle(props.placement) ? Placement2d.fromJSON(props.placement) : Placement3d.fromJSON(props.placement);
        if (!alwaysUseRange && 1 === elementProps.length) {
          range.setFrom(placement instanceof Placement2d ? Range3d.createRange2d(placement.bbox, 0) : placement.bbox);
          transform.setFrom(placement.transform); // Use ElementAlignedBox for single selection...
        } else {
          range.extendRange(placement.calculateRange());
        }
      }
      ViewClipTool.enableClipVolume(viewport);
      if (!ViewClipTool.doClipToRange(viewport, range, transform))
        return false;
      if (undefined !== this._clipEventHandler)
        this._clipEventHandler.onNewClip(viewport);
      this.onReinitialize();
      return true;
    } catch {
      return false;
    }
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.targetView)
      return EventHandled.No;
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (undefined === hit || !hit.isElementHit)
      return EventHandled.No;
    return await this.doClipToElements(this.targetView, hit.sourceId, this._alwaysUseRange) ? EventHandled.Yes : EventHandled.No;
  }
}

/** @internal Interactive tool base class to modify a view's clip */
export abstract class ViewClipModifyTool extends EditManipulator.HandleTool {
  protected _anchorIndex: number;
  protected _ids: string[];
  protected _controls: ViewClipControlArrow[];
  protected _clipView: Viewport;
  protected _clip: ClipVector;
  protected _viewRange: Range3d;
  protected _restoreClip: boolean = true;
  protected _currentDistance: number = 0.0;

  public constructor(manipulator: EditManipulator.HandleProvider, clip: ClipVector, vp: Viewport, hitId: string, ids: string[], controls: ViewClipControlArrow[]) {
    super(manipulator);
    this._anchorIndex = ids.indexOf(hitId);
    this._ids = ids;
    this._controls = controls;
    this._clipView = vp;
    this._clip = clip;
    this._viewRange = vp.computeViewRange();
  }

  protected init(): void {
    this.receivedDownEvent = true;
    this.initLocateElements(false, false, undefined, CoordinateLockOverrides.All); // Disable locate/snap/locks for control modification; overrides state inherited from suspended primitive...
    IModelApp.accuDraw.deactivate();
  }

  protected abstract updateViewClip(ev: BeButtonEvent, isAccept: boolean): boolean;
  protected abstract drawViewClip(context: DecorateContext): void;

  protected getOffsetValue(ev: BeButtonEvent, transformFromClip?: Transform): number | undefined {
    if (-1 === this._anchorIndex || undefined === ev.viewport || ev.viewport !== this._clipView)
      return undefined;

    // NOTE: Use AccuDraw z instead of view z if AccuDraw is explicitly enabled...
    const anchorRay = ViewClipTool.getClipRayTransformed(this._controls[this._anchorIndex].origin, this._controls[this._anchorIndex].direction, transformFromClip);
    const projectedPt = EditManipulator.HandleUtils.projectPointToLineInView(ev.point, anchorRay.origin, anchorRay.direction, ev.viewport, true);
    if (undefined === projectedPt)
      return undefined;

    const offsetVec = Vector3d.createStartEnd(anchorRay.origin, projectedPt);
    let offset = offsetVec.normalizeWithLength(offsetVec).mag;
    if (offset < Geometry.smallMetricDistance)
      return undefined;
    if (offsetVec.dotProduct(anchorRay.direction) < 0.0)
      offset *= -1.0;

    this._currentDistance = offset;
    return offset;
  }

  protected drawAnchorOffset(context: DecorateContext, color: ColorDef, weight: number, transformFromClip?: Transform): void {
    if (-1 === this._anchorIndex || Math.abs(this._currentDistance) < Geometry.smallMetricDistance)
      return;

    const anchorRay = ViewClipTool.getClipRayTransformed(this._controls[this._anchorIndex].origin, this._controls[this._anchorIndex].direction, transformFromClip);
    anchorRay.direction.scaleToLength(this._currentDistance, anchorRay.direction);
    const pt1 = anchorRay.fractionToPoint(0.0);
    const pt2 = anchorRay.fractionToPoint(1.0);
    const builder = context.createGraphicBuilder(GraphicType.ViewOverlay);

    context.viewport.worldToView(pt1, pt1); pt1.z = 0.0;
    context.viewport.worldToView(pt2, pt2); pt2.z = 0.0;

    builder.setSymbology(color, ColorDef.black, weight, LinePixels.Code5);
    builder.addLineString([pt1, pt2]);
    builder.setSymbology(color, ColorDef.black, weight + 7);
    builder.addPointString([pt1, pt2]);

    context.addDecorationFromBuilder(builder);
  }

  public decorate(context: DecorateContext): void {
    if (-1 === this._anchorIndex || context.viewport !== this._clipView)
      return;
    this.drawViewClip(context);
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (!this.updateViewClip(ev, false))
      return;
    this._clipView.invalidateDecorations();
  }

  protected accept(ev: BeButtonEvent): boolean {
    if (!this.updateViewClip(ev, true))
      return false;
    this._restoreClip = false;
    return true;
  }

  public onCleanup(): void {
    if (this._restoreClip && ViewClipTool.hasClip(this._clipView))
      ViewClipTool.setViewClip(this._clipView, this._clip);
  }
}

/** @internal Interactive tool to modify a view's clip defined by a ClipShape */
export class ViewClipShapeModifyTool extends ViewClipModifyTool {
  protected updateViewClip(ev: BeButtonEvent, _isAccept: boolean): boolean {
    const clipShape = ViewClipTool.isSingleClipShape(this._clip);
    if (undefined === clipShape)
      return false;

    const offset = this.getOffsetValue(ev, clipShape.transformFromClip);
    if (undefined === offset)
      return false;

    const offsetAll = ev.isShiftKey;
    const localOffset = ViewClipTool.getOffsetValueTransformed(offset, clipShape.transformToClip);
    const shapePts = ViewClipTool.getClipShapePoints(clipShape, 0.0);
    const adjustedPts: Point3d[] = [];
    for (let i = 0; i < shapePts.length; i++) {
      const prevFace = (0 === i ? shapePts.length - 2 : i - 1);
      const nextFace = (shapePts.length - 1 === i ? 0 : i);
      const prevSelected = offsetAll || (prevFace === this._anchorIndex || this.manipulator.iModel.selectionSet.has(this._ids[prevFace]));
      const nextSelected = offsetAll || (nextFace === this._anchorIndex || this.manipulator.iModel.selectionSet.has(this._ids[nextFace]));
      if (prevSelected && nextSelected) {
        const prevPt = shapePts[i].plusScaled(this._controls[prevFace].direction, localOffset);
        const nextPt = shapePts[i].plusScaled(this._controls[nextFace].direction, localOffset);
        const prevRay = Ray3d.create(prevPt, Vector3d.createStartEnd(shapePts[i === 0 ? shapePts.length - 2 : i - 1], shapePts[i]));
        const nextPlane = Plane3dByOriginAndUnitNormal.create(nextPt, this._controls[nextFace].direction);
        if (undefined === nextPlane || undefined === prevRay.intersectionWithPlane(nextPlane, prevPt))
          return false;
        adjustedPts[i] = prevPt;
      } else if (prevSelected) {
        adjustedPts[i] = shapePts[i].plusScaled(this._controls[prevFace].direction, localOffset);
      } else if (nextSelected) {
        adjustedPts[i] = shapePts[i].plusScaled(this._controls[nextFace].direction, localOffset);
      } else {
        adjustedPts[i] = shapePts[i];
      }
    }

    let zLow = clipShape.zLow;
    let zHigh = clipShape.zHigh;
    const zLowIndex = this._controls.length - 2;
    const zHighIndex = this._controls.length - 1;
    const zLowSelected = offsetAll || (zLowIndex === this._anchorIndex || this.manipulator.iModel.selectionSet.has(this._ids[zLowIndex]));
    const zHighSelected = offsetAll || (zHighIndex === this._anchorIndex || this.manipulator.iModel.selectionSet.has(this._ids[zHighIndex]));

    if (zLowSelected || zHighSelected) {
      const clipExtents = ViewClipTool.getClipShapeExtents(clipShape, this._viewRange);
      if (zLowSelected)
        zLow = clipExtents.low - localOffset;
      if (zHighSelected)
        zHigh = clipExtents.high + localOffset;
      const realZLow = (undefined === zLow ? clipExtents.low : zLow);
      const realZHigh = (undefined === zHigh ? clipExtents.high : zHigh);
      if (realZLow > realZHigh) { zLow = realZHigh; zHigh = realZLow; }
    }

    return ViewClipTool.doClipToShape(this._clipView, adjustedPts, clipShape.transformFromClip, zLow, zHigh);
  }

  protected drawViewClip(context: DecorateContext): void {
    const clip = this._clipView.view.getViewClip();
    if (undefined === clip)
      return;
    const clipShape = ViewClipTool.isSingleClipShape(clip);
    if (undefined === clipShape)
      return;
    const clipExtents = ViewClipTool.getClipShapeExtents(clipShape, this._viewRange);
    const color = ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor);
    ViewClipTool.drawClipShape(context, clipShape, clipExtents, color, 1);
    this.drawAnchorOffset(context, color, 1, clipShape.transformFromClip);
  }
}

/** @internal Interactive tool to modify a view's clip defined by a ConvexClipPlaneSet */
export class ViewClipPlanesModifyTool extends ViewClipModifyTool {
  protected updateViewClip(ev: BeButtonEvent, _isAccept: boolean): boolean {
    const offset = this.getOffsetValue(ev);
    if (undefined === offset)
      return false;

    const offsetAll = ev.isShiftKey;
    const planeSet = ConvexClipPlaneSet.createEmpty();
    for (let i: number = 0; i < this._controls.length; i++) {
      const selected = offsetAll || (i === this._anchorIndex || this.manipulator.iModel.selectionSet.has(this._ids[i]));
      const origin = this._controls[i].origin.clone();
      const direction = this._controls[i].direction;
      if (selected)
        origin.plusScaled(direction, offset, origin);
      planeSet.addPlaneToConvexSet(ClipPlane.createNormalAndPoint(direction.negate(), origin));
    }

    return ViewClipTool.doClipToConvexClipPlaneSet(this._clipView, planeSet);
  }

  protected drawViewClip(context: DecorateContext): void {
    const clip = this._clipView.view.getViewClip();
    if (undefined === clip)
      return;
    const clipPlanes = ViewClipTool.isSingleConvexClipPlaneSet(clip);
    if (undefined === clipPlanes)
      return;
    const clipPlanesLoops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(clipPlanes, this._viewRange, true, false, true);
    if (undefined === clipPlanesLoops)
      return;
    const color = ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor);
    ViewClipTool.drawClipPlanesLoops(context, clipPlanesLoops, color, 1);
    this.drawAnchorOffset(context, color, 1);
  }
}

/** @internal Modify handle data to modify a view's clip */
export class ViewClipControlArrow {
  public origin: Point3d;
  public direction: Vector3d;
  public sizeInches: number;
  public fill?: ColorDef;
  public outline?: ColorDef;
  public name?: string;

  public constructor(origin: Point3d, direction: Vector3d, sizeInches: number, fill?: ColorDef, outline?: ColorDef, name?: string) {
    this.origin = origin;
    this.direction = direction;
    this.sizeInches = sizeInches;
    this.fill = fill;
    this.outline = outline;
    this.name = name;
  }
}

/** @internal Controls to modify a view's clip */
export class ViewClipDecoration extends EditManipulator.HandleProvider {
  private static _decorator?: ViewClipDecoration;
  protected _clip?: ClipVector;
  protected _clipId?: string;
  protected _clipShape?: ClipShape;
  protected _clipShapeExtents?: Range1d;
  protected _clipPlanes?: ConvexClipPlaneSet;
  protected _clipPlanesLoops?: GeometryQuery[];
  protected _clipPlanesLoopsNoncontributing?: GeometryQuery[];
  protected _controlIds: string[] = [];
  protected _controls: ViewClipControlArrow[] = [];
  protected _suspendDecorator = false;
  protected _removeViewCloseListener?: () => void;

  public constructor(protected _clipView: Viewport, protected _clipEventHandler?: ViewClipEventHandler) {
    super(_clipView.iModel);
    if (!this.getClipData())
      return;
    this._clipId = this.iModel.transientIds.next;
    this.updateDecorationListener(true);
    this._removeViewCloseListener = IModelApp.viewManager.onViewClose.addListener(this.onViewClose, this);
    if (undefined !== this._clipEventHandler && this._clipEventHandler.selectOnCreate())
      this.iModel.selectionSet.replace(this._clipId);
  }

  public get clipId(): string | undefined { return this._clipId; }
  public get clipShape(): ClipShape | undefined { return this._clipShape; }
  public get clipPlaneSet(): ConvexClipPlaneSet | undefined { return this._clipPlanes; }
  public getControlIndex(id: string): number { return this._controlIds.indexOf(id); }

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
    if (this._clipView === vp)
      ViewClipDecoration.clear();
  }

  private getClipData(): boolean {
    this._clip = this._clipShape = this._clipShapeExtents = this._clipPlanes = this._clipPlanesLoops = this._clipPlanesLoopsNoncontributing = undefined;
    const clip = this._clipView.view.getViewClip();
    if (undefined === clip)
      return false;
    const clipShape = ViewClipTool.isSingleClipShape(clip);
    if (undefined !== clipShape) {
      this._clipShapeExtents = ViewClipTool.getClipShapeExtents(clipShape, this._clipView.computeViewRange());
      this._clipShape = clipShape;
    } else {
      const clipPlanes = ViewClipTool.isSingleConvexClipPlaneSet(clip);
      if (undefined === clipPlanes || clipPlanes.planes.length > 12)
        return false;
      const clipPlanesLoops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(clipPlanes, this._clipView.computeViewRange(), true, false, true);
      if (undefined !== clipPlanesLoops && clipPlanesLoops.length > clipPlanes.planes.length)
        return false;
      this._clipPlanesLoops = clipPlanesLoops;
      this._clipPlanes = clipPlanes;
    }
    this._clip = clip;
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
      this._controls[i] = new ViewClipControlArrow(faceCenter, faceNormal, shapePtsLo.length > 5 ? 0.5 : 0.75);
    }

    const zFillColor = ColorDef.from(150, 150, 250);
    this._controls[numControls - 2] = new ViewClipControlArrow(shapeArea.origin, Vector3d.unitZ(-1.0), 0.75, zFillColor, undefined, "zLow");
    this._controls[numControls - 1] = new ViewClipControlArrow(shapeArea.origin.plusScaled(Vector3d.unitZ(), shapePtsLo[0].distance(shapePtsHi[0])), Vector3d.unitZ(), 0.75, zFillColor, undefined, "zHigh");

    return true;
  }

  private getLoopCentroidAreaNormal(geom: GeometryQuery): Ray3d | undefined {
    if (!(geom instanceof Loop) || geom.children.length > 1)
      return undefined;
    const child = geom.getChild(0);
    if (!(child instanceof LineString3d))
      return undefined;
    return PolygonOps.centroidAreaNormal(child.points);
  }

  private createClipPlanesControls(): boolean {
    if (undefined === this._clipPlanes)
      return false;

    const loopData: Ray3d[] = [];
    if (undefined !== this._clipPlanesLoops) {
      for (const geom of this._clipPlanesLoops) {
        const loopArea = this.getLoopCentroidAreaNormal(geom);
        if (undefined !== loopArea)
          loopData.push(loopArea);
      }
    }

    const numControls = this._clipPlanes.planes.length;
    this.ensureNumControls(numControls);

    let viewRange;
    let iLoop: number = 0;
    for (let i: number = 0; i < this._clipPlanes.planes.length; i++) {
      const plane = this._clipPlanes.planes[i].getPlane3d();
      if (iLoop < loopData.length) {
        if (loopData[iLoop].direction.isParallelTo(plane.getNormalRef(), false) && plane.isPointInPlane(loopData[iLoop].origin)) {
          const outwardNormal = loopData[iLoop].direction.negate();
          this._controls[i] = new ViewClipControlArrow(loopData[iLoop].origin, outwardNormal, 0.75);
          iLoop++;
          continue;
        }
      }

      if (undefined === viewRange)
        viewRange = this._clipView.computeViewRange();

      const defaultOrigin = plane.projectPointToPlane(viewRange.center);
      const defaultOutwardNormal = plane.getNormalRef().negate();
      const expandedRange = viewRange.clone(); expandedRange.extend(defaultOrigin);
      const nonContribLoops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(ConvexClipPlaneSet.createPlanes([this._clipPlanes.planes[i]]), expandedRange, true, false, true);
      const nonContribColor = ColorDef.from(250, 100, 100);

      if (undefined !== nonContribLoops && nonContribLoops.length > 0) {
        if (undefined === this._clipPlanesLoopsNoncontributing)
          this._clipPlanesLoopsNoncontributing = nonContribLoops;
        else
          this._clipPlanesLoopsNoncontributing = this._clipPlanesLoopsNoncontributing.concat(nonContribLoops);
        const loopArea = this.getLoopCentroidAreaNormal(nonContribLoops[0]);
        if (undefined !== loopArea) {
          const outwardNormal = loopArea.direction.negate();
          this._controls[i] = new ViewClipControlArrow(loopArea.origin, outwardNormal, 0.5, nonContribColor);
          continue;
        }
      }

      this._controls[i] = new ViewClipControlArrow(defaultOrigin, defaultOutwardNormal, 0.5, nonContribColor); // Just show arrow for right-click menu options...
    }

    return true;
  }

  protected async createControls(): Promise<boolean> {
    // Always update to current view clip to handle post-modify, etc.
    if (undefined === this._clipId || !this.getClipData())
      return false;

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

    if (!showControls) {
      if (undefined !== this._clipEventHandler && this._clipEventHandler.clearOnDeselect())
        ViewClipDecoration.clear();
      return false;
    }

    if (undefined !== this._clipShape)
      return this.createClipShapeControls();
    else if (undefined !== this._clipPlanes)
      return this.createClipPlanesControls();

    return false;
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
      const clipShapeModifyTool = new ViewClipShapeModifyTool(this, this._clip, this._clipView, hit.sourceId, this._controlIds, this._controls);
      this._suspendDecorator = clipShapeModifyTool.run();
    } else if (undefined !== this._clipPlanes) {
      const clipPlanesModifyTool = new ViewClipPlanesModifyTool(this, this._clip, this._clipView, hit.sourceId, this._controlIds, this._controls);
      this._suspendDecorator = clipPlanesModifyTool.run();
    }
    if (this._suspendDecorator)
      IModelApp.toolAdmin.currentInputState.qualifiers = saveQualifiers; // onInstallTool cleared qualifiers, preserve for "modify all" behavior when shift was held and drag started...
    return this._suspendDecorator;
  }

  public doClipPlaneNegate(index: number): boolean {
    if (undefined === this._clipPlanes)
      return false;

    if (index < 0 || index >= this._clipPlanes.planes.length)
      return false;

    const planeSet = ConvexClipPlaneSet.createEmpty();
    for (let i: number = 0; i < this._clipPlanes.planes.length; i++) {
      const plane = (i === index ? this._clipPlanes.planes[i].cloneNegated() : this._clipPlanes.planes[i]);
      planeSet.addPlaneToConvexSet(plane);
    }

    if (!ViewClipTool.doClipToConvexClipPlaneSet(this._clipView, planeSet))
      return false;

    this.onManipulatorEvent(EditManipulator.EventType.Accept);
    return true;
  }

  public doClipPlaneClear(index: number): boolean {
    if (undefined === this._clipPlanes)
      return false;

    if (index < 0 || index >= this._clipPlanes.planes.length)
      return false;

    if (1 === this._clipPlanes.planes.length) {
      if (!ViewClipTool.doClipClear(this._clipView))
        return false;
      if (undefined !== this._clipEventHandler)
        this._clipEventHandler.onClearClip(this._clipView);
      ViewClipDecoration.clear();
      return true;
    }

    const planeSet = ConvexClipPlaneSet.createEmpty();
    for (let i: number = 0; i < this._clipPlanes.planes.length; i++) {
      if (i === index)
        continue;
      const plane = this._clipPlanes.planes[i];
      planeSet.addPlaneToConvexSet(plane);
    }

    if (!ViewClipTool.doClipToConvexClipPlaneSet(this._clipView, planeSet))
      return false;

    this.onManipulatorEvent(EditManipulator.EventType.Accept);
    return true;
  }

  public doClipPlaneOrientView(index: number): boolean {
    if (index < 0 || index >= this._controlIds.length)
      return false;

    const anchorRay = ViewClipTool.getClipRayTransformed(this._controls[index].origin, this._controls[index].direction, undefined !== this._clipShape ? this._clipShape.transformFromClip : undefined);
    const matrix = Matrix3d.createRigidHeadsUp(anchorRay.direction);
    const targetMatrix = matrix.multiplyMatrixMatrix(this._clipView.rotation);
    const rotateTransform = Transform.createFixedPointAndMatrix(anchorRay.origin, targetMatrix);
    const startFrustum = this._clipView.getFrustum();
    const newFrustum = startFrustum.clone();
    newFrustum.multiply(rotateTransform);
    this._clipView.animateFrustumChange(startFrustum, newFrustum);
    this._clipView.view.setupFromFrustum(newFrustum);
    this._clipView.synchWithView(true);
    return true;
  }

  private getWorldUpPlane(viewport: Viewport): Plane3dByOriginAndUnitNormal | undefined {
    const matrix = AccuDraw.getStandardRotation(StandardViewId.Top, viewport, viewport.isContextRotationRequired).inverse();
    if (undefined === matrix)
      return undefined;
    const worldUp = matrix.getColumn(2);
    const planePt = (viewport.isContextRotationRequired ? viewport.getAuxCoordOrigin() : (viewport.view.isSpatialView ? viewport.view.iModel.globalOrigin : Point3d.createZero()));
    return Plane3dByOriginAndUnitNormal.create(planePt, worldUp);
  }

  private isAlignedToWorldUpPlane(plane: Plane3dByOriginAndUnitNormal, transformFromClip?: Transform): boolean {
    const normal = (undefined !== transformFromClip ? transformFromClip.multiplyVector(Vector3d.unitZ()) : Vector3d.unitZ());
    return plane.getNormalRef().isParallelTo(normal, true);
  }

  public isClipShapeAlignedWithWorldUp(extents?: Range1d): boolean {
    if (undefined === this._clipShape)
      return false;

    const plane = this.getWorldUpPlane(this._clipView);
    if (undefined === plane || !this.isAlignedToWorldUpPlane(plane, this._clipShape.transformFromClip))
      return false;

    if (undefined === extents)
      return true;

    const zLow = Point3d.create(0.0, 0.0, this._clipShapeExtents!.low);
    const zHigh = Point3d.create(0.0, 0.0, this._clipShapeExtents!.high);

    if (undefined !== this._clipShape.transformFromClip) {
      this._clipShape.transformFromClip.multiplyPoint3d(zLow, zLow);
      this._clipShape.transformFromClip.multiplyPoint3d(zHigh, zHigh);
    }

    const lowDir = Vector3d.createStartEnd(plane.projectPointToPlane(zLow), zLow);
    const highDir = Vector3d.createStartEnd(plane.projectPointToPlane(zHigh), zHigh);
    let zLowWorld = lowDir.magnitude();
    let zHighWorld = highDir.magnitude();

    if (lowDir.dotProduct(plane.getNormalRef()) < 0.0)
      zLowWorld = -zLowWorld;
    if (highDir.dotProduct(plane.getNormalRef()) < 0.0)
      zHighWorld = -zHighWorld;

    Range1d.createXX(zLowWorld, zHighWorld, extents);
    return true;
  }

  public doClipShapeSetZExtents(extents: Range1d): boolean {
    if (extents.low > extents.high)
      return false;
    if (undefined === this._clipShape)
      return false;
    const plane = this.getWorldUpPlane(this._clipView);
    if (undefined === plane || !this.isAlignedToWorldUpPlane(plane, this._clipShape.transformFromClip))
      return false;

    const zLow = plane.getOriginRef().plusScaled(plane.getNormalRef(), extents.low);
    const zHigh = plane.getOriginRef().plusScaled(plane.getNormalRef(), extents.high);

    if (undefined !== this._clipShape.transformToClip) {
      this._clipShape.transformToClip.multiplyPoint3d(zLow, zLow);
      this._clipShape.transformToClip.multiplyPoint3d(zHigh, zHigh);
    }

    const reversed = (zLow.z > zHigh.z);
    const shape = ClipShape.createFrom(this._clipShape);
    shape.initSecondaryProps(shape.isMask, reversed ? zHigh.z : zLow.z, reversed ? zLow.z : zHigh.z, this._clipShape.transformFromClip);

    const clip = ClipVector.createEmpty();
    clip.appendReference(shape);

    if (!ViewClipTool.setViewClip(this._clipView, clip))
      return false;

    this.onManipulatorEvent(EditManipulator.EventType.Accept);
    return true;
  }

  protected async onRightClick(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this._clipEventHandler)
      return EventHandled.No;
    return (this._clipEventHandler.onRightClick(hit, ev) ? EventHandled.Yes : EventHandled.No);
  }

  protected async onTouchTap(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> { return (hit.sourceId === this._clipId ? EventHandled.No : super.onTouchTap(hit, ev)); }

  public onManipulatorEvent(eventType: EditManipulator.EventType): void {
    this._suspendDecorator = false;
    super.onManipulatorEvent(eventType);
    if (EditManipulator.EventType.Accept === eventType && undefined !== this._clipEventHandler)
      this._clipEventHandler.onModifyClip(this._clipView);
  }

  public testDecorationHit(id: string): boolean { return (id === this._clipId || this._controlIds.includes(id)); }
  public async getDecorationToolTip(hit: HitDetail): Promise<HTMLElement | string> { return (hit.sourceId === this._clipId ? "View Clip" : "Modify View Clip"); }
  protected updateDecorationListener(_add: boolean): void { super.updateDecorationListener(undefined !== this._clipId); } // Decorator isn't just for resize controls...

  public decorate(context: DecorateContext): void {
    if (this._suspendDecorator)
      return;

    if (undefined === this._clipId || undefined === this._clip)
      return;

    const vp = context.viewport;
    if (this._clipView !== vp)
      return;

    if (undefined !== this._clipShape) {
      ViewClipTool.drawClipShape(context, this._clipShape, this._clipShapeExtents!, ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor), 3, this._clipId);
    } else if (undefined !== this._clipPlanes) {
      if (undefined !== this._clipPlanesLoops)
        ViewClipTool.drawClipPlanesLoops(context, this._clipPlanesLoops, ColorDef.white.adjustForContrast(context.viewport.view.backgroundColor), 3, false, ColorDef.from(0, 255, 255, 225).adjustForContrast(context.viewport.view.backgroundColor), this._clipId);
      if (undefined !== this._clipPlanesLoopsNoncontributing)
        ViewClipTool.drawClipPlanesLoops(context, this._clipPlanesLoopsNoncontributing, ColorDef.red.adjustForContrast(context.viewport.view.backgroundColor), 1, true);
    }

    if (!this._isActive)
      return;

    const outlineColor = ColorDef.from(0, 0, 0, 50).adjustForContrast(vp.view.backgroundColor);
    const fillVisColor = ColorDef.from(150, 250, 200, 225).adjustForContrast(vp.view.backgroundColor);
    const fillHidColor = fillVisColor.clone(); fillHidColor.setAlpha(200);
    const fillSelColor = fillVisColor.invert(); fillSelColor.setAlpha(75);
    const shapePts = EditManipulator.HandleUtils.getArrowShape(0.0, 0.15, 0.55, 1.0, 0.3, 0.5, 0.1);

    for (let iFace = 0; iFace < this._controlIds.length; iFace++) {
      const sizeInches = this._controls[iFace].sizeInches;
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

  public static get(vp: Viewport): ViewClipDecoration | undefined {
    if (undefined === ViewClipDecoration._decorator || vp !== ViewClipDecoration._decorator._clipView)
      return undefined;
    return ViewClipDecoration._decorator;
  }

  public static create(vp: Viewport, clipEventHandler?: ViewClipEventHandler): string | undefined {
    if (undefined !== ViewClipDecoration._decorator)
      ViewClipDecoration.clear();
    if (!ViewClipTool.hasClip(vp))
      return undefined;
    ViewClipDecoration._decorator = new ViewClipDecoration(vp, clipEventHandler);
    return ViewClipDecoration._decorator.clipId;
  }

  public static clear(): void {
    if (undefined === ViewClipDecoration._decorator)
      return;
    ViewClipDecoration._decorator.stop();
    ViewClipDecoration._decorator = undefined;
  }

  public static toggle(vp: Viewport, clipEventHandler?: ViewClipEventHandler): string | undefined {
    let clipId: string | undefined;
    if (undefined === ViewClipDecoration._decorator)
      clipId = ViewClipDecoration.create(vp, clipEventHandler);
    else
      ViewClipDecoration.clear();
    IModelApp.toolAdmin.startDefaultTool();
    return clipId;
  }
}

/** @internal */
export enum ActiveClipStatus { None, Unsaved, Saved, Modified }

/** @internal */
export interface SavedClipProps { clip: ClipVector; name?: string; }

/** @internal */
export interface SavedClipCache { clip?: ClipVector; name?: string; shared: boolean; modified: boolean; }

/** @internal */
export interface SavedClipEntry { id: GuidString; name?: string; shared: boolean; }

/** @internal Support for saving clip information as user or project settings */
export class ViewClipSettingsProvider {
  private _activeClips = new Map<number, GuidString>(); // Map of viewportId to saved clip id...
  private _cachedClips = new Map<GuidString, SavedClipCache>(); // Map of clip id to clip data + status
  public namespace = "imodeljs-NamedClipVectors";
  public appSpecific = false;

  constructor(protected _clipEventHandler?: ViewClipEventHandler) { }

  protected async getRequestContext() { return AuthorizedFrontendRequestContext.create(); }
  protected getProjectId(iModel: IModelConnection): string | undefined { return iModel.iModelToken.contextId; }
  protected getiModelId(iModel: IModelConnection): string | undefined { return iModel.iModelToken.iModelId; }

  protected async getAllSettings(iModel: IModelConnection, shared: boolean): Promise<SettingsMapResult> {
    const requestContext = await this.getRequestContext();
    if (shared)
      return IModelApp.settings.getSettingsByNamespace(requestContext, this.namespace, this.appSpecific, this.getProjectId(iModel), this.getiModelId(iModel));
    return IModelApp.settings.getUserSettingsByNamespace(requestContext, this.namespace, this.appSpecific, this.getProjectId(iModel), this.getiModelId(iModel));
  }

  protected async getSetting(iModel: IModelConnection, shared: boolean, existingId: GuidString): Promise<SettingsResult> {
    const requestContext = await this.getRequestContext();
    if (shared)
      return IModelApp.settings.getSetting(requestContext, this.namespace, existingId, this.appSpecific, this.getProjectId(iModel), this.getiModelId(iModel));
    return IModelApp.settings.getUserSetting(requestContext, this.namespace, existingId, this.appSpecific, this.getProjectId(iModel), this.getiModelId(iModel));
  }

  protected async saveSetting(iModel: IModelConnection, shared: boolean, existingId: GuidString, settings: SavedClipProps): Promise<SettingsResult> {
    const requestContext = await this.getRequestContext();
    if (shared)
      return IModelApp.settings.saveSetting(requestContext, settings, this.namespace, existingId, this.appSpecific, this.getProjectId(iModel), this.getiModelId(iModel));
    return IModelApp.settings.saveUserSetting(requestContext, settings, this.namespace, existingId, this.appSpecific, this.getProjectId(iModel), this.getiModelId(iModel));
  }

  protected async deleteSetting(iModel: IModelConnection, shared: boolean, existingId: GuidString): Promise<SettingsResult> {
    const requestContext = await this.getRequestContext();
    if (shared)
      return IModelApp.settings.deleteSetting(requestContext, this.namespace, existingId, this.appSpecific, this.getProjectId(iModel), this.getiModelId(iModel));
    return IModelApp.settings.deleteUserSetting(requestContext, this.namespace, existingId, this.appSpecific, this.getProjectId(iModel), this.getiModelId(iModel));
  }

  protected async getCachedSetting(iModel: IModelConnection, shared: boolean, existingId: GuidString): Promise<SavedClipCache> {
    const existing = this._cachedClips.get(existingId);
    if (undefined !== existing && shared === existing.shared)
      return existing;
    const cacheEntry: SavedClipCache = (undefined === existing ? { shared, modified: false } : existing);
    this._cachedClips.set(existingId, cacheEntry); // Insert invalid entry to avoid repeated failures...
    try {
      const result = await this.getSetting(iModel, shared, existingId);
      if (SettingsStatus.Success === result.status) {
        cacheEntry.clip = ClipVector.fromJSON(result.setting.clip);
        cacheEntry.name = result.setting.name;
        cacheEntry.shared = shared;
        return cacheEntry;
      }
      return cacheEntry;
    } catch (error) {
      return cacheEntry;
    }
  }

  protected async newCachedSetting(iModel: IModelConnection, shared: boolean, newId: GuidString, settings: SavedClipProps): Promise<SettingsStatus> {
    try {
      const result = await this.saveSetting(iModel, shared, newId, settings);
      if (SettingsStatus.Success === result.status)
        this._cachedClips.set(newId, { clip: settings.clip, name: settings.name, shared, modified: false });
      return result.status;
    } catch (error) {
      return SettingsStatus.AuthorizationError;
    }
  }

  protected async updateCachedSetting(iModel: IModelConnection, shared: boolean, existingId: GuidString, settings: SavedClipProps): Promise<SettingsStatus> {
    const existing = await this.getCachedSetting(iModel, shared, existingId);
    if (undefined === existing.clip)
      return SettingsStatus.SettingNotFound;
    try {
      if (undefined === settings.name)
        settings.name = existing.name; // Preserve name when called to update clip...
      const result = await this.saveSetting(iModel, existing.shared, existingId, settings);
      if (SettingsStatus.Success === result.status)
        this._cachedClips.set(existingId, { clip: settings.clip, name: settings.name, shared: existing.shared, modified: false });
      return result.status;
    } catch (error) {
      return SettingsStatus.AuthorizationError;
    }
  }

  protected async deleteCachedSetting(iModel: IModelConnection, shared: boolean, existingId: GuidString): Promise<SettingsStatus> {
    try {
      const result = await this.deleteSetting(iModel, shared, existingId);
      if (SettingsStatus.Success === result.status)
        this._cachedClips.delete(existingId);
      return result.status;
    } catch (error) {
      return SettingsStatus.AuthorizationError;
    }
  }

  protected async renameCachedSetting(iModel: IModelConnection, shared: boolean, existingId: GuidString, name: string): Promise<SettingsStatus> {
    const existing = await this.getCachedSetting(iModel, shared, existingId);
    if (undefined === existing.clip)
      return SettingsStatus.SettingNotFound;
    else if (name === existing.name)
      return SettingsStatus.Success;
    try {
      const result = await this.saveSetting(iModel, existing.shared, existingId, { clip: existing.clip, name });
      if (SettingsStatus.Success === result.status)
        this._cachedClips.set(existingId, { clip: existing.clip, name, shared: existing.shared, modified: false });
      return result.status;
    } catch (error) {
      return SettingsStatus.AuthorizationError;
    }
  }

  protected async shareCachedSetting(iModel: IModelConnection, existingId: GuidString, newShared: boolean): Promise<SettingsStatus> {
    const existing = await this.getCachedSetting(iModel, !newShared, existingId);
    if (undefined === existing.clip)
      return SettingsStatus.SettingNotFound;
    else if (existing.shared === newShared)
      return SettingsStatus.Success;
    try {
      const status = await this.newCachedSetting(iModel, newShared, existingId, { clip: existing.clip, name: existing.name });
      if (SettingsStatus.Success === status)
        await this.deleteSetting(iModel, !newShared, existingId);
      return status;
    } catch (error) {
      return SettingsStatus.AuthorizationError;
    }
  }

  protected validateActiveClipId(viewport: Viewport): void {
    const activeId = this.getActiveClipId(viewport);
    if (undefined !== activeId) {
      const current = viewport.view.getViewClip();
      const active = this._cachedClips.get(activeId);
      if (undefined === current || undefined === active || undefined === active.clip || !ViewClipTool.areClipsEqual(current, active.clip))
        return this.clearActiveClipId(viewport);
    }
    this.purgeActiveClipIdCache();
  }

  protected purgeActiveClipIdCache(): void {
    if (this._cachedClips.size <= this._activeClips.size)
      return;
    const usedCache = new Map<GuidString, SavedClipCache>(); // Purge cache entries not currently being referenced by a view...
    this._activeClips.forEach((usedId) => { const usedEntry = this._cachedClips.get(usedId); if (undefined !== usedEntry) usedCache.set(usedId, usedEntry); });
    this._cachedClips = usedCache;
  }

  public getActiveClipId(viewport: Viewport): GuidString | undefined {
    return this._activeClips.get(viewport.viewportId);
  }

  /** @internal */
  public setActiveClipId(viewport: Viewport, existingId: GuidString): void {
    this._activeClips.set(viewport.viewportId, existingId);
    this.purgeActiveClipIdCache();
  }

  /** @internal */
  public clearActiveClipId(viewport: Viewport): void {
    this._activeClips.delete(viewport.viewportId);
    this.purgeActiveClipIdCache();
  }

  /** @internal */
  public clearActiveClipIdAllViews(): void {
    this._activeClips.clear();
    this._cachedClips.clear();
  }

  /** @internal */
  public modifiedActiveClip(viewport: Viewport): boolean {
    const activeId = this.getActiveClipId(viewport);
    if (undefined === activeId)
      return false;
    const clip = viewport.view.getViewClip();
    if (undefined === clip)
      return false; // Expected onClearClip...
    const existing = this._cachedClips.get(activeId);
    if (undefined === existing)
      return false;
    existing.modified = true; // Mark cache as changed from saved state. User must choose to update, create new, or discard the changes...
    existing.clip = clip;
    return true;
  }

  public async getSettings(settings: SavedClipEntry[], iModel: IModelConnection, shared?: boolean): Promise<SettingsStatus> {
    let userStatus = SettingsStatus.Success;
    let sharedStatus = SettingsStatus.Success;
    if (undefined === shared || !shared) {
      try {
        const userResult = await this.getAllSettings(iModel, false);
        if (SettingsStatus.Success === userResult.status && undefined !== userResult.settingsMap) {
          for (const [key, value] of userResult.settingsMap) {
            settings.push({ id: key, name: value.name, shared: false });
          }
        }
        userStatus = userResult.status;
      } catch (error) {
        userStatus = SettingsStatus.AuthorizationError;
      }
    }
    if (undefined === shared || shared) {
      try {
        const sharedResult = await this.getAllSettings(iModel, true);
        if (SettingsStatus.Success === sharedResult.status && undefined !== sharedResult.settingsMap) {
          for (const [key, value] of sharedResult.settingsMap) {
            settings.push({ id: key, name: value.name, shared: true });
          }
        }
        sharedStatus = sharedResult.status;
      } catch (error) {
        sharedStatus = SettingsStatus.AuthorizationError;
      }
    }
    if (userStatus === sharedStatus)
      return userStatus;
    else if (SettingsStatus.SettingNotFound === userStatus)
      return sharedStatus;
    else if (SettingsStatus.SettingNotFound === sharedStatus)
      return userStatus;
    else if (SettingsStatus.Success === userStatus)
      return sharedStatus;
    else if (SettingsStatus.Success === sharedStatus)
      return userStatus;
    return userStatus;
  }

  public async getClip(iModel: IModelConnection, shared: boolean, existingId: GuidString): Promise<ClipVector | undefined> {
    const existing = await this.getCachedSetting(iModel, shared, existingId);
    if (undefined === existing.clip || !existing.clip.isValid)
      return undefined;
    return existing.clip;
  }

  public async newClip(iModel: IModelConnection, shared: boolean, clip: ClipVector, name?: string): Promise<GuidString | undefined> {
    const newId = Guid.createValue();
    if (SettingsStatus.Success === await this.newCachedSetting(iModel, shared, newId, { clip, name }))
      return newId;
    return undefined;
  }

  public async copyClip(iModel: IModelConnection, shared: boolean, existingId: GuidString, copyShared: boolean, name?: string): Promise<GuidString | undefined> {
    const existingClip = await this.getClip(iModel, shared, existingId);
    if (undefined === existingClip)
      return undefined;
    return this.newClip(iModel, copyShared, existingClip, name);
  }

  public async replaceClip(iModel: IModelConnection, shared: boolean, existingId: GuidString, clip: ClipVector): Promise<SettingsStatus> {
    return this.updateCachedSetting(iModel, shared, existingId, { clip }); // NOTE: Current name will be preserved when passing undefined...
  }

  public async deleteClip(iModel: IModelConnection, shared: boolean, existingId: GuidString): Promise<SettingsStatus> {
    return this.deleteCachedSetting(iModel, shared, existingId);
  }

  public async renameClip(iModel: IModelConnection, shared: boolean, existingId: GuidString, name: string): Promise<SettingsStatus> {
    return this.renameCachedSetting(iModel, shared, existingId, name);
  }

  public async shareClip(iModel: IModelConnection, existingId: GuidString, newShare: boolean): Promise<SettingsStatus> {
    return this.shareCachedSetting(iModel, existingId, newShare);
  }

  public async saveActiveClip(viewport: Viewport, shared: boolean, name?: string): Promise<GuidString | undefined> {
    const clip = viewport.view.getViewClip();
    if (undefined === clip)
      return undefined;
    const activeId = this.getActiveClipId(viewport);
    if (undefined === activeId) {
      const newId = await this.newClip(viewport.iModel, shared, clip, name);
      if (undefined !== newId)
        this.setActiveClipId(viewport, newId);
      return newId;
    } else {
      const active = this._cachedClips.get(activeId);
      if (undefined === active || !active.modified)
        return activeId;
      if (active.shared !== shared)
        return undefined;
      const status = await this.replaceClip(viewport.iModel, active.shared, activeId, clip);
      return (SettingsStatus.Success === status ? activeId : undefined);
    }
  }

  public async activateSavedClip(viewport: Viewport, id: GuidString, shared: boolean, interactive: boolean = true): Promise<SettingsStatus> {
    const activeId = this.getActiveClipId(viewport);
    if (id === activeId)
      return SettingsStatus.Success; // Already active...
    let existingClip = await this.getClip(viewport.iModel, shared, id);
    if (undefined === existingClip) {
      // NOTE: For non-interactive call to apply a saved view, shared flag should be based on saved view's setting...
      //       A shared saved view should never reference a user's saved clip.
      //       A user's saved view can reference a saved clip (or a user's saved clip that was later changed to shared).
      //       The saved view is not required to store the shared flag for the save clip.
      if (interactive || shared)
        return SettingsStatus.SettingNotFound;
      existingClip = await this.getClip(viewport.iModel, true, id);
      if (undefined === existingClip)
        return SettingsStatus.SettingNotFound;
    }
    if (!ViewClipTool.setViewClip(viewport, existingClip))
      return SettingsStatus.UnknownError;
    this.setActiveClipId(viewport, id);
    if (undefined !== this._clipEventHandler)
      this._clipEventHandler.onActivateClip(viewport, interactive);
    return SettingsStatus.Success;
  }

  public async activateSavedClipPlanes(viewport: Viewport, ids: GuidString[], shared: boolean[]): Promise<SettingsStatus> {
    if (ids.length < 2 || ids.length !== shared.length)
      return SettingsStatus.UnknownError;
    const planeSet = ConvexClipPlaneSet.createEmpty();
    for (let iPlane = 0; iPlane < ids.length; iPlane++) {
      const existingClip = await this.getClip(viewport.iModel, shared[iPlane], ids[iPlane]);
      if (undefined === existingClip)
        return SettingsStatus.SettingNotFound;
      const plane = ViewClipTool.isSingleClipPlane(existingClip);
      if (undefined === plane)
        return SettingsStatus.UnknownError;
      planeSet.addPlaneToConvexSet(plane);
    }
    if (!ViewClipTool.doClipToConvexClipPlaneSet(viewport, planeSet))
      return SettingsStatus.UnknownError;
    this.clearActiveClipId(viewport);
    if (undefined !== this._clipEventHandler)
      this._clipEventHandler.onActivateClip(viewport, true);
    return SettingsStatus.Success;
  }

  public async areSavedClipPlanes(iModel: IModelConnection, ids: GuidString[], shared: boolean[]): Promise<boolean> {
    if (ids.length !== shared.length)
      return false;
    for (let iPlane = 0; iPlane < ids.length; iPlane++) {
      const existingClip = await this.getClip(iModel, shared[iPlane], ids[iPlane]);
      if (undefined === existingClip)
        return false;
      const plane = ViewClipTool.isSingleClipPlane(existingClip);
      if (undefined === plane)
        return false;
    }
    return true;
  }

  public getActiveClipStatus(viewport: Viewport): ActiveClipStatus {
    this.validateActiveClipId(viewport);
    if (undefined === viewport.view.getViewClip())
      return ActiveClipStatus.None;
    const activeId = this.getActiveClipId(viewport);
    if (undefined === activeId)
      return ActiveClipStatus.Unsaved;
    const active = this._cachedClips.get(activeId);
    if (undefined === active)
      return ActiveClipStatus.Unsaved;
    return (active.modified ? ActiveClipStatus.Modified : ActiveClipStatus.Saved);
  }
}

/** @internal Event types for ViewClipDecorationProvider.onActiveClipChanged */
export enum ClipEventType { New, NewPlane, Modify, Clear, Activate }

/** @internal An implementation of ViewClipEventHandler that responds to new clips by presenting clip modification handles */
export class ViewClipDecorationProvider implements ViewClipEventHandler {
  private static _provider?: ViewClipDecorationProvider;
  protected _settings?: ViewClipSettingsProvider;
  public selectDecorationOnCreate = true;
  public clearDecorationOnDeselect = true;

  /** Called when the active clip for a view is changed */
  public readonly onActiveClipChanged = new BeEvent<(viewport: Viewport, eventType: ClipEventType, provider: ViewClipDecorationProvider) => void>();

  /** Called on a right click over the clip geometry or clip modify handle. ViewClipDecoration provides methods for the following possible menu actions:
   * For ClipPlanes (undefined !== clipPlaneSet): Flip (doClipPlaneNegate), Clear (doClipPlaneClear), and Orient View (doClipPlaneOrientView)
   * For ClipShapes (undefined === clipPlaneSet): Orient View (doClipPlaneOrientView) and input fields to set world zLow/zHigh (doClipShapeSetZExtents provided isClipShapeAlignedWithWorldUp returns true)
   */
  public readonly onActiveClipRightClick = new BeEvent<(hit: HitDetail, ev: BeButtonEvent, provider: ViewClipDecorationProvider) => void>();

  /** Call to check if named clip settings have been enabled. Can use before calling settings.getActiveClipId to avoid creating settings */
  public get hasSettings(): boolean { return (undefined !== this._settings); }

  /** Call to allow saving the active clip as a setting or to set the active clip from a previously saved setting */
  public get settings(): ViewClipSettingsProvider { if (undefined === this._settings) this._settings = new ViewClipSettingsProvider(this); return this._settings; }

  public selectOnCreate(): boolean { return this.selectDecorationOnCreate; }
  public clearOnDeselect(): boolean { return this.clearDecorationOnDeselect; }

  public onNewClip(viewport: Viewport): void {
    ViewClipDecoration.create(viewport, this);
    if (undefined !== this._settings)
      this._settings.clearActiveClipId(viewport);
    this.onActiveClipChanged.raiseEvent(viewport, ClipEventType.New, this);
  }

  public onNewClipPlane(viewport: Viewport): void {
    ViewClipDecoration.create(viewport, this);
    if (undefined !== this._settings)
      this._settings.clearActiveClipId(viewport);
    this.onActiveClipChanged.raiseEvent(viewport, ClipEventType.NewPlane, this);
  }

  public onModifyClip(viewport: Viewport): void {
    if (undefined !== this._settings)
      this._settings.modifiedActiveClip(viewport);
    this.onActiveClipChanged.raiseEvent(viewport, ClipEventType.Modify, this);
  }

  public onClearClip(viewport: Viewport): void {
    ViewClipDecoration.clear();
    if (undefined !== this._settings)
      this._settings.clearActiveClipId(viewport);
    this.onActiveClipChanged.raiseEvent(viewport, ClipEventType.Clear, this);
  }

  public onActivateClip(viewport: Viewport, interactive: boolean): void {
    if (interactive)
      ViewClipDecoration.create(viewport, this);
    else
      ViewClipDecoration.clear();
    this.onActiveClipChanged.raiseEvent(viewport, ClipEventType.Activate, this);
  }

  public onRightClick(hit: HitDetail, ev: BeButtonEvent): boolean {
    const decoration = (undefined !== ev.viewport ? ViewClipDecoration.get(ev.viewport) : undefined);
    if (undefined === decoration)
      return false;
    if (0 === this.onActiveClipRightClick.numberOfListeners)
      return decoration.doClipPlaneNegate(decoration.getControlIndex(hit.sourceId));
    this.onActiveClipRightClick.raiseEvent(hit, ev, this);
    return true;
  }

  public showDecoration(vp: Viewport): void { ViewClipDecoration.create(vp, this); }
  public hideDecoration(): void { ViewClipDecoration.clear(); }
  public toggleDecoration(vp: Viewport): void { ViewClipDecoration.toggle(vp, this); }

  public static create(): ViewClipDecorationProvider {
    if (undefined === ViewClipDecorationProvider._provider) {
      ViewClipDecoration.clear();
      ViewClipDecorationProvider._provider = new ViewClipDecorationProvider();
    }
    return ViewClipDecorationProvider._provider;
  }

  public static clear(): void {
    if (undefined === ViewClipDecorationProvider._provider)
      return;
    ViewClipDecoration.clear();
    ViewClipDecorationProvider._provider = undefined;
  }
}
