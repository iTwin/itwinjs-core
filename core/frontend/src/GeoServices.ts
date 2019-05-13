/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "./IModelConnection";
import {
  IModelReadRpcInterface,
  PointWithStatus, IModelCoordinatesRequestProps, IModelCoordinatesResponseProps, GeoCoordinatesRequestProps, GeoCoordinatesResponseProps, GeoCoordStatus,
} from "@bentley/imodeljs-common";
import { XYZProps } from "@bentley/geometry-core";

/** Response to a request to obtain imodel coordinates from cache.
 * @internal
 */
export interface CachedIModelCoordinatesResponseProps {
  /** An array of the same length as the input array, with undefined entries at indices corresponding to points not found in cache. */
  result: Array<PointWithStatus | undefined>;
  /** An array of points in the input array which were not found in the cache, or undefined if all points were found in the cache. */
  missing?: XYZProps[];
}

// this class is used to cache results from conversion of geoCoordinates to IModelCoordinates.
class GCtoIMCResultCache {
  // see fast-memoize npm package where the author demonstrated that an object is the fastest
  //     lookup (faster than Map), and JSON.stringify is the fastest serializer.
  private _cache: any;
  private _iModel: IModelConnection;
  private _sourceDatum: string;

  constructor(iModel: IModelConnection, sourceDatum: string) {
    this._iModel = iModel;
    this._cache = {};
    this._sourceDatum = sourceDatum;
  }

  /** @internal */
  public findInCache(geoPoints: XYZProps[]): CachedIModelCoordinatesResponseProps {
    const result: Array<PointWithStatus | undefined> = [];
    let missing: XYZProps[] | undefined;
    for (const geoPoint of geoPoints) {
      const key = JSON.stringify(geoPoint);
      const imodelCoord = this._cache[key];
      result.push(imodelCoord);
      if (undefined === imodelCoord) {
        if (undefined === missing)
          missing = [];

        missing.push(geoPoint);
      }
    }

    return { result, missing };
  }

  public async findInCacheOrRequest(request: IModelCoordinatesRequestProps): Promise<IModelCoordinatesResponseProps> {
    const response: IModelCoordinatesResponseProps = { iModelCoords: [], fromCache: 0 };
    let missing: XYZProps[] | undefined;

    // Index by cache key to obtain index in input array.
    const originalPositions: any = { };

    for (let iPoint: number = 0; iPoint < request.geoCoords.length; ++iPoint) {
      const thisGeoCoord: XYZProps = request.geoCoords[iPoint];

      // we use the JSON string as the key into our cache of previously returned results.
      const thisCacheKey: string = JSON.stringify(thisGeoCoord);

      // put something in each output that corresponds to the input.
      if (this._cache[thisCacheKey]) {
        response.iModelCoords.push(this._cache[thisCacheKey]);
      } else {
        if (undefined === missing)
          missing = [];

        // add this geoCoord to the request we are going to send.
        missing.push(thisGeoCoord);

        // keep track of the original position of this point.
        originalPositions[thisCacheKey] = iPoint;

        // mark the response as pending.
        response.iModelCoords.push({ p: [0, 0, 0], s: GeoCoordStatus.Pending });
      }
    }

    // if none are missing from the cache, resolve the promise immediately
    if (undefined === missing) {
      response.fromCache = request.geoCoords.length;
    } else {
      // keep track of how many came from the cache (mostly for tests).
      response.fromCache = request.geoCoords.length - missing.length;

      // Avoiding requesting too many points at once, exceeding max request length (this definition of "too many" should be safely conservative)
      const maxPointsPerRequest = 200;
      const promises: Array<Promise<void>> = [];
      for (let i = 0; i < missing.length; i += maxPointsPerRequest) {
        const remainingRequest = { sourceDatum: this._sourceDatum, geoCoords: missing.slice(i, i + maxPointsPerRequest) };
        const promise = IModelReadRpcInterface.getClient().getIModelCoordinatesFromGeoCoordinates(this._iModel.iModelToken, JSON.stringify(remainingRequest)).then((remainingResponse) => {
          // put the responses into the cache, and fill in the output response for each
          for (let iResponse: number = 0; iResponse < remainingResponse.iModelCoords.length; ++iResponse) {
            const thisPoint: PointWithStatus = remainingResponse.iModelCoords[iResponse];

            // put the answer in the cache.
            const thisGeoCoord: XYZProps = remainingRequest!.geoCoords[iResponse];
            const thisCacheKey: string = JSON.stringify(thisGeoCoord);
            this._cache[thisCacheKey] = thisPoint;

            // transfer the answer stored in remainingResponse to the correct position in the overall response.
            const responseIndex = originalPositions[thisCacheKey];
            response.iModelCoords[responseIndex] = thisPoint;
          }
        });

        promises.push(promise);
      }

      await Promise.all(promises);
    }

    return Promise.resolve(response);
  }
}

// this class is used to cache results from conversion of IModelCoordinates to GeoCoordinates.
class IMCtoGCResultCache {
  // see fast-memoize npm package where the author demonstrated that an object is the fastest
  //     lookup (faster than Map), and JSON.stringify is the fastest serializer.
  private _cache: any;
  private _iModel: IModelConnection;
  private _targetDatum: string;

  constructor(iModel: IModelConnection, targetDatum: string) {
    this._iModel = iModel;
    this._cache = {};
    this._targetDatum = targetDatum;
  }

  public async findInCacheOrRequest(request: GeoCoordinatesRequestProps): Promise<GeoCoordinatesResponseProps> {
    let missing: boolean = false;
    const response: GeoCoordinatesResponseProps = { geoCoords: [], fromCache: 0 };
    let remainingRequest: GeoCoordinatesRequestProps | undefined;
    const originalPositions: number[] = [];

    for (let iPoint: number = 0; iPoint < request.iModelCoords.length; ++iPoint) {
      const thisIModelCoord: XYZProps = request.iModelCoords[iPoint];

      // we use the JSON string as the key into our cache of previously returned results.
      const thisCacheKey: string = JSON.stringify(thisIModelCoord);

      // put something in each output that corresponds to the input.
      if (this._cache[thisCacheKey]) {
        response.geoCoords.push(this._cache[thisCacheKey]);
      } else {
        if (!remainingRequest)
          remainingRequest = { targetDatum: this._targetDatum, iModelCoords: [] };

        // add this geoCoord to the request we are going to send.
        remainingRequest.iModelCoords.push(thisIModelCoord);
        // keep track of the original position of this point.
        originalPositions.push(iPoint);

        // mark the response as pending.
        response.geoCoords.push({ p: [0, 0, 0], s: GeoCoordStatus.Pending });

        missing = true;
      }
    }

    // if none are missing from the cache, resolve the promise immediately
    if (!missing) {
      response.fromCache = request.iModelCoords.length;
      return Promise.resolve(response);
    } else {
      // keep track of how many came from the cache (mostly for tests).
      response.fromCache = request.iModelCoords.length - originalPositions.length;
      const remainingResponse = await IModelReadRpcInterface.getClient().getGeoCoordinatesFromIModelCoordinates(this._iModel.iModelToken, JSON.stringify(remainingRequest));
      // put the responses into the cache, and fill in the output response for each
      for (let iResponse: number = 0; iResponse < remainingResponse.geoCoords.length; ++iResponse) {
        const thisPoint: PointWithStatus = remainingResponse.geoCoords[iResponse];

        // transfer the answer stored in remainingResponse to the correct position in the overall response.
        const responseIndex = originalPositions[iResponse];
        response.geoCoords[responseIndex] = thisPoint;

        // put the answer in the cache.
        const thisIModelCoord: XYZProps = remainingRequest!.iModelCoords[iResponse];
        const thisCacheKey: string = JSON.stringify(thisIModelCoord);
        this._cache[thisCacheKey] = thisPoint;
      }
      return Promise.resolve(response);
    }
  }
}

/** The GeoConverter class communicates with the backend to convert longitude/latitude coordinates to iModel coordinates and vice-versa
 * @internal
 */
export class GeoConverter {
  private _datum: string;
  private _gCtoIMCResultCache: GCtoIMCResultCache;
  private _iMCtoGCResultCache: IMCtoGCResultCache;
  constructor(iModel: IModelConnection, datum: string) {
    this._datum = datum;
    this._gCtoIMCResultCache = new GCtoIMCResultCache(iModel, datum);
    this._iMCtoGCResultCache = new IMCtoGCResultCache(iModel, datum);
  }

  public async getIModelCoordinatesFromGeoCoordinates(geoPoints: XYZProps[]): Promise<IModelCoordinatesResponseProps> {
    const requestProps: IModelCoordinatesRequestProps = { sourceDatum: this._datum, geoCoords: geoPoints };
    return this._gCtoIMCResultCache.findInCacheOrRequest(requestProps);
  }

  public getCachedIModelCoordinatesFromGeoCoordinates(geoPoints: XYZProps[]): CachedIModelCoordinatesResponseProps {
    return this._gCtoIMCResultCache.findInCache(geoPoints);
  }

  public async getGeoCoordinatesFromIModelCoordinates(iModelPoints: XYZProps[]): Promise<GeoCoordinatesResponseProps> {
    const requestProps: GeoCoordinatesRequestProps = { targetDatum: this._datum, iModelCoords: iModelPoints };
    return this._iMCtoGCResultCache.findInCacheOrRequest(requestProps);
  }
}

/** The Geographic Services available for an [[IModelConnection]].
 * @internal
 */
export class GeoServices {
  private _iModel: IModelConnection;

  constructor(iModel: IModelConnection) {
    this._iModel = iModel;
  }

  public getConverter(datum?: string): GeoConverter {
    return new GeoConverter(this._iModel, datum ? datum : "");
  }
}
