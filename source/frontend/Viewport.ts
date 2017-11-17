/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Vector3d, XYZ, Point3d, Range3d, RotMatrix, Transform, Point2d } from "@bentley/geometry-core/lib/PointVector";
import { Map4d } from "@bentley/geometry-core/lib/numerics/Geometry4d";
import { AxisOrder } from "@bentley/geometry-core/lib/Geometry";
import { ViewState, Frustum, ViewStatus, Npc, NpcCorners, NpcCenter } from "../common/ViewState";
import { Constant } from "@bentley/geometry-core/lib/Constant";
import { ElementAlignedBox2d } from "../common/ElementGeometry";

export class ViewRect extends ElementAlignedBox2d {
  public get width() { return super.width + 1; }
  public get height() { return super.height + 1; }
  public get aspect() { return this.width / this.height; }
  public get area() { return this.width * this.height; }
}

/** Enumeration of possible coordinate system types */
export const enum CoordSystem {
  Screen = 0,  // Coordinates are relative to the origin of the screen
  View = 1,    // Coordinates are relative to the origin of the view
  Npc = 2,     // Coordinates are relative to normalized plane coordinates.
  World = 3,   // Coordinates are relative to the world coordinate system for the physical elements in the DgnDb
}

export class Duration {
  public constructor(public milliseconds: number = 0) { }
  public get seconds() { return this.milliseconds / 1000; }
  public isZero() { return this.milliseconds === 0; }
  public isTowardsFuture() { return this.milliseconds > 0; }
  public isTowardsPast() { return this.milliseconds < 0; }
  public minus(other: Duration) { return new Duration(this.milliseconds - other.milliseconds); }
}

/** object to animate frustum transition of a viewport */
class Animator {
  private currFrustum = new Frustum();
  private startTime = 0;

  public constructor(public totalTime: Duration, public viewport: Viewport, public startFrustum: Frustum, public endFrustum: Frustum) { }

  public interpolateFrustum(fraction: number) {
    for (let i = 0; i < Npc.CORNER_COUNT; i++) {
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
    const currTime = Date.now();
    if (!this.startTime)
      this.startTime = currTime;

    const totalTime = this.totalTime;
    const endTime = this.startTime + totalTime.milliseconds;

    if (endTime <= currTime) {
      this.moveToTime(totalTime.milliseconds);
      return true;
    }

    let done = false;
    let index = currTime - this.startTime;
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
  private viewOrg: Point3d;       // view origin, potentially expanded
  private viewDelta: Vector3d;     // view delta, potentially expanded
  private viewOrgUnexpanded: Point3d;     // view origin (from ViewState, un-expanded)
  private viewDeltaUnexpanded: Vector3d;  // view delta (from ViewState, un-expanded)
  private rotMatrix: RotMatrix;           // rotation matrix (from ViewState)
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

  private toView(pt: XYZ): void {
    const x = pt.x;
    const y = pt.y;
    const z = pt.z;
    const coffs = this.rotMatrix.coffs;
    pt.x = (coffs[0] * x + coffs[1] * y + coffs[2] * z);
    pt.y = (coffs[3] * x + coffs[4] * y + coffs[5] * z);
    pt.z = (coffs[6] * x + coffs[7] * y + coffs[8] * z);
  }

  private fromView(pt: XYZ): void {
    const x = pt.x;
    const y = pt.y;
    const z = pt.z;
    const coffs = this.rotMatrix.coffs;
    pt.x = (coffs[0] * x + coffs[3] * y + coffs[6] * z);
    pt.y = (coffs[1] * x + coffs[4] * y + coffs[7] * z);
    pt.z = (coffs[2] * x + coffs[4] * y + coffs[8] * z);
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

  /** save the current ViewState in the view undo buffer, if it has changed since the last time this function was called. */
  private saveViewUndo() {
    const curr = this.view.clone();
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

  public synchWithView(saveInUndo: boolean) {
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

  /** Converts inches to pixels based on screen DPI.Note that this information may not be accurate in some browsers.
   * @param  inches the number of inches
   * @returns the corresponding number of pixels
   */
  public pixelsFromInches(inches: number) {
    return inches * this.pixelsPerInch;
  }


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

  public getWorldFrustum(box?: Frustum) { return this.getFrustum(CoordSystem.World, true, box); }

  /** scroll the view by a given number of pixels. */
  public scroll(screenDist: Point2d) { // => distance to scroll in pixels
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
   * Zoom the view by a scale factor, placing the new center at the projection of the given point (root coordinates)
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

  /**
   * Reverts the most recent change to the Viewport from the undo stack.
   */
  public applyPrevious(animationTime: Duration) {
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
  public applyNext(animationTime: Duration) {
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

  public setAnimator(animator: Animator) {
    this.removeAnimator();
    this.animator = animator;
  }

  private animateFrustumChange(start: Frustum, end: Frustum, animationTime: Duration) {
    if (0.0 >= animationTime.milliseconds) {
      this.setupFromFrustum(end);
      return;
    }

    this.setAnimator(new Animator(animationTime, this, start, end));
  }

  public applyViewState(val: ViewState, animationTime: Duration) {
    const startFrust = this.getFrustum();
    this.view = val.clone();
    this.synchWithView(false);
    //    this._changeFov = true;
    this.animateFrustumChange(startFrust!, this.getFrustum()!, animationTime);
  }

}
