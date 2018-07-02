/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { addHiliter } from "./FeatureSymbology";
import { addModelViewProjectionMatrix, GLSLVertex } from "./Vertex";
import { addClipping } from "./Clipping";
import { addShaderFlags } from "./Common";
import { addColor } from "./Color";
import { addWhiteOnWhiteReversal } from "./Fragment";
import { ProgramBuilder, VertexShaderComponent, VariableType, FragmentShaderComponent } from "../ShaderBuilder";
import { WithClipVolume } from "../TechniqueFlags";

const computePosition = `
  float lineWeight = ComputeLineWeight();
  if (lineWeight > 4.0)
    lineWeight += 0.5; // ###TODO: Fudge factor for rounding fat points...

  gl_PointSize = lineWeight;
  return u_mvp * rawPos;
`;

const roundCorners = `
  // gl_PointSize specifies coordinates of this fragment within the point in range [0,1].
  // This should be the most precise of the many approaches we've tried, but it still yields some asymmetry...
  // Discarding if it meets radius precisely seems to reduce that slightly...
  // ###TODO try point sprites?
  const vec2 center = vec2(0.5, 0.5);
  vec2 vt = gl_PointCoord - center;
  return dot(vt, vt) * v_roundCorners >= 0.25; // meets or exceeds radius of circle
`;

const computeRoundCorners = "  v_roundCorners = gl_PointSize > 4.0 ? 1.0 : 0.0;";

function createBase(clip: WithClipVolume): ProgramBuilder {
  const builder = new ProgramBuilder(true);
  // addShaderFlags(builder); // Commented out in the c++ code
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  vert.addFunction(GLSLVertex.computeLineWeight);
  vert.addUniform("u_lineWeight", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_lineWeight", (uniform, params) => {
      uniform.setUniform1f(params.geometry.getLineWeight(params));
    });
  });
  builder.addInlineComputedVarying("v_roundCorners", VariableType.Float, computeRoundCorners);
  builder.frag.set(FragmentShaderComponent.CheckForEarlyDiscard, roundCorners);

  if (WithClipVolume.Yes === clip)
    addClipping(builder);
  return builder;
}

export function createPointStringHiliter(clip: WithClipVolume): ProgramBuilder {
  const builder = createBase(clip);
  addHiliter(builder, true);
  return builder;
}

export function createPointStringBuilder(clip: WithClipVolume): ProgramBuilder {
  const builder = createBase(clip);
  addShaderFlags(builder);
  addColor(builder);
  addWhiteOnWhiteReversal(builder.frag);
  return builder;
}
