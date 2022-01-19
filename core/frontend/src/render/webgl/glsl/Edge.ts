/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { AttributeMap } from "../AttributeMap";
import { FragmentShaderComponent, ProgramBuilder, ShaderBuilderFlags, VariableType, VertexShaderBuilder, VertexShaderComponent } from "../ShaderBuilder";
import { IsAnimated, IsInstanced, IsThematic } from "../TechniqueFlags";
import { TechniqueId } from "../TechniqueId";
import { TextureUnit } from "../RenderFlags";
import { addAnimation } from "./Animation";
import { addColor } from "./Color";
import { addFrustum, addShaderFlags } from "./Common";
import { addWhiteOnWhiteReversal } from "./Fragment";
import { addAdjustWidth, addLineCode } from "./Polyline";
import { octDecodeNormal } from "./Surface";
import { addLineWeight, addModelViewMatrix, addNormalMatrix, addProjectionMatrix } from "./Vertex";
import { addModelToWindowCoordinates, addViewport } from "./Viewport";
import { addLookupTable } from "./LookupTable";
import { addRenderOrder, addRenderOrderConstants } from "./FeatureSymbology";

export type EdgeBuilderType = "SegmentEdge" | "Silhouette" | "IndexedEdge";

const computeOtherPos = `
  vec2 tc = computeLUTCoords(g_otherIndex, u_vertParams.xy, g_vert_center, u_vertParams.z);
  vec4 enc1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  vec4 enc2 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  vec3 qpos = vec3(decodeUInt16(enc1.xy), decodeUInt16(enc1.zw), decodeUInt16(enc2.xy));
  g_otherPos = unquantizePosition(qpos, u_qOrigin, u_qScale);
`;

const decodeEndPointAndQuadIndices = `
  g_otherIndex = decodeUInt24(a_endPointAndQuadIndices.xyz);
${computeOtherPos}
  g_quadIndex = a_endPointAndQuadIndices.w;
`;

const animateEndPoint = `g_otherPos.xyz += computeAnimationDisplacement(g_otherIndex, u_animDispParams.x, u_animDispParams.y, u_animDispParams.z, u_qAnimDispOrigin, u_qAnimDispScale);`;

// a_pos is a 24-bit index into edge lookup table.
// First six bytes of lookup table entry are the pair of 24-bit indices identifying the endpoints of the edge in the vertex table.
// Return the 24-bit index of "this" vertex in the vertex table encoded in a vec3.
const computeIndexedQuantizedPosition = `
  g_vertexId = gl_VertexID % 6;
  if (g_vertexId == 0)
    g_quadIndex = 0.0;
  else if (g_vertexId == 2 || g_vertexId == 3)
    g_quadIndex = 1.0;
  else if (g_vertexId == 1 || g_vertexId == 4)
    g_quadIndex = 2.0;
  else
    g_quadIndex = 3.0;

  // The following formula computes the texel index, but suffers from precision issues for large edge indices, so we must compute using integers instead.
  // float edgeBaseIndex = u_edgeParams.z * 1.5 + u_edgeParams.w * 0.25 + (edgeIndex - u_edgeParams.z) * 2.5);

  float fEdgeIndex = decodeUInt24(a_pos);
  g_isSilhouette = fEdgeIndex >= u_edgeParams.z;
  int edgeIndex = int(fEdgeIndex);
  bool isEven = 0 == (edgeIndex & 1);
  float edgeBaseIndex;
  if (!g_isSilhouette) {
    edgeBaseIndex = float(edgeIndex + (edgeIndex / 2));
  } else {
    // If both pad and edgeIndex produce a remainder (0.5 for each - pad is a multiple of 2), we must add one to the index to account for it.
    int shift = isEven ? 0 : 1;
    int pad = int(u_edgeParams.w);
    if (0 != (pad % 4)) {
      isEven = !isEven;
      shift = shift + 1;
    }

    // s = num segments p = num padding bytes i = edge index
    // texel index = 1.5s + .25p + 2.5(i - s) = 1.5s + .25p + 2.5i - 2.5s = 2.5i + .25p - s = i + i + i/2 + p/4 - s
    edgeBaseIndex = float(edgeIndex + edgeIndex + edgeIndex / 2 + pad / 4 - int(u_edgeParams.z) + shift / 2);
  }

  vec2 tc = compute_edge_coords(floor(edgeBaseIndex));
  vec4 s0 = floor(TEXTURE(u_edgeLUT, tc) * 255.0 + 0.5);
  tc.x += g_edge_stepX;
  vec4 s1 = floor(TEXTURE(u_edgeLUT, tc) * 255.0 + 0.5);
  tc.x += g_edge_stepX;
  vec4 s2 = floor(TEXTURE(u_edgeLUT, tc) * 255.0 + 0.5);

  vec3 i0 = isEven ? s0.xyz : vec3(s0.zw, s1.x);
  vec3 i1 = isEven ? vec3(s0.w, s1.xy) : s1.yzw;
  g_otherIndexIndex = g_quadIndex < 2.0 ? i1 : i0;

  g_normals = isEven ? vec4(s1.zw, s2.xy) : s2;

  return g_quadIndex < 2.0 ? i0 : i1;
`;

const initializeIndexed = `
  g_otherIndex = decodeUInt24(g_otherIndexIndex);
${computeOtherPos}
`;

// IndexedEdgeGeometry.renderOrder returns Edge or PlanarEdge. Adjust if silhouette for output to pick buffers.
const computeIndexedRenderOrder = `
  if (g_isSilhouette)
    v_renderOrder = kRenderOrder_Edge == u_renderOrder ? kRenderOrder_Silhouette : kRenderOrder_PlanarSilhouette;
  else
    v_renderOrder = u_renderOrder;
`;

const checkForSilhouetteDiscard = `
  if (kFrustumType_Perspective != u_frustum.z) {
    float perpTol = 4.75e-6;
    return (n0.z * n1.z > perpTol);      // orthographic.
  } else {
    float perpTol = 2.5e-4;
    vec4  viewPos = MAT_MV * rawPos;     // perspective
    vec3  toEye = normalize(viewPos.xyz);
    float dot0 = dot(n0, toEye);
    float dot1 = dot(n1, toEye);

    if (dot0 * dot1 > perpTol)
      return true;

    // Need to discard if either is non-silhouette.
    vec4 otherPosition = g_otherPos;
    viewPos = MAT_MV * otherPosition;
    toEye = normalize(viewPos.xyz);
    dot0 = dot(n0, toEye);
    dot1 = dot(n1, toEye);

    return dot0 * dot1 > perpTol;
  }
`;

const checkForSilhouetteDiscardNonIndexed = `
  vec3 n0 = MAT_NORM * octDecodeNormal(a_normals.xy);
  vec3 n1 = MAT_NORM * octDecodeNormal(a_normals.zw);
${checkForSilhouetteDiscard}
`;

const checkForSilhouetteDiscardIndexed = `
  if (!g_isSilhouette)
    return false;

  vec3 n0 = MAT_NORM * octDecodeNormal(g_normals.xy);
  vec3 n1 = MAT_NORM * octDecodeNormal(g_normals.zw);
${checkForSilhouetteDiscard}
`;

const computePosition = `
  v_lnInfo = vec4(0.0, 0.0, 0.0, 0.0);  // init and set flag to false
  vec4  other = g_otherPos;
  float miterAdjust = 0.0;
  float weight = computeLineWeight();

  vec4 pos;
  g_windowPos = modelToWindowCoordinates(rawPos, other, pos, v_eyeSpace);
  if (g_windowPos.w == 0.0) // Clipped out.
    return g_windowPos;

  vec4 otherPos;
  vec3 otherMvPos;
  vec4 projOther = modelToWindowCoordinates(other, rawPos, otherPos, otherMvPos);

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

const adjustContrast = `
  float bgi = u_bgIntensity;
  if (bgi < 0.0)
    return baseColor;

  float s;
  float rgbi = baseColor.r * 0.3 + baseColor.g * 0.59 + baseColor.b * 0.11;
  if (rgbi > 0.81)
    s = bgi > 0.57 ? 0.0 : 0.699;
  else if (rgbi > 0.57)
    s = bgi > 0.57 ? 0.0 : 1.0;
  else
    s = bgi < 0.81 ? 1.0 : 0.699;

  return vec4(vec3(s), baseColor.a);
`;

/** @internal */
export function addEdgeContrast(vert: VertexShaderBuilder): void {
  vert.addUniform("u_bgIntensity", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_bgIntensity", (uniform, params) => {
      let bgi = -1;
      if (params.geometry.isEdge && params.target.currentEdgeSettings.wantContrastingColor(params.target.currentViewFlags.renderMode))
        bgi = params.target.uniforms.style.backgroundIntensity;

      uniform.setUniform1f(bgi);
    });
  });

  vert.set(VertexShaderComponent.AdjustContrast, adjustContrast);
}

const edgeLutParams = new Float32Array(4);

function createBase(type: EdgeBuilderType, instanced: IsInstanced, isAnimated: IsAnimated): ProgramBuilder {
  const isInstanced = IsInstanced.Yes === instanced;
  const isSilhouette = "Silhouette" === type;
  const isIndexed = "IndexedEdge" === type;
  const techId = isSilhouette ? TechniqueId.SilhouetteEdge : (isIndexed ? TechniqueId.IndexedEdge : TechniqueId.Edge);
  const attrMap = AttributeMap.findAttributeMap(techId, isInstanced);

  const builder = new ProgramBuilder(attrMap, isInstanced ? ShaderBuilderFlags.InstancedVertexTable : ShaderBuilderFlags.VertexTable);
  const vert = builder.vert;

  vert.addGlobal("g_otherPos", VariableType.Vec4);
  vert.addGlobal("g_quadIndex", VariableType.Float);
  vert.addGlobal("g_windowPos", VariableType.Vec4);
  vert.addGlobal("g_windowDir", VariableType.Vec2);
  vert.addGlobal("g_otherIndex", VariableType.Float);

  if (isIndexed) {
    vert.addGlobal("g_vertexId", VariableType.Int);
    vert.addGlobal("g_otherIndexIndex", VariableType.Vec3);
    vert.addGlobal("g_isSilhouette", VariableType.Boolean, "false");
    vert.addGlobal("g_normals", VariableType.Vec4);

    const initLut = addLookupTable(vert, "edge", "1.0");
    vert.addUniform("u_edgeLUT", VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform("u_edgeLUT", (uniform, params) => {
        const edge = params.geometry.asIndexedEdge;
        assert(undefined !== edge);
        edge.edgeLut.texture.bindSampler(uniform, TextureUnit.EdgeLUT);
      });
    });

    vert.addUniform("u_edgeParams", VariableType.Vec4, (prog) => {
      prog.addGraphicUniform("u_edgeParams", (uniform, params) => {
        const edge = params.geometry.asIndexedEdge;
        assert(undefined !== edge);
        edgeLutParams[0] = edge.edgeLut.texture.width;
        edgeLutParams[1] = edge.edgeLut.texture.height;
        edgeLutParams[2] = edge.edgeLut.numSegments;
        edgeLutParams[3] = edge.edgeLut.silhouettePadding;
        uniform.setUniform4fv(edgeLutParams);
      });
    });

    vert.set(VertexShaderComponent.ComputeQuantizedPosition, `${initLut}\n\n${computeIndexedQuantizedPosition}`);
    vert.addInitializer(initializeIndexed);

    addRenderOrder(vert);
    addRenderOrderConstants(vert);
    builder.addInlineComputedVarying("v_renderOrder", VariableType.Float, computeIndexedRenderOrder);
    builder.frag.set(FragmentShaderComponent.OverrideRenderOrder, "return v_renderOrder;");
  } else {
    vert.addInitializer(decodeEndPointAndQuadIndices);
  }

  if (isAnimated) {
    addAnimation(vert, false, IsThematic.No);
    vert.addInitializer(animateEndPoint);
  }

  vert.addGlobal("lineCodeEyePos", VariableType.Vec4);
  vert.addGlobal("lineCodeDist", VariableType.Float, "0.0");

  addModelToWindowCoordinates(vert); // adds u_mvp, u_viewportTransformation, and sets g_eyeSpace
  addProjectionMatrix(vert);
  addLineCode(builder, lineCodeArgs);
  builder.addVarying("v_eyeSpace", VariableType.Vec3);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  builder.addVarying("v_lnInfo", VariableType.Vec4);
  addAdjustWidth(vert);

  addViewport(vert);
  addModelViewMatrix(vert);

  addLineWeight(vert);

  if (isSilhouette || isIndexed) {
    addNormalMatrix(vert, instanced);
    addFrustum(builder);
    vert.addFunction(octDecodeNormal);
    vert.set(VertexShaderComponent.CheckForEarlyDiscard, isSilhouette ? checkForSilhouetteDiscardNonIndexed : checkForSilhouetteDiscardIndexed);
  }

  return builder;
}

/** @internal */
export function createEdgeBuilder(type: EdgeBuilderType, instanced: IsInstanced, isAnimated: IsAnimated): ProgramBuilder {
  const builder = createBase(type, instanced, isAnimated);
  addShaderFlags(builder);
  addColor(builder);
  addEdgeContrast(builder.vert);
  addWhiteOnWhiteReversal(builder.frag);
  return builder;
}
