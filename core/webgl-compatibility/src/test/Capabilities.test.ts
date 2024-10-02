/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Capabilities, DepthType, RenderType } from "../Capabilities";

function createContext(canvas: HTMLCanvasElement, contextAttributes?: WebGLContextAttributes): WebGLRenderingContext | undefined {
  let context = canvas.getContext("webgl", contextAttributes);
  if (null === context) {
    context = canvas.getContext("experimental-webgl", contextAttributes) as WebGLRenderingContext | null; // IE, Edge...
    if (null === context) {
      return undefined;
    }
  }
  return context;
}

function _createCanvas(): HTMLCanvasElement | undefined {
  const canvas = document.createElement("canvas");
  if (null === canvas)
    return undefined;
  return canvas;
}

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
    expect(cap.supportsFragDepth).to.be.false;
    expect(cap.supportsAntiAliasing).to.be.false;
  });

  it("capabilities should be able to be initialized", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = createContext(canvas!);
    expect(context).to.not.be.undefined;

    // Test initializing of capabilities
    const cap: Capabilities = new Capabilities();
    expect(cap.init(context!)).to.not.be.undefined;
  });

  it("capabilities should be able to be read", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = createContext(canvas!);
    expect(context).to.not.be.undefined;

    // Test initializing of capabilities
    const cap: Capabilities = new Capabilities();
    expect(cap.init(context!)).to.be.not.undefined;
    expect(cap.maxTextureSize).to.not.equal(0);
    expect(cap.supportsDrawBuffers).to.be.true; // drawBuffers currently needed (remove when no longer a requirement)
    expect(cap.queryExtensionObject<WEBGL_draw_buffers>("WEBGL_draw_buffers")).to.not.be.undefined;
  });
});
