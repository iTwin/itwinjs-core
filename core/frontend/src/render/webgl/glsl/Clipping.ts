/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ProgramBuilder, VariableType, VertexShaderComponent, FragmentShaderComponent } from "../ShaderBuilder";
import { addModelViewMatrix } from "./Vertex";
import { addWindowToTexCoords } from "./Fragment";
import { TextureUnit } from "../RenderFlags";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { System } from "../System";

const getClipPlaneFloat = `
  vec4 getClipPlane(int index) {
    float x = 0.5;
    float y = (float(index) + 0.5) / float(u_numClips);
    return TEXTURE(s_clipSampler, vec2(x, y));
  }
`;

const unpackClipPlane = `
  vec4 getClipPlane(int index) {
    // ###TODO: oct-encode the normal to reduce # of samples from 4 to 2
    float y = (float(index) + 0.5) / float(u_numClips);
    float sx = 0.25;
    vec2 tc = vec2(0.125, y);
    float nx = unpackFloat(TEXTURE(s_clipSampler, tc));
    tc.x += sx;
    float ny = unpackFloat(TEXTURE(s_clipSampler, tc));
    tc.x += sx;
    float nz = unpackFloat(TEXTURE(s_clipSampler, tc));
    tc.x += sx;
    float dist = unpackFloat(TEXTURE(s_clipSampler, tc));
    return vec4(nx, ny, nz, dist);
  }
`;

const calcClipPlaneDist = `
  float calcClipPlaneDist(vec4 camPos, vec4 plane, mat4 viewMatrix) {
    // Transform direction of clip plane
    vec3 norm = plane.xyz;
    vec3 viewX = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 viewY = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 viewZ = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);

    vec3 dir = vec3(dot(norm, viewX), dot(norm, viewY), dot(norm, viewZ));
    dir = normalize(dir);

    // Transform distance of clip plane
    vec3 pos = norm * plane.w;
    vec3 v0 = vec3(dot(pos, viewX) + viewMatrix[3][0],
        dot(pos, viewY) + viewMatrix[3][1],
        dot(pos, viewZ) + viewMatrix[3][2]);

    vec4 viewPlane = vec4(dir, -dot(v0, dir));
    return dot(camPos, viewPlane);
  }
`;

const calcClipCamPos = `v_clipCamPos = u_mv * rawPos;`;

const applyClipPlanes = `
  int numPlaneSets = 1;
  int numSetsClippedBy = 0;
  bool clippedByCurrentPlaneSet = false;
  for (int i = 0; i < MAX_CLIPPING_PLANES; i++)
      {
      if (i >= u_numClips)
          break;

      vec4 plane = getClipPlane(i);
      if (plane.xyz == vec3(0.0)) // indicates start of new clip plane set
          {
          numPlaneSets = numPlaneSets + 1;
          if (clippedByCurrentPlaneSet)
              numSetsClippedBy = numSetsClippedBy + 1;

          clippedByCurrentPlaneSet = false;
          }
      else if (!clippedByCurrentPlaneSet && calcClipPlaneDist(v_clipCamPos, plane, u_viewMatrix) < 0.0)
          clippedByCurrentPlaneSet = true;
      }

  if (clippedByCurrentPlaneSet)
      numSetsClippedBy = numSetsClippedBy + 1;

  if (numSetsClippedBy == numPlaneSets)
      discard;
`;

const applyClipMask = `
  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec4 texel = TEXTURE(s_clipMask, tc);
  if (texel.r < 0.5)
    discard;
`;

export function addClippingPlanes(prog: ProgramBuilder, maxClipPlanes: number) {
  assert(maxClipPlanes > 0);
  const frag = prog.frag;
  const vert = prog.vert;

  prog.addVarying("v_clipCamPos", VariableType.Vec4);
  prog.addUniform("u_numClips", VariableType.Int, (program) => {
    program.addGraphicUniform("u_numClips", (uniform, params) => {
      const numClips = params.target.hasClipVolume ? params.target.clips.length : 0;
      assert(numClips > 0);
      uniform.setUniform1i(numClips);
    });
  });

  addModelViewMatrix(vert);
  vert.set(VertexShaderComponent.CalcClipDist, calcClipCamPos);
  if (System.instance.capabilities.supportsTextureFloat) {
    frag.addFunction(getClipPlaneFloat);
  } else {
    frag.addFunction(unpackFloat);
    frag.addFunction(unpackClipPlane);
  }

  frag.addFunction(calcClipPlaneDist);
  frag.maxClippingPlanes = maxClipPlanes;
  frag.addUniform("s_clipSampler", VariableType.Sampler2D, (program) => {
    program.addGraphicUniform("s_clipSampler", (uniform, params) => {
      const texture = params.target.clips.clips.
    });
  });
}

export function addClippingMask() {

}

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
