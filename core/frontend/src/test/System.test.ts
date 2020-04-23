/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
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
    public static async test(enableInstancing: boolean, supportsInstancing: boolean, expectEnabled: boolean): Promise<void> {
      const tileAdminProps: TileAdmin.Props = { enableInstancing };
      const renderSysOpts: RenderSystem.Options = {};
      if (!supportsInstancing)
        renderSysOpts.disabledExtensions = ["ANGLE_instanced_arrays"];

      await IModelApp.startup({
        renderSys: renderSysOpts,
        tileAdmin: TileAdmin.create(tileAdminProps),
      });

      expect(IModelApp.tileAdmin.enableInstancing).to.equal(expectEnabled);
      await IModelApp.shutdown();
    }
  }

  after(async () => {
    // make sure app shut down if exception occurs during test
    if (IModelApp.initialized)
      await TestApp.shutdown();
  });

  it("should enable instancing if supported and requested", async () => {
    await TestApp.test(true, true, true);
  });

  it("should not enable instancing if requested but not supported", async () => {
    await TestApp.test(true, false, false);
  });

  it("should not enable instancing if supported but not requested", async () => {
    await TestApp.test(false, true, false);
  });

  it("should not enable instancing if neither requested nor supported", async () => {
    await TestApp.test(false, false, false);
  });
});

describe("RenderSystem", () => {
  it("should override webgl context attributes", () => {
    const expectAttributes = (system: System, expected: WebGLContextAttributes) => {
      const attrs = system.context.getContextAttributes()!;
      expect(attrs).not.to.be.null;
      expect(attrs.premultipliedAlpha).to.equal(expected.premultipliedAlpha);
      expect(attrs.preserveDrawingBuffer).to.equal(expected.preserveDrawingBuffer);
      expect(attrs.antialias).to.equal(expected.antialias);
      expect(attrs.powerPreference).to.equal(expected.powerPreference);
    };

    const defaultSys = System.create();
    expectAttributes(defaultSys, { antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" });

    const sys1Attrs: WebGLContextAttributes = { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: "low-power" };
    const sys1 = System.create({ contextAttributes: sys1Attrs });
    expectAttributes(sys1, sys1Attrs);

    // Override only some attributes; use defaults for others.
    const sys2Attrs: WebGLContextAttributes = { antialias: false, preserveDrawingBuffer: true };
    const sys2 = System.create({ contextAttributes: sys2Attrs });
    expectAttributes(sys2, { ...sys2Attrs, powerPreference: "high-performance", premultipliedAlpha: true });
  });
});
