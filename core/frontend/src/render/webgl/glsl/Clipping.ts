/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ProgramBuilder, VariableType, VertexShaderComponent, FragmentShaderComponent } from "../ShaderBuilder";
import { addModelViewMatrix } from "./Vertex";
import { addWindowToTexCoords } from "./Fragment";
import { TextureUnit } from "../RenderFlags";

const calcClipDist = `
  if (u_numClips > 0) {
    vec4 camPos = u_mv * rawPos;
    v_clipDist[0] = dot(camPos, u_clipPlane[0]);
    v_clipDist[1] = (u_numClips > 1) ? dot(camPos, u_clipPlane[1]) : 0.0;
    v_clipDist[2] = (u_numClips > 2) ? dot(camPos, u_clipPlane[2]) : 0.0;
    v_clipDist[3] = (u_numClips > 3) ? dot(camPos, u_clipPlane[3]) : 0.0;
    v_clipDist[4] = (u_numClips > 4) ? dot(camPos, u_clipPlane[4]) : 0.0;
    v_clipDist[5] = (u_numClips > 5) ? dot(camPos, u_clipPlane[5]) : 0.0;
  }
`;

const applyClipping = `
  if (u_numClips > 0) {
    for (int i = 0; i < 6; i++) {
      if (v_clipDist[i] < 0.0)
        discard;
    }
  }

  if (u_clipMask > 0) {
    vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
    vec4 texel = TEXTURE(s_clipMask, tc);
    if (texel.r < 0.5)
      discard;
  }
`;

export function addClipping(builder: ProgramBuilder): void {
  const frag = builder.frag;
  const vert = builder.vert;

  builder.addVarying("v_clipDist[6]", VariableType.Float);
  builder.addUniform("u_numClips", VariableType.Int, (prog) => {
    prog.addGraphicUniform("u_numClips", (uniform, params) => {
      const numClips = params.target.hasClipVolume ? params.target.clips.length : 0;
      uniform.setUniform1i(numClips);
    });
  });

  addModelViewMatrix(vert);
  vert.set(VertexShaderComponent.CalcClipDist, calcClipDist);
  vert.addUniform("u_clipPlane[6]", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_clipPlane[0]", (uniform, params) => {
      if (params.target.hasClipVolume)
        uniform.setUniform4fv(params.target.clips.clips); // ###TODO confirm this is equivalent to glUniform4fv(6, ...)
    });
  });

  frag.addUniform("u_clipMask", VariableType.Int, (prog) => {
    prog.addGraphicUniform("u_clipMask", (uniform, params) => {
      uniform.setUniform1i(params.target.hasClipMask ? 1 : 0);
    });
  });
  frag.addUniform("s_clipMask", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_clipMask", (uniform, params) => {
      const mask = params.target.clipMask;
      if (undefined !== mask)
        mask.bindSampler(uniform, TextureUnit.ClipMask);
    });
  });

  addWindowToTexCoords(frag);
  frag.set(FragmentShaderComponent.ApplyClipping, applyClipping);
}
