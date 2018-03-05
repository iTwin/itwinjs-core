/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Capabilities, ViewportQuad, TexturedViewportQuad } from "@bentley/imodeljs-frontend/lib/rendering";

function getWebGLContext(): WebGLRenderingContext | null {
  let canvas = document.getElementById("canvas") as HTMLCanvasElement;
  if (null === canvas)
    canvas = document.createElement("canvas") as HTMLCanvasElement;
  assert.isNotNull(canvas);

  if (null === canvas) {
    return null;
  }

  document.body.appendChild(canvas);
  return canvas.getContext("webgl");
}

describe("System WebGL Capabilities", () => {
  it("capabilities should all default to false", () => {
    const gl = getWebGLContext();
    if (null === gl) {
      return;
    }

    // Test default capabilities
    const cap: Capabilities = new Capabilities();
    assert.isTrue(cap.maxTextureSize === 0, "elementIndexUint should initialize to 0");
    assert.isFalse(cap.nonPowerOf2Textures, "nonPowerOf2Textures should initialize to false");
    assert.isFalse(cap.drawBuffers, "drawBuffers should initialize to false");
    assert.isFalse(cap.elementIndexUint, "elementIndexUint should initialize to false");
    assert.isFalse(cap.textureFloat, "textureFloat should initialize to false");
    assert.isFalse(cap.renderToFloat, "renderToFloat should initialize to false");
    assert.isFalse(cap.depthStencilTexture, "depthStencilTexture should initialize to false");
    assert.isFalse(cap.shaderTextureLOD, "shaderTextureLOD should initialize to false");
  });
  it("capabilities should be able to be initialized", () => {
    const gl = getWebGLContext();
    if (null === gl) {
      return;
    }

    // Test initializing of capabilities
    const cap: Capabilities = new Capabilities();
    const isInitialized: boolean = cap.init();
    assert.isTrue(isInitialized, "capabilities did not initialize properly");
  });
  it("capabilities should be able to be read", () => {
    const gl = getWebGLContext();
    if (null === gl) {
      return;
    }

    // Test initializing of capabilities
    const cap: Capabilities = new Capabilities();
    assert.isTrue(cap.init(), "capabilities did not initialize properly");
    assert.isTrue(cap.maxTextureSize === cap.GetMaxTextureSize(), "GetMaxTextureSize should return cap.maxTextureSize");
    assert.isTrue(cap.nonPowerOf2Textures === cap.SupportsNonPowerOf2Textures(), "SupportsNonPowerOf2Textures should return cap.nonPowerOf2Textures");
    assert.isTrue(cap.drawBuffers === cap.SupportsDrawBuffers(), "SupportsDrawBuffers should return cap.drawBuffers");
    assert.isTrue(cap.elementIndexUint === cap.Supports32BitElementIndex(), "Supports32BitElementIndex should return cap.elementIndexUint");
    assert.isTrue(cap.textureFloat === cap.SupportsTextureFloat(), "SupportsTextureFloat should return cap.textureFloat");
    assert.isTrue(cap.renderToFloat === cap.SupportsRenderToFloat(), "SupportsRenderToFloat should return cap.renderToFloat");
    assert.isTrue(cap.depthStencilTexture === cap.SupportsDepthStencilTexture(), "SupportsDepthStencilTexture should return cap.depthStencilTexture");
    assert.isTrue(cap.shaderTextureLOD === cap.SupportsShaderTextureLOD(), "SupportsShaderTextureLOD should return cap.shaderTextureLOD");
  });
});

describe("ViewportQuad Tests", () => {
  it("ViewportQuad works as expected", () => {
    const vpquad = new ViewportQuad();
    assert.isTrue(vpquad.indices[0] === 0, "index 0 correct");
    assert.isTrue(vpquad.indices[1] === 1, "index 1 correct");
    assert.isTrue(vpquad.indices[2] === 2, "index 2 correct");
    assert.isTrue(vpquad.indices[3] === 0, "index 0 correct");
    assert.isTrue(vpquad.indices[4] === 2, "index 2 correct");
    assert.isTrue(vpquad.indices[5] === 3, "index 3 correct");
    assert.isTrue(vpquad.vertices.length === 4, "vertices initialized correctly");
  });
  it("TexturedViewportQuad works as expected", () => {
    const tvpquad = new TexturedViewportQuad();
    assert.isTrue(tvpquad.indices[0] === 0, "index 0 correct");
    assert.isTrue(tvpquad.indices[1] === 1, "index 1 correct");
    assert.isTrue(tvpquad.indices[2] === 2, "index 2 correct");
    assert.isTrue(tvpquad.indices[3] === 0, "index 0 correct");
    assert.isTrue(tvpquad.indices[4] === 2, "index 2 correct");
    assert.isTrue(tvpquad.indices[5] === 3, "index 3 correct");
    assert.isTrue(tvpquad.vertices.length === 4, "vertices initialized correctly");
    assert.isTrue(tvpquad.textureUV.length === 4, "textureUV initialized correctly");
  });
});
