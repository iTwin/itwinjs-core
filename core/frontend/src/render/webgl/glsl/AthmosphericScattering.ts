/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { addEyeSpace } from "./Common";
import { FragmentShaderComponent, ProgramBuilder, VariablePrecision, VariableType } from "../ShaderBuilder";
import { Matrix3 } from "../Matrix";

const atmosphericScatteringPreludeGeneric = `
  // sceneDepth in the length of the ray from the eye to the fragment in view space.
  float sceneDepth = length(v_eyeSpace);

  // direction from the eye to the fragment
  vec3 rayDir = normalize(v_eyeSpace);
`;
const atmosphericScatteringPreludeSky = `
  // sceneDepth in the length of the ray from the eye to the fragment in view space.
  // For fragments corresponding to the sky, we suppose the ray is almost infinite.
  float sceneDepth = max_float;

  // direction from the eye to the fragment
  vec3 rayDir = normalize(u_viewMatrix * v_eyeToVert);
`;

const applyAtmosphericScattering = `
  // return baseColor if atmospheric scattering is disabled
  if (!bool(u_isEnabled))
    return baseColor;

  // Because we are in view space, the ray's origin is at 0,0,0
  vec3 rayOrigin = vec3(0.0, 0.0, 0.0);

  // We get the distance the ray traveled from the eye to the atmosphere and
  // the distance it traveled in the atmosphere to reach the fragment.
  vec2 hitInfo = raySphere(u_earthCenter, u_atmosphereRadius, rayOrigin, rayDir);
  float distanceToAtmosphere = hitInfo[0];
  // We remove distance through atmosphere beyond the fragment's position
  float distanceThroughAtmosphere = min(hitInfo[1], sceneDepth - distanceToAtmosphere);

  if (distanceThroughAtmosphere > 0.0) {
    // float epsilon = 0.0001;

    // point on ray where atmosphere starts
    vec3 pointInAtmosphere = rayOrigin + rayDir * distanceToAtmosphere;
    float light = calculateScattering(pointInAtmosphere, rayDir, distanceThroughAtmosphere);
    // if (light < 0.0)
    //   return vec4(1.0, 0.0, 0.0, 1.0);
    // if (light == 0.0)
    //   return vec4(0.0, 0.0, 0.0, 1.0);
    // if (light > 0.0 && light <= 1.0)
    //   return vec4(0.0, 0.2, 0.0, 1.0);
    // if (light > 1.0 && light <= 10.0)
    //   return vec4(0.0, 0.4, 0.0, 1.0);
    // if (light > 10.0 && light <= 100.0)
    //   return vec4(0.0, 0.6, 0.0, 1.0);
    // if (light > 100.0 && light <= 1000.0)
    //   return vec4(0.0, 0.8, 0.0, 1.0);
    // if (light > 1000.0 && light <= 10000.0)
    //   return vec4(0.0, 1.0, 0.0, 1.0);
    // else
    //   return vec4(1.0, 1.0, 1.0, 1.0);

    return vec4(mix(baseColor.rgb, vec3(1.0, 1.0, 1.0), light), baseColor.a);
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
  float heightAboveSurface = distance(densitySamplePoint, u_earthCenter) - u_earthRadius;
  float height01 = clamp(heightAboveSurface / (u_atmosphereRadius - u_earthRadius), 0.0, 1.0);
  float localDensity = exp(-height01 * u_densityFalloff) * (1.0 - height01);
  return localDensity;
}
`;

const calculateScattering = `
float calculateScattering(vec3 rayOrigin, vec3 rayDir, float rayLength) {
  float stepSize = rayLength / (float(numInScatteringPoints) - 1.0);
  float inScatteredLight = 0.0;
  float debugLocalDensity = 0.0;
  // float viewRayOpticalDepth = 0.0;

  vec3 inScatterPoint = rayOrigin;
  for (int i = 0; i < numInScatteringPoints; i++) {
    float sunRayLength = raySphere(u_earthCenter, u_atmosphereRadius, inScatterPoint, -normalize(u_sunDir))[1];
    float sunRayOpticalDepth = opticalDepth(inScatterPoint, -normalize(u_sunDir), sunRayLength);
    float viewRayOpticalDepth = opticalDepth(inScatterPoint, -rayDir, stepSize * float(i));
    float transmittance = exp(-(sunRayOpticalDepth + viewRayOpticalDepth));
    float localDensity = densityAtPoint(inScatterPoint);
    // debugLocalDensity = min(localDensity, debugLocalDensity);

    inScatteredLight += localDensity * transmittance * stepSize;
    inScatterPoint += rayDir * stepSize;
  }
  // return debugLocalDensity;
  return inScatteredLight;
  // float originalColorTransmittance = exp(-viewRayOpticalDepth);
  // return vec4(baseColor.rgb * originalColorTransmittance + inScatteredLight, baseColor.a);
}
`;

/** @internal */
export function addAtmosphericScattering(builder: ProgramBuilder, isSky: boolean = false) {
  const frag = builder.frag;
  if (!(isSky))
    addEyeSpace(builder);

  frag.addConstant("isSky", VariableType.Boolean, `${isSky}`);
  frag.addConstant("max_float", VariableType.Float, "3.402823466e+38");

  frag.addConstant("numInScatteringPoints", VariableType.Int, "10");
  frag.addConstant("numOpticalDepthPoints", VariableType.Int, "10");
  frag.addConstant("ditherStrength", VariableType.Float, "0.1");

  frag.addUniform("u_densityFalloff", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_densityFalloff", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindDensityFalloff(uniform);
    });
  }, VariablePrecision.High);

  // frag.addUniform("u_scatteringCoefficients", VariableType.Vec3, (prog) => {
  //   prog.addProgramUniform("u_scatteringCoefficients", (uniform, params) => {
  //     params.target.uniforms.atmosphericScattering.bindScatteringCoefficients(uniform);
  //   });
  // }, VariablePrecision.High);

  frag.addUniform("u_sunDir", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_sunDir", (uniform, params) => {
      params.target.uniforms.bindSunDirection(uniform);
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

  frag.addUniform("u_earthRadius", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_earthRadius", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindEarthRadius(uniform);
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
