/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Guid, GuidString, ProcessDetector } from "@itwin/core-bentley";
import { Point3d, Range3d, Vector3d } from "@itwin/core-geometry";
import { Cartographic, ElementProps, IModel } from "@itwin/core-common";
import { BlankConnection, ScreenViewport, SpatialViewState } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { SchemaKey } from "@itwin/ecschema-metadata";

function createViewDiv() {
  const div = document.createElement("div");
  expect(null !== div).toBeTruthy();
  div.style.width = div.style.height = "1000px";
  document.body.appendChild(div);
  return div;
}

const describeChrome = ProcessDetector.isElectronAppFrontend ? describe.skip : describe;
describeChrome("Blank Connection", () => {
  let blankConnection: BlankConnection;
  const viewDiv = createViewDiv();
  const iTwinId: GuidString = Guid.createValue();

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    const exton = Cartographic.fromDegrees({ longitude: -75.686694, latitude: 40.065757, height: 0 });
    blankConnection = BlankConnection.create({
      name: "test",
      location: exton,
      extents: new Range3d(-1000, -1000, -100, 1000, 1000, 100),
      iTwinId,
    });
  });
  afterAll(async () => {
    await blankConnection?.close();
    await TestUtility.shutdownFrontend();
  });

  it("BlankConnection properties", async () => {
    expect(blankConnection.isOpen).toBe(false);
    expect(blankConnection.isClosed).toBe(true);
    expect(blankConnection.iModelId).toBeUndefined();
    expect(iTwinId).toBe(blankConnection.iTwinId);
    expect(() => blankConnection.getRpcProps()).toThrow();
    const elementProps: ElementProps[] = await blankConnection.elements.getProps(IModel.rootSubjectId);
    expect(0).toBe(elementProps.length);
    expect(blankConnection.schemaContext).toBeDefined();
    await expect(blankConnection.schemaContext.getSchema(new SchemaKey("BisCore"))).rejects.toThrow();
  });

  it("ScreenViewport with a BlankConnection", async () => {
    const origin = new Point3d();
    const extents = new Vector3d(1, 1, 1);
    const spatial = SpatialViewState.createBlank(blankConnection, origin, extents);
    const vp = ScreenViewport.create(viewDiv, spatial);
    expect(vp).toBeDefined();
  });
});
