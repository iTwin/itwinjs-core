/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import {
  ProgramBuilder,
  VariableType,
  VertexShaderComponent,
} from "../ShaderBuilder";
import { addModelViewMatrix, addProjectionMatrix, GLSLVertex, addNormalMatrix } from "./Vertex";
import { addAnimation } from "./Animation";
import { addViewport, addModelToWindowCoordinates } from "./Viewport";
import { GL } from "../GL";
import { addColor } from "./Color";
import { addWhiteOnWhiteReversal } from "./Fragment";
import { addShaderFlags } from "./Common";
import { addLineCode, adjustWidth } from "./Polyline";
import { EdgeGeometry, SilhouetteEdgeGeometry } from "../Mesh";
import { octDecodeNormal } from "./Surface";
import { Debug } from "../Diagnostics";

const decodeEndPointAndQuadIndices = `
  g_otherIndex = decodeUInt32(a_endPointAndQuadIndices.xyz);
  vec2 tc = computeLUTCoords(g_otherIndex, u_vertParams.xy, g_vert_center, u_vertParams.z);
  vec4 enc1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  vec4 enc2 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  vec3 qpos = vec3(decodeUInt16(enc1.xy), decodeUInt16(enc1.zw), decodeUInt16(enc2.xy));
  g_otherPos = unquantizePosition(qpos, u_qOrigin, u_qScale);
  g_quadIndex = a_endPointAndQuadIndices.w;
`;
const animateEndPoint = `g_otherPos.xyz += computeAnimationDisplacement(g_otherIndex, u_animDispParams.x, u_animDispParams.y, u_animDispParams.z, u_qAnimDispOrigin, u_qAnimDispScale);
`;

const checkForSilhouetteDiscard = `
  vec3 n0 = u_nmx * octDecodeNormal(a_normals.xy);
  vec3 n1 = u_nmx * octDecodeNormal(a_normals.zw);

  if (0.0 == u_mvp[0].w) {
    return n0.z * n1.z > 0.0;           // orthographic.
  } else {
    vec4  viewPos = u_mv * rawPos;     // perspective
    vec3  toEye = normalize(viewPos.xyz);
    float dot0 = dot(n0, toEye);
    float dot1 = dot(n1, toEye);

    if (dot0 * dot1 > 0.0)
      return true;

    // Need to discard if either is non-silhouette.
    vec4 otherPosition = g_otherPos;
    viewPos = u_mv * otherPosition;
    toEye = normalize(viewPos.xyz);
    dot0 = dot(n0, toEye);
    dot1 = dot(n1, toEye);

    return dot0 * dot1 > 0.0;
  }
`;

const computePosition = `
  v_lnInfo = vec4(0.0, 0.0, 0.0, 0.0);  // init and set flag to false
  vec4  pos = u_mvp * rawPos;
  vec4  other = g_otherPos;
  vec3  modelDir = other.xyz - pos.xyz;
  float miterAdjust = 0.0;
  float weight = ComputeLineWeight();

  g_windowPos = modelToWindowCoordinates(rawPos, other);

  if (g_windowPos.w == 0.0) // Clipped out.
    return g_windowPos;

  vec4 projOther = modelToWindowCoordinates(other, rawPos);

  g_windowDir = projOther.xy - g_windowPos.xy;

  adjustWidth(weight, g_windowDir, g_windowPos.xy);
  g_windowDir = normalize(g_windowDir);

  vec2  perp = vec2(-g_windowDir.y, g_windowDir.x);
  float perpDist = weight / 2.0;
  float alongDist = 0.0;

  perpDist *= sign(0.5 - float(g_quadIndex == 1.0 || g_quadIndex == 2.0)); // negate for index 1 and 2
  alongDist += distance(rawPos, other) * float(g_quadIndex >= 2.0); // index 2 and 3 correspond to 'far' endpoint of segment

  pos.x += perp.x * perpDist * 2.0 * pos.w / u_viewport.z;
  pos.y += perp.y * perpDist * 2.0 * pos.w / u_viewport.w;

  lineCodeEyePos = .5 * (rawPos + other);
  lineCodeDist = alongDist;

  return pos;
`;
const lineCodeArgs = "g_windowDir, g_windowPos, 0.0";

function createBase(isSilhouette: boolean, isAnimated: boolean): ProgramBuilder {
  const builder = new ProgramBuilder(true);
  const vert = builder.vert;

  vert.addGlobal("g_otherPos", VariableType.Vec4);
  vert.addGlobal("g_quadIndex", VariableType.Float);
  vert.addGlobal("g_windowPos", VariableType.Vec4);
  vert.addGlobal("g_windowDir", VariableType.Vec2);
  vert.addGlobal("g_otherIndex", VariableType.Float);

  vert.addInitializer(decodeEndPointAndQuadIndices);
  if (isAnimated)
    vert.addInitializer(animateEndPoint);

  vert.addGlobal("lineCodeEyePos", VariableType.Vec4);
  vert.addGlobal("lineCodeDist", VariableType.Float, "0.0");

  addModelToWindowCoordinates(vert); // adds u_mvp, u_viewportTransformation
  addProjectionMatrix(vert);
  addLineCode(builder, lineCodeArgs);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  vert.addFunction(GLSLVertex.computeLineWeight);
  builder.addVarying("v_lnInfo", VariableType.Vec4);
  vert.addFunction(adjustWidth);

  addViewport(vert);
  addModelViewMatrix(vert);

  if (isAnimated)
    addAnimation(vert, false);

  vert.addAttribute("a_endPointAndQuadIndices", VariableType.Vec4, (shaderProg) => {
    shaderProg.addAttribute("a_endPointAndQuadIndices", (attr, params) => {
      const geom = params.geometry;
      Debug.assert(() => geom instanceof EdgeGeometry);
      const edgeGeom = geom as EdgeGeometry;
      attr.enableArray(edgeGeom.endPointAndQuadIndices, 4, GL.DataType.UnsignedByte, false, 0, 0);
    });
  });

  vert.addUniform("u_lineWeight", VariableType.Float, (shaderProg) => {
    shaderProg.addGraphicUniform("u_lineWeight", (attr, params) => {
      attr.setUniform1f(params.geometry.getLineWeight(params.programParams));
    });
  });

  if (isSilhouette) {
    addNormalMatrix(vert);
    vert.set(VertexShaderComponent.CheckForEarlyDiscard, checkForSilhouetteDiscard);
    vert.addFunction(octDecodeNormal);
    vert.addAttribute("a_normals", VariableType.Vec4, (shaderProg) => {
      shaderProg.addAttribute("a_normals", (attr, params) => {
        const geom = params.geometry;
        Debug.assert(() => geom instanceof SilhouetteEdgeGeometry);
        const silhouetteGeom = geom as SilhouetteEdgeGeometry;
        attr.enableArray(silhouetteGeom.normalPairs, 4, GL.DataType.UnsignedByte, false, 0, 0);
      });
    });
  }

  return builder;
}

export function createEdgeBuilder(isSilhouette: boolean, isAnimated: boolean): ProgramBuilder {
  const builder = createBase(isSilhouette, isAnimated);
  addShaderFlags(builder);
  addColor(builder);
  addWhiteOnWhiteReversal(builder.frag);
  return builder;
}
