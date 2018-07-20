/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ProgramBuilder, FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { GLSLFragment } from "./Fragment";
import { addModelViewMatrix } from "./Vertex";
import { addFrustum } from "./Common";

const computeEyeSpaceZ = "v_eyeSpaceZ = (u_mv * rawPosition).z;";

const computeAlphaWeight = `
float computeAlphaWeight(float a, bool flatAlpha) {
  // See Weighted Blended Order-Independent Transparency for examples of different weighting functions:
  // http://jcgt.org/published/0002/02/09/
  // We are using Equation 10 from the above paper.  Equation 10 directly uses screen-space gl_FragCoord.z.

  // flatAlphaWeight bit is set if we want to apply OIT transparency using a constant Z value of 1.
  // computeLinearDepth() removes the perspective and puts z in linear [0..1]
  float z = flatAlpha ? 1.0 : computeLinearDepth(v_eyeSpaceZ);
  return pow(a + 0.01, 4.0) + max(1e-2, 3.0 * 1e3 * pow(z, 3.0));
}
`;

const assignFragData = `
  bool flatAlpha = isShaderBitSet(kShaderBit_OITScaleOutput);
  vec3 Ci = baseColor.rgb;
  float ai = min(0.99, baseColor.a); // OIT algorithm does not nicely handle a=1
  float wzi = computeAlphaWeight(ai, flatAlpha);

  // If we are scaling output into the 0 to 1 range, we use the maximum output of the alpha weight function.
  float outputScale = flatAlpha ? 1.0 / 3001.040604 : 1.0;

  FragColor0 = vec4(Ci * wzi * outputScale, ai);
  FragColor1 = vec4(ai * wzi * outputScale);
`;

export function addTranslucency(prog: ProgramBuilder): void {
  // ###TODO: Surface shaders may already have a v_eyeSpace containing xyz - optimize to use that instead of recomputing for z only.
  prog.addInlineComputedVarying("v_eyeSpaceZ", VariableType.Float, computeEyeSpaceZ);
  addFrustum(prog);
  addModelViewMatrix(prog.vert);

  const frag = prog.frag;
  frag.addDrawBuffersExtension();
  frag.addFunction(GLSLFragment.computeLinearDepth);
  frag.addFunction(computeAlphaWeight);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
}
