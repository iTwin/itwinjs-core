/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { FragmentShaderComponent, ProgramBuilder, VariablePrecision, VariableType } from "../ShaderBuilder";
import { addFrustum } from "./Common";

const computeDirectionalLighting = `
void computeDirectionalLight (inout float diffuse, inout float specular, vec3 normal, vec3 toEye, vec3 lightDir, float lightIntensity, float specularExponent) {
  diffuse += lightIntensity * max(dot(normal, lightDir), 0.0);
  vec3 toReflectedLight = normalize(reflect(lightDir, normal));
  float specularDot = max(dot(toReflectedLight, toEye), 0.0001);
  // NB: If specularDot and specularExponent are both zero, 0^0 done below can return NaN.  Must make sure specularDot is larger than zero (hence 0.0001 or greater, as ensured above).
  specular += lightIntensity * pow(specularDot, specularExponent);
}
`;

// mat_weights: x=diffuse y=specular
const applyLighting = `
  if (baseColor.a <= 0.0 || !u_surfaceFlags[kSurfaceBitIndex_ApplyLighting])
    return baseColor;

  // Extract surface properties
  vec3 rgb = baseColor.rgb;
  vec3 normal = normalize(v_n.xyz);
  normal *= 2.0 * float(!u_surfaceFlags[kSurfaceBitIndex_NoFaceFront] &&  gl_FrontFacing) - 1.0;
  vec3 toEye = kFrustumType_Perspective == u_frustum.z ? normalize(v_eyeSpace.xyz) : vec3(0.0, 0.0, -1.0);

  // Extract material properties
  float diffuseWeight = mat_weights.x;
  float specularWeight = mat_weights.y * u_lightSettings[13];
  float specularExponent = mat_specular.a;
  vec3 specularColor = mat_specular.rgb;
  const float ambientWeight = 1.0; // Ignore MicroStation's ambient weights - usually bogus.

  // Compute directional lights
  const vec3 portraitDir = vec3(-0.7071, 0.0, 0.7071);
  float portraitIntensity = u_lightSettings[12];
  float sunIntensity = u_lightSettings[0];

  float directionalDiffuseIntensity = 0.0;
  float directionalSpecularIntensity = 0.0;
  computeDirectionalLight(directionalDiffuseIntensity, directionalSpecularIntensity, normal, toEye, u_sunDir, sunIntensity, specularExponent);
  computeDirectionalLight(directionalDiffuseIntensity, directionalSpecularIntensity, normal ,toEye, portraitDir, portraitIntensity, specularExponent);

  const float directionalFudge = 0.92; // leftover from old lighting implementation
  vec3 diffuseAccum = directionalDiffuseIntensity * diffuseWeight * rgb * directionalFudge; // directional light is white.
  vec3 specularAccum = directionalSpecularIntensity * specularWeight * specularColor;

  // Compute ambient light
  float ambientIntensity = u_lightSettings[4];
  vec3 ambientColor = vec3(u_lightSettings[1], u_lightSettings[2], u_lightSettings[3]);
  if (ambientColor.r + ambientColor.g + ambientColor.b == 0.0)
    ambientColor = rgb;

  diffuseAccum += ambientIntensity * ambientWeight * ambientColor;

  // Compute hemisphere lights
  vec3 ground = vec3(u_lightSettings[5], u_lightSettings[6], u_lightSettings[7]);
  vec3 sky = vec3(u_lightSettings[8], u_lightSettings[9], u_lightSettings[10]);
  float hemiIntensity = u_lightSettings[11];

  //  diffuse
  float hemiDot = dot(normal, u_upVector);
  float hemiDiffuseWeight = 0.5 * hemiDot + 0.5;
  vec3 hemiColor = mix(ground, sky, hemiDiffuseWeight);
  diffuseAccum += hemiIntensity * hemiColor * rgb;

  //  sky specular
  vec3 reflectSky = normalize(reflect(u_upVector, normal));
  float skyDot = max(dot(reflectSky, toEye), 0.0001);
  float hemiSpecWeight = hemiIntensity * pow(skyDot, specularExponent);

  //  ground specular
  vec3 reflectGround = normalize(reflect(-u_upVector, normal));
  float groundDot = max(dot(reflectGround, toEye), 0.0001);
  hemiSpecWeight += hemiIntensity * pow(groundDot, specularExponent);

  specularAccum += hemiSpecWeight * specularColor * hemiColor;

  // Clamp while preserving hue.
  vec3 litColor = diffuseAccum + specularAccum;
  float maxIntensity = max(litColor.r, max(litColor.g, litColor.b));
  float numCel = u_lightSettings[14];
  if (numCel > 0.0)
    baseColor.rgb = baseColor.rgb * ceil(maxIntensity * numCel) / numCel;
  else
    baseColor.rgb = litColor / max(1.0, maxIntensity);

  return baseColor;
`;

/** NB: addMaterial() sets up the mat_* variables used by applyLighting.
 * @internal
 */
export function addLighting(builder: ProgramBuilder) {
  addFrustum(builder);

  const frag = builder.frag;

  frag.addFunction(computeDirectionalLighting);
  frag.set(FragmentShaderComponent.ApplyLighting, applyLighting);

  frag.addUniform("u_sunDir", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_sunDir", (uniform, params) => {
      params.target.uniforms.bindSunDirection(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_lightSettings[15]", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_lightSettings[0]", (uniform, params) => {
      params.target.uniforms.lights.bind(uniform);
    });
  });

  frag.addUniform("u_upVector", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_upVector", (uniform, params) => {
      params.target.uniforms.frustum.bindUpVector(uniform);
    });
  });
}
