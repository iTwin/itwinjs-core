/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { AttributeMap } from "../AttributeMap";
import { ProgramBuilder, ShaderBuilderFlags, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { IsAnimated, IsInstanced, IsThematic } from "../TechniqueFlags";
import { TechniqueId } from "../TechniqueId";
import { addAnimation } from "./Animation";
import { addColor } from "./Color";
import { addShaderFlags } from "./Common";
import { addWhiteOnWhiteReversal } from "./Fragment";
import { addAdjustWidth, addLineCode } from "./Polyline";
import { octDecodeNormal } from "./Surface";
import { addLineWeight, addModelViewMatrix, addNormalMatrix, addProjectionMatrix } from "./Vertex";
import { addModelToWindowCoordinates, addViewport } from "./Viewport";

const decodeEndPointAndQuadIndices = `
  g_otherIndex = decodeUInt24(a_endPointAndQuadIndices.xyz);
  vec2 tc = computeLUTCoords(g_otherIndex, u_vertParams.xy, g_vert_center, u_vertParams.z);
  vec4 enc1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  vec4 enc2 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  vec3 qpos = vec3(decodeUInt16(enc1.xy), decodeUInt16(enc1.zw), decodeUInt16(enc2.xy));
  g_otherPos = unquantizePosition(qpos, u_qOrigin, u_qScale);
  g_quadIndex = a_endPointAndQuadIndices.w;
`;
const animateEndPoint = `g_otherPos.xyz += computeAnimationDisplacement(g_otherIndex, u_animDispParams.x, u_animDispParams.y, u_animDispParams.z, u_qAnimDispOrigin, u_qAnimDispScale);`;

const checkForSilhouetteDiscard = `
  vec3 n0 = MAT_NORM * octDecodeNormal(a_normals.xy);
  vec3 n1 = MAT_NORM * octDecodeNormal(a_normals.zw);

  if (0.0 == MAT_MVP[0].w) {
    return n0.z * n1.z > 0.0;           // orthographic.
  } else {
    vec4  viewPos = MAT_MV * rawPos;     // perspective
    vec3  toEye = normalize(viewPos.xyz);
    float dot0 = dot(n0, toEye);
    float dot1 = dot(n1, toEye);

    if (dot0 * dot1 > 0.0)
      return true;

    // Need to discard if either is non-silhouette.
    vec4 otherPosition = g_otherPos;
    viewPos = MAT_MV * otherPosition;
    toEye = normalize(viewPos.xyz);
    dot0 = dot(n0, toEye);
    dot1 = dot(n1, toEye);

    return dot0 * dot1 > 0.0;
  }
`;

const computePosition = `
  v_lnInfo = vec4(0.0, 0.0, 0.0, 0.0);  // init and set flag to false
  vec4  other = g_otherPos;
  float miterAdjust = 0.0;
  float weight = computeLineWeight();
  float clipDist;

  g_windowPos = modelToWindowCoordinates(rawPos, other, clipDist);
  if (g_windowPos.w == 0.0) // Clipped out.
    return g_windowPos;

  vec4 clipPos = rawPos + clipDist * (other - rawPos);
  vec4 pos = MAT_MVP * clipPos;

  vec4 projOther = modelToWindowCoordinates(other, rawPos, clipDist);

  g_windowDir = projOther.xy - g_windowPos.xy;

  adjustWidth(weight, g_windowDir, g_windowPos.xy);
  g_windowDir = normalize(g_windowDir);

  vec2  perp = vec2(-g_windowDir.y, g_windowDir.x);
  float perpDist = weight / 2.0;
  float alongDist = 0.0;

  perpDist *= sign(0.5 - float(g_quadIndex == 0.0 || g_quadIndex == 3.0)); // negate for index 0 and 3
  alongDist += distance(rawPos, other) * float(g_quadIndex >= 2.0); // index 2 and 3 correspond to 'far' endpoint of segment

  pos.x += perp.x * perpDist * 2.0 * pos.w / u_viewport.x;
  pos.y += perp.y * perpDist * 2.0 * pos.w / u_viewport.y;

  lineCodeEyePos = .5 * (rawPos + other);
  lineCodeDist = alongDist;

  return pos;
`;
const lineCodeArgs = "g_windowDir, g_windowPos, 0.0";

function createBase(isSilhouette: boolean, instanced: IsInstanced, isAnimated: IsAnimated): ProgramBuilder {
  const isInstanced = IsInstanced.Yes === instanced;
  const attrMap = AttributeMap.findAttributeMap(isSilhouette ? TechniqueId.SilhouetteEdge : TechniqueId.Edge, isInstanced);

  const builder = new ProgramBuilder(attrMap, isInstanced ? ShaderBuilderFlags.InstancedVertexTable : ShaderBuilderFlags.VertexTable);
  const vert = builder.vert;

  vert.addGlobal("g_otherPos", VariableType.Vec4);
  vert.addGlobal("g_quadIndex", VariableType.Float);
  vert.addGlobal("g_windowPos", VariableType.Vec4);
  vert.addGlobal("g_windowDir", VariableType.Vec2);
  vert.addGlobal("g_otherIndex", VariableType.Float);

  vert.addInitializer(decodeEndPointAndQuadIndices);
  if (isAnimated) {
    addAnimation(vert, false, IsThematic.No);
    vert.addInitializer(animateEndPoint);
  }

  vert.addGlobal("lineCodeEyePos", VariableType.Vec4);
  vert.addGlobal("lineCodeDist", VariableType.Float, "0.0");

  addModelToWindowCoordinates(vert); // adds u_mvp, u_viewportTransformation
  addProjectionMatrix(vert);
  addLineCode(builder, lineCodeArgs);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  builder.addVarying("v_lnInfo", VariableType.Vec4);
  addAdjustWidth(vert);

  addViewport(vert);
  addModelViewMatrix(vert);

  addLineWeight(vert);

  if (isSilhouette) {
    addNormalMatrix(vert);
    vert.set(VertexShaderComponent.CheckForEarlyDiscard, checkForSilhouetteDiscard);
    vert.addFunction(octDecodeNormal);
  }

  return builder;
}

/** @internal */
export function createEdgeBuilder(isSilhouette: boolean, instanced: IsInstanced, isAnimated: IsAnimated): ProgramBuilder {
  const builder = createBase(isSilhouette, instanced, isAnimated);
  addShaderFlags(builder);
  addColor(builder);
  addWhiteOnWhiteReversal(builder.frag);
  return builder;
}
