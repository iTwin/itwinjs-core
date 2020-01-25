/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { TextureUnit, CompositeFlags } from "../RenderFlags";
import { FragmentShaderBuilder, FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { CompositeGeometry } from "../CachedGeometry";
import { Texture2DHandle } from "../Texture";
import { createViewportQuadBuilder } from "./ViewportQuad";
import { assignFragColor, addWindowToTexCoords } from "./Fragment";
import { assert } from "@bentley/bentleyjs-core";

function addHiliteSettings(frag: FragmentShaderBuilder): void {
  frag.addUniform("u_hilite_settings", VariableType.Mat3, (prog) => {
    prog.addProgramUniform("u_hilite_settings", (uniform, params) => {
      params.target.uniforms.hilite.bindCompositeSettings(uniform);
    });
  });

  frag.addUniform("u_hilite_width", VariableType.Vec2, (prog) => {
    prog.addProgramUniform("u_hilite_width", (uniform, params) => {
      params.target.uniforms.hilite.bindCompositeWidths(uniform);
    });
  });
}

const readEdgePixel = `
vec2 readEdgePixel(float xOffset, float yOffset) {
  vec2 t = windowCoordsToTexCoords(gl_FragCoord.xy + vec2(xOffset, yOffset));
  return TEXTURE(u_hilite, t).xy;
}
`;

// alpha channel is 1 if hilited or emphasized.
const computeEdgeColor = `
vec4 computeEdgeColor() {
  float hiliteWidth = u_hilite_width.x;
  float emphWidth = u_hilite_width.y;
  float maxWidth = max(hiliteWidth, emphWidth);
  if (0.0 == maxWidth)
    return vec4(0.0);

  vec2 nearest = vec2(0.0, 0.0);
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      if (0 != x || 0 != y)
        nearest = nearest + readEdgePixel(float(x), float(y));

  nearest = nearest * vec2(float(hiliteWidth > 0.0), float(emphWidth > 0.0));
  float maxNearest = max(nearest.x, nearest.y);
  if (0.0 == maxNearest && maxWidth > 1.0) {
    for (int i = -2; i <= 2; i++) {
      float f = float(i);
      nearest = nearest + readEdgePixel(f, -2.0) + readEdgePixel(-2.0, f) + readEdgePixel(f, 2.0) + readEdgePixel(2.0, f);
    }

    nearest = nearest * vec2(float(hiliteWidth > 1.0), float(emphWidth > 1.0));
    maxNearest = max(nearest.x, nearest.y);
  }

  if (0.0 != maxNearest) {
    float emphasized = float(nearest.y > nearest.x);
    vec3 rgb = mix(u_hilite_settings[0], u_hilite_settings[1], emphasized);
    return vec4(rgb, 1);
  }

  return vec4(0.0);
}
`;

const computeOpaqueColor = `
vec4 computeOpaqueColor() {
  vec4 opaque = TEXTURE(u_opaque, v_texCoord);
  opaque.rgb *= computeAmbientOcclusion();
  return opaque;
}
`;

const computeDefaultAmbientOcclusion = `\nfloat computeAmbientOcclusion() { return 1.0; }\n`;
const computeAmbientOcclusion = `\nfloat computeAmbientOcclusion() { return TEXTURE(u_occlusion, v_texCoord).r; }\n`;

const computeHiliteColor = "\nvec4 computeColor() { return computeOpaqueColor(); }\n";

const computeHiliteBaseColor = `
  vec4 baseColor = computeColor();

  vec2 flags = floor(TEXTURE(u_hilite, v_texCoord).rg + vec2(0.5, 0.5));
  float isHilite = max(flags.x, flags.y);
  if (1.0 == isHilite) {
    float isEmphasize = flags.y * (1.0 - flags.x);
    vec3 rgb = mix(u_hilite_settings[0], u_hilite_settings[1], isEmphasize);
    float ratio = mix(u_hilite_settings[2][0], u_hilite_settings[2][1], isEmphasize) * isHilite;
    return vec4(mix(baseColor.rgb, rgb, ratio), 1.0);
  }

  vec4 outline = computeEdgeColor();
  return mix(baseColor, vec4(outline.rgb, 1.0), outline.a);
`;

const computeTranslucentColor = `
vec4 computeColor() {
  vec4 opaque = computeOpaqueColor();
  vec4 accum = TEXTURE(u_accumulation, v_texCoord);
  float r = TEXTURE(u_revealage, v_texCoord).r;

  vec4 transparent = vec4(accum.rgb / clamp(r, 1e-4, 5e4), accum.a);
  vec4 col = (1.0 - transparent.a) * transparent + transparent.a * opaque;
  return col;
}
`;

const computeTranslucentBaseColor = "return computeColor();";
const computeAmbientOcclusionBaseColor = `\nreturn computeOpaqueColor();\n`;

/** @internal */
export function createCompositeProgram(flags: CompositeFlags, context: WebGLRenderingContext | WebGL2RenderingContext): ShaderProgram {
  assert(CompositeFlags.None !== flags);

  const wantHilite = CompositeFlags.None !== (flags & CompositeFlags.Hilite);
  const wantTranslucent = CompositeFlags.None !== (flags & CompositeFlags.Translucent);
  const wantOcclusion = CompositeFlags.None !== (flags & CompositeFlags.AmbientOcclusion);

  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.addFunction(wantOcclusion ? computeAmbientOcclusion : computeDefaultAmbientOcclusion);
  frag.addFunction(computeOpaqueColor);

  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
  frag.addUniform("u_opaque", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_opaque", (uniform, params) => {
      Texture2DHandle.bindSampler(uniform, (params.geometry as CompositeGeometry).opaque, TextureUnit.Zero);
    });
  });

  if (wantHilite) {
    addHiliteSettings(frag);
    addWindowToTexCoords(frag);
    frag.addFunction(readEdgePixel);
    frag.addFunction(computeEdgeColor);

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

  if (wantOcclusion) {
    frag.addUniform("u_occlusion", VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform("u_occlusion", (uniform, params) => {
        Texture2DHandle.bindSampler(uniform, (params.geometry as CompositeGeometry).occlusion!, TextureUnit.Four);
      });
    });

    if (!wantHilite && !wantTranslucent)
      frag.set(FragmentShaderComponent.ComputeBaseColor, computeAmbientOcclusionBaseColor);
  }

  return builder.buildProgram(context);
}
