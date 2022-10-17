/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@itwin/webgl-compatibility";
import { BlurGeometry, BlurType } from "../CachedGeometry";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, VariablePrecision, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { Texture2DHandle } from "../Texture";
import { addRenderOrderConstants } from "./FeatureSymbology";
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

// This optionally skips adding in the blur texture result if the current pixel is a linear/edge/silhouette.
const testRenderOrder = `
  vec2 rotc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec4 pdo = TEXTURE(u_pickDepthAndOrder, rotc);
  float order = floor(pdo.x * 16.0 + 0.5);
  if (order >= kRenderOrder_PlanarBit)
    order = order - kRenderOrder_PlanarBit;
  if (order >= kRenderOrder_Linear && order <= kRenderOrder_Silhouette)
    return vec4(1.0);

`;

/** @internal */
export function createBlurProgram(context: WebGLContext, type: BlurType): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  addWindowToTexCoords(frag);

  if (BlurType.TestOrder === type) {
    addRenderOrderConstants(frag);
    frag.set(FragmentShaderComponent.ComputeBaseColor, testRenderOrder + computeBlur);
  } else {
    frag.set(FragmentShaderComponent.ComputeBaseColor, computeBlur);
  }

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

  frag.addUniform(
    "u_blurSettings",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_blurSettings", (uniform, params) => {
        const hbaoSettings = new Float32Array([
          // ###TODO: If we want to apply this blur shader to situations other than AO, we should move these settings away from the ambient occlusion params.
          params.target.ambientOcclusionSettings.blurDelta,
          params.target.ambientOcclusionSettings.blurSigma,
          params.target.ambientOcclusionSettings.blurTexelStepSize,
        ]);
        uniform.setUniform3fv(hbaoSettings);
      });
    },
    VariablePrecision.High
  );

  if (BlurType.TestOrder === type) {
    frag.addUniform("u_pickDepthAndOrder", VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform("u_pickDepthAndOrder", (uniform, params) => {
        const geom = params.geometry as BlurGeometry;
        if (params.target.compositor.needHiddenEdges) Texture2DHandle.bindSampler(uniform, geom.depthAndOrderHidden, TextureUnit.One);
        else Texture2DHandle.bindSampler(uniform, geom.depthAndOrder, TextureUnit.One);
      });
    });
    builder.vert.headerComment = "//!V! BlurTestOrder";
    builder.frag.headerComment = "//!F! BlurTestOrder";
  } else {
    builder.vert.headerComment = "//!V! Blur";
    builder.frag.headerComment = "//!F! Blur";
  }

  return builder.buildProgram(context);
}
