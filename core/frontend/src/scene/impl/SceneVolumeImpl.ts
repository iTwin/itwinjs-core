/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { Angle, LowAndHighXY, LowAndHighXYZ, Matrix3d, Point3d, Range3d, Vector3d, XYAndZ, XYZ } from "@itwin/core-geometry";
import { ExtentLimits, LookAtOrthoArgs, LookAtPerspectiveArgs, LookAtUsingLensAngle, ViewState, ViewState3d } from "../../ViewState";
import { ISceneVolume, SceneVolume3d } from "../SceneVolume";
import { ViewPose, ViewPose3d } from "../../ViewPose";
import { StandardViewId } from "../../StandardView";
import { Frustum } from "@itwin/core-common";
import { MarginOptions, OnViewExtentsError } from "../../ViewAnimation";

abstract class ViewStateSceneVolume implements ISceneVolume {
  protected readonly _view: ViewState;

  public constructor(view: ViewState) {
    this._view = view;
  }

  allow3dManipulations() { return this._view.allow3dManipulations(); }

  getOrigin() { return this._view.getOrigin(); }
  setOrigin(org: XYAndZ) { this._view.setOrigin(org); }
  getExtents() { return this._view.getExtents(); }
  setExtents(extents: Vector3d) { this._view.setExtents(extents); }
  getRotation() { return this._view.getRotation(); }
  setRotation(rot: Matrix3d) { this._view.setRotation(rot); }

  getCenter(result?: Point3d) { return this._view.getCenter(result); }
  setCenter(center: Point3d) { this._view.setCenter(center); }
  getTargetPoint(result?: Point3d) { return this._view.getTargetPoint(result); }

  abstract savePose(): ViewPose;
  abstract applyPose(pose: ViewPose): void;

  setStandardRotation(id: StandardViewId) { this._view.setStandardRotation(id); }

  computeWorldToNpc(viewRot?: Matrix3d, inOrigin?: Point3d, delta?: Vector3d, enforceFrontToBackRatio?: boolean) {
    return this._view.computeWorldToNpc(viewRot, inOrigin, delta, enforceFrontToBackRatio);
  }

  calculateFrustum(result?: Frustum) { return this._view.calculateFrustum(result); }
  calculateFocusCorners(): [Point3d, Point3d, Point3d, Point3d] {
    const corners = this._view.calculateFocusCorners();
    assert(corners.length === 4);
    return corners as [Point3d, Point3d, Point3d, Point3d];
  }

  setupFromFrustum(inFrustum: Frustum, opts?: OnViewExtentsError) { return this._view.setupFromFrustum(inFrustum, opts); }

  get extentLimits() { return this._view.extentLimits; }
  resetExtentLimits() { this._view.resetExtentLimits(); }

  /** @internal */
  fixAspectRatio(windowAspect: number) { this._view.fixAspectRatio(windowAspect); }
  adjustAspectRatio(aspect: number) { this._view.adjustAspectRatio(aspect); }
  get aspectRatio() { return this._view.getAspectRatio(); }
  get aspectRatioSkew() { return this._view.getAspectRatioSkew(); }
  set aspectRatioSkew(ratio: number) { this._view.setAspectRatioSkew(ratio); }
  
  /** @internal */
  adjustViewDelta(delta: Vector3d, origin: XYZ, rot: Matrix3d, aspect?: number, opts?: OnViewExtentsError) {
    return this._view.adjustViewDelta(delta, origin, rot, aspect, opts);
  }

  getXVector(result?: Vector3d) { return this._view.getXVector(result); }
  getYVector(result?: Vector3d) { return this._view.getYVector(result); }
  getZVector(result?: Vector3d) { return this._view.getZVector(result); }

  lookAtVolume(volume: LowAndHighXYZ | LowAndHighXY, aspect?: number, options?: MarginOptions & OnViewExtentsError) {
    this._view.lookAtVolume(volume, aspect, options);
  }

  lookAtViewAlignedVolume(volume: Range3d, aspect?: number, options?: MarginOptions & OnViewExtentsError) {
    this._view.lookAtViewAlignedVolume(volume, aspect, options);
  }

  setRotationAboutPoint(rotation: Matrix3d, point?: Point3d) { this._view.setRotationAboutPoint(rotation, point); }
}  

class ViewState3dSceneVolume extends ViewStateSceneVolume implements SceneVolume3d {
  public readonly is3d: true = true;
  
  constructor(view: ViewState3d) {
    super(view);
  }

  private get _view3d(): ViewState3d { return this._view as ViewState3d; }

  override savePose(): ViewPose3d { return this._view3d.savePose(); }
  override applyPose(pose: ViewPose3d) { this._view3d.applyPose(pose); }

  get origin() { return this._view3d.origin; }
  get extents() { return this._view3d.extents; }
  get rotation() { return this._view3d.rotation; }

  get isCameraOn() { return this._view3d.isCameraOn; }
  get camera() { return this._view3d.camera; }
  supportsCamera() { return this._view3d.supportsCamera(); }
  minimumFrontDistance() { return this._view3d.minimumFrontDistance(); }
  turnCameraOff() { return this._view3d.turnCameraOff(); }
  get isCameraValid() { return this._view3d.isCameraValid; }
  calcLensAngle() { return this._view3d.calcLensAngle(); }

  get forceMinFrontDist() { return this._view3d.forceMinFrontDist; }
  set forceMinFrontDist(min: number) { this._view3d.forceMinFrontDist = min; }

  setAllow3dManipulations(allow: boolean) { this._view3d.setAllow3dManipulations(allow); }

  lookAt(args: LookAtPerspectiveArgs | LookAtOrthoArgs | LookAtUsingLensAngle) { return this._view3d.lookAt(args); }
  changeFocusDistance(dist: number) { return this._view3d.changeFocusDistance(dist); }
  changeFocusFromPoint(pt: Point3d) { this._view3d.changeFocusFromPoint(pt); }

  moveCameraLocal(distance: Vector3d) { return this._view3d.moveCameraLocal(distance); }
  moveCameraWorld(distance: Vector3d) { return this._view3d.moveCameraWorld(distance); }
  rotateCameraLocal(angle: Angle, axis: Vector3d, aboutPt?: Point3d) { return this._view3d.rotateCameraLocal(angle, axis, aboutPt); }
  rotateCameraWorld(angle: Angle, axis: Vector3d, aboutPt?: Point3d) { return this._view3d.rotateCameraWorld(angle, axis, aboutPt); }

  centerEyePoint(backDistance?: number) { return this._view3d.centerEyePoint(backDistance); }
  centerFocusDistance() { return this._view3d.centerFocusDistance(); }
  verifyFocusPlane() { return this._view3d.verifyFocusPlane(); }
  getEyePoint() { return this._view3d.getEyePoint(); }
  getEyeOrOrthographicViewPoint() { return this._view3d.getEyeOrOrthographicViewPoint(); }
  setEyePoint(eye: XYAndZ) { return this._view3d.setEyePoint(eye); }
  getLensAngle() { return this._view3d.getLensAngle(); }
  setLensAngle(angle: Angle) { return this._view3d.setLensAngle(angle); }
  getFocusDistance() { return this._view3d.getFocusDistance(); }
  setFocusDistance(distance: number) { return this._view3d.setFocusDistance(distance); }

  // ###TODO this assumes z-up
  isEyePointAbove(elevation: number) { return this._view3d.isEyePointAbove(elevation); }
}

export function sceneVolume3dFromViewState(view: ViewState3d): SceneVolume3d {
  return new ViewState3dSceneVolume(view);
}
