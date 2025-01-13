/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { FrustumPlanes } from "../geometry/FrustumPlanes";
import { Frustum } from "../Frustum";
import { Point3d } from "@itwin/core-geometry";

describe("FrustumPlanes", () => {
  it("should properly handle a default frustum", () => {
    const frustumPlanes = FrustumPlanes.fromFrustum(new Frustum());
    expect(frustumPlanes.planes.length).to.equal(6);
  });

  it("should properly handle a good frustum", () => {
    const frustum = new Frustum();
    frustum.setFromCorners([
      Point3d.fromJSON({ x: 88.51459041033166, y: 0.7622479698565066, z: -21.27515944984108 }),  // left bottom rear
      Point3d.fromJSON({ x: 83.59175566227866, y: -54.5154018605118, z: -21.275159449841123 }),  // right bottom rear
      Point3d.fromJSON({ x: 91.54647813049287, y: 0.4922386212896158, z: 14.92723336305222 }),   // left top rear
      Point3d.fromJSON({ x: 86.62364338243987, y: -54.78541120907869, z: 14.927233363052178 }),  // right top rear
      Point3d.fromJSON({ x: 22.838134428009578, y: -21.182090505813676, z: 2.248236463773556 }), // left bottom front
      Point3d.fromJSON({ x: 22.826687847036766, y: -21.3106221602675, z: 2.248236463773556 }),   // right bottom front
      Point3d.fromJSON({ x: 22.845184176795684, y: -21.18271833185903, z: 2.332414308846702 }),  // left top front
      Point3d.fromJSON({ x: 22.833737595822875, y: -21.311249986312852, z: 2.332414308846702 }), // right top front
    ]);

    const frustumPlanes = FrustumPlanes.fromFrustum(frustum);
    expect(frustumPlanes.planes.length).to.equal(6);
  });

  it("should properly handle a frustum with very small front rect", () => {
    const frustum = new Frustum();
    frustum.setFromCorners([
      Point3d.fromJSON({ x: 86.91579452523399, y: -51.11890676358028, z: 14.520007347159119 }),   // left bottom rear
      Point3d.fromJSON({ x: 86.86504365154272, y: -51.68877944224387, z: 14.520007347159117 }),   // right bottom rear
      Point3d.fromJSON({ x: 86.91958012182498, y: -51.11924389561279, z: 14.565209434923249 }),   // left top rear
      Point3d.fromJSON({ x: 86.86882924813371, y: -51.68911657427638, z: 14.565209434923247 }),   // right top rear
      Point3d.fromJSON({ x: 22.834416905993425, y: -21.302724625992933, z: 2.3314674264499287 }), // left bottom front
      Point3d.fromJSON({ x: 22.834298900004015, y: -21.304049694595548, z: 2.3314674264499287 }), // right bottom front
      Point3d.fromJSON({ x: 22.834425708266938, y: -21.30272540989272, z: 2.3315725303959707 }),  // left top front
      Point3d.fromJSON({ x: 22.834307702277528, y: -21.304050478495334, z: 2.3315725303959707 }), // right top front
    ]);

    /*
    Note the super small front rect. This previously caused issues in FrustumPlanes.fromFrustum().
    So we will verify that that issue no longer occurs.

       2----------3
      /|         /|
     / 0--------/-1
    6----------7  /
    | /        | /
    |/         |/
    4__________5

    0 = LBR = { x: 86.91579452523399, y: -51.11890676358028, z: 14.520007347159119 }
    1 = RBR = { x: 86.86504365154272, y: -51.68877944224387, z: 14.520007347159117 }
    2 = LTR = { x: 86.91958012182498, y: -51.11924389561279, z: 14.565209434923249 }
    3 = RTR = { x: 86.86882924813371, y: -51.68911657427638, z: 14.565209434923247 }
    4 = LBF = { x: 22.834416905993425, y: -21.302724625992933, z: 2.3314674264499287 }
    5 = RBF = { x: 22.834298900004015, y: -21.304049694595548, z: 2.3314674264499287 }
    6 = LTF = { x: 22.834425708266938, y: -21.30272540989272, z: 2.3315725303959707 }
    7 = RTF = { x: 22.834307702277528, y: -21.304050478495334, z: 2.3315725303959707 }
    */

    const frustumPlanes = FrustumPlanes.fromFrustum(frustum);
    expect(frustumPlanes.planes.length).to.equal(6);
  });

  it("should properly handle a bad (zero-size) frustum", () => {
    const frustum = new Frustum();
    frustum.setFromCorners([
      Point3d.fromJSON({ x: 0, y: 0, z: 0 }),  // left bottom rear
      Point3d.fromJSON({ x: 0, y: 0, z: 0 }),  // right bottom rear
      Point3d.fromJSON({ x: 0, y: 0, z: 0 }),  // left top rear
      Point3d.fromJSON({ x: 0, y: 0, z: 0 }),  // right top rear
      Point3d.fromJSON({ x: 0, y: 0, z: 0 }),  // left bottom front
      Point3d.fromJSON({ x: 0, y: 0, z: 0 }),  // right bottom front
      Point3d.fromJSON({ x: 0, y: 0, z: 0 }),  // left top front
      Point3d.fromJSON({ x: 0, y: 0, z: 0 }),  // right top front
    ]);

    const frustumPlanes = FrustumPlanes.fromFrustum(frustum);
    expect(frustumPlanes.planes.length).to.equal(0);
  });
});
