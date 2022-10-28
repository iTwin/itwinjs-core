/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  FragmentShaderComponent,
  ProgramBuilder,
  ShaderType,
  VariablePrecision,
  VariableType,
} from "../ShaderBuilder";
import { MAX_SAMPLE_POINTS } from "../AtmosphereUniforms";

/** A physics-based atmospheric scattering technique that simulates how an atmosphere diverts light.
 * @internal
 * This shader adds an atmospheric scattering effect that mimics some aspects of the physical phenomenons of Rayleigh Scattering and Mie Scattering.
 *
 * This implementation is highly inspired by Sebastian Lague's Solar System project: https://github.com/SebLague/Solar-System/ and video: https://www.youtube.com/watch?v=DxfEbulyFcY
 * along with this ShaderToy replica: https://www.shadertoy.com/view/fltXD2.
 * Both of which are inspired by this Nvidia article on atmospheric scattering: https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering.
 *
 * The effect traces rays from the vertices or fragments toward the eye/camera and samples air density at multiple points to compute how much light is scattered away by the air molecules.
 * It also traces rays from the aforementioned sample points toward the sun and samples air density at multiple points to compute how much light is scattered in toward the eye/camera.
 *
 * The effect can be computed on vertices (the default for the background map) and fragments (the default for the skybox, which is a ViewportQuad).
 * The effect is much more accurate when computed on fragments, as the atmosphere is an ellipsoid. Air density between 2 vertices cannot be linearly interpolated.
 *
 * All coordinates are in view space.
 */

// #region GENERAL

const computeRayDir = `
vec3 computeRayDir(vec3 eyeSpace) {
  return u_isCameraEnabled ? normalize(eyeSpace) : vec3(0.0, 0.0, -1.0);
}
`;

const computeSceneDepthDefault = `
float computeSceneDepth(vec3 eyeSpace) {
  return u_isCameraEnabled ? length(eyeSpace) : -eyeSpace.z;
}
`;

const computeSceneDepthSky = `
float computeSceneDepth(vec3 eyeSpace) {
  return MAX_FLOAT;
}
`;

const computeRayOrigin = `
vec3 computeRayOrigin(vec3 eyeSpace) {
  return u_isCameraEnabled ? vec3(0.0) : vec3(eyeSpace.xy, 0.0);
}
`;

// #endregion GENERAL

// #region ELLIPSOID

/**
 * Computes the intersection of a ray with an ellipsoid and returns two values:
 * 1. The length from the ray's origin to the point it first intersects with the ellipsoid.
 * 2. The length from the first point the ray intersects with the sphere to the second point it intersects with the ellipsoid.
 *
 * First, the coordinates (rayOrigin, rayDir) are transformed such that the ellipsoid is axis-aligned and at (0, 0, 0).
 * Then, the coordinate space is scaled down by the ellipsoidScaleMatrix such that it becomes a unit sphere.
 * Finally, intersection with the unit sphere is computed and coordinates transformed back to their original scale to return the desired lengths.
 *
 * @param ellipsoidCenter - Center of the ellipsoid in view coordinates.
 * @param rayOrigin - The starting point of the ray in view coordinates.
 * @param rayDir - The direction of the ray in view space.
 * @param inverseRotationMatrix - Rotation matrix inverting the ecdb to world and world to eye rotations.
 * @param inverseScaleInverseRotationMatrix - Transformation matrix that corresponds to the inverse of the ellipsoidScaleMatrix multiplied by the inverseRotationMatrix.
 * @param ellipsoidScaleMatrix - Diagonal matrix where the diagonal represents the x, y and z radii of the ellipsoid.

 * @returns A vec2 of float values representing the ray's distance to and through the ellipsoid.
 */
const rayEllipsoidIntersection = `
vec2 rayEllipsoidIntersection(
  vec3 ellipsoidCenter,
  vec3 rayOrigin,
  vec3 rayDir,
  mat3 inverseRotationMatrix,
  mat3 inverseScaleInverseRotationMatrix,
  mat3 ellipsoidScaleMatrix
) {
  vec3 rayOriginFromEllipsoid = rayOrigin - ellipsoidCenter;
  vec3 rayOriginFromAxisAlignedEllipsoid = inverseRotationMatrix * rayOriginFromEllipsoid;
  vec3 rayOriginFromAxisAlignedUnitSphere = inverseScaleInverseRotationMatrix * rayOriginFromEllipsoid;
  vec3 rayDirFromAxisAlignedUnitSphere = normalize(inverseScaleInverseRotationMatrix * rayDir);

  vec2 intersectionInfo = raySphere(vec3(0.0), 1.0, rayOriginFromAxisAlignedUnitSphere, rayDirFromAxisAlignedUnitSphere);
  if (intersectionInfo[1] > 0.0) {
    vec3 intersectionOnUnitSphere = rayOriginFromAxisAlignedUnitSphere + rayDirFromAxisAlignedUnitSphere * intersectionInfo[0];
    vec3 intersectionOnAxisAlignedEllipsoid = ellipsoidScaleMatrix * intersectionOnUnitSphere;
    return vec2(
      distance(rayOriginFromAxisAlignedEllipsoid, intersectionOnAxisAlignedEllipsoid),
      length(ellipsoidScaleMatrix * rayDirFromAxisAlignedUnitSphere * intersectionInfo[1] - intersectionOnAxisAlignedEllipsoid)
    );
  }
  return intersectionInfo;
}
`;

/**
 * Computes the intersection of a ray with a sphere and returns two values:
 * 1. The length from the ray's origin to the point it first intersects with the sphere.
 * 2. The length from the first point the ray intersects with the sphere to the second point it intersects with the sphere.
 *
 * @param sphereCenter - The center point of the sphere in eye space.
 * @param sphereRadius - The radius of the sphere.
 * @param rayOrigin - The starting point of the ray in eye space.
 * @param rayDir - The direction of the ray.
 * @returns A vec2 of float values representing the ray's distance to and through the sphere.
 */
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
  return vec2(MAX_FLOAT, 0.0);
}
`;

/**
 * Returns the optical depth of a ray going through the atmosphere,
 * taking into account atmosphere density.
 *
 * @param rayOrigin - The starting point in eye space of the ray we calculate optical depth from.
 * @param rayDir - The direction of the ray.
 * @param rayLength - The length of the ray.
 * @returns A float in the range [0.0, rayLength] representing optical depth.
 */
const opticalDepth = `
float opticalDepth(vec3 rayOrigin, vec3 rayDir, float rayLength) {
  vec3 densitySamplePoint = rayOrigin;
  float stepSize = rayLength / (float(u_numOpticalDepthPoints) - 1.0);
  float opticalDepth = 0.0;
  vec3 rayStep = rayDir * stepSize;

  for (int i = 0; i < u_numOpticalDepthPoints; i ++) {
    float localDensity = densityAtPoint(densitySamplePoint);
    opticalDepth += localDensity;
    densitySamplePoint += rayStep;
  }
  return opticalDepth  * stepSize;
}
`;

/**
 * Returns the atmospheric density at a point according to its distance between
 * a minimum and maximum density height. Density decreases exponentially,
 * modulated by a density falloff coefficient.
 *
 * We find out at what ratio between the minimum density ellipsoid and the
 * maximum density ellipsoid (the atmosphere's limit) by squeezing the
 * coordinate space by the minimum density ellipsoid's scale factors, taking
 * the ellipsoid rotation into account. Then, we find out
 *
 * @param point - Point we want to sample density for.
 * @returns A density value between [0.0 - 1.0].
 */
const densityAtPoint = `
float densityAtPoint(vec3 point) {
  vec3 pointToMinDensityUnitSphere = u_inverseRotationInverseMinDensityScaleMatrix * (point - u_earthCenter);
  float atmosphereDistanceFromUnitSphere = u_minDensityToAtmosphereScaleFactor - 1.0;
  float distanceNotZero = atmosphereDistanceFromUnitSphere == 0.0 ? 0.0 : 1.0;
  float minToMaxRatio = distanceNotZero * (max(length(pointToMinDensityUnitSphere) - 1.0, 0.0) / atmosphereDistanceFromUnitSphere);
  return exp(-minToMaxRatio * u_densityFalloff) * (1.0 - minToMaxRatio);
}
`;

const computeInScatteredLightAndViewRayOpticalDepth = `
vec4 computeInScatteredLightAndViewRayOpticalDepth() {
  vec3 rayDir = computeRayDir(v_eyeSpace);
  vec3 rayOrigin = computeRayOrigin(v_eyeSpace);
  float sceneDepth = computeSceneDepth(v_eyeSpace);

  vec2 atmosphereHitInfo = rayEllipsoidIntersection(u_earthCenter, rayOrigin, rayDir, u_inverseEllipsoidRotationMatrix, u_inverseAtmosphereScaleInverseRotationMatrix, u_atmosphereScaleMatrix);
  vec2 earthHitInfo = rayEllipsoidIntersection(u_earthCenter, rayOrigin, rayDir, u_inverseEllipsoidRotationMatrix, u_inverseEarthScaleInverseRotationMatrix, u_earthScaleMatrix);

  // TODO: fix this code
  float distanceThroughAtmosphere = min(
    atmosphereHitInfo[1],
    min(sceneDepth, earthHitInfo[0] - atmosphereHitInfo[0]) // PREVENTS GRID EFFECT
  );

  if (distanceThroughAtmosphere > 0.0) {
    vec3 pointInAtmosphere = rayDir * (atmosphereHitInfo[0] + EPSILON) + rayOrigin;
    float rayLength = distanceThroughAtmosphere - EPSILONx2;
    float stepSize = rayLength / (float(u_numInScatteringPoints) - 1.0);
    vec3 step = rayDir * stepSize;
    vec3 inScatterPoint = pointInAtmosphere;

    float viewRayOpticalDepthValues[MAX_SAMPLE_POINTS + 1];
    viewRayOpticalDepthValues[0] = 0.0;
    vec3 viewRaySamplePoint = pointInAtmosphere + step;
    for (int i = 1; i < u_numInScatteringPoints; i++) {
      viewRayOpticalDepthValues[i] = densityAtPoint(viewRaySamplePoint) * stepSize + viewRayOpticalDepthValues[i-1];
      viewRaySamplePoint += step;
    }

    vec3 inScatteredLight = vec3(0.0);
    float viewRayOpticalDepth;
    for (int i = 0; i < u_numInScatteringPoints; i++) {
      float sunRayLength = rayEllipsoidIntersection(u_earthCenter, inScatterPoint, u_sunDir, u_inverseEllipsoidRotationMatrix, u_inverseAtmosphereScaleInverseRotationMatrix, u_atmosphereScaleMatrix)[1];
      float sunRayOpticalDepth = opticalDepth(inScatterPoint, u_sunDir, sunRayLength);

      viewRayOpticalDepth = viewRayOpticalDepthValues[i];

      vec3 transmittance = exp(-((sunRayOpticalDepth + viewRayOpticalDepth) / u_earthScaleMatrix[2][2]) * u_scatteringCoefficients);
      inScatteredLight += densityAtPoint(inScatterPoint) * transmittance;
      inScatterPoint += step;
    }

    inScatteredLight *= u_scatteringCoefficients * u_inScatteringIntensity * stepSize / u_earthScaleMatrix[2][2];
    return vec4(inScatteredLight, viewRayOpticalDepth);
  } else {
    return vec4(0.0);
  }
}
`;

const computeReflectedLight = `
vec3 computeReflectedLight(vec3 inScatteredLight, float viewRayOpticalDepth, vec3 baseColor) {
  float reflectedLightOutScatterStrength = 3.0;
  float brightnessAdaption = (inScatteredLight.r + inScatteredLight.g + inScatteredLight.b) * u_brightnessAdaptionStrength;
  float brightnessSum = viewRayOpticalDepth / u_earthScaleMatrix[2][2] * u_outScatteringIntensity * reflectedLightOutScatterStrength + brightnessAdaption;
  float reflectedLightStrength = exp(-brightnessSum);
  float hdrStrength = clamp((baseColor.r + baseColor.g + baseColor.b) / 3.0 - 1.0, 0.0, 1.0);
  reflectedLightStrength = mix(reflectedLightStrength, 1.0, hdrStrength);
  return baseColor * reflectedLightStrength;
}
`;

/**
 *   // We get the distance the ray traveled from the eye to the atmosphere and
  // the distance it traveled in the atmosphere to reach the fragment.
 *
 */
const computeAtmosphericScatteringFromVaryings = `
vec4 computeAtmosphericScattering(vec4 baseColor) {
  if (v_viewRayOpticalDepth == 0.0)
    return baseColor;
  vec3 reflectedLight = computeReflectedLight(v_inScatteredLight, v_viewRayOpticalDepth, baseColor.rgb);
  return vec4(reflectedLight + v_inScatteredLight, baseColor.a);
}
`;

const computeAtmosphericScatteringFromScratch = `
vec4 computeAtmosphericScattering(vec4 baseColor) {
  vec4 values = computeInScatteredLightAndViewRayOpticalDepth();
  if (values.w == 0.0)
    return baseColor;
  vec3 reflectedLight = computeReflectedLight(values.xyz, values.w, baseColor.rgb);
  return vec4(reflectedLight + values.xyz, baseColor.a);
}
`;

const inlineComputeAtmosphericScatteringVaryings = "computeAtmosphericScatteringVaryings();";

const computeAtmosphericScatteringVaryings = `
void computeAtmosphericScatteringVaryings() {
  vec4 values = computeInScatteredLightAndViewRayOpticalDepth();
  v_inScatteredLight = values.xyz;
  v_viewRayOpticalDepth = values.w;
}
`;
// #endregion ELLIPSOID

// #region MAIN

const applyAtmosphericScattering = `
  // return baseColor if atmospheric scattering is disabled
  if (!u_isEnabled)
    return baseColor;
  return computeAtmosphericScattering(baseColor);
`;

/** Adds the atmospheric effect to a technique
 * @internal
 *
 * @param isSky If true, the effect is automatically computed per fragment and fragments are understood to be infinitely (MAX_FLOAT) far away from the eye/camera.
 * @param perFragmentCompute If true, the effect is computed per fragment as opposed to per vertex.
 */
export function addAtmosphericScatteringEffect(
  builder: ProgramBuilder,
  isSky = false,
  perFragmentCompute = false,
) {
  perFragmentCompute = perFragmentCompute || isSky;
  const mainShader = perFragmentCompute ? builder.frag : builder.vert;

  const frag = builder.frag;

  mainShader.addConstant("PI", VariableType.Float, "3.14159265359");
  mainShader.addConstant("EPSILON", VariableType.Float, "0.000001");
  mainShader.addConstant("EPSILONx2", VariableType.Float, "EPSILON * 2.0");
  mainShader.addConstant("MAX_FLOAT", VariableType.Float, "3.402823466e+38");
  mainShader.addConstant("MAX_SAMPLE_POINTS", VariableType.Int, `${MAX_SAMPLE_POINTS}`);

  mainShader.addUniform(
    "u_densityFalloff",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_densityFalloff", (uniform, params) => {
        params.target.uniforms.atmosphere.bindDensityFalloff(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_scatteringCoefficients",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_scatteringCoefficients", (uniform, params) => {
        params.target.uniforms.atmosphere.bindScatteringCoefficients(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_numInScatteringPoints",
    VariableType.Int,
    (prog) => {
      prog.addProgramUniform("u_numInScatteringPoints", (uniform, params) => {
        params.target.uniforms.atmosphere.bindNumInScatteringPoints(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_numOpticalDepthPoints",
    VariableType.Int,
    (prog) => {
      prog.addProgramUniform("u_numOpticalDepthPoints", (uniform, params) => {
        params.target.uniforms.atmosphere.bindNumOpticalDepthPoints(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_sunDir",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_sunDir", (uniform, params) => {
        params.target.uniforms.bindSunDirection(uniform);
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_earthCenter",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_earthCenter", (uniform, params) => {
        params.target.uniforms.atmosphere.bindEarthCenter(uniform);
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_inverseEllipsoidRotationMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseEllipsoidRotationMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInverseEllipsoidRotationMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_atmosphereScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_atmosphereScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindAtmosphereScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_minDensityToAtmosphereScaleFactor",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_minDensityToAtmosphereScaleFactor", (uniform, params) => {
        params.target.uniforms.atmosphere.bindMinDensityToAtmosphereScaleFactor(uniform);
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_inScatteringIntensity",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_inScatteringIntensity", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInScatteringIntensity(uniform);
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_inverseAtmosphereScaleInverseRotationMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseAtmosphereScaleInverseRotationMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInverseRotationInverseAtmosphereScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_inverseEarthScaleInverseRotationMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseEarthScaleInverseRotationMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInverseRotationInverseEarthScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_inverseRotationInverseMinDensityScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseRotationInverseMinDensityScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInverseRotationInverseMinDensityScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  mainShader.addUniform(
    "u_isCameraEnabled",
    VariableType.Boolean,
    (prog) => {
      prog.addProgramUniform("u_isCameraEnabled", (uniform, params) => {
        params.target.uniforms.atmosphere.bindIsCameraEnabled(uniform);
      });
    }
  );

  mainShader.addFunction(computeRayOrigin);
  mainShader.addFunction(computeRayDir);
  if (isSky) {
    mainShader.addFunction(computeSceneDepthSky);
  } else {
    mainShader.addFunction(computeSceneDepthDefault);
  }
  mainShader.addFunction(raySphere);
  mainShader.addFunction(densityAtPoint);
  mainShader.addFunction(rayEllipsoidIntersection);
  mainShader.addFunction(opticalDepth);
  mainShader.addFunction(computeInScatteredLightAndViewRayOpticalDepth);

  frag.addUniform(
    "u_brightnessAdaptionStrength",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_brightnessAdaptionStrength", (uniform, params) => {
        params.target.uniforms.atmosphere.bindBrightnessAdaptationStrength(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_outScatteringIntensity",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_outScatteringIntensity", (uniform, params) => {
        params.target.uniforms.atmosphere.bindOutScatteringIntensity(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addFunction(computeReflectedLight);

  if (perFragmentCompute) {
    frag.addUniform(
      "u_earthScaleMatrix",
      VariableType.Mat3,
      (prog) => {
        prog.addProgramUniform("u_earthScaleMatrix", (uniform, params) => {
          params.target.uniforms.atmosphere.bindEarthScaleMatrix(uniform);
        });
      },
      VariablePrecision.High
    );
    frag.addUniform(
      "u_isEnabled",
      VariableType.Boolean,
      (prog) => {
        prog.addProgramUniform("u_isEnabled", (uniform, params) => {
          params.target.uniforms.atmosphere.bindIsEnabled(uniform);
        });
      },
    );
    frag.addFunction(computeAtmosphericScatteringFromScratch);
  } else {
    builder.addUniform(
      "u_earthScaleMatrix",
      VariableType.Mat3,
      (prog) => {
        prog.addProgramUniform("u_earthScaleMatrix", (uniform, params) => {
          params.target.uniforms.atmosphere.bindEarthScaleMatrix(uniform);
        });
      },
      ShaderType.Both
    );
    builder.addUniform(
      "u_isEnabled",
      VariableType.Boolean,
      (prog) => {
        prog.addProgramUniform("u_isEnabled", (uniform, params) => {
          params.target.uniforms.atmosphere.bindIsEnabled(uniform);
        });
      },
      ShaderType.Both
    );
    builder.vert.addFunction(computeAtmosphericScatteringVaryings);
    builder.addVarying("v_viewRayOpticalDepth", VariableType.Float);
    builder.addInlineComputedVarying("v_inScatteredLight", VariableType.Vec3, inlineComputeAtmosphericScatteringVaryings);

    builder.frag.addFunction(computeAtmosphericScatteringFromVaryings);
  }

  frag.set(
    FragmentShaderComponent.ApplyAtmosphericScattering,
    applyAtmosphericScattering
  );
}

// #endregion MAIN
