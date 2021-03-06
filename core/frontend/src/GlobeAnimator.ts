/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Arc3d, Geometry, Point3d, SmoothTransformBetweenFrusta } from "@bentley/geometry-core";
import { Cartographic, Easing, Frustum, GlobeMode, Interpolation, Tweens } from "@bentley/imodeljs-common";
import {
  areaToEyeHeight, areaToEyeHeightFromGcs, eyeToCartographicOnGlobe, GlobalLocation, metersToRange, ViewGlobalLocationConstants,
} from "./ViewGlobalLocation";
import { ScreenViewport } from "./Viewport";
import { Animator } from "./ViewAnimation";

/** Object to animate a frustum transition of a viewport moving across the earth. The [[Viewport]] will show as many frames as necessary. The animation will last a variable length of time depending on the distance traversed.
 * This operates on the previous frustum and a destination cartographic coordinate, flying along an earth ellipsoid or flat plane.
 * @internal
 */
export class GlobeAnimator implements Animator {
  protected _flightTweens = new Tweens();
  protected _viewport: ScreenViewport;
  protected _startCartographic?: Cartographic;
  protected _ellipsoidArc?: Arc3d;
  protected _columbusLine: Point3d[] = [];
  protected _flightLength = 0;
  protected _endLocation: GlobalLocation;
  protected _endHeight?: number;
  protected _midHeight?: number;
  protected _startHeight?: number;
  protected _fixTakeoffInterpolator?: SmoothTransformBetweenFrusta;
  protected _fixTakeoffFraction?: number;
  protected _fixLandingInterpolator?: SmoothTransformBetweenFrusta;
  protected _afterLanding: Frustum;
  protected readonly _fixLandingFraction: number = 0.9;
  protected readonly _scratchFrustum = new Frustum();

  protected _moveFlightToFraction(fraction: number): boolean {
    const vp = this._viewport;
    const view = vp.view;

    if (!(view.is3d()) || !vp.iModel.isGeoLocated) // This animation only works for 3d views and geolocated models
      return true;

    // If we're done, set the final state directly
    if (fraction >= 1.0) {
      vp.setupViewFromFrustum(this._afterLanding);
      vp.synchWithView();
      return true;
    }

    // Possibly smooth the takeoff
    if (fraction < this._fixTakeoffFraction! && this._fixTakeoffInterpolator !== undefined) {
      this._moveFixToFraction((1.0 / this._fixTakeoffFraction!) * fraction, this._fixTakeoffInterpolator);
      return false;
    }

    // Possibly smooth the landing
    if (fraction >= this._fixLandingFraction && fraction < 1.0) {
      if (this._fixLandingInterpolator === undefined) {
        const beforeLanding = vp.getWorldFrustum();
        this._fixLandingInterpolator = SmoothTransformBetweenFrusta.create(beforeLanding.points, this._afterLanding.points);
      }
      this._moveFixToFraction((1.0 / (1.0 - this._fixLandingFraction)) * (fraction - this._fixLandingFraction), this._fixLandingInterpolator!);
      return false;
    }

    // Set the camera based on a fraction along the flight arc
    const height: number = Interpolation.Bezier([this._startHeight, this._midHeight, this._endHeight], fraction);
    let targetPoint: Point3d;
    if (view.globeMode === GlobeMode.Plane)
      targetPoint = this._columbusLine[0].interpolate(fraction, this._columbusLine[1]);
    else
      targetPoint = this._ellipsoidArc!.fractionToPoint(fraction);
    view.lookAtGlobalLocation(height, ViewGlobalLocationConstants.birdPitchAngleRadians, undefined, targetPoint);
    vp.setupFromView();

    return false;
  }

  // Apply a SmoothTransformBetweenFrusta interpolator to the view based on a fraction.
  protected _moveFixToFraction(fract: number, interpolator: SmoothTransformBetweenFrusta): boolean {
    let done = false;

    if (fract >= 1.0) {
      fract = 1.0;
      done = true;
    }

    interpolator.fractionToWorldCorners(Math.max(fract, 0), this._scratchFrustum.points);
    this._viewport.setupViewFromFrustum(this._scratchFrustum);
    return done;
  }

  public static async create(viewport: ScreenViewport, destination: GlobalLocation): Promise<GlobeAnimator | undefined> {
    const view = viewport.view;

    if (!(view.is3d()) || !viewport.iModel.isGeoLocated) // This animation only works for 3d views and geolocated models
      return;

    const endHeight = destination.area !== undefined ? await areaToEyeHeightFromGcs(view, destination.area, destination.center.height) : ViewGlobalLocationConstants.birdHeightAboveEarthInMeters;

    const beforeFrustum = viewport.getWorldFrustum();
    await view.lookAtGlobalLocationFromGcs(endHeight, ViewGlobalLocationConstants.birdPitchAngleRadians, destination);
    viewport.setupFromView();
    const afterLanding = viewport.getWorldFrustum();
    viewport.setupViewFromFrustum(beforeFrustum); // revert old frustum

    return new GlobeAnimator(viewport, destination, afterLanding);
  }

  protected constructor(viewport: ScreenViewport, destination: GlobalLocation, afterLanding: Frustum) {
    this._viewport = viewport;
    this._endLocation = destination;
    this._afterLanding = afterLanding;
    const view = viewport.view;

    if (!(view.is3d()) || !viewport.iModel.isGeoLocated) // This animation only works for 3d views and geolocated models
      return;

    // Calculate start height as the height of the current eye above the earth.
    // Calculate end height from the destination area (if specified); otherwise, use a constant value.
    const backgroundMapGeometry = view.displayStyle.getBackgroundMapGeometry();
    if (undefined === backgroundMapGeometry)
      return;

    this._startHeight = eyeToCartographicOnGlobe(this._viewport, true)!.height;
    this._endHeight = destination.area !== undefined ? areaToEyeHeight(view, destination.area, destination.center.height) : ViewGlobalLocationConstants.birdHeightAboveEarthInMeters;

    // Starting cartographic position is the eye projected onto the globe.
    let startCartographic = eyeToCartographicOnGlobe(viewport);
    if (startCartographic === undefined) {
      startCartographic = Cartographic.fromDegrees(0, 0, 0);
    }
    this._startCartographic = startCartographic;

    let maxFlightDuration: number;

    if (view.globeMode === GlobeMode.Plane) {
      // Calculate a line segment going from the starting cartographic coordinate to the ending cartographic coordinate
      this._columbusLine.push(view.cartographicToRoot(startCartographic)!);
      this._columbusLine.push(view.cartographicToRoot(this._endLocation.center)!);
      this._flightLength = this._columbusLine[0].distance(this._columbusLine[1]);
      // Set a shorter flight duration in Plane mode
      maxFlightDuration = 7000.0;
    } else {
      // Calculate a flight arc from the ellipsoid of the Earth and the starting and ending cartographic coordinates.
      const earthEllipsoid = backgroundMapGeometry.getEarthEllipsoid();
      this._ellipsoidArc = earthEllipsoid.radiansPairToGreatArc(this._startCartographic.longitude, this._startCartographic.latitude, this._endLocation.center.longitude, this._endLocation.center.latitude)!;
      if (this._ellipsoidArc !== undefined)
        this._flightLength = this._ellipsoidArc.curveLength();
      // Set a longer flight duration in 3D mode
      maxFlightDuration = 13000.0;
    }

    if (Geometry.isSmallMetricDistance(this._flightLength))
      return;

    // The peak of the flight varies based on total distance to travel. The larger the distance, the higher the peak of the flight will be.
    this._midHeight = metersToRange(this._flightLength,
      ViewGlobalLocationConstants.birdHeightAboveEarthInMeters,
      ViewGlobalLocationConstants.satelliteHeightAboveEarthInMeters * 4,
      ViewGlobalLocationConstants.largestEarthArc);

    // We will "fix" the initial frustum so it smoothly transitions to some point along the travel arc depending on the starting height.
    // Alternatively, if the distance to travel is small enough, we will _only_ do a frustum transition to the destination location - ignoring the flight arc.
    const beforeTakeoff = viewport.getWorldFrustum();

    if (view.globeMode === GlobeMode.Plane) {
      /// Do not "fix" the take-off for plane mode; SmoothTransformBetweenFrusta can behave wrongly.
      // However, if within driving distance, still use SmoothTransformBetweenFrusta to navigate there without flight.
      this._fixTakeoffFraction = this._flightLength <= ViewGlobalLocationConstants.maximumDistanceToDrive ? 1.0 : 0.0;
    } else {
      this._fixTakeoffFraction = this._flightLength <= ViewGlobalLocationConstants.maximumDistanceToDrive ? 1.0 : metersToRange(this._startHeight, 0.1, 0.4, ViewGlobalLocationConstants.birdHeightAboveEarthInMeters);
    }

    if (this._fixTakeoffFraction > 0.0) {
      this._moveFlightToFraction(this._fixTakeoffFraction);
      const afterTakeoff = viewport.getWorldFrustum();
      this._fixTakeoffInterpolator = SmoothTransformBetweenFrusta.create(beforeTakeoff.points, afterTakeoff.points);
    }

    // The duration of the animation will increase the larger the distance to travel.
    const flightDurationInMilliseconds = metersToRange(this._flightLength, 1000, maxFlightDuration, ViewGlobalLocationConstants.largestEarthArc);

    // Specify the tweening behavior for this animation.
    this._flightTweens.create({ fraction: 0.0 }, {
      to: { fraction: 1.0 },
      duration: flightDurationInMilliseconds,
      easing: Easing.Cubic.InOut,
      start: true,
      onUpdate: (obj: any) => this._moveFlightToFraction(obj.fraction),
    });
  }

  public animate() {
    if (this._flightLength <= 0) {
      this._moveFlightToFraction(1.0); // Skip to final frustum
      return true;
    }
    return !this._flightTweens.update();
  }

  public interrupt() {
    this._moveFlightToFraction(1.0); // Skip to final frustum
  }
}
