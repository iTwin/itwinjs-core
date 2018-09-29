/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { TextureUnit, CompositeFlags } from "../RenderFlags";
import { VariableType, FragmentShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { CompositeGeometry } from "../CachedGeometry";
import { Texture2DHandle } from "../Texture";
import { createViewportQuadBuilder } from "./ViewportQuad";
import { GLSLFragment, addWindowToTexCoords } from "./Fragment";
import { addHiliteSettings } from "./FeatureSymbology";

const isEdgePixel = `
bool isEdgePixel(float xOffset, float yOffset) {
  vec2 t = windowCoordsToTexCoords(gl_FragCoord.xy + vec2(xOffset, yOffset));
  vec4 texel = TEXTURE(u_hilite, t);
  return 0.0 != texel.r;
}
`;

const isOutlined = `
bool isOutlined() {
  float width = u_hilite_settings.z;
  if (0.0 == width)
    return false;

  // 1-pixel-wide outline requires max 9 samples. 2-pixel-wide requires max 25 samples.
  if (isEdgePixel(0.0, 1.0) || isEdgePixel(1.0, 0.0) || isEdgePixel(1.0, 1.0)
      || isEdgePixel(0.0, -1.0) || isEdgePixel(-1.0, 0.0) || isEdgePixel(-1.0, -1.0)
      || isEdgePixel(1.0, -1.0) || isEdgePixel(-1.0, 1.0))
    return true;

  if (1.0 == width)
    return false;

  return isEdgePixel(-2.0, -2.0) || isEdgePixel(-1.0, -2.0) || isEdgePixel(0.0, -2.0) || isEdgePixel(1.0, -2.0) || isEdgePixel(2.0, -2.0)
    || isEdgePixel(-2.0, -1.0) || isEdgePixel(2.0, -1.0)
    || isEdgePixel(-2.0, 0.0) || isEdgePixel(2.0, 0.0)
    || isEdgePixel(-2.0, 1.0) || isEdgePixel(2.0, 1.0)
    || isEdgePixel(-2.0, 2.0) || isEdgePixel(-1.0, 2.0) || isEdgePixel(0.0, 2.0) || isEdgePixel(1.0, 2.0) || isEdgePixel(2.0, 2.0);
}
`;

const isInHiliteRegion = "\nbool isInHiliteRegion() { return 0.0 != TEXTURE(u_hilite, v_texCoord).r; }\n";

const computeHiliteColor = "\nvec4 computeColor() { return TEXTURE(u_opaque, v_texCoord); }\n";

const computeHiliteBaseColor = `
  bool isHilite = isInHiliteRegion();
  if (isHilite || !isOutlined()) {
    float ratio = isHilite ? u_hilite_settings.y : 0.0;
    vec4 baseColor = computeColor();
    baseColor.rgb = mix(baseColor.rgb, u_hilite_color.rgb, ratio);
    return baseColor;
  } else {
    return vec4(u_hilite_color.rgb, 1.0);
  }
`;

const computeTranslucentColor = `
vec4 computeColor() {
  vec4 opaque = TEXTURE(u_opaque, v_texCoord);
  vec4 accum = TEXTURE(u_accumulation, v_texCoord);
  float r = TEXTURE(u_revealage, v_texCoord).r;

  vec4 transparent = vec4(accum.rgb / clamp(r, 1e-4, 5e4), accum.a);
  return (1.0 - transparent.a) * transparent + transparent.a * opaque;
}
`;

const computeTranslucentBaseColor = "return computeColor();";

export function createCompositeProgram(flags: CompositeFlags, context: WebGLRenderingContext): ShaderProgram {
  assert(CompositeFlags.None !== flags);

  const wantHilite = CompositeFlags.None !== (flags & CompositeFlags.Hilite);
  const wantTranslucent = CompositeFlags.None !== (flags & CompositeFlags.Translucent);

  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
  frag.addUniform("u_opaque", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_opaque", (uniform, params) => {
      Texture2DHandle.bindSampler(uniform, (params.geometry as CompositeGeometry).opaque, TextureUnit.Zero);
    });
  });

  if (wantHilite) {
    addHiliteSettings(frag);
    addWindowToTexCoords(frag);
    frag.addFunction(isEdgePixel);
    frag.addFunction(isOutlined);
    frag.addFunction(isInHiliteRegion);

    frag.addUniform("u_hilite", VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform("u_hilite", (uniform, params) => {
        Texture2DHandle.bindSampler(uniform, (params.geometry as CompositeGeometry).hilite, TextureUnit.Three);
      });
    });

    frag.set(FragmentShaderComponent.ComputeBaseColor, computeHiliteBaseColor);
    if (!wantTranslucent) {
      frag.addFunction(computeHiliteColor);
    }
  }

  if (wantTranslucent) {
    frag.addUniform("u_accumulation", VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform("u_accumulation", (uniform, params) => {
        Texture2DHandle.bindSampler(uniform, (params.geometry as CompositeGeometry).accum, TextureUnit.One);
      });
    });

    frag.addUniform("u_revealage", VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform("u_revealage", (uniform, params) => {
        Texture2DHandle.bindSampler(uniform, (params.geometry as CompositeGeometry).reveal, TextureUnit.Two);
      });
    });

    frag.addFunction(computeTranslucentColor);
    if (!wantHilite) {
      frag.set(FragmentShaderComponent.ComputeBaseColor, computeTranslucentBaseColor);
    }
  }

  return builder.buildProgram(context);
}
