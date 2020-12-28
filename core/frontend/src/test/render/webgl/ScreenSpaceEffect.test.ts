/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelApp } from "../../../IModelApp";
import {
  ScreenSpaceEffectBuilder, ScreenSpaceEffectBuilderParams, UniformType, VaryingType,
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
      void effectMain(vec4 pos)
        {
        v_color = mix(pos, u_color, 0.5);
        }`;

    const fragmentShader = `
      vec4 effectMain()
        {
        vec4 color = TEXTURE(u_diffuse, vec2(0.5, 0.5));
        return mix(v_color, color, 0.5);
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

  function addVarying(builder: ScreenSpaceEffectBuilder) {
    builder.addVarying("v_color", VaryingType.Vec4);
  }

  function makeBuilder(name: string): ScreenSpaceEffectBuilder {
    const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder(makeBuilderParams(name))!;
    expect(builder).not.to.be.undefined;
    addUniform(builder);
    addVarying(builder);
    return builder;
  }

  it("creates a simple screen-space effect", () => {
    const builder = makeBuilder("Test");
    builder.finish();

    // ###TODO confirm dynamic technique allocated.
  });

  it("throws if shader fails to compile", () => {
    const params = makeBuilderParams("Test 2");
    const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder(params)!;
    addVarying(builder);
    expect(() => builder.finish()).to.throw(/u_color/);
  });

  it("throws if an effect already exists by the same name", () => {
    let builder = makeBuilder("Test 4");
    builder.finish();

    builder = makeBuilder("Test 4");
    expect(() => builder.finish()).to.throw(`Screen-space effect "Test 4" is already registered.`);
  });
});
