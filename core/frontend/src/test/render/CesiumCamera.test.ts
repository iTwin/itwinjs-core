/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Code, EcefLocation, IModel } from "@itwin/core-common";
import { createCesiumCamera } from "../../internal/render/CesiumCamera";

// Saved view data and ecef location are required to create the Cesium camera
// These values come from saved views created in DTA for Metrostation.bim

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
const ecefLocation = new EcefLocation(ecefLocProps);

describe("createCesiumCamera", () => {
  it("creates a CesiumCamera object from SpatialViewDefinitionProps with the camera on (perspective projection)", () => {
    const cesiumCamera = createCesiumCamera(cameraOnView, ecefLocation);

    expect(cesiumCamera.position.x).toBeCloseTo(1255551.8995579786);
    expect(cesiumCamera.position.y).toBeCloseTo(-4732788.948703558);
    expect(cesiumCamera.position.z).toBeCloseTo(4073675.732118358);

    expect(cesiumCamera.direction.x).toBeCloseTo(0.4713215948502468);
    expect(cesiumCamera.direction.y).toBeCloseTo(0.28355077006441065);
    expect(cesiumCamera.direction.z).toBeCloseTo(-0.8351376623190333);

    expect(cesiumCamera.up.x).toBeCloseTo(0.6668920140307033);
    expect(cesiumCamera.up.y).toBeCloseTo(-0.7342387351881554);
    expect(cesiumCamera.up.z).toBeCloseTo(0.12707683255168906);

    expect(cesiumCamera.frustum.fov).toBeCloseTo(0.8020466873831604);
    expect(cesiumCamera.frustum.near).to.equal(0.01);
    expect(cesiumCamera.frustum.far).to.equal(1000000);
  });

  it("creates a CesiumCamera object from SpatialViewDefinitionProps with the camera off (orthographic projection)", () => {
    const cesiumCamera = createCesiumCamera(cameraOffView, ecefLocation);

    // WIP
    expect(cesiumCamera).toBeDefined;
    console.log(cesiumCamera);
  });
});