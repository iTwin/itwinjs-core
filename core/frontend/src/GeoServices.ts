/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:ignore GCRS
import {
  assert, BeEvent, Dictionary, Logger, SortedArray,
} from "@itwin/core-bentley";
import { WritableXYAndZ, XYAndZ, XYZProps } from "@itwin/core-geometry";
import {
  GeoCoordinatesRequestProps, GeoCoordinatesResponseProps, GeoCoordStatus, GeographicCRSProps, IModelCoordinatesRequestProps, IModelCoordinatesResponseProps,
  IModelReadRpcInterface, PointWithStatus,
} from "@itwin/core-common";
import { IModelConnection } from "./IModelConnection";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";

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
  private _source: string;

  constructor(iModel: IModelConnection, source: string) {
    this._iModel = iModel;
    this._cache = {};
    this._source = source;
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
    const originalPositions: any = {};

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
        if (originalPositions.hasOwnProperty(thisCacheKey)) {
          // it is a duplicate of an earlier point (or points)
          if (Array.isArray(originalPositions[thisCacheKey])) {
            originalPositions[thisCacheKey].push(iPoint);
          } else {
            const list: number[] = [originalPositions[thisCacheKey], iPoint];
            originalPositions[thisCacheKey] = list;
          }
        } else {
          originalPositions[thisCacheKey] = iPoint;
        }

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

      // Avoiding requesting too many points at once, exceeding max request length (this definition of "too many" should be safely conservative)  - but enough to load 4 levels of tile corners.
      const maxPointsPerRequest = 300;
      const promises: Array<Promise<void>> = [];
      for (let i = 0; i < missing.length; i += maxPointsPerRequest) {
        const remainingRequest = { source: this._source, geoCoords: missing.slice(i, i + maxPointsPerRequest) };
        const promise = IModelReadRpcInterface.getClientForRouting(this._iModel.routingContext.token).getIModelCoordinatesFromGeoCoordinates(this._iModel.getRpcProps(), remainingRequest).then((remainingResponse) => {
          // put the responses into the cache, and fill in the output response for each
          for (let iResponse: number = 0; iResponse < remainingResponse.iModelCoords.length; ++iResponse) {
            const thisPoint: PointWithStatus = remainingResponse.iModelCoords[iResponse];

            // put the answer in the cache.
            const thisGeoCoord: XYZProps = remainingRequest.geoCoords[iResponse];
            const thisCacheKey: string = JSON.stringify(thisGeoCoord);
            this._cache[thisCacheKey] = thisPoint;

            // transfer the answer stored in remainingResponse to the correct position in the overall response.
            const responseIndex = originalPositions[thisCacheKey];
            if (Array.isArray(responseIndex)) {
              for (const thisIndex of responseIndex) {
                response.iModelCoords[thisIndex] = thisPoint;
              }
            } else {
              response.iModelCoords[responseIndex] = thisPoint;
            }
          }
        });

        promises.push(promise);
      }

      await Promise.all(promises);
    }

    return response;
  }
}

// this class is used to cache results from conversion of IModelCoordinates to GeoCoordinates.
class IMCtoGCResultCache {
  // see fast-memoize npm package where the author demonstrated that an object is the fastest
  //     lookup (faster than Map), and JSON.stringify is the fastest serializer.
  private _cache: any;
  private _iModel: IModelConnection;
  private _target: string;

  constructor(iModel: IModelConnection, target: string) {
    this._iModel = iModel;
    this._cache = {};
    this._target = target;
  }

  public async findInCacheOrRequest(request: GeoCoordinatesRequestProps): Promise<GeoCoordinatesResponseProps> {
    let missing: boolean = false;
    const response: GeoCoordinatesResponseProps = { geoCoords: [], fromCache: 0 };
    let remainingRequest: GeoCoordinatesRequestProps | undefined;
    const originalPositions: number[] = [];

    for (let iPoint = 0; iPoint < request.iModelCoords.length; ++iPoint) {
      const thisIModelCoord = request.iModelCoords[iPoint];

      // we use the JSON string as the key into our cache of previously returned results.
      const thisCacheKey = JSON.stringify(thisIModelCoord);

      // put something in each output that corresponds to the input.
      if (this._cache[thisCacheKey]) {
        response.geoCoords.push(this._cache[thisCacheKey]);
      } else {
        if (!remainingRequest)
          remainingRequest = { target: this._target, iModelCoords: [] };

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
      return response;
    } else {
      // keep track of how many came from the cache (mostly for tests).
      response.fromCache = request.iModelCoords.length - originalPositions.length;
      const remainingResponse = await IModelReadRpcInterface.getClientForRouting(this._iModel.routingContext.token).getGeoCoordinatesFromIModelCoordinates(this._iModel.getRpcProps(), remainingRequest!);
      // put the responses into the cache, and fill in the output response for each
      for (let iResponse = 0; iResponse < remainingResponse.geoCoords.length; ++iResponse) {
        const thisPoint: PointWithStatus = remainingResponse.geoCoords[iResponse];

        // transfer the answer stored in remainingResponse to the correct position in the overall response.
        const responseIndex = originalPositions[iResponse];
        response.geoCoords[responseIndex] = thisPoint;

        // put the answer in the cache.
        const thisIModelCoord = remainingRequest!.iModelCoords[iResponse];
        const thisCacheKey = JSON.stringify(thisIModelCoord);
        this._cache[thisCacheKey] = thisPoint;
      }
      return response;
    }
  }
}

/** The GeoConverter class communicates with the backend to convert longitude/latitude coordinates to iModel coordinates and vice-versa
 * @internal
 */
export class GeoConverter {
  private _datumOrGCRS: string;
  private _gCtoIMCResultCache: GCtoIMCResultCache;
  private _iMCtoGCResultCache: IMCtoGCResultCache;
  constructor(iModel: IModelConnection, datumOrGCRS: string | GeographicCRSProps) {
    if (typeof (datumOrGCRS) === "object")
      this._datumOrGCRS = JSON.stringify(datumOrGCRS);
    else
      this._datumOrGCRS = datumOrGCRS;
    this._gCtoIMCResultCache = new GCtoIMCResultCache(iModel, this._datumOrGCRS);
    this._iMCtoGCResultCache = new IMCtoGCResultCache(iModel, this._datumOrGCRS);
  }

  public async getIModelCoordinatesFromGeoCoordinates(geoPoints: XYZProps[]): Promise<IModelCoordinatesResponseProps> {
    const requestProps: IModelCoordinatesRequestProps = { source: this._datumOrGCRS, geoCoords: geoPoints };
    return this._gCtoIMCResultCache.findInCacheOrRequest(requestProps);
  }

  public getCachedIModelCoordinatesFromGeoCoordinates(geoPoints: XYZProps[]): CachedIModelCoordinatesResponseProps {
    return this._gCtoIMCResultCache.findInCache(geoPoints);
  }

  public async getGeoCoordinatesFromIModelCoordinates(iModelPoints: XYZProps[]): Promise<GeoCoordinatesResponseProps> {
    const requestProps: GeoCoordinatesRequestProps = { target: this._datumOrGCRS, iModelCoords: iModelPoints };
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

  public getConverter(datumOrGCRS?: string | GeographicCRSProps): GeoConverter | undefined {
    return this._iModel.isOpen ? new GeoConverter(this._iModel, datumOrGCRS ? datumOrGCRS : "") : undefined;
  }
}

/** Options used to create a [[CoordinateConverter]].
 * @internal exported strictly for tests.
 */
export interface CoordinateConverterOptions {
  /** The iModel for which to perform the conversions. */
  iModel: IModelConnection;
  /** Asynchronously convert each point. The resultant array should have the same number and order of points as the input. */
  requestPoints: (points: XYAndZ[]) => Promise<PointWithStatus[]>;
  /** Maximum number of points to include in each request. Default: 300. */
  maxPointsPerRequest?: number;
}

function compareXYAndZ(lhs: XYAndZ, rhs: XYAndZ): number {
  return lhs.x - rhs.x || lhs.y - rhs.y || lhs.z - rhs.z;
}

function cloneXYAndZ(xyz: XYAndZ): XYAndZ {
  return { x: xyz.x, y: xyz.y, z: xyz.z };
}

type CoordinateConverterState =
  // No pending requests.
  "idle" |
  // We have scheduled a requestAnimationFrame to dispatch all pending requests.
  "scheduled" |
  // We have dispatched all requests that were pending at the most recent requestAnimationFrame callback.
  "in-flight";

/** Performs conversion of coordinates from one coordinate system to another.
 * ###TODO update this...
 * Uses a cache to avoid repeatedly requesting the same points, and a batching strategy to avoid making many small requests.
 * The batching and caching works as follows:
 *  When a conversion is requested via [[convert]], if all the requested points are in the cache, they are returned immediately.
 *  Otherwise, any points not in the cache are placed onto the queue of pending requests.
 *  If the queue size exceeds options.maxPointsPerRequest, the request will be dispatched immediately; otherwise, it will be schedule for dispatch in options.requestInterval frames.
 *  Requests are split into batches of no more than options.maxPointsPerRequest.
 *  Once the requests complete, the results are loaded into and returned from the cache.
 *  Currently, the cache is permitted to grow in an unbounded fashion.
 * A [[GeoConverter]] has a pair of these for converting between iModel coordinates and geographic coordinates.
 * @internal exported strictly for tests.
 */
export class CoordinateConverter {
  protected readonly _cache: Dictionary<XYAndZ, PointWithStatus>;
  protected _state: CoordinateConverterState = "idle";
  // pending and inflight get swapped each time we dispatch.
  protected _pending: SortedArray<XYAndZ>;
  protected _inflight: SortedArray<XYAndZ>;
  // _onCompleted gets replaced each time we dispatch.
  protected _onCompleted = new BeEvent<() => void>();
  protected readonly _scratchXYZ = { x: 0, y: 0, z: 0 };
  protected readonly _maxPointsPerRequest: number;
  protected readonly _iModel: IModelConnection;
  protected readonly _requestPoints: (points: XYAndZ[]) => Promise<PointWithStatus[]>;

  protected toXYAndZ(input: XYZProps, output: WritableXYAndZ): XYAndZ {
    if (Array.isArray(input)) {
      output.x = input[0] ?? 0;
      output.y = input[1] ?? 0;
      output.z = input[2] ?? 0;
    } else {
      output.x = input.x ?? 0;
      output.y = input.y ?? 0;
      output.z = input.z ?? 0;
    }

    return output;
  }

  public constructor(opts: CoordinateConverterOptions) {
    this._maxPointsPerRequest = Math.max(1, opts.maxPointsPerRequest ?? 300);
    this._iModel = opts.iModel;
    this._requestPoints = opts.requestPoints;

    this._cache = new Dictionary<XYAndZ, PointWithStatus>(compareXYAndZ, cloneXYAndZ);
    this._pending = new SortedArray<XYAndZ>(compareXYAndZ, false, cloneXYAndZ);
    this._inflight = new SortedArray<XYAndZ>(compareXYAndZ, false, cloneXYAndZ);
  }

  protected async dispatch(): Promise<void> {
    assert(this._state === "scheduled");
    if (this._iModel.isClosed || this._pending.isEmpty) {
      this._state = "idle";
      this._onCompleted.raiseEvent();
      return;
    }

    this._state = "in-flight";

    // Ensure subsequently-enqueued requests listen for the *next* response to be received.
    const onCompleted = this._onCompleted;
    this._onCompleted = new BeEvent<() => void>();

    // Pending requests are now in flight. Start a new list of pending requests. It's cheaper just to swap.
    const inflight = this._pending;
    this._pending = this._inflight;
    assert(this._pending.isEmpty);
    this._inflight = inflight;

    const promises: Array<Promise<void>> = [];
    for (let i = 0; i < inflight.length; i += this._maxPointsPerRequest) {
      const requests = inflight.slice(i, i + this._maxPointsPerRequest).extractArray();
      const promise = this._requestPoints(requests).then((results) => {
        if (this._iModel.isClosed)
          return;

        if (results.length !== requests.length)
          Logger.logError(`${FrontendLoggerCategory.Package}.geoservices`, `requested conversion of ${requests.length} points, but received ${results.length} points`);

        for (let j = 0; j < results.length; j++) {
          if (j < requests.length)
            this._cache.set(requests[j], results[j]);
        }
      }).catch((err) => {
        Logger.logException(`${FrontendLoggerCategory.Package}.geoservices`, err);
      });

      promises.push(promise);
    }

    await Promise.all(promises);

    assert(this._state === "in-flight");
    this._state = "idle";
    this._inflight.clear();

    if (!this._pending.isEmpty)
      this.scheduleDispatch();

    onCompleted.raiseEvent();
  }

  // Add any points not present in cache to pending request list.
  // Return the number of points present in cache.
  protected enqueue(points: XYZProps[]): number {
    let numInCache = 0;
    for (const point of points) {
      const xyz = this.toXYAndZ(point, this._scratchXYZ);
      if (this._cache.get(xyz))
        ++numInCache;
      else if (!this._inflight.contains(xyz))
        this._pending.insert(xyz);
    }

    return numInCache;
  }

  protected getFromCache(inputs: XYZProps[]): PointWithStatus[] {
    const outputs: PointWithStatus[] = [];
    for (const input of inputs) {
      const xyz = this.toXYAndZ(input, this._scratchXYZ);
      let output = this._cache.get(xyz);
      if (!output)
        output = { p: { ...xyz }, s: GeoCoordStatus.CSMapError };

      outputs.push(output);
    }

    return outputs;
  }

  protected async scheduleDispatch(): Promise<void> {
    if ("idle" === this._state) {
      this._state = "scheduled";
      requestAnimationFrame(() => this.dispatch());
    }

    return new Promise((resolve) => {
      this._onCompleted.addOnce(() => resolve());
    });
  }

  public async convert(inputs: XYZProps[]): Promise<{ points: PointWithStatus[], fromCache: number }> {
    const fromCache = this.enqueue(inputs);
    assert(fromCache >= 0);
    assert(fromCache <= inputs.length);

    if (fromCache === inputs.length)
      return { points: this.getFromCache(inputs), fromCache };

    await this.scheduleDispatch();

    return { points: this.getFromCache(inputs), fromCache };
  }
}
