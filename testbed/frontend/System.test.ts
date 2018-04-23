/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Capabilities, ViewportQuad, TexturedViewportQuad } from "@bentley/imodeljs-frontend/lib/rendering";
import { WebGLTestContext } from "./WebGLTestContext";

describe("System WebGL Capabilities", () => {
  it("capabilities should all default to false", () => {

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
    const context = new WebGLTestContext();
    const canvas = context.canvas;
    if (null === canvas) {
      return;
    }
    // Test initializing of capabilities
    const cap: Capabilities = new Capabilities();
    const isInitialized: boolean = cap.init(canvas);
    assert.isTrue(isInitialized, "capabilities did not initialize properly");
  });

  it("capabilities should be able to be read", () => {
    const context = new WebGLTestContext();
    const canvas = context.canvas;
    if (null === canvas) {
      return;
    }

    // Test initializing of capabilities
    const cap: Capabilities = new Capabilities();
    assert.isTrue(cap.init(canvas), "capabilities did not initialize properly");
    assert.isTrue(0 !== cap.maxTextureSize, "cap.maxTextureSize");
    assert.isTrue(cap.drawBuffers, "cap.drawBuffers");
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
