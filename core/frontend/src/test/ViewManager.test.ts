/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { OnScreenTarget } from "../core-frontend";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { createBlankConnection } from "./createBlankConnection";
import { openBlankViewport } from "./openBlankViewport";
import { expectColors } from "./ExpectColors";
import { ColorDef, EmptyLocalization } from "@itwin/core-common";

describe("ViewManager", () => {
  let imodel: IModelConnection;

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    imodel = createBlankConnection("view-manager-test");
  });

  afterEach(async () => {
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

  /** Dropping and immediately re-adding an unresized viewport to the view manager would result in a black rendering
   * until the viewport was manually resized. This happened because when the viewport was removed it would have a 0,0
   * dimension, which was internally recorded (but not acted upon with regard to framebuffers). Once re-adding the viewport,
   * it would be flagged as having a size change because its dimensions were no longer 0 (they became the original
   * dimensions). Disposing and recreating the framebuffers with the same dimensions as the previous framebuffers caused the
   * black rendering in the particular case of re-adding the viewport.
   *
   * We resolved this problem by adding a check to not record a dimension change if the new dimensions are 0 -- we really
   * do not want to create framebuffers with those dimensions anyway, because that is invalid.
   *
   * This test verifies that this problem has been resolved.
   */
  it("should not render black when dropping and re-adding viewport with same dimensions", async () => {
    const vp = openBlankViewport({ width: 32, height: 32 });
    vp.displayStyle.backgroundColor = ColorDef.red;
    IModelApp.viewManager.addViewport(vp);
    vp.renderFrame();
    expectColors(vp, [ColorDef.red]);
    IModelApp.viewManager.dropViewport(vp, false);
    IModelApp.viewManager.addViewport(vp);
    vp.renderFrame();
    expectColors(vp, [ColorDef.red]);
    vp.dispose();
  });

  it("should dispose of viewport when onShutdown is called", async () => {
    const vp = openBlankViewport({ width: 30, height: 30 });
    IModelApp.viewManager.addViewport(vp);
    await IModelApp.shutdown();

    assert.isTrue(vp.isDisposed);
  });
});
