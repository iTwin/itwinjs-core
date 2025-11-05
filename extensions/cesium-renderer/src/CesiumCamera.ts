/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, EcefLocation, type ViewDefinition3dProps } from "@itwin/core-common";
import { Point3d, Range3d, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";

/** Properties that define a Cesium frustum.
 * A [perspective frustum](https://cesium.com/learn/cesiumjs/ref-doc/PerspectiveFrustum.html) requires an fov and an [orthographic frustum](https://cesium.com/learn/cesiumjs/ref-doc/OrthographicFrustum.html) requires a width.
 * @alpha
 */
export interface CesiumFrustumProps {
  /** The distance to the near plane. */
  near: number;
  /** The distance to the far plane. */
  far: number;
  /** The angle of the field of view in radians. Required for [perspective frustums](https://cesium.com/learn/cesiumjs/ref-doc/PerspectiveFrustum.html). */
  fov?: number;
  /** The width of the frustum in meters. Required for [orthographic frustums](https://cesium.com/learn/cesiumjs/ref-doc/OrthographicFrustum.html). */
  width?: number;
}

/** Properties that define a [Cesium camera object](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html).
 * @alpha
 */
export interface CesiumCameraProps {
  /** The position of the camera in ECEF coordinates. */
  position: Point3d;
  /** The direction the camera points toward, aimed at the center of the frame. Used with `up` to define the camera's orientation.
   * See the `options` argument in [Camera.setView](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#setView).
   */
  direction: Vector3d;
  /** The up direction relative to the camera. Used with `direction` to define the camera's orientation.
   * See the `options` argument in [Camera.setView](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#setView).
   */
  up: Vector3d;
  /** The region of space in view of the camera. See [Camera.frustum](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#frustum). */
  frustum: CesiumFrustumProps;
}

/** Returns the position, orientation (direction, up), and frustum needed to create/modify a [Cesium camera object](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html).
 * @alpha
 */
export function createCesiumCameraProps(opts: { viewDefinition: ViewDefinition3dProps, ecefLoc?: EcefLocation, modelExtents?: Range3d}): CesiumCameraProps {
  const defaultOrigin = Cartographic.createZero();
  let ecefLocation;

  // The provided ECEF location is used to position the camera in Cesium.
  // Otherwise, if model extents are provided, assume the model is at null island (0 latitude, 0 longitude).
  if (opts.ecefLoc) {
    ecefLocation = opts.ecefLoc;
  } else if (opts.modelExtents) {
    ecefLocation = EcefLocation.createFromCartographicOrigin(defaultOrigin, opts.modelExtents.center);
  } else {
    throw new Error("Either ecefLocation or modelExtents must be defined to create a CesiumCameraProps.");
  }

  const angles = new YawPitchRollAngles();
  angles.setFromJSON(opts.viewDefinition.angles);

  const rotation = angles.toMatrix3d();
  const up = rotation.rowY();
  const direction = rotation.rowZ().scale(-1);

  const viewExtents = new Vector3d();
  viewExtents.setFromJSON(opts.viewDefinition.extents);

  let fov;
  let width;
  let position = new Point3d();
  if (opts.viewDefinition.cameraOn) {
    position = Point3d.fromJSON(opts.viewDefinition.camera.eye);
    fov = 2.0 * Math.atan2(viewExtents.x / 2.0, opts.viewDefinition.camera.focusDist);
  } else {
    position = Point3d.fromJSON(opts.viewDefinition.origin);
    rotation.multiplyVectorInPlace(position);
    position.addScaledInPlace(viewExtents, 0.5);
    position = rotation.multiplyInverseXYZAsPoint3d(position.x, position.y, position.z) ?? position;
    position.addScaledInPlace(direction, -viewExtents.z);
    width = viewExtents.x;
  }

  const transformedPosition = ecefLocation.getTransform().multiplyPoint3d(position);
  const transformedUp = ecefLocation.getTransform().multiplyVector(up);
  const transformedDirection = ecefLocation.getTransform().multiplyVector(direction);

  // Use Cesium's default near and far values
  const near = 1.0;
  const far = 500000000.0;

  const frustum = {
    near,
    far,
    fov,
    width
  };
  const cesiumCameraProps = {
    position: transformedPosition,
    up: transformedUp,
    direction: transformedDirection,
    frustum
  }

  return cesiumCameraProps;
}