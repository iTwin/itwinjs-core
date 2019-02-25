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

  public async findInCacheOrRequest(request: IModelCoordinatesRequestProps): Promise<IModelCoordinatesResponseProps> {
    let missing: boolean = false;
    const response: IModelCoordinatesResponseProps = { iModelCoords: [], fromCache: 0 };
    let remainingRequest: IModelCoordinatesRequestProps | undefined;
    const originalPositions: number[] = [];

    for (let iPoint: number = 0; iPoint < request.geoCoords.length; ++iPoint) {
      const thisGeoCoord: XYZProps = request.geoCoords[iPoint];

      // we use the JSON string as the key into our cache of previously returned results.
      const thisCacheKey: string = JSON.stringify(thisGeoCoord);

      // put something in each output that corresponds to the input.
      if (this._cache[thisCacheKey]) {
        response.iModelCoords.push(this._cache[thisCacheKey]);
      } else {
        if (!remainingRequest)
          remainingRequest = { sourceDatum: this._sourceDatum, geoCoords: [] };

        // add this geoCoord to the request we are going to send.
        remainingRequest.geoCoords.push(thisGeoCoord);
        // keep track of the original position of this point.
        originalPositions.push(iPoint);

        // mark the response as pending.
        response.iModelCoords.push({ p: [0, 0, 0], s: GeoCoordStatus.Pending });

        missing = true;
      }
    }

    // if none are missing from the cache, resolve the promise immediately
    if (!missing) {
      response.fromCache = request.geoCoords.length;
      return Promise.resolve(response);
    } else {
      // keep track of how many came from the cache (mostly for tests).
      response.fromCache = request.geoCoords.length - originalPositions.length;
      const remainingResponse = await IModelReadRpcInterface.getClient().getIModelCoordinatesFromGeoCoordinates(this._iModel.iModelToken, JSON.stringify(remainingRequest));
      // put the responses into the cache, and fill in the output response for each
      for (let iResponse: number = 0; iResponse < remainingResponse.iModelCoords.length; ++iResponse) {
        const thisPoint: PointWithStatus = remainingResponse.iModelCoords[iResponse];

        // transfer the answer stored in remainingResponse to the correct position in the overall response.
        const responseIndex = originalPositions[iResponse];
        response.iModelCoords[responseIndex] = thisPoint;

        // put the answer in the cache.
        const thisGeoCoord: XYZProps = remainingRequest!.geoCoords[iResponse];
        const thisCacheKey: string = JSON.stringify(thisGeoCoord);
        this._cache[thisCacheKey] = thisPoint;
      }
      return Promise.resolve(response);
    }
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

/**
 * The GeoConverter class communicates with the backend to convert longitude/latitude coordinates to iModel coordinates and vice-versa
 * @internal
 * @hidden
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

  public async getGeoCoordinatesFromIModelCoordinates(iModelPoints: XYZProps[]): Promise<GeoCoordinatesResponseProps> {
    const requestProps: GeoCoordinatesRequestProps = { targetDatum: this._datum, iModelCoords: iModelPoints };
    return this._iMCtoGCResultCache.findInCacheOrRequest(requestProps);
  }
}

/**
 * The Geographic Services available for an [[IModelConnection]].
 * @internal
 * @hidden
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
