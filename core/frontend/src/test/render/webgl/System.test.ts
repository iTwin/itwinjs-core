/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;

import { ImageSource, ImageSourceFormat, RenderTexture } from "@bentley/imodeljs-common";
import { IModelApp } from "../../../IModelApp";
import { IModelConnection } from "../../../IModelConnection";
import { MockRender } from "../../../render/MockRender";
import { RenderSystem } from "../../../render/RenderSystem";
import { TileAdmin } from "../../../tile/internal";
import { System } from "../../../render/webgl/System";

function _createCanvas(): HTMLCanvasElement | undefined {
  const canvas = document.createElement("canvas");
  if (null === canvas)
    return undefined;
  return canvas;
}

describe("Render Compatibility", () => {
  // NB: We assume software rendering for these tests because puppeteer only supports software rendering.
  // Further, we run in the context of Chrome, whose Swift software renderer fully supports our renderer.
  // We will run this test using WebGL1 since you cannot disable frag_depth in WebGL2.
  it("should turn off logarithmicZBuffer if the gl frag depth extension is not available", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = System.createContext(canvas!, false);
    expect(context).to.not.be.undefined;

    let renderSysOpts: RenderSystem.Options = { logarithmicDepthBuffer: false, useWebGL2: false };
    let testSys = System.create(renderSysOpts);
    expect(testSys.options.logarithmicDepthBuffer).to.be.false;
    renderSysOpts = { logarithmicDepthBuffer: true, useWebGL2: false };
    testSys = System.create(renderSysOpts);
    expect(testSys.options.logarithmicDepthBuffer).to.equal(testSys.capabilities.supportsFragDepth);
    renderSysOpts = { logarithmicDepthBuffer: true, disabledExtensions: ["EXT_frag_depth"], useWebGL2: false };
    testSys = System.create(renderSysOpts);
    expect(testSys.options.logarithmicDepthBuffer).to.be.false;
  });

  it("should return webgl context if webgl2 is unsupported", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    // force canvas to fail context creation if webgl2 is requested
    const originalMethod = canvas!.getContext.bind(canvas);
    (canvas as any).getContext = (contextId: any, args?: any) => {
      if (contextId === "webgl2")
        return null;
      return originalMethod(contextId, args);
    };
    const context = System.createContext(canvas!, false);
    expect(context).to.not.be.undefined;
    expect(context instanceof WebGL2RenderingContext).to.be.false;
    expect(context instanceof WebGLRenderingContext).to.be.true;
  });
});

describe("Instancing", () => {
  class TestApp extends MockRender.App {
    public static async test(enableInstancing: boolean, supportsInstancing: boolean, expectEnabled: boolean): Promise<void> {
      const tileAdminProps: TileAdmin.Props = { enableInstancing };
      const renderSysOpts: RenderSystem.Options = { useWebGL2: false }; // use WebGL1 since instanced arrays cannot be disabled in WebGL2
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

  describe.only("createTextureFromImageSource", () => {
    const imodel = {} as unknown as IModelConnection;

    // This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in
    // bottom right pixel.  The rest of the square is red.
    const imageSource = new ImageSource(new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34,
      232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0,
      0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15,
      4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]), ImageSourceFormat.Png);

    before(async () => {
      await IModelApp.startup();
    });

    after(async () => {
      await IModelApp.shutdown();
    });

    async function requestTexture(key: string | undefined, source?: ImageSource): Promise<RenderTexture | undefined> {
      const params = { key, type: RenderTexture.Type.Normal };
      return IModelApp.renderSystem.createTextureFromImageSource(source ?? imageSource, imodel, params);
    }

    it("should return the same Promise for the same texture", async () => {
      const p1 = requestTexture("a");
      const p2 = requestTexture("a");
      expect(p1).to.equal(p2);

      const t1 = await p1;
      const t2 = await p2;
      expect(t1).to.equal(t2);
      expect(t1).not.to.be.undefined;

      t1!.dispose();
    });

    it("should return different Promise for different textures", async () => {
      const p1 = requestTexture("b");
      const p2 = requestTexture("c");
      expect(p1).not.to.equal(p2);

      const t1 = await p1;
      const t2 = await p2;
      expect(t1).not.to.equal(t2);

      expect(t1).not.to.be.undefined;
      expect(t2).not.to.be.undefined;

      t1!.dispose();
      t2!.dispose();
    });

    it("should return a different Promise for unnamed textures", async () => {
      const p1 = requestTexture(undefined);
      const p2 = requestTexture(undefined);

      expect(p1).not.to.equal(p2);

      const t1 = await p1;
      const t2 = await p2;
      expect(t1).not.to.equal(t2);

      t1!.dispose();
      t2!.dispose();
    });

    it("should return a different Promise for existing textures", async () => {
      const p1 = requestTexture("d");
      const t1 = await p1;

      const p2 = requestTexture("d");
      expect(p2).not.to.equal(p1);

      const t2 = await p2;
      expect(t2).to.equal(p1);

      t1!.dispose();
    });

    it("should throw and remove pending Promise from cache on error", async () => {
      const source = new ImageSource(new Uint8Array([0, 1, 2, 3, 4]), ImageSourceFormat.Png);
      await expect(requestTexture("e", source)).to.be.rejected();
    });

    it("should return undefined after render system is disposed", async () => {
      const promise = requestTexture("f");
      await IModelApp.shutdown();
      const texture = await promise;
      expect(texture).to.be.undefined;
    });
  });
});
