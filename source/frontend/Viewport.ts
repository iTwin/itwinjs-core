/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Vector3d, XYZ, Point3d, Range3d, RotMatrix, Transform, Point2d } from "@bentley/geometry-core/lib/PointVector";
import { Map4d } from "@bentley/geometry-core/lib/numerics/Geometry4d";
import { AxisOrder, Angle } from "@bentley/geometry-core/lib/Geometry";
import { ViewState, Frustum, ViewStatus, Npc, NpcCenter, NpcCorners } from "../common/ViewState";
import { Constant } from "@bentley/geometry-core/lib/Constant";
import { ElementAlignedBox2d } from "../common/geometry/Primitives";
import { BeDuration, BeTimePoint } from "@bentley/bentleyjs-core/lib/Time";

// tslint:disable:no-empty

export class ViewRect extends ElementAlignedBox2d {
  public get width() { return super.width + 1; }
  public get height() { return super.height + 1; }
  public get aspect() { return this.width / this.height; }
  public get area() { return this.width * this.height; }

  public initFromPoint3ds(low: Point3d, high: Point3d): void {
    this.low.x = low.x;
    this.low.y = low.y;
    this.high.x = high.x;
    this.high.y = high.y;
  }
  public initFromRange3d(input: Range3d): void { this.initFromPoint3ds(input.low, input.high); }
}

export class DepthRangeNpc {
  public minimum: number = 0;
  public maximum: number = 1.0;
  public middle(): number { return this.minimum + ((this.maximum - this.minimum) / 2.0); }
}

/** Enumeration of possible coordinate system types */
export const enum CoordSystem {
  Screen = 0,  // Coordinates are relative to the origin of the screen
  View = 1,    // Coordinates are relative to the origin of the view
  Npc = 2,     // Coordinates are relative to normalized plane coordinates.
  World = 3,   // Coordinates are relative to the world coordinate system for the physical elements in the DgnDb
}

/** object to animate frustum transition of a viewport */
class Animator {
  private currFrustum = new Frustum();
  private startTime?: BeTimePoint;

  public constructor(public totalTime: BeDuration, public viewport: Viewport, public startFrustum: Frustum, public endFrustum: Frustum) { }

  public interpolateFrustum(fraction: number) {
    for (let i = 0; i < Npc.CORNER_COUNT; ++i) {
      this.startFrustum.points[i].interpolate(fraction, this.endFrustum.points[i], this.currFrustum.points[i]);
    }
    this.viewport.setupFromFrustum(this.currFrustum);
  }

  private moveToTime(time: number) {
    const fraction = time / this.totalTime.milliseconds;
    this.interpolateFrustum(fraction);
  }

  /** return true when finished */
  public animate(): boolean {
    const currTime = BeTimePoint.now();
    if (!this.startTime)
      this.startTime = currTime;

    const totalTime = this.totalTime;
    const endTime = this.startTime.milliseconds + totalTime.milliseconds;

    if (endTime <= currTime.milliseconds) {
      this.moveToTime(totalTime.milliseconds);
      return true;
    }

    let done = false;
    let index = currTime.milliseconds - this.startTime.milliseconds;
    if (index > totalTime.milliseconds) {
      done = true;
      index = totalTime.milliseconds;
    }

    this.moveToTime(index);
    return done;
  }

  public interrupt() {
    if (this.startTime) {
      // We've been interrupted after animation began. Skip to the final animation state
      this.moveToTime(this.totalTime.milliseconds);
    }
  }
}
/**
 * A Viewport maps a set of one or more Models to an output device. It holds a ViewState that defines
 * the viewing parameters.
 */
export abstract class Viewport {
  private zClipAdjusted = false;    // were the view z clip planes adjusted due to front/back clipping off?
  public viewOrg: Point3d;       // view origin, potentially expanded
  public viewDelta: Vector3d;     // view delta, potentially expanded
  public viewOrgUnexpanded: Point3d;     // view origin (from ViewState, un-expanded)
  public viewDeltaUnexpanded: Vector3d;  // view delta (from ViewState, un-expanded)
  public rotMatrix: RotMatrix;           // rotation matrix (from ViewState)
  private rootToView: Map4d;
  private rootToNpc: Map4d;
  public view: ViewState;
  private viewRange: ViewRect = new ViewRect();
  private viewCorners: Range3d = new Range3d();
  private animator?: Animator;
  private _viewCmdTargetCenter?: Point3d;
  public frustFraction: number = 1.0;
  public maxUndoSteps = 20;
  private forwardStack: ViewState[] = [];
  private backStack: ViewState[] = [];
  private currentBaseline?: ViewState;
  private static nearScale24 = 0.0003; // max ratio of frontplane to backplane distance for 24 bit zbuffer
  private static get2dFrustumDepth() { return Constant.oneMeter; }
  public abstract getViewSize(): Point2d;
  public get pixelsPerInch() { /* ###TODO: This is apparently unobtainable information in a browser... */ return 96; }

  public get viewCmdTargetCenter(): Point3d | undefined { return this._viewCmdTargetCenter; }
  public set viewCmdTargetCenter(center: Point3d | undefined) { this._viewCmdTargetCenter = center ? center.clone() : undefined; }

  public isCameraOn(): boolean { return this.view.is3d() && this.view.isCameraOn(); }
  public invalidateDecorations() { }
  public toView(pt: XYZ): void {
    const x = pt.x;
    const y = pt.y;
    const z = pt.z;
    const coffs = this.rotMatrix.coffs;
    pt.x = (coffs[0] * x + coffs[1] * y + coffs[2] * z);
    pt.y = (coffs[3] * x + coffs[4] * y + coffs[5] * z);
    pt.z = (coffs[6] * x + coffs[7] * y + coffs[8] * z);
  }

  public fromView(pt: XYZ): void {
    const x = pt.x;
    const y = pt.y;
    const z = pt.z;
    const coffs = this.rotMatrix.coffs;
    pt.x = (coffs[0] * x + coffs[3] * y + coffs[6] * z);
    pt.y = (coffs[1] * x + coffs[4] * y + coffs[7] * z);
    pt.z = (coffs[2] * x + coffs[5] * y + coffs[8] * z);
  }

  /** adjust the front and back planes to encompass the entire viewed volume */
  private adjustZPlanes(): void {
    const view = this.view;
    if (!view.is3d()) // only necessary for 3d views
      return;

    let extents = view.getViewedExtents() as Range3d;
    if (extents.isNull())
      return;

    const origin = this.viewOrg;
    const delta = this.viewDelta;
    const rotMatrix = this.rotMatrix;

    // convert viewed extents in world coordinates to min/max in view aligned coordinates
    const viewTransform = Transform.createOriginAndMatrix(Point3d.createZero(), rotMatrix);
    const extFrust = Frustum.fromRange(extents);
    extFrust.multiply(viewTransform);
    extents = extFrust.toRange();

    this.toView(origin);       // put origin in view coordinates
    origin.z = extents.low.z;           // set origin to back of viewed extents
    delta.z = extents.high.z - origin.z; // and delta to front of viewed extents
    this.fromView(origin);

    if (!view.isCameraOn())
      return;

    // if the camera is on, we need to make sure that the viewed volume is not behind the eye
    const eyeOrg = view.camera.getEyePoint().minus(origin);
    this.toView(eyeOrg);

    // if the distance from the eye to origin in less than 1 meter, move the origin away from the eye. Usually, this means
    // that the camera is outside the viewed extents and pointed away from it. There's nothing to see anyway.
    if (eyeOrg.z < 1.0) {
      this.toView(origin);
      origin.z -= (2.0 - eyeOrg.z);
      this.fromView(origin);
      delta.z = 1.0;
      return;
    }

    // if part of the viewed extents are behind the eye, don't include that.
    if (delta.z > eyeOrg.z)
      delta.z = eyeOrg.z;
  }

  private validateCamera() {
    const view = this.view;
    if (!view.is3d())
      return;

    const camera = view.camera;
    camera.validateLens();
    if (camera.isFocusValid())
      return;

    const vDelta = view.getExtents();
    const maxDelta = vDelta.x > vDelta.y ? vDelta.x : vDelta.y;
    let focusDistance = maxDelta / (2.0 * Math.tan(camera.getLensAngle().radians / 2.0));

    if (focusDistance < vDelta.z / 2.0)
      focusDistance = vDelta.z / 2.0;

    const eyePoint = new Point3d(vDelta.x / 2.0, vDelta.y / 2.0, (vDelta.z / 2.0) + focusDistance);

    this.toView(eyePoint);
    eyePoint.plus(view.getOrigin());

    camera.setEyePoint(eyePoint);
    camera.setFocusDistance(focusDistance);
  }

  private static fullRangeNpc = new Range3d(0, 1, 0, 1, 0, 1); // full range of view
  private static depthRect = new ViewRect();
  public determineVisibleDepthNpc(subRectNpc?: Range3d | undefined, result?: DepthRangeNpc): DepthRangeNpc | undefined {
    subRectNpc = subRectNpc ? subRectNpc : Viewport.fullRangeNpc;

    // Determine screen rectangle in which to query visible depth min + max
    const viewRect = Viewport.depthRect;
    viewRect.initFromPoint3ds(this.npcToView(subRectNpc.low), this.npcToView(subRectNpc.high));
    return this.pickRange(viewRect, result);
  }

  /** Computes the range of depth values for a region of the screen
   * @param origin the top-left corner of the region in screen coordinates
   * @param extents the width (x) and height (y) of the region in screen coordinates
   * @returns the minimum and maximum depth values within the region, or undefined.
   */
  public pickRange(_rect: ViewRect, _result?: DepthRangeNpc): DepthRangeNpc | undefined {
    return undefined;
  }

  private static scratchDefaultRotatePointLow = new Point3d(.5, .5, .5);
  private static scratchDefaultRotatePointHigh = new Point3d(.5, .5, .5);
  public determineDefaultRotatePoint(result?: Point3d): Point3d {
    result = result ? result : new Point3d();
    const view = this.view;
    const depth = this.determineVisibleDepthNpc();

    // if there are no elements in the view and the camera is on, use the camera target point
    if (!depth && view.is3d() && view.isCameraOn())
      return view.getTargetPoint(result);

    Viewport.scratchDefaultRotatePointLow.z = depth ? depth.minimum : 0;
    Viewport.scratchDefaultRotatePointHigh.z = depth ? depth.maximum : 1.0;
    return Viewport.scratchDefaultRotatePointLow.interpolate(.5, Viewport.scratchDefaultRotatePointHigh, result);
  }

  public getFocusPlaneNpc(): number {
    const cameraTarget = this.view.getTargetPoint();
    let npcZ = this.worldToNpc(cameraTarget, cameraTarget).z;
    if (npcZ < 0.0 || npcZ > 1.0) {
      Viewport.scratchDefaultRotatePointHigh.z = 1.0;
      Viewport.scratchDefaultRotatePointLow.z = 0.0;
      const npcLow = this.npcToWorld(Viewport.scratchDefaultRotatePointLow);
      const npcHigh = this.npcToWorld(Viewport.scratchDefaultRotatePointHigh);
      const center = npcLow.interpolate(0.5, npcHigh);
      npcZ = this.worldToNpc(center, center).z;
    }

    return npcZ;
  }

  public turnCameraOn(lensAngle: Angle): ViewStatus {
    const view = this.view;
    if (!view.is3d())
      return ViewStatus.InvalidViewport;

    if (view.isCameraOn())
      return view.lookAtUsingLensAngle(view.getEyePoint(), view.getTargetPoint(), view.getYVector(), lensAngle);

    // We need to figure out a new camera target. To do that, we need to know where the geometry is in the view.
    // We use the depth of the center of the view for that.
    let depthRange = this.determineVisibleDepthNpc();
    if (!depthRange)
      depthRange = new DepthRangeNpc();
    const middle = depthRange.middle();
    const corners = [
      new Point3d(0.0, 0.0, middle), // lower left, at target depth
      new Point3d(1.0, 1.0, middle), // upper right at target depth
      new Point3d(0.0, 0.0, depthRange.maximum), // lower left, at closest npc
      new Point3d(1.0, 1.0, depthRange.maximum), // upper right at closest
    ];

    this.npcToWorldArray(corners);

    const eye = corners[2].interpolate(0.5, corners[3]); // middle of closest plane
    const target = corners[0].interpolate(0.5, corners[1]); // middle of halfway plane
    const backDist = eye.distance(target) * 2.0;
    const frontDist = view.minimumFrontDistance();
    return view.lookAtUsingLensAngle(eye, target, view.getYVector(), lensAngle, frontDist, backDist);
  }

  /* get the extents of this view, in ViewCoordinates, as a Range3d */
  private getViewCorners(): Range3d {
    const corners = this.viewCorners;
    const viewRect = this.viewRect;
    corners.high.x = viewRect.high.x;
    corners.low.y = viewRect.high.y;    // y's are swapped on the screen!
    corners.low.x = 0;
    corners.high.y = 0;
    corners.low.z = -32767;
    corners.high.z = 32767;
    return corners;
  }

  private calcNpcToView(): Map4d {
    const corners = this.getViewCorners();
    return Map4d.createBoxMap(NpcCorners[Npc._000], NpcCorners[Npc._111], corners.low, corners.high)!;
  }

  /** adjust the aspect ratio of the view volume to match the aspect ratio of the window of this Viewport. */
  private adjustAspectRatio() {
    const origin = this.viewOrg;
    const delta = this.viewDelta;
    const windowAspect = this.viewRect.aspect * this.view.getAspectRatioSkew();
    const viewAspect = delta.x / delta.y;

    if (Math.abs(1.0 - (viewAspect / windowAspect)) < 1.0e-9)
      return;

    const oldDelta = delta.clone();
    if (viewAspect > windowAspect)
      delta.y = delta.x / windowAspect;
    else
      delta.x = delta.y * windowAspect;

    this.toView(origin);
    origin.x += ((oldDelta.x - delta.x) / 2.0);
    origin.y += ((oldDelta.y - delta.y) / 2.0);
    this.fromView(origin);
  }

  /** Ensure the rotation matrix for this view is aligns the root z with the view out (i.e. a "2d view"). */
  private alignWithRootZ() {
    const zUp = Vector3d.unitZ();
    if (zUp.isAlmostEqual(this.rotMatrix.rowZ()))
      return;
    const r = this.rotMatrix.transpose();
    r.setColumn(2, zUp);
    RotMatrix.createPerpendicularUnitColumnsFromRotMatrix(r, AxisOrder.XYZ, r);
    r.transpose(this.rotMatrix);
  }

  /** get the rectangle of this Viewport in ViewCoordinates. */
  public get viewRect(): ViewRect { const r = this.viewRange; const size = this.getViewSize(); r.high.x = size.x; r.high.y = size.y; return r; }

  /** True if an undoable viewing operation exists on the stack */
  public get isUndoPossible() { return 0 < this.backStack.length; }

  /** True if an redoable viewing operation exists on the stack */
  public get isRedoPossible() { return 0 < this.forwardStack.length; }

  /** clear the view-undo buffers of this Viewport */
  public clearUndo() {
    this.currentBaseline = undefined;
    this.forwardStack.length = 0;
    this.backStack.length = 0;
  }

  /** Set up this Viewport from its ViewState */
  public setupFromView(): ViewStatus {
    const view = this.view;
    if (!view)
      return ViewStatus.InvalidViewport;

    const origin = view.getOrigin().clone();
    const delta = view.getExtents().clone();
    this.viewOrg = origin;
    this.viewDelta = delta;
    this.rotMatrix = view.getRotation().clone();

    // first, make sure none of the deltas are negative
    delta.x = Math.abs(delta.x);
    delta.y = Math.abs(delta.y);
    delta.z = Math.abs(delta.z);

    this.adjustAspectRatio();

    this.viewOrgUnexpanded = origin.clone();
    this.viewDeltaUnexpanded = delta.clone();
    this.zClipAdjusted = false;

    if (view.is3d()) {
      if (!view.allow3dManipulations()) {
        // we're in a "2d" view of a physical model. That means that we must have our orientation with z out of the screen with z=0 at the center.
        this.alignWithRootZ(); // make sure we're in a z Up view

        const extents = view.getViewedExtents();
        if (extents.isNull()) {
          extents.low.z = -Viewport.get2dFrustumDepth();
          extents.high.z = Viewport.get2dFrustumDepth();
        }

        let zMax = Math.max(Math.abs(extents.low.z), Math.abs(extents.high.z));
        zMax = Math.max(zMax, 1.0); // make sure we have at least +-1m. Data may be purely planar
        delta.z = 2.0 * zMax;
        origin.z = -zMax;
      } else {
        this.validateCamera();
        this.adjustZPlanes(); // make sure view volume includes entire volume of view

        // if the camera is on, don't allow front plane behind camera
        if (view.isCameraOn()) {
          const eyeOrg = view.camera.getEyePoint().minus(origin); // vector from eye to origin
          this.toView(eyeOrg);

          const frontDist = eyeOrg.z - delta.z; // front distance is backDist - delta.z

          // allow ViewState to specify a minimum front dist, but in no case less than 6 inches
          const minFrontDist = Math.max(15.2 * Constant.oneCentimeter, view.forceMinFrontDist());
          if (frontDist < minFrontDist) {
            // camera is too close to front plane, move origin away from eye to maintain a minimum front distance.
            this.toView(origin);
            origin.z -= (minFrontDist - frontDist);
            this.fromView(origin);
          }
        }

        // if we moved the z planes, set the "zClipAdjusted" flag.
        if (!origin.isExactEqual(this.viewOrgUnexpanded) || !delta.isExactEqual(this.viewDeltaUnexpanded))
          this.zClipAdjusted = true;
      }
    } else { // 2d viewport
      this.alignWithRootZ();
      delta.z = 2. * Viewport.get2dFrustumDepth();
      origin.z = -Viewport.get2dFrustumDepth();
    }

    const frustFraction = this.rootToNpcFromViewDef(this.rootToNpc, origin, delta);
    if (!frustFraction)
      return ViewStatus.InvalidViewport;

    this.frustFraction = frustFraction;
    this.rootToView = this.calcNpcToView().multiplyMapMap(this.rootToNpc);
    return ViewStatus.Success;
  }

  /** compute the root-to-npc map given an origin and delta. View orientation and camera comes from member variables. */
  private rootToNpcFromViewDef(rootToNpc: Map4d, inOrigin: Point3d, delta: Vector3d): number | undefined {
    const view = this.view;
    const viewRot = this.rotMatrix;
    const xVector = viewRot.rowX();
    const yVector = viewRot.rowY();
    const zVector = viewRot.rowZ();
    const origin = inOrigin.clone();

    let frustFraction = 1.0;
    let xExtent: Vector3d;
    let yExtent: Vector3d;
    let zExtent: Vector3d;

    // Compute root vectors along edges of view frustum.
    if (view.is3d() && view.isCameraOn()) {
      const camera = view.camera;
      const eyeToOrigin = inOrigin.minus(camera.eye);      // vector from origin on backplane to eye
      this.toView(eyeToOrigin);                            // align with view coordinates.

      const focusDistance = camera.focusDistance;
      let zDelta = delta.z;
      let zBack = eyeToOrigin.z;              // Distance from eye to backplane.
      let zFront = zBack + zDelta;            // Distance from eye to frontplane.

      if (zFront / zBack < Viewport.nearScale24) {
        const maximumBackClip = 10000. * Constant.oneKilometer;
        if (-zBack > maximumBackClip) {
          zBack = -maximumBackClip;
          eyeToOrigin.z = zBack;
        }

        zFront = zBack * Viewport.nearScale24;
        zDelta = zFront - eyeToOrigin.z;
      }

      // z out back of eye ====> origin z coordinates are negative.  (Back plane more negative than front plane)
      const backFraction = -zBack / focusDistance;    // Perspective fraction at back clip plane.
      const frontFraction = -zFront / focusDistance;  // Perspective fraction at front clip plane.
      frustFraction = frontFraction / backFraction;

      // delta.x,delta.y are view rectangle sizes at focus distance.  Scale to back plane:
      xExtent = xVector.scale(delta.x * backFraction);   // xExtent at back == delta.x * backFraction.
      yExtent = yVector.scale(delta.y * backFraction);   // yExtent at back == delta.y * backFraction.

      // Calculate the zExtent in the View coordinate system.
      zExtent = new Vector3d(eyeToOrigin.x * (frontFraction - backFraction), // eyeToOrigin.x * frontFraction - eyeToOrigin.x * backFraction
        eyeToOrigin.y * (frontFraction - backFraction), // eyeToOrigin.y * frontFraction - eyeToOrigin.y * backFraction
        zDelta);
      this.fromView(zExtent);   // rotate back to root coordinates.

      origin.x = eyeToOrigin.x * backFraction;      // Calculate origin in eye coordinates.
      origin.y = eyeToOrigin.y * backFraction;
      origin.z = eyeToOrigin.z;
      this.fromView(origin);  // Rotate back to root coordinates
      origin.plus(camera.eye, origin); // Add the eye point.
    } else {
      xExtent = xVector.scale(delta.x);
      yExtent = yVector.scale(delta.y);
      zExtent = zVector.scale(delta.z);
    }

    // calculate the root-to-npc mapping (using expanded frustum)
    const newRootToNpc = Map4d.createVectorFrustum(origin, xExtent, yExtent, zExtent, frustFraction);
    if (!newRootToNpc)
      return undefined;

    rootToNpc.setFrom(newRootToNpc);  // Don't screw this up if we are returning ERROR (TR# 251771).
    return frustFraction;
  }

  private saveViewUndo(): void {
    const curr = this.view.clone<ViewState>();
    if (!this.currentBaseline) {
      this.currentBaseline = curr;
      return;
    }

    if (curr.equals(this.currentBaseline))
      return; // nothing changed

    if (this.backStack.length >= this.maxUndoSteps)
      this.backStack.shift();

    this.backStack.push(this.currentBaseline);
    this.forwardStack.length = 0;

    // now update our baseline to match the current settings.
    this.currentBaseline = curr;
  }

  public synchWithView(saveInUndo: boolean): void {
    this.setupFromView();

    if (saveInUndo)
      this.saveViewUndo();
  }

  public viewToNpcArray(pts: Point3d[]) {
    const corners = this.getViewCorners();
    const scrToNpcTran = Transform.createIdentity();
    Transform.initFromRange(corners.low, corners.high, undefined, scrToNpcTran);
    scrToNpcTran.multiplyPoint3dArrayInPlace(pts);
  }

  public npcToViewArray(pts: Point3d[]) {
    const corners = this.getViewCorners();
    const scrToNpcTran = Transform.createIdentity();
    Transform.initFromRange(corners.low, corners.high, scrToNpcTran, undefined);
    scrToNpcTran.multiplyPoint3dArrayInPlace(pts);
  }

  public viewToNpc(pt: Point3d, out?: Point3d) {
    const corners = this.getViewCorners();
    const scrToNpcTran = Transform.createIdentity();
    Transform.initFromRange(corners.low, corners.high, undefined, scrToNpcTran);
    return scrToNpcTran.multiplyPoint(pt, out);
  }

  public npcToView(pt: Point3d, out?: Point3d) {
    const corners = this.getViewCorners();
    const scrToNpcTran = Transform.createIdentity();
    Transform.initFromRange(corners.low, corners.high, scrToNpcTran, undefined);
    return scrToNpcTran.multiplyPoint(pt, out);
  }
  public worldToNpcArray(pts: Point3d[]) { this.rootToNpc.transform0Ref().multiplyPoint3dArrayQuietNormalize(pts); }
  public npcToWorldArray(pts: Point3d[]) { this.rootToNpc.transform1Ref().multiplyPoint3dArrayQuietNormalize(pts); }
  public worldToViewArray(pts: Point3d[]) { this.rootToView.transform0Ref().multiplyPoint3dArrayQuietNormalize(pts); }
  public viewToWorldArray(pts: Point3d[]) { this.rootToView.transform1Ref().multiplyPoint3dArrayQuietNormalize(pts); }
  public worldToNpc(pt: Point3d, out?: Point3d) { return this.rootToNpc.transform0Ref().multiplyPoint3dQuietNormalize(pt, out); }
  public npcToWorld(pt: Point3d, out?: Point3d) { return this.rootToNpc.transform1Ref().multiplyPoint3dQuietNormalize(pt, out); }
  public worldToView(input: Point3d, out?: Point3d) { return this.rootToView.transform0Ref().multiplyPoint3dQuietNormalize(input, out); }
  public viewToWorld(input: Point3d, out?: Point3d) { return this.rootToView.transform1Ref().multiplyPoint3dQuietNormalize(input, out); }

  /** Converts inches to pixels based on screen DPI.
   * @Note this information may not be accurate in some browsers.
   * @param inches the number of inches to convert
   * @returns the corresponding number of pixels
   */
  public pixelsFromInches(inches: number): number { return inches * this.pixelsPerInch; }

  /**
   * Get an 8-point frustum corresponding to the 8 corners of the Viewport in the specified coordinate system.
   * There are two sets of corners that may be of interest.
   * The "adjusted" box is the one that is computed by examining the "project extents" and moving
   * the front and back planes to enclose everything in the view [N.B. this is the way that views implement
   * the concept of "no front/back clipping", since there always must be a view frustum]. The "unadjusted" box is
   * the one that is stored in the ViewState.
   * @param[in] sys Coordinate system for \c points
   * @param[in] adjustedBox If true, retrieve the adjusted box. Otherwise retrieve the box that came from the view definition.
   * @return the view frustum
   * @note The "adjusted" box may be either larger or smaller than the "unadjusted" box.
   */
  public getFrustum(sys: CoordSystem = CoordSystem.World, adjustedBox: boolean = true, box?: Frustum): Frustum {
    box = box ? box.initNpc() : new Frustum();

    // if they are looking for the "unexpanded" (that is before f/b clipping expansion) box, we need to get the npc
    // coordinates that correspond to the unexpanded box in the npc space of the Expanded view (that's the basis for all
    // of the root-based maps.)
    if (!adjustedBox && this.zClipAdjusted) {
      // to get unexpanded box, we have to go recompute rootToNpc from original viewController.
      const ueRootToNpc = Map4d.createIdentity();
      const compression = this.rootToNpcFromViewDef(ueRootToNpc, this.viewOrgUnexpanded, this.viewDeltaUnexpanded);
      if (!compression)
        return box;

      // get the root corners of the unexpanded box
      const ueRootBox = new Frustum();
      ueRootToNpc.transform1Ref().multiplyPoint3dArrayQuietNormalize(ueRootBox.points);

      // and convert them to npc coordinates of the expanded view
      this.worldToNpcArray(box.points);
    }

    // now convert from NPC space to the specified coordinate system.
    switch (sys) {
      case CoordSystem.View:
        this.npcToViewArray(box.points);
        break;

      case CoordSystem.World:
        this.npcToWorldArray(box.points);
        break;
    }
    return box;
  }

  public getWorldFrustum(box?: Frustum): Frustum { return this.getFrustum(CoordSystem.World, true, box); }

  /**
   * scroll the view by a given number of pixels.
   * @param screenDist distance to scroll in pixels
   */
  public scroll(screenDist: Point2d): ViewStatus {
    const view = this.view;
    if (!view)
      return ViewStatus.InvalidViewport;

    if (view.is3d() && view.isCameraOn()) {
      const offset = new Vector3d(screenDist.x, screenDist.y, 0.0);
      const frust = this.getFrustum(CoordSystem.View, false)!;
      frust.translate(offset);
      this.viewToWorldArray(frust.points);

      view.setupFromFrustum(frust);
      view.centerEyePoint();
      return this.setupFromView();
    }

    const pts = [new Point3d(), new Point3d(screenDist.x, screenDist.y, 0)];
    this.viewToWorldArray(pts);
    const dist = pts[1].minus(pts[0]);
    const newOrg = view.getOrigin().plus(dist);
    view.setOrigin(newOrg);

    return this.setupFromView();
  }

  /**
   * Zoom the view by a scale factor, placing the new center at the projection of the given point (world coordinates)
   * on the focal plane.
   * Updates ViewState and re-synchs Viewport.
   */
  public zoom(newCenter: Point3d | undefined, factor: number): ViewStatus {
    const view = this.view;
    if (!view)
      return ViewStatus.InvalidViewport;

    if (view.is3d() && view.isCameraOn()) {
      const centerNpc = newCenter ? this.worldToNpc(newCenter) : NpcCenter.clone();
      const scaleTransform = Transform.createFixedPointAndMatrix(centerNpc, RotMatrix.createScale(factor, factor, 1.0));

      const offset = centerNpc.minus(NpcCenter); // offset by difference of old/new center
      offset.z = 0.0;     // z center stays the same.

      const offsetTransform = Transform.createTranslationXYZ(offset.x, offset.y, offset.z);
      const product = offsetTransform.multiplyTransformTransform(scaleTransform);

      const frust = new Frustum();
      product.multiplyPoint3dArrayInPlace(frust.points);

      this.npcToWorldArray(frust.points);
      view.setupFromFrustum(frust);
      view.centerEyePoint();
      return this.setupFromView();
    }

    // for non-camera views, do the zooming by adjusting the origin and delta directly so there can be no
    // chance of the rotation changing due to numerical precision errors calculating it from the frustum corners.
    const delta = view.getExtents().clone();
    delta.x *= factor;
    delta.y *= factor;

    // first check to see whether the zoom operation results in an invalid view. If so, make sure we don't change anything
    const validSize = view.validateViewDelta(delta, false);
    if (ViewStatus.Success !== validSize)
      return validSize;

    const center = newCenter ? newCenter : view.getCenter();

    if (!view.allow3dManipulations())
      center.z = 0.0;

    const newOrg = view.getOrigin().clone();
    this.toView(newOrg);
    this.toView(center);

    view.setExtents(delta);

    newOrg.x = center.x - delta.x / 2.0;
    newOrg.y = center.y - delta.y / 2.0;
    this.fromView(newOrg);
    view.setOrigin(newOrg);

    return this.setupFromView();
  }

  /**
   * Set up this Viewport's viewing parameters based on a Frustum
   * @param inFrustum the new viewing frustum
   * @returns true if successful
   */
  public setupFromFrustum(inFrustum: Frustum): boolean {
    const validSize = this.view.setupFromFrustum(inFrustum);
    if (!this.setupFromView())
      return false;

    return validSize === ViewStatus.Success;
  }

  public resetUndo() {
    // Clear the undo stack
    this.clearUndo();

    // Set up new baseline state
    this.saveViewUndo();

    // Notify event listeners
    // this.historyChanged.raiseEvent();
  }

  public computeViewRange(): Range3d {
    this.setupFromView();
    const viewRange = new Range3d();
    // // NB: This is the range of all models currently in the scene. Doesn't account for toggling display of categories.
    // const geomRange = this.geometry.range;
    // const geomMatrix = this.geometry.modelMatrix;
    // geomMatrix.multiply(geomRange.low);
    // geomMatrix.multiply(geomRange.high);
    // const center = geomRange.getCenter();
    // const high = geomRange.high;
    // const delta = Cartesian3.fromDifferenceOf(high, center);

    // //addDebugRange(this, center, delta);

    // const geomScale = Matrix3.fromScaleFactors(delta.x, delta.y, delta.z);
    // const modelMatrix = Matrix4.fromRotationTranslation(geomScale, center);

    // const scaleFactor = 1.0;
    // const range = new Range3(new Cartesian3(-scaleFactor, -scaleFactor, -scaleFactor), new Cartesian3(scaleFactor, scaleFactor, scaleFactor));
    // modelMatrix.multiplyByPoint(range.low, range.low);
    // modelMatrix.multiplyByPoint(range.high, range.high);

    // const rangeBox = range.get8Corners();
    // this.rotMatrix.multiplyArray(rangeBox);

    // const viewRange = Range3.fromArray(rangeBox);
    return viewRange;
  }

  /**
   * Reverts the most recent change to the Viewport from the undo stack.
   */
  public applyPrevious(animationTime: BeDuration) {
    const size = this.backStack.length;
    if (0 === size)
      return;

    this.forwardStack.push(this.currentBaseline!);
    this.currentBaseline = this.backStack[size - 1];
    this.backStack.pop();

    this.applyViewState(this.currentBaseline, animationTime);
    // this.historyApplied.raiseEvent(true);
  }

  /**
   * Reverts the most recently un-done change to the Viewport from the redo stack
   */
  public applyNext(animationTime: BeDuration) {
    const size = this.forwardStack.length;
    if (0 === size)
      return;

    this.backStack.push(this.currentBaseline!);
    this.currentBaseline = this.forwardStack[size - 1];
    this.forwardStack.pop();

    this.applyViewState(this.currentBaseline, animationTime);
    // this.historyApplied.raiseEvent(false);
  }

  public animate() {
    if (this.animator && this.animator.animate()) {
      this.animator = undefined;
    }
  }

  public removeAnimator() {
    if (this.animator) {
      this.animator.interrupt(); // will be destroyed
      this.animator = undefined;
    }
  }

  private setAnimator(animator: Animator) {
    this.removeAnimator();
    this.animator = animator;
  }

  public animateFrustumChange(start: Frustum, end: Frustum, animationTime: BeDuration) {
    if (0.0 >= animationTime.milliseconds) {
      this.setupFromFrustum(end);
      return;
    }

    this.setAnimator(new Animator(animationTime, this, start, end));
  }

  public applyViewState(val: ViewState, animationTime: BeDuration) {
    const startFrust = this.getFrustum();
    this.view = val.clone();
    this.synchWithView(false);
    //    this._changeFov = true;
    this.animateFrustumChange(startFrust!, this.getFrustum()!, animationTime);
  }

  public pickEntity(_mousePos: Point3d, _radius: number, _result?: Point3d): Point3d | undefined {
    return undefined;
  }

  /**
   * Converts an {x,y} position in screen coordinates to world coordinates by picking against
   * the depth buffer.
   * @param  mousePos the position in screen coordinates
   * @param result optional output point
   * @param enforceGeometryPicks optional, if set to true picks that aren't on tileset geometry return undefined
   * @return the corresponding position in world coordinates, or undefined if no value exists in the depth buffer for the specified point
   */
  public pickDepthBuffer(_mousePos: Point3d, _result?: Point3d, _enforceGeometryPicks?: boolean): Point3d | undefined {
    // var depthIntersection;
    // if (this.scene.pickPositionSupported) {
    //   depthIntersection = this.scene.pickPosition(mousePos, scratchDepthBufferIntersection);
    // }

    // if (!Cesium.defined(depthIntersection))
    //   return undefined;

    // if (enforceGeometryPicks) {
    //   let isTilesetGeometry = this.pickEntity(mousePos) instanceof Cesium.Cesium3DTileFeature
    //   if (!isTilesetGeometry)
    //     return undefined
    // }

    // var npcPt = this.worldToNpc(depthIntersection, scratchDepthNpcPt);
    // var viewPt = this.npcToView(npcPt);
    // viewPt.x = mousePos.x;
    // viewPt.y = mousePos.y;
    // this.viewToWorld(viewPt, depthIntersection);

    // return depthIntersection;
    return undefined;
  }
}
