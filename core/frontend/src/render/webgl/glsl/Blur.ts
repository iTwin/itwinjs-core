/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { VariableType, FragmentShaderComponent } from "../ShaderBuilder";
import { TextureUnit } from "../RenderFlags";
import { ShaderProgram } from "../ShaderProgram";
import { createViewportQuadBuilder } from "./ViewportQuad";
import { GLSLFragment, addWindowToTexCoords } from "./Fragment";
import { BlurGeometry } from "../CachedGeometry";
import { Texture2DHandle } from "../Texture";
import { addViewport } from "./Viewport";
import { GLSLDecode } from "./Decode";
import { readDepthAndOrder } from "./FeatureSymbology";

// This shader applies a Gaussian blur in one dimension.
const computeBlur = `
  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec2 step = 0.86 / u_viewport.zw;

  const float sigma = 2.0;
  const float delta = 1.0;

  vec3 gaussian;
  const float twoPi = 6.283185307179586;
  gaussian.x = 1.0 / (sqrt(twoPi) * sigma);
  gaussian.y = exp((-0.5 * delta * delta) / (sigma * sigma));
  gaussian.z = gaussian.y * gaussian.y;

  vec4 origColor = TEXTURE(u_textureToBlur, tc);
  vec4 result = origColor * gaussian.x;
  float depth = readDepthAndOrder(tc).y;
  for (int i = 1; i < 8; i++) {
    gaussian.xy *= gaussian.yz;

    vec2 offset = float(i) * u_blurDir * step;
    vec2 tcMinusOffset = tc - offset;
    vec2 tcPlusOffset = tc + offset;

    // if (abs(readDepthAndOrder(tcMinusOffset).y - depth) < 0.01)
      result += TEXTURE(u_textureToBlur, tcMinusOffset) * gaussian.x;

    // if (abs(readDepthAndOrder(tcPlusOffset).y - depth) < 0.01)
      result += TEXTURE(u_textureToBlur, tcPlusOffset) * gaussian.x;
  }

  return result;
  // return origColor;
`;

export function createBlurProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  addWindowToTexCoords(frag);

  frag.addFunction(GLSLDecode.depthRgb);
  frag.addFunction(readDepthAndOrder);

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBlur);
  frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);

  frag.addUniform("u_textureToBlur", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_textureToBlur", (uniform, params) => {
      const geom = params.geometry as BlurGeometry;
      Texture2DHandle.bindSampler(uniform, geom.textureToBlur, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_pickDepthAndOrder", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_pickDepthAndOrder", (uniform, params) => {
      const geom = params.geometry as BlurGeometry;
      Texture2DHandle.bindSampler(uniform, geom.depthAndOrder, TextureUnit.One);
    });
  });

  frag.addUniform("u_blurDir", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_blurDir", (uniform, params) => {
      const geom = params.geometry as BlurGeometry;
      uniform.setUniform2fv(new Float32Array([geom.blurDir.x, geom.blurDir.y]));
    });
  });

  addViewport(frag);

  return builder.buildProgram(context);
}
