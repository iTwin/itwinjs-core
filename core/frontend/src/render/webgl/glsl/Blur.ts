/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { VariableType, FragmentShaderComponent, VariablePrecision } from "../ShaderBuilder";
import { TextureUnit } from "../RenderFlags";
import { ShaderProgram } from "../ShaderProgram";
import { createViewportQuadBuilder } from "./ViewportQuad";
import { GLSLFragment, addWindowToTexCoords } from "./Fragment";
import { BlurGeometry } from "../CachedGeometry";
import { Texture2DHandle } from "../Texture";
import { addViewport } from "./Viewport";
import { GLSLDecode } from "./Decode";

// This shader applies a Gaussian blur in one dimension.
const computeBlur = `
  float delta = u_blurSettings.x;
  float sigma = u_blurSettings.y;
  float texelStepSize = u_blurSettings.z;

  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec2 step = texelStepSize / u_viewport.zw;

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

export function createBlurProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  addWindowToTexCoords(frag);

  frag.addFunction(GLSLDecode.depthRgb);

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBlur);
  frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);

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
        params.target.ambientOcclusionSettings.blurDelta!,
        params.target.ambientOcclusionSettings.blurSigma!,
        params.target.ambientOcclusionSettings.blurTexelStepSize!]);
      uniform.setUniform3fv(hbaoSettings);
    });
  }, VariablePrecision.High);

  return builder.buildProgram(context);
}
