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
  GeoCoordinatesRequestProps, GeoCoordinatesResponseProps, GeoCoordStatus, GeographicCRSProps, IModelCoordinatesRequestProps, IModelCoordinatesResponseProps,
  IModelReadRpcInterface, PointWithStatus,
} from "@itwin/core-common";
import { IModelConnection } from "./IModelConnection";
import { FrontendLoggerCategory } from "./common/FrontendLoggerCategory";

/** Options used to create a [[CoordinateConverter]].
 * @internal exported strictly for tests.
 */
export interface CoordinateConverterOptions {
  isIModelClosed: () => boolean;
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
  protected readonly _isIModelClosed: () => boolean;
  protected readonly _requestPoints: (points: XYAndZ[]) => Promise<PointWithStatus[]>;
  // If true, [[dispatch]] will schedule another dispatch after it receives a response.
  // This is needed when all the points requested after the most recent dispatch were included in the currently-in-flight request -
  // _pending will be empty but new callers will be awaiting the results of the in-flight request.
  protected _redispatchOnCompletion = false;

  public get isIdle(): boolean {
    return "idle" === this._state;
  }

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
    this._isIModelClosed = opts.isIModelClosed;
    this._requestPoints = opts.requestPoints;

    this._cache = new Dictionary<XYAndZ, PointWithStatus>(compareXYAndZ, cloneXYAndZ);
    this._pending = new SortedArray<XYAndZ>(compareXYAndZ, false, cloneXYAndZ);
    this._inflight = new SortedArray<XYAndZ>(compareXYAndZ, false, cloneXYAndZ);
  }

  protected async dispatch(): Promise<void> {
    assert(this._state === "scheduled");
    if (this._isIModelClosed() || this._pending.isEmpty) {
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
        if (this._isIModelClosed())
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
    if (!this._pending.isEmpty || this._redispatchOnCompletion) {
      this._redispatchOnCompletion = false;
      this.scheduleDispatch(); // eslint-disable-line @typescript-eslint/no-floating-promises
    }

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
      else if (this._inflight.contains(xyz))
        this._redispatchOnCompletion = true;
      else
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

/** Options used to create a [[GeoConverter]].
 * @internal exported strictly for tests.
 */
export interface GeoConverterOptions {
  readonly datum: string;
  isIModelClosed: () => boolean;
  toIModelCoords: (request: IModelCoordinatesRequestProps) => Promise<PointWithStatus[]>;
  fromIModelCoords: (request: GeoCoordinatesRequestProps) => Promise<PointWithStatus[]>;
}

/** An object capable of communicating with the backend to convert between coordinates in a geographic coordinate system and coordinates in an [[IModelConnection]]'s own coordinate system.
 * @see [[GeoServices.getConverter]] to obtain a converter.
 * @see [GeographicCRS]($common) for more information about geographic coordinate reference systems.
 * @public
 */
export class GeoConverter {
  private readonly _geoToIModel: CoordinateConverter;
  private readonly _iModelToGeo: CoordinateConverter;
  /** Used for removing this converter from GeoServices' cache after all requests are completed.
   * @internal
   */
  public readonly onAllRequestsCompleted = new BeEvent<() => void>();

  /** @internal */
  constructor(opts: GeoConverterOptions) {
    const isIModelClosed = opts.isIModelClosed;
    this._geoToIModel = new CoordinateConverter({
      isIModelClosed,
      requestPoints: async (geoCoords: XYAndZ[]) => opts.toIModelCoords({ source: opts.datum, geoCoords }),
    });

    this._iModelToGeo = new CoordinateConverter({
      isIModelClosed,
      requestPoints: async (iModelCoords: XYAndZ[]) => opts.fromIModelCoords({ target: opts.datum, iModelCoords }),
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
    this.checkCompletion();
    return {
      iModelCoords: result.points,
      fromCache: result.fromCache,
    };
  }

  /** @internal */
  public async getGeoCoordinatesFromIModelCoordinates(iModelPoints: XYZProps[]): Promise<GeoCoordinatesResponseProps> {
    const result = await this._iModelToGeo.convert(iModelPoints);
    this.checkCompletion();
    return {
      geoCoords: result.points,
      fromCache: result.fromCache,
    };
  }

  private checkCompletion(): void {
    if (this._geoToIModel.isIdle && this._iModelToGeo.isIdle)
      this.onAllRequestsCompleted.raiseEvent();
  }

  /** @internal */
  public getCachedIModelCoordinatesFromGeoCoordinates(geoPoints: XYZProps[]): CachedIModelCoordinatesResponseProps {
    return this._geoToIModel.findCached(geoPoints);
  }
}

/** @internal */
export type GeoServicesOptions = Omit<GeoConverterOptions, "datum">;

/** The Geographic Services available for an [[IModelConnection]].
 * @see [[IModelConnection.geoServices]] to obtain the GeoServices for a specific iModel.
 * @public
 */
export class GeoServices {
  private readonly _options: GeoServicesOptions;
  /** Each GeoConverter has its own independent request queue and cache of previously-converted points.
   * Some callers like RealityTileTree obtain a single GeoConverter and reuse it throughout their own lifetime. Therefore they benefit from both batching and caching, and
   * the cache gets deleted once the RealityTileTree becomes disused.
   *
   * Other callers like IModelConnection.spatialToCartographic obtain a new GeoConverter every time they need one, use it to convert a single point(!), and then discard the converter.
   * This entirely prevents batching - e.g., calling spatialToCartographic 20 times in one frame results in 20 http requests.
   * To address that, we cache each GeoConverter returned by getConverter until it has converted at least one point and has no further outstanding conversion requests.
   * In this way, the converter lives for as long as (and no longer than) any caller is awaiting conversion to/from its datum - it and its cache are deleted once it becomes disused.
   * This makes the coordinate caching generally less useful, but at least bounded - and maximizes batching of requests.
   */
  private readonly _cache = new Map<string, GeoConverter>();

  /** @internal */
  public constructor(options: GeoServicesOptions) {
    this._options = options;
  }

  /** @internal */
  public static createForIModel(iModel: IModelConnection): GeoServices {
    return new GeoServices({
      isIModelClosed: () => iModel.isClosed,
      toIModelCoords: async (request) => {
        const rpc = IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token);
        const response = await rpc.getIModelCoordinatesFromGeoCoordinates(iModel.getRpcProps(), request);
        return response.iModelCoords;
      },
      fromIModelCoords: async (request) => {
        const rpc = IModelReadRpcInterface.getClientForRouting(iModel.routingContext.token);
        const response = await rpc.getGeoCoordinatesFromIModelCoordinates(iModel.getRpcProps(), request);
        return response.geoCoords;
      },
    });
  }

  /** Obtain a converter that can convert between a geographic coordinate system and the iModel's own coordinate system.
   * @param datumOrGCRS The name or JSON representation of the geographic coordinate system datum - for example, "WGS84".
   * @returns a converter, or `undefined` if the iModel is not open.
   * @note A [[BlankConnection]] has no connection to a backend, so it is never "open"; therefore it always returns `undefined`.
   */
  public getConverter(datumOrGCRS?: string | GeographicCRSProps): GeoConverter | undefined {
    if (this._options.isIModelClosed())
      return undefined;

    const datum = (typeof datumOrGCRS === "object" ? JSON.stringify(datumOrGCRS) : datumOrGCRS) ?? "";

    let converter = this._cache.get(datum);
    if (!converter) {
      converter = new GeoConverter({ ...this._options, datum });
      this._cache.set(datum, converter);

      converter.onAllRequestsCompleted.addOnce(() => {
        if (converter === this._cache.get(datum))
          this._cache.delete(datum);
      });
    }

    return converter;
  }
}
