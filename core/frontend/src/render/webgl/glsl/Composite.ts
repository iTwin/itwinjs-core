/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import type { WebGLContext } from "@itwin/webgl-compatibility";
import type { CompositeGeometry } from "../CachedGeometry";
import { CompositeFlags, TextureUnit } from "../RenderFlags";
import type { FragmentShaderBuilder} from "../ShaderBuilder";
import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import type { ShaderProgram } from "../ShaderProgram";
import { Texture2DHandle } from "../Texture";
import { addWindowToTexCoords, assignFragColor } from "./Fragment";
import { createViewportQuadBuilder } from "./ViewportQuad";

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

const computeNearbyHilites = `
vec2 computeNearbyHilites() {
  float hiliteWidth = u_hilite_width.x;
  float emphWidth = u_hilite_width.y;
  float maxWidth = max(hiliteWidth, emphWidth);
  if (0.0 == maxWidth)
    return vec2(0.0);

  vec2 nearest = vec2(0.0, 0.0);
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      if (0 != x || 0 != y)
        nearest = nearest + readEdgePixel(float(x), float(y));

  nearest = nearest * vec2(float(hiliteWidth > 0.0), float(emphWidth > 0.0));

  if ((0.0 == nearest.x && hiliteWidth > 1.0) || (0.0 == nearest.y && emphWidth > 1.0)) {
    vec2 farthest = vec2(0.0, 0.0);
    for (int i = -2; i <= 2; i++) {
      float f = float(i);
      farthest = farthest + readEdgePixel(f, -2.0) + readEdgePixel(-2.0, f) + readEdgePixel(f, 2.0) + readEdgePixel(2.0, f);
    }

    farthest = farthest * vec2(float(hiliteWidth > 1.0), float(emphWidth > 1.0));
    nearest = nearest + farthest;
  }

  return nearest;
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
  vec2 flags = TEXTURE(u_hilite, v_texCoord).rg;
  vec2 outline = computeNearbyHilites();
  if (u_hilite_width.y < u_hilite_width.x) { // check for emphasis outline first if it is thinner
    if (outline.y > 0.0 && flags.y == 0.0)
      return vec4(u_hilite_settings[1], 1.0);
    if (outline.x > 0.0 && flags.x == 0.0)
      return vec4(u_hilite_settings[0], 1.0);
  } else {
    if (outline.x > 0.0 && flags.x == 0.0)
      return vec4(u_hilite_settings[0], 1.0);
    if (outline.y > 0.0 && flags.y == 0.0)
      return vec4(u_hilite_settings[1], 1.0);
  }
  float hiliteMix = flags.x * u_hilite_settings[2][0];
  float emphasisMix = flags.y * u_hilite_settings[2][1];
  baseColor.rgb *= (1.0 - (hiliteMix + emphasisMix));
  baseColor.rgb += u_hilite_settings[0] * hiliteMix;
  baseColor.rgb += u_hilite_settings[1] * emphasisMix;
  return baseColor;
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
const computeAmbientOcclusionBaseColor = "return computeOpaqueColor();";

/** @internal */
export function createCompositeProgram(flags: CompositeFlags, context: WebGLContext): ShaderProgram {
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
    frag.addFunction(computeNearbyHilites);

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

  const flagString = (wantHilite ? "-Hilite" : "") + (wantTranslucent ? "-Translucent" : "") + (wantOcclusion ? "-Occlusion" : "");
  builder.vert.headerComment = `//!V! CombineTextures${flagString}`;
  builder.frag.headerComment = `//!F! CombineTextures${flagString}`;

  return builder.buildProgram(context);
}
