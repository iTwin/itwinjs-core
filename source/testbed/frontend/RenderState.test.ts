/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { GL } from "../../frontend/render/GL";
import { RenderState } from "../../frontend/render/RenderState";

// ###TODO: canvas.getContext() returns null on PRG...GPU should not be required
const haveWebGL = false;

function getWebGLContext(): WebGLRenderingContext | null {
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  assert.isNotNull(canvas);

  if (null === canvas) {
    return null;
  }

  document.body.appendChild(canvas);
  return canvas.getContext("webgl");
}

describe("WebGL context tests", () => {
  it("should obtain valid WebGL context", () => {
    const gl = getWebGLContext();
    if (haveWebGL) {
      assert.isNotNull(gl);
    }
  });
});

describe("RenderState API", () => {
  it("should compare as expected", () => {
    // Test equality
    let a = new RenderState();
    assert.isTrue(a.equals(a));

    const b = new RenderState();
    assert.isTrue(a.equals(b));
    assert.isTrue(b.equals(a));

    a.flags.depthTest = true;
    assert.isFalse(a.equals(b));
    b.flags.depthTest = true;
    assert.isTrue(a.equals(b));
    a.flags.depthTest = false;
    b.flags.depthTest = false;

    // Test properties
    b.frontFace = GL.FrontFace.Clockwise; // make different than the default
    assert.isFalse(a.equals(b));
    b.frontFace = GL.FrontFace.CounterClockwise; // set back to default value
    assert.isTrue(a.equals(b));

    b.cullFace = GL.CullFace.Front;
    assert.isFalse(a.equals(b));
    b.cullFace = GL.CullFace.Back;
    assert.isTrue(a.equals(b));

    b.depthFunc = GL.DepthFunc.NotEqual;
    assert.isFalse(a.equals(b));
    b.depthFunc = GL.DepthFunc.Less;
    assert.isTrue(a.equals(b));

    // Test flags
    b.flags.cull = true;
    assert.isFalse(a.equals(b));
    b.flags.cull = false;
    assert.isTrue(a.equals(b));

    b.flags.depthTest = true;
    assert.isFalse(a.equals(b));
    b.flags.depthTest = false;
    assert.isTrue(a.equals(b));

    b.flags.blend = true;
    assert.isFalse(a.equals(b));
    b.flags.blend = false;
    assert.isTrue(a.equals(b));

    b.flags.stencilTest = true;
    assert.isFalse(a.equals(b));
    b.flags.stencilTest = false;
    assert.isTrue(a.equals(b));

    b.flags.depthMask = false;
    assert.isFalse(a.equals(b));
    b.flags.depthMask = true;
    assert.isTrue(a.equals(b));

    // Test blending
    b.blend.setColor([0.0, 0.0, 0.0, 1.0]);
    assert.isFalse(a.equals(b));
    b.blend.setColor([0.0, 0.0, 0.0, 0.0]);
    assert.isTrue(a.equals(b));

    b.blend.equationRgb = GL.BlendEquation.Subtract;
    assert.isFalse(a.equals(b));
    b.blend.equationRgb = GL.BlendEquation.Add;
    assert.isTrue(a.equals(b));

    b.blend.equationAlpha = GL.BlendEquation.Subtract;
    assert.isFalse(a.equals(b));
    b.blend.equationAlpha = GL.BlendEquation.Add;
    assert.isTrue(a.equals(b));

    b.blend.setBlendFunc(GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst);
    assert.isFalse(a.equals(b));
    b.blend.setBlendFunc(GL.BlendFactor.One, GL.BlendFactor.DefaultDst);
    assert.isTrue(a.equals(b));

    b.blend.setBlendFunc(GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate);
    assert.isFalse(a.equals(b));
    b.blend.setBlendFunc(GL.BlendFactor.DefaultSrc, GL.BlendFactor.Zero);
    assert.isTrue(a.equals(b));

    b.blend.setBlendFuncSeperate(GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    assert.isFalse(a.equals(b));
    b.blend.setBlendFuncSeperate(GL.BlendFactor.One, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    assert.isTrue(a.equals(b));

    b.blend.setBlendFuncSeperate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    assert.isFalse(a.equals(b));
    b.blend.setBlendFuncSeperate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.One, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    assert.isTrue(a.equals(b));

    b.blend.setBlendFuncSeperate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst);
    assert.isFalse(a.equals(b));
    b.blend.setBlendFuncSeperate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.Zero, GL.BlendFactor.DefaultDst);
    assert.isTrue(a.equals(b));

    b.blend.setBlendFuncSeperate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.AlphaSaturate);
    assert.isFalse(a.equals(b));
    b.blend.setBlendFuncSeperate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.Zero);
    assert.isTrue(a.equals(b));

    // Test Stencil
    b.stencilMask = 0xF0;
    assert.isFalse(a.equals(b));
    b.stencilMask = ~0;
    assert.isTrue(a.equals(b));

    b.stencil.frontFunction = GL.StencilFunction.Greater;
    assert.isFalse(a.equals(b));
    b.stencil.frontFunction = GL.StencilFunction.Always;
    assert.isTrue(a.equals(b));

    b.stencil.backFunction = GL.StencilFunction.Greater;
    assert.isFalse(a.equals(b));
    b.stencil.backFunction = GL.StencilFunction.Always;
    assert.isTrue(a.equals(b));

    b.stencil.frontRef = 0x08;
    assert.isFalse(a.equals(b));
    b.stencil.frontRef = 0xFF;
    assert.isTrue(a.equals(b));

    b.stencil.backRef = 0x08;
    assert.isFalse(a.equals(b));
    b.stencil.backRef = 0xFF;
    assert.isTrue(a.equals(b));

    b.stencil.frontMask = 0x08;
    assert.isFalse(a.equals(b));
    b.stencil.frontMask = 0xFF;
    assert.isTrue(a.equals(b));

    b.stencil.backMask = 0x08;
    assert.isFalse(a.equals(b));
    b.stencil.backMask = 0xFF;
    assert.isTrue(a.equals(b));

    b.stencil.frontOperation.fail = GL.StencilOperation.IncrWrap;
    assert.isFalse(a.equals(b));
    b.stencil.frontOperation.fail = GL.StencilOperation.Keep;
    assert.isTrue(a.equals(b));

    b.stencil.frontOperation.zFail = GL.StencilOperation.IncrWrap;
    assert.isFalse(a.equals(b));
    b.stencil.frontOperation.zFail = GL.StencilOperation.Keep;
    assert.isTrue(a.equals(b));

    b.stencil.frontOperation.zPass = GL.StencilOperation.IncrWrap;
    assert.isFalse(a.equals(b));
    b.stencil.frontOperation.zPass = GL.StencilOperation.Keep;
    assert.isTrue(a.equals(b));

    b.stencil.backOperation.fail = GL.StencilOperation.IncrWrap;
    assert.isFalse(a.equals(b));
    b.stencil.backOperation.fail = GL.StencilOperation.Keep;
    assert.isTrue(a.equals(b));

    b.stencil.backOperation.zFail = GL.StencilOperation.IncrWrap;
    assert.isFalse(a.equals(b));
    b.stencil.backOperation.zFail = GL.StencilOperation.Keep;
    assert.isTrue(a.equals(b));

    b.stencil.backOperation.zPass = GL.StencilOperation.IncrWrap;
    assert.isFalse(a.equals(b));
    b.stencil.backOperation.zPass = GL.StencilOperation.Keep;
    assert.isTrue(a.equals(b));

    // Test constructor, clone and coppy
    a = new RenderState(b);
    assert.isTrue(a.equals(b));

    a = b.clone();
    assert.isTrue(a.equals(b));

    a.flags.depthTest = true;
    assert.isFalse(b.equals(a));

    b.copyFrom(a);
    assert.isTrue(b.equals(a));

    // Test again with all properties set to non-default values.
    b.frontFace = GL.FrontFace.Clockwise;
    b.cullFace = GL.CullFace.Front;
    b.depthFunc = GL.DepthFunc.NotEqual;
    b.flags.cull = true;
    b.flags.depthTest = true;
    b.flags.blend = true;
    b.flags.stencilTest = true;
    b.flags.depthMask = false;
    b.blend.setColor([0.0, 0.0, 0.0, 1.0]);
    b.blend.equationRgb = GL.BlendEquation.Subtract;
    b.blend.equationAlpha = GL.BlendEquation.Subtract;
    b.blend.setBlendFunc(GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst);
    b.blend.setBlendFunc(GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate);
    b.blend.setBlendFuncSeperate(GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    b.blend.setBlendFuncSeperate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    b.blend.setBlendFuncSeperate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst);
    b.blend.setBlendFuncSeperate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.AlphaSaturate);
    b.stencilMask = 0xF0;
    b.stencil.frontFunction = GL.StencilFunction.Greater;
    b.stencil.backFunction = GL.StencilFunction.Greater;
    b.stencil.frontRef = 0x08;
    b.stencil.backRef = 0x08;
    b.stencil.frontMask = 0x08;
    b.stencil.backMask = 0x08;
    b.stencil.frontOperation.fail = GL.StencilOperation.IncrWrap;
    b.stencil.frontOperation.zFail = GL.StencilOperation.IncrWrap;
    b.stencil.frontOperation.zPass = GL.StencilOperation.IncrWrap;
    b.stencil.backOperation.fail = GL.StencilOperation.IncrWrap;
    b.stencil.backOperation.zFail = GL.StencilOperation.IncrWrap;
    b.stencil.backOperation.zPass = GL.StencilOperation.IncrWrap;
    a = new RenderState(b);
    assert.isTrue(a.equals(b));
    a = b.clone();
    assert.isTrue(a.equals(b));
    a = new RenderState();
    a.copyFrom(b);
    assert.isTrue(a.equals(b));
});
});

describe("RenderState.apply()", () => {
  it("should apply state", () => {
    const gl = getWebGLContext();
    if (haveWebGL) {
      assert.isNotNull(gl);
    }

    if (null === gl) {
      return;
    }

    assert.isTrue(gl.getParameter(GL.Capability.DepthWriteMask) === true, "depth mask should be enabled by default");

    const prevState = new RenderState();
    const newState = new RenderState();

    newState.flags.depthMask = false;
    newState.apply(gl, prevState);
    assert.isTrue(gl.getParameter(GL.Capability.DepthWriteMask) === false, "depth mask should now be disabled");

    prevState.copyFrom(newState);
    assert.isTrue(gl.getParameter(GL.Capability.DepthTest) === false, "depth test should be disabled by default");

    newState.flags.depthTest = true;
    newState.depthFunc = GL.DepthFunc.Always;
    newState.apply(gl, prevState);
    assert.isTrue(gl.getParameter(GL.Capability.DepthTest) === true, "depth test should now be enabled");
    const depthFunc: GL.DepthFunc = gl.getParameter(GL.Capability.DepthFunc) as GL.DepthFunc;
    assert.isTrue(gl.getParameter(GL.Capability.DepthFunc) === GL.DepthFunc.Always, "depth func should be ALWAYS but is " + GL.DepthFunc[depthFunc]);

    prevState.copyFrom(newState);
    assert.isTrue(gl.getParameter(GL.Capability.Blend) === false, "blend should be disabled by default");

    newState.flags.blend = true;
    newState.apply(gl, prevState);
    assert.isTrue(gl.getParameter(GL.Capability.Blend) === true, "blend should now be enabled");

    });
});
