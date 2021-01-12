/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import {
  AxisOrder, ClipPlaneContainment, Constant, Map4d, Matrix3d, Point3d, Point4d, Range1d, Range2d, Range3d, Transform, Vector3d, XYAndZ, XYZ,
} from "@bentley/geometry-core";
import { Frustum, Npc, NpcCorners } from "@bentley/imodeljs-common";
import { ApproximateTerrainHeights } from "./ApproximateTerrainHeights";
import { CoordSystem } from "./CoordSystem";
import { Viewport } from "./Viewport";
import { ViewRect } from "./ViewRect";
import { ViewState } from "./ViewState";
import { Frustum2d } from "./Frustum2d";

/** Describes a [[Viewport]]'s viewing volume, plus its size on the screen. A new
 * instance of ViewingSpace is created every time the Viewport's camera or volume changes.
 * @beta
 */
export class ViewingSpace {
  private readonly _viewRange = new ViewRect(); // scratch variable
  private readonly _viewCorners = new Range3d(); // scratch variable

  /** @internal */
  public frustFraction = 1.0;
  /** Maximum ratio of frontplane to backplane distance for 24 bit non-logarithmic zbuffer
   * @internal
   */
  public static nearScaleNonLog24 = 0.0003;
  /** Maximum fraction of frontplane to backplane distance for 24 bit logarithmic zbuffer
   * @internal
   */
  public static nearScaleLog24 = 1.0E-8;
  /** View origin, potentially expanded */
  public readonly viewOrigin = new Point3d();
  /** View delta, potentially expanded */
  public readonly viewDelta = new Vector3d();
  /** View origin (from ViewState, unexpanded) */
  public readonly viewOriginUnexpanded = new Point3d();
  /** View delta (from ViewState, unexpanded) */
  public readonly viewDeltaUnexpanded = new Vector3d();
  /** View rotation matrix (copied from ViewState) */
  public readonly rotation = new Matrix3d();
  /** @internal */
  public readonly worldToViewMap = Map4d.createIdentity();
  /** @internal */
  public readonly worldToNpcMap = Map4d.createIdentity();
  /** @internal */
  public readonly zClipAdjusted: boolean = false;    // were the view z clip planes adjusted due to front/back clipping off?
  /** Eye point - undefined if not 3D or parallel projection. */
  public readonly eyePoint: Point3d | undefined;

  private _view: ViewState;

  /** The ViewState for this Viewport */
  public get view(): ViewState { return this._view; }
  public set view(view: ViewState) { this._view = view; }

  private readonly _clientWidth: number;
  private readonly _clientHeight: number;

  /** Get the rectangle of this Viewport in ViewCoordinates. */
  private get _viewRect(): ViewRect { this._viewRange.init(0, 0, this._clientWidth, this._clientHeight); return this._viewRange; }

  private static _copyOutput(from: XYZ, to?: XYZ) { let pt = from; if (to) { to.setFrom(from); pt = to; } return pt; }

  /** @internal */
  public toViewOrientation(from: XYZ, to?: XYZ) { this.rotation.multiplyVectorInPlace(ViewingSpace._copyOutput(from, to)); }
  /** @internal */
  public fromViewOrientation(from: XYZ, to?: XYZ) { this.rotation.multiplyTransposeVectorInPlace(ViewingSpace._copyOutput(from, to)); }

  /** Ensure the rotation matrix for this view is aligns the root z with the view out (i.e. a "2d view"). */
  private alignWithRootZ() {
    const zUp = Vector3d.unitZ();
    if (zUp.isAlmostEqual(this.rotation.rowZ()))
      return;
    const r = this.rotation.transpose();
    r.setColumn(2, zUp);
    Matrix3d.createRigidFromMatrix3d(r, AxisOrder.ZXY, r);
    r.transpose(this.rotation);
    this.view.setRotation(this.rotation); // Don't let viewState and viewport rotation be different.
  }

  private validateCamera() {
    const view = this.view;
    if (!view.is3d())
      return;

    const camera = view.camera;
    camera.validateLens();
    if (camera.isFocusValid)
      return;

    const vDelta = view.getExtents();
    const maxDelta = vDelta.x > vDelta.y ? vDelta.x : vDelta.y;
    let focusDistance = maxDelta / (2.0 * Math.tan(camera.getLensAngle().radians / 2.0));

    if (focusDistance < vDelta.z / 2.0)
      focusDistance = vDelta.z / 2.0;

    const eyePoint = new Point3d(vDelta.x / 2.0, vDelta.y / 2.0, (vDelta.z / 2.0) + focusDistance);

    this.fromViewOrientation(eyePoint);
    eyePoint.plus(view.getOrigin(), eyePoint);
    camera.setEyePoint(eyePoint);
    camera.setFocusDistance(focusDistance);
  }

  /** @internal */
  public getTerrainHeightRange(): Range1d | undefined {
    const frustum = this.getFrustum()!;
    const cartoRange = Range2d.createNull();
    for (let i = 0; i < 8; i++) {
      const corner = frustum.getCorner(i);
      const carto = this.view.iModel.spatialToCartographicFromEcef(corner);
      cartoRange.extendXY(carto.longitude, carto.latitude);
    }

    return ApproximateTerrainHeights.instance.getMinimumMaximumHeights(cartoRange);
  }

  private static _minDepth = 1; // Allowing very small depth will cause frustum calculations to fail.

  /** Adjust the front and back planes to encompass the entire viewed volume */
  private adjustZPlanes(origin: Point3d, delta: Vector3d): void {
    const view = this.view;
    if (!view.is3d()) // only necessary for 3d views
      return;

    delta.z = Math.max(delta.z, ViewingSpace._minDepth);

    const extents = view.getViewedExtents();
    const frustum = new Frustum();
    const worldToNpc = this.view.computeWorldToNpc(this.rotation, this.viewOrigin, this.viewDelta, false).map as Map4d;

    if (worldToNpc === undefined)
      return;

    worldToNpc.transform1.multiplyPoint3dArrayQuietNormalize(frustum.points);
    const clipPlanes = frustum.getRangePlanes(false, false, 0);
    const viewedExtentCorners = extents.corners();

    // Only extend depth to include viewed geometry if it is within the frustum. (if viewing global locations).
    if (clipPlanes.classifyPointContainment(viewedExtentCorners, false) === ClipPlaneContainment.StronglyOutside)
      extents.setNull();

    let depthRange;
    const globalGeometry = this.view.displayStyle.getGlobalGeometryAndHeightRange();
    if (undefined !== globalGeometry) {
      const viewZ = this.rotation.getRow(2);
      const eyeDepth = this.eyePoint ? viewZ.dotProduct(this.eyePoint) : undefined;
      depthRange = globalGeometry.geometry.getFrustumIntersectionDepthRange(frustum, extents, globalGeometry.heightRange, this.view.maxGlobalScopeFactor > 1);

      if (eyeDepth !== undefined) {
        const maxBackgroundFrontBackRatio = 1.0E6;
        const frontDist = Math.max(.1, eyeDepth - depthRange.high);
        const backDist = eyeDepth - depthRange.low;
        if (backDist / frontDist > maxBackgroundFrontBackRatio)
          depthRange.high = eyeDepth - backDist / maxBackgroundFrontBackRatio;
      }
    } else
      depthRange = Range1d.createNull();

    if (!extents.isNull) {
      const viewZ = this.rotation.getRow(2);
      const corners = extents.corners();
      for (const corner of corners)
        depthRange.extendX(viewZ.dotProduct(corner));
    }

    if (depthRange.isNull)
      return;

    this.rotation.multiplyVectorInPlace(origin);       // put origin in view coordinates
    origin.z = depthRange.low;                          // set origin to back of viewed extents
    delta.z = Math.max(depthRange.high - depthRange.low, ViewingSpace._minDepth); // and delta to front of viewed extents
    this.rotation.multiplyTransposeVectorInPlace(origin);

    if (!view.isCameraOn)
      return;

    // if the camera is on, we need to make sure that the viewed volume is not behind the eye
    const eyeOrg = this.eyePoint!.minus(origin);
    this.rotation.multiplyVectorInPlace(eyeOrg);

    // if the distance from the eye to origin in less than 1 meter, move the origin away from the eye. Usually, this means
    // that the camera is outside the viewed extents and pointed away from it. There's nothing to see anyway.
    if (eyeOrg.z < 1.0) {
      this.rotation.multiplyVectorInPlace(origin);
      origin.z -= (2.0 - eyeOrg.z);
      this.rotation.multiplyTransposeVectorInPlace(origin);
      delta.z = 1.0;
      return;
    }

    // if part of the viewed extents are behind the eye, don't include that.
    if (delta.z > eyeOrg.z)
      delta.z = eyeOrg.z;
  }

  /* get the mapping from NPC to view
   * @internal
   */
  public calcNpcToView(): Map4d {
    const corners = this.getViewCorners();
    const map = Map4d.createBoxMap(NpcCorners[Npc._000], NpcCorners[Npc._111], corners.low, corners.high);

    // The map may be undefined if the view rect's width or height is zero.
    return undefined === map ? Map4d.createIdentity() : map;
  }

  /* Get the extents of this view, in ViewCoordinates, as a Range3d */
  public getViewCorners(): Range3d {
    const corners = this._viewCorners;
    const viewRect = this._viewRect;
    corners.high.x = viewRect.right;
    corners.low.y = viewRect.bottom;    // y's are swapped on the screen!
    corners.low.x = 0;
    corners.high.y = 0;
    corners.low.z = -32767;
    corners.high.z = 32767;
    return corners;
  }

  private constructor(vp: Viewport) {
    const view = this._view = vp.view;
    const viewRect = vp.viewRect;
    this._clientWidth = viewRect.width;
    this._clientHeight = viewRect.height;
    const origin = view.getOrigin().clone();
    const delta = view.getExtents().clone();
    this.rotation.setFrom(view.getRotation());

    // first, make sure none of the deltas are negative
    delta.x = Math.abs(delta.x);
    delta.y = Math.abs(delta.y);
    delta.z = Math.abs(delta.z);

    this.viewOriginUnexpanded.setFrom(origin);
    this.viewDeltaUnexpanded.setFrom(delta);
    this.viewOrigin.setFrom(origin);
    this.viewDelta.setFrom(delta);
    this.zClipAdjusted = false;
    this.eyePoint = undefined;

    if (view.is3d()) {
      if (!view.allow3dManipulations()) {
        // we're in a "2d" view of a physical model. That means that we must have our orientation with z out of the screen with z=0 at the center.
        this.alignWithRootZ(); // make sure we're in a z Up view

        const extents = view.getViewedExtents();
        if (extents.isNull) {
          extents.low.z = Frustum2d.minimumZExtents.low;
          extents.high.z = Frustum2d.minimumZExtents.high;
        }

        let zMax = Math.max(Math.abs(extents.low.z), Math.abs(extents.high.z));
        zMax = Math.max(zMax, 1.0); // make sure we have at least +-1m. Data may be purely planar
        delta.z = 2.0 * zMax;
        origin.z = -zMax;
      } else {
        if (view.isCameraOn)
          this.validateCamera();

        if (view.isCameraOn)
          this.eyePoint = view.camera.getEyePoint().clone();

        this.adjustZPlanes(origin, delta); // make sure view volume includes entire volume of view

        // if the camera is on, don't allow front plane behind camera
        if (this.eyePoint) {
          const eyeOrg = this.eyePoint.minus(origin); // vector from eye to origin
          this.toViewOrientation(eyeOrg);

          const frontDist = eyeOrg.z - delta.z; // front distance is backDist - delta.z

          // allow ViewState to specify a minimum front dist, but in no case less than 6 inches
          const minFrontDist = Math.max(15.2 * Constant.oneCentimeter, view.forceMinFrontDist);
          if (frontDist < minFrontDist) {
            // camera is too close to front plane, move origin away from eye to maintain a minimum front distance.
            this.toViewOrientation(origin);
            origin.z -= (minFrontDist - frontDist);
            this.fromViewOrientation(origin);
          }
        }

        // if we moved the z planes, set the "zClipAdjusted" flag.
        if (!origin.isExactEqual(this.viewOriginUnexpanded) || !delta.isExactEqual(this.viewDeltaUnexpanded))
          this.zClipAdjusted = true;
      }
    } else { // 2d viewport
      this.alignWithRootZ();
    }

    this.viewOrigin.setFrom(origin);
    this.viewDelta.setFrom(delta);

    const newRootToNpc = this.view.computeWorldToNpc(this.rotation, origin, delta, !this.view.displayStyle.getIsBackgroundMapVisible() /* if displaying background map, don't enforce front/back ratio as no Z-Buffer */);
    if (newRootToNpc.map === undefined) {
      this.frustFraction = 0; // invalid frustum
      return;
    }

    this.worldToNpcMap.setFrom(newRootToNpc.map);
    this.frustFraction = newRootToNpc.frustFraction;
    this.worldToViewMap.setFrom(this.calcNpcToView().multiplyMapMap(this.worldToNpcMap));
  }

  /** @internal */
  public static createFromViewport(vp: Viewport): ViewingSpace | undefined {
    return new ViewingSpace(vp);
  }

  /** Convert an array of points from CoordSystem.View to CoordSystem.Npc */
  public viewToNpcArray(pts: Point3d[]): void {
    const corners = this.getViewCorners();
    const scrToNpcTran = Transform.createIdentity();
    Transform.initFromRange(corners.low, corners.high, undefined, scrToNpcTran);
    scrToNpcTran.multiplyPoint3dArrayInPlace(pts);
  }

  /** Convert an array of points from CoordSystem.Npc to CoordSystem.View */
  public npcToViewArray(pts: Point3d[]): void {
    const corners = this.getViewCorners();
    for (const p of pts)
      corners.fractionToPoint(p.x, p.y, p.z, p);
  }

  /** Convert a point from CoordSystem.View to CoordSystem.Npc
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public viewToNpc(pt: Point3d, out?: Point3d): Point3d {
    const corners = this.getViewCorners();
    const scrToNpcTran = Transform.createIdentity();
    Transform.initFromRange(corners.low, corners.high, undefined, scrToNpcTran);
    return scrToNpcTran.multiplyPoint3d(pt, out);
  }

  /** Convert a point from CoordSystem.Npc to CoordSystem.View
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public npcToView(pt: Point3d, out?: Point3d): Point3d {
    const corners = this.getViewCorners();
    return corners.fractionToPoint(pt.x, pt.y, pt.z, out);
  }

  /** Convert an array of points from CoordSystem.World to CoordSystem.Npc */
  public worldToNpcArray(pts: Point3d[]): void { this.worldToNpcMap.transform0.multiplyPoint3dArrayQuietNormalize(pts); }
  /** Convert an array of points from CoordSystem.Npc to CoordSystem.World */
  public npcToWorldArray(pts: Point3d[]): void { this.worldToNpcMap.transform1.multiplyPoint3dArrayQuietNormalize(pts); }
  /** Convert an array of points from CoordSystem.World to CoordSystem.View */
  public worldToViewArray(pts: Point3d[]): void { this.worldToViewMap.transform0.multiplyPoint3dArrayQuietNormalize(pts); }
  /** Convert an array of points from CoordSystem.World to CoordSystem.View, as Point4ds */
  public worldToView4dArray(worldPts: Point3d[], viewPts: Point4d[]): void { this.worldToViewMap.transform0.multiplyPoint3dArray(worldPts, viewPts); }
  /** Convert an array of points from CoordSystem.View to CoordSystem.World */
  public viewToWorldArray(pts: Point3d[]) { this.worldToViewMap.transform1.multiplyPoint3dArrayQuietNormalize(pts); }
  /** Convert an array of points from CoordSystem.View as Point4ds to CoordSystem.World */
  public view4dToWorldArray(viewPts: Point4d[], worldPts: Point3d[]): void { this.worldToViewMap.transform1.multiplyPoint4dArrayQuietRenormalize(viewPts, worldPts); }

  /**
   * Convert a point from CoordSystem.World to CoordSystem.Npc
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public worldToNpc(pt: XYAndZ, out?: Point3d): Point3d { return this.worldToNpcMap.transform0.multiplyPoint3dQuietNormalize(pt, out); }
  /**
   * Convert a point from CoordSystem.Npc to CoordSystem.World
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public npcToWorld(pt: XYAndZ, out?: Point3d): Point3d { return this.worldToNpcMap.transform1.multiplyPoint3dQuietNormalize(pt, out); }
  /**
   * Convert a point from CoordSystem.World to CoordSystem.View
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public worldToView(input: XYAndZ, out?: Point3d): Point3d { return this.worldToViewMap.transform0.multiplyPoint3dQuietNormalize(input, out); }
  /**
   * Convert a point from CoordSystem.World to CoordSystem.View as Point4d
   * @param input the point to convert
   * @param out optional location for result. If undefined, a new Point4d is created.
   */
  public worldToView4d(input: XYAndZ, out?: Point4d): Point4d { return this.worldToViewMap.transform0.multiplyPoint3d(input, 1.0, out); }
  /**
   * Convert a point from CoordSystem.View to CoordSystem.World
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public viewToWorld(input: XYAndZ, out?: Point3d): Point3d { return this.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(input, out); }
  /**
   * Convert a point from CoordSystem.View as a Point4d to CoordSystem.View
   * @param input the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public view4dToWorld(input: Point4d, out?: Point3d): Point3d { return this.worldToViewMap.transform1.multiplyXYZWQuietRenormalize(input.x, input.y, input.z, input.w, out); }

  /** Get an 8-point Frustum corresponding to the 8 corners of the Viewport in the specified coordinate system.
   *
   * There are two sets of corners that may be of interest.
   * The "adjusted" box is the one that is computed by examining the "viewed extents" and moving
   * the front and back planes to enclose everything in the view.
   * The "unadjusted" box is the one that is stored in the ViewState.
   * @param sys Coordinate system for points
   * @param adjustedBox If true, retrieve the adjusted box. Otherwise retrieve the box that came from the view definition.
   * @param box optional Frustum for return value
   * @return the view frustum
   * @note The "adjusted" box may be either larger or smaller than the "unadjusted" box.
   */
  public getFrustum(sys: CoordSystem = CoordSystem.World, adjustedBox: boolean = true, box?: Frustum): Frustum {
    box = box ? box.initNpc() : new Frustum();

    // if they are looking for the "unexpanded" (that is before f/b clipping expansion) box, we need to get the npc
    // coordinates that correspond to the unexpanded box in the npc space of the Expanded view (that's the basis for all
    // of the root-based maps.)
    if (!adjustedBox && this.zClipAdjusted) {
      // to get unexpanded box, we have to go recompute rootToNpc from original View.
      const ueRootToNpc = this.view.computeWorldToNpc(this.rotation, this.viewOriginUnexpanded, this.viewDeltaUnexpanded);
      if (undefined === ueRootToNpc.map)
        return box; // invalid frustum

      // get the root corners of the unexpanded box
      const ueRootBox = new Frustum();
      ueRootToNpc.map.transform1.multiplyPoint3dArrayQuietNormalize(ueRootBox.points);

      // and convert them to npc coordinates of the expanded view
      this.worldToNpcArray(ueRootBox.points);
      box.setFrom(ueRootBox);
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

  /** @internal */
  public getPixelSizeAtPoint(inPoint?: Point3d) {
    const viewPt = !!inPoint ? this.worldToView(inPoint) : this.npcToView(new Point3d(0.5, 0.5, 0.5));
    const viewPt2 = new Point3d(viewPt.x + 1.0, viewPt.y, viewPt.z);
    return this.viewToWorld(viewPt).distance(this.viewToWorld(viewPt2));
  }

  /** @internal */
  public getPreloadFrustum(transformOrScale?: Transform | number, result?: Frustum) {
    const viewFrustum = this.getFrustum(CoordSystem.World, true);

    if (transformOrScale && transformOrScale instanceof Transform) {
      return viewFrustum.transformBy(transformOrScale, result);
    } else {
      const scale = transformOrScale === undefined ? 2 : transformOrScale;
      const expandedFrustum = viewFrustum.clone(result);
      expandedFrustum.scaleXYAboutCenter(scale);
      return expandedFrustum;
    }
  }
}
