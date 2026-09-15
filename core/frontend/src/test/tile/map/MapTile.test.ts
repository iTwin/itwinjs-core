/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AngleSweep, Ellipsoid, EllipsoidPatch, Map4d, Matrix4d, Point3d, Range1d, Range3d, Ray3d, Transform, Vector3d } from "@itwin/core-geometry";
import { IModelConnection } from "../../../IModelConnection";
import { IModelApp } from "../../../IModelApp";
import { MockRender } from "../../../internal/render/MockRender";
import { RealityTile } from "../../../tile/RealityTile";
import { TileDrawArgs } from "../../../tile/TileDrawArgs";
import { MapCartoRectangle } from "../../../tile/map/MapCartoRectangle";
import { MapTile, PlanarTilePatch } from "../../../tile/map/MapTile";
import { MapTileTree } from "../../../tile/map/MapTileTree";
import { QuadId } from "../../../tile/map/QuadId";
import { createBlankConnection } from "../../createBlankConnection";

let imodel: IModelConnection;

beforeAll(async () => {
  await MockRender.App.startup();
  IModelApp.stopEventLoop();
  imodel = createBlankConnection("mapTile-test");
});

afterAll(async () => {
  await imodel.close();
  if (IModelApp.initialized)
    await MockRender.App.shutdown();
});

afterEach(async () => {
  vi.restoreAllMocks();
});

function createEllipsoidPatch(): EllipsoidPatch {
  return EllipsoidPatch.createCapture(
    Ellipsoid.create(Transform.createIdentity()),
    AngleSweep.createStartEndDegrees(0, 10),
    AngleSweep.createStartEndDegrees(30, 40),
  );
}

function createMapTile(args: {
  patch: PlanarTilePatch | EllipsoidPatch;
  cornerRays?: Ray3d[];
  range?: Range3d;
  maximumSize?: number;
}): MapTile {
  const mapTree = {
    isContentUnbounded: true,
    globeMode: 0,
  } as unknown as MapTileTree;

  return new MapTile(
    {
      contentId: "0_0_0",
      range: args.range ?? new Range3d(0, 0, 0, 100, 100, 100),
      maximumSize: args.maximumSize ?? 512,
    },
    mapTree,
    new QuadId(3, 0, 0),
    args.patch,
    MapCartoRectangle.createZero(),
    Range1d.createXX(0, 20),
    args.cornerRays,
  );
}

describe("MapTile", () => {
  it("uses _cornerRays origins for non-planar getSizeProjectionCorners", () => {
    const cornerRays = [
      Ray3d.create(Point3d.create(1, 2, 3), Vector3d.unitX()),
      Ray3d.create(Point3d.create(4, 5, 6), Vector3d.unitX()),
      Ray3d.create(Point3d.create(7, 8, 9), Vector3d.unitX()),
      Ray3d.create(Point3d.create(10, 11, 12), Vector3d.unitX()),
    ];

    const tile = createMapTile({
      patch: createEllipsoidPatch(),
      cornerRays,
      // Make AABB corners very different from _cornerRays to assert we are not using them.
      range: new Range3d(-1000, -1000, -1000, -900, -900, -900),
    });

    const corners = tile.getSizeProjectionCorners();
    expect(corners).toBeDefined();
    expect(corners).toEqual([
      cornerRays[0].origin,
      cornerRays[1].origin,
      cornerRays[3].origin,
      cornerRays[2].origin,
    ]);
  });

  it("keeps planar getSizeProjectionCorners behavior", () => {
    const patch = new PlanarTilePatch(
      [
        Point3d.create(0, 0, 0),
        Point3d.create(20, 0, 0),
        Point3d.create(0, 20, 0),
        Point3d.create(20, 20, 0),
      ],
      Vector3d.unitZ(),
      2,
    );

    const tile = createMapTile({ patch });

    const expected = patch.getRangeCorners(Range1d.createXX(0, 20), [
      Point3d.createZero(),
      Point3d.createZero(),
      Point3d.createZero(),
      Point3d.createZero(),
      Point3d.createZero(),
      Point3d.createZero(),
      Point3d.createZero(),
      Point3d.createZero(),
    ]).slice(0, 4);
    const corners = tile.getSizeProjectionCorners();

    expect(corners).toBeDefined();
    expect(corners).toEqual(expected);
  });

  it("uses max(projectedWidth, projectedHeight) for non-planar visibility factor", () => {
    const cornerRays = [
      Ray3d.create(Point3d.create(0, 0, 0), Vector3d.unitZ()),
      Ray3d.create(Point3d.create(1000, 0, 0), Vector3d.unitZ()),
      Ray3d.create(Point3d.create(0, 200, 0), Vector3d.unitZ()),
      Ray3d.create(Point3d.create(1000, 200, 0), Vector3d.unitZ()),
    ];

    const tile = createMapTile({
      patch: createEllipsoidPatch(),
      cornerRays,
      maximumSize: 512,
    });

    vi.spyOn(RealityTile.prototype, "computeVisibilityFactor").mockReturnValue(1);

    const args = {
      worldToViewMap: Map4d.createRefs(Matrix4d.createIdentity(), Matrix4d.createIdentity()),
      context: { adjustPixelSizeForLOD: (x: number) => x },
    } as unknown as TileDrawArgs;

    const result = tile.computeVisibilityFactor(args);

    const expectedWithMax = 512 / 1000;
    const expectedWithGeometricMean = 512 / Math.sqrt(1000 * 200);

    expect(result).toBeCloseTo(expectedWithMax, 12);
    expect(result).toBeLessThan(expectedWithGeometricMean);
  });
});
