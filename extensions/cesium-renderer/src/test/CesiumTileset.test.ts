/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Point3d, Range3d, Transform, YawPitchRollAngles } from "@itwin/core-geometry";
import { IModelApp, ScreenViewport } from "@itwin/core-frontend";
import { Cartesian3, Matrix4 } from "@cesium/core";
import { Cesium3DTileset } from "@cesium/engine";
import { CesiumSystem } from "../System.js";
import { getCesiumSceneForCanvas } from "../CesiumScene.js";
import { attachCesiumTileset, transformToMatrix4 } from "../CesiumTileset.js";

const tilesetJson = {
  asset: { version: "1.1" },
  geometricError: 0,
  root: {
    boundingVolume: { box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] },
    geometricError: 0,
  },
};
const tilesetUrl = `data:application/json;base64,${btoa(JSON.stringify(tilesetJson))}`;

describe("transformToMatrix4", () => {
  it("maps points identically to the source Transform", () => {
    const rotation = YawPitchRollAngles.createDegrees(30, -15, 60).toMatrix3d();
    const tf = Transform.createOriginAndMatrix(Point3d.create(1000, -2000, 3000), rotation.scale(2));
    const mat = transformToMatrix4(tf);

    const pt = Point3d.create(1.5, -2.5, 3.5);
    const expected = tf.multiplyPoint3d(pt);
    const actual = Matrix4.multiplyByPoint(mat, new Cartesian3(pt.x, pt.y, pt.z), new Cartesian3());
    expect(actual.x).toBeCloseTo(expected.x, 9);
    expect(actual.y).toBeCloseTo(expected.y, 9);
    expect(actual.z).toBeCloseTo(expected.z, 9);
  });
});

describe("attachCesiumTileset", () => {
  let system: CesiumSystem;

  beforeAll(async () => {
    await IModelApp.startup();
    system = CesiumSystem.create();
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  function makeViewport(canvas: HTMLCanvasElement, ecefTransform?: Transform): ScreenViewport {
    const ecefLocation = ecefTransform ? { getTransform: () => ecefTransform } : undefined;
    return { canvas, iModel: { ecefLocation } } as unknown as ScreenViewport;
  }

  it("throws if the viewport is not rendered by Cesium", async () => {
    const vp = makeViewport(document.createElement("canvas"));
    await expect(attachCesiumTileset(vp, { url: tilesetUrl })).rejects.toThrow();
  });

  it("adds the tileset without applying the iModel's ECEF transform and removes it", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 32;
    document.body.appendChild(canvas);
    system.createTarget(canvas);
    const primitives = getCesiumSceneForCanvas(canvas)!.cesiumScene.primitives;
    const countBefore = primitives.length;

    const ecef = Transform.createTranslationXYZ(4e6, 1e6, 4.5e6);
    const remove = await attachCesiumTileset(makeViewport(canvas, ecef), { url: tilesetUrl });
    expect(primitives.length).toBe(countBefore + 1);

    const tileset = primitives.get(countBefore) as Cesium3DTileset;
    expect(tileset).toBeInstanceOf(Cesium3DTileset);
    expect(Matrix4.equals(tileset.modelMatrix, Matrix4.IDENTITY)).toBe(true);

    remove();
    remove();
    expect(primitives.length).toBe(countBefore);
    expect(tileset.isDestroyed()).toBe(true);
    document.body.removeChild(canvas);
  });

  it("prefers an explicit modelMatrix", async () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    system.createTarget(canvas);
    const primitives = getCesiumSceneForCanvas(canvas)!.cesiumScene.primitives;

    const explicit = Transform.createTranslationXYZ(1, 2, 3);
    const remove = await attachCesiumTileset(makeViewport(canvas, Transform.createTranslationXYZ(9, 9, 9)), { url: tilesetUrl, modelMatrix: explicit });
    const tileset = primitives.get(primitives.length - 1) as Cesium3DTileset;
    expect(Matrix4.equals(tileset.modelMatrix, transformToMatrix4(explicit))).toBe(true);

    remove();
    document.body.removeChild(canvas);
  });

  it("zooms the viewport to the tileset in iModel spatial coordinates", async () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    system.createTarget(canvas);

    const ecef = Transform.createTranslationXYZ(4e6, 1e6, 4.5e6);
    const vp = makeViewport(canvas, ecef) as ScreenViewport & { zoomed?: Range3d };
    (vp as any).zoomToVolume = (range: Range3d) => vp.zoomed = range;

    // The test tileset is a unit box at the ECEF origin, i.e. at -ecef.origin in spatial coordinates.
    const remove = await attachCesiumTileset(vp, { url: tilesetUrl, zoomTo: true });
    const center = vp.zoomed!.center;
    expect(center.x).toBeCloseTo(-4e6, 3);
    expect(center.y).toBeCloseTo(-1e6, 3);
    expect(center.z).toBeCloseTo(-4.5e6, 3);
    expect(vp.zoomed!.xLength()).toBeCloseTo(2 * Math.sqrt(3), 6);

    remove();
    document.body.removeChild(canvas);
  });
});
