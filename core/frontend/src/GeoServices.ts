/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

// cspell:ignore GCRS
import {
  assert, BeEvent, Dictionary, Logger, SortedArray,
} from "@itwin/core-bentley";
import { WritableXYAndZ, XYAndZ, XYZProps } from "@itwin/core-geometry";
import {
  GeoCoordinatesResponseProps, GeoCoordStatus, GeographicCRSProps, IModelCoordinatesResponseProps, IModelReadRpcInterface, PointWithStatus,
} from "@itwin/core-common";
import { IModelConnection } from "./IModelConnection";
import { FrontendLoggerCategory } from "./common/FrontendLoggerCategory";

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
 * A [[GeoConverter]] has a pair of these for converting between iModel coordinates and geographic coordinates.
 * Uses a cache to avoid repeatedly requesting the same points, and a batching strategy to avoid making frequent small requests.
 * The cache stores every point that was ever converted by [[convert]]. It is currently permitted to grow to unbounded size.
 * The batching works as follows:
 *  When a conversion is requested via [[convert]], if all the requested points are in the cache, they are returned immediately.
 *  Otherwise, any points not in the cache and not in the current in-flight request (if any) are placed onto the queue of pending requests.
 *  A pending request is scheduled if one hasn't already been scheduled, via requestAnimationFrame.
 *  In the animation frame callback, the pending requests are split into batches of no more than options.maxPointsPerRequest and dispatched to the backend.
 *  Once the response is received, the results are loaded into and returned from the cache.
 *  If more calls to convert occurred while the request was in flight, another request is dispatched.
 * @internal exported strictly for tests.
 */
export class CoordinateConverter {
  protected readonly _cache: Dictionary<XYAndZ, PointWithStatus>;
  protected _state: CoordinateConverterState = "idle";
  // The accumulated set of points to be converted by the next request.
  protected _pending: SortedArray<XYAndZ>;
  // The set of points that were included in the current in-flight request, if any.
  protected _inflight: SortedArray<XYAndZ>;
  // An event fired when the next request completes.
  protected _onCompleted = new BeEvent<() => void>();
  // Used for creating cache keys (XYAndZ) from XYZProps without having to allocate temporary objects.
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

    // Pending requests are now in flight. Start a new list of pending requests. It's cheaper to swap than to allocate new objects.
    const inflight = this._pending;
    this._pending = this._inflight;
    assert(this._pending.isEmpty);
    this._inflight = inflight;

    // Split requests if necessary to avoid requesting more than the maximum allowed number of points.
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

    // If any more pending conversions arrived while awaiting this request, schedule another request.
    if (!this._pending.isEmpty)
      this.scheduleDispatch(); // eslint-disable-line @typescript-eslint/no-floating-promises

    // Resolve promises of all callers who were awaiting this request.
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

  // Obtain converted points from the cache. The assumption is that every point in `inputs` is already present in the cache.
  // Any point not present will be returned unconverted with an error status.
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
      requestAnimationFrame(() => {
        this.dispatch(); // eslint-disable-line @typescript-eslint/no-floating-promises
      });
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

  public findCached(inputs: XYZProps[]): CachedIModelCoordinatesResponseProps {
    const result: Array<PointWithStatus | undefined> = [];
    let missing: XYZProps[] | undefined;
    for (const input of inputs) {
      const key = this.toXYAndZ(input, this._scratchXYZ);
      const output = this._cache.get(key);
      result.push(output);
      if (!output) {
        if (!missing)
          missing = [];

        missing.push(input);
      }
    }

    return { result, missing };
  }
}

/** Response to a request to obtain imodel coordinates from cache.
 * @internal
 */
export interface CachedIModelCoordinatesResponseProps {
  /** An array of the same length as the input array, with undefined entries at indices corresponding to points not found in cache. */
  result: Array<PointWithStatus | undefined>;
  /** An array of points in the input array which were not found in the cache, or undefined if all points were found in the cache. */
  missing?: XYZProps[];
}

/** An object capable of communicating with the backend to convert between coordinates in a geographic coordinate system and coordinates in an [[IModelConnection]]'s own coordinate system.
 * @see [[GeoServices.getConverter]] to obtain a converter.
 * @see [GeographicCRS]($common) for more information about geographic coordinate reference systems.
 * @public
 */
export class GeoConverter {
  private readonly _geoToIModel: CoordinateConverter;
  private readonly _iModelToGeo: CoordinateConverter;

  /** @internal */
  constructor(iModel: IModelConnection, datumOrGCRS: string | GeographicCRSProps) {
    const datum = typeof datumOrGCRS === "object" ? JSON.stringify(datumOrGCRS) : datumOrGCRS;

    this._geoToIModel = new CoordinateConverter({
      iModel,
      requestPoints: async (geoCoords: XYAndZ[]) => {
        const request = { source: datum, geoCoords };
        const rpc = IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token);
        const response = await rpc.getIModelCoordinatesFromGeoCoordinates(iModel.getRpcProps(), request);
        return response.iModelCoords;
      },
    });

    this._iModelToGeo = new CoordinateConverter({
      iModel,
      requestPoints: async (iModelCoords: XYAndZ[]) => {
        const request = { target: datum, iModelCoords };
        const rpc = IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token);
        const response = await rpc.getGeoCoordinatesFromIModelCoordinates(iModel.getRpcProps(), request);
        return response.geoCoords;
      },
    });
  }

  /** Convert the specified geographic coordinates into iModel coordinates. */
  public async convertToIModelCoords(geoPoints: XYZProps[]): Promise<PointWithStatus[]> {
    const result = await this.getIModelCoordinatesFromGeoCoordinates(geoPoints);
    return result.iModelCoords;
  }

  /** Convert the specified iModel coordinates into geographic coordinates. */
  public async convertFromIModelCoords(iModelCoords: XYZProps[]): Promise<PointWithStatus[]> {
    const result = await this.getGeoCoordinatesFromIModelCoordinates(iModelCoords);
    return result.geoCoords;
  }

  /** @internal */
  public async getIModelCoordinatesFromGeoCoordinates(geoPoints: XYZProps[]): Promise<IModelCoordinatesResponseProps> {
    const result = await this._geoToIModel.convert(geoPoints);
    return {
      iModelCoords: result.points,
      fromCache: result.fromCache,
    };
  }

  /** @internal */
  public async getGeoCoordinatesFromIModelCoordinates(iModelPoints: XYZProps[]): Promise<GeoCoordinatesResponseProps> {
    const result = await this._iModelToGeo.convert(iModelPoints);
    return {
      geoCoords: result.points,
      fromCache: result.fromCache,
    };
  }

  /** @internal */
  public getCachedIModelCoordinatesFromGeoCoordinates(geoPoints: XYZProps[]): CachedIModelCoordinatesResponseProps {
    return this._geoToIModel.findCached(geoPoints);
  }
}

/** The Geographic Services available for an [[IModelConnection]].
 * @see [[IModelConnection.geoServices]] to obtain the GeoServices for a specific iModel.
 * @public
 */
export class GeoServices {
  private _iModel: IModelConnection;

  /** @internal */
  constructor(iModel: IModelConnection) {
    this._iModel = iModel;
  }

  /** Obtain a converter that can convert between a geographic coordinate system and the iModel's own coordinate system.
   * @param datumOrGCRS The name or JSON representation of the geographic coordinate system datum - for example, "WGS84".
   * @returns a converter, or `undefined` if the iModel is not open.
   * @note A [[BlankConnection]] has no connection to a backend, so it is never "open"; therefore it always returns `undefined`.
   */
  public getConverter(datumOrGCRS?: string | GeographicCRSProps): GeoConverter | undefined {
    return this._iModel.isOpen ? new GeoConverter(this._iModel, datumOrGCRS ? datumOrGCRS : "") : undefined;
  }
}
