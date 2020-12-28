/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelApp } from "../../../IModelApp";
import {
  ScreenSpaceEffectBuilder, ScreenSpaceEffectBuilderParams, UniformType,
} from "../../../render/ScreenSpaceEffectBuilder";

describe("ScreenSpaceEffectBuilder", () => {
  before(async () => {
    await IModelApp.startup();
  });

  after(async () => {
    await IModelApp.shutdown();
  });

  function makeBuilderParams(name: string): ScreenSpaceEffectBuilderParams {
    const vertexShader = `
      varying vec4 v_color;
      void effectMain(vec4 pos)
        {
        v_color = mix(pos, u_color, 0.5);
        }`;

    const fragmentShader = `
      varying vec4 v_color;
      vec4 effectMain()
        {
        return v_color;
        }`;

    return {
      name,
      vertexShader,
      fragmentShader,
    };
  }

  function addUniform(builder: ScreenSpaceEffectBuilder) {
    builder.addUniform({
      type: UniformType.Vec4,
      name: "u_color",
      bind: (uniform, _context) => {
        uniform.setUniform4fv([1, 0, 0.5, 1]);
      },
    });
  }

  function makeBuilder(name: string): ScreenSpaceEffectBuilder {
    const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder(makeBuilderParams(name))!;
    expect(builder).not.to.be.undefined;
    addUniform(builder);
    return builder;
  }

  it("creates a simple screen-space effect", () => {
    const builder = makeBuilder("Test");
    builder.finish();

    // ###TODO confirm dynamic technique allocated.
  });

  it("throws if shader fails to compile", () => {
    let params = makeBuilderParams("Test 2");
    let builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder(params)!;
    expect(() => builder.finish()).to.throw(/u_color/);

    params = makeBuilderParams("Test 3");
    params.fragmentShader = "if (u_discard) discard; return v_color;";
    addUniform(builder);
    expect(() => builder.finish()).to.throw(/u_discard/);
  });

  it("throws if an effect already exists by the same name", () => {
    let builder = makeBuilder("Test 4");
    builder.finish();

    builder = makeBuilder("Test 4");
    expect(() => builder.finish()).to.throw(`Screen-space effect "Test 4" is already registered.`);
  });
});
