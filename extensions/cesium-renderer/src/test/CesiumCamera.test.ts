/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Code, EcefLocation, IModel } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { createCesiumCameraProps } from "../CesiumCamera.js";

type Point = {
  x: number;
  y: number;
  z: number;
} | Point3d;

function expectPointToEqual(pointA: Point, pointB: Point, exactEqual?: boolean) {
  let point1: Point3d;
  let point2: Point3d;
  if (!(pointA instanceof Point3d)) {
    point1 = Point3d.fromJSON(pointA);
  } else {
    point1 = pointA;
  }
  if (!(pointB instanceof Point3d)) {
    point2 = Point3d.fromJSON(pointB);
  } else {
    point2 = pointB;
  }

  if (exactEqual) {
    expect(point1.x).to.equal(point2.x);
    expect(point1.y).to.equal(point2.y);
    expect(point1.z).to.equal(point2.z);
  } else {
    expect(point1.x).toBeCloseTo(point2.x);
    expect(point1.y).toBeCloseTo(point2.y);
    expect(point1.z).toBeCloseTo(point2.z);
  }
}

// A view definition and an ECEF location are required to create Cesium camera objects
// These values come from saved views created in DTA for a specific iModel, and the ECEF location from that same iModel

const cameraOnView = {
  cameraOn: true,
  origin: [-50.20252266797269, 56.989460084120665, -93.48021229168089],
  extents: [224.2601166976935, 165.04873366794442, 249.514861628184],
  angles: {
    pitch: -26.15946129868821,
    roll: -43.25863504612565,
    yaw: 25.103938995163002,
  },
  camera: {
    lens: 45.95389015950363,
    focusDist: 264.45767738020345,
    eye: [-37.863420740019635, -118.27234989806642, 132.40005835408053],
  },
  code: Code.createEmpty(),
  model: IModel.dictionaryId,
  classFullName: "test",
  categorySelectorId: "@1",
  displayStyleId: "@1",
};

const cameraOffView = {
  cameraOn: false,
  origin: [
    -23.625709412040386,
    -80.7768748077716,
    -105.35651978750751
  ],
  extents: [
    224.26011669769352,
    211.51108266624928,
    249.51486162818406
  ],
  angles: {
    pitch: 19.609147443371107,
    roll: -58.40009741588226,
    yaw: -11.665541819368947
  },
  camera: {
    lens: 45.95389015950363,
    focusDist: 264.45767738020345,
    eye: [
      -37.86342074001966,
      -118.27234989806631,
      132.40005835408056
    ]
  },
  code: Code.createEmpty(),
  model: IModel.dictionaryId,
  classFullName: "test",
  categorySelectorId: "@1",
  displayStyleId: "@1",
}

const ecefLocProps = {
  origin: [
    1255641.5519893507,
    -4732698.684827632,
    4073546.2460685894
  ],
  orientation: {
    pitch: -49.005021293968355,
    roll: -11.823580111180991,
    yaw: -90.642664633961
  },
  transform: [
    [
      -0.007357864592832313,
      0.9804561979367872,
      0.19659986204464436,
      1255641.5519893507
    ],
    [
      -0.6559516195525271,
      0.14366280316126617,
      -0.7410050416793829,
      -4732698.684827632
    ],
    [
      -0.75476707309941,
      -0.13441221267127085,
      0.6420747794842614,
      4073546.2460685894
    ]
  ],
  cartographicOrigin: {
    latitude: 0.6972007432483922,
    longitude: -1.311456937133241,
    height: 4.102413240985213
  }
};
const ecefLoc = new EcefLocation(ecefLocProps);

describe("createCesiumCameraProps", () => {
  it("creates a CesiumCameraProps object from SpatialViewDefinitionProps with the camera on (perspective projection)", () => {
    const cesiumCameraProps = createCesiumCameraProps({ viewDefinition: cameraOnView, ecefLoc });

    const expectedCesiumCameraProps = {
      position: { x: 1255551.8995579786, y: -4732788.948703558, z: 4073675.732118358 },
      direction: { x: 0.4713215948502468, y: 0.28355077006441065, z: -0.8351376623190333 },
      up: { x: 0.6668920140307033, y: -0.7342387351881554, z: 0.12707683255168906 },
      frustum: {
        near: 1.0,
        far: 500000000.0,
        fov: 0.8020466873831604
      },
    };

    expectPointToEqual(cesiumCameraProps.position, expectedCesiumCameraProps.position, false);
    expectPointToEqual(cesiumCameraProps.direction, expectedCesiumCameraProps.direction, false);
    expectPointToEqual(cesiumCameraProps.up, expectedCesiumCameraProps.up, false);

    expect(cesiumCameraProps.frustum.fov).toBeCloseTo(expectedCesiumCameraProps.frustum.fov);
    expect(cesiumCameraProps.frustum.width).to.be.undefined;
    expect(cesiumCameraProps.frustum.near).to.equal(expectedCesiumCameraProps.frustum.near);
    expect(cesiumCameraProps.frustum.far).to.equal(expectedCesiumCameraProps.frustum.far);
  });

  it("creates a CesiumCameraProps object from SpatialViewDefinitionProps with the camera off (orthographic projection)", () => {
    const cesiumCameraProps = createCesiumCameraProps({ viewDefinition: cameraOffView, ecefLoc });

    const expectedCesiumCameraProps = {
      position: { x: 1255389.8978600262, y: -4732988.808369093, z: 4073555.356273554 },
      direction: { x: 0.692078850684251, y: 0.7011604395228591, z: -0.17146691367047218 },
      up: { x: 0.6188478278988585, y: -0.4540867701756252, z: 0.6409622227997012 },
      frustum: {
        near: 1.0,
        far: 500000000.0,
        width: 224.26011669769352
      },
    };

    expectPointToEqual(cesiumCameraProps.position, expectedCesiumCameraProps.position, false);
    expectPointToEqual(cesiumCameraProps.direction, expectedCesiumCameraProps.direction, false);
    expectPointToEqual(cesiumCameraProps.up, expectedCesiumCameraProps.up, false);

    expect(cesiumCameraProps.frustum.fov).to.be.undefined;
    expect(cesiumCameraProps.frustum.width).toBeCloseTo(expectedCesiumCameraProps.frustum.width);
    expect(cesiumCameraProps.frustum.near).to.equal(expectedCesiumCameraProps.frustum.near);
    expect(cesiumCameraProps.frustum.far).to.equal(expectedCesiumCameraProps.frustum.far);
  });
});