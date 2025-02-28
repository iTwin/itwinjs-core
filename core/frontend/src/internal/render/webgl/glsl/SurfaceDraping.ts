/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */
import { FragmentShaderBuilder, FragmentShaderComponent } from "../ShaderBuilder";

const testInside = `
bool testInside(float x0, float y0, float x1, float y1, float x, float y) {
  vec2 perp = vec2(y0 - y1, x1 - x0), test = vec2(x - x0, y - y0);
  float dot = (test.x * perp.x + test.y * perp.y) / sqrt(perp.x * perp.x + perp.y * perp.y);
  return dot >= -0.001;
}
`;

const applyTexture = `
bool applyTexture(inout vec4 col, sampler2D sampler, mat4 params, mat4 matrix) {
  vec2 uv;
  float layerAlpha;
  bool isProjected = params[0][0] != 0.0;
  float imageCount = params[0][1];
  vec2 classPos;

  if (isProjected) {
    vec4 eye4 = vec4(v_eyeSpace, 1.0);
    vec4 classPos4 = matrix * eye4;
    classPos = classPos4.xy / classPos4.w;

    // if (!testInside(params[2].x, params[2].y, params[2].z, params[2].w, classPos.x, classPos.y) ||
    //     !testInside(params[2].z, params[2].w, params[3].x, params[3].y, classPos.x, classPos.y) ||
    //     !testInside(params[3].x, params[3].y, params[3].z, params[3].w, classPos.x, classPos.y) ||
    //     !testInside(params[3].z, params[3].w, params[2].x, params[2].y, classPos.x, classPos.y))
    //     return false;

    uv.x = classPos.x;
    uv.y = classPos.y / imageCount;
    layerAlpha = params[0][2];

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)
      return false;

  } else {
    vec4 texTransform = matrix[0].xyzw;
    vec4 texClip = matrix[1].xyzw;
    layerAlpha = matrix[2].x;
    uv = vec2(texTransform[0] + texTransform[2] * v_texCoord.x, texTransform[1] + texTransform[3] * v_texCoord.y);

    if (uv.x < texClip[0] || uv.x > texClip[2] || uv.y < texClip[1] || uv.y > texClip[3])
      return false;

    uv.y = 1.0 - uv.y;
  }

  vec4 texCol = TEXTURE(sampler, uv);
  float alpha = layerAlpha * texCol.a;

  if (alpha > 0.05) {
    vec3 texRgb = isProjected ? (texCol.rgb / texCol.a) : texCol.rgb; // If projected, undo premultiplication
    // Texture color is premultiplied earlier by alpha only if projected (from classification).

    col.rgb = (1.0 - alpha) * col.rgb + alpha * texRgb;

    if (isProjected) {
      vec4 featureTexel = TEXTURE(sampler, vec2(uv.x, (1.0 + classPos.y) / imageCount));
      // classifierId = addUInt32s(params[1], featureTexel * 255.0) / 255.0;
    } else {
      // featureIncrement = matrix[2].y;
      // classifierId = vec4(0);
    }

    if (alpha > col.a)
      col.a = alpha;

    return true;
  }

  // If texture color is transparent but base color is not, return true (don't discard)
  // Else return false (discard) if both the texture and base color are transparent
  return (col.a > 0.05);
}
`;

function applyDraping(){
  const applyTextureStrings = [];

  const textureCount = 4;

  for (let i = 0; i < textureCount; i++)
    applyTextureStrings.push(`if (applyTexture(col, s_texture${i}, u_texParams${i}, u_texMatrix${i})) doDiscard = false; `);

  return `
  if (!u_texturesPresent) {
    vec4 col = baseColor;
    return col;
  }

  bool doDiscard = baseColor.a < 0.05;
  vec4 col = baseColor;
  ${applyTextureStrings.join("\n  ")}
  if (doDiscard)
    discard;

  return col;
  `;
}

/**
 * @internal
 */
export function addApplySurfaceDraping(frag: FragmentShaderBuilder) {
  frag.addFunction(testInside);
  frag.addFunction(applyTexture);
  frag.set(FragmentShaderComponent.ApplyDraping, applyDraping());
}