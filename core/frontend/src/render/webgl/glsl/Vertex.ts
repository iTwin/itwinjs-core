/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { VertexShaderBuilder, VariableType } from "../ShaderBuilder";
import { Matrix3, Matrix4 } from "../Matrix";
import { LUTGeometry } from "../CachedGeometry";
import { TextureUnit, RenderPass } from "../RenderFlags";
import { GLSLDecode } from "./Decode";
import { addLookupTable } from "./LookupTable";
import { StopWatch } from "@bentley/bentleyjs-core";   // Temporary for animation testing.

const initializeVertLUTCoords = `
  g_vertexLUTIndex = decodeUInt32(a_pos);
  g_vertexBaseCoords = compute_vert_coords(g_vertexLUTIndex);
`;

const unquantizePosition = `
vec4 unquantizePosition(vec3 pos, vec3 origin, vec3 scale) { return vec4(origin + scale * pos, 1.0); }
`;

const unquantizeVertexPosition = `
vec4 unquantizeVertexPosition(vec3 pos, vec3 origin, vec3 scale) { return unquantizePosition(pos, origin, scale); }
`;

const unquantizeVertexPositionFromLUT = `
vec4 unquantizeVertexPosition(vec3 encodedIndex, vec3 origin, vec3 scale) {
  // Need to read 2 rgba values to obtain 6 16-bit integers for position
  vec2 tc = g_vertexBaseCoords;
  vec4 enc1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  vec4 enc2 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  g_featureIndexCoords = tc;

  vec3 qpos = vec3(decodeUInt16(enc1.xy), decodeUInt16(enc1.zw), decodeUInt16(enc2.xy));

  // Might as well decode the color index since we already read it...may not end up being used.
  // (NOTE = If this is a textured mesh, the normal is stored where the color index would otherwise be...)
  g_vertexData2 = enc2.zw;

  return unquantizePosition(qpos, origin, scale);
}
`;

const computeAnimationFrameDisplacement = `
vec4 computeAnimationFrameDisplacement(float frameIndex, vec3 origin, vec3 scale) {
  vec2 tc = computeLUTCoords(frameIndex + g_vertexLUTIndex * 2.0, u_vertParams.xy, g_vert_center, 1.0);
  vec4 enc1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  vec4 enc2 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  vec3 qpos = vec3(decodeUInt16(enc1.xy), decodeUInt16(enc1.zw), decodeUInt16(enc2.xy));
  return unquantizePosition(qpos, origin, scale);
}`;

const computeAnimationDisplacement = `
vec4 computeAnimationDisplacement(float frameIndex0, float fraction, vec3 origin, vec3 scale) {
vec4 displacement = computeAnimationFrameDisplacement(frameIndex0, origin, scale);
if (fraction > 0.0) {
  vec4 displacement1 = computeAnimationFrameDisplacement(frameIndex0 + u_vertParams.w * 2.0, origin, scale);
  displacement += fraction * (displacement1 - displacement);
  }
return displacement;
}`;

const computeAnimationFrameParam = `
float computeAnimationFrameParam(float frameIndex, float origin, float scale) {
  vec2 tc = computeLUTCoords(frameIndex + g_vertexLUTIndex, u_vertParams.xy, g_vert_center, 1.0);
  vec4 enc1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  return origin + scale * decodeUInt16(enc1.xy);
}`;

const computeAnimationParam = `
vec2 computeAnimationParam(float frameIndex0, float fraction, float origin, float scale) {
float param = computeAnimationFrameParam(frameIndex0, origin, scale);
if (fraction > 0.0) {
  float param1 = computeAnimationFrameParam(frameIndex0 + u_vertParams.w, origin, scale);
  param += fraction * (param1 - param);
  }
return vec2(.5, param);
}`;

const scratchMVPMatrix = new Matrix4();

export function addModelViewProjectionMatrix(vert: VertexShaderBuilder): void {
  vert.addUniform("u_mvp", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_mvp", (uniform, params) => {
      const mvp = params.projectionMatrix.clone(scratchMVPMatrix);
      mvp.multiplyBy(params.modelViewMatrix);
      uniform.setMatrix4(mvp);
    });
  });
}

export function addProjectionMatrix(vert: VertexShaderBuilder): void {
  vert.addUniform("u_proj", VariableType.Mat4, (prog) => {
    prog.addProgramUniform("u_proj", (uniform, params) => {
      uniform.setMatrix4(params.projectionMatrix);
    });
  });
}

export function addModelViewMatrix(vert: VertexShaderBuilder): void {
  vert.addUniform("u_mv", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_mv", (uniform, params) => {
      uniform.setMatrix4(params.modelViewMatrix);
    });
  });
}

export function addNormalMatrix(vert: VertexShaderBuilder) {
  vert.addUniform("u_nmx", VariableType.Mat3, (prog) => {
    prog.addGraphicUniform("u_nmx", (uniform, params) => {
      const rotMat: Matrix3 | undefined = params.modelViewMatrix.getRotation();
      if (undefined !== rotMat)
        uniform.setMatrix3(rotMat);
    });
  });
}
const scratchAnimDisplacementParams = new Float32Array(2);   // index, fraction.
const scratchAnimScalarParams = new Float32Array(4);         // index, fraction, origin, scale.
let testStopWatch: StopWatch;
const testAnimationDuration = 10.0;
class AnimationLocation { public index: number = 0.0; public fraction: number = 0.0; }

function computeInputLocation(inputs: number[], fraction: number): AnimationLocation {
  const inputValue = fraction * inputs[inputs.length - 1];
  const location = new AnimationLocation();
  for (let i = 0; i < inputs.length - 1; i++) {
    if (inputValue >= inputs[i] && inputValue < inputs[i + 1]) {
      location.index = i;
      location.fraction = inputValue - inputs[i] / (inputs[i + 1] - inputs[i]);
    }
  }
  return location;
}
export function addAnimation(vert: VertexShaderBuilder, includeTexture: boolean): void {
  if (undefined === testStopWatch)
    testStopWatch = new StopWatch("Animation", true);

  scratchAnimDisplacementParams[0] = scratchAnimDisplacementParams[1] = 0.0;

  vert.addFunction(computeAnimationFrameDisplacement);
  vert.addFunction(computeAnimationDisplacement);
  vert.addFunction(computeAnimationFrameParam);
  vert.addFunction(computeAnimationParam);

  vert.addUniform("u_animDispParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_animDispParams", (uniform, params) => {
      // TBD... from fraction within animation compute frame and frameFraction;
      const animationFraction = (testStopWatch.currentSeconds % testAnimationDuration) / testAnimationDuration;
      const lutGeom: LUTGeometry = params.geometry as LUTGeometry;
      if (lutGeom.lut.auxDisplacements !== undefined) {
        const auxDisplacement = lutGeom.lut.auxDisplacements[0];  // TBD - allow channel selection.
        const displacementLocation = computeInputLocation(auxDisplacement.inputs, animationFraction);

        scratchAnimDisplacementParams[0] = auxDisplacement.index + displacementLocation.index * lutGeom.lut.numVertices * 2.0;
        scratchAnimDisplacementParams[1] = displacementLocation.fraction;
      }
      uniform.setUniform2fv(scratchAnimDisplacementParams);
    });
  });
  vert.addUniform("u_qAnimDispScale", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_qAnimDispScale", (uniform, params) => {
      const lutGeom: LUTGeometry = params.geometry as LUTGeometry;
      if (lutGeom.lut.auxDisplacements !== undefined) {
        const auxDisplacement = lutGeom.lut.auxDisplacements[0];  // TBD - allow channel selection.
        uniform.setUniform3fv(auxDisplacement.qScale);
      }
    });
  });
  vert.addUniform("u_qAnimDispOrigin", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_qAnimDispOrigin", (uniform, params) => {
      const lutGeom: LUTGeometry = params.geometry as LUTGeometry;
      if (lutGeom.lut.auxDisplacements !== undefined) {
        const auxDisplacement = lutGeom.lut.auxDisplacements[0];  // TBD - allow channel selection.
        uniform.setUniform3fv(auxDisplacement.qOrigin);
      }
    });
  });
  if (includeTexture) {
    vert.addUniform("u_qAnimScalarParams", VariableType.Vec4, (prog) => {
      prog.addGraphicUniform("u_qAnimScalarParams", (uniform, params) => {
        const lutGeom: LUTGeometry = params.geometry as LUTGeometry;
        const animationFraction = (testStopWatch.currentSeconds % testAnimationDuration) / testAnimationDuration;
        scratchAnimScalarParams[0] = scratchAnimScalarParams[1] = scratchAnimScalarParams[2] = scratchAnimScalarParams[3] = 0.0;
        if (lutGeom.lut.auxParams !== undefined) {
          const auxParam = lutGeom.lut.auxParams[0];  // TBD - allow channel selection.
          const paramLocation = computeInputLocation(auxParam.inputs, animationFraction);

          scratchAnimScalarParams[0] = auxParam.index + paramLocation.index * lutGeom.lut.numVertices;
          scratchAnimScalarParams[1] = paramLocation.fraction;
          scratchAnimScalarParams[2] = auxParam.qOrigin;
          scratchAnimScalarParams[3] = auxParam.qScale;
        }
        uniform.setUniform4fv(scratchAnimScalarParams);
      });
    });
  }
}

const scratchLutParams = new Float32Array(4);
function addPositionFromLUT(vert: VertexShaderBuilder) {
  vert.addGlobal("g_vertexLUTIndex", VariableType.Float);
  vert.addGlobal("g_vertexBaseCoords", VariableType.Vec2);
  vert.addGlobal("g_vertexData2", VariableType.Vec2);
  vert.addGlobal("g_featureIndexCoords", VariableType.Vec2);

  vert.addFunction(GLSLDecode.uint32);
  vert.addFunction(GLSLDecode.uint16);
  vert.addFunction(unquantizeVertexPositionFromLUT);

  vert.addUniform("u_vertLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_vertLUT", (uniform, params) => {
      (params.geometry as LUTGeometry).lut.texture.bindSampler(uniform, TextureUnit.VertexLUT);
    });
  });

  vert.addUniform("u_vertParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_vertParams", (uniform, params) => {
      const lutGeom: LUTGeometry = params.geometry as LUTGeometry;
      const lut = lutGeom.lut;
      const lutParams = scratchLutParams;
      lutParams[0] = lut.texture.width;
      lutParams[1] = lut.texture.height;
      lutParams[2] = lut.numRgbaPerVertex;
      lutParams[3] = lut.numVertices;
      uniform.setUniform4fv(lutParams);
    });
  });

  addLookupTable(vert, "vert", "u_vertParams.z");
  vert.addInitializer(initializeVertLUTCoords);
}

export function addPosition(vert: VertexShaderBuilder, fromLUT: boolean) {
  vert.addFunction(unquantizePosition);

  vert.addAttribute("a_pos", VariableType.Vec3, (prog) => {
    prog.addAttribute("a_pos", (attr, params) => { params.geometry.bindVertexArray(attr); });
  });
  vert.addUniform("u_qScale", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_qScale", (uniform, params) => {
      uniform.setUniform3fv(params.geometry.qScale);
    });
  });
  vert.addUniform("u_qOrigin", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_qOrigin", (uniform, params) => {
      uniform.setUniform3fv(params.geometry.qOrigin);
    });
  });

  if (!fromLUT) {
    vert.addFunction(unquantizeVertexPosition);
  } else {
    addPositionFromLUT(vert);
  }
}

export function addAlpha(vert: VertexShaderBuilder): void {
  vert.addUniform("u_hasAlpha", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_hasAlpha", (uniform, params) => {
      uniform.setUniform1f(RenderPass.Translucent === params.geometry.getRenderPass(params.target) ? 1.0 : 0.0);
    });
  });
}

export namespace GLSLVertex {
  // This vertex belongs to a triangle which should not be rendered. Produce a degenerate triangle.
  // Also place it outside NDC range (for GL_POINTS)
  const discardVertex = `
{
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  return;
}
`;

  export const earlyDiscard = `  if (checkForEarlyDiscard(rawPosition))` + discardVertex;
  export const discard = `  if (checkForDiscard())` + discardVertex;
  export const lateDiscard = `  if (checkForLateDiscard())` + discardVertex;

  export const computeLineWeight = "\nfloat ComputeLineWeight() { return u_lineWeight; }\n";
  export const computeLineCode = "\nfloat ComputeLineCode() { return u_lineCode; }\n";
}
