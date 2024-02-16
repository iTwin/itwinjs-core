/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Camera, Cartographic, Frustum } from "@itwin/core-common";
import { Angle, ClipVector, LowAndHighXY, LowAndHighXYZ, Map4d, Matrix3d, Point3d, Range3d, Vector3d, XYAndZ, XYZ } from "@itwin/core-geometry";
import { ViewPose, ViewPose3d } from "../ViewPose";
import { StandardViewId } from "../StandardView";
import { ViewStatus } from "../ViewStatus";
import { MarginOptions, OnViewExtentsError } from "../ViewAnimation";
import { ExtentLimits, LookAtOrthoArgs, LookAtPerspectiveArgs, LookAtUsingLensAngle } from "../ViewState";
import { GlobalLocation } from "../ViewGlobalLocation";

export interface ISceneVolume {
  allow3dManipulations(): boolean;

  getOrigin(): Point3d;
  setOrigin(viewOrg: XYAndZ): void;
  getExtents(): Vector3d;
  setExtents(viewDelta: Vector3d): void;
  getRotation(): Matrix3d;
  setRotation(viewRot: Matrix3d): void;

  getCenter(result?: Point3d): Point3d;
  setCenter(center: Point3d): void;

  savePose(): ViewPose;
  applyPose(pose: ViewPose): this;
  
  setStandardRotation(id: StandardViewId): void;
  setStandardGlobalRotation(_id: StandardViewId): void;

  getTargetPoint(result?: Point3d): Point3d;

  computeWorldToNpc(viewRot?: Matrix3d, inOrigin?: Point3d, delta?: Vector3d, enforceFrontToBackRatio?: boolean): { map: Map4d | undefined, frustFraction: number };
  calculateFrustum(result?: Frustum): Frustum | undefined;
  calculateFocusCorners(): [Point3d, Point3d, Point3d, Point3d];

  setupFromFrustum(inFrustum: Frustum, opts?: OnViewExtentsError): ViewStatus;

  extentLimits: ExtentLimits;
  resetExtentLimits(): void;

  /** @internal */
  fixAspectRatio(windowAspect: number): void;
  
  adjustAspectRatio(aspect: number): void;
  
  getAspectRatio(): number;
  getAspectRatioSkew(): number;
  setAspectRatioSke(skew: number): void;

  /** @internal */
  adjustViewDelta(delta: Vector3d, origin: XYZ, rot: Matrix3d, aspect?: number, opts?: OnViewExtentsError): ViewStatus;

  getXVector(result?: Vector3d): Vector3d;
  getYVector(result?: Vector3d): Vector3d;
  getZVector(result?: Vector3d): Vector3d;

  // ###TODO this probably belongs on ScenePresentation...
  getViewClip(): ClipVector | undefined;
  setViewClip(clip?: ClipVector): void;

  lookAtVolume(volume: LowAndHighXYZ | LowAndHighXY, aspect?: number, options?: MarginOptions & OnViewExtentsError): void;
  lookAtViewAlignedVolume(volume: Range3d, aspect?: number, options?: MarginOptions & OnViewExtentsError): void;

  setRotationAboutPoint(rotation: Matrix3d, point?: Point3d): void;

  getUpVector(point: Point3d): Vector3d;

  // ###TODO getIsViewingProject(): boolean;
  // ###TODO getGlobeRotation(): Matrix3d | undefined;
  // ###TODO readonly globalScopeFactor: number;
  /** @internal */
  // ###TODO readonly maxGlobalScopeFactor: number;
}

export interface SceneVolume3d extends ISceneVolume {
  readonly is3d: true;
  is2d?: never;

  readonly origin: Point3d;
  readonly extents: Vector3d;
  readonly rotation: Matrix3d;

  readonly isCameraOn: boolean;
  readonly camera: Camera;
  /** @internal */
  enableCamera(): void;
  supportsCamera(): boolean;
  minimumFrontDistance(): number;
  turnCameraOff(): boolean;
  readonly isCameraValid: boolean;
  calcLensAngle(): Angle;

  forceMinFrontDist: number;

  allow3dManipulations(): boolean;
  setAllow3dManipulations(allow: boolean): void;

  savePose(): ViewPose3d;
  applyPose(pose: ViewPose): this;

  lookAt(args: LookAtPerspectiveArgs | LookAtOrthoArgs | LookAtUsingLensAngle): ViewStatus;
  /** @internal */
  changeFocusDistance(newDist: number): ViewStatus;
  /** @internal */
  changeFocusFromPoint(pt: Point3d): void;
  moveCameraLocal(distance: Vector3d): ViewStatus;
  moveCameraWorld(distance: Vector3d): ViewStatus;
  rotateCameraLocal(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewStatus;
  rotateCameraWorld(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewStatus;

  centerEyePoint(backDistance?: number): void;
  centerFocusDistance(): void;
  verifyFocusPlane(): void;
  getEyePoint(): Point3d;
  getEyeOrOrthographicViewPoint(): Point3d;
  setEyePoint(eye: XYAndZ): void;
  getLensAngle(): Angle;
  setLensAngle(angle: Angle): void;
  getFocusDistance(): number;
  setFocusDistance(distance: number): void;

  
  // ###TODO global/cartographic stuff here, or on Scene and/or SceneMap and/or SceneObject?
  getEarthFocalPoint(): Point3d | undefined;
  alignToGlobe(target: Point3d, transition?: boolean): ViewStatus;
  readonly isGlobalView: boolean;
  readonly globalScopeFactor: number;
  globalViewTransition(): number;
  getCartographicHeight(point: XYAndZ): number | undefined;
  getEyeCartographicHeight(): number | undefined;
  isEyePointGlobalView(eyePoint: XYAndZ): boolean;
  lookAtGlobalLocation(eyeHeight: number, pitchAngleRadians?: number, location?: GlobalLocation, eyePoint?: Point3d): number;
  lookAtGlobalLocationFromGcs(eyeHeight: number, pitchAngleRadians?: number, location?: GlobalLocation, eyePoint?: Point3d): Promise<number>;
  rootToCartographic(root: XYAndZ, result?: Cartographic): Cartographic | undefined;
  cartographicToRoot(cartographic: Cartographic, result?: Point3d): Point3d | undefined;
  rootToCartographicFromGcs(root: XYAndZ, result?: Cartographic): Promise<Cartographic | undefined>;
  rootToCartographicUsingGcs(root: XYAndZ[]): Promise<Cartographic[] | undefined>;
  cartographicToRootFromGcs(cartographic: Cartographic, result?: Point3d): Promise<Point3d | undefined>;
  cartographicToRootUsingGcs(cartographic: Cartographic[]): Promise<Point3d[] | undefined>;


  // ###TODO this assumes z-up
  isEyePointAbove(elevation: number): boolean;
}

export interface TestSceneVolume2d extends ISceneVolume {
  readonly is2d: true;
  is3d?: never;
}

export type SceneVolume = TestSceneVolume2d | SceneVolume3d;
