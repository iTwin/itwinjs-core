/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, EcefLocation, ViewDefinition3dProps } from "@itwin/core-common";
import { Point3d, Range3d, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";

interface CesiumFrustum {
  near: number;
  far: number;
  fov?: number;
  width?: number;
}

interface CesiumCamera {
  position: Point3d;
  direction: Vector3d;
  up: Vector3d;
  frustum: CesiumFrustum;
}

// Returns position, orientation (direction, up), and frustum needed to create/modify a Cesium camera
export function createCesiumCamera(viewDefinition: ViewDefinition3dProps, ecefLoc?: EcefLocation, modelExtents?: Range3d): CesiumCamera {
  const defaultOrigin = Cartographic.fromDegrees({ longitude: 0, latitude: 0, height: 0 });
  let ecefLocation;
  if (ecefLoc) {
    ecefLocation = ecefLoc;
  } else if (modelExtents) {
    ecefLocation = EcefLocation.createFromCartographicOrigin(defaultOrigin, modelExtents.center);
  } else {
    throw new Error("Either ecefLocation or modelExtents must be defined to create Cesium camera.");
  }

  const angles = new YawPitchRollAngles();
  angles.setFromJSON(viewDefinition.angles);

  const rotation = angles.toMatrix3d();
  const up = rotation.rowY();
  const direction = rotation.rowZ().scale(-1);

  const viewExtents = new Vector3d();
  viewExtents.setFromJSON(viewDefinition.extents);

  let fov;
  let width;
  let position = new Point3d();
  if (viewDefinition.cameraOn) {
    position = Point3d.fromJSON(viewDefinition.camera.eye);
    fov = 2.0 * Math.atan2(viewExtents.x / 2.0, viewDefinition.camera.focusDist);
  } else {
    position = Point3d.fromJSON(viewDefinition.origin);
    rotation.multiplyVectorInPlace(position);
    position.addScaledInPlace(viewExtents, 0.5);
    position = rotation.multiplyInverseXYZAsPoint3d(position.x, position.y, position.z) ?? position;
    position.addScaledInPlace(direction, -viewExtents.z);
    width = viewExtents.x;
  }

  const transformedPosition = ecefLocation.getTransform().multiplyPoint3d(position);
  const transformedUp = ecefLocation.getTransform().multiplyVector(up);
  const transformedDirection = ecefLocation.getTransform().multiplyVector(direction);

  const frustum: CesiumFrustum = {
    near: 0.01,
    far: 1000000,
    fov,
    width
  };
  const cesiumCamera: CesiumCamera = {
    position: transformedPosition,
    up: transformedUp,
    direction: transformedDirection,
    frustum
  }

  return cesiumCamera;
}