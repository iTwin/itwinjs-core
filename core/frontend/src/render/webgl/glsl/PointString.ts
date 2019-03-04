/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { addHiliter } from "./FeatureSymbology";
import { addModelViewProjectionMatrix, addLineWeight } from "./Vertex";
import { addShaderFlags } from "./Common";
import { addColor } from "./Color";
import { addWhiteOnWhiteReversal } from "./Fragment";
import { ShaderBuilderFlags, ProgramBuilder, VertexShaderComponent, VariableType, FragmentShaderComponent } from "../ShaderBuilder";
import { IsInstanced } from "../TechniqueFlags";

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
  const builder = new ProgramBuilder(instanced ? ShaderBuilderFlags.InstancedVertexTable : ShaderBuilderFlags.VertexTable);
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  addLineWeight(vert);
  builder.addInlineComputedVarying("v_roundCorners", VariableType.Float, computeRoundCorners);
  builder.frag.set(FragmentShaderComponent.CheckForEarlyDiscard, roundCorners);

  return builder;
}

export function createPointStringHiliter(instanced: IsInstanced): ProgramBuilder {
  const builder = createBase(instanced);
  addHiliter(builder, true);
  return builder;
}

export function createPointStringBuilder(instanced: IsInstanced): ProgramBuilder {
  const builder = createBase(instanced);
  addShaderFlags(builder);
  addColor(builder);
  addWhiteOnWhiteReversal(builder.frag);
  return builder;
}
