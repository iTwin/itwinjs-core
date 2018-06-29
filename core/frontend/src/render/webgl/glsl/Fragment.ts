/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FragmentShaderBuilder, VariableType, FragmentShaderComponent } from "../ShaderBuilder";
import { ColorDef } from "@bentley/imodeljs-common";
/* ###TODO: IBL
import { Matrix3 } from "../Matrix";
*/

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

export function addWhiteOnWhiteReversal(frag: FragmentShaderBuilder) {
  frag.addUniform("u_reverseWhiteOnWhite", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_reverseWhiteOnWhite", (uniform, params) => {
      const bgColor: ColorDef = params.target.bgColor.clone();
      bgColor.setAlpha(255);
      const doReversal = (bgColor.equals(ColorDef.white) && params.geometry.wantWoWReversal(params)) ? 1.0 : 0.0;
      uniform.setUniform1f(doReversal);
    });
  });
  frag.set(FragmentShaderComponent.ReverseWhiteOnWhite, reverseWhiteOnWhite);
}

/* ###TODO: IBL
export function addNormalMatrixF(frag: FragmentShaderBuilder) {
  frag.addUniform("u_nmx", VariableType.Mat3, (prog) => {
    prog.addGraphicUniform("u_nmx", (uniform, params) => {
      const rotMat: Matrix3 | undefined = params.modelViewMatrix.getRotation();
      if (undefined !== rotMat)
        uniform.setMatrix3(rotMat);
    });
  });
}
*/

const reverseWhiteOnWhite = `
  if (u_reverseWhiteOnWhite > 0.5) {
    // Account for erroneous interpolation from varying vec3(1.0)...
    const vec3 white = vec3(1.0);
    const vec3 epsilon = vec3(0.0001);
    vec3 color = baseColor.a > 0.0 ? baseColor.rgb / baseColor.a : baseColor.rgb; // revert premultiplied alpha
    vec3 delta = (color + epsilon) - white;
    if (delta.x > 0.0 && delta.y > 0.0 && delta.z > 0.0)
      baseColor.rgb = vec3(0.0);
  }
  return baseColor;
`;

export namespace GLSLFragment {
  export const assignFragColor = "FragColor = baseColor;";

  export const assignFragColorNoAlpha = "FragColor = vec4(baseColor.rgb, 1.0);";

  export const assignFragData = `
  FragColor0 = baseColor;
  FragColor1 = v_element_id0;
  FragColor2 = v_element_id1;

  float linearDepth = computeLinearDepth(v_eyeSpace.z);
  FragColor3 = vec4(u_renderOrder * 0.0625, encodeDepthRgb(linearDepth)); // near=1, far=0
`;

  export const revertPreMultipliedAlpha = `
vec4 revertPreMultipliedAlpha(vec4 rgba) {
  if (0.0 < rgba.a)
    rgba.rgb /= rgba.a;
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
  if (0.0 < oldAlpha)
    rgba.rgb /= oldAlpha;

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
