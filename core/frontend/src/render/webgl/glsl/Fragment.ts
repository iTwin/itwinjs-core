/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { FragmentShaderBuilder, VariableType } from "../ShaderBuilder";

export function addWindowToTexCoords(frag: FragmentShaderBuilder) {
  const windowCoordsToTexCoords = `vec2 windowCoordsToTexCoords(vec2 wc) { return wc * u_invScreenSize; }`;
  frag.addFunction(windowCoordsToTexCoords);
  frag.addUniform("u_invScreenSize", VariableType.Vec2, (prog) => {
    prog.addProgramUniform("u_invScreenSize", (uniform, params) => {
      const rect = params.target.viewRect;
      const invScreenSize = [ 1.0 / rect.width, 1.0 / rect.height ];
      uniform.setUniform2fv(invScreenSize);
    });
  });
}

export namespace GLSLFragment {
  export const assignFragColor = `FragColor = baseColor;`;

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
      rgba.a = new Alpha;
      return rgba;
    }`;
}
