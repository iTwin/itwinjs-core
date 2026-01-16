/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { BackgroundMapGeometry, BlankConnection, IModelApp } from "@itwin/core-frontend";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { assert, expect } from "chai";

describe("Frontend snippet", () => {
  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => IModelApp.shutdown());

  it.only("test -- frontend", () => {
    assert.isTrue(false);
  });

  it.only("creates new background map geometry when the origin is (0, 0, 0)", async () => {
    const name = "test-blank-connection";
    const extents = new Range3d(-2500, -2500, -1000, 2500, 2500, 1000);
    const globalOrigin = new Point3d(0, 0, 0);
    const iTwinId = Guid.createValue();
    const imodel = BlankConnection.create({ name, location: { origin: [0, 0, 0], orientation: { yaw: 0, pitch: 0, roll: 0 } }, extents, iTwinId, globalOrigin });

    const geometry = new BackgroundMapGeometry(0, 0, imodel);
    expect(geometry).to.not.be.undefined;
  });
});
