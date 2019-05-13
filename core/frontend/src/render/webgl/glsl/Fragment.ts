/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FragmentShaderBuilder, VariableType, FragmentShaderComponent, SourceBuilder } from "../ShaderBuilder";
import { GLSLDecode } from "./Decode";
import { System } from "../System";

/** @internal */
export function addWindowToTexCoords(frag: FragmentShaderBuilder) {
  const windowCoordsToTexCoords = `\nvec2 windowCoordsToTexCoords(vec2 wc) { return wc * u_invScreenSize; }\n`;
  frag.addFunction(windowCoordsToTexCoords);
  frag.addUniform("u_invScreenSize", VariableType.Vec2, (prog) => {
    prog.addProgramUniform("u_invScreenSize", (uniform, params) => {
      const rect = params.target.viewRect;
      const invScreenSize = [1.0 / rect.width, 1.0 / rect.height];
      uniform.setUniform2fv(invScreenSize);
    });
  });
}

/** @internal */
export function addWhiteOnWhiteReversal(frag: FragmentShaderBuilder) {
  frag.addUniform("u_reverseWhiteOnWhite", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_reverseWhiteOnWhite", (uniform, params) => {
      const bgColor = params.target.bgColor;
      const doReversal = (bgColor.isWhite && params.geometry.wantWoWReversal(params.programParams)) ? 1.0 : 0.0;
      uniform.setUniform1f(doReversal);
    });
  });
  frag.set(FragmentShaderComponent.ReverseWhiteOnWhite, reverseWhiteOnWhite);
}

/** For techniques which by default use MRT, on devices which don't support MRT we fall back to
 * multi-pass rendering. The same shader is used each pass, with a uniform supplied indicating
 * which value to output to gl_FragColor. It's specified as an index - the same one that would be
 * used to index into gl_FragData[] in MRT context.
 * @internal
 */
export function addRenderTargetIndex(frag: FragmentShaderBuilder) {
  frag.addUniform("u_renderTargetIndex", VariableType.Int, (prog) => {
    prog.addProgramUniform("u_renderTargetIndex", (uniform, params) => {
      uniform.setUniform1i(params.target.compositor.currentRenderTargetIndex);
    });
  });
}

const reverseWhiteOnWhite = `
  const vec3 white = vec3(1.0);
  const vec3 epsilon = vec3(0.0001);
  vec3 color = baseColor.rgb / max(0.0001, baseColor.a); // revert premultiplied alpha
  vec3 delta = (color + epsilon) - white;
  vec4 wowColor = vec4(baseColor.rgb * vec3(float(delta.x <= 0.0 || delta.y <= 0.0 || delta.z <= 0.0)), baseColor.a); // set to black if almost white
  wowColor.rgb *= wowColor.a; // reapply premultiplied alpha
  return mix(baseColor, wowColor, floor(u_reverseWhiteOnWhite + 0.5));
`;

const computePickBufferOutputs = `
  vec4 output0 = baseColor;

  // Fix interpolation errors despite all vertices sending exact same v_feature_id...
  ivec4 v_feature_id_i = ivec4(v_feature_id * 255.0 + 0.5);
  vec4 output1 = vec4(v_feature_id_i) / 255.0;
  float linearDepth = computeLinearDepth(v_eyeSpace.z);
  vec4 output2 = vec4(u_renderOrder * 0.0625, encodeDepthRgb(linearDepth)); // near=1, far=0
`;

const assignPickBufferOutputsMRT = `
  FragColor0 = output0;
  FragColor1 = output1;
  FragColor2 = output2;
`;

const assignPickBufferOutputsMP = `
  if (0 == u_renderTargetIndex)
    FragColor = output0;
  else if (1 == u_renderTargetIndex)
    FragColor = output1;
  else
    FragColor = output2;
`;
const reassignFeatureId = "output1 = overrideFeatureId(output1);";

/** @internal */
export function addPickBufferOutputs(frag: FragmentShaderBuilder): void {
  frag.addFunction(GLSLDecode.encodeDepthRgb);
  frag.addFunction(GLSLFragment.computeLinearDepth);

  const prelude = new SourceBuilder();
  const overrideFeatureId = frag.get(FragmentShaderComponent.OverrideFeatureId);
  if (undefined !== overrideFeatureId) {
    frag.addFunction("vec4 overrideFeatureId(vec4 currentId)", overrideFeatureId);
    prelude.add(computePickBufferOutputs);
    prelude.addline(reassignFeatureId);
  } else
    prelude.add(computePickBufferOutputs);

  if (System.instance.capabilities.supportsMRTPickShaders) {
    frag.addDrawBuffersExtension();
    frag.set(FragmentShaderComponent.AssignFragData, prelude.source + assignPickBufferOutputsMRT);
  } else {
    addRenderTargetIndex(frag);
    frag.set(FragmentShaderComponent.AssignFragData, prelude.source + assignPickBufferOutputsMP);
  }
}

/** @internal */
export namespace GLSLFragment {
  export const assignFragColor = "FragColor = baseColor;";

  export const assignFragColorNoAlpha = "FragColor = vec4(baseColor.rgb, 1.0);";

  export const revertPreMultipliedAlpha = `
vec4 revertPreMultipliedAlpha(vec4 rgba) {
  rgba.rgb /= max(0.0001, rgba.a);
  return rgba;
}
`;

  export const applyPreMultipliedAlpha = `
vec4 applyPreMultipliedAlpha(vec4 rgba) {
  rgba.rgb *= rgba.a;
  return rgba;
}
`;

  export const adjustPreMultipliedAlpha = `
vec4 adjustPreMultipliedAlpha(vec4 rgba, float newAlpha) {
  float oldAlpha = rgba.a;
  rgba.rgb /= max(0.0001, oldAlpha);
  rgba.rgb *= newAlpha;
  rgba.a = newAlpha;
  return rgba;
}
`;

  export const computeLinearDepth = `
float computeLinearDepth(float eyeSpaceZ) {
  float eyeZ = -eyeSpaceZ;
  float near = u_frustum.x, far = u_frustum.y;
  float depthRange = far - near;
  float linearDepth = (eyeZ - near) / depthRange;
  return 1.0 - linearDepth;
}
`;
}
