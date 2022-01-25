/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Point3d, Range3d } from "@itwin/core-geometry";
import { Cartographic, GlobeMode } from "@itwin/core-common";
import { BingElevationProvider } from "./tile/internal";
import { ScreenViewport } from "./Viewport";
import { ViewState3d } from "./ViewState";

/** Describes a rectangular area of the earth using cartographic data structures.
 * @public
 */
export interface GlobalLocationArea { southwest: Cartographic, northeast: Cartographic }

/** Describes a location on the earth using cartographic data structures.
 * The viewed area of the location can be optionally specified.
 * The center of the location is specified with the center position.
 * @public
 */
export interface GlobalLocation { center: Cartographic, area?: GlobalLocationArea }

/** @internal */
export class ViewGlobalLocationConstants {
  public static readonly birdHeightAboveEarthInMeters = 713.0;
  public static readonly satelliteHeightAboveEarthInMeters = 402336.0 * 24;
  public static readonly largestEarthArc = 20037500.0; // distance from point on earth to opposite point in meters
  public static readonly birdPitchAngleRadians = 0.0; // Angle.piOver4Radians;
  public static readonly maximumDistanceToDrive = 96560.6; // The distance in meters that we will "drive" instead of fly to a destination (60 miles)
}

/** Converts a distance in meters to some range (smaller distances result in lower number; longer distances result in larger number)
 * Uses 500 for minimum output and 3000 for maximum output, unless either are specified.
 * Uses [[ViewGlobalLocationConstants.satelliteHeightAboveEarthInMeters]] as maximum input meters unless specified.
 * A good use of this is to convert meters to some transition duration.
 * @internal
 */
export function metersToRange(inputMeters: number, minimumOutput: number = 500, maximumOutput: number = 3000, maximumInputMeters = ViewGlobalLocationConstants.satelliteHeightAboveEarthInMeters): number {
  let output: number;
  if (inputMeters <= 0)
    output = minimumOutput;
  else if (inputMeters >= maximumInputMeters)
    output = maximumOutput;
  else {
    const quickLerp = (start: number, end: number, amt: number): number => {
      return (1 - amt) * start + amt * end;
    };
    output = quickLerp(minimumOutput, maximumOutput, inputMeters / maximumInputMeters);
  }

  return output;
}

/** Queries the actual elevation of a cartographic point on the globe (using Bing elevation services)
 * @public
 */
export async function queryTerrainElevationOffset(viewport: ScreenViewport, carto: Cartographic): Promise<number> {
  const bingElevationProvider = new BingElevationProvider();
  if (viewport && viewport.view instanceof ViewState3d && viewport.iModel.isGeoLocated) {
    const view3d = viewport.view;
    if (view3d.displayStyle.displayTerrain) {
      const elevationOffset = await bingElevationProvider.getHeight(carto, view3d.globeMode === GlobeMode.Ellipsoid);
      if (elevationOffset !== undefined)
        return elevationOffset;
    }
  }
  return 0;
}

function _areaToEyeHeight(view3d: ViewState3d, ne?: Point3d, sw?: Point3d, offset = 0): number {
  if (ne === undefined || sw === undefined)
    return 0;
  const diagonal = ne.distance(sw);

  view3d.camera.validateLens();
  const td = Math.tan(view3d.camera.getLensAngle().radians / 2.0);
  return 0 !== td ? (diagonal / (2 * td) + offset) : offset;
}

/** Converts a cartographic area on the globe to an ideal eye height to view that area.
 * Offset in meters, which defaults to 0, is applied to final eye height.
 * @internal
 */
export function areaToEyeHeight(view3d: ViewState3d, area: GlobalLocationArea, offset = 0): number {
  const ne = view3d.cartographicToRoot(area.northeast);
  const sw = view3d.cartographicToRoot(area.southwest);
  return _areaToEyeHeight(view3d, ne, sw, offset);
}

/** Converts a cartographic area on the globe to an ideal eye height to view that area using the GCS.
 * Offset in meters, which defaults to 0, is applied to final eye height.
 * @internal
 */
export async function areaToEyeHeightFromGcs(view3d: ViewState3d, area: GlobalLocationArea, offset = 0): Promise<number> {
  const ne = await view3d.cartographicToRootFromGcs(area.northeast);
  const sw = await view3d.cartographicToRootFromGcs(area.southwest);
  return _areaToEyeHeight(view3d, ne, sw, offset);
}

/** Converts a root range (often project extents) to a cartographic area.
 * @internal
 */
export function rangeToCartographicArea(view3d: ViewState3d, range: Range3d): GlobalLocationArea | undefined {
  const low = view3d.rootToCartographic(range.low);
  const high = view3d.rootToCartographic(range.high);
  if (low === undefined || high === undefined)
    return undefined;
  return low.latitude < high.latitude ? { northeast: high, southwest: low } : { northeast: low, southwest: high };
}

/** Converts the eye of the camera to a cartographic location on the globe as if it was at height 0.
 * If preserveHeight is set to true, then height will remain untouched.
 * @internal
 */
export function eyeToCartographicOnGlobe(viewport: ScreenViewport, preserveHeight = false): Cartographic | undefined {
  if (!(viewport.view instanceof ViewState3d) || !viewport.iModel.isGeoLocated)
    return undefined;

  const view3d = viewport.view;

  const eyePointCartographic = view3d.rootToCartographic(view3d.getEyeOrOrthographicViewPoint());
  if (eyePointCartographic !== undefined) {
    if (!preserveHeight)
      eyePointCartographic.height = 0.0;
    return eyePointCartographic;
  }

  return undefined;
}

/** Converts the eye of the camera to a cartographic location on the globe as if it was at height 0 using the GCS.
 * If preserveHeight is set to true, then height will remain untouched.
 * @internal
 */
export async function eyeToCartographicOnGlobeFromGcs(viewport: ScreenViewport, preserveHeight = false): Promise<Cartographic | undefined> {
  if (!(viewport.view instanceof ViewState3d) || !viewport.iModel.isGeoLocated)
    return undefined;

  const view3d = viewport.view;

  const eyePointCartographic = await view3d.rootToCartographicFromGcs(view3d.getEyeOrOrthographicViewPoint());
  if (eyePointCartographic !== undefined) {
    if (!preserveHeight)
      eyePointCartographic.height = 0.0;
    return eyePointCartographic;
  }

  return undefined;
}

/** @internal */
export function viewGlobalLocation(viewport: ScreenViewport, doAnimate: boolean, eyeHeight = ViewGlobalLocationConstants.birdHeightAboveEarthInMeters, pitchAngleRadians = 0, location?: GlobalLocation): number {
  if (!(viewport.view instanceof ViewState3d))
    return 0;

  const before = viewport.getFrustum();
  const view3d = viewport.view;

  const transitionDistance = view3d.lookAtGlobalLocation(eyeHeight, pitchAngleRadians, location);
  viewport.synchWithView();

  if (doAnimate)
    viewport.animateToCurrent(before, { animationTime: metersToRange(transitionDistance) });

  return transitionDistance;
}
