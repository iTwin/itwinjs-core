/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Capabilities, RenderType, DepthType } from "@bentley/imodeljs-frontend/lib/webgl";
// import { WebGLTestContext } from "./WebGLTestContext";

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
