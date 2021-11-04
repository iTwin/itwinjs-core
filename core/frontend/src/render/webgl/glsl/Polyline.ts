/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { AttributeMap } from "../AttributeMap";
import { TextureUnit } from "../RenderFlags";
import {
  FragmentShaderBuilder, FragmentShaderComponent, ProgramBuilder, ShaderBuilderFlags, VariableType, VertexShaderBuilder, VertexShaderComponent,
} from "../ShaderBuilder";
import { System } from "../System";
import { IsInstanced } from "../TechniqueFlags";
import { TechniqueId } from "../TechniqueId";
import { addColor } from "./Color";
import { addEdgeContrast } from "./Edge";
import { addFrustum, addShaderFlags } from "./Common";
import { unquantize2d } from "./Decode";
import { addHiliter } from "./FeatureSymbology";
import { addWhiteOnWhiteReversal } from "./Fragment";
import { addLineCode as addLineCodeUniform, addLineWeight, addModelViewMatrix, addProjectionMatrix } from "./Vertex";
import { addModelToWindowCoordinates, addViewport } from "./Viewport";

const checkForDiscard = "return discardByLineCode;";

const applyLineCode = `
  if (v_texc.x >= 0.0) { // v_texc = (-1,-1) for solid lines - don't bother with any of this
    vec4 texColor = TEXTURE(u_lineCodeTexture, v_texc);
    discardByLineCode = (0.0 == texColor.r);
  }

  if (v_lnInfo.w > 0.5) { // line needs pixel trimming
    // calculate pixel distance from pixel center to expected line center, opposite dir from major
    vec2 dxy = gl_FragCoord.xy - v_lnInfo.xy;
    if (v_lnInfo.w < 1.5)  // not x-major
      dxy = dxy.yx;

    float dist = v_lnInfo.z * dxy.x - dxy.y;
    float distA = abs(dist);
    if (distA > 0.5 || (distA == 0.5 && dist < 0.0))
      discardByLineCode = true;  // borrow this flag to force discard
  }

  return baseColor;
`;

const computeTextureCoord = `
vec2 computeLineCodeTextureCoords(vec2 windowDir, vec4 projPos, float adjust) {
  vec2 texc;
  float lineCode = computeLineCode();
  if (0.0 == lineCode) {
    // Solid line - tell frag shader not to bother.
    texc = vec2(-1.0, -1.0);
  } else {
    const float imagesPerPixel = 1.0/32.0;
    const float textureCoordinateBase = 8192.0; // Temp workardound for clipping problem in perspective views (negative values don't seem to interpolate correctly).

    if (abs(windowDir.x) > abs(windowDir.y))
      texc.x = textureCoordinateBase + imagesPerPixel * (projPos.x + adjust * windowDir.x);
    else
      texc.x = textureCoordinateBase + imagesPerPixel * (projPos.y + adjust * windowDir.y);

    const float numLineCodes = 16.0; // NB: Actually only 10, but texture is 16px tall because it needs to be a power of 2.
    const float rowsPerCode = 1.0;
    const float numRows = numLineCodes*rowsPerCode;
    const float centerY = 0.5/numRows;
    const float stepY = rowsPerCode/numRows;
    texc.y = stepY * lineCode + centerY;
  }

  return texc;
}
`;

/** @internal */
export const adjustWidth = `
void adjustWidth(inout float width, vec2 d2, vec2 org) {
  if (u_aaSamples > 1) {
    if (width < 5.0)
      width += (5.0 - width) * 0.125;
    return;
  }

  // calculate slope based width adjustment for non-AA lines, widths 1 to 4
  vec2 d2A = abs(d2);
  const float s_myFltEpsilon = 0.0001;  // limit test resolution to 4 digits in case 24 bit (s16e7) is used in hardware
  if (d2A.y > s_myFltEpsilon && width < 4.5) {
    float len = length(d2A);
    float tan = d2A.x / d2A.y;

    if (width < 1.5) { // width 1
      if (tan <= 1.0)
        width = d2A.y;
      else
        width = d2A.x;
      // width 1 requires additional adjustment plus trimming in frag shader using v_lnInfo
      width *= 1.01;
      v_lnInfo.xy = org;
      v_lnInfo.w = 1.0; // set flag to do trimming
      // set slope in v_lnInfo.z
      if (d2A.x - d2A.y > s_myFltEpsilon) {
        v_lnInfo.z = d2.y / d2.x;
        v_lnInfo.w += 2.0; // add in x-major flag
      } else
        v_lnInfo.z = d2.x / d2.y;

    } else if (width < 2.5) { // width 2
      if (tan <= 0.5)
        width = 2.0 * d2A.y;
      else
        width = (d2A.y + 2.0 * d2A.x);

    } else if (width < 3.5) { // width 3
        if (tan <= 1.0)
            width = (3.0 * d2A.y + d2A.x);
        else
            width = (d2A.y + 3.0 * d2A.x);

    } else { // if (width < 4.5) // width 4
      if (tan <= 0.5)
        width = (4.0 * d2A.y + d2A.x);
      else if (tan <= 2.0)
        width = (3.0 * d2A.y + 3.0 * d2A.x);
      else
        width = (d2A.y + 4.0 * d2A.x);
    }
    width /= len;
  }
}
`;

/** @internal */
export function addAdjustWidth(vert: VertexShaderBuilder) {
  vert.addUniform("u_aaSamples", VariableType.Int, (prog) => {
    prog.addGraphicUniform("u_aaSamples", (attr, params) => {
      const numSamples = System.instance.frameBufferStack.currentFbMultisampled ? params.target.compositor.antialiasSamples : 1;
      attr.setUniform1i(numSamples);
    });
  });
  vert.addFunction(adjustWidth);
}

/** @internal */
export function addLineCodeTexture(frag: FragmentShaderBuilder) {
  frag.addUniform("u_lineCodeTexture", VariableType.Sampler2D, (prog) => {
    prog.addProgramUniform("u_lineCodeTexture", (uniform) => {
      const lct = System.instance.lineCodeTexture;
      assert(undefined !== lct);
      if (undefined !== lct)
        lct.bindSampler(uniform, TextureUnit.LineCode);
    });
  });
}

/** @internal */
export function addLineCode(prog: ProgramBuilder, args: string) {
  const vert = prog.vert;
  const frag = prog.frag;

  addLineCodeUniform(vert);

  const funcCall: string = `computeLineCodeTextureCoords(${args})`;

  prog.addFunctionComputedVaryingWithArgs("v_texc", VariableType.Vec2, funcCall, computeTextureCoord);

  addFrustum(prog);
  addLineCodeTexture(prog.frag);

  frag.set(FragmentShaderComponent.FinalizeBaseColor, applyLineCode);
  frag.set(FragmentShaderComponent.CheckForDiscard, checkForDiscard);
  frag.addGlobal("discardByLineCode", VariableType.Boolean, "false");
}

function polylineAddLineCode(prog: ProgramBuilder) {
  addLineCode(prog, lineCodeArgs);
  addModelViewMatrix(prog.vert);
}

function addCommon(prog: ProgramBuilder) {
  const vert = prog.vert;
  addModelToWindowCoordinates(vert); // adds u_mvp, u_viewportTransformation
  addProjectionMatrix(vert);
  addModelViewMatrix(vert);
  addViewport(vert);

  vert.addGlobal("g_windowPos", VariableType.Vec4);
  vert.addGlobal("g_prevPos", VariableType.Vec4);
  vert.addGlobal("g_nextPos", VariableType.Vec4);
  vert.addGlobal("g_windowDir", VariableType.Vec2);
  vert.addInitializer(decodeAdjacentPositions);

  vert.addFunction(unquantize2d);

  addLineWeight(vert);

  vert.addGlobal("miterAdjust", VariableType.Float, "0.0");
  prog.addVarying("v_eyeSpace", VariableType.Vec3);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  prog.addVarying("v_lnInfo", VariableType.Vec4);
  addAdjustWidth(vert);
  vert.addFunction(decodePosition);
}

const decodePosition = `
vec4 decodePosition(vec3 baseIndex) {
  float index = decodeUInt24(baseIndex);
  vec2 tc = compute_vert_coords(index);
  vec4 e0 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  vec4 e1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  vec3 qpos = vec3(decodeUInt16(e0.xy), decodeUInt16(e0.zw), decodeUInt16(e1.xy));
  return unquantizePosition(qpos, u_qOrigin, u_qScale);
}
`;

const decodeAdjacentPositions = `
  g_prevPos = decodePosition(a_prevIndex);
  g_nextPos = decodePosition(a_nextIndex);
`;

const computePosition = `
  const float kNone = 0.0,
              kSquare = 1.0*3.0,
              kMiter = 2.0*3.0,
              kMiterInsideOnly = 3.0*3.0,
              kJointBase = 4.0*3.0,
              kNegatePerp = 8.0*3.0,
              kNegateAlong = 16.0*3.0,
              kNoneAdjWt = 32.0*3.0;

  v_lnInfo = vec4(0.0, 0.0, 0.0, 0.0);  // init and set flag to false

  vec4 next = g_nextPos;
  vec4 pos;
  g_windowPos = modelToWindowCoordinates(rawPos, next, pos, v_eyeSpace);
  if (g_windowPos.w == 0.0)
    return g_windowPos;

  float param = a_param;
  float weight = computeLineWeight();
  float scale = 1.0, directionScale = 1.0;

  if (param >= kNoneAdjWt)
    param -= kNoneAdjWt;

  if (param >= kNegateAlong) {
    directionScale = -directionScale;
    param -= kNegateAlong;
  }

  if (param >= kNegatePerp) {
    scale = -1.0;
    param -= kNegatePerp;
  }

  vec4 otherPos;
  vec3 otherMvPos;
  vec4 projNext = modelToWindowCoordinates(next, rawPos, otherPos, otherMvPos);
  g_windowDir = projNext.xy - g_windowPos.xy;

  if (param < kJointBase) {
    vec2 dir = (directionScale > 0.0) ? g_windowDir : -g_windowDir;
    vec2 pos = (directionScale > 0.0) ? g_windowPos.xy : projNext.xy;
    adjustWidth(weight, dir, pos);
  }

  if (kNone != param) {
    vec2 delta = vec2(0.0);
    vec4 prev   = g_prevPos;
    vec4 projPrev = modelToWindowCoordinates(prev, rawPos, otherPos, otherMvPos);
    vec2 prevDir   = g_windowPos.xy - projPrev.xy;
    float thisLength = sqrt(g_windowDir.x * g_windowDir.x + g_windowDir.y * g_windowDir.y);
    const float s_minNormalizeLength = 1.0E-5;  // avoid normalizing zero length vectors.
    float dist = weight / 2.0;

    if (thisLength > s_minNormalizeLength) {
      g_windowDir /= thisLength;

      float prevLength = sqrt(prevDir.x * prevDir.x + prevDir.y * prevDir.y);

      if (prevLength > s_minNormalizeLength) {
        prevDir /= prevLength;
        const float     s_minParallelDot= -.9999, s_maxParallelDot = .9999;
        float           prevNextDot  = dot(prevDir, g_windowDir);

        if (prevNextDot < s_minParallelDot || prevNextDot > s_maxParallelDot)    // No miter if parallel or antiparallel.
          param = kSquare;
      } else
        param = kSquare;
    } else {
      g_windowDir = -normalize(prevDir);
      param = kSquare;
    }

    vec2 perp = scale * vec2(-g_windowDir.y, g_windowDir.x);

    if (param == kSquare) {
      delta = perp;
    } else {
      vec2 bisector = normalize(prevDir - g_windowDir);
      float dotP = dot (bisector, perp);

      if (dotP != 0.0) { // Should never occur - but avoid divide by zero.
        const float maxMiter = 3.0;
        float miterDistance = 1.0/dotP;

        if (param == kMiter) { // Straight miter.
          delta = (abs(miterDistance) > maxMiter) ? perp : bisector * miterDistance;

        } else if (param == kMiterInsideOnly) { // Miter at inside, square at outside (to make room for joint).
          delta = (dotP  > 0.0 || abs(miterDistance) > maxMiter) ? perp : bisector * miterDistance;

        } else {
          const float jointTriangleCount = 3.0;
          float ratio = (param - kJointBase) / jointTriangleCount; // 3 triangles per half-joint as defined in Graphics.cpp
          delta = normalize((1.0 - ratio) * bisector + (dotP < 0.0 ? -ratio : ratio) * perp); // Miter/Straight combination.
        }
      }
    }

    miterAdjust = dot(g_windowDir, delta) * dist; // Not actually used for hilite shader but meh.
    pos.x += dist * delta.x * 2.0 * pos.w / u_viewport.x;
    pos.y += dist * delta.y * 2.0 * pos.w / u_viewport.y;
  }

  return pos;
`;

const lineCodeArgs = "g_windowDir, g_windowPos, miterAdjust";

/** @internal */
export function createPolylineBuilder(instanced: IsInstanced): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.Polyline, IsInstanced.Yes === instanced), instanced ? ShaderBuilderFlags.InstancedVertexTable : ShaderBuilderFlags.VertexTable);
  addShaderFlags(builder);

  addCommon(builder);

  polylineAddLineCode(builder);

  addColor(builder);
  addEdgeContrast(builder.vert);
  addWhiteOnWhiteReversal(builder.frag);

  return builder;
}

/** @internal */
export function createPolylineHiliter(instanced: IsInstanced): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.Polyline, IsInstanced.Yes === instanced), instanced ? ShaderBuilderFlags.InstancedVertexTable : ShaderBuilderFlags.VertexTable);
  addCommon(builder);
  addFrustum(builder);
  addHiliter(builder, true);
  return builder;
}
