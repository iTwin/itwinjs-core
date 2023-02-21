/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { FragmentShaderBuilder, FragmentShaderComponent, SourceBuilder, VariableType } from "../ShaderBuilder";
import { encodeDepthRgb } from "./Decode";
import { addRenderPass } from "./RenderPass";

/** @internal */
export function addWindowToTexCoords(frag: FragmentShaderBuilder) {
  const windowCoordsToTexCoords = `\nvec2 windowCoordsToTexCoords(vec2 wc) { return wc * u_invScreenSize; }\n`;
  frag.addFunction(windowCoordsToTexCoords);
  frag.addUniform("u_invScreenSize", VariableType.Vec2, (prog) => {
    prog.addProgramUniform("u_invScreenSize", (uniform, params) => {
      params.target.uniforms.viewRect.bindInverseDimensions(uniform);
    });
  });
}

/** @internal */
export function addWhiteOnWhiteReversal(frag: FragmentShaderBuilder) {
  frag.addUniform("u_reverseWhiteOnWhite", VariableType.Boolean, (prog) => {
    prog.addGraphicUniform("u_reverseWhiteOnWhite", (uniform, params) => {
      const wantWoW = params.target.uniforms.style.wantWoWReversal;
      const doReversal = (wantWoW && params.geometry.wantWoWReversal(params.programParams)) ? 1 : 0;
      uniform.setUniform1i(doReversal);
    });
  });
  frag.set(FragmentShaderComponent.ReverseWhiteOnWhite, reverseWhiteOnWhite);
}

const reverseWhiteOnWhite = `
  const vec3 white = vec3(1.0);
  const vec3 epsilon = vec3(0.0001);
  vec3 color = baseColor.rgb;
  vec3 delta = (color + epsilon) - white;
  vec4 wowColor = vec4(baseColor.rgb * vec3(float(delta.x <= 0.0 || delta.y <= 0.0 || delta.z <= 0.0)), baseColor.a); // set to black if almost white
  return u_reverseWhiteOnWhite ? wowColor : baseColor;
`;

const multiplyAlpha = `
  if (u_renderPass >= kRenderPass_OpaqueLinear && u_renderPass <= kRenderPass_OpaqueGeneral)
    baseColor.a = 1.0;
  else
    baseColor = vec4(baseColor.rgb * baseColor.a, baseColor.a);
`;

const computePickBufferOutputs = `${multiplyAlpha}
  vec4 output0 = baseColor;

  // Fix interpolation errors despite all vertices sending exact same feature_id...
  ivec4 feature_id_i = ivec4(feature_id * 255.0 + 0.5);
  vec4 output1 = vec4(feature_id_i) / 255.0;
  float linearDepth = computeLinearDepth(v_eyeSpace.z);
  vec4 output2 = vec4(renderOrder * 0.0625, encodeDepthRgb(linearDepth)); // near=1, far=0
`;

const computeAltPickBufferOutputs = `${multiplyAlpha}
  vec4 output0 = baseColor;
  vec4 output1 = vec4(0.0);
  vec4 output2 = vec4(0.0);
`;

const assignPickBufferOutputsMRT = `
  FragColor0 = output0;
  FragColor1 = output1;
  FragColor2 = output2;
`;

const reassignFeatureId = "  output1 = overrideFeatureId(output1);";

/** @internal */
export function addPickBufferOutputs(frag: FragmentShaderBuilder): void {
  frag.addFunction(encodeDepthRgb);
  frag.addFunction(computeLinearDepth);

  const prelude = new SourceBuilder();
  const overrideOrder = frag.get(FragmentShaderComponent.OverrideRenderOrder);
  if (overrideOrder) {
    frag.addFunction("float overrideRenderOrder(float currentOrder)", overrideOrder);
    prelude.addline("  float renderOrder = overrideRenderOrder(u_renderOrder);");
  } else {
    prelude.addline("  float renderOrder = u_renderOrder;");
  }

  prelude.add(computePickBufferOutputs);

  const overrideColor = frag.get(FragmentShaderComponent.OverrideColor);
  if (undefined !== overrideColor) {
    frag.addFunction("vec4 overrideColor(vec4 currentColor)", overrideColor);
    prelude.addline("  output0 = overrideColor(output0);");
  }

  const overrideFeatureId = frag.get(FragmentShaderComponent.OverrideFeatureId);
  if (undefined !== overrideFeatureId) {
    frag.addFunction("vec4 overrideFeatureId(vec4 currentId)", overrideFeatureId);
    prelude.addline(reassignFeatureId);
  }

  addRenderPass(frag);
  frag.addDrawBuffersExtension(3);
  frag.set(FragmentShaderComponent.AssignFragData, prelude.source + assignPickBufferOutputsMRT);
}

/** @internal */
export function addAltPickBufferOutputs(frag: FragmentShaderBuilder): void {
  const prelude = new SourceBuilder();
  prelude.add(computeAltPickBufferOutputs);

  const overrideColor = frag.get(FragmentShaderComponent.OverrideColor);
  if (undefined !== overrideColor) {
    frag.addFunction("vec4 overrideColor(vec4 currentColor)", overrideColor);
    prelude.addline("  output0 = overrideColor(output0);");
  }

  addRenderPass(frag);
  frag.addDrawBuffersExtension(3);
  frag.set(FragmentShaderComponent.AssignFragData, prelude.source + assignPickBufferOutputsMRT);
}

/** @internal */
export function addFragColorWithPreMultipliedAlpha(frag: FragmentShaderBuilder): void {
  addRenderPass(frag);
  const overrideColor = frag.get(FragmentShaderComponent.OverrideColor);
  if (undefined === overrideColor) {
    frag.set(FragmentShaderComponent.AssignFragData, assignFragColorWithPreMultipliedAlpha);
  } else {
    frag.addFunction("vec4 overrideColor(vec4 currentColor)", overrideColor);
    frag.set(FragmentShaderComponent.AssignFragData, overrideAndAssignFragColorWithPreMultipliedAlpha);
  }
}

/** @internal */
export const assignFragColor = "FragColor = baseColor;";

const assignFragColorWithPreMultipliedAlpha = `${multiplyAlpha}
  FragColor = baseColor;
`;

const overrideAndAssignFragColorWithPreMultipliedAlpha = `${multiplyAlpha}
  vec4 fragColor = overrideColor(baseColor);
  FragColor = fragColor;
`;

/** @internal */
export const computeLinearDepth = `
float computeLinearDepth(float eyeSpaceZ) {
  float eyeZ = -eyeSpaceZ;
  float near = u_frustum.x, far = u_frustum.y;
  float depthRange = far - near;
  float linearDepth = (eyeZ - near) / depthRange;
  return 1.0 - linearDepth;
}
`;
