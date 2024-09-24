/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EmptyLocalization } from "@itwin/core-common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../../IModelApp";
import { ScreenSpaceEffectBuilder, ScreenSpaceEffectBuilderParams, UniformType, VaryingType } from "../../../render/ScreenSpaceEffectBuilder";
import { System } from "../../../render/webgl/System";

describe("ScreenSpaceEffectBuilder", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  function makeBuilderParams(name: string): ScreenSpaceEffectBuilderParams {
    const vertex = `
      void effectMain(vec4 pos) {
        v_color = mix(pos, u_color, 0.5);
      }`;

    const fragment = `
      vec4 effectMain() {
        vec4 color = TEXTURE(u_diffuse, vec2(0.5, 0.5));
        return mix(v_color, color, 0.5);
      }`;

    return {
      name,
      source: { vertex, fragment },
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
    expect(builder).toBeDefined();
    addUniform(builder);
    addVarying(builder);
    return builder;
  }

  it("creates a simple screen-space effect", () => {
    const numTechniques = System.instance.techniques.numTechniques;

    const builder = makeBuilder("Test");
    builder.finish();

    expect(System.instance.techniques.numTechniques).toEqual(numTechniques + 1);
    expect(System.instance.techniques.getDynamicTechniqueId("Test")).toBeDefined();
  });

  it("creates an effect that flips the image horizontally", () => {
    const numTechniques = System.instance.techniques.numTechniques;

    const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder({
      name: "Flip Image",
      textureCoordFromPosition: true,
      source: {
        vertex: `
          void effectMain(vec4 pos) {
            vec2 uv = textureCoordFromPosition(pos);
            if (u_flipHorizontal)
              uv.x = 1.0 - uv.x;

            if (u_flipVertical)
              uv.y = 1.0 - uv.y;

            v_uv = uv;
          }`,
        fragment: `
          vec4 effectMain() {
            return sampleSourcePixel();
          }`,
        sampleSourcePixel: "return TEXTURE(u_diffuse, v_uv);",
      },
    })!;

    builder.addUniform({
      name: "u_flipHorizontal",
      type: UniformType.Bool,
      bind: (uniform, _context) => uniform.setUniform1i(1),
    });

    builder.addUniform({
      name: "u_flipVertical",
      type: UniformType.Bool,
      bind: (uniform, _context) => uniform.setUniform1i(0),
    });

    builder.addVarying("v_uv", VaryingType.Vec2);
    builder.finish();

    expect(System.instance.techniques.numTechniques).toEqual(numTechniques + 1);
    expect(System.instance.techniques.getDynamicTechniqueId("Flip Image")).toBeDefined();
  });

  it("throws if shader fails to compile", () => {
    const numTechniques = System.instance.techniques.numTechniques;

    const params = makeBuilderParams("Test 2");
    const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder(params)!;
    addVarying(builder);
    expect(() => builder.finish()).to.throw(/u_color/);

    expect(System.instance.techniques.numTechniques).toEqual(numTechniques);
    expect(System.instance.techniques.getDynamicTechniqueId(params.name)).toBeUndefined();
  });

  it("throws if an effect already exists by the same name", () => {
    const numTechniques = System.instance.techniques.numTechniques;

    let builder = makeBuilder("Test 4");
    builder.finish();

    expect(System.instance.techniques.numTechniques).toEqual(numTechniques + 1);
    expect(System.instance.techniques.getDynamicTechniqueId("Test 4")).toBeDefined();

    builder = makeBuilder("Test 4");
    expect(() => builder.finish()).to.throw(`Screen-space effect "Test 4" is already registered.`);

    expect(System.instance.techniques.numTechniques).toEqual(numTechniques + 1);
    expect(System.instance.techniques.getDynamicTechniqueId("Test 4")).toBeDefined();
  });
});
