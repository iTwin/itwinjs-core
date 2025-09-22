/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, EcefLocation, ViewDefinition3dProps } from "@itwin/core-common";
import { Point3d, Range3d, Vector3d, XYAndZ, YawPitchRollAngles } from "@itwin/core-geometry";
import { IModelConnection } from "@itwin/core-frontend";
import { Cartesian3, Cartographic as CesiumCartographic } from "cesium";

/**
 * Interface for CesiumJS frustum parameters
 */
interface CesiumFrustum {
  near: number;
  far: number;
  fov?: number;
  width?: number;
}

/**
 * Interface for CesiumJS camera parameters
 */
interface CesiumCamera {
  position: Point3d;
  direction: Vector3d;
  up: Vector3d;
  frustum: CesiumFrustum;
}

/**
 * Coordinate conversion utilities between iTwin.js and CesiumJS
 * Handles spatial coordinate transformations, camera conversions, and ECEF mappings
 */
export class CesiumCoordinateConverter {
  private _iModel: IModelConnection;
  private _ecefLocation?: EcefLocation;

  constructor(iModel: IModelConnection) {
    this._iModel = iModel;
    this._ecefLocation = iModel.ecefLocation;
  }

  /**
   * Convert iTwin.js spatial coordinates to CesiumJS Cartesian3 (ECEF coordinates)
   * Uses iTwin.js built-in spatialToEcef method from IModel.ts:636
   * @param spatial Point in iTwin.js model spatial coordinates
   * @returns Cartesian3 position for CesiumJS
   */
  public spatialToCesiumCartesian3(spatial: XYAndZ): Cartesian3 {
    if (!this._iModel.isGeoLocated) {
      return this._getFallbackCartesian3(spatial);
    }
    // Direct call to iTwin.js spatialToEcef method (IModel.ts:636)
    // public spatialToEcef(spatial: XYAndZ, result?: Point3d): Point3d
    const ecefPoint = this._iModel.spatialToEcef(spatial);
    // Convert iTwin.js Point3d ECEF to CesiumJS Cartesian3 ECEF
    return new Cartesian3(ecefPoint.x, ecefPoint.y, ecefPoint.z);
  }

  /**
   * Convert CesiumJS Cartesian3 (ECEF) to iTwin.js spatial coordinates
   * Uses iTwin.js built-in ecefToSpatial method
   * @param cartesian3 Position in CesiumJS ECEF coordinates
   * @returns Point3d in iTwin.js spatial coordinates
   */
  public cesiumCartesian3ToSpatial(cartesian3: Cartesian3): Point3d {
    if (!this._iModel.isGeoLocated) {
      return new Point3d(cartesian3.x, cartesian3.y, cartesian3.z);
    }
    // Convert CesiumJS Cartesian3 to iTwin.js Point3d
    const ecefPoint = new Point3d(cartesian3.x, cartesian3.y, cartesian3.z);
    // Use iTwin.js built-in ecefToSpatial method
    return this._iModel.ecefToSpatial(ecefPoint);
  }

  /**
   * Convert iTwin.js Point3d to CesiumJS geographic coordinates
   * First converts to ECEF using spatialToEcef, then to geographic
   * @param spatial Point in iTwin.js spatial coordinates
   * @returns Cartesian3 from geographic coordinates
   */
  public spatialToGeographic(spatial: XYAndZ): Cartesian3 {
    if (!this._iModel.isGeoLocated) {
      return this._getFallbackCartesian3(spatial);
    }
    // Step 1: iTwin.js spatial → ECEF using built-in method
    const ecefPoint = this._iModel.spatialToEcef(spatial);
    const cesiumEcef = new Cartesian3(ecefPoint.x, ecefPoint.y, ecefPoint.z);
    // Step 2: ECEF → Geographic coordinates
    const cartographic = CesiumCartographic.fromCartesian(cesiumEcef);
    // Step 3: Geographic → Cartesian3 (for CesiumJS positioning)
    return Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      cartographic.height
    );
  }

  /**
   * Convert array of iTwin.js points to CesiumJS Cartesian3 array
   * Uses spatialToEcef for each point
   * @param spatialPoints Array of iTwin.js spatial points
   * @returns Array of CesiumJS Cartesian3 points
   */
  public spatialArrayToCesiumArray(spatialPoints: Point3d[]): Cartesian3[] {
    return spatialPoints.map(point => this.spatialToCesiumCartesian3(point));
  }

  /**
   * Convert iTwin.js line/polyline points to CesiumJS positions
   * Optimized for decoration line conversions
   * @param linePoints Array of iTwin.js Point3d
   * @returns Array of Cartesian3 for CesiumJS polyline
   */
  public convertLineStringToCesium(linePoints: Point3d[]): Cartesian3[] {
    if (!this._iModel.isGeoLocated) {
      return linePoints.map(point => this._getFallbackCartesian3(point));
    }

    const cesiumPositions: Cartesian3[] = [];

    for (const point of linePoints) {
      const ecefPoint = this._iModel.spatialToEcef(point);
      cesiumPositions.push(new Cartesian3(ecefPoint.x, ecefPoint.y, ecefPoint.z));
    }

    return cesiumPositions;
  }

  /**
   * Create CesiumJS camera from iTwin.js ViewDefinition
   * @param viewDefinition iTwin.js ViewDefinition3dProps
   * @param ecefLoc Optional EcefLocation override
   * @param modelExtents Optional model extents override
   * @returns CesiumCamera parameters
   */
  public createCesiumCamera(
    viewDefinition: ViewDefinition3dProps,
    ecefLoc?: EcefLocation,
    modelExtents?: Range3d
  ): CesiumCamera {
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

    return {
      position: transformedPosition,
      up: transformedUp,
      direction: transformedDirection,
      frustum
    };
  }

  /**
   * Get model extents converted to CesiumJS coordinate system
   * @returns Range3d in Cesium ECEF coordinates
   */
  public getModelExtentsInCesium(): Range3d {
    const modelExtents = this._iModel.projectExtents;

    if (!this._iModel.isGeoLocated) {
      return modelExtents; // Return as-is if not geo-located
    }
    // Convert using spatialToEcef
    const lowEcef = this._iModel.spatialToEcef(modelExtents.low);
    const highEcef = this._iModel.spatialToEcef(modelExtents.high);
    return Range3d.create(lowEcef, highEcef);
  }

  /**
   * Check if the iModel has valid geo-location for coordinate conversion
   * @returns true if spatialToEcef can be used reliably
   */
  public canUseEcefConversion(): boolean {
    return this._iModel.isGeoLocated && this._ecefLocation !== undefined;
  }

  /**
   * Get detailed geo-location information for debugging
   * @returns Object with geo-location and conversion details
   */
  public getGeoLocationInfo(): object {
    return {
      isGeoLocated: this._iModel.isGeoLocated,
      hasEcefLocation: !!this._ecefLocation,
      canUseEcefConversion: this.canUseEcefConversion(),
      projectExtents: this._iModel.projectExtents,
      ecefLocation: this._ecefLocation,
      spatialToEcefAvailable: typeof this._iModel.spatialToEcef === 'function'
    };
  }

  /**
   * Fallback positioning when spatialToEcef is not available
   * @param spatial iTwin.js spatial point
   * @returns Approximate CesiumJS Cartesian3
   */
  private _getFallbackCartesian3(spatial: XYAndZ): Cartesian3 {
    const center = this._iModel.projectExtents.center;

    // Calculate relative position from model center
    const relativeX = spatial.x - center.x;
    const relativeY = spatial.y - center.y;
    const relativeZ = spatial.z - center.z;

    // Convert to approximate geographic coordinates
    const longitude = relativeX * 0.00001; // Rough meters to degrees
    const latitude = relativeY * 0.00001;
    const height = Math.max(relativeZ + 100, 100); // Minimum height above ground

    return Cartesian3.fromDegrees(longitude, latitude, height);
  }
}

/**
 * Utility functions for iTwin.js ↔ CesiumJS coordinate conversions
 */
export class CesiumCoordinateUtils {
  /**
   * Create Cartesian3 from geographic coordinates
   */
  public static fromDegrees(longitude: number, latitude: number, height: number = 0): Cartesian3 {
    return Cartesian3.fromDegrees(longitude, latitude, height);
  }

  /**
   * Calculate distance between two CesiumJS positions
   */
  public static distance(pos1: Cartesian3, pos2: Cartesian3): number {
    return Cartesian3.distance(pos1, pos2);
  }
}