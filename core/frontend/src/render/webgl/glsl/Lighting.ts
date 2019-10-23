/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import {
  ProgramBuilder,
  FragmentShaderComponent,
  VariableType,
  VariablePrecision,
} from "../ShaderBuilder";
import { addFrustum } from "./Common";
import { Vector3d, Transform } from "@bentley/geometry-core";

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

    // Use a pair of lights that is something in-between portrait lighting & something more out-doorsy with a slightly more overhead main light.
    // This will make more sense in a wider variety of scenes since this is the only lighting currently supported.
    computeSimpleLight (diffuseIntensity, specularIntensity, normal, toEye, u_sunDir, 1.0, specularExp);
    computeSimpleLight (diffuseIntensity, specularIntensity, normal, toEye, normalize(vec3(-0.3, 0.0, 0.3)), .30, specularExp);

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

/** NB: addMaterial() sets up the mat_* variables used by applyLighting.
 * @internal
 */
const scratch3Floats = new Float32Array(3);
const scratchDirection = new Vector3d();
const scratchTransform = Transform.createIdentity();

export function addLighting(builder: ProgramBuilder) {
  addFrustum(builder);

  const frag = builder.frag;

  frag.addFunction(computeSimpleLighting);
  frag.set(FragmentShaderComponent.ApplyLighting, applyLighting);
  frag.addUniform("u_sunDir", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_sunDir", (uniform, params) => {
      const shadowMap = params.target.compositor.solarShadowMap;
      if (undefined !== shadowMap && shadowMap.isEnabled && undefined !== shadowMap.direction) {
        // replace first light dir with solar direction (relative to model instead of view)
        let mvt = params.target.viewMatrix.clone(scratchTransform);
        mvt = mvt.multiplyTransformTransform(params.target.currentTransform, mvt);
        const coffs = mvt.matrix.coffs;
        scratchDirection.x = coffs[0] * shadowMap.direction.x + coffs[1] * shadowMap.direction.y + coffs[2] * shadowMap.direction.z;
        scratchDirection.y = coffs[3] * shadowMap.direction.x + coffs[4] * shadowMap.direction.y + coffs[5] * shadowMap.direction.z;
        scratchDirection.z = coffs[6] * shadowMap.direction.x + coffs[7] * shadowMap.direction.y + coffs[8] * shadowMap.direction.z;
        scratchDirection.normalizeInPlace();
        scratch3Floats[0] = -scratchDirection.x;
        scratch3Floats[1] = -scratchDirection.y;
        scratch3Floats[2] = -scratchDirection.z;
      } else {
        // use current hardcoded direction for first light
        scratch3Floats[0] = 0.2;
        scratch3Floats[1] = 0.5;
        scratch3Floats[2] = 0.5;
      }
      uniform.setUniform3fv(scratch3Floats);
    });
  }, VariablePrecision.High);
}
