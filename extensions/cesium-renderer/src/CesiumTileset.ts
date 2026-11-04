/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ScreenViewport } from "@itwin/core-frontend";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { Matrix4 } from "@cesium/core";
import { Cesium3DTileset } from "@cesium/engine";
import { getCesiumSceneForCanvas } from "./CesiumScene.js";

/** Arguments for [[attachCesiumTileset]].
 * @alpha
 */
export interface AttachCesiumTilesetArgs {
  /** URL of the tileset.json. Query parameters (e.g., SAS tokens) propagate to child tile requests. */
  url: string | URL;
  /** Transform from tileset coordinates to ECEF. Defaults to identity, since published iModel tilesets are already in ECEF. */
  modelMatrix?: Transform;
  /** If true, zoom the viewport to the tileset's bounds once loaded. Requires a geolocated iModel. Default: false. */
  zoomTo?: boolean;
}

/** Experimental: stream a 3D Tiles tileset directly into the Cesium scene backing `vp`, bypassing iTwin.js tile trees.
 * @returns A function that removes and destroys the tileset.
 * @throws Error if `vp` is not rendered by the Cesium render system.
 * @alpha
 */
export async function attachCesiumTileset(vp: ScreenViewport, args: AttachCesiumTilesetArgs): Promise<() => void> {
  const scene = getCesiumSceneForCanvas(vp.canvas);
  if (!scene)
    throw new Error("attachCesiumTileset requires a viewport rendered by the Cesium render system.");

  const tileset = await Cesium3DTileset.fromUrl(args.url.toString());
  if (args.modelMatrix)
    tileset.modelMatrix = transformToMatrix4(args.modelMatrix);

  const primitives = scene.cesiumScene.primitives;
  primitives.add(tileset);

  if (args.zoomTo) {
    const range = computeTilesetSpatialRange(vp, tileset);
    if (range)
      vp.zoomToVolume(range);
  }

  let removed = false;
  return () => {
    if (removed)
      return;

    removed = true;
    if (!primitives.isDestroyed())
      primitives.remove(tileset); // destroys the tileset
  };
}

/** The tileset's ECEF bounding sphere as a range in the viewport iModel's spatial coordinates. */
function computeTilesetSpatialRange(vp: ScreenViewport, tileset: Cesium3DTileset): Range3d | undefined {
  const toSpatial = vp.iModel.ecefLocation?.getTransform().inverse();
  if (!toSpatial)
    return undefined;

  const { center, radius } = tileset.boundingSphere;
  const c = toSpatial.multiplyPoint3d(Point3d.create(center.x, center.y, center.z));
  return Range3d.createXYZXYZ(c.x - radius, c.y - radius, c.z - radius, c.x + radius, c.y + radius, c.z + radius);
}

/** @internal */
export function transformToMatrix4(tf: Transform): Matrix4 {
  const m = tf.matrix;
  const o = tf.origin;
  return new Matrix4(
    m.at(0, 0), m.at(0, 1), m.at(0, 2), o.x,
    m.at(1, 0), m.at(1, 1), m.at(1, 2), o.y,
    m.at(2, 0), m.at(2, 1), m.at(2, 2), o.z,
    0, 0, 0, 1,
  );
}
