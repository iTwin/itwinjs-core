/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import {
  ProgramBuilder,
  FragmentShaderComponent,
  VariableType,
  VariablePrecision,
} from "../ShaderBuilder";
import { addFrustum } from "./Common";

const computeSimpleLighting = `
void computeSimpleLight (inout float diffuse, inout float specular, vec3 normal, vec3 toEye, vec3 lightDir, float lightIntensity, float specularExponent) {
  diffuse += lightIntensity * max(dot(normal, lightDir), 0.0);
  vec3 toReflectedLight = normalize(reflect(lightDir, normal));
  float specularDot = max(dot(toReflectedLight, toEye), 0.0001);
  // NB: If specularDot and specularExponent are both zero, 0^0 done below can return NaN.  Must make sure specularDot is larger than zero (hence 0.0001 or greater, as ensured above).
  specular += lightIntensity * pow(specularDot, specularExponent);
}
`;

// mat_weights: x=diffuse y=specular
const applyLighting = `
  if (isSurfaceBitSet(kSurfaceBit_ApplyLighting) && baseColor.a > 0.0) {
    // negate normal if not front-facing
    vec3 normal = normalize(v_n.xyz);
    normal *= 2.0 * float(!isSurfaceBitSet(kSurfaceBit_NoFaceFront) &&  gl_FrontFacing) - 1.0;
    vec3 toEye = mix(vec3(0.0, 0.0, -1.0), normalize(v_eyeSpace.xyz), float(kFrustumType_Perspective == u_frustum.z));

    vec3 specularColor = mat_specular.rgb;
    float specularExp = mat_specular.a;

    float diffuseWeight = mat_weights.x;
    float specularWeight = mat_weights.y;
    float ambientWeight = 1.0; // NB: MicroStation ignores material's ambient weight, values are usually dumb.

    vec3 litColor = vec3(0.0);

    float diffuseIntensity = 0.0, specularIntensity = 0.0;

    computeSimpleLight (diffuseIntensity, specularIntensity, normal, toEye, u_sunDir, 1.0, specularExp);
    computeSimpleLight (diffuseIntensity, specularIntensity, normal, toEye, vec3(-0.7071, 0.0, 0.7071), .30, specularExp);

    const float directionalIntensity = 0.92;
    const float ambientIntensity = 0.2;
    litColor += directionalIntensity * diffuseWeight * diffuseIntensity * baseColor.rgb + specularIntensity * specularWeight * specularColor;
    litColor.rgb += (ambientIntensity * ambientWeight) * baseColor.rgb;

    // Clamp while preserving hue.
    float maxIntensity = max(litColor.r, max(litColor.g, litColor.b));

    baseColor.rgb = litColor / max(1.0, maxIntensity);
  }

  return baseColor;
`;

// Replaces the sun direction when solar shadows are turned off.
const defaultSunDirection = new Float32Array([ 0.272166, 0.680414, 0.680414 ]);

/** NB: addMaterial() sets up the mat_* variables used by applyLighting.
 * @internal
 */
export function addLighting(builder: ProgramBuilder) {
  addFrustum(builder);

  const frag = builder.frag;

  frag.addFunction(computeSimpleLighting);
  frag.set(FragmentShaderComponent.ApplyLighting, applyLighting);
  frag.addUniform("u_sunDir", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_sunDir", (uniform, params) => {
      if (params.target.solarShadowMap.isEnabled)
        params.target.uniforms.shadow.bindSunDirection(uniform);
      else
        uniform.setUniform3fv(defaultSunDirection);
    });
  }, VariablePrecision.High);
}
