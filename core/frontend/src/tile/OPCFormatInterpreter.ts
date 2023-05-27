/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, EcefLocation } from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { ALong, CRSManager, Downloader, DownloaderXhr, OnlineEngine, OPCReader, OrbitGtBounds, PageCachedFile, PointCloudReader, UrlFS } from "@itwin/core-orbitgt";
import { FrontendLoggerCategory } from "../common/FrontendLoggerCategory";
import { BentleyError, Logger, LoggingMetaData, RealityDataStatus } from "@itwin/core-bentley";
import { RealityDataError, SpatialLocationAndExtents } from "../RealityDataSource";

const loggerCategory: string = FrontendLoggerCategory.RealityData;

/**
 * This class provide methods used to interpret Orbit Point Cloud (OPC) format
 * @internal
 */
export class OPCFormatInterpreter  {
  /** Gets an OPC file reader from a blobFileUrl
   * @param blobFileURL the name of the file.
   * @returns return a file reader open to read provided blob file
   * @internal
   */
  public static async getFileReaderFromBlobFileURL(blobFileURL: string): Promise<PointCloudReader> {
    if (Downloader.INSTANCE == null)
      Downloader.INSTANCE = new DownloaderXhr();
    if (CRSManager.ENGINE == null)
      CRSManager.ENGINE = await OnlineEngine.create();

    // let blobFileURL: string = rdUrl;
    // if (accountName.length > 0) blobFileURL = UrlFS.getAzureBlobSasUrl(opcConfig.accountName, opcConfig.containerName, opcConfig.blobFileName, opcConfig.sasToken);
    const urlFS: UrlFS = new UrlFS();
    // wrap a caching layer (16 MB) around the blob file
    const blobFileSize: ALong = await urlFS.getFileLength(blobFileURL);
    Logger.logTrace(loggerCategory, `OPC File Size is ${blobFileSize}`);
    const blobFile: PageCachedFile = new PageCachedFile(urlFS, blobFileURL, blobFileSize, 128 * 1024 /* pageSize */, 128 /* maxPageCount */);
    const fileReader: PointCloudReader = await OPCReader.openFile(blobFile, blobFileURL, true/* lazyLoading */);
    return fileReader;
  }

  /** Gets reality data spatial location and extents
   * @param fileReader a file reader instance obtains from call to getFileReaderFromBlobFileURL
   * @returns spatial location and volume of interest, in meters, centered around `spatial location`
   * @throws [[RealityDataError]] if source is invalid or cannot be read
   * @internal
   */
  public static async getSpatialLocationAndExtents(fileReader: PointCloudReader): Promise<SpatialLocationAndExtents> {
    let worldRange = new Range3d();
    let location: Cartographic | EcefLocation;
    let isGeolocated = true;

    const bounds = fileReader.getFileBounds();
    worldRange = Range3d.createXYZXYZ(bounds.getMinX(), bounds.getMinY(), bounds.getMinZ(), bounds.getMaxX(), bounds.getMaxY(), bounds.getMaxZ());
    isGeolocated = false;
    const fileCrs = fileReader.getFileCRS();
    if (fileCrs) {
      try {
        await CRSManager.ENGINE.prepareForArea(fileCrs, bounds);
        const wgs84ECEFCrs = "4978";
        await CRSManager.ENGINE.prepareForArea(wgs84ECEFCrs, new OrbitGtBounds());

        const ecefBounds = CRSManager.transformBounds(bounds, fileCrs, wgs84ECEFCrs);
        const ecefRange = Range3d.createXYZXYZ(ecefBounds.getMinX(), ecefBounds.getMinY(), ecefBounds.getMinZ(), ecefBounds.getMaxX(), ecefBounds.getMaxY(), ecefBounds.getMaxZ());
        const ecefCenter = ecefRange.localXYZToWorld(.5, .5, .5)!;
        const cartoCenter = Cartographic.fromEcef(ecefCenter)!;
        cartoCenter.height = 0;
        const ecefLocation = EcefLocation.createFromCartographicOrigin(cartoCenter);
        location = ecefLocation;
        // this.iModelDb.setEcefLocation(ecefLocation);
        const ecefToWorld = ecefLocation.getTransform().inverse()!;
        worldRange = ecefToWorld.multiplyRange(ecefRange);
        isGeolocated = true;
      } catch (e) {
        Logger.logWarning(loggerCategory, `Error getSpatialLocationAndExtents - cannot interpret point cloud`);
        const errorProps = BentleyError.getErrorProps(e);
        const getMetaData: LoggingMetaData = () => {
          return { errorProps };
        };
        const error = new RealityDataError(RealityDataStatus.InvalidData, "Invalid or unknown data", getMetaData);
        throw error;
      }
    } else {
      // NoGCS case
      isGeolocated = false;
      const centerOfEarth = new EcefLocation({ origin: { x: 0.0, y: 0.0, z: 0.0 }, orientation: { yaw: 0.0, pitch: 0.0, roll: 0.0 } });
      location = centerOfEarth;
      Logger.logTrace(loggerCategory, "OPC RealityData NOT Geolocated", () => ({ ...location }));
    }
    const spatialLocation: SpatialLocationAndExtents = { location, worldRange, isGeolocated };
    return spatialLocation;
  }
}

