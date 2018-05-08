/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { FragmentShaderBuilder, VariableType } from "../ShaderBuilder";
import { ColorDef } from "@bentley/imodeljs-common";

export function addWindowToTexCoords(frag: FragmentShaderBuilder) {
  const windowCoordsToTexCoords = `vec2 windowCoordsToTexCoords(vec2 wc) { return wc * u_invScreenSize; }`;
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
      const bgColor: ColorDef = params.target.bgColor;
      bgColor.setAlpha(0);
      const doReversal = (bgColor.equals(ColorDef.white) && params.geometry.wantWoWReversal(params)) ? 1.0 : 0.0;
      uniform.setUniform1f(doReversal);
    });
  });
}

export namespace GLSLFragment {
  export const assignFragColor = `FragColor = baseColor;`;

  export const assignFragData = `
    FragColor0 = baseColor;
    FragColor1 = v_element_id0;
    FragColor2 = v_element_id1;

    float linearDepth = computeLinearDepth(v_eyeSpace.z);
    FragColor3 = vec4(u_renderOrder * 0.0625, encodeDepthRgb(linearDepth)); // near=1, far=0`;

  export const revertPreMultipliedAlpha = `
    vec4 revertPreMultipliedAlpha(vec4 rgba) {
      if (0.0 < rgba.a)
        rgba.a /= rgba.a;

      return rgba;
    }`;

  export const applyPreMultipliedAlpha = `
    vec4 applyPreMultipliedAlpha(vec4 rgba) {
      rgba.rgb *= rgba.a;
      return rgba;
    }`;

  export const adjustPreMultipliedAlpha = `
    vec4 adjustPreMultipliedAlpha(vec4 rgba, float newAlpha) {
      float oldAlpha = rgba.a;
      if (0.0 < oldAlpha)
        rgba.rgb /= oldAlpha;

      rgba.rgb *= newAlpha;
      rgba.a = newAlpha;
      return rgba;
    }`;

  export const computeLinearDepth = `
    float computeLinearDepth(float eyeSpaceZ) {
      float eyeZ = -eyeSpaceZ;
      float near = u_frustum.x, far = u_frustum.y;
      float depthRange = far - near;
      float linearDepth = (eyeZ - near) / depthRange;
      return 1.0 - linearDepth;
    }`;
}
