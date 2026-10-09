/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic } from "@itwin/core-common";
import { Angle, Geometry, Point3d, Range3d, Transform, Vector3d } from "@itwin/core-geometry";
import { AccuSnap, IModelApp, RealityDataSource, SpatialViewState, Tool, ViewStatus } from "@itwin/core-frontend";
import { parseToggle } from "@itwin/frontend-devtools";
import { DisplayTestApp } from "./App";

/** Center and radius, in ECEF, of a 3D Tiles root bounding volume. */
function rootBounds(root: any): { center: Point3d, radius: number } | undefined {
  const transform = Array.isArray(root.transform) ? Transform.createRowValues(
    root.transform[0], root.transform[4], root.transform[8], root.transform[12],
    root.transform[1], root.transform[5], root.transform[9], root.transform[13],
    root.transform[2], root.transform[6], root.transform[10], root.transform[14]) : Transform.createIdentity();
  const volume = root.boundingVolume;
  if (Array.isArray(volume?.box)) {
    const b = volume.box;
    const [x, y, z] = [[3, 4, 5], [6, 7, 8], [9, 10, 11]].map(([i, j, k]) => transform.matrix.multiplyXYZ(b[i], b[j], b[k]).magnitude());
    return { center: transform.multiplyXYZ(b[0], b[1], b[2]), radius: Geometry.hypotenuseXYZ(x, y, z) };
  }
  if (Array.isArray(volume?.sphere))
    return { center: transform.multiplyXYZ(volume.sphere[0], volume.sphere[1], volume.sphere[2]), radius: volume.sphere[3] };
  if (Array.isArray(volume?.region)) {
    const [west, south, east, north, low, high] = volume.region;
    const carto = Cartographic.fromRadians({ longitude: (west + east) / 2, latitude: (south + north) / 2, height: (low + high) / 2 });
    const corner = Cartographic.fromRadians({ longitude: west, latitude: south, height: low });
    const center = carto.toEcef();
    return { center, radius: center.distance(corner.toEcef()) };
  }
  return undefined;
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
    let root;
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

    const r = Math.max(bounds.radius, 100);
    const viewer = await DisplayTestApp.surface.openBlankConnection({
      name: `Cesium ion asset ${assetId}`,
      location,
      extents: new Range3d(-r, -r, -r, r, r, r),
    });
    const vp = viewer.viewport;
    const view = vp.view as SpatialViewState;
    view.viewFlags = view.viewFlags.copy({ grid: false, acsTriad: false, backgroundMap: false });
    view.displayStyle.attachRealityModel({ tilesetUrl: key.id, name: `Cesium ion asset ${assetId}` });

    // The connection is centered on the asset, so its center is the database origin; look down at it obliquely.
    const status = view.lookAt({
      eyePoint: Point3d.create(0, -r, r),
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
    const assetId = Number.parseInt(args[0], 10);
    return Number.isInteger(assetId) && assetId > 0 ? this.run(assetId) : false;
  }
}

/** Turn the experimental asynchronous hover-locate readback on or off (AccuSnap.asyncHoverReadback). */
export class AsyncHoverReadbackTool extends Tool {
  public static override toolId = "AsyncHoverReadback";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(enable?: boolean): Promise<boolean> {
    AccuSnap.asyncHoverReadback = enable ?? !AccuSnap.asyncHoverReadback;
    IModelApp.notifications.outputPrompt(`Asynchronous hover readback ${AccuSnap.asyncHoverReadback ? "on" : "off"}`);
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    return typeof enable === "string" ? false : this.run(enable);
  }
}
