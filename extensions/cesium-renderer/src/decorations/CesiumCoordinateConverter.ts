/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EcefLocation } from "@itwin/core-common";
import { Point3d, Range3d, XYAndZ } from "@itwin/core-geometry";
import { IModelConnection } from "@itwin/core-frontend";
import { Cartesian3, Cartographic as CesiumCartographic } from "@cesium/engine";

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
   * Convert iTwin.js spatial coordinates to CesiumJS Cartesian3 (ECEF coordinates).
   * @param spatial Point in iTwin.js model spatial coordinates
   * @returns Cartesian3 position for CesiumJS
   */
  public spatialToCesiumCartesian3(spatial: XYAndZ): Cartesian3 {
    if (!this._iModel.isGeoLocated) {
      return this._getFallbackCartesian3();
    }
    const ecefPoint = this._iModel.spatialToEcef(spatial);
    return new Cartesian3(ecefPoint.x, ecefPoint.y, ecefPoint.z);
  }

  /**
   * Convert CesiumJS Cartesian3 (ECEF) to iTwin.js spatial coordinates
   * @param cartesian3 Position in CesiumJS ECEF coordinates
   * @returns Point3d in iTwin.js spatial coordinates
   */
  public cesiumCartesian3ToSpatial(cartesian3: Cartesian3): Point3d {
    if (!this._iModel.isGeoLocated) {
      return new Point3d(cartesian3.x, cartesian3.y, cartesian3.z);
    }
    const ecefPoint = new Point3d(cartesian3.x, cartesian3.y, cartesian3.z);
    return this._iModel.ecefToSpatial(ecefPoint);
  }

  /**
   * Convert iTwin.js Point3d to CesiumJS geographic coordinates
   * @param spatial Point in iTwin.js spatial coordinates
   * @returns Cartesian3 from geographic coordinates
   */
  public spatialToGeographic(spatial: XYAndZ): Cartesian3 {
    if (!this._iModel.isGeoLocated) {
      return this._getFallbackCartesian3();
    }
    const ecefPoint = this._iModel.spatialToEcef(spatial);
    const cesiumEcef = new Cartesian3(ecefPoint.x, ecefPoint.y, ecefPoint.z);
    const cartographic = CesiumCartographic.fromCartesian(cesiumEcef);
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
      return linePoints.map(() => this._getFallbackCartesian3());
    }

    const cesiumPositions: Cartesian3[] = [];

    for (const point of linePoints) {
      const ecefPoint = this._iModel.spatialToEcef(point);
      cesiumPositions.push(new Cartesian3(ecefPoint.x, ecefPoint.y, ecefPoint.z));
    }

    return cesiumPositions;
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
   * Fallback positioning when spatialToEcef is not available.
   * Anchors non-geolocated models at Null Island.
   */
  private _getFallbackCartesian3(): Cartesian3 {
    return Cartesian3.fromDegrees(0.0, 0.0, 0.0);
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
