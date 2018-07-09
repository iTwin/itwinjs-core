/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { addModelViewProjectionMatrix } from "./Vertex";
import { addClipping } from "./Clipping";
import { addShaderFlags } from "./Common";
import { ProgramBuilder, VertexShaderComponent } from "../ShaderBuilder";
import { WithClipVolume } from "../TechniqueFlags";
import { addHiliter } from "./FeatureSymbology";
import { addColor } from "./Color";

const computePosition = `
  vec4 pos = u_mv * rawPos;
  v_pos = pos.xyz;
  return u_proj * pos;
`;
function createBase(clip: WithClipVolume): ProgramBuilder {
  const builder = new ProgramBuilder(true);
  // addShaderFlags(builder); // Commented out in the c++ code
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  if (WithClipVolume.Yes === clip)
    addClipping(builder);
  return builder;
}

export function createPointCloudHiliter(clip: WithClipVolume): ProgramBuilder {
  const builder = createBase(clip);
  addHiliter(builder, true);
  return builder;
}

export function createPointCloudBuilder(clip: WithClipVolume): ProgramBuilder {
  const builder = createBase(clip);
  addShaderFlags(builder);
  addColor(builder);

  return builder;
}
