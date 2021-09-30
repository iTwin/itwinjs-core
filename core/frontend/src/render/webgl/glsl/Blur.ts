/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@itwin/webgl-compatibility";
import { BlurGeometry } from "../CachedGeometry";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, VariablePrecision, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { Texture2DHandle } from "../Texture";
import { decodeDepthRgb } from "./Decode";
import { addWindowToTexCoords, assignFragColor } from "./Fragment";
import { addViewport } from "./Viewport";
import { createViewportQuadBuilder } from "./ViewportQuad";

// This shader applies a Gaussian blur in one dimension.
const computeBlur = `
  float delta = u_blurSettings.x;
  float sigma = u_blurSettings.y;
  float texelStepSize = u_blurSettings.z;

  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec2 step = texelStepSize / u_viewport;

  vec3 gaussian;
  const float twoPi = 6.283185307179586;
  gaussian.x = 1.0 / (sqrt(twoPi) * sigma);
  gaussian.y = exp((-0.5 * delta * delta) / (sigma * sigma));
  gaussian.z = gaussian.y * gaussian.y;

  vec4 origColor = TEXTURE(u_textureToBlur, tc);
  vec4 result = origColor * gaussian.x;
  for (int i = 1; i < 8; i++) {
    gaussian.xy *= gaussian.yz;

    vec2 offset = float(i) * u_blurDir * step;
    vec2 tcMinusOffset = tc - offset;
    vec2 tcPlusOffset = tc + offset;

    result += TEXTURE(u_textureToBlur, tcMinusOffset) * gaussian.x;
    result += TEXTURE(u_textureToBlur, tcPlusOffset) * gaussian.x;
  }

  return result;
`;

/** @internal */
export function createBlurProgram(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  addWindowToTexCoords(frag);

  frag.addFunction(decodeDepthRgb);

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBlur);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  addViewport(frag);

  frag.addUniform("u_textureToBlur", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_textureToBlur", (uniform, params) => {
      const geom = params.geometry as BlurGeometry;
      Texture2DHandle.bindSampler(uniform, geom.textureToBlur, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_blurDir", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_blurDir", (uniform, params) => {
      const geom = params.geometry as BlurGeometry;
      uniform.setUniform2fv(new Float32Array([geom.blurDir.x, geom.blurDir.y]));
    });
  });

  frag.addUniform("u_blurSettings", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_blurSettings", (uniform, params) => {
      const hbaoSettings = new Float32Array([
        // ###TODO: If we want to apply this blur shader to situations other than AO, we should move these settings away from the ambient occlusion params.
        params.target.ambientOcclusionSettings.blurDelta,
        params.target.ambientOcclusionSettings.blurSigma,
        params.target.ambientOcclusionSettings.blurTexelStepSize]);
      uniform.setUniform3fv(hbaoSettings);
    });
  }, VariablePrecision.High);

  builder.vert.headerComment = "//!V! Blur";
  builder.frag.headerComment = "//!F! Blur";

  return builder.buildProgram(context);
}
