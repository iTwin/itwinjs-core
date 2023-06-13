/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { JsonUtils, Logger, LoggingMetaData, RealityDataStatus } from "@itwin/core-bentley";
import { Cartographic, EcefLocation } from "@itwin/core-common";
import { Matrix3d, Point3d, Range3d, Transform, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { FrontendLoggerCategory } from "../common/FrontendLoggerCategory";
import { PublisherProductInfo, RealityDataError, SpatialLocationAndExtents } from "../RealityDataSource";

const loggerCategory: string = FrontendLoggerCategory.RealityData;
/** This interface provides information about 3dTile files for this reality data
 * Currently only used for debbugging
 * @internal
 */
export interface ThreeDTileFileInfo {
  /** the number of children at the root of this reality data */
  rootChildren?: number;
}
/**
 * This class provide methods used to interpret Cesium 3dTile format
 * @internal
 */
export class ThreeDTileFormatInterpreter  {
  /** Gets reality data spatial location and extents
   * @param json root document file in json format
   * @returns spatial location and volume of interest, in meters, centered around `spatial location`
   * @throws [[RealityDataError]] if source is invalid or cannot be read
   * @internal
   */
  public static getSpatialLocationAndExtents(json: any): SpatialLocationAndExtents {
    const worldRange = new Range3d();
    let isGeolocated = true;
    let location: Cartographic | EcefLocation;
    Logger.logTrace(loggerCategory, "RealityData getSpatialLocationAndExtents");
    if (undefined === json?.root) {
      Logger.logWarning(loggerCategory, `Error getSpatialLocationAndExtents - no root in json`);
      // return first 1024 char from the json
      const getMetaData: LoggingMetaData = () => {
        return {json: JSON.stringify(json).substring(0,1024)};
      };
      const error = new RealityDataError(RealityDataStatus.InvalidData, "Invalid or unknown data - no root in json", getMetaData);
      throw error;
    }
    try {
      if (undefined !== json?.root?.boundingVolume?.region) {
        const region = JsonUtils.asArray(json.root.boundingVolume.region);

        Logger.logTrace(loggerCategory, "RealityData json.root.boundingVolume.region", () => ({ ...region }));
        if (undefined === region) {
          Logger.logError(loggerCategory, `Error getSpatialLocationAndExtents - region undefined`);
          throw new TypeError("Unable to determine GeoLocation - no root Transform or Region on root.");
        }
        const ecefLow = (Cartographic.fromRadians({ longitude: region[0], latitude: region[1], height: region[4] })).toEcef();
        const ecefHigh = (Cartographic.fromRadians({ longitude: region[2], latitude: region[3], height: region[5] })).toEcef();
        const ecefRange = Range3d.create(ecefLow, ecefHigh);
        const cartoCenter = Cartographic.fromRadians({ longitude: (region[0] + region[2]) / 2.0, latitude: (region[1] + region[3]) / 2.0, height: (region[4] + region[5]) / 2.0 });
        location = cartoCenter;
        const ecefLocation = EcefLocation.createFromCartographicOrigin(cartoCenter);
        // iModelDb.setEcefLocation(ecefLocation);
        const ecefToWorld = ecefLocation.getTransform().inverse()!;
        worldRange.extendRange(Range3d.fromJSON(ecefToWorld.multiplyRange(ecefRange)));
      } else {
        let worldToEcefTransform = ThreeDTileFormatInterpreter.transformFromJson(json.root.transform);

        Logger.logTrace(loggerCategory, "RealityData json.root.transform", () => ({ ...worldToEcefTransform }));
        const range = ThreeDTileFormatInterpreter.rangeFromBoundingVolume(json.root.boundingVolume)!;
        if (undefined === worldToEcefTransform)
          worldToEcefTransform = Transform.createIdentity();

        const ecefRange = worldToEcefTransform.multiplyRange(range); // range in model -> range in ecef
        const ecefCenter = worldToEcefTransform.multiplyPoint3d(range.center); // range center in model -> range center in ecef
        const cartoCenter = Cartographic.fromEcef(ecefCenter); // ecef center to cartographic center
        const isNotNearEarthSurface = cartoCenter && (cartoCenter.height < -5000); // 5 km under ground!
        const earthCenterToRangeCenterRayLenght = range.center.magnitude();

        if (worldToEcefTransform.matrix.isIdentity && (earthCenterToRangeCenterRayLenght < 1.0E5 || isNotNearEarthSurface)) {
          isGeolocated = false;
          worldRange.extendRange(Range3d.fromJSON(ecefRange));
          const centerOfEarth =  new EcefLocation({ origin: { x: 0.0, y: 0.0, z: 0.0 }, orientation: { yaw: 0.0, pitch: 0.0, roll: 0.0 } });
          location = centerOfEarth;
          Logger.logTrace(loggerCategory, "RealityData NOT Geolocated", () => ({ ...location }));
        } else {
          let ecefLocation: EcefLocation;
          const locationOrientation = YawPitchRollAngles.tryFromTransform(worldToEcefTransform);
          // Fix Bug 445630: [RDV][Regression] Orientation of georeferenced Reality Mesh is wrong.
          // Use json.root.transform only if defined and not identity -> otherwise will use a transform computed from cartographic center.
          if (!worldToEcefTransform.matrix.isIdentity && locationOrientation !== undefined && locationOrientation.angles !== undefined)
            ecefLocation = new EcefLocation({ origin: locationOrientation.origin, orientation: locationOrientation.angles.toJSON() });
          else
            ecefLocation = EcefLocation.createFromCartographicOrigin(cartoCenter!);
          location = ecefLocation;
          Logger.logTrace(loggerCategory, "RealityData is worldToEcefTransform.matrix.isIdentity", () => ({ isIdentity: worldToEcefTransform!.matrix.isIdentity }));
          // iModelDb.setEcefLocation(ecefLocation);
          const ecefToWorld = ecefLocation.getTransform().inverse()!;
          worldRange.extendRange(Range3d.fromJSON(ecefToWorld.multiplyRange(ecefRange)));
          Logger.logTrace(loggerCategory, "RealityData ecefToWorld", () => ({ ...ecefToWorld }));
        }
      }
    } catch (e) {
      Logger.logWarning(loggerCategory, `Error getSpatialLocationAndExtents - cannot interpret json`);
      // return first 1024 char from the json
      const getMetaData: LoggingMetaData = () => {
        return {json: JSON.stringify(json).substring(0,1024)};
      };
      const error = new RealityDataError(RealityDataStatus.InvalidData, "Invalid or unknown data", getMetaData);
      throw error;
    }

    const spatialLocation: SpatialLocationAndExtents = { location, worldRange, isGeolocated };
    return spatialLocation;
  }
  /** Gets information to identify the product and engine that create this reality data
   * Will return undefined if cannot be resolved
   * @param rootDocjson root document file in json format
   * @returns information to identify the product and engine that create this reality data
   * @alpha
   */
  public static getPublisherProductInfo(rootDocjson: any): PublisherProductInfo {
    const info: PublisherProductInfo = {product: "", engine: "", version: ""};
    if (rootDocjson && rootDocjson.root) {
      if (rootDocjson.root.SMPublisherInfo) {
        info.product = rootDocjson.root.SMPublisherInfo.Product ? rootDocjson.root.SMPublisherInfo.Product : "";
        info.engine =  rootDocjson.root.SMPublisherInfo.Publisher ? rootDocjson.root.SMPublisherInfo.Publisher : "";
        info.version = rootDocjson.root.SMPublisherInfo["Publisher Version"] ? rootDocjson.root.SMPublisherInfo["Publisher Version"] : "" ;
      }
    }
    return info;
  }
  /** Gets information about 3dTile file for this reality data
   * Will return undefined if cannot be resolved
   * @param rootDocjson root document file in json format
   * @returns information about 3dTile file for this reality data
   * @internal
   */
  public static getFileInfo(rootDocjson: any): ThreeDTileFileInfo {
    const info: ThreeDTileFileInfo = {
      rootChildren: rootDocjson?.root?.children?.length ?? 0,
    };
    return info;
  }
  /** Convert a boundingVolume into a range
   * @param boundingVolume the bounding volume to convert
   * @returns the range or undefined if cannot convert
   * @internal
   */
  public static rangeFromBoundingVolume(boundingVolume: any): Range3d | undefined {
    if (undefined === boundingVolume)
      return undefined;
    if (Array.isArray(boundingVolume.box)) {
      const box: number[] = boundingVolume.box;
      const center = Point3d.create(box[0], box[1], box[2]);
      const ux = Vector3d.create(box[3], box[4], box[5]);
      const uy = Vector3d.create(box[6], box[7], box[8]);
      const uz = Vector3d.create(box[9], box[10], box[11]);
      const corners: Point3d[] = [];
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          for (let l = 0; l < 2; l++) {
            corners.push(center.plus3Scaled(ux, (j ? -1.0 : 1.0), uy, (k ? -1.0 : 1.0), uz, (l ? -1.0 : 1.0)));
          }
        }
      }
      return Range3d.createArray(corners);
    } else if (Array.isArray(boundingVolume.sphere)) {
      const sphere: number[] = boundingVolume.sphere;
      const center = Point3d.create(sphere[0], sphere[1], sphere[2]);
      const radius = sphere[3];
      return Range3d.createXYZXYZ(center.x - radius, center.y - radius, center.z - radius, center.x + radius, center.y + radius, center.z + radius);
    }
    return undefined;
  }
  /** Convert a boundingVolume into a range
   * @internal
   */
  public static maximumSizeFromGeometricTolerance(range: Range3d, geometricError: number): number {
    const minToleranceRatio = .5;   // Nominally the error on screen size of a tile.  Increasing generally increases performance (fewer draw calls) at expense of higher load times.
    return minToleranceRatio * range.diagonal().magnitude() / geometricError;
  }
  /** Convert a boundingVolume into a range
   * @internal
   */
  public static transformFromJson(jTrans: number[] | undefined): Transform | undefined {
    return (jTrans === undefined) ? undefined : Transform.createOriginAndMatrix(Point3d.create(jTrans[12], jTrans[13], jTrans[14]), Matrix3d.createRowValues(jTrans[0], jTrans[4], jTrans[8], jTrans[1], jTrans[5], jTrans[9], jTrans[2], jTrans[6], jTrans[10]));
  }
}
