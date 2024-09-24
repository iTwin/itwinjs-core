/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../../IModelApp";
import { GL } from "../../../render/webgl/GL";
import { RenderState } from "../../../render/webgl/RenderState";
import { System } from "../../../render/webgl/System";
import { EmptyLocalization } from "@itwin/core-common";

describe("RenderState", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  it("should compare as expected", () => {
    // Test equality
    let a = new RenderState();
    expect(a.equals(a)).toBe(true);

    const b = new RenderState();
    expect(a.equals(b)).toBe(true);
    expect(b.equals(a)).toBe(true);

    a.flags.depthTest = true;
    expect(a.equals(b)).toBe(false);
    b.flags.depthTest = true;
    expect(a.equals(b)).toBe(true);
    a.flags.depthTest = false;
    b.flags.depthTest = false;

    // Test properties
    b.frontFace = GL.FrontFace.Clockwise; // make different than the default
    expect(a.equals(b)).toBe(false); // expected different frontFace to compare as !equal
    b.frontFace = GL.FrontFace.CounterClockwise; // set back to default value
    expect(a.equals(b)).toBe(true); // expected same frontFace to compare as equal

    b.cullFace = GL.CullFace.Front;
    expect(a.equals(b)).toBe(false); // expected different cullFace to compare as !equal
    b.cullFace = GL.CullFace.Back;
    expect(a.equals(b)).toBe(true); // expected same cullFace to compare as equal

    b.depthFunc = GL.DepthFunc.NotEqual;
    expect(a.equals(b)).toBe(false); // expected different depthFunc to compare as !equal
    b.depthFunc = GL.DepthFunc.LessOrEqual;
    expect(a.equals(b)).toBe(true); // expected same depthFunc to compare as equal

    // Test flags
    b.flags.cull = true;
    expect(a.equals(b)).toBe(false); // expected different cull flag to compare as !equal
    b.flags.cull = false;
    expect(a.equals(b)).toBe(true); // expected same cull flag to compare as equal

    b.flags.depthTest = true;
    expect(a.equals(b)).toBe(false); // expected different depthTest flag to compare as !equal
    b.flags.depthTest = false;
    expect(a.equals(b)).toBe(true); // expected same depthTest flag to compare as equal

    b.flags.blend = true;
    expect(a.equals(b)).toBe(false); // expected different blend flag to compare as !equal
    b.flags.blend = false;
    expect(a.equals(b)).toBe(true); // expected same blend flag to compare as equal

    b.flags.stencilTest = true;
    expect(a.equals(b)).toBe(false); // expected different stencilTest flag to compare as !equal
    b.flags.stencilTest = false;
    expect(a.equals(b)).toBe(true); // expected same stencilTest flag to compare as equal

    b.flags.depthMask = false;
    expect(a.equals(b)).toBe(false); // expected different depthMask flag to compare as !equal
    b.flags.depthMask = true;
    expect(a.equals(b)).toBe(true); // expected same depthMask flag to compare as equal

    // Test blending
    b.blend.setColor([0.0, 0.0, 0.0, 1.0]);
    expect(a.equals(b)).toBe(false); // expected different blend color to compare as !equal
    b.blend.setColor([0.0, 0.0, 0.0, 0.0]);
    expect(a.equals(b)).toBe(true); // expected same blend color to compare as equal

    b.blend.equationRgb = GL.BlendEquation.Subtract;
    expect(a.equals(b)).toBe(false); // expected different blend equationRgb to compare as !equal
    b.blend.equationRgb = GL.BlendEquation.Add;
    expect(a.equals(b)).toBe(true); // expected same blend equationRgb to compare as equal

    b.blend.equationAlpha = GL.BlendEquation.Subtract;
    expect(a.equals(b)).toBe(false); // expected different blend equationAlpha to compare as !equal
    b.blend.equationAlpha = GL.BlendEquation.Add;
    expect(a.equals(b)).toBe(true); // expected same blend equationAlpha to compare as equal

    b.blend.setBlendFunc(GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst);
    expect(a.equals(b)).toBe(false); // expected different blend function src to compare as !equal
    b.blend.setBlendFunc(GL.BlendFactor.One, GL.BlendFactor.DefaultDst);
    expect(a.equals(b)).toBe(true); // expected same blend function src to compare as equal

    b.blend.setBlendFunc(GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate);
    expect(a.equals(b)).toBe(false); // expected different blend function dst to compare as !equal
    b.blend.setBlendFunc(GL.BlendFactor.DefaultSrc, GL.BlendFactor.Zero);
    expect(a.equals(b)).toBe(true); // expected same blend function dst to compare as equal

    b.blend.setBlendFuncSeparate(GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    expect(a.equals(b)).toBe(false); // expected different blend function src rgb to compare as !equal
    b.blend.setBlendFuncSeparate(GL.BlendFactor.One, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    expect(a.equals(b)).toBe(true); // expected same blend function src rgb to compare as equal

    b.blend.setBlendFuncSeparate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    expect(a.equals(b)).toBe(false); // expected different blend function dst rgb to compare as !equal
    b.blend.setBlendFuncSeparate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.One, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    expect(a.equals(b)).toBe(true); // expected same blend function dst rgb to compare as equal

    b.blend.setBlendFuncSeparate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst);
    expect(a.equals(b)).toBe(false); // expected different blend function src alpha to compare as !equal
    b.blend.setBlendFuncSeparate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.Zero, GL.BlendFactor.DefaultDst);
    expect(a.equals(b)).toBe(true); // expected same blend function src alpha to compare as equal

    b.blend.setBlendFuncSeparate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.AlphaSaturate);
    expect(a.equals(b)).toBe(false); // expected different blend function dst alpha to compare as !equal
    b.blend.setBlendFuncSeparate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.Zero);
    expect(a.equals(b)).toBe(true); // expected same blend function dst alpha to compare as equal

    // Test Stencil
    b.stencilMask = 0xf0;
    expect(a.equals(b)).toBe(false); // expected different stencilMask to compare as !equal
    b.stencilMask = 0xffffffff;
    expect(a.equals(b)).toBe(true); // expected same stencilMask to compare as equal

    b.stencil.frontFunction.function = GL.StencilFunction.Greater;
    expect(a.equals(b)).toBe(false); // expected different stencil frontFunction to compare as !equal
    b.stencil.frontFunction.function = GL.StencilFunction.Always;
    expect(a.equals(b)).toBe(true); // expected same stencil frontFunction to compare as equal

    b.stencil.backFunction.function = GL.StencilFunction.Greater;
    expect(a.equals(b)).toBe(false); // expected different stencil backFunction to compare as !equal
    b.stencil.backFunction.function = GL.StencilFunction.Always;
    expect(a.equals(b)).toBe(true); // expected same stencil backFunction to compare as equal

    b.stencil.frontFunction.ref = 0x08;
    expect(a.equals(b)).toBe(false); // expected different stencil frontRef to compare as !equal
    b.stencil.frontFunction.ref = 0;
    expect(a.equals(b)).toBe(true); // expected same stencil frontRef to compare as equal
    b.stencil.backFunction.ref = 0x08;
    expect(a.equals(b)).toBe(false); // expected different stencil backRef to compare as !equal
    b.stencil.backFunction.ref = 0;
    expect(a.equals(b)).toBe(true); // expected same stencil backRef to compare as equal

    b.stencil.frontFunction.mask = 0x08;
    expect(a.equals(b)).toBe(false); // expected different stencil frontMask to compare as !equal
    b.stencil.frontFunction.mask = 0xffffffff;
    expect(a.equals(b)).toBe(true); // expected same stencil frontMask to compare as equal

    b.stencil.backFunction.mask = 0x08;
    expect(a.equals(b)).toBe(false); // expected different stencil backMask to compare as !equal
    b.stencil.backFunction.mask = 0xffffffff;
    expect(a.equals(b)).toBe(true); // expected same stencil backMask to compare as equal

    b.stencil.frontOperation.fail = GL.StencilOperation.IncrWrap;
    expect(a.equals(b)).toBe(false); // expected different stencil frontOperation fail to compare as !equal
    b.stencil.frontOperation.fail = GL.StencilOperation.Keep;
    expect(a.equals(b)).toBe(true); // expected same stencil frontOperation fail to compare as equal

    b.stencil.frontOperation.zFail = GL.StencilOperation.IncrWrap;
    expect(a.equals(b)).toBe(false); // expected different stencil frontOperation zFail to compare as !equal
    b.stencil.frontOperation.zFail = GL.StencilOperation.Keep;
    expect(a.equals(b)).toBe(true); // expected same stencil frontOperation zFail to compare as equal

    b.stencil.frontOperation.zPass = GL.StencilOperation.IncrWrap;
    expect(a.equals(b)).toBe(false); // expected different stencil frontOperation zPass to compare as !equal
    b.stencil.frontOperation.zPass = GL.StencilOperation.Keep;
    expect(a.equals(b)).toBe(true); // expected same stencil frontOperation zPass to compare as equal

    b.stencil.backOperation.fail = GL.StencilOperation.IncrWrap;
    expect(a.equals(b)).toBe(false); // expected different stencil backOperation fail to compare as !equal
    b.stencil.backOperation.fail = GL.StencilOperation.Keep;
    expect(a.equals(b)).toBe(true); // expected same stencil backOperation fail to compare as equal

    b.stencil.backOperation.zFail = GL.StencilOperation.IncrWrap;
    expect(a.equals(b)).toBe(false); // expected different stencil backOperation zFail to compare as !equal
    b.stencil.backOperation.zFail = GL.StencilOperation.Keep;
    expect(a.equals(b)).toBe(true); // expected same stencil backOperation zFail to compare as equal

    b.stencil.backOperation.zPass = GL.StencilOperation.IncrWrap;
    expect(a.equals(b)).toBe(false); // expected different stencil backOperation zPass to compare as !equal
    b.stencil.backOperation.zPass = GL.StencilOperation.Keep;
    expect(a.equals(b)).toBe(true); // expected same stencil backOperation zPass to compare as equal

    // Test constructor, clone and coppy
    a = new RenderState(b);
    expect(a.equals(b)).toBe(true); // expected constructor copied RenderState to compare as equal

    a = b.clone();
    expect(a.equals(b)).toBe(true); // expected cloned RenderState to compare as equal

    a.flags.depthTest = true;
    expect(b.equals(a)).toBe(false); // expected modified cloned RenderState to compare as !equal

    b.copyFrom(a);
    expect(b.equals(a)).toBe(true); // expected copyFrom RenderState to compare as equal

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
    b.blend.setBlendFuncSeparate(GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    b.blend.setBlendFuncSeparate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst, GL.BlendFactor.DefaultDst);
    b.blend.setBlendFuncSeparate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.AlphaSaturate, GL.BlendFactor.DefaultDst);
    b.blend.setBlendFuncSeparate(GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultSrc, GL.BlendFactor.DefaultDst, GL.BlendFactor.AlphaSaturate);
    b.stencilMask = 0xf0;
    b.stencil.frontFunction.function = GL.StencilFunction.Greater;
    b.stencil.backFunction.function = GL.StencilFunction.Greater;
    b.stencil.frontFunction.ref = 0x08;
    b.stencil.backFunction.ref = 0x08;
    b.stencil.frontFunction.mask = 0x08;
    b.stencil.backFunction.mask = 0x08;
    b.stencil.frontOperation.fail = GL.StencilOperation.IncrWrap;
    b.stencil.frontOperation.zFail = GL.StencilOperation.IncrWrap;
    b.stencil.frontOperation.zPass = GL.StencilOperation.IncrWrap;
    b.stencil.backOperation.fail = GL.StencilOperation.IncrWrap;
    b.stencil.backOperation.zFail = GL.StencilOperation.IncrWrap;
    b.stencil.backOperation.zPass = GL.StencilOperation.IncrWrap;
    a = new RenderState(b);
    expect(a.equals(b)).toBe(true); // expected constructor copied non-default RenderState to compare as equal
    a = b.clone();
    expect(a.equals(b)).toBe(true); // expected cloned non-default RenderState to compare as equal
    a = new RenderState();
    a.copyFrom(b);
    expect(a.equals(b)).toBe(true); // expected copyFrom non-default RenderState to compare as equal
  });

  it("should have expected initial WebGL context state", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    // A default-constructed RenderState object should match the initial state of a newly-created WebGLRenderingContext.
    const gl = System.instance.context;
    const rs = new RenderState();

		type TestCase = [number, number | boolean];
		const testCases: TestCase[] = [
		  [GL.Capability.FrontFace, rs.frontFace],
		  [GL.Capability.CullFaceMode, rs.cullFace],
		  [GL.Capability.DepthFunc, rs.depthFunc],
		  [GL.Capability.CullFace, rs.flags.cull],
		  [GL.Capability.DepthTest, rs.flags.depthTest],
		  [GL.Capability.Blend, rs.flags.blend],
		  [GL.Capability.StencilTest, rs.flags.stencilTest],
		  [GL.Capability.DepthWriteMask, rs.flags.depthMask],

		  [GL.Capability.BlendEquationRGB, rs.blend.equationRgb],
		  [GL.Capability.BlendEquationAlpha, rs.blend.equationAlpha],
		  [GL.Capability.BlendSrcRgb, rs.blend.functionSourceRgb],
		  [GL.Capability.BlendSrcAlpha, rs.blend.functionSourceAlpha],
		  [GL.Capability.BlendDstRgb, rs.blend.functionDestRgb],
		  [GL.Capability.BlendDstAlpha, rs.blend.functionDestAlpha],

		  [GL.Capability.StencilFrontFunc, rs.stencil.frontFunction.function],
		  [GL.Capability.StencilFrontRef, rs.stencil.frontFunction.ref],
		  [GL.Capability.StencilFrontOpFail, rs.stencil.frontOperation.fail],
		  [GL.Capability.StencilFrontOpZFail, rs.stencil.frontOperation.zFail],
		  [GL.Capability.StencilFrontOpZPass, rs.stencil.frontOperation.zPass],

		  [GL.Capability.StencilBackFunc, rs.stencil.backFunction.function],
		  [GL.Capability.StencilBackRef, rs.stencil.backFunction.ref],
		  [GL.Capability.StencilBackOpFail, rs.stencil.backOperation.fail],
		  [GL.Capability.StencilBackOpZFail, rs.stencil.backOperation.zFail],
		  [GL.Capability.StencilBackOpZPass, rs.stencil.backOperation.zPass],

		  // The WebGL spec states these are 32-bit unsigned integers and initially all bits are set.
		  // Chrome or ANGLE appears to have a bug that always leaves the high bit unset, even if you explicitly
		  // call e.g., stencilMask(0xffffffff).
		  // Firefox does not exhibit this bug.
		  // Ignore for now.
		  // [GL.Capability.StencilWriteMask, rs.stencilMask],
		  // [GL.Capability.StencilFrontWriteMask, rs.stencil.frontFunction.mask],
		  // [GL.Capability.StencilBackWriteMask, rs.stencil.backFunction.mask],
		];

		for (const testCase of testCases) {
		  const actualValue = gl.getParameter(testCase[0]);
		  expect(testCase[1]).toEqual(actualValue);
		}

		const glBlendColor = gl.getParameter(GL.Capability.BlendColor);
		const rsBlendColor = rs.blend.color;
		for (let i = 0; i < 4; i++)
		  expect(rsBlendColor[i]).toEqual(glBlendColor[i]);
  });

  it("should apply state", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const gl = System.instance.context;

    const prevState = new RenderState();
    const newState = new RenderState();

    prevState.copyFrom(newState);
    newState.flags.cull = true;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.CullFace)).toBe(true);

    prevState.copyFrom(newState);
    newState.flags.depthTest = true;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.DepthTest)).toBe(true);

    prevState.copyFrom(newState);
    newState.flags.blend = true;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.Blend)).toBe(true);

    prevState.copyFrom(newState);
    newState.flags.stencilTest = true;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.StencilTest)).toBe(true);

    newState.frontFace = GL.FrontFace.Clockwise;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.FrontFace)).toBe(GL.FrontFace.Clockwise);

    prevState.copyFrom(newState);
    newState.cullFace = GL.CullFace.Front;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.CullFaceMode)).toBe(GL.CullFace.Front);

    prevState.copyFrom(newState);
    newState.depthFunc = GL.DepthFunc.GreaterOrEqual;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.DepthFunc)).toBe(GL.DepthFunc.GreaterOrEqual);

    prevState.copyFrom(newState);
    newState.flags.depthMask = false;
    newState.apply(prevState);
    // Check if the depthMask flag is now disabled
    expect(gl.getParameter(GL.Capability.DepthWriteMask)).toBe(false);

    prevState.copyFrom(newState);
    newState.stencilMask = 0x03;
    newState.apply(prevState);
    // Check if the stencilMask is now 0x03
    expect(gl.getParameter(GL.Capability.StencilWriteMask)).toBe(0x03);

    prevState.copyFrom(newState);
    newState.blend.setColor([0.1, 0.2, 0.3, 0.4]);
    newState.apply(prevState);
    const blendColor = gl.getParameter(GL.Capability.BlendColor);
    expect(blendColor[0]).toBeCloseTo(0.1, 6);
    expect(blendColor[1]).toBeCloseTo(0.2, 6);
    expect(blendColor[2]).toBeCloseTo(0.3, 6);
    expect(blendColor[3]).toBeCloseTo(0.4, 6);

    prevState.copyFrom(newState);
    newState.blend.equationRgb = GL.BlendEquation.ReverseSubtract;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.BlendEquationRGB)).toBe(GL.BlendEquation.ReverseSubtract); // blend.equationRgb should now be ReverseSubtract

    prevState.copyFrom(newState);
    newState.blend.equationAlpha = GL.BlendEquation.Subtract;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.BlendEquationAlpha)).toBe(GL.BlendEquation.Subtract); // blend.equationAlpha should now be Subtract

    prevState.copyFrom(newState);
    newState.blend.functionSourceRgb = GL.BlendFactor.OneMinusSrcColor;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.BlendSrcRgb)).toBe(GL.BlendFactor.OneMinusSrcColor); // blend.functionSourceRgb should now be OneMinusSrcColor

    prevState.copyFrom(newState);
    newState.blend.functionSourceAlpha = GL.BlendFactor.OneMinusSrcAlpha;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.BlendSrcAlpha)).toBe(GL.BlendFactor.OneMinusSrcAlpha); // blend.functionSourceAlpha should now be OneMinusSrcAlpha

    prevState.copyFrom(newState);
    newState.blend.functionDestRgb = GL.BlendFactor.OneMinusDstColor;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.BlendDstRgb)).toBe(GL.BlendFactor.OneMinusDstColor); // blend.functionDestRgb should now be OneMinusDstColor

    prevState.copyFrom(newState);
    newState.blend.functionDestAlpha = GL.BlendFactor.OneMinusDstAlpha;
    newState.apply(prevState);
    expect(gl.getParameter(GL.Capability.BlendDstAlpha)).toBe(GL.BlendFactor.OneMinusDstAlpha); // blend.functionDestAlpha should now be OneMinusDstAlpha
  });
});
