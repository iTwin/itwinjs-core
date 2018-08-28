/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { FeatureOverrides, Target } from "@bentley/imodeljs-frontend/lib/rendering";
import { IModelApp, ScreenViewport, IModelConnection, SpatialViewState, StandardViewId } from "@bentley/imodeljs-frontend";
import { CONSTANTS } from "../common/Testbed";
import * as path from "path";
import { FeatureTable, Feature } from "@bentley/imodeljs-common/lib/Render";
import { Id64 } from "@bentley/bentleyjs-core";
import { WebGLTestContext } from "./WebGLTestContext";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

function waitUntilTimeHasPassed() {
  const ot = Date.now();
  let nt = ot;
  while (nt <= ot) {
    nt = Date.now();
  }
}

describe("FeatureOverrides tests", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;
  let vp: ScreenViewport;

  const viewDiv = document.createElement("div") as HTMLDivElement;
  assert(null !== viewDiv);
  viewDiv!.style.width = viewDiv!.style.height = "1000px";
  document.body.appendChild(viewDiv!);

  before(async () => {   // Create a ViewState to load into a Viewport
    WebGLTestContext.startup();
    imodel = await IModelConnection.openStandalone(iModelLocation);
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  after(async () => {
    if (imodel) await imodel.closeStandalone();
    WebGLTestContext.shutdown();
  });

  it("should create a uniform feature overrides object", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const vpView = spatialView.clone<SpatialViewState>();
    vp = ScreenViewport.create(viewDiv!, vpView);

    vp.target.setHiliteSet(new Set<string>());
    const ovr = FeatureOverrides.createFromTarget(vp.target as Target);
    const tbl = new FeatureTable(1);
    tbl.insertWithIndex(new Feature(new Id64("0x1")), 0);
    ovr.initFromMap(tbl);

    waitUntilTimeHasPassed(); // must wait for time to pass in order for hilite to work

    expect(ovr.isUniform).to.be.true; // should be a uniform because only 1 feature in table

    // set something hilited; should be overridden
    expect(ovr.anyHilited).to.be.false;
    const hls = new Set<string>(); hls.add("0x1");
    vp.target.setHiliteSet(hls);
    ovr.update(tbl);
    expect(ovr.anyHilited).to.be.true;
  });

  it("should create a non-uniform feature overrides object", () => {
    if (!IModelApp.hasRenderSystem)
      return;

    const vpView = spatialView.clone<SpatialViewState>();
    vp = ScreenViewport.create(viewDiv!, vpView);

    vp.target.setHiliteSet(new Set<string>());
    const ovr = FeatureOverrides.createFromTarget(vp.target as Target);
    const tbl = new FeatureTable(2);
    tbl.insertWithIndex(new Feature(new Id64("0x1")), 0);
    tbl.insertWithIndex(new Feature(new Id64("0x2")), 1);
    ovr.initFromMap(tbl);

    waitUntilTimeHasPassed(); // must wait for time to pass in order for hilite to work

    expect(ovr.isNonUniform).to.be.true; // should be a uniform because 2 features in table

    // set something hilited; should be overridden
    expect(ovr.anyHilited).to.be.false;
    const hls = new Set<string>(); hls.add("0x1");
    vp.target.setHiliteSet(hls);
    ovr.update(tbl);
    expect(ovr.anyHilited).to.be.true;
  });
});
