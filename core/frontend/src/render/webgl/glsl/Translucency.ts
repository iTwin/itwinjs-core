/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ProgramBuilder, FragmentShaderComponent } from "../ShaderBuilder";
import { GLSLFragment, addRenderTargetIndex } from "./Fragment";
import { addModelViewMatrix } from "./Vertex";
import { addFrustum, addEyeSpace } from "./Common";
import { System } from "../System";

const computeAlphaWeight = `
float computeAlphaWeight(float a, bool flatAlpha) {
  // See Weighted Blended Order-Independent Transparency for examples of different weighting functions:
  // http://jcgt.org/published/0002/02/09/
  // We are using Equation 10 from the above paper.  Equation 10 directly uses screen-space gl_FragCoord.z.

  // flatAlphaWeight bit is set if we want to apply OIT transparency using a constant Z value of 1.
  // computeLinearDepth() removes the perspective and puts z in linear [0..1]
  float z = flatAlpha ? 1.0 : computeLinearDepth(v_eyeSpace.z);
  return pow(a + 0.01, 4.0) + max(1e-2, 3.0 * 1e3 * pow(z, 3.0));
}
`;

const computeOutputs = `
  bool flatAlpha = isShaderBitSet(kShaderBit_OITScaleOutput);
  vec3 Ci = baseColor.rgb;
  float ai = min(0.99, baseColor.a); // OIT algorithm does not nicely handle a=1
  float wzi = computeAlphaWeight(ai, flatAlpha);

  // If we are scaling output into the 0 to 1 range, we use the maximum output of the alpha weight function.
  float outputScale = flatAlpha ? 1.0 / 3001.040604 : 1.0;

  vec4 output0 = vec4(Ci * wzi * outputScale, ai);
  vec4 output1 = vec4(ai * wzi * outputScale);
`;

const assignFragData = computeOutputs + `
  FragColor0 = output0;
  FragColor1 = output1;
`;

const assignFragColor = computeOutputs + `
  FragColor = (0 == u_renderTargetIndex) ? output0 : output1;
`;

export function addTranslucency(prog: ProgramBuilder): void {
  const frag = prog.frag;

  addEyeSpace(prog);
  addFrustum(prog);
  addModelViewMatrix(prog.vert);

  frag.addFunction(GLSLFragment.computeLinearDepth);
  frag.addFunction(computeAlphaWeight);

  if (System.instance.capabilities.supportsMRTTransparency) {
    frag.addDrawBuffersExtension();
    frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
  } else {
    addRenderTargetIndex(frag);
    frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
  }
}
