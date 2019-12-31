/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  IModelConnection, MockRender, SpatialViewState, ScreenViewport,
} from "@bentley/imodeljs-frontend";
import { assert } from "chai";
import { Cartographic } from "@bentley/imodeljs-common";
import { Range3d, Point3d, Vector3d } from "@bentley/geometry-core";

function createViewDiv() {
  const div = document.createElement("div");
  assert(null !== div);
  div!.style.width = div!.style.height = "1000px";
  document.body.appendChild(div!);
  return div;
}

describe("Blank Connection", () => {
  let connection: IModelConnection;
  const viewDiv = createViewDiv();

  before(async () => {
    MockRender.App.startup();
    const exton = Cartographic.fromDegrees(-75.686694, 40.065757, 0);
    connection = IModelConnection.createBlank({
      name: "test",
      location: exton,
      extents: new Range3d(-1000, -1000, -100, 1000, 1000, 100),
    });
  });
  after(async () => {
    if (connection) await connection.close();
    MockRender.App.shutdown();
  });

  it("Blank connection", async () => {
    const origin = new Point3d();
    const extents = new Vector3d(1, 1, 1);
    const spatial = SpatialViewState.createBlank(connection, origin, extents);
    const vp = ScreenViewport.create(viewDiv!, spatial);
    assert.isDefined(vp);
  });
});
