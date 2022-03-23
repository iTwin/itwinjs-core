/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { AttributeMap } from "../AttributeMap";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { IsInstanced } from "../TechniqueFlags";
import { TechniqueId } from "../TechniqueId";
import { addColor } from "./Color";
import { addShaderFlags } from "./Common";
import { addHiliter } from "./FeatureSymbology";
import { addWhiteOnWhiteReversal } from "./Fragment";
import { addLineWeight, addModelViewProjectionMatrix } from "./Vertex";

const computePosition = `
  float lineWeight = computeLineWeight();
  lineWeight += 0.5 * float(lineWeight > 4.0); // fudge factor for rounding fat points...
  gl_PointSize = lineWeight;
  return MAT_MVP * rawPos;
`;

// gl_PointSize specifies coordinates of this fragment within the point in range [0,1].
// This should be the most precise of the many approaches we've tried, but it still yields some asymmetry...
// Discarding if it meets radius precisely seems to reduce that slightly...
// ###TODO try point sprites?
const roundCorners = `
  const vec2 center = vec2(0.5, 0.5);
  vec2 vt = gl_PointCoord - center;
  return dot(vt, vt) * v_roundCorners >= 0.25; // meets or exceeds radius of circle
`;

const computeRoundCorners = "  v_roundCorners = gl_PointSize > 4.0 ? 1.0 : 0.0;";

function createBase(instanced: IsInstanced): ProgramBuilder {
  const attrMap = AttributeMap.findAttributeMap(TechniqueId.PointString, IsInstanced.Yes === instanced);

  const builder = new ProgramBuilder(attrMap, { maxRgbaPerVertex: 5, instanced: IsInstanced.Yes === instanced });
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  addLineWeight(vert);
  builder.addInlineComputedVarying("v_roundCorners", VariableType.Float, computeRoundCorners);
  builder.frag.set(FragmentShaderComponent.CheckForEarlyDiscard, roundCorners);

  return builder;
}

/** @internal */
export function createPointStringHiliter(instanced: IsInstanced): ProgramBuilder {
  const builder = createBase(instanced);
  addHiliter(builder, true);
  return builder;
}

/** @internal */
export function createPointStringBuilder(instanced: IsInstanced): ProgramBuilder {
  const builder = createBase(instanced);
  addShaderFlags(builder);
  addColor(builder);
  addWhiteOnWhiteReversal(builder.frag);
  return builder;
}
