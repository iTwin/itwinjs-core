/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { OnScreenTarget } from "../core-frontend";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { createBlankConnection } from "./createBlankConnection";
import { openBlankViewport } from "./openBlankViewport";

describe("ViewManager", () => {
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup();
    imodel = createBlankConnection("view-manager-test");
  });

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  it("should resize fbo properly after dropping a recently-resized viewport", async () => {
    const vp = openBlankViewport({ width: 32, height: 32 });
    IModelApp.viewManager.addViewport(vp);
    vp.renderFrame();
    vp.vpDiv.style.width = vp.vpDiv.style.height = "3px";
    IModelApp.viewManager.dropViewport(vp, false);
    vp.renderFrame();
    expect((vp.target as OnScreenTarget).checkFboDimensions()).to.be.true;
    vp.dispose();
  });
});
