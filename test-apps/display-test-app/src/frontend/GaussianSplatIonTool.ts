/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, ColorDef } from "@itwin/core-common";
import { Angle, Point3d, Range3d, Transform, Vector3d } from "@itwin/core-geometry";
import { IModelApp, RealityDataSource, SpatialViewState, Tool, ViewStatus } from "@itwin/core-frontend";
import { DisplayTestApp } from "./App";

interface TilesetRoot {
  transform?: unknown;
  boundingVolume?: { box?: unknown, sphere?: unknown, region?: unknown };
}

function numericArray(value: unknown, length: number): number[] | undefined {
  return Array.isArray(value) && value.length === length && value.every((entry) => typeof entry === "number" && Number.isFinite(entry)) ? value : undefined;
}

/** A 3D Tiles transform: a column-major 4x4 array, or identity if absent. */
function tileTransform(value: unknown): Transform {
  const values = numericArray(value, 16);
  return values ? Transform.createRowValues(
    values[0], values[4], values[8], values[12],
    values[1], values[5], values[9], values[13],
    values[2], values[6], values[10], values[14]) : Transform.createIdentity();
}

/** Center and conservative radius, in ECEF, of a 3D Tiles root bounding volume. */
function rootBounds(root: TilesetRoot): { center: Point3d, radius: number } | undefined {
  const transform = tileTransform(root.transform);
  const box = numericArray(root.boundingVolume?.box, 12);
  if (box) {
    const center = transform.multiplyXYZ(box[0], box[1], box[2]);
    let radius = 0;
    for (const x of [-1, 1])
      for (const y of [-1, 1])
        for (const z of [-1, 1])
          radius = Math.max(radius, transform.matrix.multiplyXYZ(x * box[3] + y * box[6] + z * box[9], x * box[4] + y * box[7] + z * box[10], x * box[5] + y * box[8] + z * box[11]).magnitude());

    return { center, radius };
  }

  const sphere = numericArray(root.boundingVolume?.sphere, 4);
  if (sphere && sphere[3] > 0)
    return { center: transform.multiplyXYZ(sphere[0], sphere[1], sphere[2]), radius: sphere[3] * Math.sqrt(transform.matrix.sumSquares()) };

  const region = numericArray(root.boundingVolume?.region, 6);
  if (!region)
    return undefined;

  // Region coordinates are radians and heights, independent of the tile transform. ECEF extrema can occur between
  // corners, at cardinal longitudes or the equator; include them, at both heights, before bounding the region.
  const [west, south, rawEast, north, low, high] = region;
  const east = rawEast < west ? rawEast + 2 * Math.PI : rawEast;
  if (Math.abs(west) > Math.PI || Math.abs(rawEast) > Math.PI || south < -Math.PI / 2 || north > Math.PI / 2 || south > north || low > high)
    return undefined;

  const longitudes = [west, east];
  for (let cardinal = Math.ceil(west / (Math.PI / 2)) * Math.PI / 2; cardinal < east; cardinal += Math.PI / 2)
    longitudes.push(cardinal);

  const latitudes = south < 0 && north > 0 ? [south, 0, north] : [south, north];
  const bounds = Range3d.createNull();
  for (const longitude of longitudes)
    for (const latitude of latitudes)
      for (const height of [low, high])
        bounds.extendPoint(Cartographic.fromRadians({ longitude, latitude, height }).toEcef());

  return { center: bounds.center, radius: bounds.diagonal().magnitude() / 2 };
}

/** Open a blank connection located at a Cesium ion asset, attach the asset, and look at it.
 * The default blank connection is located elsewhere, so an ion reality model attached to it is out of view.
 * Requires IMJS_CESIUM_ION_KEY; use IMJS_ENABLE_GAUSSIAN_SPLATS for Gaussian splat assets.
 */
export class GaussianSplatIonTool extends Tool {
  public static override toolId = "GaussianSplatIon";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  public override async run(assetId: number): Promise<boolean> {
    const key = RealityDataSource.createCesiumIonAssetKey(assetId, "");
    let root: TilesetRoot | undefined;
    try {
      const source = await RealityDataSource.fromKey(key, undefined);
      root = (await source?.getRootDocument(undefined))?.root;
    } catch (error) {
      IModelApp.notifications.outputPrompt(`Cesium ion asset ${assetId} could not be read; check IMJS_CESIUM_ION_KEY: ${String(error)}`);
      return false;
    }

    const bounds = root ? rootBounds(root) : undefined;
    const location = bounds ? Cartographic.fromEcef(bounds.center) : undefined;
    if (!bounds || !location) {
      IModelApp.notifications.outputPrompt(`Cesium ion asset ${assetId} has no usable root bounding volume`);
      return false;
    }

    const minimumViewRadius = 100; // Keep tiny assets clear of the camera front plane.
    const radius = Math.max(bounds.radius, minimumViewRadius);
    const viewer = await DisplayTestApp.surface.openBlankConnection({
      name: `Cesium ion asset ${assetId}`,
      location,
      extents: new Range3d(-radius, -radius, -radius, radius, radius, radius),
    });
    const vp = viewer.viewport;
    const view = vp.view as SpatialViewState;
    view.viewFlags = view.viewFlags.copy({ grid: false, acsTriad: false, backgroundMap: false });
    // Match the CesiumJS comparison: a dark background without sky or ground. Splat fields are not fully
    // opaque everywhere (e.g. transient traffic), so a bright or green sky gradient shows through them.
    view.displayStyle.environment = view.displayStyle.environment.withDisplay({ sky: false, ground: false, atmosphere: false });
    view.displayStyle.backgroundColor = ColorDef.from(12, 17, 24);
    view.displayStyle.attachRealityModel({ tilesetUrl: key.id, name: `Cesium ion asset ${assetId}` });

    // The connection is centered on the asset, so its center is the database origin; look down at it obliquely.
    const status = view.lookAt({
      eyePoint: Point3d.create(0, -radius, radius),
      targetPoint: Point3d.createZero(),
      upVector: Vector3d.unitZ(),
      lensAngle: Angle.createDegrees(60),
    });
    if (ViewStatus.Success !== status) {
      IModelApp.notifications.outputPrompt(`Could not aim the view at Cesium ion asset ${assetId}`);
      return false;
    }
    vp.synchWithView();
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const assetId = Number(args[0]);
    return Number.isInteger(assetId) && assetId > 0 ? this.run(assetId) : false;
  }
}
