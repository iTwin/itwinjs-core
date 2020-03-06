/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { System } from "../webgl";
import { IModelApp } from "../IModelApp";
import { MockRender } from "../render/MockRender";
import { TileAdmin } from "../tile/internal";
import { RenderSystem } from "../render/RenderSystem";

function _createCanvas(): HTMLCanvasElement | undefined {
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  if (null === canvas)
    return undefined;
  return canvas;
}

describe("Render Compatibility", () => {
  // NB: We assume software rendering for these tests because puppeteer only supports software rendering.
  // Further, we run in the context of Chrome, whose Swift software renderer fully supports our renderer.

  it("should turn off logarithmicZBuffer if the gl frag depth extension is not available", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = System.createContext(canvas!);
    expect(context).to.not.be.undefined;

    let renderSysOpts: RenderSystem.Options = { logarithmicDepthBuffer: false };
    let testSys = System.create(renderSysOpts);
    expect(testSys.options.logarithmicDepthBuffer).to.be.false;
    renderSysOpts = { logarithmicDepthBuffer: true };
    testSys = System.create(renderSysOpts);
    expect(testSys.options.logarithmicDepthBuffer).to.equal(testSys.capabilities.supportsFragDepth);
    renderSysOpts = { logarithmicDepthBuffer: true, disabledExtensions: ["EXT_frag_depth"] };
    testSys = System.create(renderSysOpts);
    expect(testSys.options.logarithmicDepthBuffer).to.be.false;
  });
});

describe("Instancing", () => {
  class TestApp extends MockRender.App {
    public static start(enableInstancing: boolean, supportsInstancing: boolean): void {
      const tileAdminProps: TileAdmin.Props = { enableInstancing };
      const renderSysOpts: RenderSystem.Options = {};
      if (!supportsInstancing)
        renderSysOpts.disabledExtensions = ["ANGLE_instanced_arrays"];

      IModelApp.startup({
        renderSys: renderSysOpts,
        tileAdmin: TileAdmin.create(tileAdminProps),
      });
    }
  }

  after(() => {
    // make sure app shut down if exception occurs during test
    if (IModelApp.initialized)
      TestApp.shutdown();
  });

  it("should properly toggle instancing", () => {
    TestApp.start(true, true);
    assert.equal(IModelApp.tileAdmin.enableInstancing, true, "should produce tileAdmin.enableInstancing=true from TestApp.start(true,true)");
    TestApp.shutdown();

    TestApp.start(true, false);
    assert.equal(IModelApp.tileAdmin.enableInstancing, false, "should produce tileAdmin.enableInstancing=false from TestApp.start(true,false)");
    TestApp.shutdown();

    TestApp.start(false, true);
    assert.equal(IModelApp.tileAdmin.enableInstancing, false, "should produce tileAdmin.enableInstancing=false from TestApp.start(false,true)");
    TestApp.shutdown();

    TestApp.start(false, false);
    assert.equal(IModelApp.tileAdmin.enableInstancing, false, "should produce tileAdmin.enableInstancing=false from TestApp.start(false,false)");
    TestApp.shutdown();
  });
});
