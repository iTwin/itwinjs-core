/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid, GuidString } from "@bentley/bentleyjs-core";
import { Point3d, Range3d, Vector3d } from "@bentley/geometry-core";
import { Cartographic, ElementProps, IModel } from "@bentley/imodeljs-common";
import { BlankConnection, MockRender, ScreenViewport, SpatialViewState } from "@bentley/imodeljs-frontend";
import { assert } from "chai";

function createViewDiv() {
  const div = document.createElement("div");
  assert(null !== div);
  div!.style.width = div!.style.height = "1000px";
  document.body.appendChild(div!);
  return div;
}

describe("Blank Connection", () => {
  let blankConnection: BlankConnection;
  const viewDiv = createViewDiv();
  const contextId: GuidString = Guid.createValue();

  before(async () => {
    MockRender.App.startup();
    const exton = Cartographic.fromDegrees(-75.686694, 40.065757, 0);
    blankConnection = BlankConnection.create({
      name: "test",
      location: exton,
      extents: new Range3d(-1000, -1000, -100, 1000, 1000, 100),
      contextId,
    });
  });
  after(async () => {
    if (blankConnection) { await blankConnection.close(); }
    MockRender.App.shutdown();
  });

  it("BlankConnection properties", async () => {
    assert.isFalse(blankConnection.isOpen, "A BlankConnection is never considered open");
    assert.isTrue(blankConnection.isClosed, "A BlankConnection is always considered closed");
    assert.isUndefined(blankConnection.iModelId);
    assert.equal(contextId, blankConnection.contextId);
    assert.throws(() => blankConnection.getRpcTokenProps());
    const elementProps: ElementProps[] = await blankConnection.elements.getProps(IModel.rootSubjectId);
    assert.equal(0, elementProps.length);
  });

  it("ScreenViewport with a BlankConnection", async () => {
    const origin = new Point3d();
    const extents = new Vector3d(1, 1, 1);
    const spatial = SpatialViewState.createBlank(blankConnection, origin, extents);
    const vp = ScreenViewport.create(viewDiv!, spatial);
    assert.isDefined(vp);
  });
});
