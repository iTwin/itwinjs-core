/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IModelApp } from "../IModelApp";
import { Cartographic, EmptyLocalization, Frustum, GlobeMode, Npc } from "@itwin/core-common";
import { BlankConnection, IModelConnection } from "../IModelConnection";
import { ClipPlane, Ellipsoid, Matrix3d, Point3d, Range3d, Transform, Vector3d, XYAndZ } from "@itwin/core-geometry";
import { BackgroundMapGeometry } from "../BackgroundMapGeometry";
import { createBlankConnection } from "./createBlankConnection";
import { Guid } from "@itwin/core-bentley";

describe("BackgroundMapGeometry", () => {
  function createPerspectiveFrustum(): Frustum {
    const frustum = new Frustum();
    const frontCenter = frustum.frontCenter;
    const shrinkFront = (corner: Npc) => {
      frontCenter.interpolate(0.5, frustum.points[corner], frustum.points[corner]);
    };

    shrinkFront(Npc.LeftBottomFront);
    shrinkFront(Npc.RightBottomFront);
    shrinkFront(Npc.LeftTopFront);
    shrinkFront(Npc.RightTopFront);
    return frustum;
  }

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("provide cartographics from iModel coordinates", async () => {

    const wgs84CartographicFromSpatialFake = vi.spyOn(IModelConnection.prototype, "wgs84CartographicFromSpatial").mockImplementation(async function _(spatial: XYAndZ[]): Promise<Cartographic[]> {
      return Promise.resolve(spatial.map((value) => Cartographic.fromRadians({ longitude: value.x, latitude: value.y, height: value.z})));
    });

    const dbToCartographicFake = vi.spyOn(BackgroundMapGeometry.prototype, "dbToCartographic").mockImplementation(function _(db: XYAndZ, _result?: Cartographic): any {
      return Cartographic.fromRadians({longitude: db.x, latitude: db.y, height: db.z});
    });

    const imodel = createBlankConnection();
    const bgGeom = new BackgroundMapGeometry(0, GlobeMode.Ellipsoid, imodel);

    // Any value in the 'negative' range should get reprojected using 'wgs84CartographicFromSpatial'
    (bgGeom as any).cartesianRange = Range3d.createXYZXYZ(-100, -100, -100, 0, 0 , 0);
    const dataset = [{x: -1, y: -1, z: -1}, {x: 1, y: 1, z: 1}, {x: -2, y: -2, z: -2}];
    const result = await bgGeom.dbToWGS84CartographicFromGcs(dataset);
    expect(result.length).toEqual(dataset.length);
    expect(wgs84CartographicFromSpatialFake).toHaveBeenCalledOnce();
    const firstCall = wgs84CartographicFromSpatialFake.mock.calls[0];
    expect(firstCall[0].length).toEqual(2);
    expect(dbToCartographicFake).toHaveBeenCalledOnce();

    for (let i = 0; i<dataset.length; i++) {
      expect(dataset[i].x).toEqual(result[i].longitude);
      expect(dataset[i].y).toEqual(result[i].latitude);
      expect(dataset[i].z).toEqual(result[i].height);
    }
  });

  it("creates new background map geometry when the origin is (0, 0, 0)", async () => {
    const name = "test-blank-connection";
    const extents = new Range3d(-2500, -2500, -1000, 2500, 2500, 1000);
    const globalOrigin = new Point3d(0, 0, 0);
    const iTwinId = Guid.createValue();
    const imodel = BlankConnection.create({ name, location: { origin: [0, 0, 0], orientation: { yaw: 0, pitch: 0, roll: 0 } }, extents, iTwinId, globalOrigin });

    const geometry = new BackgroundMapGeometry(0, 0, imodel);
    expect(geometry).to.not.be.undefined;
  });

  it("returns a null range when the eye point cannot be transformed into ellipsoid space", () => {
    const imodel = createBlankConnection();
    const bgGeom = new BackgroundMapGeometry(0, GlobeMode.Ellipsoid, imodel);

    const degenerate = Ellipsoid.create(Transform.createRefs(Point3d.createZero(), Matrix3d.createZero()));
    vi.spyOn(bgGeom, "getEarthEllipsoid").mockReturnValue(degenerate);

    const frustum = createPerspectiveFrustum();
    const eyePoint = frustum.getEyePoint();
    expect(eyePoint).toBeDefined();
    expect(() => degenerate.worldToLocal(eyePoint!)!.magnitude()).toThrow();

    const bimRange = Range3d.createXYZXYZ(-100, -100, -10, 100, 100, 10);
    const result = bgGeom.getFrustumIntersectionDepthRange(frustum, bimRange);
    expect(result.isNull).toBe(true);
  });

  it("falls back to a center plane when the silhouette plane cannot be created", () => {
    const imodel = createBlankConnection();
    const bgGeom = new BackgroundMapGeometry(0, GlobeMode.Ellipsoid, imodel);
    const frustum = createPerspectiveFrustum();
    const bimRange = Range3d.createXYZXYZ(-100, -100, -10, 100, 100, 10);

    const undefinedSilhouettePlane = ClipPlane.createNormalAndDistance(Vector3d.createZero(), 0);
    expect(undefinedSilhouettePlane).toBeUndefined();

    const oldClipPlanes = frustum.getRangePlanes(false, false, 0);
    oldClipPlanes.planes.push(undefinedSilhouettePlane as any);
    expect(() => {
      for (const clipPlane of oldClipPlanes.planes)
        clipPlane.getPlane3d();
    }).toThrow();

    vi.spyOn(bgGeom, "getEarthEllipsoid").mockReturnValue({
      worldToLocal: (_point: XYAndZ, result?: Point3d) => Point3d.create(0, 0, 2, result),
      localToWorld: (_point: XYAndZ, result?: Point3d) => Point3d.create(0, 0, 0, result),
      surfaceNormalToAngles: () => undefined,
      radiansToPoint: () => undefined,
      silhouetteArc: () => ({ center: Point3d.createZero(), perpendicularVector: Vector3d.createZero() }),
      createPlaneSection: () => undefined,
    } as unknown as Ellipsoid);

    expect(() => bgGeom.getFrustumIntersectionDepthRange(frustum, bimRange)).not.toThrow();
  });
});
