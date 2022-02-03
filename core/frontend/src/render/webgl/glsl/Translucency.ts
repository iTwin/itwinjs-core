/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import type { ProgramBuilder } from "../ShaderBuilder";
import { FragmentShaderComponent } from "../ShaderBuilder";
import { System } from "../System";
import { addEyeSpace, addFrustum } from "./Common";
import { addRenderTargetIndex, computeLinearDepth } from "./Fragment";
import { addModelViewMatrix } from "./Vertex";

// See Weighted Blended Order-Independent Transparency for examples of different weighting functions:
// http://jcgt.org/published/0002/02/09/
// We are using Equation 10 from the above paper.  Equation 10 directly uses screen-space gl_FragCoord.z.
// flatAlphaWeight bit is set if we want to apply OIT transparency using a constant Z value of 1.
// computeLinearDepth() removes the perspective and puts z in linear [0..1]
// To avoid excessively low weight for fragments close to the far plane, scale depth to [0.15, 1.0].
const computeAlphaWeight = `
float computeAlphaWeight(float a) {
  float d = computeLinearDepth(v_eyeSpace.z) * .85 + .15;
  float z = (u_shaderFlags[kShaderBit_OITFlatAlphaWeight] ? 1.0 : d);
  return pow(a + 0.01, 4.0) + max(1e-2, 3.0 * 1e3 * pow(z, 3.0));
}
`;

// NB: Our blending algorithm uses pre-multiplied alpha
const computeOutputs = `
  vec3 Ci = baseColor.rgb * baseColor.a;
  float ai = min(0.99, baseColor.a); // OIT algorithm does not nicely handle a=1
  float wzi = computeAlphaWeight(ai);

  // If we are scaling output into the 0 to 1 range, we use the maximum output of the alpha weight function.
  float outputScale = (u_shaderFlags[kShaderBit_OITScaleOutput] ? 1.0 / 3001.040604 : 1.0);

  vec4 output0 = vec4(Ci * wzi * outputScale, ai);
  vec4 output1 = vec4(ai * wzi * outputScale);
`;

const assignFragData = `${computeOutputs}
  FragColor0 = output0;
  FragColor1 = output1;
`;

const assignFragColor = `${computeOutputs}
  FragColor = (0 == u_renderTargetIndex) ? output0 : output1;
`;

/** @internal */
export function addTranslucency(prog: ProgramBuilder): void {
  const frag = prog.frag;

  addEyeSpace(prog);
  addFrustum(prog);
  addModelViewMatrix(prog.vert);

  frag.addFunction(computeLinearDepth);
  frag.addFunction(computeAlphaWeight);

  if (System.instance.capabilities.supportsMRTTransparency) {
    frag.addDrawBuffersExtension(2);
    frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
  } else {
    addRenderTargetIndex(frag);
    frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
  }
}
