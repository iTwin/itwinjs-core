/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { addEyeSpace } from "./Common";
import { FragmentShaderComponent, ProgramBuilder, VariablePrecision, VariableType } from "../ShaderBuilder";
import { Matrix3 } from "../Matrix";

// float dist = distance(u_earthCenter.y, v_eyeSpace.y);
// if (mod(round(dist / 10.0), 2.0) == 0.0) {
//   return vec4(0.0, 0.0, 0.0, 1.0);
// }
// return vec4(1.0, 1.0, 1.0, 1.0);

const skip = `return baseColor;`;

const atmosphericScatteringPreludeGeneric = `
  float sceneDepth = length(v_eyeSpace);
  vec3 rayDir = normalize(v_eyeSpace);
`;
const atmosphericScatteringPreludeSky = `
  float sceneDepth = max_float;
  vec3 rayDir = normalize(u_viewMatrix * v_eyeToVert);
`;

const applyAtmosphericScattering = `
  if (!bool(u_isEnabled))
    return baseColor;
  vec3 scatteringCoefficients = vec3(
    pow(400.0 / wavelengths.x, 4.0) * scatteringStrength,
    pow(400.0 / wavelengths.y, 4.0) * scatteringStrength,
    pow(400.0 / wavelengths.z, 4.0) * scatteringStrength
  );
  vec3 rayOrigin = vec3(0.0, 0.0, 0.0);

  vec2 hitInfo = raySphere(u_earthCenter, u_atmosphereRadius, rayOrigin, rayDir);
  float distanceToAtmosphere = hitInfo[0];
  float distanceThroughAtmosphere;

  distanceThroughAtmosphere = min(hitInfo[1], sceneDepth - distanceToAtmosphere);

  float temp = distanceThroughAtmosphere / (u_atmosphereRadius * 2.0);
  vec4 temp2 = vec4(temp, temp, temp, 1.0) * vec4(rayDir.rgb * 0.5 + 0.5, 1.0);

  if (distanceThroughAtmosphere > 0.0) {
    float epsilon = 0.0001;
    vec3 pointInAtmosphere = rayOrigin + rayDir * (distanceToAtmosphere + epsilon);

    vec4 light = calculateScattering(pointInAtmosphere, rayDir, (distanceThroughAtmosphere - epsilon) * 2.0, baseColor, scatteringCoefficients);
    return light;
  }
  return baseColor;
`;

const raySphere = `
vec2 raySphere(vec3 sphereCenter, float sphereRadius, vec3 rayOrigin, vec3 rayDir) {
  vec3 offset = rayOrigin - sphereCenter;
  float a = 1.0;
  float b = 2.0 * dot(offset, rayDir);
  float c = dot(offset, offset) - sphereRadius * sphereRadius;
  float d = b * b - 4.0 * a * c;

  if (d > 0.0) {
    float s = sqrt(d);
    float distanceToSphereNear = max(0.0, (-b - s) / (2.0 * a));
    float distanceToSphereFar = (-b + s) / (2.0 * a);

    if (distanceToSphereFar >= 0.0) {
      return vec2(distanceToSphereNear, distanceToSphereFar - distanceToSphereNear);
    }
  }

  return vec2(max_float, 0.0);
}
`;

const calculateScattering2 = `
vec3 calculateScattering(vec3 rayOrigin, vec3 rayDir, float rayLength, vec4 baseColor) {
  return vec3(1.0, 1.0, 1.0);
}`;

const opticalDepth = `
float opticalDepth(vec3 rayOrigin, vec3 rayDir, float rayLength) {
  vec3 densitySamplePoint = rayOrigin;
  float stepSize = rayLength / (float(numOpticalDepthPoints) - 1.0);
  float opticalDepth = 0.0;

  for (int i = 0; i < numOpticalDepthPoints; i ++) {
    float localDensity = densityAtPoint(densitySamplePoint);
    opticalDepth += localDensity * stepSize;
    densitySamplePoint += rayDir * stepSize;
  }
  return opticalDepth;
}
`;

const densityAtPoint = `
float densityAtPoint(vec3 densitySamplePoint) {
  float heightAboveSurface = length(densitySamplePoint - u_earthCenter) - earth_radius;
  float height01 = heightAboveSurface / (u_atmosphereRadius - earth_radius);
  float localDensity = exp(-height01 * densityFalloff) * (1.0 - height01);
  return localDensity;
}
`;

const calculateScattering = `
vec4 calculateScattering(vec3 rayOrigin, vec3 rayDir, float rayLength, vec4 baseColor, vec3 scatteringCoefficients) {
  float stepSize = rayLength / (float(numInScatteringPoints) - 1.0);
  vec3 inScatteredLight = vec3(0.0, 0.0, 0.0);
  float viewRayOpticalDepth = 0.0;

  vec3 inScatterPoint = rayOrigin;
  for (int i = 0; i < numInScatteringPoints; i++) {
    float sunRayLength = raySphere(u_earthCenter, u_atmosphereRadius, inScatterPoint, normalize(u_sunDir))[1];
    float sunRayOpticalDepth = opticalDepth(inScatterPoint, normalize(u_sunDir), sunRayLength);
    viewRayOpticalDepth = opticalDepth(inScatterPoint, -rayDir, stepSize * float(i));
    vec3 transmittance = exp(-(sunRayOpticalDepth + viewRayOpticalDepth) * scatteringCoefficients);
    float localDensity = densityAtPoint(inScatterPoint);

    inScatteredLight += localDensity * transmittance;
    inScatterPoint += rayDir * stepSize;
  }
  float originalColorTransmittance = exp(-viewRayOpticalDepth);
  return vec4(baseColor.rgb * originalColorTransmittance + inScatteredLight, baseColor.a);
}
`;

/** @internal */
export function addAtmosphericScattering(builder: ProgramBuilder, isSky: boolean = false) {
  const frag = builder.frag;
  if (!(isSky))
    addEyeSpace(builder);

  frag.addConstant("isSky", VariableType.Boolean, `${isSky}`);
  frag.addConstant("max_float", VariableType.Float, "3.402823466e+38");
  frag.addConstant("earth_radius", VariableType.Float, "6371000.0");
  frag.addConstant("numInScatteringPoints", VariableType.Int, "10");
  frag.addConstant("numOpticalDepthPoints", VariableType.Int, "10");
  frag.addConstant("ditherStrength", VariableType.Float, "0.1");
  frag.addGlobal("wavelengths", VariableType.Vec3, "vec3(700.0, 530.0, 440.0)");
  frag.addConstant("scatteringStrength", VariableType.Float, "0.5");
  frag.addConstant("densityFalloff", VariableType.Float, "10.0");

  frag.addUniform("u_sunDir", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_sunDir", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindSunDirection(uniform);
    });
  }, VariablePrecision.High);

  if (isSky) {
    frag.addUniform("u_viewMatrix", VariableType.Mat3, (prog) => {
      prog.addProgramUniform("u_viewMatrix", (uniform, params) => {
        uniform.setMatrix3(Matrix3.fromMatrix3d(params.target.uniforms.frustum.viewMatrix.matrix));
      });
    }, VariablePrecision.High);
  }

  frag.addUniform("u_earthCenter", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_earthCenter", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindEarthCenter(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_atmosphereRadius", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_atmosphereRadius", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindAtmosphereRadius(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_isEnabled", VariableType.Int, (prog) => {
    prog.addProgramUniform("u_isEnabled", (uniform, params) => {
      uniform.setUniform1i(params.target.plan.viewFlags.atmosphericScattering?1:0);
    });
  }, VariablePrecision.High);

  frag.addFunction(raySphere);
  frag.addFunction(densityAtPoint);
  frag.addFunction(opticalDepth);
  frag.addFunction(calculateScattering);

  if (isSky)
    frag.set(FragmentShaderComponent.ApplyAtmosphericScattering, atmosphericScatteringPreludeSky+applyAtmosphericScattering);
  else
    frag.set(FragmentShaderComponent.ApplyAtmosphericScattering, atmosphericScatteringPreludeGeneric+applyAtmosphericScattering);
}
