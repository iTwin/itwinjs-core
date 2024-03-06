/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Camera, Frustum } from "@itwin/core-common";
import { Angle, LowAndHighXY, LowAndHighXYZ, Map4d, Matrix3d, Point3d, Range3d, Vector3d, XYAndZ, XYZ } from "@itwin/core-geometry";
import { ViewPose, ViewPose3d } from "../../ViewPose";
import { ViewStatus } from "../../ViewStatus";
import { MarginOptions, OnViewExtentsError } from "../../ViewAnimation";
import { ExtentLimits, LookAtOrthoArgs, LookAtPerspectiveArgs, LookAtUsingLensAngle, ViewState, ViewState3d } from "../../ViewState";
import { ISceneVolume, SceneVolume3d } from "../SceneVolume";

export abstract class SceneVolumeImpl implements ISceneVolume {
  protected readonly _view: ViewState;

  protected constructor(view: ViewState) {
    this._view = view;
  }

  allow3dManipulations() { return this._view.allow3dManipulations(); }

  getOrigin() { return this._view.getOrigin(); }
  setOrigin(origin: XYAndZ) { this._view.setOrigin(origin); }
  getExtents() { return this._view.getExtents(); }
  setExtents(extents: Vector3d) { this._view.setExtents(extents); }
  getRotation() { return this._view.getRotation(); }
  setRotation(rot: Matrix3d) { this._view.setRotation(rot); }

  getCenter(result?: Point3d) { return this._view.getCenter(result); }
  setCenter(center: Point3d) { this._view.setCenter(center); }

  abstract savePose(): ViewPose;
  abstract applyPose(pose: ViewPose): void;

  getTargetPoint(result?: Point3d) { return this._view.getTargetPoint(result); }

  computeWorldToNpc(rot?: Matrix3d, origin?: Point3d, delta?: Vector3d, enforceFrontToBack?: boolean) {
    return this._view.computeWorldToNpc(rot, origin, delta, enforceFrontToBack);
  }

  calculateFrustum(result?: Frustum) { return this._view.calculateFrustum(result); }
  calculateFocusCorners() { return this._view.calculateFocusCorners(); }

  setupFromFrustum(frust: Frustum, opts?: OnViewExtentsError) { return this._view.setupFromFrustum(frust, opts); }

  get extentLimits() { return this._view.extentLimits; }
  resetExtentLimits() { this._view.resetExtentLimits(); }

  fixAspectRatio(aspect: number) { this._view.fixAspectRatio(aspect); }
  adjustAspectRatio(aspect: number) { this._view.adjustAspectRatio(aspect); }
  getAspectRatio() { return this._view.getAspectRatio(); }
  getAspectRatioSkew() { return this._view.getAspectRatioSkew(); }
  setAspectRatioSkew(skew: number) { this._view.setAspectRatioSkew(skew); }

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

  setRotationAboutPoint(rotation: Matrix3d, point?: Point3d) {
    this._view.setRotationAboutPoint(rotation, point);
  }
}

export class SceneVolume3dImpl extends SceneVolumeImpl implements SceneVolume3d {
  readonly is3d: true = true;

  constructor(view: ViewState3d) {
    super(view);
  }

  private get _view3d() { return this._view as ViewState3d; }

  get origin() { return this._view3d.origin; }
  get extents() { return this._view3d.extents; }
  get rotation() { return this._view3d.rotation; }

  get isCameraOn() { return this._view3d.isCameraOn; }
  get camera() { return this._view3d.camera; }
  supportsCamera() { return this._view3d.supportsCamera(); }
  minimumFrontDistance() { return this._view3d.minimumFrontDistance(); }
  turnCameraOff() { this._view3d.turnCameraOff(); }
  get isCameraValid() { return this._view3d.isCameraValid; }
  calcLensAngle() { return this._view3d.calcLensAngle(); }

  get forceMinFrontDist() { return this._view3d.forceMinFrontDist; }

  setAllow3dManipulations(allow: boolean) { this._view3d.setAllow3dManipulations(allow); }

  override savePose(): ViewPose3d { return this._view3d.savePose(); }
  override applyPose(pose: ViewPose3d) { this._view3d.applyPose(pose); }

  lookAt(args: LookAtPerspectiveArgs | LookAtOrthoArgs | LookAtUsingLensAngle): ViewStatus {
    return this._view3d.lookAt(args);
  }

  changeFocusDistance(newDist: number): ViewStatus {
    return this._view3d.changeFocusDistance(newDist);
  }

  changeFocusFromPoint(pt: Point3d) {
    this._view3d.changeFocusFromPoint(pt);
  }

  moveCameraLocal(distance: Vector3d): ViewStatus {
    return this._view3d.moveCameraLocal(distance);
  }

  moveCameraWorld(distance: Vector3d): ViewStatus {
    return this._view3d.moveCameraWorld(distance);
  }

  rotateCameraLocal(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewStatus {
    return this._view3d.rotateCameraLocal(angle, axis, aboutPt);
  }

  rotateCameraWorld(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewStatus {
    return this._view3d.rotateCameraWorld(angle, axis, aboutPt);
  }

  centerEyePoint(backDistance?: number): void {
    return this._view3d.centerEyePoint(backDistance);
  }

  centerFocusDistance(): void {
    return this._view3d.centerFocusDistance();
  }

  verifyFocusPlane(): void {
    return this._view3d.verifyFocusPlane();
  }

  getEyePoint(): Point3d {
    return this._view3d.getEyePoint();
  }

  getEyeOrOrthographicViewPoint(): Point3d {
    return this._view3d.getEyeOrOrthographicViewPoint();
  }

  setEyePoint(eye: XYAndZ): void {
    return this._view3d.setEyePoint(eye);
  }

  getLensAngle(): Angle {
    return this._view3d.getLensAngle();
  }

  setLensAngle(angle: Angle): void {
    return this._view3d.setLensAngle(angle);
  }

  getFocusDistance(): number {
    return this._view3d.getFocusDistance();
  }

  setFocusDistance(distance: number): void {
    return this._view3d.setFocusDistance(distance);
  }
}
