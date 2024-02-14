/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Frustum } from "@itwin/core-common";
import { ClipVector, LowAndHighXY, LowAndHighXYZ, Map4d, Matrix3d, Point3d, Range3d, Vector3d, XYAndZ, XYZ } from "@itwin/core-geometry";
import { ViewPose } from "../ViewPose";
import { StandardViewId } from "../StandardView";
import { ViewStatus } from "../ViewStatus";
import { MarginOptions, OnViewExtentsError } from "../ViewAnimation";
import { ExtentLimits } from "../ViewState";

export interface IViewVolume {
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
