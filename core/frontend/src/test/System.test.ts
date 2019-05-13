/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Capabilities, RenderType, DepthType, System } from "../webgl";
import { IModelApp } from "../IModelApp";
import { MockRender } from "../render/MockRender";
import { TileAdmin } from "../tile/TileAdmin";
import { RenderSystem } from "../render/System";
import { WebGLRenderCompatibilityStatus, WebGLFeature } from "../RenderCompatibility";

class OverriddenFunctions {
  public origCreateContext = System.createContext;

  public overrideCreateContext(newGetParameter?: (ctx: WebGLRenderingContext, pname: number) => any, useContextAttributes: boolean = true) {
    System.createContext = (canvas, attr) => {
      const ctx = this.origCreateContext(canvas, useContextAttributes ? attr : undefined);
      if (undefined !== ctx && undefined !== newGetParameter) {
        const origGetParameter = ctx.getParameter;
        ctx.getParameter = (pname: number) => {
          const result = newGetParameter(ctx, pname);
          if (result !== undefined)
            return result;
          const boundGetParameter = origGetParameter.bind(ctx);
          return boundGetParameter(pname);
        };
      }
      return ctx;
    };
  }

  public restore() {
    System.createContext = this.origCreateContext;
  }
}

function _createCanvas(): HTMLCanvasElement | undefined {
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  if (null === canvas)
    return undefined;
  return canvas;
}

describe("Render Compatibility", () => {
  const overriddenFunctions = new OverriddenFunctions();

  after(async () => {
    overriddenFunctions.restore();
  });

  // NB: We assume software rendering for these tests because puppeteer only supports software rendering.
  // Further, we run in the context of Chrome, whose Swift software renderer fully supports our renderer.

  it("should query proper render compatibility info assuming software rendering causing performance caveat", () => {
    const compatibility = IModelApp.queryRenderCompatibility();
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MajorPerformanceCaveat);
    expect(compatibility.contextErrorMessage).to.not.be.undefined;
  });

  it("should query proper render compatibility info assuming software rendering ignoring performance caveat", () => {
    overriddenFunctions.overrideCreateContext(undefined, false);
    const compatibility = IModelApp.queryRenderCompatibility();
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.AllOkay);
    expect(compatibility.missingRequiredFeatures.length).to.equal(0);
    expect(compatibility.missingOptionalFeatures.length).to.equal(0);
    expect(compatibility.contextErrorMessage).to.be.undefined;
    overriddenFunctions.restore();
  });

  it("should query proper render compatibility info assuming not enough texture units", () => {
    overriddenFunctions.overrideCreateContext((ctx: WebGLRenderingContext, pname: number): any => {
      if (ctx.MAX_TEXTURE_IMAGE_UNITS === pname)
        return 0;
      return undefined;
    });

    const compatibility = IModelApp.queryRenderCompatibility();
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingRequiredFeatures);
    expect(compatibility.missingRequiredFeatures.indexOf(WebGLFeature.MinimalTextureUnits)).to.not.equal(-1);
    overriddenFunctions.restore();
  });

  it("should query proper render compatibility info assuming lack of MRT support", () => {
    overriddenFunctions.overrideCreateContext((ctx: WebGLRenderingContext, pname: number): any => {
      const dbExt = ctx.getExtension("WEBGL_draw_buffers");
      if (null === dbExt)
        return undefined;
      if (dbExt.MAX_COLOR_ATTACHMENTS_WEBGL === pname)
        return 0;
      return undefined;
    }, false);

    const compatibility = IModelApp.queryRenderCompatibility();
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingOptionalFeatures);
    expect(compatibility.missingOptionalFeatures.indexOf(WebGLFeature.MrtTransparency)).to.not.equal(-1);
    expect(compatibility.missingOptionalFeatures.indexOf(WebGLFeature.MrtPick)).to.not.equal(-1);
    overriddenFunctions.restore();
  });

  it("should query proper render compatibility info assuming lack of uint element index support", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = System.createContext(canvas!);
    expect(context).to.not.be.undefined;

    const caps = new Capabilities();
    const compatibility = caps.init(context!, ["OES_element_index_uint"]);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingRequiredFeatures);
    expect(compatibility.missingRequiredFeatures.indexOf(WebGLFeature.UintElementIndex)).to.not.equal(-1);
  });

  it("should query proper render compatibility info assuming lack of depth texture support", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = System.createContext(canvas!);
    expect(context).to.not.be.undefined;

    const caps = new Capabilities();
    const compatibility = caps.init(context!, ["WEBGL_depth_texture"]);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingOptionalFeatures);
    expect(compatibility.missingOptionalFeatures.indexOf(WebGLFeature.DepthTexture)).to.not.equal(-1);
  });

  it("should query proper render compatibility info assuming lack of instancing support", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = System.createContext(canvas!);
    expect(context).to.not.be.undefined;

    const caps = new Capabilities();
    const compatibility = caps.init(context!, ["ANGLE_instanced_arrays"]);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingOptionalFeatures);
    expect(compatibility.missingOptionalFeatures.indexOf(WebGLFeature.Instancing)).to.not.equal(-1);
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

  after(async () => {
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

describe("System WebGL Capabilities", () => {
  it("capabilities should all default to 0 or false", () => {
    // Test default capabilities.  Change if WebGL2 support added (not all will default to 0 or false).
    const cap: Capabilities = new Capabilities();
    expect(cap.maxRenderType).to.equal(RenderType.TextureUnsignedByte);
    expect(cap.maxDepthType).to.equal(DepthType.RenderBufferUnsignedShort16);
    expect(cap.maxTextureSize).to.equal(0);
    expect(cap.maxColorAttachments).to.equal(0);
    expect(cap.maxDrawBuffers).to.equal(0);
    expect(cap.maxFragTextureUnits).to.equal(0);
    expect(cap.maxVertTextureUnits).to.equal(0);
    expect(cap.maxVertAttribs).to.equal(0);
    expect(cap.maxVertUniformVectors).to.equal(0);
    expect(cap.maxVaryingVectors).to.equal(0);
    expect(cap.maxFragUniformVectors).to.equal(0);
    expect(cap.supportsNonPowerOf2Textures).to.be.false;
    expect(cap.supportsDrawBuffers).to.be.false;
    expect(cap.supports32BitElementIndex).to.be.false;
    expect(cap.supportsTextureFloat).to.be.false;
    expect(cap.supportsTextureHalfFloat).to.be.false;
    expect(cap.supportsShaderTextureLOD).to.be.false;
  });

  // ###TODO: Disabled for now.  Need a way to make a fresh GL obj with new WebGLTestContext API.
  /*
  it("capabilities should be able to be initialized", () => {
    const context = new WebGLTestContext();
    const gl: WebGLRenderingContext | undefined = context.context;
    if (undefined === gl) {
      // do not enable below assert until we know GL can succeed on PRG
      // assert.isOk(false, "Could not initialize GL");
      return;
    }
    // Test initializing of capabilities
    const cap: Capabilities = new Capabilities();
    const isInitialized: boolean = cap.init(gl);
    expect(isInitialized).to.be.true;
  });

  it("capabilities should be able to be read", () => {
    const context = new WebGLTestContext();
    const gl: WebGLRenderingContext | undefined = context.context;
    if (undefined === gl) {
      // do not enable below assert until we know GL can succeed on PRG
      // assert.isOk(false, "Could not initialize GL");
      return;
    }
    // Test initializing of capabilities
    const cap: Capabilities = new Capabilities();
    expect(cap.init(gl)).to.be.true;
    expect(cap.maxTextureSize).to.not.equal(0);
    expect(cap.supportsDrawBuffers).to.be.true; // drawBuffers currently needed (remove when no longer a requirement)
    expect(cap.queryExtensionObject<WEBGL_draw_buffers>("WEBGL_draw_buffers")).to.not.be.undefined;
    expect(cap.queryExtensionObject<OES_texture_float>("Fake extension")).to.be.undefined; // test fake extension
  });
  */
});
